-- ============================================================================
-- 20260729_room_multi_member.sql — 친구 방 인원 2인 → 최대 10인
--
-- 포함:
--   1) rooms.capacity 컬럼 (2~10, 신규 방 기본 10)
--      기존 방은 capacity = 2 로 채워 현재 배포본과 동작이 같습니다.
--   2) create_room 에 p_capacity 인자 추가 (기본 10)
--   3) join_room 정원 검사 — 2 고정 → v_room.capacity
--   4) start_room_session — 2명 고정 → 2명 이상 · 전원 ready,
--      시작 시점 참가자 수로 공동 괴물 체력 확정 (1000 × 인원)
--   5) complete_room_if_done — "정확히 2명 완주" → "전원 완주"
--
-- 안전 보장: 데이터 삭제 없음 · 기존 방 동작 불변(capacity=2) ·
--            RLS·Realtime 변경 없음 · 여러 번 실행해도 안전(멱등).
-- 기존 마이그레이션 파일은 수정하지 않았습니다.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) capacity 컬럼
-- ---------------------------------------------------------------------------
alter table public.rooms add column if not exists capacity integer;

-- 이 migration 이전에 만들어진 방은 2인 방이었습니다. 그대로 유지합니다.
update public.rooms set capacity = 2 where capacity is null;

alter table public.rooms alter column capacity set default 10;
alter table public.rooms alter column capacity set not null;

do $do$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rooms_capacity_range'
  ) then
    alter table public.rooms
      add constraint rooms_capacity_range check (capacity between 2 and 10);
  end if;
end $do$;

-- ---------------------------------------------------------------------------
-- 2) create_room — p_capacity 추가
--    기존 5인자 시그니처를 남겨 두면 PostgREST 가 모호해지므로 교체합니다.
-- ---------------------------------------------------------------------------
drop function if exists public.create_room(text, text, text, text, integer);

create or replace function public.create_room(
  p_code text,
  p_nickname text,
  p_subject text default null,
  p_goal text default null,
  p_duration_seconds integer default 1500,
  p_capacity integer default 10
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_code !~ '^[A-Z0-9]{6}$' then
    raise exception 'invalid room code';
  end if;

  if char_length(trim(p_nickname)) < 1 or char_length(trim(p_nickname)) > 12 then
    raise exception 'invalid nickname';
  end if;

  if p_capacity is null or p_capacity < 2 or p_capacity > 10 then
    raise exception 'invalid capacity';
  end if;

  insert into public.rooms (
    code, host_user_id, subject, goal, duration_seconds, capacity
  ) values (
    p_code, auth.uid(), nullif(trim(p_subject), ''), nullif(trim(p_goal), ''),
    p_duration_seconds, p_capacity
  ) returning id into v_room_id;

  insert into public.room_members (
    room_id, user_id, nickname, role, state
  ) values (
    v_room_id, auth.uid(), trim(p_nickname), 'host', 'ready'
  );

  return v_room_id;
end;
$$;

grant execute on function
  public.create_room(text, text, text, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) join_room — 정원은 방마다 다릅니다
-- ---------------------------------------------------------------------------
create or replace function public.join_room(
  p_code text,
  p_nickname text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if char_length(trim(p_nickname)) < 1 or char_length(trim(p_nickname)) > 12 then
    raise exception 'invalid nickname';
  end if;

  select * into v_room
  from public.rooms
  where code = upper(p_code)
  for update;

  if not found then
    raise exception 'room not found';
  end if;

  if v_room.status <> 'waiting' then
    raise exception 'room is not waiting';
  end if;

  -- 이미 들어와 있는 참가자의 재접속은 정원 검사를 하지 않습니다.
  if not exists (
    select 1 from public.room_members
    where room_id = v_room.id and user_id = auth.uid()
  ) then
    select count(*) into v_count
    from public.room_members
    where room_id = v_room.id;

    if v_count >= coalesce(v_room.capacity, 2) then
      raise exception 'room is full';
    end if;
  end if;

  insert into public.room_members (
    room_id, user_id, nickname, role, state
  ) values (
    v_room.id, auth.uid(), trim(p_nickname), 'member', 'joining'
  )
  on conflict (room_id, user_id)
  do update set nickname = excluded.nickname, updated_at = now();

  return v_room.id;
end;
$$;

grant execute on function public.join_room(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) start_room_session — 2명 이상 · 전원 ready · 인원 비례 괴물 체력
--    체력은 시작 시점 인원으로 한 번만 확정하고 이후 재계산하지 않습니다.
--    (security definer 이므로 rooms_block_direct_combat 트리거를 통과합니다)
-- ---------------------------------------------------------------------------
create or replace function public.start_room_session(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_members integer;
  v_ready integer;
  v_boss integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    raise exception 'room not found';
  end if;

  if v_room.host_user_id <> auth.uid() then
    raise exception 'only the host can start';
  end if;

  if v_room.status <> 'waiting' then
    raise exception 'room is not waiting';
  end if;

  select count(*), count(*) filter (where state = 'ready')
    into v_members, v_ready
  from public.room_members
  where room_id = p_room_id;

  if v_members < 2 then
    raise exception 'room needs at least two members';
  end if;

  if v_ready <> v_members then
    raise exception 'all members must be ready';
  end if;

  -- 참가자 1명당 1000. 2명이면 2000 으로 기존과 같습니다.
  v_boss := 1000 * v_members;

  update public.rooms
  set status = 'running',
      started_at = now(),
      boss_max_hp = v_boss,
      boss_hp = v_boss
  where id = p_room_id;
end;
$$;

grant execute on function public.start_room_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) complete_room_if_done — 전원 완주
-- ---------------------------------------------------------------------------
create or replace function public.complete_room_if_done(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_total integer;
  v_done integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.is_room_member(p_room_id) then
    raise exception 'not a room member';
  end if;

  perform 1 from public.rooms
   where id = p_room_id and status = 'running'
   for update;
  if not found then return; end if;

  select count(*),
         count(*) filter (where state = 'completed')
    into v_total, v_done
    from public.room_members
   where room_id = p_room_id;

  -- 빈 방·혼자 남은 방은 completed 처리하지 않습니다.
  if v_total >= 2 and v_done = v_total then
    update public.rooms
       set status = 'completed', ended_at = coalesce(ended_at, now()), updated_at = now()
     where id = p_room_id and status = 'running';
  end if;
end; $$;

grant execute on function public.complete_room_if_done(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) 실행 확인
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.rooms where capacity = 2)  as legacy_rooms_capacity_2,
  (select count(*) from public.rooms where capacity > 2)  as multi_rooms,
  (select column_default from information_schema.columns
    where table_name = 'rooms' and column_name = 'capacity') as capacity_default;

-- ============================================================================
-- ROLLBACK (주석 해제 후 실행 — 방 데이터는 삭제하지 않습니다)
-- ============================================================================
-- alter table public.rooms drop constraint if exists rooms_capacity_range;
-- alter table public.rooms drop column if exists capacity;
-- (create_room / join_room / start_room_session / complete_room_if_done 은
--  supabase/schema.sql 과 20260726_room_lifecycle_security.sql,
--  20260727_room_presence_cleanup.sql 의 정의를 다시 실행하면 되돌아갑니다.)

-- ============================================================================
-- 20260731_persistent_room.sql — 상시 방 (완주 후 대기실 복귀·재사용)
--
-- 포함:
--   1) rooms.is_persistent 컬럼 (기본 false = 기존·신규 일반 방 동작 불변)
--   2) create_room — p_is_persistent 인자 추가 + 1인당 상시 방 3개 제한
--   3) start_room_session — 상시 방은 이전 라운드에서 올라간 최대 HP 를
--      내리지 않음(ratchet 유지). 일반 방은 기존 그대로 1000 × 인원.
--   4) complete_room_if_done — 전원 완주 보너스 150 은 두 경우 모두 발동.
--      · 일반 방: 기존 그대로 completed 처리
--      · 상시 방: completed 대신 waiting 복귀 — 누적 피해 0 리셋,
--        boss_max_hp 유지, 참가자 상태는 준비 전(joining)으로 초기화
--   5) leave_room — 상시 방은 모두 나가도 닫지 않고 waiting 으로 되돌림
--   6) cleanup_abandoned_rooms — 45초 무응답 정리는 일반 방만.
--      상시 방은 7일 무활동일 때만 정리 대상.
--
-- 선행 조건: 20260731_room_hp_recalc.sql 이 먼저 실행되어 있어야 합니다.
--            (damage_total 컬럼이 그 파일에서 만들어집니다)
--
-- 안전 보장: 데이터 삭제 없음 · 일반 방 동작 불변(2인 시작 = 2000 포함) ·
--            RLS·Realtime 변경 없음 · 여러 번 실행해도 안전(멱등).
-- 기존 마이그레이션 파일은 수정하지 않았습니다.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) is_persistent 컬럼 — 기존 방은 전부 일반 방(false)
-- ---------------------------------------------------------------------------
alter table public.rooms
  add column if not exists is_persistent boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2) create_room — 상시 여부 + 1인당 3개 제한
--    기존 6인자 시그니처를 남겨 두면 PostgREST 가 모호해지므로 교체합니다.
--    (새 함수의 p_is_persistent 기본값이 false 라 예전 클라이언트도 그대로
--     동작합니다)
-- ---------------------------------------------------------------------------
drop function if exists public.create_room(text, text, text, text, integer, integer);

create or replace function public.create_room(
  p_code text,
  p_nickname text,
  p_subject text default null,
  p_goal text default null,
  p_duration_seconds integer default 1500,
  p_capacity integer default 10,
  p_is_persistent boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_persistent integer;
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

  -- 상시 방 개수 제한 — 닫힌 방은 세지 않습니다.
  -- 3 은 src/constants/rooms.ts 의 MAX_PERSISTENT_ROOMS 와 같아야 합니다.
  if coalesce(p_is_persistent, false) then
    select count(*) into v_persistent
      from public.rooms
     where host_user_id = auth.uid()
       and is_persistent
       and status <> 'closed';

    if v_persistent >= 3 then
      raise exception 'persistent room limit reached';
    end if;
  end if;

  insert into public.rooms (
    code, host_user_id, subject, goal, duration_seconds, capacity, is_persistent
  ) values (
    p_code, auth.uid(), nullif(trim(p_subject), ''), nullif(trim(p_goal), ''),
    p_duration_seconds, p_capacity, coalesce(p_is_persistent, false)
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
  public.create_room(text, text, text, text, integer, integer, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3) start_room_session — 상시 방은 최대 HP 를 내리지 않습니다(ratchet 유지)
--    일반 방은 20260731_room_hp_recalc.sql 정의와 완전히 같습니다.
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

  if v_room.is_persistent then
    -- 상시 방 — 이전 라운드에서 올라간 최대 HP 를 유지합니다(ratchet).
    v_boss := greatest(v_room.boss_max_hp, 1000 * v_members);
  else
    -- 일반 방 — 참가자 1명당 1000. 2명이면 2000 으로 기존과 같습니다.
    v_boss := 1000 * v_members;
  end if;

  update public.rooms
  set status = 'running',
      started_at = now(),
      boss_max_hp = v_boss,
      boss_hp = v_boss,
      damage_total = 0
  where id = p_room_id;
end;
$$;

grant execute on function public.start_room_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) complete_room_if_done — 보너스 150 발동 후, 상시 방은 waiting 복귀
-- ---------------------------------------------------------------------------
create or replace function public.complete_room_if_done(p_room_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_room public.rooms%rowtype;
  v_total integer;
  v_done integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not public.is_room_member(p_room_id) then
    raise exception 'not a room member';
  end if;

  select * into v_room
    from public.rooms
   where id = p_room_id and status = 'running'
   for update;
  if not found then return; end if;

  select count(*),
         count(*) filter (where state = 'completed')
    into v_total, v_done
    from public.room_members
   where room_id = p_room_id;

  -- 빈 방·혼자 남은 방은 처리하지 않습니다.
  if v_total >= 2 and v_done = v_total then
    -- 전원 완주 보너스 — 일반·상시 공통으로 복귀/종료 직전에 발동합니다.
    -- 150 = ROOM_DAMAGE.bothCompleted (src/features/rooms/roomEvents.ts)
    update public.rooms
       set damage_total = damage_total + 150,
           boss_hp = greatest(0, boss_max_hp - (damage_total + 150)),
           updated_at = now()
     where id = p_room_id and status = 'running';

    if v_room.is_persistent then
      -- 상시 방 — completed 대신 대기실로 복귀합니다.
      -- 누적 피해만 리셋하고 boss_max_hp 는 유지합니다(ratchet 그대로).
      update public.rooms
         set status = 'waiting',
             started_at = null,
             damage_total = 0,
             boss_hp = boss_max_hp,
             shield = 0,
             updated_at = now()
       where id = p_room_id and status = 'running';

      -- 참가자는 준비 전 상태로 되돌려 다음 라운드를 다시 준비하게 합니다.
      update public.room_members
         set state = 'joining', updated_at = now()
       where room_id = p_room_id;
    else
      -- 일반 방 — 기존 그대로 completed 처리합니다.
      update public.rooms
         set status = 'completed', ended_at = coalesce(ended_at, now()), updated_at = now()
       where id = p_room_id and status = 'running';
    end if;
  end if;
end; $$;

grant execute on function public.complete_room_if_done(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) leave_room — 상시 방은 비어도 닫지 않습니다
-- ---------------------------------------------------------------------------
create or replace function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_was_host boolean;
  v_remaining uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    return; -- 이미 정리된 방 — 조용히 종료
  end if;

  v_was_host := v_room.host_user_id = auth.uid();

  delete from public.room_members
  where room_id = p_room_id and user_id = auth.uid();

  select user_id into v_remaining
  from public.room_members
  where room_id = p_room_id
  limit 1;

  if v_remaining is null then
    if v_room.is_persistent then
      -- 상시 방 — 모두 나가도 방을 남깁니다. 진행 중이던 라운드만
      -- 대기 상태로 되돌려 다음에 이어서 쓸 수 있게 합니다.
      update public.rooms
         set status = 'waiting',
             started_at = null,
             damage_total = 0,
             boss_hp = boss_max_hp,
             shield = 0,
             updated_at = now()
       where id = p_room_id and status <> 'closed';
    else
      -- 일반 방 — 마지막 참가자가 나가면 종료 (기존 그대로)
      update public.rooms
      set status = 'closed', ended_at = now()
      where id = p_room_id and status <> 'closed';
    end if;
  elsif v_was_host then
    -- 방장 이탈 → 남은 참가자에게 방장 이전 (기존 그대로)
    update public.rooms set host_user_id = v_remaining where id = p_room_id;
    update public.room_members
    set role = 'host'
    where room_id = p_room_id and user_id = v_remaining;
  end if;
end;
$$;

grant execute on function public.leave_room(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) cleanup_abandoned_rooms — 상시 방은 7일 무활동일 때만 정리
-- ---------------------------------------------------------------------------
create or replace function public.cleanup_abandoned_rooms()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_closed integer := 0;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  with abandoned as (
    select r.id
      from public.rooms r
     where r.status in ('waiting', 'running')
       and r.ended_at is null
       and (
         -- 일반 방: 멤버가 있는데 모두 45초 이상 무응답 (기존 규칙)
         (
           not r.is_persistent
           and exists (select 1 from public.room_members m where m.room_id = r.id)
           and not exists (
             select 1 from public.room_members m
              where m.room_id = r.id
                and m.last_seen_at >= now() - interval '45 seconds'
           )
         )
         -- 상시 방: 즉시 지우지 않고, 7일 동안 아무 변화가 없을 때만 정리
         or (
           r.is_persistent
           and r.updated_at < now() - interval '7 days'
         )
       )
     limit 10
  )
  update public.rooms r
     set status = 'closed', ended_at = now(), updated_at = now()
    from abandoned a
   where r.id = a.id;
  get diagnostics v_closed = row_count;
  return v_closed;
end; $$;

grant execute on function public.cleanup_abandoned_rooms() to authenticated;

-- ---------------------------------------------------------------------------
-- 7) 실행 확인 — is_persistent_default = false, create_room_count = 1,
--    has_damage_total = true (선행 마이그레이션 확인) 이어야 정상입니다.
-- ---------------------------------------------------------------------------
select
  (select column_default from information_schema.columns
    where table_name = 'rooms' and column_name = 'is_persistent')
    as is_persistent_default,
  (select count(*) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_room')
    as create_room_count,
  exists (
    select 1 from information_schema.columns
    where table_name = 'rooms' and column_name = 'damage_total'
  ) as has_damage_total;

-- ============================================================================
-- ROLLBACK (주석 해제 후 실행 — 방 데이터는 삭제하지 않습니다)
-- ============================================================================
-- drop function if exists
--   public.create_room(text, text, text, text, integer, integer, boolean);
-- alter table public.rooms drop column if exists is_persistent;
-- (create_room 6인자 / start_room_session / complete_room_if_done 은
--  20260729_room_multi_member.sql · 20260731_room_hp_recalc.sql 정의를,
--  leave_room 은 20260726_room_lifecycle_security.sql 정의를,
--  cleanup_abandoned_rooms 는 20260727_room_presence_cleanup.sql 정의를
--  다시 실행하면 되돌아갑니다. 함수부터 되돌린 뒤 컬럼을 지워야 안전합니다.)

-- ============================================================================
-- 20260731_room_hp_recalc.sql — 공동 괴물 HP 저장 구조 재설계
--
-- "남은 HP(boss_hp)" 하나만 저장하던 구조를
-- "최대 HP(boss_max_hp) + 누적 피해(damage_total)" 로 바꿉니다.
--   남은 HP = greatest(0, boss_max_hp - damage_total)
-- boss_hp 컬럼은 삭제하지 않고 RPC 안에서 항상 위 식으로 함께 갱신해
-- 기존 클라이언트(boss_hp 를 읽음)와 완전히 호환됩니다.
--
-- 포함:
--   1) rooms.damage_total 컬럼 + 백필 (damage_total = boss_max_hp - boss_hp)
--   2) apply_room_damage — boss_hp 직접 감소 → damage_total 누적으로 교체
--   3) recalc_room_boss(p_room_id) 헬퍼 — 인원 기준 max 상향(ratchet: 올리기만,
--      절대 내리지 않음 = 퇴장 시 유지 A안). 다음 작업 "중간 합류"에서
--      join_room 이 호출할 예정이며 이번에는 정의·grant 까지만 합니다.
--   4) start_room_session — 기존 로직 그대로 + damage_total = 0 리셋 추가
--      (2명 시작 = 2000 으로 기존과 동일)
--   5) complete_room_if_done — 전원 완주로 completed 전환하는 순간
--      bothCompleted 보너스 150 발동 (status='running' 가드로 1회만)
--      150 은 src/features/rooms/roomEvents.ts 의 ROOM_DAMAGE.bothCompleted 와
--      같아야 합니다.
--   6) rooms_block_direct_combat 트리거 — damage_total 직접 UPDATE 도 차단
--
-- 안전 보장: 데이터 삭제 없음 · 기존 방 남은 HP 불변(백필은 항등 변환) ·
--            RLS·Realtime 변경 없음 · 여러 번 실행해도 안전(멱등).
-- 기존 마이그레이션 파일은 수정하지 않았습니다.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) damage_total 컬럼 + 백필
-- ---------------------------------------------------------------------------
alter table public.rooms add column if not exists damage_total integer;

-- 지금까지 받은 피해 = 최대 HP - 남은 HP. 남은 HP 는 그대로이므로 동작 불변.
update public.rooms
   set damage_total = greatest(0, boss_max_hp - boss_hp)
 where damage_total is null;

alter table public.rooms alter column damage_total set default 0;
alter table public.rooms alter column damage_total set not null;

do $do$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'rooms_damage_total_nonneg'
  ) then
    alter table public.rooms
      add constraint rooms_damage_total_nonneg check (damage_total >= 0);
  end if;
end $do$;

-- ---------------------------------------------------------------------------
-- 2) apply_room_damage — 피해를 damage_total 에 누적하고 boss_hp 는 파생값으로
--    검증·중복 차단(room_events_processed)·반환값(남은 HP)은 기존과 같습니다.
-- ---------------------------------------------------------------------------
create or replace function public.apply_room_damage(
  p_room_id uuid,
  p_event_id uuid,
  p_event_type text,
  p_damage integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hp integer;
  v_inserted integer;
begin
  if not public.is_room_member(p_room_id) then
    raise exception 'not a room member';
  end if;

  if p_event_type not in ('recovery_earned', 'session_completed', 'giraffe_sync') then
    raise exception 'invalid event type';
  end if;

  if p_damage < 0 or p_damage > 250 then
    raise exception 'invalid damage';
  end if;

  insert into public.room_events_processed (
    event_id, room_id, user_id, event_type
  ) values (
    p_event_id, p_room_id, auth.uid(), p_event_type
  ) on conflict do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select boss_hp into v_hp from public.rooms where id = p_room_id;
    return v_hp;
  end if;

  -- 한 UPDATE 안에서 우변은 모두 갱신 전 값을 읽으므로
  -- boss_hp 도 같은 (damage_total + p_damage) 기준으로 계산됩니다.
  update public.rooms
     set damage_total = damage_total + p_damage,
         boss_hp = greatest(0, boss_max_hp - (damage_total + p_damage))
   where id = p_room_id
  returning boss_hp into v_hp;

  return v_hp;
end;
$$;

grant execute on function
  public.apply_room_damage(uuid, uuid, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) recalc_room_boss — 현재 인원 기준으로 최대 HP 를 "상향만" 합니다.
--    greatest(기존 max, 1000 × 인원) 이라 인원이 줄어도 내려가지 않습니다(A안).
--    누적 피해는 건드리지 않으므로 이미 준 피해는 그대로 유지됩니다.
-- ---------------------------------------------------------------------------
create or replace function public.recalc_room_boss(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_members integer;
  v_new_max integer;
begin
  if not public.is_room_member(p_room_id) then
    raise exception 'not a room member';
  end if;

  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then
    return;
  end if;

  -- 진행 중인 방만 대상 — waiting 은 start_room_session 이 확정합니다.
  if v_room.status <> 'running' then
    return;
  end if;

  select count(*) into v_members
    from public.room_members
   where room_id = p_room_id;

  v_new_max := greatest(v_room.boss_max_hp, 1000 * v_members);

  update public.rooms
     set boss_max_hp = v_new_max,
         boss_hp = greatest(0, v_new_max - damage_total)
   where id = p_room_id;
end;
$$;

grant execute on function public.recalc_room_boss(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) start_room_session — 20260729 정의 + damage_total = 0 리셋
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
      boss_hp = v_boss,
      damage_total = 0
  where id = p_room_id;
end;
$$;

grant execute on function public.start_room_session(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) complete_room_if_done — 전원 완주 시 bothCompleted 보너스 150 발동
--    running → completed 전환은 한 번만 일어나므로 보너스도 1회만 적용됩니다.
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
    -- 150 = ROOM_DAMAGE.bothCompleted (src/features/rooms/roomEvents.ts)
    update public.rooms
       set damage_total = damage_total + 150,
           boss_hp = greatest(0, boss_max_hp - (damage_total + 150)),
           status = 'completed', ended_at = coalesce(ended_at, now()), updated_at = now()
     where id = p_room_id and status = 'running';
  end if;
end; $$;

grant execute on function public.complete_room_if_done(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) 직접 UPDATE 차단 트리거에 damage_total 추가
--    (security definer RPC 는 통과, 클라이언트 직접 UPDATE 만 거부 — 기존과 동일)
-- ---------------------------------------------------------------------------
create or replace function public.rooms_block_direct_combat_update()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.boss_hp is distinct from old.boss_hp
          or new.boss_max_hp is distinct from old.boss_max_hp
          or new.damage_total is distinct from old.damage_total
          or new.shield is distinct from old.shield) then
    raise exception 'combat values change only through RPC';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) 실행 확인 — 세 값 모두 아래와 같아야 정상입니다.
--    null_damage_total_rows = 0, mismatched_rows = 0, damage_total_default = 0
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.rooms where damage_total is null)
    as null_damage_total_rows,
  (select count(*) from public.rooms
    where boss_hp <> greatest(0, boss_max_hp - damage_total))
    as mismatched_rows,
  (select column_default from information_schema.columns
    where table_name = 'rooms' and column_name = 'damage_total')
    as damage_total_default;

-- ============================================================================
-- ROLLBACK (주석 해제 후 실행 — 방 데이터는 삭제하지 않습니다)
-- ============================================================================
-- drop function if exists public.recalc_room_boss(uuid);
-- alter table public.rooms drop constraint if exists rooms_damage_total_nonneg;
-- alter table public.rooms drop column if exists damage_total;
-- (apply_room_damage / start_room_session / complete_room_if_done /
--  rooms_block_direct_combat_update 는 supabase/schema.sql,
--  20260726_room_lifecycle_security.sql, 20260729_room_multi_member.sql 의
--  정의를 다시 실행하면 되돌아갑니다. 단 rollback 전에 트리거 함수부터
--  되돌려야 damage_total 컬럼 삭제가 안전합니다.)

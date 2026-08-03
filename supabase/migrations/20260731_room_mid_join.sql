-- ============================================================================
-- 20260731_room_mid_join.sql — 친구 방 중간 합류 (running 중 입장)
--
-- join_room 이 waiting 뿐 아니라 running 방에도 입장을 허용합니다.
--   - completed·closed(종료·만료) 방은 계속 거부합니다.
--   - 정원(capacity) 검사는 기존 그대로 유지합니다.
--   - running 방에 새로 들어오면 recalc_room_boss 로 공동 괴물 최대 HP 를
--     인원 기준으로 상향(ratchet)합니다. 누적 피해(damage_total)는 유지됩니다.
--
-- 선행 조건: 20260731_room_hp_recalc.sql 이 먼저 실행되어 있어야 합니다.
--            (recalc_room_boss · damage_total 이 그 파일에서 만들어집니다)
--
-- 안전 보장: 데이터 삭제 없음 · waiting 방 입장 동작 불변 ·
--            RLS·Realtime 변경 없음 · 여러 번 실행해도 안전(멱등).
-- 기존 마이그레이션 파일은 수정하지 않았습니다.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) join_room — waiting·running 허용, 그 외(완료·만료) 거부
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

  -- 진행 중(running) 합류를 허용하되, 완료·만료된 방은 계속 거부합니다.
  if v_room.status not in ('waiting', 'running') then
    raise exception 'room is not open';
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

  -- 진행 중 합류 → 인원 기준으로 최대 HP 상향(ratchet, 내려가지 않음).
  -- 재접속이면 인원이 그대로라 greatest 가 아무것도 바꾸지 않습니다.
  if v_room.status = 'running' then
    perform public.recalc_room_boss(v_room.id);
  end if;

  return v_room.id;
end;
$$;

grant execute on function public.join_room(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) 실행 확인 — recalc_room_boss 가 이미 있어야(선행 마이그레이션) 정상입니다.
--    has_recalc_room_boss = true, join_room_count = 1 이어야 합니다.
-- ---------------------------------------------------------------------------
select
  exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'recalc_room_boss'
  ) as has_recalc_room_boss,
  (select count(*) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'join_room')
    as join_room_count;

-- ============================================================================
-- ROLLBACK (주석 해제 후 실행 — 방 데이터는 삭제하지 않습니다)
-- ============================================================================
-- (join_room 은 20260729_room_multi_member.sql 의 정의를 다시 실행하면
--  waiting 전용으로 되돌아갑니다. 다른 객체는 만들지 않았습니다.)

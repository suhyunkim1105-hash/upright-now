-- 코인 규칙 확정 — 연우안을 바탕으로 민철 판본의 좋은 두 가지를 얹습니다.
--
-- 왜 두 벌이 있었나
-- -----------------
-- 민철 판본은 누적형입니다: 캠퍼스에 있으면 10분마다 1, 앉아 있으면 10분마다 2~3.
-- 연우 판본은 완주형입니다: 끝났을 때 길이 구간으로 한 번.
-- 두 장부가 같은 잔액을 건드리면 어느 쪽 상한도 안 먹습니다. 민철님이 코드
-- 주석에 이미 적어 두셨습니다.
--
-- 무엇을 골랐나 — 완주형
-- ----------------------
-- 누적형은 "켜 두기만 해도 쌓입니다". 멘토가 지적한 어뷰징이 바로 이것이고,
-- 캠퍼스 체류 코인은 걸어다니기만 해도 주므로 특히 그렇습니다.
-- 완주형은 끝까지 한 사람에게 줍니다.
--
-- 다만 완주형도 그냥은 못 막습니다 — 앉혀 두고 자리를 비우면 시간은 흐릅니다.
-- 그래서 **분모를 바꿉니다.**
--
--   기존: p_seated_minutes = 의자에 앉아 있던 시간 (sit -> stand)
--   지금: p_seated_minutes = **자세 판정이 실제로 돌아간 시간**
--         (클라이언트의 LIVE.goodMs + warnMs + badMs)
--
-- 카메라 앞에 사람이 없으면 판정이 안 돌고, 안 돌면 1분도 안 쌓입니다.
-- 자리를 비우면 저절로 멈추므로 따로 감시할 것이 없습니다.
--
-- 이것은 자세를 점수화하는 것이 **아닙니다**. good·warn·bad 를 똑같이 1분으로
-- 셉니다 (AGENTS.md §2.2). 자세가 나빠도 시간은 그대로 쌓입니다 — 목이 긴
-- 사람이 유리해지지 않습니다. 재는 것은 "사람이 있었나" 하나뿐입니다.
--
-- 민철 판본에서 가져온 둘
-- ----------------------
--   첫 회복 +10 — 평생 한 번. 처음 성공한 순간을 크게 칭찬하는 장치입니다.
--   회고 확인 +3 — 세션당 한 번, 하루 세 번까지. 회고는 이 서비스가 사용자에게
--                  보여 주고 싶은 화면인데, 안 열면 아무 일도 안 일어납니다.
--
-- 버린 것
-- -------
--   캠퍼스 체류 코인 — 걸어다니기만 해도 주는 것이라 어뷰징 그 자체입니다.
--   공간별 차등(본관 3 / 도서관 2) — "어디 앉을지" 가 코인 최적화 문제가 됩니다.
--     공간을 다르게 느끼게 하는 일은 소리·NPC·분위기가 맡습니다 (멘토 피드백 ④).

-- ---------------- 1. 컬럼 의미를 문서에 박습니다 ----------------

comment on column public.world_sessions.seated_minutes is
  '자세 판정이 실제로 돌아간 분. 의자에 앉아 있던 시간이 아닙니다 — 카메라 앞에 '
  '사람이 없으면 안 셉니다. 완주 코인은 이 값으로만 계산합니다. '
  'good·warn·bad 를 똑같이 셉니다(자세 점수 아님).';

alter table public.world_sessions
  add column if not exists chair_minutes integer not null default 0
    check (chair_minutes >= 0 and chair_minutes <= 1440);

comment on column public.world_sessions.chair_minutes is
  '의자에 앉아 있던 시간. 회고 화면에만 씁니다 — 코인에는 쓰지 않습니다.';

-- ---------------- 2. 첫 회복 기록 ----------------

alter table public.world_coins
  add column if not exists first_recovery_at timestamptz;

comment on column public.world_coins.first_recovery_at is
  '처음으로 자세를 회복한 시각. 첫 회복 보너스를 평생 한 번만 주기 위한 표시입니다.';

-- ---------------- 3. 세션 종료 — 첫 회복 보너스를 얹습니다 ----------------
-- 인자 목록은 그대로입니다. 클라이언트가 보내는 값의 의미만 바뀌므로
-- 배포된 save.js 가 그대로 돌아갑니다.

create or replace function public.world_finish_session(
  p_id             uuid,
  p_school         text,
  p_seated_minutes integer,   -- 판정이 돌아간 분 (위 주석 참고)
  p_campus_minutes integer,
  p_recoveries     integer,
  p_started_at     timestamptz,
  p_ended_at       timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_today      date := (now() at time zone 'Asia/Seoul')::date;
  v_judged     integer := least(greatest(coalesce(p_seated_minutes, 0), 0), 1440);
  v_campus     integer := least(greatest(coalesce(p_campus_minutes, 0), 0), 1440);
  v_recov      integer := least(greatest(coalesce(p_recoveries, 0), 0), 1440);
  v_completion integer;
  v_first      integer := 0;
  v_granted    integer := 0;
  v_streak     integer := 0;
  v_ms_points  integer := 0;
  i            integer;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;

  insert into world_sessions
    (id, user_key, school, seated_minutes, campus_minutes, recoveries, started_at, ended_at)
  values
    (coalesce(p_id, gen_random_uuid()), v_uid, left(p_school, 80),
     v_judged, v_campus, v_recov, p_started_at, p_ended_at)
  on conflict (id) do nothing;

  if not found then
    -- 오프라인 큐가 같은 세션을 다시 보낸 경우 — 이미 지급했으니 잔액만 돌려줍니다.
    return jsonb_build_object('duplicate', true, 'granted', 0, 'streak', 0,
      'balance', coalesce((select balance from world_coins where user_key = v_uid), 0));
  end if;

  -- 완주 구간 (연우안). 120분을 넘는 세션도 60 그대로입니다 — 상한 구간의 값.
  v_completion := case
    when v_judged >= 50 then 60
    when v_judged >= 30 then 40
    when v_judged >= 15 then 30
    when v_judged >= 5  then 10
    else 0
  end;

  -- 첫 회복 — 평생 한 번. 상한에 걸려 0 이 나와도 표시는 남깁니다.
  -- 안 그러면 상한 찬 날 처음 회복한 사람이 다음 날 또 "첫 회복" 을 받습니다.
  if v_recov > 0 then
    insert into world_coins (user_key) values (v_uid) on conflict (user_key) do nothing;
    update world_coins
       set first_recovery_at = now()
     where user_key = v_uid and first_recovery_at is null;
    if found then v_first := 10; end if;
  end if;

  v_granted := world__grant(v_uid, v_completion + least(v_recov, 5) * 5 + v_first);

  -- 출석 스트릭: 판정이 10분 이상 돈 날이 오늘까지 며칠 연속인가.
  -- ponytail: 최대 60일만 봅니다 — 마일스톤이 60일까지뿐이라 그 뒤는 셀 이유가 없습니다.
  if v_judged >= 10 then
    for i in 0..59 loop
      exit when not exists (
        select 1 from world_sessions
         where user_key = v_uid
           and seated_minutes >= 10
           and (started_at at time zone 'Asia/Seoul')::date = v_today - i
      );
      v_streak := v_streak + 1;
    end loop;

    v_ms_points := case v_streak
      when 3 then 10 when 7 then 25 when 14 then 50 when 30 then 100 when 60 then 180
      else 0
    end;

    if v_ms_points > 0 then
      update world_coins
         set claimed_milestones = claimed_milestones || v_streak
       where user_key = v_uid
         and not (v_streak = any (claimed_milestones));
      if found then
        v_granted := v_granted + world__grant(v_uid, v_ms_points);
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'duplicate',  false,
    'granted',    v_granted,
    'streak',     v_streak,
    'firstRecov', v_first > 0,
    'balance',    coalesce((select balance from world_coins where user_key = v_uid), 0)
  );
end;
$$;

revoke all on function public.world_finish_session(uuid, text, integer, integer, integer, timestamptz, timestamptz) from public, anon;
grant execute on function public.world_finish_session(uuid, text, integer, integer, integer, timestamptz, timestamptz) to authenticated;

-- ---------------- 4. 회고 확인 +3 ----------------
-- 세션당 한 번, 하루 세 번까지. 세션 id 로 막으므로 회고를 몇 번 열어도
-- 한 번만 나갑니다.

alter table public.world_coins
  add column if not exists retro_date date,
  add column if not exists retro_sessions uuid[] not null default '{}';

comment on column public.world_coins.retro_sessions is
  '오늘 회고 보상을 받은 세션 id 들. 같은 세션을 다시 열어도 한 번만 줍니다.';

create or replace function public.world_claim_retro(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_row   world_coins;
  v_give  integer := 0;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;
  -- 남의 세션 id 를 넣어 코인을 타 가지 못하게 합니다.
  if not exists (select 1 from world_sessions where id = p_session_id and user_key = v_uid) then
    raise exception 'unknown session';
  end if;

  insert into world_coins (user_key) values (v_uid) on conflict (user_key) do nothing;
  select * into v_row from world_coins where user_key = v_uid for update;

  if v_row.retro_date is distinct from v_today then
    update world_coins set retro_date = v_today, retro_sessions = '{}' where user_key = v_uid;
    v_row.retro_sessions := '{}';
  end if;

  if p_session_id = any (v_row.retro_sessions) then
    return jsonb_build_object('granted', 0, 'reason', 'already',
      'balance', v_row.balance);
  end if;
  if array_length(v_row.retro_sessions, 1) >= 3 then
    return jsonb_build_object('granted', 0, 'reason', 'dailyLimit',
      'balance', v_row.balance);
  end if;

  update world_coins
     set retro_sessions = retro_sessions || p_session_id
   where user_key = v_uid;

  v_give := world__grant(v_uid, 3);

  return jsonb_build_object('granted', v_give, 'reason', null,
    'balance', coalesce((select balance from world_coins where user_key = v_uid), 0));
end;
$$;

revoke all on function public.world_claim_retro(uuid) from public, anon;
grant execute on function public.world_claim_retro(uuid) to authenticated;

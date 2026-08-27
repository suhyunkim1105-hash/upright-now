-- world_finish_session 이 chair_minutes(의자에 앉아 있던 시간)를 받도록 인자를 하나 늘립니다.
-- 이 저장소의 Supabase 프로젝트에 **이미 적용돼 있습니다.**
--
-- 왜 필요했나
--   20260816_coin_rule_final.sql 이 world_sessions.chair_minutes 컬럼을 만들었지만,
--   그것을 채울 길이 없었습니다. world_finish_session 은 배포된 save.js 가 그대로
--   돌게 하려고 인자 목록을 고정했고, 테이블은
--   `revoke insert, update, delete ... from anon, authenticated` 라 REST 로 직접
--   넣을 수도 없습니다. 결과적으로 이 컬럼은 언제나 0 이었습니다.
--
-- 왜 이렇게 고쳤나
--   p_chair_minutes 를 **마지막 인자**로 두고 기본값을 줬습니다. 그래서 이 값을
--   안 보내는 옛 판본의 save.js 도 그대로 돕니다. 다만 기본값이 붙은 8개짜리와
--   기존 7개짜리가 같이 있으면 7개 호출이 모호해지므로(둘 다 후보가 됨),
--   옛 것을 먼저 지우고 새로 만듭니다. drop 과 create 사이의 짧은 틈에 들어온
--   호출은 실패하는데, save.js 가 오프라인 큐에 넣었다가 다시 보냅니다.
--
-- 코인과의 관계 — 이 파일에서 제일 중요한 줄
--   chair_minutes 는 **코인 계산에 안 들어갑니다.** 코인의 분모는 여전히
--   seated_minutes(자세 판정이 실제로 돌아간 시간)입니다. 이 둘을 섞으면
--   "앉혀 두고 자리 비우면 안 쌓인다" 는 규칙이 그 자리에서 무너집니다.
--   chair_minutes 는 회고 화면이 "자리에 앉은 시간 40분 / 판정이 가능했던 27분"
--   두 줄을 나란히 보여 주기 위한 값일 뿐입니다.
--   근거: docs/economy/COIN_RULE_DECISION.md

drop function if exists public.world_finish_session(uuid, text, integer, integer, integer, timestamptz, timestamptz);

create function public.world_finish_session(
  p_id             uuid,
  p_school         text,
  p_seated_minutes integer,
  p_campus_minutes integer,
  p_recoveries     integer,
  p_started_at     timestamptz,
  p_ended_at       timestamptz,
  p_chair_minutes  integer default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid        uuid := auth.uid();
  v_today      date := (now() at time zone 'Asia/Seoul')::date;
  v_judged     integer := least(greatest(coalesce(p_seated_minutes, 0), 0), 1440);
  v_campus     integer := least(greatest(coalesce(p_campus_minutes, 0), 0), 1440);
  v_recov      integer := least(greatest(coalesce(p_recoveries, 0), 0), 1440);
  -- 안 보내면 판정 시간으로 둡니다. 0 으로 두면 "1시간 앉아 있었는데 0분" 이
  -- 되어 회고 화면이 거짓말을 합니다. 앉은 시간은 판정 시간보다 짧을 수 없으므로
  -- 판정 시간이 최소한의 참값입니다.
  v_chair      integer := least(greatest(coalesce(p_chair_minutes, p_seated_minutes, 0), 0), 1440);
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
    (id, user_key, school, seated_minutes, chair_minutes, campus_minutes, recoveries, started_at, ended_at)
  values
    (coalesce(p_id, gen_random_uuid()), v_uid, left(p_school, 80),
     v_judged, greatest(v_chair, v_judged), v_campus, v_recov, p_started_at, p_ended_at)
  on conflict (id) do nothing;

  if not found then
    return jsonb_build_object('duplicate', true, 'granted', 0, 'streak', 0,
      'balance', coalesce((select balance from world_coins where user_key = v_uid), 0));
  end if;

  v_completion := case
    when v_judged >= 50 then 60
    when v_judged >= 30 then 40
    when v_judged >= 15 then 30
    when v_judged >= 5  then 10
    else 0
  end;

  if v_recov > 0 then
    insert into world_coins (user_key) values (v_uid) on conflict (user_key) do nothing;
    update world_coins
       set first_recovery_at = now()
     where user_key = v_uid and first_recovery_at is null;
    if found then v_first := 10; end if;
  end if;

  v_granted := world__grant(v_uid, v_completion + least(v_recov, 5) * 5 + v_first);

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
$function$;

revoke all on function public.world_finish_session(uuid, text, integer, integer, integer, timestamptz, timestamptz, integer) from public, anon;
grant execute on function public.world_finish_session(uuid, text, integer, integer, integer, timestamptz, timestamptz, integer) to authenticated, service_role;

comment on column public.world_sessions.chair_minutes is
  '의자에 앉아 있던 시간(분). 회고 화면 표시용입니다. 코인의 분모는 이것이 아니라 seated_minutes(자세 판정이 실제로 돌아간 시간)입니다 — 섞으면 앉혀 두고 자리 비우는 것을 막던 규칙이 무너집니다.';

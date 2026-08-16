-- 길이별 세션 완주 보상을 서버에서 계산합니다.
-- 선행 migration: 20260804_growth_reward_foundation.sql,
-- 20260804_growth_balance_rules.sql

create or replace function public.apply_progression_reward(
  p_event_id text,
  p_event_type text,
  p_source_session_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_planned_minutes integer default null
) returns table (
  applied boolean,
  xp_delta integer,
  points_delta integer,
  total_xp bigint,
  total_points bigint,
  reason text
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_user_id uuid := auth.uid();
  v_rule public.progression_reward_rules%rowtype;
  v_event public.progression_reward_events%rowtype;
  v_balance public.progression_balances%rowtype;
  v_session_count integer;
  v_daily_xp integer;
  v_xp_delta integer;
  v_points_delta integer;
begin
  if v_user_id is null then
    return query select false, 0, 0, 0::bigint, 0::bigint, 'authentication_required'::text;
    return;
  end if;

  select * into v_rule from public.progression_reward_rules
   where event_type = p_event_type and enabled;
  if not found then
    return query select false, 0, 0, 0::bigint, 0::bigint, 'unknown_or_disabled_event'::text;
    return;
  end if;

  v_xp_delta := v_rule.xp_delta;
  v_points_delta := v_rule.points_delta;
  if p_event_type = 'session_completed' and p_planned_minutes is not null then
    if p_planned_minutes < 5 then
      v_xp_delta := 0;
      v_points_delta := 0;
    elsif p_planned_minutes < 15 then
      v_xp_delta := 20;
      v_points_delta := 10;
    elsif p_planned_minutes < 30 then
      v_xp_delta := 60;
      v_points_delta := 30;
    elsif p_planned_minutes < 50 then
      v_xp_delta := 80;
      v_points_delta := 40;
    else
      v_xp_delta := 120;
      v_points_delta := 60;
    end if;
  end if;

  insert into public.progression_balances (user_id) values (v_user_id)
    on conflict (user_id) do nothing;
  select * into v_balance from public.progression_balances
    where user_id = v_user_id for update;

  select * into v_event from public.progression_reward_events
    where user_id = v_user_id and event_id = p_event_id;
  if found then
    return query select false, v_event.xp_delta, v_event.points_delta,
      v_balance.xp, v_balance.points, 'duplicate'::text;
    return;
  end if;

  if v_rule.session_cap is not null then
    if nullif(trim(p_source_session_id), '') is null then
      return query select false, 0, 0, v_balance.xp, v_balance.points, 'session_required'::text;
      return;
    end if;
    select count(*)::integer into v_session_count
      from public.progression_reward_events
     where user_id = v_user_id
       and event_type = p_event_type
       and source_session_id = p_source_session_id;
    if v_session_count >= v_rule.session_cap then
      return query select false, 0, 0, v_balance.xp, v_balance.points, 'session_cap'::text;
      return;
    end if;
  end if;

  if v_rule.daily_xp_cap is not null then
    select coalesce(sum(xp_delta), 0)::integer into v_daily_xp
      from public.progression_reward_events
     where user_id = v_user_id
       and event_type = p_event_type
       and created_at >= date_trunc('day', now());
    if v_daily_xp + v_xp_delta > v_rule.daily_xp_cap then
      return query select false, 0, 0, v_balance.xp, v_balance.points, 'daily_cap'::text;
      return;
    end if;
  end if;

  insert into public.progression_reward_events
    (user_id, event_id, event_type, source_session_id, xp_delta, points_delta, metadata)
  values (v_user_id, p_event_id, p_event_type, p_source_session_id,
    v_xp_delta, v_points_delta,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('planned_minutes', p_planned_minutes));

  update public.progression_balances
     set xp = xp + v_xp_delta,
         points = points + v_points_delta,
         updated_at = now()
   where user_id = v_user_id returning * into v_balance;

  return query select true, v_xp_delta, v_points_delta,
    v_balance.xp, v_balance.points, 'applied'::text;
end;
$fn$;

revoke all on function public.apply_progression_reward(text, text, text, jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.apply_progression_reward(text, text, text, jsonb, integer)
  to authenticated;

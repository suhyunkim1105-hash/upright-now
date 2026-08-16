-- 성장 밸런스 설정과 서버측 상한
-- 선행 migration: 20260804_growth_reward_foundation.sql

create table if not exists public.progression_level_rules (
  level smallint primary key check (level between 1 and 99),
  required_xp bigint not null check (required_xp >= 0),
  character_key text not null,
  display_name text not null,
  created_at timestamptz not null default now()
);

insert into public.progression_level_rules (level, required_xp, character_key, display_name)
values
  (1, 0, 'turtle', '뽀각 거북'),
  (2, 250, 'turtle', '꿈틀 거북'),
  (3, 600, 'turtle-giraffe', '빼꼼 거부기린'),
  (4, 1000, 'turtle-giraffe', '반듯 거부기린'),
  (5, 1500, 'giraffe', '쭉쭉 기린'),
  (6, 2200, 'giraffe', '우뚝 기린')
on conflict (level) do update set
  required_xp = excluded.required_xp,
  character_key = excluded.character_key,
  display_name = excluded.display_name;

alter table public.progression_reward_rules
  add column if not exists session_cap integer,
  add column if not exists daily_xp_cap integer;

update public.progression_reward_rules
   set session_cap = case event_type
     when 'recovery_success' then 2
     when 'session_completed' then 1
     when 'stretch_completed' then 1
     when 'goal_completed' then 1
     when 'friend_session_bonus' then 1
     when 'streak_bonus' then 1
     else session_cap
   end,
       daily_xp_cap = case event_type
         when 'recovery_success' then 100
         else daily_xp_cap
       end;

alter table public.progression_level_rules enable row level security;
revoke all on public.progression_level_rules from anon, authenticated;
grant select on public.progression_level_rules to authenticated;
drop policy if exists progression_level_rules_select on public.progression_level_rules;
create policy progression_level_rules_select
  on public.progression_level_rules for select to authenticated using (true);

create or replace function public.apply_progression_reward(
  p_event_id text,
  p_event_type text,
  p_source_session_id text default null,
  p_metadata jsonb default '{}'::jsonb
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
    if v_daily_xp + v_rule.xp_delta > v_rule.daily_xp_cap then
      return query select false, 0, 0, v_balance.xp, v_balance.points, 'daily_cap'::text;
      return;
    end if;
  end if;

  insert into public.progression_reward_events
    (user_id, event_id, event_type, source_session_id, xp_delta, points_delta, metadata)
  values (v_user_id, p_event_id, p_event_type, p_source_session_id,
    v_rule.xp_delta, v_rule.points_delta, coalesce(p_metadata, '{}'::jsonb));

  update public.progression_balances
     set xp = xp + v_rule.xp_delta,
         points = points + v_rule.points_delta,
         updated_at = now()
   where user_id = v_user_id returning * into v_balance;

  return query select true, v_rule.xp_delta, v_rule.points_delta,
    v_balance.xp, v_balance.points, 'applied'::text;
end;
$fn$;

revoke all on function public.apply_progression_reward(text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_progression_reward(text, text, text, jsonb)
  to authenticated;

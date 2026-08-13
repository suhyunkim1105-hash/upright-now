-- 캠퍼스 영토전: 서울 25개 자치구 기반 영토 구조
--
-- 기존 campus_territories(96칸)는 삭제하지 않습니다.
-- 이 마이그레이션은 새 자치구 영토 테이블과 검증된 기여 RPC를 추가합니다.
-- 실행 순서: 기존 campus/학교 인증 마이그레이션 실행 후 1회 실행

create table if not exists public.campus_district_territories (
  id text primary key,
  season_id text not null references public.campus_seasons(id) on delete cascade,
  district_id text not null,
  district_name text not null,
  owner_school_id text references public.campus_schools(id),
  challenger_school_id text references public.campus_schools(id),
  defense_score integer not null default 0 check (defense_score >= 0),
  challenge_score integer not null default 0 check (challenge_score >= 0),
  updated_at timestamptz not null default now(),
  unique (season_id, district_id)
);

create index if not exists campus_district_territories_season_idx
  on public.campus_district_territories (season_id, district_id);

create table if not exists public.campus_district_contributions (
  event_id text primary key,
  season_id text not null references public.campus_seasons(id) on delete cascade,
  district_id text not null,
  school_id text not null references public.campus_schools(id),
  member_hash text not null,
  session_id text not null,
  kind text not null check (kind in (
    'session_completed', 'friend_session_completed',
    'posture_recovered', 'stretch_completed'
  )),
  points integer not null check (points between 1 and 200),
  created_at timestamptz not null default now()
);

create index if not exists campus_district_contributions_member_idx
  on public.campus_district_contributions (member_hash, created_at desc);
create index if not exists campus_district_contributions_district_idx
  on public.campus_district_contributions (season_id, district_id, created_at desc);
create unique index if not exists campus_district_contributions_session_once
  on public.campus_district_contributions (season_id, member_hash, kind, session_id)
  where kind in ('session_completed', 'friend_session_completed', 'stretch_completed');

create table if not exists public.campus_district_territory_events (
  id uuid primary key default gen_random_uuid(),
  season_id text not null references public.campus_seasons(id) on delete cascade,
  district_id text not null,
  kind text not null check (kind in ('contested', 'captured', 'defended')),
  from_school_id text references public.campus_schools(id),
  to_school_id text references public.campus_schools(id),
  created_at timestamptz not null default now()
);

create index if not exists campus_district_events_season_idx
  on public.campus_district_territory_events (season_id, created_at desc);

alter table public.campus_district_territories enable row level security;
alter table public.campus_district_territory_events enable row level security;
alter table public.campus_district_contributions enable row level security;

drop policy if exists campus_district_territories_select on public.campus_district_territories;
create policy campus_district_territories_select
  on public.campus_district_territories for select to authenticated using (true);

drop policy if exists campus_district_events_select on public.campus_district_territory_events;
create policy campus_district_events_select
  on public.campus_district_territory_events for select to authenticated using (true);

revoke all on public.campus_district_contributions from anon, authenticated;
revoke all on public.campus_district_territories from anon;
revoke all on public.campus_district_territory_events from anon;
grant select on public.campus_district_territories to authenticated;
grant select on public.campus_district_territory_events to authenticated;

-- 현재 분기에 서울 25개 자치구를 준비합니다. 기존 시즌/분기 함수는 변경하지 않습니다.
create or replace function public.ensure_active_campus_district_territories()
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_season text := public.ensure_active_campus_season();
begin
  insert into public.campus_district_territories
    (id, season_id, district_id, district_name)
  values
    (v_season || ':eunpyeong', v_season, 'eunpyeong', '은평구'),
    (v_season || ':seodaemun', v_season, 'seodaemun', '서대문구'),
    (v_season || ':mapo', v_season, 'mapo', '마포구'),
    (v_season || ':jongno', v_season, 'jongno', '종로구'),
    (v_season || ':jung', v_season, 'jung', '중구'),
    (v_season || ':yongsan', v_season, 'yongsan', '용산구'),
    (v_season || ':seongbuk', v_season, 'seongbuk', '성북구'),
    (v_season || ':dongdaemun', v_season, 'dongdaemun', '동대문구'),
    (v_season || ':gwangjin', v_season, 'gwangjin', '광진구'),
    (v_season || ':jungnang', v_season, 'jungnang', '중랑구'),
    (v_season || ':seongdong', v_season, 'seongdong', '성동구'),
    (v_season || ':gangbuk', v_season, 'gangbuk', '강북구'),
    (v_season || ':dobong', v_season, 'dobong', '도봉구'),
    (v_season || ':nowon', v_season, 'nowon', '노원구'),
    (v_season || ':gangseo', v_season, 'gangseo', '강서구'),
    (v_season || ':yangcheon', v_season, 'yangcheon', '양천구'),
    (v_season || ':guro', v_season, 'guro', '구로구'),
    (v_season || ':geumcheon', v_season, 'geumcheon', '금천구'),
    (v_season || ':yeongdeungpo', v_season, 'yeongdeungpo', '영등포구'),
    (v_season || ':dongjak', v_season, 'dongjak', '동작구'),
    (v_season || ':gwanak', v_season, 'gwanak', '관악구'),
    (v_season || ':seocho', v_season, 'seocho', '서초구'),
    (v_season || ':gangnam', v_season, 'gangnam', '강남구'),
    (v_season || ':songpa', v_season, 'songpa', '송파구'),
    (v_season || ':gangdong', v_season, 'gangdong', '강동구')
  on conflict (id) do nothing;

  return v_season;
end;
$fn$;

grant execute on function public.ensure_active_campus_district_territories() to authenticated;

-- 서버 권위 점령 판정. 학교 인증과 membership을 모두 통과한 사용자만 기여할 수 있습니다.
create or replace function public.record_campus_district_contribution(
  p_event_id text,
  p_district_id text,
  p_session_id text,
  p_kind text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_season text := public.ensure_active_campus_district_territories();
  v_school text;
  v_member_hash text;
  v_points integer;
  v_today_points integer;
  v_recovery_count integer;
  v_last_recovery timestamptz;
  v_my_total bigint;
  v_constraint text;
  v_previous_owner text;
  v_row public.campus_district_territories%rowtype;
  v_result text := 'accepted';
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  v_points := case p_kind
    when 'session_completed' then 100
    when 'friend_session_completed' then 50
    when 'posture_recovered' then 20
    when 'stretch_completed' then 20
    else null
  end;
  if v_points is null then
    return jsonb_build_object('result', 'invalid_kind', 'eventId', p_event_id, 'serverTime', now());
  end if;
  if p_session_id is null or p_session_id = '' then
    return jsonb_build_object('result', 'session_required', 'eventId', p_event_id, 'serverTime', now());
  end if;

  select school_id into v_school
    from public.campus_memberships
   where user_id = auth.uid();
  if v_school is null then
    return jsonb_build_object('result', 'no_membership', 'eventId', p_event_id, 'serverTime', now());
  end if;

  -- campus_school_verification 마이그레이션이 제공하는 서버 검증을 재사용합니다.
  perform public.campus_require_verified_school(v_school);

  v_member_hash := md5(auth.uid()::text || ':' || v_season);
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text || ':' || v_season));

  select coalesce(sum(points), 0) into v_my_total
    from public.campus_district_contributions
   where season_id = v_season and member_hash = v_member_hash;
  select coalesce(sum(points), 0) into v_today_points
    from public.campus_district_contributions
   where member_hash = v_member_hash
     and (created_at at time zone 'Asia/Seoul')::date
       = (now() at time zone 'Asia/Seoul')::date;
  if v_today_points + v_points > 600 then
    return jsonb_build_object('result', 'daily_cap', 'eventId', p_event_id,
      'authoritativeMyContribution', v_my_total, 'serverTime', now());
  end if;

  if p_kind = 'posture_recovered' then
    select count(*), max(created_at)
      into v_recovery_count, v_last_recovery
      from public.campus_district_contributions
     where member_hash = v_member_hash and kind = p_kind and session_id = p_session_id;
    if v_recovery_count >= 5 then
      return jsonb_build_object('result', 'recovery_cap', 'eventId', p_event_id,
        'authoritativeMyContribution', v_my_total, 'serverTime', now());
    end if;
    if v_last_recovery is not null and v_last_recovery > now() - interval '20 seconds' then
      return jsonb_build_object('result', 'recovery_cooldown', 'eventId', p_event_id,
        'authoritativeMyContribution', v_my_total, 'serverTime', now());
    end if;
  end if;

  if not exists (
    select 1 from public.campus_district_territories
     where season_id = v_season and district_id = p_district_id
  ) then
    return jsonb_build_object('result', 'district_not_found', 'eventId', p_event_id,
      'districtId', p_district_id, 'serverTime', now());
  end if;

  begin
    insert into public.campus_district_contributions
      (event_id, season_id, district_id, school_id, member_hash, session_id, kind, points)
    values
      (p_event_id, v_season, p_district_id, v_school, v_member_hash, p_session_id, p_kind, v_points);
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    return jsonb_build_object(
      'result', case when v_constraint = 'campus_district_contributions_session_once'
                     then 'duplicate_session' else 'duplicate_event' end,
      'eventId', p_event_id, 'authoritativeMyContribution', v_my_total, 'serverTime', now());
  end;
  v_my_total := v_my_total + v_points;

  select * into v_row
    from public.campus_district_territories
   where season_id = v_season and district_id = p_district_id
   for update;
  if not found then
    return jsonb_build_object('result', 'district_not_found', 'eventId', p_event_id,
      'districtId', p_district_id, 'acceptedPoints', v_points,
      'authoritativeMyContribution', v_my_total, 'serverTime', now());
  end if;

  if v_row.owner_school_id is null then
    update public.campus_district_territories
       set owner_school_id = v_school, defense_score = v_points,
           challenger_school_id = null, challenge_score = 0, updated_at = now()
     where id = v_row.id;
    insert into public.campus_district_territory_events
      (season_id, district_id, kind, from_school_id, to_school_id)
    values (v_season, p_district_id, 'captured', null, v_school);
    v_result := 'captured';
  elsif v_row.owner_school_id = v_school then
    update public.campus_district_territories
       set defense_score = defense_score + v_points, updated_at = now()
     where id = v_row.id;
    insert into public.campus_district_territory_events
      (season_id, district_id, kind, from_school_id, to_school_id)
    values (v_season, p_district_id, 'defended', v_school, v_school);
    v_result := 'defended';
  else
    v_previous_owner := v_row.owner_school_id;
    if v_row.challenger_school_id is distinct from v_school then
      update public.campus_district_territories
         set challenger_school_id = v_school, challenge_score = v_points, updated_at = now()
       where id = v_row.id;
      insert into public.campus_district_territory_events
        (season_id, district_id, kind, from_school_id, to_school_id)
      values (v_season, p_district_id, 'contested', v_row.owner_school_id, v_school);
      v_result := 'contested';
    else
      update public.campus_district_territories
         set challenge_score = challenge_score + v_points, updated_at = now()
       where id = v_row.id
       returning * into v_row;
      if v_row.challenge_score > v_row.defense_score then
        update public.campus_district_territories
           set owner_school_id = v_school, defense_score = v_row.challenge_score,
               challenger_school_id = null, challenge_score = 0, updated_at = now()
         where id = v_row.id;
        insert into public.campus_district_territory_events
          (season_id, district_id, kind, from_school_id, to_school_id)
        values (v_season, p_district_id, 'captured', v_previous_owner, v_school);
        v_result := 'captured';
      else
        insert into public.campus_district_territory_events
          (season_id, district_id, kind, from_school_id, to_school_id)
        values (v_season, p_district_id, 'contested', v_previous_owner, v_school);
        v_result := 'contested';
      end if;
    end if;
  end if;

  select * into v_row from public.campus_district_territories where id = v_row.id;
  return jsonb_build_object(
    'result', v_result, 'acceptedPoints', v_points, 'points', v_points,
    'eventId', p_event_id, 'districtId', p_district_id,
    'authoritativeMyContribution', v_my_total,
    'updatedDistrict', to_jsonb(v_row), 'serverTime', now());
end;
$fn$;

grant execute on function public.record_campus_district_contribution(text, text, text, text)
  to authenticated;

-- 실시간 구독 대상 추가 (이미 등록되어 있으면 건너뜁니다).
do $do$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'campus_district_territories'
  ) then
    alter publication supabase_realtime add table public.campus_district_territories;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'campus_district_territory_events'
  ) then
    alter publication supabase_realtime add table public.campus_district_territory_events;
  end if;
end;
$do$;

select public.ensure_active_campus_district_territories();

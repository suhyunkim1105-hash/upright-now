-- =====================================================================
-- Deskfit — 캠퍼스 테마 · 캠퍼스 영토전 프로토타입 migration
-- =====================================================================
--
-- ⚠️ 이 파일을 Production Supabase 에 직접 실행하지 마세요.
--    이 프로토타입은 로컬 mock 저장소로 검증했습니다.
--    적용은 별도의 개발/스테이징 프로젝트에서만 하고,
--    적용 후 `VITE_ENABLE_CAMPUS_SUPABASE=true` 를 그 환경에만 넣으세요.
--
-- 설계 원칙
--  1. 카메라 영상·프레임·랜드마크·자세 좌표를 저장하는 컬럼이 없습니다.
--  2. `bad` 자세 상태·나쁜 자세 시간·건강 정보를 저장하는 컬럼이 없습니다.
--  3. 자세 점수는 기여도 계산에 쓰지 않습니다. "성공했다는 사실"만 저장합니다.
--  4. 회원가입을 요구하지 않습니다. signInAnonymously() 사용자로 동작합니다.
--  5. 사용자는 자기 학교의 기여만 만들 수 있고, 타일·기여 행을 직접 수정할 수 없습니다.
--     (테이블에 INSERT/UPDATE 정책을 두지 않고 security definer RPC 만 허용)
--  6. 학교 색은 프로토타입 컬러 프리셋입니다. 공식 색상이 아닙니다.
--  7. 이 데이터는 공식 대항전·공식 순위가 아닙니다.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. 학교
-- ---------------------------------------------------------------------
create table if not exists public.campus_schools (
  id text primary key check (id ~ '^[a-z0-9_-]{2,24}$'),
  name text not null check (char_length(name) between 1 and 40),
  short_name text not null check (char_length(short_name) between 1 and 12),
  -- 프로토타입 컬러 프리셋. 공식 색상이 아닙니다.
  primary_color text not null check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  color_source text not null default 'prototype-preset'
    check (color_source in ('prototype-preset', 'user-defined')),
  pattern text not null default 'grid'
    check (pattern in ('grid', 'arch', 'stripe', 'dots', 'weave')),
  is_custom boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.campus_schools is
  '학교 이름과 프로토타입 컬러 프리셋. 공식 로고·마스코트·공식 색상은 저장하지 않습니다.';

insert into public.campus_schools (id, name, short_name, primary_color, pattern, is_custom)
values
  ('snu',     '서울대학교',         '서울대',   '#2B4C7E', 'arch',   false),
  ('yonsei',  '연세대학교',         '연세대',   '#1D4E89', 'grid',   false),
  ('korea',   '고려대학교',         '고려대',   '#8E2438', 'stripe', false),
  ('sogang',  '서강대학교',         '서강대',   '#A24936', 'weave',  false),
  ('skku',    '성균관대학교',       '성균관대', '#1E6B5E', 'arch',   false),
  ('hanyang', '한양대학교',         '한양대',   '#2F4F82', 'grid',   false),
  ('cau',     '중앙대학교',         '중앙대',   '#39609E', 'stripe', false),
  ('khu',     '경희대학교',         '경희대',   '#22603C', 'weave',  false),
  ('hufs',    '한국외국어대학교',   '외대',     '#2C6E7F', 'dots',   false),
  ('uos',     '서울시립대학교',     '시립대',   '#4A5CA8', 'dots',   false),
  ('custom',  '기타 / 직접 설정',   '직접 설정','#5F8FF7', 'grid',   true)
on conflict (id) do nothing;

update public.campus_schools set color_source = 'user-defined' where id = 'custom';

-- ---------------------------------------------------------------------
-- 2. 시즌
-- ---------------------------------------------------------------------
create table if not exists public.campus_seasons (
  id text primary key check (id ~ '^[a-z0-9_-]{3,32}$'),
  name text not null check (char_length(name) between 1 and 40),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- 활성 시즌은 항상 최대 1개
create unique index if not exists campus_seasons_one_active
  on public.campus_seasons ((status))
  where status = 'active';

-- ---------------------------------------------------------------------
-- 3. 학교 소속 (익명 사용자 1인 1행)
-- ---------------------------------------------------------------------
create table if not exists public.campus_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school_id text not null references public.campus_schools(id),
  /** 기타 / 직접 설정에서 사용자가 고른 색 */
  custom_color text check (custom_color is null or custom_color ~ '^#[0-9A-Fa-f]{6}$'),
  /** 마지막 변경이 일어난 시즌 */
  last_changed_season_id text references public.campus_seasons(id),
  changes_in_season integer not null default 0 check (changes_in_season >= 0),
  last_changed_at timestamptz,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.campus_memberships is
  '사용자가 직접 선택한 비공식 캠퍼스 테마. 대학 인증 정보가 아닙니다.';

-- ---------------------------------------------------------------------
-- 4. 타일
-- ---------------------------------------------------------------------
create table if not exists public.campus_tiles (
  id text primary key,
  season_id text not null references public.campus_seasons(id) on delete cascade,
  x smallint not null check (x between 0 and 11),
  y smallint not null check (y between 0 and 7),
  zone text not null check (zone in ('library', 'plaza', 'lecture', 'lawn', 'cafe')),
  owner_school_id text references public.campus_schools(id),
  challenger_school_id text references public.campus_schools(id),
  defense_score integer not null default 120 check (defense_score >= 0),
  challenge_score integer not null default 0 check (challenge_score >= 0),
  updated_at timestamptz not null default now(),
  unique (season_id, x, y),
  check (
    challenger_school_id is null
    or owner_school_id is null
    or challenger_school_id <> owner_school_id
  )
);

create index if not exists campus_tiles_season_idx on public.campus_tiles (season_id);

comment on table public.campus_tiles is
  '자체 제작한 12x8 가상 캠퍼스 타일. 실제 지도 좌표나 학교 부지 정보가 아닙니다.';

-- ---------------------------------------------------------------------
-- 5. 기여도 (event_id 멱등성)
-- ---------------------------------------------------------------------
create table if not exists public.campus_contributions (
  -- 클라이언트가 만드는 결정적 id. 같은 성공은 항상 같은 값 → 중복 차단.
  event_id text primary key check (char_length(event_id) between 8 and 128),
  season_id text not null references public.campus_seasons(id) on delete cascade,
  school_id text not null references public.campus_schools(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (
    kind in (
      'session_completed',
      'posture_recovered',
      'friend_session_completed',
      'stretch_completed'
    )
  ),
  session_id text check (session_id is null or char_length(session_id) <= 128),
  tile_id text not null references public.campus_tiles(id) on delete cascade,
  points integer not null check (points between 0 and 100),
  created_at timestamptz not null default now()
);

comment on table public.campus_contributions is
  '기여 이벤트. 자세 점수·좌표·bad 상태·카메라 데이터를 저장하는 컬럼이 없습니다.';

-- session_id 중복 차단 — 세션당 1회만 인정하는 종류
create unique index if not exists campus_contributions_session_once
  on public.campus_contributions (season_id, user_id, kind, session_id)
  where session_id is not null
    and kind in ('session_completed', 'friend_session_completed');

create index if not exists campus_contributions_season_school_idx
  on public.campus_contributions (season_id, school_id);

create index if not exists campus_contributions_user_time_idx
  on public.campus_contributions (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 6. 타일 이벤트 (최근 영토 변화)
-- ---------------------------------------------------------------------
create table if not exists public.campus_tile_events (
  id uuid primary key default gen_random_uuid(),
  season_id text not null references public.campus_seasons(id) on delete cascade,
  tile_id text not null references public.campus_tiles(id) on delete cascade,
  kind text not null check (kind in ('captured', 'contested', 'reinforced')),
  from_school_id text references public.campus_schools(id),
  to_school_id text references public.campus_schools(id),
  created_at timestamptz not null default now()
);

create index if not exists campus_tile_events_season_time_idx
  on public.campus_tile_events (season_id, created_at desc);

-- ---------------------------------------------------------------------
-- 7. 상수와 보조 함수
-- ---------------------------------------------------------------------
create or replace function public.campus_points_for(p_kind text)
returns integer
language sql
immutable
as $$
  select case p_kind
    when 'session_completed' then 100
    when 'posture_recovered' then 20
    when 'friend_session_completed' then 50
    when 'stretch_completed' then 20
    else 0
  end;
$$;

create or replace function public.campus_zone_base_defense(p_zone text)
returns integer
language sql
immutable
as $$
  select case p_zone
    when 'library' then 240
    when 'lecture' then 180
    when 'plaza' then 200
    when 'cafe' then 140
    else 120
  end;
$$;

create or replace function public.campus_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists campus_memberships_set_updated_at on public.campus_memberships;
create trigger campus_memberships_set_updated_at
before update on public.campus_memberships
for each row execute function public.campus_set_updated_at();

create or replace function public.campus_active_season_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id from public.campus_seasons where status = 'active' order by starts_at desc limit 1;
$$;

-- ---------------------------------------------------------------------
-- 8. 시즌 지도 생성 / 보관 (관리 전용 — authenticated 에는 grant 하지 않습니다)
-- ---------------------------------------------------------------------
create or replace function public.campus_seed_season(
  p_season_id text,
  p_name text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_x smallint;
  v_y smallint;
  v_zone text;
begin
  insert into public.campus_seasons (id, name, starts_at, ends_at, status)
  values (p_season_id, p_name, p_starts_at, p_ends_at, 'active')
  on conflict (id) do nothing;

  for v_y in 0..7 loop
    for v_x in 0..11 loop
      v_zone := case
        when v_y <= 1 then 'lecture'
        when v_y <= 4 and v_x <= 4 then 'library'
        when v_y <= 4 and v_x <= 8 then 'plaza'
        when v_y <= 4 then 'cafe'
        else 'lawn'
      end;

      insert into public.campus_tiles (
        id, season_id, x, y, zone, defense_score
      ) values (
        p_season_id || ':' || v_x || '-' || v_y,
        p_season_id, v_x, v_y, v_zone,
        public.campus_zone_base_defense(v_zone)
      )
      on conflict (id) do nothing;
    end loop;
  end loop;

  return p_season_id;
end;
$$;

/** 시즌 종료 → 최종 지도를 그대로 남겨 두고 status 만 archived 로 바꿉니다. */
create or replace function public.campus_archive_season(p_season_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.campus_seasons set status = 'archived' where id = p_season_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. 학교 선택 · 변경 (시즌 중 1회 · 7일에 1회)
-- ---------------------------------------------------------------------
create or replace function public.campus_set_school(
  p_school_id text,
  p_custom_color text default null
)
returns table (accepted boolean, reason text, next_allowed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.campus_memberships%rowtype;
  v_season public.campus_seasons%rowtype;
  v_changes integer;
  v_cooldown_ends timestamptz;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not exists (select 1 from public.campus_schools where id = p_school_id) then
    raise exception 'unknown school';
  end if;

  if p_custom_color is not null and p_custom_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'invalid color';
  end if;

  select * into v_season
  from public.campus_seasons where status = 'active'
  order by starts_at desc limit 1;

  if not found then
    raise exception 'no active season';
  end if;

  select * into v_member
  from public.campus_memberships
  where user_id = auth.uid()
  for update;

  -- 첫 선택 — 제한 없음
  if not found then
    insert into public.campus_memberships (user_id, school_id, custom_color)
    values (auth.uid(), p_school_id, p_custom_color);
    return query select true, null::text, null::timestamptz;
    return;
  end if;

  -- 같은 학교면 색만 바꿉니다. (학교 변경 제한과 무관)
  if v_member.school_id = p_school_id then
    update public.campus_memberships
    set custom_color = coalesce(p_custom_color, custom_color)
    where user_id = auth.uid();
    return query select true, 'same_school'::text, null::timestamptz;
    return;
  end if;

  v_changes := case
    when v_member.last_changed_season_id = v_season.id then v_member.changes_in_season
    else 0
  end;
  v_cooldown_ends := coalesce(v_member.last_changed_at, to_timestamp(0)) + interval '7 days';

  if v_changes >= 1 then
    return query select false, 'season_limit'::text, greatest(v_season.ends_at, v_cooldown_ends);
    return;
  end if;

  if now() < v_cooldown_ends then
    return query select false, 'cooldown'::text, v_cooldown_ends;
    return;
  end if;

  -- 학교를 바꿔도 campus_contributions 의 school_id 는 그대로 남습니다.
  -- 이전 학교에 쌓인 기여도는 절대 옮겨지지 않습니다.
  update public.campus_memberships
  set school_id = p_school_id,
      custom_color = case when p_school_id = 'custom' then p_custom_color else null end,
      last_changed_at = now(),
      last_changed_season_id = v_season.id,
      changes_in_season = v_changes + 1
  where user_id = auth.uid();

  return query select true, null::text, null::timestamptz;
end;
$$;

-- ---------------------------------------------------------------------
-- 10. 원자적 타일 점령 RPC
-- ---------------------------------------------------------------------
/**
 * 타일 한 칸에 점수를 적용합니다. 행 단위 잠금으로 두 클라이언트가 동시에
 * 호출해도 점수가 유실되지 않습니다.
 *
 * - owner == 내 학교        → 방어 점수 증가
 * - challenger 없음/내 학교 → 공격 점수 증가
 * - 다른 학교가 공격 중     → 그 공격 점수를 깎고, 0 이하가 되면 공격자 교체
 * - 공격 점수 > 방어 점수   → 점령. 넘친 점수는 새 owner 의 방어 점수로 이어집니다.
 */
create or replace function public.campus_capture_tile(
  p_tile_id text,
  p_school_id text,
  p_points integer
)
returns table (captured boolean, contested boolean, owner_school_id text, progress numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tile public.campus_tiles%rowtype;
  v_owner text;
  v_challenger text;
  v_defense integer;
  v_challenge integer;
  v_captured boolean := false;
  v_from text;
  v_remaining integer;
begin
  if p_points < 0 or p_points > 100 then
    raise exception 'invalid points';
  end if;

  select * into v_tile from public.campus_tiles where id = p_tile_id for update;
  if not found then
    raise exception 'tile not found';
  end if;

  v_owner := v_tile.owner_school_id;
  v_challenger := v_tile.challenger_school_id;
  v_defense := v_tile.defense_score;
  v_challenge := v_tile.challenge_score;

  if v_owner = p_school_id then
    v_defense := v_defense + p_points;
    insert into public.campus_tile_events (season_id, tile_id, kind, from_school_id, to_school_id)
    values (v_tile.season_id, v_tile.id, 'reinforced', p_school_id, p_school_id);
  elsif v_challenger is null or v_challenger = p_school_id then
    v_challenger := p_school_id;
    v_challenge := v_challenge + p_points;
  else
    v_remaining := v_challenge - p_points;
    if v_remaining > 0 then
      v_challenge := v_remaining;
    else
      v_challenger := p_school_id;
      v_challenge := -v_remaining;
    end if;
  end if;

  if v_challenger is not null and v_challenge > v_defense then
    v_from := v_owner;
    v_defense := greatest(1, v_challenge - v_defense);
    v_owner := v_challenger;
    v_challenger := null;
    v_challenge := 0;
    v_captured := true;

    insert into public.campus_tile_events (season_id, tile_id, kind, from_school_id, to_school_id)
    values (v_tile.season_id, v_tile.id, 'captured', v_from, v_owner);
  end if;

  update public.campus_tiles
  set owner_school_id = v_owner,
      challenger_school_id = v_challenger,
      defense_score = v_defense,
      challenge_score = v_challenge,
      updated_at = now()
  where id = p_tile_id;

  -- 점령 직전 80% 이상이면 경합 상태
  if not v_captured
     and v_challenger is not null
     and v_challenge::numeric / greatest(v_defense, 1) >= 0.8
     and (v_tile.challenger_school_id is distinct from v_challenger
          or v_tile.challenge_score::numeric / greatest(v_tile.defense_score, 1) < 0.8)
  then
    insert into public.campus_tile_events (season_id, tile_id, kind, from_school_id, to_school_id)
    values (v_tile.season_id, v_tile.id, 'contested', v_owner, v_challenger);
  end if;

  return query
    select
      v_captured,
      (v_challenger is not null and v_challenge::numeric / greatest(v_defense, 1) >= 0.8),
      v_owner,
      least(1.0, v_challenge::numeric / greatest(v_defense, 1));
end;
$$;

-- ---------------------------------------------------------------------
-- 11. 원자적 기여 RPC (악용 방지 포함)
-- ---------------------------------------------------------------------
/**
 * 악용 방지
 *  - event_id primary key      → 이벤트 중복 차단
 *  - (season, user, kind, session_id) unique → 세션 중복 차단
 *  - 하루 최대 600점
 *  - 회복 기여는 세션당 5회, 20초 간격
 *  - 1분에 12건 이상이면 거절
 *  - p_school_id 는 내 membership 과 같아야 합니다 → 다른 학교 데이터 조작 불가
 *  - points 는 서버가 kind 로부터 계산합니다 → 클라이언트 값을 믿지 않습니다
 */
create or replace function public.campus_record_contribution(
  p_event_id text,
  p_season_id text,
  p_school_id text,
  p_tile_id text,
  p_kind text,
  p_session_id text default null
)
returns table (accepted boolean, points integer, captured boolean, contested boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school text;
  v_base integer;
  v_points integer;
  v_used_today integer;
  v_remaining integer;
  v_recent integer;
  v_recovery_count integer;
  v_last_recovery timestamptz;
  v_inserted integer;
  v_capture record;
  v_day_start timestamptz;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  v_base := public.campus_points_for(p_kind);
  if v_base = 0 then
    raise exception 'invalid contribution kind';
  end if;

  -- 활성 시즌만 허용
  if not exists (
    select 1 from public.campus_seasons where id = p_season_id and status = 'active'
  ) then
    return query select false, 0, false, false, 'season_closed'::text;
    return;
  end if;

  -- 내 학교와 다른 학교 id 로는 기여할 수 없습니다.
  select school_id into v_school from public.campus_memberships where user_id = auth.uid();
  if v_school is null then
    return query select false, 0, false, false, 'no_school'::text;
    return;
  end if;
  if v_school <> p_school_id then
    return query select false, 0, false, false, 'school_mismatch'::text;
    return;
  end if;

  -- 타일이 이 시즌에 속해야 합니다.
  if not exists (
    select 1 from public.campus_tiles where id = p_tile_id and season_id = p_season_id
  ) then
    return query select false, 0, false, false, 'tile_mismatch'::text;
    return;
  end if;

  -- 1분 창 이벤트 제한
  select count(*) into v_recent
  from public.campus_contributions
  where user_id = auth.uid() and created_at > now() - interval '1 minute';
  if v_recent >= 12 then
    return query select false, 0, false, false, 'rate_limited'::text;
    return;
  end if;

  -- 회복 기여 상한 · 최소 간격
  if p_kind = 'posture_recovered' then
    select count(*), max(created_at)
    into v_recovery_count, v_last_recovery
    from public.campus_contributions
    where user_id = auth.uid()
      and kind = 'posture_recovered'
      and season_id = p_season_id
      and session_id is not distinct from p_session_id;

    if v_recovery_count >= 5 then
      return query select false, 0, false, false, 'recovery_cap'::text;
      return;
    end if;

    if v_last_recovery is not null and now() - v_last_recovery < interval '20 seconds' then
      return query select false, 0, false, false, 'recovery_cooldown'::text;
      return;
    end if;
  end if;

  -- 하루 최대 기여도 (Asia/Seoul 기준)
  v_day_start := date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul';
  select coalesce(sum(points), 0) into v_used_today
  from public.campus_contributions
  where user_id = auth.uid() and created_at >= v_day_start;

  v_remaining := 600 - v_used_today;
  if v_remaining <= 0 then
    return query select false, 0, false, false, 'daily_cap'::text;
    return;
  end if;

  v_points := least(v_base, v_remaining);

  -- 멱등성: event_id 또는 (season,user,kind,session) 중복이면 아무 일도 하지 않습니다.
  begin
    insert into public.campus_contributions (
      event_id, season_id, school_id, user_id, kind, session_id, tile_id, points
    ) values (
      p_event_id, p_season_id, p_school_id, auth.uid(), p_kind, p_session_id, p_tile_id, v_points
    )
    on conflict (event_id) do nothing;
    get diagnostics v_inserted = row_count;
  exception
    when unique_violation then
      -- session 중복 인덱스 위반
      return query select false, 0, false, false, 'duplicate_session'::text;
      return;
  end;

  if v_inserted = 0 then
    return query select false, 0, false, false, 'duplicate_event'::text;
    return;
  end if;

  select * into v_capture
  from public.campus_capture_tile(p_tile_id, p_school_id, v_points);

  return query select true, v_points, v_capture.captured, v_capture.contested, null::text;
end;
$$;

-- ---------------------------------------------------------------------
-- 12. 집계 RPC — 규모 보정 점수 포함 (공식 순위가 아닙니다)
-- ---------------------------------------------------------------------
create or replace function public.campus_season_standings(p_season_id text)
returns table (
  school_id text,
  total_contribution bigint,
  active_contributors bigint,
  normalized_score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.school_id,
    coalesce(sum(c.points), 0)::bigint as total_contribution,
    count(distinct c.user_id)::bigint as active_contributors,
    round(
      coalesce(sum(c.points), 0)::numeric
        / sqrt(greatest(count(distinct c.user_id), 1)::numeric),
      2
    ) as normalized_score
  from public.campus_contributions c
  where c.season_id = p_season_id
  group by c.school_id
  order by normalized_score desc;
$$;

/** 내 기여도 — 지금 소속된 학교에 쌓인 것만 셉니다. (학교 변경 시 이전 기여도 제외) */
create or replace function public.campus_my_contribution(p_season_id text)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(c.points), 0)::integer
  from public.campus_contributions c
  join public.campus_memberships m on m.user_id = c.user_id
  where c.season_id = p_season_id
    and c.user_id = auth.uid()
    and c.school_id = m.school_id;
$$;

-- ---------------------------------------------------------------------
-- 13. RLS
-- ---------------------------------------------------------------------
alter table public.campus_schools enable row level security;
alter table public.campus_seasons enable row level security;
alter table public.campus_memberships enable row level security;
alter table public.campus_tiles enable row level security;
alter table public.campus_contributions enable row level security;
alter table public.campus_tile_events enable row level security;

-- 학교 목록·시즌·지도·영토 변화는 읽기 전용 공개 데이터입니다.
drop policy if exists campus_schools_select on public.campus_schools;
create policy campus_schools_select on public.campus_schools
for select to authenticated, anon using (true);

drop policy if exists campus_seasons_select on public.campus_seasons;
create policy campus_seasons_select on public.campus_seasons
for select to authenticated, anon using (true);

drop policy if exists campus_tiles_select on public.campus_tiles;
create policy campus_tiles_select on public.campus_tiles
for select to authenticated, anon using (true);

drop policy if exists campus_tile_events_select on public.campus_tile_events;
create policy campus_tile_events_select on public.campus_tile_events
for select to authenticated, anon using (true);

-- 내 소속·내 기여만 읽을 수 있습니다. (다른 사람의 활동을 열람할 수 없습니다)
drop policy if exists campus_memberships_select_self on public.campus_memberships;
create policy campus_memberships_select_self on public.campus_memberships
for select to authenticated using (user_id = auth.uid());

drop policy if exists campus_contributions_select_self on public.campus_contributions;
create policy campus_contributions_select_self on public.campus_contributions
for select to authenticated using (user_id = auth.uid());

-- INSERT/UPDATE/DELETE 정책을 두지 않습니다.
-- 모든 쓰기는 아래 security definer RPC 만 통과합니다.
-- 따라서 사용자는 타일·다른 학교의 기여·다른 사람의 소속을 직접 수정할 수 없습니다.

-- ---------------------------------------------------------------------
-- 13-1. 테이블 권한 (RLS 위의 두 번째 방어선)
-- ---------------------------------------------------------------------
-- Supabase 는 public 스키마의 새 테이블에 anon/authenticated 로 ALL 을 기본 grant 합니다.
-- RLS 에 쓰기 정책이 없어 이미 막히지만, 나중에 실수로 허용 정책이 추가되어도
-- 쓰기가 열리지 않도록 권한 자체를 회수합니다.
revoke insert, update, delete, truncate on
  public.campus_schools,
  public.campus_seasons,
  public.campus_memberships,
  public.campus_tiles,
  public.campus_contributions,
  public.campus_tile_events
from anon, authenticated;

-- 공개 읽기 데이터
grant select on
  public.campus_schools,
  public.campus_seasons,
  public.campus_tiles,
  public.campus_tile_events
to anon, authenticated;

-- 본인 데이터만 (anon 은 auth.uid() 가 없어 정책에서도 걸리지만 권한도 주지 않습니다)
grant select on public.campus_memberships, public.campus_contributions to authenticated;
revoke select on public.campus_memberships, public.campus_contributions from anon;

-- ---------------------------------------------------------------------
-- 14. 실행 권한
-- ---------------------------------------------------------------------
-- 관리 함수와 타일 점령 함수는 클라이언트가 직접 호출할 수 없어야 합니다.
-- PUBLIC 기본 grant 와 Supabase 의 anon/authenticated 역할 모두에서 회수합니다.
revoke all on function public.campus_seed_season(text, text, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.campus_archive_season(text) from public, anon, authenticated;
revoke all on function public.campus_capture_tile(text, text, integer)
  from public, anon, authenticated;

grant execute on function public.campus_set_school(text, text) to authenticated;
grant execute on function public.campus_record_contribution(text, text, text, text, text, text) to authenticated;
grant execute on function public.campus_season_standings(text) to authenticated, anon;
grant execute on function public.campus_my_contribution(text) to authenticated;
grant execute on function public.campus_points_for(text) to authenticated, anon;

-- campus_capture_tile 은 campus_record_contribution 안에서만 호출됩니다.
-- (직접 호출을 막아 임의 점령을 방지합니다)

-- ---------------------------------------------------------------------
-- 15. Realtime publication
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.campus_tiles;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.campus_tile_events;
    exception when duplicate_object then null;
    end;
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 16. 첫 시즌 준비 (개발 프로젝트에서만 실행하세요)
-- ---------------------------------------------------------------------
-- select public.campus_seed_season(
--   'season-1', '시즌 1', now(), now() + interval '14 days'
-- );

-- ============================================================================
-- 20260816_world_sessions_and_coins.sql
--
-- 오픈월드 세션 기록을 서버에 남기고, 코인을 서버가 지급합니다.
--
-- 왜 코인을 서버가 계산하는가
-- ---------------------------
-- 클라이언트가 "나 300코인 벌었어"라고 말하게 두면 그 말을 믿는 것 말고
-- 할 수 있는 일이 없습니다. 그래서 클라이언트는 사실(앉은 시간·회복 횟수)만
-- 보내고, 그 사실이 몇 코인인지는 여기 함수가 정합니다. 사실 자체를
-- 부풀리는 것까지는 못 막지만(카메라 판정은 브라우저 안에서 끝나므로),
-- 세션당·하루당 상한이 피해를 막습니다.
--
-- 수치는 연우안(코인 단일화)입니다. src/constants/coin.ts 와 같은 값입니다.
--   완주  5~14분 +10 / 15~29분 +30 / 30~49분 +40 / 50분~ +60
--   회복  +5 (세션당 5회까지)
--   연속 출석  3일+10 / 7일+25 / 14일+50 / 30일+100 / 60일+180 (각 1회)
--   미니게임 완료  +10 (게임별 하루 1회)
--   하루 획득 상한  300
--
-- user_key 는 auth.uid() 입니다. 학교 이메일 로그인이 없어도 Supabase
-- 익명 로그인(rooms 가 이미 쓰는 방식)으로 uid 가 생기므로, RLS 가
-- "본인 행만"을 실제로 보장합니다. 날짜 경계는 전부 KST 입니다.
-- ============================================================================

create table if not exists public.world_sessions (
  id             uuid primary key,          -- 클라이언트가 만듭니다. 재전송해도 행이 두 번 안 생기게.
  user_key       uuid not null default auth.uid(),
  school         text,
  seated_minutes integer not null default 0 check (seated_minutes between 0 and 1440),
  campus_minutes integer not null default 0 check (campus_minutes between 0 and 1440),
  recoveries     integer not null default 0 check (recoveries between 0 and 1440),
  started_at     timestamptz not null,
  ended_at       timestamptz not null,
  created_at     timestamptz not null default now(),
  check (ended_at >= started_at)
);

comment on table public.world_sessions is
  '오픈월드 세션 1회 = 1행. 영상·프레임·랜드마크는 절대 없습니다 — 분 단위 합계와 횟수뿐입니다.';

create index if not exists world_sessions_user_started
  on public.world_sessions (user_key, started_at desc);

create table if not exists public.world_coins (
  user_key           uuid primary key,
  balance            integer not null default 0 check (balance >= 0),
  daily_earned       integer not null default 0 check (daily_earned >= 0),
  last_earned_date   date,
  -- 출석 마일스톤(3·7·14·30·60일)을 어느 것까지 받았는지. 없으면 스트릭이
  -- 이어지는 동안 같은 마일스톤을 매일 다시 받습니다.
  claimed_milestones integer[] not null default '{}',
  -- 미니게임 "게임별 하루 1회"의 하루치 기록. 날짜가 바뀌면 비웁니다.
  minigame_date      date,
  minigame_done      text[] not null default '{}'
);

comment on table public.world_coins is
  '코인 잔액. 쓰기는 전부 RPC(world_finish_session·world_earn_minigame)만 합니다.';

-- ---------------- RLS ----------------
-- 읽기: 본인 행만. 쓰기: 정책 자체를 안 만듭니다 — REST 로 직접 insert/update
-- 하는 길을 막아야 잔액을 손으로 고칠 수 없습니다. 쓰기는 definer 함수만 합니다.

alter table public.world_sessions enable row level security;
alter table public.world_coins    enable row level security;

create policy world_sessions_select_own on public.world_sessions
  for select to authenticated
  using (user_key = (select auth.uid()));

create policy world_coins_select_own on public.world_coins
  for select to authenticated
  using (user_key = (select auth.uid()));

revoke insert, update, delete on public.world_sessions from anon, authenticated;
revoke insert, update, delete on public.world_coins    from anon, authenticated;

-- ---------------- 지급 헬퍼 ----------------
-- 하루 상한(300)을 한 곳에서만 적용합니다. 내부용이라 클라이언트는 못 부릅니다.

create or replace function public.world__grant(p_user uuid, p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_row   world_coins;
  v_give  integer;
begin
  insert into world_coins (user_key) values (p_user)
  on conflict (user_key) do nothing;

  select * into v_row from world_coins where user_key = p_user for update;

  if v_row.last_earned_date is distinct from v_today then
    v_row.daily_earned := 0;
  end if;

  v_give := greatest(0, least(coalesce(p_amount, 0), 300 - v_row.daily_earned));

  update world_coins
     set balance          = balance + v_give,
         daily_earned     = v_row.daily_earned + v_give,
         last_earned_date = v_today
   where user_key = p_user;

  return v_give;
end;
$$;

revoke all on function public.world__grant(uuid, integer) from public, anon, authenticated;

-- ---------------- 세션 종료 ----------------
-- 세션 행을 남기고, 완주·회복·출석 마일스톤 코인을 지급합니다.
-- 같은 id 로 다시 부르면(오프라인 큐 재전송) 아무것도 두 번 하지 않습니다.

create or replace function public.world_finish_session(
  p_id             uuid,
  p_school         text,
  p_seated_minutes integer,
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
  v_seated     integer := least(greatest(coalesce(p_seated_minutes, 0), 0), 1440);
  v_campus     integer := least(greatest(coalesce(p_campus_minutes, 0), 0), 1440);
  v_recov      integer := least(greatest(coalesce(p_recoveries, 0), 0), 1440);
  v_completion integer;
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
     v_seated, v_campus, v_recov, p_started_at, p_ended_at)
  on conflict (id) do nothing;

  if not found then
    -- 오프라인 큐가 같은 세션을 다시 보낸 경우 — 이미 지급했으니 잔액만 돌려줍니다.
    return jsonb_build_object('duplicate', true, 'granted', 0, 'streak', 0,
      'balance', coalesce((select balance from world_coins where user_key = v_uid), 0));
  end if;

  -- 완주 구간 (연우안). 120분을 넘는 세션도 60 그대로입니다 — 상한 구간의 값.
  v_completion := case
    when v_seated >= 50 then 60
    when v_seated >= 30 then 40
    when v_seated >= 15 then 30
    when v_seated >= 5  then 10
    else 0
  end;

  v_granted := world__grant(v_uid, v_completion + least(v_recov, 5) * 5);

  -- 출석 스트릭: 10분 이상 앉은 날이 오늘까지 며칠 연속인가.
  -- ponytail: 최대 60일만 봅니다 — 마일스톤이 60일까지뿐이라 그 뒤는 셀 이유가 없습니다.
  if v_seated >= 10 then
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
    'duplicate', false,
    'granted',   v_granted,
    'streak',    v_streak,
    'balance',   coalesce((select balance from world_coins where user_key = v_uid), 0)
  );
end;
$$;

revoke all on function public.world_finish_session(uuid, text, integer, integer, integer, timestamptz, timestamptz)
  from public, anon;
grant execute on function public.world_finish_session(uuid, text, integer, integer, integer, timestamptz, timestamptz)
  to authenticated;

-- ---------------- 미니게임 ----------------
-- 게임별 하루 1회 +10. 게임 목록을 여기 못박는 이유: 아무 문자열이나 받으면
-- "게임"을 무한히 만들어 상한까지 긁어 갈 수 있습니다.

create or replace function public.world_earn_minigame(p_game text)
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
  if p_game not in ('neck', 'escape', 'egg-catch', 'egg-merge', 'stack') then
    raise exception 'unknown game: %', p_game;
  end if;

  insert into world_coins (user_key) values (v_uid)
  on conflict (user_key) do nothing;

  select * into v_row from world_coins where user_key = v_uid for update;

  if v_row.minigame_date is distinct from v_today then
    v_row.minigame_done := '{}';
  end if;

  if not (p_game = any (v_row.minigame_done)) then
    update world_coins
       set minigame_date = v_today,
           minigame_done = v_row.minigame_done || p_game
     where user_key = v_uid;
    v_give := world__grant(v_uid, 10);
  end if;

  return jsonb_build_object(
    'granted', v_give,
    'balance', coalesce((select balance from world_coins where user_key = v_uid), 0)
  );
end;
$$;

revoke all on function public.world_earn_minigame(text) from public, anon;
grant execute on function public.world_earn_minigame(text) to authenticated;

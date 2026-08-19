-- ============================================================================
-- 20260819_world_school_ranking.sql
--
-- 명예의 전당(학생회관 · 하연)의 학교 순위를 서버가 집계합니다.
-- 이 저장소의 Supabase 프로젝트에 **이미 적용돼 있습니다.**
--
-- 왜 필요했나
-- -----------
-- index.html 의 명예의 전당에는 SEED_RANKING 이라는 **예시 값** 열 줄이
-- 박혀 있었습니다. 거기 달린 주석이 이랬습니다:
--
--   서버가 없으니 순위는 **예시 값**입니다. 빈 화면을 보여 주는 것보다
--   낫지만, 진짜인 척해서는 안 됩니다 — 화면 아래에 예시라고 적습니다.
--
-- 그 자리를 채웁니다. 예시 값과 "예시입니다" 고지를 같이 걷어냅니다.
--
-- 왜 클라이언트가 못 세는가 — 이 파일에서 제일 중요한 줄
-- ------------------------------------------------------
-- world_sessions 의 RLS 는 "본인 행만" 입니다(20260816_world_sessions_and_coins).
-- 그래서 브라우저는 **남의 세션을 한 줄도 못 읽습니다.** 학교 합계는 원리상
-- 클라이언트에서 만들 수 없고, 만들 수 있게 하려면 남의 기록을 열어 줘야
-- 합니다. security definer 함수가 RLS 를 넘어 합계만 돌려주는 것이 이
-- 화면이 존재할 수 있는 유일한 방법입니다.
--
-- 그래서 이 함수는 **집계만** 내보냅니다. user_key 도, 세션 id 도, 사람
-- 단위의 어떤 값도 반환에 없습니다. 개인 순위표를 안 만드는 이유는
-- index.html 의 hall 패널 주석 그대로입니다 — "개인 순위를 앞에 두면
-- '나는 몇 등인가' 가 먼저 보이고, 그건 자세를 점수로 만드는 것과 같은
-- 실수입니다."
--
-- 무엇으로 줄을 세우는가
-- ----------------------
-- world_sessions 에 이미 있는 둘만 씁니다: seated_minutes(자세 판정이 실제로
-- 돌아간 시간)와 recoveries(회복 횟수). 자세의 좋고 나쁨은 어떤 경로로도
-- 안 들어갑니다 — good·warn·bad 는 애초에 서버로 오지 않습니다
-- (AGENTS.md §2.2, CLAUDE.md 2번).
--
--   기여 분 = 판정 분 + 회복 횟수 × recovery_minutes(기본 5)
--
-- 회복 1회를 5분으로 세는 근거: 코인 규칙이 회복 1회 = 5코인이고 세션당
-- 5회까지라(COIN_RULE_DECISION), 한 세션이 회복으로 더할 수 있는 최대가
-- 25분어치입니다 — 회복만 노려서 순위를 만들 수 있는 크기가 아닙니다.
-- 회복을 아예 빼면 "다시 앉기" 가 순위에서 사라지고, 회복만으로 정렬하면
-- **자세를 자주 무너뜨린 학교가 이기는** 표시가 됩니다(RANKING_SPEC §6).
--
-- 큰 학교가 늘 이기는 것을 어떻게 막았나 ← 이 파일의 설계 핵심
-- ------------------------------------------------------------
-- 단순 합계면 학생 수가 승부를 가르고, 둘째 주에 나머지 학교는 보지
-- 않습니다. docs/economy/RANKING_SPEC.md §3 이 이미 정해 둔 공식을 그대로
-- 씁니다(연우 담당 폴더라 그 PR 에서는 코드를 못 고쳤습니다).
--
--   점수 = (학교 기여 분 + C × M) / (학교 참여자 수 + C)
--
--     M  전체 인당 평균 기여 분 = Σ기여 / Σ참여자
--     C  신뢰 상수 = 30 (world_ranking_config.shrink_c)
--
-- 뜻은 "평균적인 가상의 참여자 30명을 모든 학교에 똑같이 얹는다" 입니다.
-- 참여자가 많으면 C 가 묻혀 **인당 평균**에 수렴하고(규모 이점이 사라짐),
-- 참여자가 적으면 전체 평균 쪽으로 끌려가 소수의 극단값이 눌립니다.
-- RANKING_SPEC §4 의 시뮬레이션에서 800명 학교와 40명 학교의 순서가
-- 인당 기여 순서대로 뒤집힙니다.
--
-- 규모 보정만으로는 "세 명이 몰아서 파밍" 을 못 막습니다(RANKING_SPEC §5).
-- 그래서 셋을 같이 겁니다.
--
--   1. 참여자 하한 (min_contributors, 기본 20)
--      미달 학교는 순위 대신 "집계 중 (참여자 2/20)" 으로 보여 줍니다.
--      목표가 보이면 친구를 부르는 이유가 됩니다.
--   2. 하루 인당 인정 상한 (daily_credit_cap, 기본 240분)
--      한 사람이 하루에 학교 총점에 넣을 수 있는 최대입니다. 코인의
--      하루 상한 300 과 같은 모양입니다. 밤새 켜 두는 한 사람이 학교를
--      혼자 올리는 길을 막습니다.
--      RANKING_SPEC §5 의 "시즌 인당 상한" 은 따로 안 걸었습니다 — 하루
--      상한이 이미 시즌 상한(90일 × 240)을 정하고, 상한을 둘 두면 "내
--      기여가 왜 안 올라가나" 를 두 번 설명해야 합니다.
--   3. 참여자로 세는 기준 (min_minutes_to_count, 기본 10분)
--      시즌 동안 판정 분이 10분도 안 쌓인 사람은 참여자로 안 셉니다.
--      10 은 world_finish_session 의 출석 스트릭 기준과 같은 값입니다.
--      계정만 20개 만들어 하한을 채우는 길을 막습니다.
--
-- 왜 값을 표에 두는가
-- -------------------
-- world_shop_items 와 같은 이유입니다 — 함수 안에 숫자를 박으면 값을 고칠
-- 때마다 함수를 다시 만들어야 하고, 그러면 grant/revoke 를 매번 다시
-- 걸어야 합니다. 게다가 RANKING_SPEC §9 는 C · 참여자 하한 · 인정 상한
-- 셋을 "커뮤니티 규모를 보고 조정" 해야 하는 항목으로 남겨 두었습니다.
-- 이용자가 열 명일 때와 만 명일 때 같은 값일 수 없습니다.
--
-- 시즌은 어디서 오는가
-- --------------------
-- index.html 의 seasonInfo() 가 이미 정해 놓은 것을 **그대로** 씁니다:
-- 90일 · 2026-01-05(UTC) 시작 · 그때가 시즌 4. 서버가 다른 창을 쓰면
-- 화면은 "시즌 6, 44일 남음" 이라고 적어 놓고 서버는 다른 구간을 더하게
-- 됩니다. 두 화면이 같은 낱말로 다른 것을 가리키면 둘 다 못 믿습니다
-- (index.html 의 seasonNow 주석이 같은 사고를 이미 한 번 겪었습니다).
--
-- **이 상수를 고치면 index.html 의 seasonInfo() 도 같이 고쳐야 합니다.**
-- 어긋나면 화면의 남은 날만 틀리고, 실제로 집계되는 구간은 여기 값입니다.
--
-- 시즌 경계가 UTC 인데 하루 상한이 KST 인 이유: 시즌은 seasonInfo() 를
-- 따라가야 해서 UTC 이고, 하루 경계는 코인 규칙이 전부 KST 라 KST 입니다.
-- 시즌이 바뀌는 그 하루만 9시간이 어긋나는데, 90일에 한 번이고 그 시간에
-- 쌓인 분은 어느 쪽 시즌에 들어가도 뜻이 같습니다.
--
-- 개인정보
-- --------
-- 반환에는 학교 이름 · 참여자 수 · 합계뿐입니다. 다만 참여자가 한 명인
-- 학교의 "합계" 는 곧 그 한 사람의 기록 그 자체입니다. 그래서 참여자
-- 하한을 **설정값으로 낮춰도 3 밑으로는 안 내려갑니다**(아래 v_min).
-- 하한에 못 미친 학교는 이름과 참여자 수만 나가고 분·회복·점수는 아예
-- 안 나갑니다.
-- ============================================================================

-- ---------------- 1. 값표 ----------------

create table if not exists public.world_ranking_config (
  id                    smallint primary key default 1 check (id = 1),
  -- 신뢰 상수 C. 0 이면 순수 인당 평균(소수 정예가 늘 이김), 크면 전체
  -- 평균으로 눌려 대형 학교가 다시 유리해집니다. RANKING_SPEC §4 표 참고.
  shrink_c              integer not null default 30  check (shrink_c between 0 and 10000),
  -- 순위표에 오르는 참여자 하한. 아래 v_min 이 3 밑으로는 안 내려갑니다.
  min_contributors      integer not null default 20  check (min_contributors >= 1),
  -- 회복 1회를 몇 분으로 셀지.
  recovery_minutes      integer not null default 5   check (recovery_minutes between 0 and 60),
  -- 한 사람이 하루에 학교 총점에 넣을 수 있는 최대 분.
  daily_credit_cap      integer not null default 240 check (daily_credit_cap between 1 and 1440),
  -- 시즌 동안 이만큼은 앉아야 참여자 한 명으로 셉니다.
  min_minutes_to_count  integer not null default 10  check (min_minutes_to_count >= 1),
  updated_at            timestamptz not null default now()
);

comment on table public.world_ranking_config is
  '학교 순위 보정 상수 한 줄. 이용자 수에 따라 바꾸는 값이라 함수에 안 박고 표에 둡니다 — 함수를 다시 만들면 grant 를 매번 다시 걸어야 합니다.';

insert into public.world_ranking_config (id) values (1) on conflict (id) do nothing;

-- 읽기는 모두에게 엽니다. 값이 비밀이면 화면이 "참여자 2/20" 이라고 적을
-- 근거가 없어집니다. 쓰기 정책은 안 만듭니다 — 상수를 바꾸는 일은 사람이
-- 대시보드에서 하는 일이지 브라우저가 할 일이 아닙니다.
alter table public.world_ranking_config enable row level security;

drop policy if exists world_ranking_config_select_all on public.world_ranking_config;
create policy world_ranking_config_select_all on public.world_ranking_config
  for select to authenticated
  using (true);

revoke insert, update, delete on public.world_ranking_config from anon, authenticated;
revoke all on public.world_ranking_config from anon;

-- ---------------- 2. 한 시즌 집계 ----------------
-- 내부용입니다. 시즌 창(from ~ to)을 받아 그 구간의 학교별 집계를 돌려
-- 줍니다. 이번 시즌과 역대 시즌이 **같은 셈법**을 써야 해서 함수로 뺐습니다
-- — 두 벌로 쓰면 언젠가 한쪽만 고쳐집니다.
--
-- 클라이언트는 이 함수를 못 부릅니다. 창을 마음대로 넣을 수 있으면
-- "어제 하루" 같은 좁은 창으로 잘라 참여자 수를 줄여 가며 물어볼 수 있고,
-- 그러면 하한이 지키던 익명성이 깎입니다.

create or replace function public.world__school_standings(
  p_from timestamptz,
  p_to   timestamptz
)
returns jsonb
language sql
security definer
set search_path = public
as $$
with cfg as (
  select * from world_ranking_config where id = 1
),
-- 이 시즌에 그 사람이 속한 학교 하나. 시즌 안 **마지막 세션**의 학교입니다.
-- 한 사람이 시즌 중에 학교를 바꾸면 기여가 두 학교에 다 들어가는데,
-- 그러면 학교를 오가며 양쪽을 올릴 수 있습니다(RANKING_SPEC §8 "1인 1학교").
person_school as (
  select distinct on (s.user_key)
         s.user_key,
         btrim(s.school) as school
    from world_sessions s
   where s.started_at >= p_from and s.started_at < p_to
     and s.school is not null and btrim(s.school) <> ''
   order by s.user_key, s.started_at desc
),
-- 하루 인당 인정 상한. 상한을 사람·시즌 단위가 아니라 **하루** 단위로 거는
-- 이유는 머리말에 적었습니다. 날 경계는 KST(코인 규칙과 같음).
per_day as (
  select s.user_key,
         (s.started_at at time zone 'Asia/Seoul')::date as kst_day,
         least(
           sum(s.seated_minutes) + sum(s.recoveries) * (select recovery_minutes from cfg),
           (select daily_credit_cap from cfg)
         ) as credit,
         sum(s.seated_minutes) as minutes,
         sum(s.recoveries)     as recoveries
    from world_sessions s
   where s.started_at >= p_from and s.started_at < p_to
   group by 1, 2
),
per_person as (
  select user_key,
         sum(credit)     as credit,
         sum(minutes)    as minutes,
         sum(recoveries) as recoveries
    from per_day
   group by 1
),
-- 참여자 자격은 **판정 분**으로 봅니다. credit 으로 보면 회복만 두 번 한
-- 사람이 참여자가 되어(2×5=10) 하한을 채우는 데 쓰입니다.
joined as (
  select ps.school, pp.credit, pp.minutes, pp.recoveries
    from per_person pp
    join person_school ps using (user_key)
   where pp.minutes >= (select min_minutes_to_count from cfg)
),
per_school as (
  select school,
         count(*)::int          as contributors,
         sum(credit)::bigint    as credit,
         sum(minutes)::bigint   as minutes,
         sum(recoveries)::bigint as recoveries
    from joined
   group by school
),
-- 전체 인당 평균 M. 하한 미달 학교도 넣어 셉니다 — M 은 "이 서비스를 쓰는
-- 사람 한 명이 보통 얼마나 하나" 여야 하고, 그건 학교 규모와 무관합니다.
mean as (
  select case when coalesce(sum(contributors), 0) > 0
              then sum(credit)::numeric / sum(contributors)
              else 0 end as m
    from per_school
),
scored as (
  select p.*,
         round((p.credit + (select shrink_c from cfg) * (select m from mean))
               / (p.contributors + (select shrink_c from cfg)), 1) as score
    from per_school p
),
-- 하한. 설정을 아무리 낮춰도 3 밑으로는 안 갑니다 — 참여자 1~2명 학교의
-- 합계는 그 사람들의 기록 그 자체라 익명 집계가 아닙니다.
lim as (
  select greatest((select min_contributors from cfg), 3) as min_n
)
select jsonb_build_object(
  'ranked', coalesce((
     select jsonb_agg(jsonb_build_object(
              'school',       school,
              'score',        score,
              'minutes',      minutes,
              'recoveries',   recoveries,
              'contributors', contributors)
            order by score desc, minutes desc, school)
       from scored where contributors >= (select min_n from lim)), '[]'::jsonb),
  -- 하한 미달 학교. 분·회복·점수는 안 내보냅니다. 참여자 수로 정렬하는데,
  -- 그건 경쟁 지표가 아니라 순위표에 들어오는 입장권이라 그렇습니다.
  'pending', coalesce((
     select jsonb_agg(jsonb_build_object(
              'school',       school,
              'contributors', contributors)
            order by contributors desc, school)
       from scored where contributors < (select min_n from lim)), '[]'::jsonb),
  'minContributors', (select min_n from lim),
  'mean',    round((select m from mean), 1),
  'totals',  jsonb_build_object(
     'schools',      (select count(*) from scored),
     'contributors', coalesce((select sum(contributors) from scored), 0),
     'minutes',      coalesce((select sum(minutes) from scored), 0),
     'recoveries',   coalesce((select sum(recoveries) from scored), 0))
);
$$;

revoke all on function public.world__school_standings(timestamptz, timestamptz)
  from public, anon, authenticated;

-- ---------------- 3. 화면이 부르는 하나 ----------------
-- 이번 시즌 순위 · 역대 시즌 1위 · 내 학교가 한 왕복에 옵니다. 셋을 따로
-- 물으면 왕복이 셋이고, 그동안 화면은 세 조각이 따로 도착합니다.
--
-- 인자가 없습니다. 내 학교는 **내 세션 기록에서** 뽑습니다 — 클라이언트가
-- 학교 이름을 보내게 하면 남의 학교 이름을 보내 그 학교를 "우리 학교" 로
-- 칠하는 화면을 만들 수 있고, 무엇보다 인자가 없으면 못 속입니다.
--
-- 반환은 jsonb 라 열쇠를 나중에 더해도 옛 클라이언트가 안 깨집니다
-- (20260818_world_shop_server_authority 의 인자 목록 규칙).

create or replace function public.world_school_ranking()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_len    constant integer := 90;              -- index.html seasonInfo() 와 같은 값
  v_epoch  constant date    := date '2026-01-05';
  v_base   constant integer := 4;               -- 그날이 시즌 4
  v_days   integer;
  v_no     integer;
  v_into   integer;
  v_from   timestamptz;
  v_to     timestamptz;
  v_now    jsonb;
  v_past   jsonb := '[]'::jsonb;
  v_one    jsonb;
  v_school text;
  v_rank   integer;
  i        integer;
  pf       timestamptz;
  pt       timestamptz;
begin
  if v_uid is null then
    raise exception 'auth required';
  end if;

  v_days := greatest((now() at time zone 'UTC')::date - v_epoch, 0);
  v_no   := v_base + (v_days / v_len);
  v_into := v_days % v_len;
  v_from := ((v_epoch + (v_no - v_base) * v_len)::timestamp) at time zone 'UTC';
  v_to   := v_from + (v_len || ' days')::interval;

  v_now := world__school_standings(v_from, v_to);

  -- 내 학교. 이번 시즌에 세션이 있으면 그 마지막 학교, 없으면 평생 마지막
  -- 학교입니다. 둘 다 없으면 null 이고, 화면이 이 기기에 저장된 학교로
  -- 칠합니다 — 서버가 모르는 것을 아는 척하지 않습니다.
  select btrim(school) into v_school
    from world_sessions
   where user_key = v_uid and school is not null and btrim(school) <> ''
     and started_at >= v_from and started_at < v_to
   order by started_at desc limit 1;
  if v_school is null then
    select btrim(school) into v_school
      from world_sessions
     where user_key = v_uid and school is not null and btrim(school) <> ''
     order by started_at desc limit 1;
  end if;

  -- with ordinality 로 셉니다. row_number() over () 는 순서가 문서로
  -- 보장되지 않는데, 여기 순서가 곧 등수라 보장되는 쪽을 씁니다.
  if v_school is not null then
    select t.ord into v_rank
      from jsonb_array_elements(v_now->'ranked') with ordinality as t(e, ord)
     where t.e->>'school' = v_school;
  end if;

  -- 역대 시즌 1위 — **바로 앞 세 시즌**입니다. 이번 시즌과 같은 셈법으로
  -- 그때 창을 다시 집계합니다. 시즌이 끝났다고 기록을 따로 얼려 두지 않는
  -- 이유: 얼린 표와 원장부가 어긋나면 어느 쪽이 맞는지 알 길이 없습니다.
  -- 그 시즌에 하한을 넘은 학교가 없으면 그 시즌은 아예 안 실립니다 —
  -- 빈 액자를 세우느니 액자를 안 세웁니다.
  for i in 1..3 loop
    exit when v_no - i < 1;
    pf := ((v_epoch + (v_no - i - v_base) * v_len)::timestamp) at time zone 'UTC';
    pt := pf + (v_len || ' days')::interval;
    v_one := world__school_standings(pf, pt)->'ranked'->0;
    if v_one is not null then
      v_past := v_past || jsonb_build_array(jsonb_build_object(
        'no',           v_no - i,
        'school',       v_one->>'school',
        'minutes',      v_one->'minutes',
        'contributors', v_one->'contributors'));
    end if;
  end loop;

  return jsonb_build_object(
    'season', jsonb_build_object(
       'no',       v_no,
       'from',     to_char(v_from at time zone 'UTC', 'YYYY-MM-DD'),
       -- 마지막 날은 창의 **닫힌 끝**입니다. v_to 는 다음 시즌 첫날이라
       -- 그대로 보여 주면 하루를 더 산 것처럼 보입니다.
       'to',       to_char((v_to - interval '1 day') at time zone 'UTC', 'YYYY-MM-DD'),
       'daysLeft', v_len - v_into,
       'progress', round(v_into::numeric / v_len, 4)),
    'rules', jsonb_build_object(
       'minContributors', v_now->'minContributors',
       'shrinkC',         (select shrink_c from world_ranking_config where id = 1),
       'recoveryMinutes', (select recovery_minutes from world_ranking_config where id = 1),
       'dailyCapMinutes', (select daily_credit_cap from world_ranking_config where id = 1)),
    'ranked',  v_now->'ranked',
    'pending', v_now->'pending',
    'totals',  v_now->'totals',
    'past',    v_past,
    'me', jsonb_build_object(
       'school', v_school,
       'rank',   v_rank,
       -- 내 학교가 하한에 얼마나 다가갔나. 순위에 이미 올랐으면 null 입니다.
       'contributors', case when v_rank is null and v_school is not null then (
          select (e->>'contributors')::int
            from jsonb_array_elements(v_now->'pending') e
           where e->>'school' = v_school) end)
  );
end;
$$;

revoke all on function public.world_school_ranking() from public, anon;
grant execute on function public.world_school_ranking() to authenticated;

comment on function public.world_school_ranking() is
  '명예의 전당 학교 순위. 집계만 나갑니다 — user_key·세션 id·개인 단위 값은 반환에 없습니다. 순위 공식은 docs/economy/RANKING_SPEC.md §3.';

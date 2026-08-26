-- 2026년 시즌을 **날짜로 못박습니다.**
--
--   시즌 1   8월 31일 00:00  ~  10월 31일 24:00   (KST)
--   시즌 2  11월  1일 00:00  ~  12월 31일 24:00   (KST)
--
-- 왜 계산이 아니라 목록인가
-- ------------------------
-- 지금 함수는 date_trunc('quarter', now()) 로 시즌을 **계산**합니다. 그러면
-- 오늘(8월)의 시즌은 7월 1일에 시작한 것이 되고, 화면이 "5일 뒤 시작" 이라
-- 말하는 동안 서버는 두 달째 굴러가는 시즌을 내줍니다. 둘이 다르면 랭킹전의
-- "내가 채운" 이 어느 구간의 합인지 아무도 말하지 못합니다.
--
-- 그런데 올해 두 시즌은 길이가 다릅니다(2개월·2개월인데 시작이 31일과 1일).
-- 규칙으로 만들면 "8월 31일 + 2개월" 같은 식이 되고, 그 순간 달 넘김을
-- 다뤄야 합니다 — Postgres 는 11월 31일을 11월 30일로 클램프하고 JS 는
-- 12월 1일로 넘깁니다. 서버와 화면이 하루 어긋나는 자리입니다.
--
-- 두 줄짜리 목록에는 그런 자리가 없습니다. 내년 시즌이 정해지면 줄을
-- 더하면 됩니다.
--
-- 시즌 id 를 날짜로 짓는 이유
-- --------------------------
-- 옛 판본(14일 프로토타입)이 `season-1`, `season-2` … 를 썼고 그 행들이
-- **아직 있습니다**(2026-01-05 시작). 번호로 다시 지으면 첫 시즌이
-- `season-1` 이 되는데, on conflict do nothing 이라 새 행은 안 들어가고
-- 함수는 옛 행을 가리키게 되며, 1월의 기여가 새 시즌 순위에 섞입니다.
-- 시작 날짜를 그대로 id 에 넣어 겹칠 수 없게 합니다.
--
-- 시작 전 · 끝난 뒤
-- -----------------
-- 목록에 없는 시각에는 활성 시즌이 없습니다(null). 없는 것을 만들어 두면
-- 화면이 "시즌 0일째" 라고 말하게 되는데, 그건 아직 시작 안 했다는 뜻이
-- 아니라 뭔가 잘못됐다는 뜻으로 읽힙니다.
--
-- 표는 건드리지 않습니다. 함수 하나만 바뀝니다. 지난 시즌의 행과 기여도
-- 그대로 남습니다 — 다만 새 시즌은 새 id 라 순위는 8월 31일부터 다시
-- 셉니다. 그것이 "시즌 초기화" 입니다.

create or replace function public.ensure_active_campus_season()
returns text language plpgsql security definer set search_path = public as $fn$
declare
  v_now    timestamptz := now();
  v_starts timestamptz;
  v_ends   timestamptz;
  v_season text;
  v_name   text;
  v_source text;
  r        record;
begin
  -- 올해 시즌 목록. KST 기준이라 UTC 로는 하루 앞 15:00 입니다.
  for r in
    select * from (values
      ('2026-08-31'::text,
       timestamptz '2026-08-30 15:00:00+00',   -- 08-31 00:00 KST
       timestamptz '2026-10-31 15:00:00+00',   -- 11-01 00:00 KST
       '가을 시즌'::text),
      ('2026-11-01'::text,
       timestamptz '2026-10-31 15:00:00+00',   -- 11-01 00:00 KST
       timestamptz '2026-12-31 15:00:00+00',   -- 2027-01-01 00:00 KST
       '겨울 시즌'::text)
    ) as t(tag, starts_at, ends_at, name)
    order by starts_at
  loop
    if v_now >= r.starts_at and v_now < r.ends_at then
      v_season := 'season-' || r.tag;
      v_starts := r.starts_at;
      v_ends   := r.ends_at;
      v_name   := r.name;
      exit;
    end if;
  end loop;

  if v_season is null then
    return null;                      -- 시작 전이거나 올해가 끝났습니다
  end if;

  perform pg_advisory_xact_lock(hashtext('campus-season-rollover'));

  insert into public.campus_seasons (id, name, starts_at, ends_at, status)
  values (v_season, v_name, v_starts, v_ends, 'active')
  on conflict (id) do nothing;

  update public.campus_seasons
     set status = 'archived'
   where status = 'active' and ends_at <= v_now;

  -- 직전 시즌의 타일을 복사해 새 시즌도 같은 grid 를 씁니다.
  select id into v_source
    from public.campus_seasons
   where id <> v_season
   order by starts_at desc
   limit 1;

  if v_source is not null then
    insert into public.campus_territories (season_id, x, y, zone, name)
    select v_season, t.x, t.y, t.zone, t.name
      from public.campus_territories t
     where t.season_id = v_source
    on conflict do nothing;
  end if;

  return v_season;
end $fn$;

comment on function public.ensure_active_campus_season() is
  '활성 시즌 id. 2026: 가을(08-31~10-31) · 겨울(11-01~12-31), KST. '
  'id 는 season-YYYY-MM-DD. 목록 밖의 시각에는 null 입니다.';

-- 되돌리려면 (달력 분기로):
--   20260805_campus_quarterly_seasons.sql 의 함수 정의를 다시 실행하세요.

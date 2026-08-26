-- 시즌의 시작점을 2026-08-31 00:00 (KST) 로 못박습니다.
--
-- 왜 달력 분기가 아닌가
-- --------------------
-- 지금 함수는 date_trunc('quarter', now()) 를 씁니다. 그러면 오늘(8월)의
-- 시즌은 **7월 1일에 시작한 것**이 되고, 화면이 "가을 시즌 5일 뒤 시작" 이라
-- 말하는 동안 서버는 이미 두 달째 굴러가고 있는 시즌을 내줍니다. 둘이
-- 다르면 랭킹전의 "내가 채운" 이 어느 구간의 합인지 아무도 말 못 합니다.
--
-- 길이는 그대로 3개월입니다. 옮기는 것은 **기준점 하나뿐**입니다.
--
-- 시간대
-- ------
-- KST 로 셉니다. world_finish_session 의 하루 경계가 이미
-- `now() at time zone 'Asia/Seoul'` 이라, 시즌만 UTC 로 두면 자정 근처에
-- "오늘은 쌓였는데 시즌에는 안 들어간 분" 이 생깁니다.
--
-- 시작 전
-- -------
-- 기준점 이전에는 활성 시즌이 없습니다. 없는 것을 만들어 두면 화면이
-- "시즌 0일째" 같은 말을 하게 되고, 그건 아직 시작 안 했다는 뜻이 아니라
-- 뭔가 잘못됐다는 뜻으로 읽힙니다. 이때 함수는 null 을 돌려주고, 부르는
-- 쪽이 "곧 시작" 을 말합니다.

create or replace function public.ensure_active_campus_season()
returns text language plpgsql security definer set search_path = public as $fn$
declare
  -- 2026-08-31 00:00 KST
  c_anchor  constant timestamptz := timestamptz '2026-08-30 15:00:00+00';
  v_now     timestamptz := now();
  v_index   integer;
  v_starts  timestamptz;
  v_ends    timestamptz;
  v_season  text;
  v_source  text;
begin
  if v_now < c_anchor then
    return null;                      -- 아직 시작 전입니다
  end if;

  -- 기준점부터 3개월씩. months 차이를 정수로 세고 다시 더합니다 —
  -- epoch 나눗셈은 달마다 길이가 달라 경계에서 하루씩 어긋납니다.
  v_index := (extract(year from v_now) - extract(year from c_anchor))::integer * 12
           + (extract(month from v_now) - extract(month from c_anchor))::integer;
  if extract(day from v_now) < extract(day from c_anchor) then
    v_index := v_index - 1;           -- 아직 그 달의 기준일을 안 지났습니다
  end if;
  v_index := (v_index / 3);           -- 3개월 묶음

  v_starts := c_anchor + (v_index * interval '3 months');
  v_ends   := v_starts + interval '3 months';
  v_season := 'season-' || (v_index + 1);

  perform pg_advisory_xact_lock(hashtext('campus-season-rollover'));

  insert into public.campus_seasons (id, name, starts_at, ends_at, status)
  values (v_season, '시즌 ' || (v_index + 1), v_starts, v_ends, 'active')
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
  '활성 시즌 id. 2026-08-31 00:00 KST 부터 3개월씩. 시작 전에는 null 입니다.';

-- 되돌리려면 (달력 분기로):
--   20260805_campus_quarterly_seasons.sql 의 함수 정의를 다시 실행하세요.

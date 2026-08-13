-- 캠퍼스 시즌을 14일 프로토타입에서 달력 분기(Quarter)로 전환합니다.
-- 기존 시즌의 타일 정의를 복사하므로 현재 영토 데이터의 좌표·구역·이름을 보존합니다.

create or replace function public.ensure_active_campus_season()
returns text language plpgsql security definer set search_path = public as $fn$
declare
  v_starts timestamptz := date_trunc('quarter', now() at time zone 'UTC') at time zone 'UTC';
  v_ends timestamptz := v_starts + interval '3 months';
  v_year integer := extract(year from v_starts at time zone 'UTC')::integer;
  v_quarter integer := extract(quarter from v_starts at time zone 'UTC')::integer;
  v_season text := format('season-%s-q%s', v_year, v_quarter);
  v_source text;
begin
  perform pg_advisory_xact_lock(hashtext('campus-season-rollover'));

  insert into public.campus_seasons (id, name, starts_at, ends_at, status)
  values (v_season, format('%s년 %s분기', v_year, v_quarter), v_starts, v_ends, 'active')
  on conflict (id) do nothing;

  update public.campus_seasons
     set status = 'archived'
   where status = 'active' and ends_at <= now();

  -- 직전 시즌의 타일을 복사해 새 분기도 같은 12×8 grid를 사용합니다.
  select id into v_source
    from public.campus_seasons
   where id <> v_season
   order by starts_at desc
   limit 1;

  if v_source is not null then
    insert into public.campus_territories (id, season_id, x, y, zone, name)
    select v_season || substring(t.id from position(':' in t.id)),
           v_season, t.x, t.y, t.zone, t.name
      from public.campus_territories t
     where t.season_id = v_source
    on conflict (id) do nothing;
  end if;

  return v_season;
end; $fn$;

grant execute on function public.ensure_active_campus_season() to authenticated;

select public.ensure_active_campus_season();

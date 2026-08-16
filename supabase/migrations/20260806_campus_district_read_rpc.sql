-- 자치구 영토전용 읽기 RPC
-- 20260806_campus_district_territories.sql 실행 후 1회 실행하세요.

create or replace function public.campus_district_season_standings(p_season_id text)
returns table (
  school_id text,
  total_contribution bigint,
  active_contributors bigint,
  adjusted_score numeric,
  districts bigint
)
language sql stable security definer set search_path = public as $fn$
  with ledger as (
    select c.school_id, c.member_hash, c.points
      from public.campus_contributions c
     where c.season_id = p_season_id
    union all
    select c.school_id, c.member_hash, c.points
      from public.campus_district_contributions c
     where c.season_id = p_season_id
  )
  select
    l.school_id,
    sum(l.points)::bigint,
    count(distinct l.member_hash)::bigint,
    (sum(l.points) / sqrt(greatest(count(distinct l.member_hash), 1)))::numeric(12,2),
    (select count(*) from public.campus_district_territories d
      where d.season_id = p_season_id and d.owner_school_id = l.school_id)::bigint
    from ledger l
   group by l.school_id
   order by 4 desc;
$fn$;

grant execute on function public.campus_district_season_standings(text) to authenticated;

create or replace function public.campus_district_my_contribution(p_season_id text)
returns bigint
language sql stable security definer set search_path = public as $fn$
  select (
    coalesce((select sum(points) from public.campus_contributions
      where season_id = p_season_id
        and member_hash = md5(auth.uid()::text || ':' || p_season_id)), 0)
    +
    coalesce((select sum(points) from public.campus_district_contributions
      where season_id = p_season_id
        and member_hash = md5(auth.uid()::text || ':' || p_season_id)), 0)
  )::bigint;
$fn$;

grant execute on function public.campus_district_my_contribution(text) to authenticated;

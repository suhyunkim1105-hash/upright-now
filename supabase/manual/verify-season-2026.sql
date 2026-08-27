-- 1) 지금은 시작 전이라 null 이어야 합니다
select public.ensure_active_campus_season() as 지금;

-- 2) 8월 31일 이후로 가정하면 season-2026-08-31 이 나와야 합니다
--    (실제로 시간을 옮길 수는 없으니 목록만 확인합니다)
select id, name, starts_at at time zone 'Asia/Seoul' as 시작_KST,
       ends_at   at time zone 'Asia/Seoul' as 종료_KST, status
  from public.campus_seasons
 order by starts_at desc
 limit 10;

-- 3) 옛 season-1 이 남아 있는지 — 남아 있어도 이제 안 겹칩니다
select id, starts_at at time zone 'Asia/Seoul' as 시작_KST
  from public.campus_seasons
 where id in ('season-1', 'season-2026-q3', 'season-2026-08-31');

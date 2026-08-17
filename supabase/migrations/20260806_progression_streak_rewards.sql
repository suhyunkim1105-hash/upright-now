-- 출석 마일스톤 보상을 서버 원장에 기록합니다.
-- 선행 migration: 20260804_growth_reward_foundation.sql

insert into public.progression_reward_rules
  (event_type, xp_delta, points_delta, enabled)
values
  ('streak_3', 0, 20, true),
  ('streak_5', 0, 30, true),
  ('streak_7', 0, 50, true),
  ('streak_14', 0, 80, true),
  ('streak_30', 0, 150, true)
on conflict (event_type) do update
set xp_delta = excluded.xp_delta,
    points_delta = excluded.points_delta,
    enabled = excluded.enabled,
    updated_at = now();

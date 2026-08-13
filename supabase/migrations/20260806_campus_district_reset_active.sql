-- 현재 진행 중인 시즌의 영토 점령을 초기화합니다.
-- 테스트 계정의 한양대 점령/기여 기록만 지우는 용도이며,
-- 다음 시즌이나 과거 시즌 데이터는 건드리지 않습니다.
-- Supabase SQL Editor에서 1회 실행하세요.

do $fn$
declare
  v_season text := public.ensure_active_campus_season();
begin
  -- 새 자치구 영토 모델 초기화
  delete from public.campus_district_territory_events
   where season_id = v_season;

  delete from public.campus_district_contributions
   where season_id = v_season;

  update public.campus_district_territories
     set owner_school_id = null,
         challenger_school_id = null,
         defense_score = 0,
         challenge_score = 0,
         updated_at = now()
   where season_id = v_season;

  -- 이전 12×8 모델에도 남아 있는 테스트 점령을 함께 초기화합니다.
  delete from public.campus_territory_events
   where season_id = v_season;

  delete from public.campus_contributions
   where season_id = v_season;

  update public.campus_territories
     set owner_school_id = null,
         challenger_school_id = null,
         defense_score = 0,
         challenge_score = 0,
         updated_at = now()
   where season_id = v_season;
end;
$fn$;

-- 실행 결과 확인: 25개 자치구가 모두 중립(소유 학교 없음)이어야 합니다.
select district_id, owner_school_id, challenger_school_id,
       defense_score, challenge_score
  from public.campus_district_territories
 where season_id = public.ensure_active_campus_season()
 order by district_id;

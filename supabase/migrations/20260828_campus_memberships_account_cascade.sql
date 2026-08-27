-- 계정 삭제 시 캠퍼스 학교 소속 정보도 함께 삭제되도록 외래키를 추가한다.
-- docs/privacy/PRIVACY_POLICY.md §4.2 보관 정책("계정 삭제 시 함께 삭제")과
-- 실제 스키마를 맞추기 위한 마이그레이션이다.
--
-- 주의 (적용 전 확인):
--   1. auth.users 에 존재하지 않는 user_id 를 가진 고아 행이 있으면
--      아래 ALTER TABLE 이 실패한다. 적용 전에 아래 쿼리로 먼저 확인할 것.
--        select m.user_id from public.campus_memberships m
--        left join auth.users u on u.id = m.user_id
--        where u.id is null;
--      고아 행이 있다면 삭제하거나 원인을 먼저 파악해야 한다.
--   2. 이 파일은 저장소에만 추가되었고, 실제 프로젝트 데이터베이스에는
--      적용되지 않았다. Supabase 프로젝트 접근 권한이 있는 담당자가
--      `supabase db push` 또는 대시보드 SQL 편집기로 직접 적용해야 한다.

alter table public.campus_memberships
  add constraint campus_memberships_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

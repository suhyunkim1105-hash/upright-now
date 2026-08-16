-- ============================================================================
-- 20260805_campus_seoul_school_catalog.sql
--
-- 서울 소재 주요 대학 1차 확장 카탈로그.
-- 기존에 적용한 campus_territory_migration.sql / 학교 인증 migration 뒤에 실행합니다.
-- 공식 로고·마스코트·공식 색상은 저장하지 않고, 표시용 프로토타입 색만 사용합니다.
-- ============================================================================

insert into public.campus_schools
  (id, display_name, short_name, color, is_custom)
values
  ('konkuk',     '건국대학교',       '건국대',     '#4B3A2F', false),
  ('dongguk',    '동국대학교',       '동국대',     '#8A2E3B', false),
  ('hongik',     '홍익대학교',       '홍익대',     '#2F5D50', false),
  ('ewha',       '이화여자대학교',   '이화여대',   '#5B3C88', false),
  ('sookmyung',  '숙명여자대학교',   '숙명여대',   '#7B2E4A', false),
  ('kookmin',    '국민대학교',       '국민대',     '#254A73', false),
  ('soongsil',   '숭실대학교',       '숭실대',     '#1F5A63', false),
  ('kwangwoon',  '광운대학교',       '광운대',     '#293F72', false),
  ('sejong',     '세종대학교',       '세종대',     '#6B3B2A', false),
  ('seoultech',  '서울과학기술대학교', '서울과기대', '#1E5A86', false),
  ('sungshin',   '성신여자대학교',   '성신여대',   '#73405D', false),
  ('seoulwomens','서울여자대학교',   '서울여대',   '#2E5B77', false),
  ('dongduk',    '동덕여자대학교',   '동덕여대',   '#7A3E42', false),
  ('sangmyung',  '상명대학교',       '상명대',     '#245C4A', false)
on conflict (id) do update set
  display_name = excluded.display_name,
  short_name = excluded.short_name,
  color = excluded.color,
  is_custom = excluded.is_custom;

-- 학교 인증은 검토된 대표 학생 메일 도메인만 허용합니다.
-- 도메인이 여러 개인 학교는 별도 migration에서 추가하기 전에 실제 학생 메일 발급 정책을 확인하세요.
insert into public.campus_school_domains (school_id, email_domain)
values
  ('konkuk',      'konkuk.ac.kr'),
  ('dongguk',     'dgu.ac.kr'),
  ('hongik',      'hongik.ac.kr'),
  ('ewha',        'ewha.ac.kr'),
  ('sookmyung',   'sookmyung.ac.kr'),
  ('kookmin',     'kookmin.ac.kr'),
  ('soongsil',    'ssu.ac.kr'),
  ('kwangwoon',   'kw.ac.kr'),
  ('sejong',      'sju.ac.kr'),
  ('seoultech',   'seoultech.ac.kr'),
  ('sungshin',    'sungshin.ac.kr'),
  ('seoulwomens', 'swu.ac.kr'),
  ('dongduk',     'dongduk.ac.kr'),
  ('sangmyung',   'sangmyung.ac.kr')
on conflict (school_id) do update set
  email_domain = excluded.email_domain;

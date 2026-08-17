import type { CampusPatternId, CampusSchoolPreset, CampusZoneId } from '@/features/campus/types'

/**
 * 캠퍼스 테마 데이터와 문구.
 *
 * 중요 — 아래 색은 **이 프로토타입이 임의로 고른 컬러 프리셋**입니다.
 * 코드에 공식 색상 출처가 없으므로 어디에서도 "공식 색상"이라고 표시하지 않습니다.
 * 학교 공식 로고·마스코트·엠블럼은 사용하지 않고, 학교 이름 텍스트와
 * 일반적인 배경 패턴만 사용합니다. (AGENTS.md §10)
 */

export const CUSTOM_SCHOOL_ID = 'custom'

/** 기타 / 직접 설정의 기본 색 */
export const CUSTOM_DEFAULT_COLOR = '#5F8FF7'

export const CAMPUS_SCHOOLS: CampusSchoolPreset[] = [
  {
    id: 'snu',
    name: '서울대학교',
    short: '서울대',
    primary: '#2B4C7E',
    colorLabel: '딥 네이비',
    pattern: 'arch',
    colorSource: 'prototype-preset',
    emailDomain: 'snu.ac.kr',
  },
  {
    id: 'yonsei',
    name: '연세대학교',
    short: '연세대',
    primary: '#1D4E89',
    colorLabel: '딥 블루',
    pattern: 'grid',
    colorSource: 'prototype-preset',
    emailDomain: 'yonsei.ac.kr',
  },
  {
    id: 'korea',
    name: '고려대학교',
    short: '고려대',
    primary: '#8E2438',
    colorLabel: '딥 크림슨',
    pattern: 'stripe',
    colorSource: 'prototype-preset',
    emailDomain: 'korea.ac.kr',
  },
  {
    id: 'sogang',
    name: '서강대학교',
    short: '서강대',
    primary: '#A24936',
    colorLabel: '브릭 레드',
    pattern: 'weave',
    colorSource: 'prototype-preset',
    emailDomain: 'sogang.ac.kr',
  },
  {
    id: 'skku',
    name: '성균관대학교',
    short: '성균관대',
    primary: '#1E6B5E',
    colorLabel: '딥 그린',
    pattern: 'arch',
    colorSource: 'prototype-preset',
    emailDomain: 'skku.edu',
  },
  {
    id: 'hanyang',
    name: '한양대학교',
    short: '한양대',
    primary: '#2F4F82',
    colorLabel: '인디고 블루',
    pattern: 'grid',
    colorSource: 'prototype-preset',
    emailDomain: 'hanyang.ac.kr',
  },
  {
    id: 'cau',
    name: '중앙대학교',
    short: '중앙대',
    primary: '#39609E',
    colorLabel: '스틸 블루',
    pattern: 'stripe',
    colorSource: 'prototype-preset',
    emailDomain: 'cau.ac.kr',
  },
  {
    id: 'khu',
    name: '경희대학교',
    short: '경희대',
    primary: '#22603C',
    colorLabel: '포레스트 그린',
    pattern: 'weave',
    colorSource: 'prototype-preset',
    emailDomain: 'khu.ac.kr',
  },
  {
    id: 'hufs',
    name: '한국외국어대학교',
    short: '외대',
    primary: '#2C6E7F',
    colorLabel: '틸 블루',
    pattern: 'dots',
    colorSource: 'prototype-preset',
    emailDomain: 'hufs.ac.kr',
  },
  {
    id: 'uos',
    name: '서울시립대학교',
    short: '시립대',
    primary: '#4A5CA8',
    colorLabel: '바이올렛 블루',
    pattern: 'dots',
    colorSource: 'prototype-preset',
    emailDomain: 'uos.ac.kr',
  },
  {
    id: 'konkuk',
    name: '건국대학교',
    short: '건국대',
    primary: '#4B3A2F',
    colorLabel: '월넛 브라운',
    pattern: 'arch',
    colorSource: 'prototype-preset',
    emailDomain: 'konkuk.ac.kr',
  },
  {
    id: 'dongguk',
    name: '동국대학교',
    short: '동국대',
    primary: '#8A2E3B',
    colorLabel: '버건디',
    pattern: 'grid',
    colorSource: 'prototype-preset',
    emailDomain: 'dgu.ac.kr',
  },
  {
    id: 'hongik',
    name: '홍익대학교',
    short: '홍익대',
    primary: '#2F5D50',
    colorLabel: '파인 그린',
    pattern: 'stripe',
    colorSource: 'prototype-preset',
    emailDomain: 'hongik.ac.kr',
  },
  {
    id: 'ewha',
    name: '이화여자대학교',
    short: '이화여대',
    primary: '#5B3C88',
    colorLabel: '플럼 퍼플',
    pattern: 'weave',
    colorSource: 'prototype-preset',
    emailDomain: 'ewha.ac.kr',
  },
  {
    id: 'sookmyung',
    name: '숙명여자대학교',
    short: '숙명여대',
    primary: '#7B2E4A',
    colorLabel: '로즈 와인',
    pattern: 'dots',
    colorSource: 'prototype-preset',
    emailDomain: 'sookmyung.ac.kr',
  },
  {
    id: 'kookmin',
    name: '국민대학교',
    short: '국민대',
    primary: '#254A73',
    colorLabel: '잉크 블루',
    pattern: 'grid',
    colorSource: 'prototype-preset',
    emailDomain: 'kookmin.ac.kr',
  },
  {
    id: 'soongsil',
    name: '숭실대학교',
    short: '숭실대',
    primary: '#1F5A63',
    colorLabel: '딥 틸',
    pattern: 'arch',
    colorSource: 'prototype-preset',
    emailDomain: 'ssu.ac.kr',
  },
  {
    id: 'kwangwoon',
    name: '광운대학교',
    short: '광운대',
    primary: '#293F72',
    colorLabel: '코발트 네이비',
    pattern: 'stripe',
    colorSource: 'prototype-preset',
    emailDomain: 'kw.ac.kr',
  },
  {
    id: 'sejong',
    name: '세종대학교',
    short: '세종대',
    primary: '#6B3B2A',
    colorLabel: '테라코타',
    pattern: 'weave',
    colorSource: 'prototype-preset',
    emailDomain: 'sju.ac.kr',
  },
  {
    id: 'seoultech',
    name: '서울과학기술대학교',
    short: '서울과기대',
    primary: '#1E5A86',
    colorLabel: '오션 블루',
    pattern: 'dots',
    colorSource: 'prototype-preset',
    emailDomain: 'seoultech.ac.kr',
  },
  {
    id: 'sungshin',
    name: '성신여자대학교',
    short: '성신여대',
    primary: '#73405D',
    colorLabel: '뮬베리',
    pattern: 'grid',
    colorSource: 'prototype-preset',
    emailDomain: 'sungshin.ac.kr',
  },
  {
    id: 'seoulwomens',
    name: '서울여자대학교',
    short: '서울여대',
    primary: '#2E5B77',
    colorLabel: '슬레이트 블루',
    pattern: 'arch',
    colorSource: 'prototype-preset',
    emailDomain: 'swu.ac.kr',
  },
  {
    id: 'dongduk',
    name: '동덕여자대학교',
    short: '동덕여대',
    primary: '#7A3E42',
    colorLabel: '클레이 레드',
    pattern: 'stripe',
    colorSource: 'prototype-preset',
    emailDomain: 'dongduk.ac.kr',
  },
  {
    id: 'sangmyung',
    name: '상명대학교',
    short: '상명대',
    primary: '#245C4A',
    colorLabel: '에버그린',
    pattern: 'weave',
    colorSource: 'prototype-preset',
    emailDomain: 'sangmyung.ac.kr',
  },
  {
    id: CUSTOM_SCHOOL_ID,
    name: '기타 / 직접 설정',
    short: '직접 설정',
    primary: CUSTOM_DEFAULT_COLOR,
    colorLabel: '직접 고른 색',
    pattern: 'grid',
    colorSource: 'user-defined',
    custom: true,
  },
]

export function getSchoolPreset(id: string | null | undefined): CampusSchoolPreset | undefined {
  if (!id) return undefined
  return CAMPUS_SCHOOLS.find((s) => s.id === id)
}

/** 기타 학교에서 고를 수 있는 색 팔레트 (직접 입력도 가능) */
export const CUSTOM_COLOR_CHOICES: { color: string; label: string }[] = [
  { color: '#5F8FF7', label: '스카이 블루' },
  { color: '#2B4C7E', label: '딥 네이비' },
  { color: '#8E2438', label: '딥 크림슨' },
  { color: '#1E6B5E', label: '딥 그린' },
  { color: '#7A4FA3', label: '딥 퍼플' },
  { color: '#B26B1F', label: '앰버 브라운' },
  { color: '#2C6E7F', label: '틸 블루' },
  { color: '#3F4650', label: '차콜 그레이' },
]

/* --------------------------------- 문구 ---------------------------------- */

/**
 * 화면에 그대로 노출하는 고지 문구.
 * 대학 인증이 없으므로 "공식 대항전"으로 읽히는 표현을 쓰지 않습니다.
 */
export const CAMPUS_COPY = {
  /** 요청서에 명시된 문구 — 학교 선택 화면에 그대로 노출합니다. */
  unofficialTheme: '사용자가 직접 선택한 비공식 캠퍼스 테마입니다.',
  unofficialGame:
    '대학 인증이 없는 비공식 게임형 프로토타입이에요. 학교를 대표하거나 공식 순위를 나타내지 않아요.',
  colorSourcePreset:
    '색은 이 프로토타입이 임의로 고른 컬러 프리셋이에요. 공식 색상이 아니에요.',
  colorSourceCustom: '사용자가 직접 고른 색이에요.',
  noLogo: '학교 공식 로고·마스코트는 사용하지 않고, 학교 이름과 일반 패턴만 사용해요.',
  mockNotice:
    '지금은 로컬 프로토타입이에요. 지도와 순위는 이 브라우저 안의 mock 데이터로 움직여요.',
  contributionNotice:
    '자세 점수는 기여도에 쓰지 않아요. 정상 완료·회복 성공·친구 완주·스트레칭 완주만 반영해요.',
  scoreNotice:
    '규모 보정 점수는 총 기여도를 참여자 수의 제곱근으로 나눈 값이에요. 실제 공식 순위가 아니에요.',
  schoolChangeNotice:
    '학교는 한 시즌에 1회, 그리고 마지막 변경으로부터 7일이 지난 뒤에 바꿀 수 있어요.',
  schoolChangeContribution:
    '학교를 바꿔도 이전 학교에 쌓인 기여도는 옮겨지지 않아요.',
  privacy:
    '캠퍼스 기능은 카메라 영상·프레임·랜드마크·자세 좌표를 저장하거나 전송하지 않아요.',
} as const

export const CAMPUS_ZONE_META: Record<
  CampusZoneId,
  { label: string; icon: string; description: string }
> = {
  dorm: {
    label: '기숙사',
    icon: 'home',
    description: '생활의 거점 — 꾸준함이 지키는 곳이에요.',
  },
  field: {
    label: '운동장',
    icon: 'play',
    description: '넓고 탁 트인 만큼 자주 뒤집혀요.',
  },
  pond: {
    label: '산책로·연못',
    icon: 'leaf',
    description: '느긋한 산책 코스 — 방어가 약한 편이에요.',
  },
  library: {
    label: '도서관',
    icon: 'book',
    description: '가장 단단하게 지켜지는 구역이에요.',
  },
  plaza: { label: '광장', icon: 'target', description: '지도 중앙의 경합 구역이에요.' },
  lecture: { label: '강의동', icon: 'growth', description: '수업이 이어지는 구역이에요.' },
  lawn: { label: '잔디밭', icon: 'leaf', description: '가장 쉽게 바뀌는 구역이에요.' },
  cafe: { label: '카페', icon: 'headphones', description: '짧게 머무는 구역이에요.' },
}

export const CAMPUS_PATTERN_LABEL: Record<CampusPatternId, string> = {
  grid: '격자',
  arch: '아치',
  stripe: '사선',
  dots: '점',
  weave: '직조',
}

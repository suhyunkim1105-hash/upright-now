/** 라우트 주소 — docs/04_IA.md §1 */
export const ROUTES = {
  home: '/',
  landing: '/landing',
  onboardingName: '/onboarding/name',
  profiles: '/profiles',
  camera: '/camera',
  calibration: '/calibration',
  sessionSetup: '/session/setup',
  session: (id = 'demo') => `/session/${id}`,
  stretch: (id = 'demo') => `/stretch/${id}`,
  result: (id = 'demo') => `/result/${id}`,
  history: '/history',
  growth: '/growth',
  shop: '/shop',
  roomNew: '/room/new',
  room: (code = 'demo') => `/room/${code}`,
  settings: '/settings',
  lab: '/lab',
  /** 캠퍼스 — VITE_ENABLE_CAMPUS_TERRITORY 가 켜질 때만 등록됩니다. */
  campus: '/campus',
  campusMap: '/campus/map',
  campusHistory: '/campus/history',
} as const

export interface NavItem {
  to: string
  label: string
  icon: string
}

/** 세션 밖 사이드바 순서 — docs/04_IA.md §3 */
export const SIDEBAR_ITEMS: NavItem[] = [
  { to: ROUTES.home, label: '홈', icon: 'home' },
  { to: ROUTES.sessionSetup, label: '집중 세션', icon: 'timer' },
  { to: ROUTES.history, label: '기록', icon: 'chart' },
  { to: ROUTES.growth, label: '성장', icon: 'growth' },
  { to: ROUTES.shop, label: '상점', icon: 'bag' },
  { to: ROUTES.roomNew, label: '친구 방', icon: 'friends' },
  { to: ROUTES.stretch(), label: '스트레칭', icon: 'stretch' },
  { to: ROUTES.settings, label: '설정', icon: 'settings' },
]

/** 캠퍼스 메뉴 — 플래그가 꺼져 있으면 사이드바에 넣지 않습니다. */
export const CAMPUS_NAV_ITEM: NavItem = {
  to: ROUTES.campus,
  label: '캠퍼스',
  icon: 'growth',
}

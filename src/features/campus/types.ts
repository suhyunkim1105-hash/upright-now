/**
 * 캠퍼스 테마 · 영토전 프로토타입 타입.
 *
 * 이 모듈은 자세 엔진·캘리브레이션·보상·PiP·친구 방 코어와 완전히 분리되어 있습니다.
 * 여기에는 카메라 영상·프레임·랜드마크·자세 좌표·`bad` 상태가 절대 들어오지 않습니다.
 * (docs/CAMPUS_DATA_MODEL.md §5)
 */

/** 일반적인 배경 패턴 프리셋 — 학교 공식 로고·마스코트를 쓰지 않습니다. */
export type CampusPatternId = 'grid' | 'arch' | 'stripe' | 'dots' | 'weave'

/** 가상 캠퍼스 지도의 구역. 실제 학교 부지를 복제하지 않습니다. */
export type CampusZoneId =
  | 'library'
  | 'plaza'
  | 'lecture'
  | 'lawn'
  | 'cafe'
  | 'dorm'
  | 'field'
  | 'pond'

/**
 * 색 출처.
 * - `prototype-preset`: 이 프로토타입이 임의로 고른 색. 공식 색이 아닙니다.
 * - `user-defined`: 사용자가 직접 고른 색.
 */
export type CampusColorSource = 'prototype-preset' | 'user-defined'

export interface CampusSchoolPreset {
  id: string
  /** 학교 이름 (텍스트만 사용) */
  name: string
  /** 좁은 자리용 짧은 이름 */
  short: string
  /** 프로토타입 포인트 색 */
  primary: string
  /** 색 프리셋 이름 (예: 딥 네이비) */
  colorLabel: string
  pattern: CampusPatternId
  colorSource: CampusColorSource
  /** 기타 / 직접 설정 항목 */
  custom?: boolean
}

export interface CampusThemeTokens {
  schoolId: string
  schoolName: string
  short: string
  primary: string
  /** 아주 연한 배경 */
  soft: string
  /** 연한 배경 + 경계 */
  softStrong: string
  /** primary 위에 올리는 글자색 */
  onPrimary: string
  /** primary 를 조금 어둡게 — 글자 대비 확보용 */
  deep: string
  colorLabel: string
  pattern: CampusPatternId
  colorSource: CampusColorSource
}

/* --------------------------------- 시즌 ---------------------------------- */

export type CampusSeasonStatus = 'active' | 'archived'

export interface CampusSeason {
  id: string
  name: string
  startsAt: number
  endsAt: number
  status: CampusSeasonStatus
}

/* --------------------------------- 타일 ---------------------------------- */

export interface CampusTile {
  id: string
  seasonId: string
  x: number
  y: number
  zone: CampusZoneId
  /** 영토 이름 (seed manifest 기준, 서버 name 컬럼과 동일) */
  name: string
  ownerSchoolId: string | null
  challengerSchoolId: string | null
  defenseScore: number
  challengeScore: number
  updatedAt: number
}

export type CampusTileStatus = 'neutral' | 'held' | 'contested'

export type CampusTileEventKind = 'captured' | 'contested' | 'reinforced'

export interface CampusTileEvent {
  id: string
  seasonId: string
  tileId: string
  kind: CampusTileEventKind
  fromSchoolId: string | null
  toSchoolId: string | null
  at: number
}

/** 클라이언트에서만 잠깐 표시하는 영토전 전투 장면입니다. */
export interface CampusBattleScene {
  eventId: string
  tileId: string
  attackerSchoolId: string | null
  defenderSchoolId: string | null
  startedAt: number
  expiresAt: number
}

/* -------------------------------- 기여도 --------------------------------- */

/**
 * 기여 이벤트 종류. 자세 점수는 쓰지 않습니다.
 * 중도 종료·데모·QA 는 기여도가 없습니다.
 */
export type CampusContributionKind =
  | 'session_completed'
  | 'posture_recovered'
  | 'friend_session_completed'
  | 'stretch_completed'

export interface CampusContributionEvent {
  eventId: string
  kind: CampusContributionKind
  seasonId: string
  schoolId: string
  /** 익명 사용자 식별자 (닉네임·이메일이 아닙니다) */
  memberId: string
  /** 세션 단위 중복 차단용. 스트레칭처럼 세션이 없으면 null */
  sessionId: string | null
  tileId: string
  points: number
  occurredAt: number
}

export interface CampusSchoolStanding {
  schoolId: string
  totalContribution: number
  activeContributors: number
  /** totalContribution / sqrt(max(activeContributors, 1)) — 규모 보정 점수 */
  normalizedScore: number
  tiles: number
}

/* ------------------------------ 저장소 스냅샷 ----------------------------- */

export interface CampusArchivedSeason {
  season: CampusSeason
  tiles: CampusTile[]
  standings: CampusSchoolStanding[]
}

export interface CampusSnapshot {
  season: CampusSeason
  tiles: CampusTile[]
  standings: CampusSchoolStanding[]
  /** 최근 → 과거 순 */
  tileEvents: CampusTileEvent[]
  /** 이번 시즌 내 기여도 */
  myContribution: number
  archived: CampusArchivedSeason[]
}

/* ------------------------- 학교 디렉터리 (안전 공개) ------------------------ */

/**
 * 모든 사용자에게 공개해도 되는 학교 표시 정보.
 * created_by 등 소유·개인 관련 열은 여기 절대 포함하지 않습니다.
 */
export interface CampusSchoolDirectoryEntry {
  id: string
  displayName: string
  shortName: string
  color: string
  isCustom: boolean
}

/** Supabase Auth 이메일 OTP로 확인된 영토전 참여 자격. 원본 이메일은 포함하지 않습니다. */
export interface CampusVerification {
  schoolId: string
  emailDomain: string
  verifiedAt: number
}

/* ----------------------------- Realtime 상태 ----------------------------- */

export type CampusRealtimeStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'offline'
  | 'error'

/* ------------------------------- 기여 outbox ------------------------------ */

/**
 * 아직 서버에 반영되지 못한 기여 이벤트 — 유실 방지용 로컬 큐.
 * 영상·프레임·랜드마크·자세 상태·점수·개인 기준은 절대 저장하지 않습니다.
 */
export interface CampusOutboxItem {
  eventId: string
  kind: CampusContributionKind
  sessionId: string | null
  targetTileId: string | null
  occurredAt: number
  retryCount: number
  lastError: string | null
}

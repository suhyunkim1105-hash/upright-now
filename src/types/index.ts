/**
 * UpRight Now 핵심 타입
 * 기준: AGENTS.md §4 권장 타입, docs/06 §12, docs/15 §5
 */

/* ---------------------------------- 자세 --------------------------------- */

export type PostureState = 'good' | 'warning' | 'bad' | 'away' | 'unstable'

export type DetectionQuality = 'good' | 'limited' | 'unavailable'

export type DeviationCategory = 'forward' | 'tilt' | 'shoulder' | 'mixed'

export type PostureEngineEvent =
  | 'recovery_started'
  | 'recovery_succeeded'
  | 'recovery_missed'

/**
 * 자세 엔진이 UI·게임에 넘기는 유일한 경계 객체.
 * Phase 1에서는 QA Lab이, Phase 3에서는 MediaPipe가 같은 모양으로 채웁니다.
 * 원시 편차값은 절대 포함하지 않습니다. (docs/06 §12)
 */
export interface PostureSnapshot {
  state: PostureState
  quality: DetectionQuality
  deviationCategory?: DeviationCategory
  recoveryOpportunity?: {
    active: boolean
    remainingMs: number
  }
  event?: PostureEngineEvent
}

/* ---------------------------------- 세션 --------------------------------- */

export type SessionStatus =
  | 'idle'
  | 'preparing'
  | 'running'
  | 'paused'
  | 'resting'
  | 'completed'
  | 'aborted'

export type SessionMode = 'solo' | 'room'

export interface SessionConfig {
  subject: string
  goal: string
  plannedDurationSec: number
  restDurationSec: number
  profileId: LearningProfileKind
  mode: SessionMode
}

export interface AiSessionReport {
  headline: string
  reflection: string
  highlights: Array<{
    label: string
    detail: string
  }>
  nextAction: {
    title: string
    instruction: string
    durationMinutes: number
  }
}

export interface SessionSummary {
  id: string
  /** 원본 세션 id — 같은 세션이 두 번 저장돼도 집계는 1회만 (구버전 기록엔 없음) */
  sessionId?: string
  startedAt: number
  endedAt: number
  status: 'completed' | 'aborted'
  subject?: string
  goal?: string
  plannedDurationMs: number
  elapsedMs: number
  detectableMs: number
  awayMs: number
  unstableMs: number
  recoveryOpportunities: number
  recoveries: number
  fastestRecoveryMs?: number
  bestCombo: number
  damageDealt: number
  xpEarned: number
  pointsEarned: number
  targetProgress?: 'done' | 'mostly' | 'half' | 'little'
  /** 진행도 한글 라벨 — 과거 기록에 없어도 안전하게 표시 */
  targetProgressLabel?: string
  /** 다음 할 일 한 줄 (최대 80자, HTML·제어문자 제거) */
  nextAction?: string
  /** 사용자가 직접 요청해 만든 세션 집계 기반 AI 회고 (원본 카메라 데이터 없음) */
  aiReport?: AiSessionReport
  /** 1분 빠른 점검 — 보상·출석·캠퍼스·집계 대상 아님 */
  isTest?: boolean
  /** 완료/중단 인정 사유 */
  completionReason?: 'normal' | 'under-80' | 'no-detection' | 'test'
}

/* ------------------------------- 학습 프로필 ------------------------------ */

export type LearningProfileKind = 'library' | 'home' | 'team' | 'custom'

export interface LearningProfile {
  id: LearningProfileKind
  name: string
  description: string
  sound: string
  ambient: string
  stretchKind: string
  accent: 'pink' | 'yellow' | 'blue' | 'green'
  /** components/ui/Icon 의 이름 */
  icon: string
}

/* --------------------------------- 캐릭터 -------------------------------- */

export type CharacterStage = 1 | 2 | 3 | 4 | 5 | 6

/**
 * 세션 중의 일시적 표현 상태.
 * 장기 성장 단계(CharacterStage)와 완전히 분리됩니다. (AGENTS.md §2.5)
 */
export type CharacterVisualState =
  | 'idle'
  | 'warning'
  | 'slouch'
  | 'recover'
  | 'away'

export interface CharacterStageMeta {
  stage: CharacterStage
  name: string
  tagline: string
  requiredXp: number
  /** 이 단계에서 달라지는 외형 설명 */
  visualDiff: string
}

/* --------------------------------- 상점 ---------------------------------- */

export interface StoreItem {
  id: string
  type: 'jacket' | 'backpack'
  name: string
  description: string
  price: number
  assetKey: string
  availableStages: number[]
}

export interface EquippedItems {
  jacketId?: string
  backpackId?: string
}

/* -------------------------------- 친구 방 -------------------------------- */

export type RoomStatus =
  | 'waiting'
  | 'running'
  | 'resting'
  | 'completed'
  | 'closed'

export type RoomMemberState =
  | 'joining'
  | 'ready'
  | 'focusing'
  | 'resting'
  | 'away'
  | 'completed'

/* -------------------------------- 스트레칭 ------------------------------- */

export interface StretchRoutine {
  id: string
  name: string
  durationSec: number
  note: string
  weights: Record<Exclude<LearningProfileKind, 'custom'>, number>
}

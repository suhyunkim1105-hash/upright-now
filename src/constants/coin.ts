import { MAX_REWARDED_RECOVERIES } from '@/constants/posture'

/**
 * 코인 경제 — 단일화 확정본 (연우안)
 *
 * 이 파일이 유일한 정답입니다. 월드 프로토타입(prototypes/openworld)과
 * 서버(supabase/migrations/20260816_world_sessions_and_coins.sql)가 같은
 * 수치를 씁니다. 셋 중 하나를 바꾸면 셋 다 바꿔야 합니다.
 *
 * 이전 세 벌(main 의 분당 적립안 / 노션 표 / 월드 내 수치)은 이걸로
 * 대체합니다. 이전 안과 달라진 점:
 * - 분당 적립(perMinute)·하루 첫 세션 보너스는 없습니다. 완주 구간제로 통일.
 * - "계획 시간의 80%" 완주 규칙은 뺐습니다 — 월드는 시간을 미리 정하지 않습니다.
 * - 자세 점수·등급은 어떤 수치에도 들어가지 않습니다. (AGENTS.md)
 *
 * 민철 판본(누적형)에서 가져온 것 · 버린 것
 * - 가져옴: 첫 회복 +10, 회고 확인 +3
 * - 버림:   캠퍼스 체류 코인 (걸어다니기만 해도 줌 = 어뷰징 그 자체),
 *           공간별 차등 (본관 3 / 도서관 2 — "어디 앉을지" 가 계산이 됨)
 *
 * 결정 근거는 docs/economy/COIN_RULE_DECISION.md 에 있습니다.
 */

/**
 * 완주 구간 — **자세 판정이 실제로 돌아간 시간** 기준입니다.
 * 의자에 앉아 있던 시간이 아닙니다. 카메라 앞에 사람이 없으면 판정이 안 돌고,
 * 안 돌면 1분도 안 쌓입니다 — 앉혀 두고 자리를 비우는 것을 이 한 줄로 막습니다.
 * good·warn·bad 를 똑같이 셉니다. 자세가 나빠도 시간은 그대로 쌓입니다.
 * 위에서부터 먼저 맞는 구간을 씁니다.
 */
export const SESSION_COMPLETION_TIERS = [
  { minMinutes: 50, points: 60 },
  { minMinutes: 30, points: 40 },
  { minMinutes: 15, points: 30 },
  { minMinutes: 5, points: 10 },
] as const

/** 연속 출석 마일스톤 — 각 1회만 지급 */
export const STREAK_MILESTONES = [
  { days: 3, points: 10 },
  { days: 7, points: 25 },
  { days: 14, points: 50 },
  { days: 30, points: 100 },
  { days: 60, points: 180 },
] as const

/** 건별 획득 규칙 */
export const COIN_EARN = {
  /** 자세 회복 성공 1회 — 세션당 maxRewardedRecoveries 회까지 */
  recovery: 5,
  /** 처음으로 회복에 성공한 순간 — 평생 한 번. 온보딩에서 "이게 되는구나" 를
      만드는 자리라 값이 큽니다. (민철 판본에서 가져왔습니다) */
  firstRecovery: 10,
  /** 세션 회고를 열어 확인 — 세션당 한 번, 하루 3회까지.
      회고는 보여 주고 싶은 화면인데 안 열면 아무 일도 안 일어납니다.
      (민철 판본에서 가져왔습니다) */
  retroSeen: 3,
  /** 오늘 목표 달성 1회 */
  dailyGoal: 10,
  /** 친구와 공동 완주 1회 */
  coCompletion: 10,
  /** 미니게임 완료 — 게임별 하루 1회 */
  minigame: 10,
} as const

export const COIN_RULES = {
  /** 회고 보상을 하루에 몇 세션까지 인정하는가 */
  maxRetroPerDay: 3,
  /** 하루 획득 상한 — 모든 원천 합산. 어뷰징 방지. */
  dailyCap: 300,
  /** 세션당 보상 인정 회복 횟수 — posture.ts 값을 그대로 씁니다 */
  maxRewardedRecoveries: MAX_REWARDED_RECOVERIES,
  /** 출석으로 인정하는 최소 착석 시간(분) */
  attendanceMinMinutes: 10,
  /** 완주 구간표가 정의된 상한(분). 이보다 긴 세션도 최고 구간 값을 받습니다. */
  sessionMaxMinutes: 120,
} as const

/**
 * 가격 — 이전 확정값 유지. 범위 항목은 `[최소, 최대]`.
 */
export const COIN_PRICES = {
  top: [150, 250],
  bottom: [150, 250],
  shoes: [150, 250],
  hat: [100, 200],
  glasses: [100, 200],
  bag: [150, 250],
  eggCommon: 800,
  eggRare: 2000,
  seasonLimited: 1500,
} as const satisfies Record<string, number | readonly [number, number]>

/** 기존 잎사귀 포인트 → 코인 전환 배율 (잔액 그대로 이관) */
export const LEAF_TO_COIN_RATE = 1

/** 완주 구간 코인. 5분 미만은 0. */
export function completionCoins(minutes: number): number {
  const m = Math.max(0, Math.floor(minutes))
  return SESSION_COMPLETION_TIERS.find((tier) => m >= tier.minMinutes)?.points ?? 0
}

export interface CoinSession {
  /** 감지 가능했던 착석 시간(분) */
  focusMin: number
  /** 회복 성공 횟수 (상한은 함수가 적용합니다) */
  recoveries: number
}

/** 세션 1회에서 나오는 코인 (완주 + 회복). 출석·목표·공동 완주는 별도 건. */
export function sessionCoins({ focusMin, recoveries }: CoinSession): number {
  const rewarded = Math.min(
    Math.max(0, Math.floor(recoveries)),
    COIN_RULES.maxRewardedRecoveries,
  )
  return completionCoins(focusMin) + rewarded * COIN_EARN.recovery
}

/** 연속 n일째 되는 날 받는 마일스톤 코인. 해당 없으면 0. */
export function streakMilestoneCoins(days: number): number {
  return STREAK_MILESTONES.find((m) => m.days === days)?.points ?? 0
}

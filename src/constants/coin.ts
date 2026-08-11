import { MAX_REWARDED_RECOVERIES } from '@/constants/posture'

/**
 * 코인 경제 — docs/economy/COIN_ECONOMY.md
 *
 * 기존 `src/constants/game.ts` 의 XP·잎사귀 표는 **건드리지 않습니다**.
 * 이 파일은 설계 확정값만 담고, 실제 적립 경로에 연결하는 작업은 별도 PR 입니다.
 *
 * 원칙
 * - 코인은 "쓸 수 있는 잔액", XP 는 "줄어들지 않는 누적치"입니다.
 *   같은 이벤트가 양쪽에 같은 양을 넣고, 구매는 코인만 깎습니다.
 * - 하루 상한은 **코인에만** 적용합니다. XP 에 상한을 걸면 많이 한 날의
 *   성장 단계 진행이 멈춰 "노력한 만큼 자란다"가 깨집니다.
 * - 자세 점수·등급은 어떤 수치에도 들어가지 않습니다. (AGENTS.md §2.2)
 * - 스트레칭 보상 항목은 없습니다. 기능을 접기로 했습니다.
 */

/** 획득 규칙 — 확정값 */
export const COIN_EARN = {
  /** 세션 1분당 (감지 가능한 시간만 셉니다) */
  perMinute: 2,
  /** 자세 회복 성공 1회 — 세션당 MAX_REWARDED_RECOVERIES 회까지 */
  recovery: 5,
  /** 세션 완주 (COIN_RULES.completionMinMinutes 이상) */
  sessionCompleted: 30,
  /** 연속 출석 유지 중인 날 1회 */
  streakDaily: 10,
  /** 하루 첫 세션 1회 */
  firstSessionOfDay: 20,
} as const

export const COIN_RULES = {
  /** 완주 보너스를 주는 최소 계획 길이(분) */
  completionMinMinutes: 25,
  /** 하루 획득 상한 — 모든 원천 합산 */
  dailyCap: 300,
  /** 세션당 보상 인정 회복 횟수 — posture.ts 값을 그대로 씁니다 */
  maxRewardedRecoveries: MAX_REWARDED_RECOVERIES,
} as const

/**
 * 가격 — 확정값. 범위 항목은 `[최소, 최대]` 이고 개별 아이템은 그 안에서 정합니다.
 * `bag` 은 지시에 값이 없어 옷과 같은 구간을 임시로 씁니다. (COIN_ECONOMY.md §6 결정 필요)
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

/** 시뮬레이션에서 "대표 가격"으로 쓰는 값 — 범위의 중앙값 */
export const REPRESENTATIVE_CLOTHING_PRICE = 200

/** 기존 잎사귀 포인트 → 코인 전환 배율 (잔액 그대로 이관) */
export const LEAF_TO_COIN_RATE = 1

export interface CoinSession {
  /** 감지 가능했던 집중 시간(분) */
  focusMin: number
  /** 회복 성공 횟수 (상한은 함수가 적용합니다) */
  recoveries: number
}

/** 세션 1회에서 나오는 코인 */
export function sessionCoins({ focusMin, recoveries }: CoinSession): number {
  const minutes = Math.max(0, Math.floor(focusMin))
  const rewarded = Math.min(
    Math.max(0, Math.floor(recoveries)),
    COIN_RULES.maxRewardedRecoveries,
  )
  const completion =
    minutes >= COIN_RULES.completionMinMinutes ? COIN_EARN.sessionCompleted : 0

  return minutes * COIN_EARN.perMinute + rewarded * COIN_EARN.recovery + completion
}

export interface DailyCoinResult {
  /** 상한 적용 후 실제 지급 코인 */
  earned: number
  /** 상한 적용 전 원 획득량 — XP 는 이 값을 씁니다 */
  raw: number
  /** 상한에 걸려 깎였는지 */
  capped: boolean
}

/** 하루치 코인 — 첫 세션·연속 출석 보너스와 하루 상한까지 반영 */
export function dailyCoins(
  sessions: CoinSession[],
  options: { streakActive?: boolean } = {},
): DailyCoinResult {
  if (sessions.length === 0) {
    return { earned: 0, raw: 0, capped: false }
  }

  const raw =
    sessions.reduce((sum, s) => sum + sessionCoins(s), 0) +
    COIN_EARN.firstSessionOfDay +
    (options.streakActive ? COIN_EARN.streakDaily : 0)

  const earned = Math.min(raw, COIN_RULES.dailyCap)
  return { earned, raw, capped: earned < raw }
}

/** 하루 평균 획득량으로 목표 금액까지 며칠 걸리는지 */
export function daysToAfford(coinsPerDay: number, price: number): number {
  if (coinsPerDay <= 0) return Infinity
  return Math.ceil(price / coinsPerDay)
}

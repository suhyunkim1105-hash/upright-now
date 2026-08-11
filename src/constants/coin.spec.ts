import { describe, expect, it } from 'vitest'
import {
  COIN_EARN,
  COIN_PRICES,
  COIN_RULES,
  REPRESENTATIVE_CLOTHING_PRICE,
  dailyCoins,
  daysToAfford,
  sessionCoins,
} from './coin'

/**
 * docs/economy/COIN_ECONOMY.md 의 시뮬레이션 표와 코드가 어긋나지 않는지 확인합니다.
 * 표를 고치면 이 테스트가 먼저 깨져야 합니다.
 */

/** 문서가 쓰는 표준 세션: 25분 집중 + 회복 3회 */
const TYPICAL = { focusMin: 25, recoveries: 3 }

describe('코인 획득 — 세션 단위', () => {
  it('표준 25분 세션(회복 3회)은 95코인', () => {
    // 25분×2 + 회복 3×5 + 완주 30
    expect(sessionCoins(TYPICAL)).toBe(95)
  })

  it('회복을 최대로 해도 세션당 5회까지만 인정한다', () => {
    expect(sessionCoins({ focusMin: 25, recoveries: 5 })).toBe(105)
    expect(sessionCoins({ focusMin: 25, recoveries: 20 })).toBe(105)
    expect(COIN_RULES.maxRewardedRecoveries).toBe(5)
  })

  it('25분 미만 세션에는 완주 보너스가 없다', () => {
    expect(sessionCoins({ focusMin: 15, recoveries: 3 })).toBe(45)
    expect(sessionCoins({ focusMin: 24, recoveries: 0 })).toBe(48)
    expect(sessionCoins({ focusMin: 25, recoveries: 0 })).toBe(80)
  })

  it('50분 1회(155)가 25분 2회(190)보다 적다 — 문서 §5 밸런스 문제 2', () => {
    const long = sessionCoins({ focusMin: 50, recoveries: 5 })
    const twoShort = sessionCoins({ focusMin: 25, recoveries: 5 }) * 2
    expect(long).toBe(155)
    expect(twoShort).toBe(210)
    expect(long).toBeLessThan(twoShort)
  })

  it('음수·소수 입력에도 값이 새지 않는다', () => {
    expect(sessionCoins({ focusMin: -10, recoveries: -3 })).toBe(0)
    expect(sessionCoins({ focusMin: 25.9, recoveries: 3.9 })).toBe(95)
  })
})

describe('코인 획득 — 하루 단위 (문서 §4 표 A)', () => {
  const daily = (count: number) =>
    dailyCoins(Array.from({ length: count }, () => TYPICAL), { streakActive: true })

  it('하루 1·2세션은 상한에 걸리지 않는다', () => {
    expect(daily(1)).toEqual({ earned: 125, raw: 125, capped: false })
    expect(daily(2)).toEqual({ earned: 220, raw: 220, capped: false })
  })

  it('하루 3세션은 상한 300에 걸린다 — 문서 §5 밸런스 문제 1', () => {
    expect(daily(3)).toEqual({ earned: 300, raw: 315, capped: true })
  })

  it('회복을 최대로 한 3세션은 45코인이 증발한다', () => {
    const heavy = dailyCoins(
      Array.from({ length: 3 }, () => ({ focusMin: 25, recoveries: 5 })),
      { streakActive: true },
    )
    expect(heavy).toEqual({ earned: 300, raw: 345, capped: true })
  })

  it('연속 출석이 끊기면 하루 10코인이 빠진다', () => {
    expect(dailyCoins([TYPICAL], { streakActive: false }).earned).toBe(115)
  })

  it('세션이 없으면 첫 세션·출석 보너스도 없다', () => {
    expect(dailyCoins([], { streakActive: true })).toEqual({
      earned: 0,
      raw: 0,
      capped: false,
    })
  })
})

describe('구매까지 걸리는 날 (문서 §4 표 B — 단일 목표 저축)', () => {
  const perDay = { light: 125, medium: 220, heavy: 300 }

  it('첫 옷 (대표가 200)', () => {
    expect(daysToAfford(perDay.light, REPRESENTATIVE_CLOTHING_PRICE)).toBe(2)
    expect(daysToAfford(perDay.medium, REPRESENTATIVE_CLOTHING_PRICE)).toBe(1)
    expect(daysToAfford(perDay.heavy, REPRESENTATIVE_CLOTHING_PRICE)).toBe(1)
  })

  it('첫 캐릭터 알 (800)', () => {
    expect(daysToAfford(perDay.light, COIN_PRICES.eggCommon)).toBe(7)
    expect(daysToAfford(perDay.medium, COIN_PRICES.eggCommon)).toBe(4)
    expect(daysToAfford(perDay.heavy, COIN_PRICES.eggCommon)).toBe(3)
  })

  it('레어 알 (2000)', () => {
    expect(daysToAfford(perDay.light, COIN_PRICES.eggRare)).toBe(16)
    expect(daysToAfford(perDay.medium, COIN_PRICES.eggRare)).toBe(10)
    expect(daysToAfford(perDay.heavy, COIN_PRICES.eggRare)).toBe(7)
  })

  it('시즌 한정(1500)은 하루 1세션 이용자에게 12일 — 시즌 14일에 거의 맞닿는다', () => {
    expect(daysToAfford(perDay.light, COIN_PRICES.seasonLimited)).toBe(12)
    expect(daysToAfford(perDay.medium, COIN_PRICES.seasonLimited)).toBe(7)
    expect(daysToAfford(perDay.heavy, COIN_PRICES.seasonLimited)).toBe(5)
  })
})

describe('구매까지 걸리는 날 (문서 §4 표 C — 옷 → 알 → 레어 순차 구매)', () => {
  const cumulative = {
    clothing: REPRESENTATIVE_CLOTHING_PRICE, // 200
    egg: REPRESENTATIVE_CLOTHING_PRICE + COIN_PRICES.eggCommon, // 1000
    rare: REPRESENTATIVE_CLOTHING_PRICE + COIN_PRICES.eggCommon + COIN_PRICES.eggRare, // 3000
  }

  it('누적 목표액이 200 / 1000 / 3000 이다', () => {
    expect(cumulative).toEqual({ clothing: 200, egg: 1000, rare: 3000 })
  })

  it('하루 1세션 — 2일 / 8일 / 24일', () => {
    expect(daysToAfford(125, cumulative.clothing)).toBe(2)
    expect(daysToAfford(125, cumulative.egg)).toBe(8)
    expect(daysToAfford(125, cumulative.rare)).toBe(24)
  })

  it('하루 2세션 — 1일 / 5일 / 14일', () => {
    expect(daysToAfford(220, cumulative.clothing)).toBe(1)
    expect(daysToAfford(220, cumulative.egg)).toBe(5)
    expect(daysToAfford(220, cumulative.rare)).toBe(14)
  })

  it('하루 3세션 — 1일 / 4일 / 10일', () => {
    expect(daysToAfford(300, cumulative.clothing)).toBe(1)
    expect(daysToAfford(300, cumulative.egg)).toBe(4)
    expect(daysToAfford(300, cumulative.rare)).toBe(10)
  })
})

describe('확정 수치가 문서와 같은지', () => {
  it('획득 규칙', () => {
    expect(COIN_EARN).toEqual({
      perMinute: 2,
      recovery: 5,
      sessionCompleted: 30,
      streakDaily: 10,
      firstSessionOfDay: 20,
    })
    expect(COIN_RULES.dailyCap).toBe(300)
    expect(COIN_RULES.completionMinMinutes).toBe(25)
  })

  it('가격표', () => {
    expect(COIN_PRICES.top).toEqual([150, 250])
    expect(COIN_PRICES.bottom).toEqual([150, 250])
    expect(COIN_PRICES.shoes).toEqual([150, 250])
    expect(COIN_PRICES.hat).toEqual([100, 200])
    expect(COIN_PRICES.glasses).toEqual([100, 200])
    expect(COIN_PRICES.eggCommon).toBe(800)
    expect(COIN_PRICES.eggRare).toBe(2000)
    expect(COIN_PRICES.seasonLimited).toBe(1500)
  })

  it('스트레칭 보상 항목은 존재하지 않는다', () => {
    expect(Object.keys(COIN_EARN)).not.toContain('stretch')
  })
})

import { describe, expect, it } from 'vitest'
import {
  COIN_EARN,
  COIN_RULES,
  SESSION_COMPLETION_TIERS,
  STREAK_MILESTONES,
  completionCoins,
  sessionCoins,
  streakMilestoneCoins,
} from './coin'

/**
 * 연우안(코인 단일화) 수치가 코드와 어긋나지 않는지 확인합니다.
 * 이 표는 서버 함수(world_finish_session·world_earn_minigame)와
 * 월드 프로토타입에도 복제돼 있습니다 — 값을 바꾸면 셋 다 바꾸세요.
 */

describe('완주 구간', () => {
  it('5~14분 10 / 15~29분 30 / 30~49분 40 / 50분~ 60', () => {
    expect(completionCoins(4)).toBe(0)
    expect(completionCoins(5)).toBe(10)
    expect(completionCoins(14)).toBe(10)
    expect(completionCoins(15)).toBe(30)
    expect(completionCoins(29)).toBe(30)
    expect(completionCoins(30)).toBe(40)
    expect(completionCoins(49)).toBe(40)
    expect(completionCoins(50)).toBe(60)
    expect(completionCoins(120)).toBe(60)
    expect(completionCoins(300)).toBe(60) // 120분 초과도 최고 구간 값
  })

  it('음수·소수 입력에도 값이 새지 않는다', () => {
    expect(completionCoins(-10)).toBe(0)
    expect(sessionCoins({ focusMin: -10, recoveries: -3 })).toBe(0)
    expect(sessionCoins({ focusMin: 15.9, recoveries: 2.9 })).toBe(40) // 15분 구간 30 + 회복 2×5
  })
})

describe('회복 보상', () => {
  it('회복은 +5, 세션당 5회까지만 인정한다', () => {
    expect(COIN_EARN.recovery).toBe(5)
    expect(COIN_RULES.maxRewardedRecoveries).toBe(5)
    expect(sessionCoins({ focusMin: 30, recoveries: 5 })).toBe(65)
    expect(sessionCoins({ focusMin: 30, recoveries: 20 })).toBe(65)
  })
})

describe('출석 마일스톤', () => {
  it('3일10 / 7일25 / 14일50 / 30일100 / 60일180, 그 외 0', () => {
    expect(streakMilestoneCoins(3)).toBe(10)
    expect(streakMilestoneCoins(7)).toBe(25)
    expect(streakMilestoneCoins(14)).toBe(50)
    expect(streakMilestoneCoins(30)).toBe(100)
    expect(streakMilestoneCoins(60)).toBe(180)
    expect(streakMilestoneCoins(2)).toBe(0)
    expect(streakMilestoneCoins(61)).toBe(0)
  })
})

describe('상한과 단건 보상', () => {
  it('하루 상한 300, 목표·공동 완주 각 +10, 미니게임 +10', () => {
    expect(COIN_RULES.dailyCap).toBe(300)
    expect(COIN_EARN.dailyGoal).toBe(10)
    expect(COIN_EARN.coCompletion).toBe(10)
    expect(COIN_EARN.minigame).toBe(10)
  })

  it('하루에 벌 수 있는 최대 단일 세션 보상이 상한을 넘지 않는다', () => {
    // 최장 완주 60 + 회복 25 + 마일스톤 최대 180 = 265 < 300
    const max = SESSION_COMPLETION_TIERS[0].points +
      COIN_RULES.maxRewardedRecoveries * COIN_EARN.recovery +
      STREAK_MILESTONES[STREAK_MILESTONES.length - 1].points
    expect(max).toBeLessThanOrEqual(COIN_RULES.dailyCap)
  })
})

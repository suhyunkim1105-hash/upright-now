import { beforeEach, describe, expect, it } from 'vitest'
import {
  computeStreak,
  STREAK_MILESTONES,
  streakRewardEventType,
} from './streak'
import { useProgressionStore } from './progressionStore'
import { dayDiff, kstDateKey } from '@/lib/time/kst'

describe('KST 날짜', () => {
  it('kstDateKey 는 YYYY-MM-DD 형식이다', () => {
    expect(kstDateKey(Date.parse('2026-07-27T03:00:00+09:00'))).toBe('2026-07-27')
    // UTC 로는 전날 저녁이어도 KST 기준 날짜를 돌려준다
    expect(kstDateKey(Date.parse('2026-07-26T16:00:00Z'))).toBe('2026-07-27')
  })

  it('dayDiff 는 KST 자정 기준 일수 차이를 돌려준다', () => {
    expect(dayDiff('2026-07-26', '2026-07-27')).toBe(1)
    expect(dayDiff('2026-07-27', '2026-07-27')).toBe(0)
  })
})

describe('연속 출석 계산', () => {
  it('오늘로 끝나는 연속 구간을 센다', () => {
    const info = computeStreak(['2026-07-25', '2026-07-26', '2026-07-27'], '2026-07-27')
    expect(info.current).toBe(3)
    expect(info.best).toBe(3)
    expect(info.next?.days).toBe(5)
    expect(info.next?.remaining).toBe(2)
  })

  it('하루 건너뛰면 현재 streak 은 끊기지만 최고 기록은 남는다', () => {
    const info = computeStreak(
      ['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-25'],
      '2026-07-27',
    )
    expect(info.current).toBe(0)
    expect(info.best).toBe(3)
  })

  it('어제까지의 streak 은 오늘 세션 전까지 유지된 것으로 본다', () => {
    const info = computeStreak(['2026-07-25', '2026-07-26'], '2026-07-27')
    expect(info.current).toBe(2)
  })
})

describe('마일스톤 보너스', () => {
  beforeEach(() => {
    useProgressionStore.getState().reset()
  })

  it('같은 claimKey 는 두 번 지급되지 않는다', () => {
    const p = useProgressionStore.getState()
    const before = p.points
    expect(p.grantStreakBonus('streak-3:2026-07-27', 20)).toBe(true)
    expect(useProgressionStore.getState().points).toBe(before + 20)
    expect(
      useProgressionStore.getState().grantStreakBonus('streak-3:2026-07-27', 20),
    ).toBe(false)
    expect(useProgressionStore.getState().points).toBe(before + 20)
  })

  it('7일 배지는 한 번만 추가되고 포인트는 지급된다', () => {
    const g = useProgressionStore.getState()
    g.grantStreakBonus('streak-7:2026-07-27', 50, 'streak-7')
    g.grantStreakBonus('streak-7:2026-08-10', 50, 'streak-7')
    const s = useProgressionStore.getState()
    expect(s.badges.filter((b) => b === 'streak-7')).toHaveLength(1)
    expect(s.points).toBe(100)
  })

  it('마일스톤 표는 스펙과 일치한다', () => {
    expect(STREAK_MILESTONES.map((m) => [m.days, m.points])).toEqual([
      [3, 20],
      [5, 30],
      [7, 50],
      [14, 80],
      [30, 150],
    ])
  })

  it('마일스톤을 서버 원장 이벤트 타입으로 변환한다', () => {
    expect(streakRewardEventType(3)).toBe('streak_3')
    expect(streakRewardEventType(30)).toBe('streak_30')
    expect(streakRewardEventType(4)).toBeNull()
  })
})

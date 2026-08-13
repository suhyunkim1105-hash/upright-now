import { dayDiff } from '@/lib/time/kst'

/** 연속 출석 마일스톤 — 포인트만 지급, 놓쳐도 기존 보상은 차감하지 않음 */
export const STREAK_MILESTONES = [
  { days: 3, points: 20, badge: false },
  { days: 5, points: 30, badge: false },
  { days: 7, points: 50, badge: true },
  { days: 14, points: 80, badge: false },
  { days: 30, points: 150, badge: true },
] as const

export type StreakRewardEventType =
  | 'streak_3'
  | 'streak_5'
  | 'streak_7'
  | 'streak_14'
  | 'streak_30'

/** 출석 마일스톤을 서버 보상 원장의 고정 이벤트 타입으로 변환합니다. */
export function streakRewardEventType(days: number): StreakRewardEventType | null {
  if (days === 3 || days === 5 || days === 7 || days === 14 || days === 30) {
    return `streak_${days}` as StreakRewardEventType
  }
  return null
}

export interface StreakInfo {
  current: number
  best: number
  next: { days: number; points: number; remaining: number } | null
}

/** KST dateKey 목록에서 현재/최고 연속 출석과 다음 마일스톤을 계산합니다. */
export function computeStreak(attendance: string[], todayKey: string): StreakInfo {
  const days = [...new Set(attendance)].sort()
  if (days.length === 0) return { current: 0, best: 0, next: nextOf(0) }

  let best = 1
  let run = 1
  for (let i = 1; i < days.length; i += 1) {
    run = dayDiff(days[i - 1], days[i]) === 1 ? run + 1 : 1
    if (run > best) best = run
  }

  // current: 오늘(또는 어제)에 끝나는 연속 구간
  const last = days[days.length - 1]
  const gap = dayDiff(last, todayKey)
  let current = 0
  if (gap === 0 || gap === 1) {
    current = 1
    for (let i = days.length - 1; i > 0; i -= 1) {
      if (dayDiff(days[i - 1], days[i]) === 1) current += 1
      else break
    }
  }
  return { current, best: Math.max(best, current), next: nextOf(current) }
}

function nextOf(current: number): StreakInfo['next'] {
  const upcoming = STREAK_MILESTONES.find((m) => m.days > current)
  if (!upcoming) return null
  return {
    days: upcoming.days,
    points: upcoming.points,
    remaining: upcoming.days - current,
  }
}

import type { CampusSeason } from './types'

/** 시즌은 UTC 기준 달력 분기(1~3월, 4~6월, 7~9월, 10~12월)입니다. */
export function seasonIndexAt(now: number): number {
  const date = new Date(now)
  const year = date.getUTCFullYear()
  const quarter = Math.floor(date.getUTCMonth() / 3)
  return Math.max(0, (year - 2026) * 4 + quarter)
}

export function seasonAt(now: number): CampusSeason {
  const date = new Date(now)
  const year = date.getUTCFullYear()
  const quarter = Math.floor(date.getUTCMonth() / 3)
  const startsAt = Date.UTC(year, quarter * 3, 1)
  const endsAt = Date.UTC(year, quarter * 3 + 3, 1)
  return {
    id: `season-${year}-q${quarter + 1}`,
    name: `${year}년 ${quarter + 1}분기`,
    startsAt,
    endsAt,
    status: 'active',
  }
}

export function seasonRemainingMs(season: CampusSeason, now: number): number {
  return Math.max(0, season.endsAt - now)
}

/** `3일 4시간` 형태 — 초 단위까지 내려가지 않게 해서 불필요한 리렌더를 줄입니다. */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return '종료'
  const totalMinutes = Math.floor(ms / 60_000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}일 ${hours}시간`
  if (hours > 0) return `${hours}시간 ${minutes}분`
  return `${minutes}분`
}

export function formatSeasonRange(season: CampusSeason): string {
  const fmt = (value: number) =>
    new Date(value).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
  return `${fmt(season.startsAt)} ~ ${fmt(season.endsAt)}`
}

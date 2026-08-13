import { useEffect, useMemo } from 'react'
import { initCampus, refreshCampus, setCampusScreenOpen, useCampusStore } from './campusStore'
import { useCampusThemeStore } from './campusThemeStore'
import { rankStandings } from './contribution'
import { seasonAt } from './season'
import { createSeasonMap } from './campusMap'
import type { CampusSnapshot } from './types'

/**
 * 캠퍼스 화면 공통 진입 훅.
 *
 * 저장소를 준비하고(mock 기본), 실시간 갱신을 켜고, 화면에 필요한 파생값을 만듭니다.
 * 저장소 종류(mock/supabase)는 화면이 알 필요가 없습니다.
 */
export function useCampusScreen() {
  const status = useCampusStore((s) => s.status)
  const source = useCampusStore((s) => s.source)
  const stored = useCampusStore((s) => s.snapshot)
  const errorMessage = useCampusStore((s) => s.errorMessage)
  const realtimeStatus = useCampusStore((s) => s.realtimeStatus)
  const pendingContributionCount = useCampusStore((s) => s.pendingContributionCount)
  const lastAcceptedAt = useCampusStore((s) => s.lastAcceptedAt)
  const lastSyncedAt = useCampusStore((s) => s.lastSyncedAt)
  const verification = useCampusStore((s) => s.verification)
  const recentBattleEvents = useCampusStore((s) => s.recentBattleEvents)
  const schoolId = useCampusThemeStore((s) => s.schoolId)

  useEffect(() => {
    void initCampus()
  }, [schoolId])

  // 캠퍼스 화면이 열려 있는 동안만 Realtime 미연결 폴백 polling 이 돕니다.
  useEffect(() => {
    setCampusScreenOpen(true)
    return () => setCampusScreenOpen(false)
  }, [])

  // 첫 로딩 중에도 레이아웃이 흔들리지 않도록 빈 지도를 씁니다.
  const snapshot: CampusSnapshot = useMemo(() => {
    if (stored) return stored
    const now = Date.now()
    const season = seasonAt(now)
    return {
      season,
      tiles: createSeasonMap(season.id, now),
      standings: [],
      tileEvents: [],
      myContribution: 0,
      archived: [],
    }
  }, [stored])

  // Realtime 이벤트가 없는 상태에서도 시즌 경계 직후 새 지도·최종 기록을
  // 가져옵니다. 화면을 계속 열어 둔 사용자도 다음 시즌으로 자동 전환됩니다.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const delay = Math.max(1_000, snapshot.season.endsAt - Date.now() + 1_000)
    const timer = window.setTimeout(() => {
      void refreshCampus()
    }, delay)
    return () => window.clearTimeout(timer)
  }, [snapshot.season.id, snapshot.season.endsAt])

  const myTiles = useMemo(
    () =>
      schoolId ? snapshot.tiles.filter((t) => t.ownerSchoolId === schoolId).length : 0,
    [snapshot.tiles, schoolId],
  )

  const standings = useMemo(() => rankStandings(snapshot.standings), [snapshot.standings])

  return {
    status,
    source,
    snapshot,
    standings,
    myTiles,
    schoolId,
    errorMessage,
    realtimeStatus,
    pendingContributionCount,
    lastAcceptedAt,
    lastSyncedAt,
    verification,
    recentBattleEvents,
  }
}

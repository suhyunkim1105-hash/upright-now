import type { CampusBattleScene, CampusTileEvent } from './types'

export const CAMPUS_BATTLE_DURATION_MS = 3000

/**
 * 초기 스냅샷의 과거 이벤트는 재생하지 않고, 이후 새로 들어온 이벤트만
 * 클라이언트 전투 장면으로 변환합니다.
 */
export function newBattleScenes(
  previous: CampusTileEvent[],
  next: CampusTileEvent[],
  initialized: boolean,
  now: number,
): CampusBattleScene[] {
  if (!initialized) return []

  const previousIds = new Set(previous.map((event) => event.id))
  const seen = new Set<string>()
  return next
    .filter((event) => !previousIds.has(event.id) && !seen.has(event.id))
    .sort((a, b) => a.at - b.at)
    .map((event) => {
      seen.add(event.id)
      return {
        eventId: event.id,
        tileId: event.tileId,
        attackerSchoolId: event.toSchoolId,
        defenderSchoolId: event.fromSchoolId,
        startedAt: now,
        expiresAt: now + CAMPUS_BATTLE_DURATION_MS,
      }
    })
}

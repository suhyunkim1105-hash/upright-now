import { describe, expect, it } from 'vitest'
import { newBattleScenes } from './battle'
import type { CampusTileEvent } from './types'

const events: CampusTileEvent[] = [
  {
    id: 'event-1',
    seasonId: 'season-1',
    tileId: 'tile-1',
    kind: 'contested',
    fromSchoolId: 'hanyang',
    toSchoolId: 'yonsei',
    at: 900,
  },
  {
    id: 'event-2',
    seasonId: 'season-1',
    tileId: 'tile-2',
    kind: 'captured',
    fromSchoolId: null,
    toSchoolId: 'hanyang',
    at: 1000,
  },
]

describe('campus battle event diff', () => {
  it('does not animate the initial snapshot', () => {
    expect(newBattleScenes([], events, false, 1000)).toEqual([])
  })

  it('creates one scene for a newly received event', () => {
    const scenes = newBattleScenes([events[0]], [events[0], events[1]], true, 1000)
    expect(scenes).toEqual([
      expect.objectContaining({
        eventId: events[1].id,
        tileId: events[1].tileId,
        attackerSchoolId: events[1].toSchoolId,
        defenderSchoolId: events[1].fromSchoolId,
        startedAt: 1000,
        expiresAt: 4000,
      }),
    ])
  })

  it('does not create a second scene when the same event is replayed', () => {
    expect(newBattleScenes(events, events, true, 1000)).toEqual([])
  })

  it('deduplicates repeated new event rows in one snapshot', () => {
    expect(newBattleScenes([], [events[1], events[1]], true, 1000)).toHaveLength(1)
  })
})

import { describe, expect, it } from 'vitest'
import { battleScenesForSnapshots, newestCampusBattleEvents } from './campusStore'
import type { CampusTileEvent } from './types'

describe('newestCampusBattleEvents', () => {
  it('keeps unique server events in newest-first order', () => {
    const event = (id: string, at: number): CampusTileEvent => ({
      id, seasonId: 'season-1', tileId: 'season-1:0-0', kind: 'captured',
      fromSchoolId: null, toSchoolId: 'snu', at,
    })
    expect(newestCampusBattleEvents([event('one', 1), event('two', 2), event('one', 1)]))
      .toEqual([event('two', 2), event('one', 1)])
  })
})

describe('battleScenesForSnapshots', () => {
  const event: CampusTileEvent = {
    id: 'battle-1',
    seasonId: 'season-1',
    tileId: 'season-1:0-0',
    kind: 'contested',
    fromSchoolId: 'hanyang',
    toSchoolId: 'yonsei',
    at: 100,
  }

  it('does not animate the first snapshot', () => {
    expect(battleScenesForSnapshots([], [event], false, true, 1000)).toEqual([])
  })

  it('adds a scene only for a new event while realtime is connected', () => {
    expect(battleScenesForSnapshots([], [event], true, true, 1000)).toEqual([
      expect.objectContaining({ eventId: 'battle-1', expiresAt: 4000 }),
    ])
    expect(battleScenesForSnapshots([], [event], true, false, 1000)).toEqual([])
  })

  it('does not replay a repeated event', () => {
    expect(battleScenesForSnapshots([event], [event], true, true, 1000)).toEqual([])
  })
})

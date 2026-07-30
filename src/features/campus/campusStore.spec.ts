import { describe, expect, it } from 'vitest'
import { newestCampusBattleEvents } from './campusStore'
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

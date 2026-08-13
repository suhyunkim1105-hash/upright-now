import { CAMPUS_GRID_SEED } from './campusGridOverlay'
import type { CampusTile, CampusZoneId } from './types'

/**
 * 서울 지도 위에 얹는 12×8 영토 타일 지도.
 *
 * 실제 서울 지도나 특정 학교 부지를 복제하지 않습니다.
 * 좌표는 순수한 격자이며 지리 정보가 아닙니다.
 */
export const MAP_COLS = 12
export const MAP_ROWS = 8
export const MAP_TILE_COUNT = MAP_COLS * MAP_ROWS

interface Region {
  zone: CampusZoneId
  x0: number
  x1: number
  y0: number
  y1: number
}

/** 구역 배치 — 위쪽 강의동, 가운데 도서관·광장·카페, 아래쪽 잔디밭 */
const REGIONS: Region[] = [
  { zone: 'lecture', x0: 0, x1: 11, y0: 0, y1: 1 },
  { zone: 'library', x0: 0, x1: 4, y0: 2, y1: 4 },
  { zone: 'plaza', x0: 5, x1: 8, y0: 2, y1: 4 },
  { zone: 'cafe', x0: 9, x1: 11, y0: 2, y1: 4 },
  { zone: 'lawn', x0: 0, x1: 11, y0: 5, y1: 7 },
]

export function zoneAt(x: number, y: number): CampusZoneId {
  for (const region of REGIONS) {
    if (x >= region.x0 && x <= region.x1 && y >= region.y0 && y <= region.y1) {
      return region.zone
    }
  }
  return 'lawn'
}

export function tileId(seasonId: string, x: number, y: number): string {
  return `${seasonId}:${x}-${y}`
}

/** 구역별 기본 방어 점수 — 도서관이 가장 단단하고 잔디밭이 가장 약합니다. */
export const ZONE_BASE_DEFENSE: Record<CampusZoneId, number> = {
  library: 240,
  lecture: 180,
  plaza: 200,
  cafe: 140,
  lawn: 120,
  dorm: 160,
  field: 130,
  pond: 110,
}

/**
 * 새 시즌의 초기 지도 — 모든 타일이 중립 상태입니다.
 * zone·name 은 UI overlay·SQL seed 와 같은 campusGridSeedManifest(96)를 씁니다.
 */
export function createSeasonMap(seasonId: string, now: number): CampusTile[] {
  return CAMPUS_GRID_SEED.map((entry) => ({
    id: tileId(seasonId, entry.x, entry.y),
    seasonId,
    x: entry.x,
    y: entry.y,
    zone: entry.zone,
    name: entry.name,
    ownerSchoolId: null,
    challengerSchoolId: null,
    defenseScore: ZONE_BASE_DEFENSE[entry.zone],
    challengeScore: 0,
    updatedAt: now,
  }))
}

/** 사람이 읽을 수 있는 타일 이름 — 스크린리더 라벨에 사용합니다. */
export function tileLabel(tile: CampusTile, zoneLabel: string): string {
  return `${zoneLabel} ${tile.y + 1}행 ${tile.x + 1}열`
}

import { useMemo } from 'react'
import { useCampusStore } from '@/features/campus/campusStore'
import { useCampusThemeStore } from '@/features/campus/campusThemeStore'
import { summarizeDistricts, SEOUL_DISTRICTS } from '@/features/campus/seoulDistrictMap'
import { useSchoolIdentity, resolveSchoolIdentityNow } from '@/features/campus/schoolDirectory'
import type { CampusTile } from '@/features/campus/types'

export function useSchoolColor(): (schoolId: string | null) => string | null {
  const identify = useSchoolIdentity()
  return (schoolId) => identify(schoolId)?.color ?? null
}

export function schoolShortName(schoolId: string | null): string {
  if (!schoolId) return '중립'
  return resolveSchoolIdentityNow(schoolId)?.shortName ?? '미확인'
}

/** 서울 자치구 도형 기반 영토 지도. 기존 타일 기록은 자치구별로 합쳐 표시합니다. */
export function TerritoryMap({
  tiles,
  selectedTileId,
  onSelectTile,
  large = false,
}: {
  tiles: CampusTile[]
  selectedTileId?: string | null
  onSelectTile?: (tile: CampusTile) => void
  large?: boolean
}) {
  const flashTileIds = useCampusStore((s) => s.flashTileIds)
  const identify = useSchoolIdentity()
  const mySchoolId = useCampusThemeStore((s) => s.schoolId)
  const districts = useMemo(() => summarizeDistricts(tiles), [tiles])

  return (
    <div data-testid="territory-map" className="relative w-full min-w-0 overflow-auto" style={{ touchAction: 'pan-x pan-y pinch-zoom' }}>
      <p className="sr-only">서울 25개 자치구 기반 영토전 지도</p>
      <svg
        viewBox="0 0 600 430"
        className={large ? 'h-auto min-w-[1100px] md:min-w-[1400px]' : 'h-auto w-full'}
        aria-label="서울 자치구 기반 영토전 지도"
      >
        <rect x="0" y="0" width="600" height="430" rx="24" fill="#F8F4EA" />
        <image
          href="/assets/campus/seoul-district-map.png"
          x="38"
          y="0"
          width="524"
          height="430"
          preserveAspectRatio="none"
          aria-hidden="true"
        />
        {/* The source image supplies the district boundaries and labels. These paths are
            intentionally transparent hit areas; only occupied/contested districts are tinted. */}
        {/* GeoJSON paths use the same 480×394 coordinate space as the raster map. */}
        <g transform="matrix(1.0916667 0 0 1.0913706 38 0)">
          {districts.map((summary) => {
            const { district, representative, ownerSchoolId, challengerSchoolId } = summary
            const owner = identify(ownerSchoolId)
            const challenger = identify(challengerSchoolId)
            const progress = summary.defenseScore > 0 ? Math.min(1, summary.challengeScore / summary.defenseScore) : 0
            const selected = representative?.id === selectedTileId
            const isMine = Boolean(mySchoolId) && ownerSchoolId === mySchoolId
            const label = `${district.name}, ${owner?.shortName ?? '중립'}${challenger ? `, ${challenger.shortName} 경합` : ''}`

            return (
              <g key={district.id} data-testid="territory-district" data-district-id={district.id}>
                <path
                  d={district.path}
                  role={representative && onSelectTile ? 'button' : 'img'}
                  aria-label={label}
                  aria-pressed={representative && onSelectTile ? selected : undefined}
                  tabIndex={representative && onSelectTile ? 0 : -1}
                  onClick={() => representative && onSelectTile?.(representative)}
                  onKeyDown={(event) => {
                    if ((event.key === 'Enter' || event.key === ' ') && representative) {
                      event.preventDefault()
                      onSelectTile?.(representative)
                    }
                  }}
                  fill={challenger?.color ?? owner?.color ?? 'transparent'}
                  fillOpacity={challenger ? Math.max(0.22, 0.22 + progress * 0.5) : owner ? (isMine ? 0.34 : 0.24) : 0}
                  stroke={selected ? '#171717' : challenger ? challenger.color : owner ? owner.color : 'none'}
                  strokeWidth={selected ? 2.5 : challenger || owner ? 1.6 : 0}
                  strokeDasharray={challenger ? '7 5' : undefined}
                  className={[
                    'transition',
                    representative && onSelectTile ? 'cursor-pointer hover:brightness-105' : '',
                    summary.tiles.some((tile) => flashTileIds.includes(tile.id)) ? 'anim-campus-capture' : '',
                  ].join(' ')}
                />
                {isMine && <text x={district.labelX} y={district.labelY + 16} textAnchor="middle" fontSize="13" fill={owner?.color ?? '#171717'} pointerEvents="none">★</text>}
                {challenger && <g pointerEvents="none"><rect x={district.labelX - 23} y={district.labelY + 20} width="46" height="4" rx="2" fill="#FFFFFF" opacity="0.8" /><rect x={district.labelX - 23} y={district.labelY + 20} width={46 * progress} height="4" rx="2" fill={challenger.color} /></g>}
              </g>
            )
          })}
        </g>
        <text x="24" y="406" fontSize="12" fontWeight="700" fill="#5F594F">서울 25개 자치구 · 한강</text>
      </svg>
    </div>
  )
}

/** 학교별 점령 자치구 수를 설명하는 범례입니다. */
export function TerritoryLegend({ tiles }: { tiles: CampusTile[] }) {
  const identify = useSchoolIdentity()
  const districts = useMemo(() => summarizeDistricts(tiles), [tiles])
  const owners = useMemo(() => {
    const counts = new Map<string, number>()
    for (const district of districts) if (district.ownerSchoolId) counts.set(district.ownerSchoolId, (counts.get(district.ownerSchoolId) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [districts])
  const neutral = SEOUL_DISTRICTS.length - owners.reduce((sum, [, count]) => sum + count, 0)
  return (
    <div data-testid="territory-legend" className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-ink-soft">
      {owners.map(([schoolId, count]) => <span key={schoolId} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-3 w-3 rounded-[3px]" style={{ backgroundColor: identify(schoolId)?.color ?? '#EFE9DC' }} />{`${identify(schoolId)?.shortName ?? '미확인'} ${count}구`}</span>)}
      <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-3 w-3 rounded-[3px] border border-line bg-canvas" />{`중립 ${neutral}구`}</span>
      <span className="inline-flex items-center gap-1.5"><span aria-hidden="true">▧</span> 경합 (공격 점수로 표시)</span>
      <span className="inline-flex items-center gap-1.5"><span aria-hidden="true">★</span>내 학교 영토</span>
    </div>
  )
}

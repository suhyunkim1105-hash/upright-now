import { useMemo, useState } from 'react'
import { CAMPUS_ZONE_META } from '@/constants/campus'
import { gridCellFor, CAMPUS_GRID_CELL_COUNT } from '@/features/campus/campusGridOverlay'
import { captureProgress, tileStatus } from '@/features/campus/territory'
import { useCampusStore } from '@/features/campus/campusStore'
import { useCampusThemeStore } from '@/features/campus/campusThemeStore'
import { useSchoolIdentity, resolveSchoolIdentityNow } from '@/features/campus/schoolDirectory'
import type { CampusTile } from '@/features/campus/types'
import { CampusBattleOverlay } from './CampusBattleOverlay'

/**
 * 캠퍼스 배경 이미지의 실측 12×8 = 96칸 오버레이 지도.
 *
 * - 배경: campus-map-bg-1536.webp (viewBox 0 0 1536 1024, 좌표계 동일)
 * - 셀 quad 는 campusGridOverlay 의 정적 실측 좌표 — 흰 길 안쪽 inset
 * - 중립 칸은 배경 원본을 그대로 두고(fill ≤ 0.10), 굵은 흰 선을 다시
 *   그리지 않습니다. 점령·경합·선택만 색·표식을 얹습니다.
 * - 학교 이름·색은 schoolDirectory 단일 resolver 로만 해석합니다.
 */

/** (호환 export) 학교 id → 대표색. 디렉터리 → 프리셋 → 로컬 → 폴백 */
export function useSchoolColor(): (schoolId: string | null) => string | null {
  const identify = useSchoolIdentity()
  return (schoolId) => identify(schoolId)?.color ?? null
}

/** (호환 export) 학교 id → 짧은 표기. stable key 를 노출하지 않습니다. */
export function schoolShortName(schoolId: string | null): string {
  if (!schoolId) return '중립'
  return resolveSchoolIdentityNow(schoolId)?.shortName ?? '미확인'
}

export function TerritoryMap({
  tiles,
  selectedTileId,
  onSelectTile,
}: {
  tiles: CampusTile[]
  selectedTileId?: string | null
  onSelectTile?: (tile: CampusTile) => void
}) {
  const flashTileIds = useCampusStore((s) => s.flashTileIds)
  const activeBattleScenes = useCampusStore((s) => s.activeBattleScenes)
  const identify = useSchoolIdentity()
  const mySchoolId = useCampusThemeStore((s) => s.schoolId)

  // 탭 순서 y→x. 보관 시즌(36행)도 96칸 레이아웃을 유지하도록
  // 없는 좌표는 중립 placeholder 로 합성합니다(원본 기록 불변).
  const ordered = useMemo(() => {
    const byXY = new Map(tiles.map((t) => [`${t.x},${t.y}`, t]))
    const seasonId = tiles[0]?.seasonId ?? 'season'
    const list: CampusTile[] = []
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 12; x += 1) {
        const existing = byXY.get(`${x},${y}`)
        if (existing) {
          list.push(existing)
        } else {
          list.push({
            id: `${seasonId}:${x}-${y}`,
            seasonId,
            x,
            y,
            zone: 'lawn',
            name: `미개방 구역 ${y + 1}-${x + 1}`,
            ownerSchoolId: null,
            challengerSchoolId: null,
            defenseScore: 0,
            challengeScore: 0,
            updatedAt: 0,
          })
        }
      }
    }
    return list
  }, [tiles])

  const [bgBroken, setBgBroken] = useState(false)

  return (
    <div
      data-testid="territory-map"
      className="relative w-full min-w-0 overflow-auto"
      style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
    >
      <p className="sr-only">{`가상 캠퍼스 지도 (영토 ${CAMPUS_GRID_CELL_COUNT}곳)`}</p>
      <svg
        viewBox="0 0 1536 1024"
        className="h-auto w-full"
        aria-label="가상 캠퍼스 지도 — 12×8 격자 96개 영토"
      >
        {!bgBroken ? (
          <image
            href="/assets/campus/campus-map-bg-1536.webp"
            x="0"
            y="0"
            width="1536"
            height="1024"
            preserveAspectRatio="xMidYMid slice"
            onError={() => setBgBroken(true)}
          />
        ) : (
          // 이미지 실패 폴백 — 배경 없이도 격자와 상태는 그대로 동작
          <rect x="0" y="0" width="1536" height="1024" fill="#EAE4D3" />
        )}
        {ordered.map((tile) => {
          const cell = gridCellFor(tile)
          if (!cell) return null
          const status = tileStatus(tile)
          const owner = identify(tile.ownerSchoolId)
          const challenger = identify(tile.challengerSchoolId)
          const progress = captureProgress(tile)
          const zone = CAMPUS_ZONE_META[tile.zone]
          const isMine = Boolean(mySchoolId) && tile.ownerSchoolId === mySchoolId
          const selected = tile.id === selectedTileId
          const flashing = flashTileIds.includes(tile.id)
          const battleScene = activeBattleScenes.find((scene) => scene.tileId === tile.id) ?? null
          const battleAttacker = battleScene
            ? identify(battleScene.attackerSchoolId)
            : null
          const battleDefender = battleScene
            ? identify(battleScene.defenderSchoolId)
            : null

          const label = [
            tile.name || `${zone.label} ${tile.y + 1}행 ${tile.x + 1}열`,
            `${tile.y + 1}행 ${tile.x + 1}열`,
            `점령 ${owner?.shortName ?? '중립'}`,
            challenger ? `도전 ${challenger.shortName}` : '',
            `방어 점수 ${tile.defenseScore}`,
            status === 'contested'
              ? `경합 중 · 점령 진행도 ${Math.round(progress * 100)}%`
              : '',
            isMine ? '내 학교 영토' : '',
          ]
            .filter(Boolean)
            .join(', ')

          return (
            <g key={tile.id}>
              <polygon
                data-testid="territory-tile"
                data-tile-id={tile.id}
                data-tile-status={status}
                data-zone={tile.zone}
                data-owner={tile.ownerSchoolId ?? 'none'}
                data-challenger={tile.challengerSchoolId ?? 'none'}
                role={onSelectTile ? 'button' : 'img'}
                aria-label={label}
                aria-pressed={onSelectTile ? selected : undefined}
                tabIndex={onSelectTile ? 0 : -1}
                onClick={() => onSelectTile?.(tile)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectTile?.(tile)
                  }
                }}
                points={cell.points}
                fill={owner ? owner.color : '#FFFFFF'}
                fillOpacity={owner ? (isMine ? 0.45 : 0.3) : 0.06}
                stroke={
                  selected
                    ? '#171717'
                    : status === 'contested'
                      ? (challenger?.color ?? '#FF6464')
                      : 'transparent'
                }
                strokeWidth={selected ? 5 : status === 'contested' ? 4 : 0}
                strokeDasharray={status === 'contested' && !selected ? '14 8' : undefined}
                className={[
                  'transition',
                  flashing ? 'anim-campus-capture' : '',
                  onSelectTile ? 'cursor-pointer hover:brightness-110' : '',
                ].join(' ')}
              />
              {/* 색만으로 정보를 전달하지 않기 위한 보조 표시 */}
              {isMine && (
                <text
                  x={cell.cx}
                  y={cell.cy + 8}
                  textAnchor="middle"
                  fontSize="26"
                  fontWeight="900"
                  fill="#FFFFFF"
                  stroke="#00000033"
                  strokeWidth="1"
                  aria-hidden="true"
                  pointerEvents="none"
                >
                  ★
                </text>
              )}
              {status === 'contested' && (
                <g aria-hidden="true" pointerEvents="none">
                  <rect
                    x={cell.cx - 30}
                    y={cell.cy + 18}
                    width={60}
                    height={7}
                    rx={3.5}
                    fill="#FFFFFF"
                    fillOpacity="0.75"
                  />
                  <rect
                    x={cell.cx - 30}
                    y={cell.cy + 18}
                    width={60 * Math.max(0.05, Math.min(1, progress))}
                    height={7}
                    rx={3.5}
                    fill={challenger?.color ?? '#FF6464'}
                  />
                </g>
              )}
              <CampusBattleOverlay
                scene={battleScene}
                cell={cell}
                attacker={
                  battleAttacker
                    ? { name: battleAttacker.displayName, color: battleAttacker.color }
                    : null
                }
                defender={
                  battleDefender
                    ? { name: battleDefender.displayName, color: battleDefender.color }
                    : null
                }
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** 지도 범례 — 학교 색과 상태 표시를 함께 설명합니다. 합계는 96입니다. */
export function TerritoryLegend({ tiles }: { tiles: CampusTile[] }) {
  const identify = useSchoolIdentity()
  const owners = useMemo(() => {
    const counts = new Map<string, number>()
    for (const tile of tiles) {
      if (!tile.ownerSchoolId) continue
      counts.set(tile.ownerSchoolId, (counts.get(tile.ownerSchoolId) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [tiles])

  // 96칸 레이아웃 기준 중립 수 — 보관 시즌(36행)도 합계가 96이 되게 합니다.
  const owned = owners.reduce((sum, [, count]) => sum + count, 0)
  const neutral = CAMPUS_GRID_CELL_COUNT - owned

  return (
    <div
      data-testid="territory-legend"
      className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-ink-soft"
    >
      {owners.map(([schoolId, count]) => (
        <span key={schoolId} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-[3px]"
            style={{ backgroundColor: identify(schoolId)?.color ?? '#EFE9DC' }}
          />
          {`${identify(schoolId)?.shortName ?? '미확인'} ${count}`}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="inline-block h-3 w-3 rounded-[3px] border border-line bg-canvas"
        />
        {`중립 ${neutral}`}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="campus-tile--contested inline-block h-3 w-3 rounded-[3px] bg-canvas"
        />
        경합 (점령 진행도 80% 이상)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true">★</span>내 학교 영토
      </span>
    </div>
  )
}

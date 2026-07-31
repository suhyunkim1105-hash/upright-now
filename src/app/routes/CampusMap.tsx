import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Badge, Button, Card, CardTitle } from '@/components/ui'
import { CAMPUS_COPY, CAMPUS_ZONE_META } from '@/constants/campus'
import { ROUTES } from '@/constants/routes'
import { useCampusScreen } from '@/features/campus/useCampusScreen'
import { useCampusThemeStore } from '@/features/campus/campusThemeStore'
import {
  CampusBackdrop,
  CampusConnectionBadge,
  CampusUnofficialNotice,
} from '@/components/campus/CampusBits'
import {
  CampusCaptureLog,
  CampusSeasonBar,
  CampusStatsRow,
  CampusTileDetail,
} from '@/components/campus/CampusPanels'
import { TerritoryLegend, TerritoryMap } from '@/components/campus/TerritoryMap'
import type { CampusZoneId } from '@/features/campus/types'

/**
 * S-C2 캠퍼스 지도 — 타일을 골라 다음 기여를 어디에 넣을지 정합니다.
 * 시험기간 배경은 시즌 종료 3일 이내에 켜집니다.
 */
const EXAM_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

export function CampusMap() {
  const navigate = useNavigate()
  const { snapshot, myTiles, schoolId } = useCampusScreen()
  const targetTileId = useCampusThemeStore((s) => s.targetTileId)
  const setTargetTile = useCampusThemeStore((s) => s.setTargetTile)
  const [selectedId, setSelectedId] = useState<string | null>(targetTileId)
  const now = Date.now()

  const selected = useMemo(
    () => snapshot.tiles.find((t) => t.id === selectedId) ?? null,
    [snapshot.tiles, selectedId],
  )

  const isExamPeriod = snapshot.season.endsAt - now <= EXAM_WINDOW_MS

  const zoneCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const tile of snapshot.tiles) {
      if (tile.ownerSchoolId && tile.ownerSchoolId === schoolId) {
        counts[tile.zone] = (counts[tile.zone] ?? 0) + 1
      }
    }
    return counts
  }, [snapshot.tiles, schoolId])

  return (
    <AppShell
      rail={
        <>
          <Card className="p-4">
            <CardTitle>선택한 타일</CardTitle>
            <div className="mt-3">
              <CampusTileDetail tile={selected} />
            </div>
            {selected && (
              <Button
                size="sm"
                fullWidth
                className="mt-4"
                disabled={!schoolId}
                onClick={() => setTargetTile(selected.id)}
              >
                {targetTileId === selected.id ? '기여 대상으로 설정됨' : '기여 대상으로 설정'}
              </Button>
            )}
            {!schoolId && (
              <p className="mt-2 text-[11px] text-ink-soft">
                학교를 먼저 고르면 기여 대상을 정할 수 있어요.
              </p>
            )}
          </Card>

          <Card className="p-4">
            <CardTitle>구역별 내 영토</CardTitle>
            <ul className="mt-3 flex flex-col gap-1.5 text-xs">
              {(Object.keys(CAMPUS_ZONE_META) as CampusZoneId[]).map((zone) => (
                <li key={zone} className="flex items-center justify-between gap-2">
                  <span className="text-ink-soft">{CAMPUS_ZONE_META[zone].label}</span>
                  <span className="tabular font-bold text-ink">{zoneCounts[zone] ?? 0}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      }
    >
      <PageHeader
        title="캠퍼스 지도"
        description="자체 제작한 12×8 가상 캠퍼스예요. 실제 지도나 학교 부지를 복제하지 않았어요."
        action={
          <div className="flex items-center gap-2">
            {isExamPeriod && <Badge tone="yellow">시험기간 배경</Badge>}
            <CampusConnectionBadge />
            <Button size="sm" variant="secondary" onClick={() => navigate(ROUTES.campus)}>
              캠퍼스로
            </Button>
          </div>
        }
      />

      <Card className="mb-4">
        <CampusStatsRow snapshot={snapshot} myTiles={myTiles} now={now} />
        <div className="mt-4">
          <CampusSeasonBar season={snapshot.season} now={now} />
        </div>
      </Card>

      <CampusBackdrop kind="plain" className="mb-4 rounded-card">
        <Card>
          <CardTitle>영토 지도</CardTitle>
          <p className="mt-1 text-xs text-ink-soft">
            타일을 누르면 현재 점령 학교와 점령 진행도를 볼 수 있어요.
          </p>
          <div className="mt-4">
            <TerritoryMap
              tiles={snapshot.tiles}
              selectedTileId={selectedId}
              onSelectTile={(tile) => setSelectedId(tile.id)}
              large
            />
          </div>
          <div className="mt-3">
            <TerritoryLegend tiles={snapshot.tiles} />
          </div>
        </Card>
      </CampusBackdrop>

      <div className="grid grid-cols-1 gap-4 @[900px]:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardTitle>최근 영토 변화</CardTitle>
          <div className="mt-3">
            <CampusCaptureLog events={snapshot.tileEvents} tiles={snapshot.tiles} limit={10} />
          </div>
        </Card>
        <CampusUnofficialNotice
          lines={[
            CAMPUS_COPY.unofficialGame,
            CAMPUS_COPY.mockNotice,
            CAMPUS_COPY.schoolChangeContribution,
          ]}
        />
      </div>
    </AppShell>
  )
}

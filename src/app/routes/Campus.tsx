import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { Button, Card, CardTitle } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { CAMPUS_COPY } from '@/constants/campus'
import { ROUTES } from '@/constants/routes'
import { useCampusScreen } from '@/features/campus/useCampusScreen'
import { previewCampusBattleScene } from '@/features/campus/campusStore'
import { useCampusTheme } from '@/features/campus/campusThemeStore'
import {
  CampusBackdrop,
  CampusConnectionBadge,
  CampusSchoolBadge,
  CampusUnofficialNotice,
} from '@/components/campus/CampusBits'
import {
  CampusCaptureLog,
  CampusContributionRules,
  CampusSeasonBar,
  CampusStandingsTable,
  CampusStatsRow,
} from '@/components/campus/CampusPanels'
import { TerritoryLegend, TerritoryMap } from '@/components/campus/TerritoryMap'
import { SchoolPicker } from '@/components/campus/SchoolPicker'
import { SchoolVerification } from '@/components/campus/SchoolVerification'
import { captureProgress, tileStatus } from '@/features/campus/territory'
import { useSchoolIdentity } from '@/features/campus/schoolDirectory'

function CampusCompetitionSummary({
  tiles,
}: {
  tiles: ReturnType<typeof useCampusScreen>['snapshot']['tiles']
}) {
  const identify = useSchoolIdentity()
  const contested = useMemo(
    () => tiles.filter((tile) => tileStatus(tile) === 'contested'),
    [tiles],
  )

  return (
    <div
      data-testid="campus-competition-summary"
      className="mt-3 rounded-2xl border border-line bg-canvas px-3 py-2.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-ink">
          <span
            aria-hidden="true"
            className={[
              'inline-block h-2.5 w-2.5 rounded-full',
              contested.length > 0 ? 'animate-pulse bg-coral' : 'bg-ink-soft/40',
            ].join(' ')}
          />
          {contested.length > 0 ? `현재 경합 중 ${contested.length}곳` : '현재 경합 중인 자치구 없음'}
        </div>
        <span className="text-[11px] text-ink-soft">
          {contested.length > 0 ? '공격·방어 기여가 실시간으로 반영돼요' : '기여가 쌓이면 자치구 경합으로 표시돼요'}
        </span>
      </div>

      {contested.length > 0 && (
        <div className="mt-2 grid gap-1.5 @[700px]:grid-cols-2">
          {contested.slice(0, 4).map((tile) => {
            const attacker = identify(tile.challengerSchoolId)
            const defender = identify(tile.ownerSchoolId)
            const progress = Math.round(captureProgress(tile) * 100)
            return (
              <div
                key={tile.id}
                className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-surface px-2.5 py-2 text-[11px]"
              >
                <span className="min-w-0 truncate font-semibold text-ink">
                  {tile.name || `타일 ${tile.x + 1}-${tile.y + 1}`}
                </span>
                <span className="shrink-0 text-ink-soft">
                  <span style={{ color: attacker?.color ?? '#FF6464' }}>
                    {attacker?.shortName ?? '공격 학교'}
                  </span>
                  {' vs '}
                  <span style={{ color: defender?.color ?? '#8C867A' }}>
                    {defender?.shortName ?? '중립'}
                  </span>
                  {` · ${progress}%`}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {contested.length > 4 && (
        <p className="mt-1 text-[10px] text-ink-soft">{`외 ${contested.length - 4}곳의 경합도 진행 중이에요.`}</p>
      )}
    </div>
  )
}

/**
 * S-C1 캠퍼스 — 내 학교 · 이번 시즌 · 점령 타일 수 · 내 기여도 · 실시간 지도 ·
 * 최근 점령 로그 · 학교 변경 안내 · 비공식 프로토타입 안내.
 *
 * 대학 인증이 없으므로 공식 대항전으로 읽히는 표현을 쓰지 않습니다.
 */
export function Campus() {
  const navigate = useNavigate()
  const theme = useCampusTheme()
  const {
    snapshot,
    standings,
    myTiles,
    schoolId,
    source,
    pendingContributionCount,
    lastAcceptedAt,
    verification,
    recentBattleEvents,
  } = useCampusScreen()
  const now = Date.now()

  return (
    <AppShell
      rail={
        <>
          <Card className="p-4">
            <CardTitle>학교 선택</CardTitle>
            <p className="mt-1 text-xs text-ink-soft">{CAMPUS_COPY.schoolChangeNotice}</p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => navigate(ROUTES.settings)}
            >
              <Icon name="settings" size={16} />
              설정에서 바꾸기
            </Button>
          </Card>

          <CampusContributionRules />

          <Card className="p-4">
            <CardTitle>데이터 출처</CardTitle>
            <p className="mt-2 text-xs text-ink-soft">
              {source === 'supabase'
                ? '이 화면은 Supabase 저장소를 사용하고 있어요.'
                : CAMPUS_COPY.mockNotice}
            </p>
            <p className="mt-1 text-[11px] text-ink-soft">{CAMPUS_COPY.privacy}</p>
          </Card>
        </>
      }
    >
      <PageHeader
        title="캠퍼스"
        description="학교 테마와 가상 캠퍼스 영토전을 확인해요. 비공식 게임형 프로토타입이에요."
        action={
          <div className="flex items-center gap-2">
            {theme && <CampusSchoolBadge theme={theme} showColorSource />}
            <CampusConnectionBadge />
          </div>
        }
      />

      <CampusUnofficialNotice className="mb-4" />

      {!schoolId ? (
        <Card className="mb-4">
          <CardTitle>먼저 학교를 골라 주세요</CardTitle>
          <p className="mt-1 text-sm text-ink-soft">
            학교를 고르면 테마 색과 영토전 기여가 시작돼요.
          </p>
          <div className="mt-4">
            <SchoolPicker />
          </div>
        </Card>
      ) : (
        <>
          {source === 'supabase' && schoolId && !schoolId.startsWith('custom-') && verification?.schoolId !== schoolId && theme && (
            <SchoolVerification schoolId={schoolId} schoolName={theme.schoolName} />
          )}
          <Card className="mb-4">
            <CampusStatsRow snapshot={snapshot} myTiles={myTiles} now={now} />
            <div className="mt-4">
              <CampusSeasonBar season={snapshot.season} now={now} />
            </div>
            {/* 권위 총점 옆에 대기·최근 반영 상태를 함께 보여 줍니다(§5-E). */}
            <p data-testid="campus-sync-line" className="mt-2 text-[11px] text-ink-soft">
              {pendingContributionCount > 0
                ? `연결되면 자동 반영될 기여 ${pendingContributionCount}건 · `
                : ''}
              {lastAcceptedAt
                ? `마지막 기여 반영 ${new Date(lastAcceptedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
                : source === 'supabase'
                  ? '이번 세션에서 아직 반영된 기여가 없어요'
                  : ''}
            </p>
          </Card>

          <CampusBackdrop kind="library" className="mb-4 rounded-card">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>실시간 지도</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {import.meta.env.DEV && (
                    <Button
                      size="sm"
                      variant="soft"
                      data-testid="campus-battle-preview"
                      onClick={() => previewCampusBattleScene(snapshot.tiles[0]?.id)}
                    >
                      전투 연출 미리보기
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => navigate(ROUTES.campusMap)}>
                    크게 보기
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                서울 25개 자치구와 한강을 바탕으로 만든 영토전 베이스예요. 실제 행정경계를 복제하지 않은 프로토타입이에요.
              </p>
              <CampusCompetitionSummary tiles={snapshot.tiles} />
              <div className="mt-4">
                <TerritoryMap tiles={snapshot.tiles} />
              </div>
              <div className="mt-3">
                <TerritoryLegend tiles={snapshot.tiles} />
              </div>
            </Card>
          </CampusBackdrop>

          <div className="grid grid-cols-1 gap-4 @[900px]:grid-cols-2">
            <Card>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>실시간 영토전 소식</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(ROUTES.campusHistory)}
                >
                  전체 보기
                </Button>
              </div>
              <div className="mt-3">
                {/* 점령·경합만 — 방어 보강은 전체 기록(/campus/history)에서 봅니다. */}
                <CampusCaptureLog
                  events={recentBattleEvents}
                  tiles={snapshot.tiles}
                  emptyDescription="아직 영토 변화가 없어요. 인증된 학교 이메일로 참여하면 실시간으로 표시돼요."
                />
              </div>
            </Card>

            <Card>
              <CardTitle>학교별 기여도</CardTitle>
              <p className="mt-1 text-xs text-ink-soft">
                총 기여도와 규모 보정 점수를 함께 봐요. 공식 순위가 아니에요.
              </p>
              <div className="mt-3">
                <CampusStandingsTable standings={standings} mySchoolId={schoolId} />
              </div>
            </Card>
          </div>
        </>
      )}
    </AppShell>
  )
}

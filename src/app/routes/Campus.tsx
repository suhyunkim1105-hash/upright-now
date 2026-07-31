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
                자체 제작한 12×8 가상 캠퍼스예요. 실제 지도나 학교 부지를 옮겨 놓은 것이 아니에요.
              </p>
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

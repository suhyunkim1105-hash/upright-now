import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { CharacterViewport } from '@/components/character/CharacterViewport'
import { CharacterWithGear } from '@/components/character/CharacterWithGear'
import { GrowthTimeline } from '@/components/character/GrowthTimeline'
import { AttendanceCalendar } from '@/components/dashboard/AttendanceCalendar'
import { PostureStatusBadge } from '@/components/posture/PostureStatusBadge'
import { RecoveryCombo } from '@/components/session/SessionBits'
import {
  Button,
  Card,
  EmptyState,
  SegmentedControl,
} from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { SESSION_LENGTHS } from '@/constants/session'
import { POSTURE_COPY } from '@/constants/copy'
import { ROUTES } from '@/constants/routes'
import { useUserStore } from '@/features/onboarding/userStore'
import {
  useCharacterStage,
  useProgressionStore,
} from '@/features/progression/progressionStore'
import { useGameStore } from '@/features/game/gameStore'
import { usePostureStore } from '@/features/posture-engine/postureStore'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { formatDuration } from '@/features/sessions/sessionMachine'
import { useSessionHistoryStore } from '@/features/sessions/sessionHistoryStore'
import {
  formatFocusClock,
  selectSessionStats,
  selectTodayFocus,
} from '@/features/sessions/todayFocus'
import { CampusDashboardCard } from '@/components/campus/CampusDashboardCard'
import { computeStreak } from '@/features/progression/streak'
import { kstDateKey } from '@/lib/time/kst'

/** S-01 랜딩·대시보드 — docs/05_SCREEN_SPEC.md */
export function LandingDashboard() {
  const navigate = useNavigate()
  const { nickname, hasOnboarded, hasCalibration } = useUserStore()
  const stage = useCharacterStage()
  const { xp, points, attendance } = useProgressionStore()
  const { combo, bestCombo } = useGameStore()
  const snapshot = usePostureStore((s) => s.snapshot)
  const { lengthId, configure, status } = useSessionStore()
  const isMonitoring = status === 'running'

  // 세션 요약 저장(finalizeSession) 직후 zustand 구독으로 즉시 갱신됩니다.
  const summaries = useSessionHistoryStore((s) => s.summaries)
  const todayFocus = useMemo(() => selectTodayFocus(summaries), [summaries])
  // 홈·기록·성장이 공유하는 단일 집계 — 값 불일치를 원천 차단합니다.
  const stats = useMemo(() => selectSessionStats(summaries), [summaries])
  const streak = useMemo(() => computeStreak(attendance, kstDateKey()), [attendance])
  const totalFocusMs = stats.totalFocusedMs

  const isFirstVisit = !hasOnboarded

  return (
    <AppShell
      rail={
        <div className="dashboard-rail">
          <div>
            <AttendanceCalendar attendance={attendance} />
            <p className="mt-2 px-1 text-xs leading-relaxed text-ink-soft">
              {`연속 ${streak.current}일 · 가장 길게 ${streak.best}일`}
              {streak.next && ` · 다음 보너스까지 ${streak.next.remaining}일`}
            </p>
          </div>

          <section className="dashboard-rail__summary" aria-labelledby="dashboard-rhythm-title">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="dashboard-kicker">오늘의 리듬</p>
                <h2 id="dashboard-rhythm-title" className="mt-1 text-lg font-bold text-ink">
                  작지만 이어진 기록
                </h2>
              </div>
              <Icon name="leaf" size={22} className="text-green" />
            </div>
            <dl className="dashboard-rail__metrics">
              <div>
                <dt>집중</dt>
                <dd className="tabular">{formatFocusClock(todayFocus.focusedMs)}</dd>
              </div>
              <div>
                <dt>회복</dt>
                <dd className="tabular">{combo}회</dd>
              </div>
              <div>
                <dt>잎사귀</dt>
                <dd className="tabular">{points}P</dd>
              </div>
            </dl>
            <button
              type="button"
              className="dashboard-rail__link"
              onClick={() => navigate(ROUTES.history)}
            >
              기록 자세히 보기 <span aria-hidden="true">→</span>
            </button>
          </section>

          {/* 캠퍼스 카드 — 플래그가 꺼져 있으면 렌더되지 않습니다. */}
          <CampusDashboardCard />
        </div>
      }
    >
      <header className="dashboard-heading">
        <div className="dashboard-heading__index" aria-hidden="true">
          <span>UPRIGHT NOW</span>
          <span>{isFirstVisit ? '01 / 시작' : '오늘의 자리'}</span>
        </div>
        {isFirstVisit && <p className="dashboard-kicker mt-4">내 자세 루틴 · 첫 번째 장면</p>}
        <h1 className="dashboard-heading__title">
          {isFirstVisit
            ? '오늘의 목표, 편안한 자세로 시작해 볼까요?'
            : `${nickname}님, 오늘의 자리도 천천히 정돈해 볼까요?`}
        </h1>
        <p className="dashboard-heading__description">
          {isFirstVisit
            ? '처음 한 번만, 지금 편한 자세를 기준으로 남겨요.'
            : '세션을 켜면 개인 기준에서의 변화를 조용히 살펴볼게요.'}
        </p>
      </header>

      {isFirstVisit ? (
        <Card tone="pink" className="dashboard-ritual mb-6 p-0">
          <div className="dashboard-ritual__layout">
            <div className="dashboard-ritual__copy">
              <p className="dashboard-kicker">첫 루틴 · 약 1분</p>
              <h2 className="dashboard-ritual__title">
                편안했던 순간을
                <br />
                오늘의 기준으로 남겨요.
              </h2>
              <p className="dashboard-ritual__description">
                이름과 공부 환경을 고른 뒤 카메라 위치를 확인하면, 그다음부터는 내 변화만 비교해요.
              </p>
              <ol className="dashboard-ritual__steps" aria-label="첫 사용 준비 순서">
                <li><span>01</span><div><strong>내 공부 자리 고르기</strong><small>집중하는 환경을 한 번만 알려주세요.</small></div></li>
                <li><span>02</span><div><strong>편한 자세를 기준으로 등록</strong><small>이후에는 내 변화만 비교합니다.</small></div></li>
                <li><span>03</span><div><strong>첫 집중을 가볍게 시작</strong><small>카메라 영상은 저장하지 않아요.</small></div></li>
              </ol>
              <div className="dashboard-ritual__cta">
                <Button size="lg" onClick={() => navigate(ROUTES.onboardingName)}>
                  내 기준 만들기
                  <Icon name="camera" size={18} />
                </Button>
                <p>
                  <Icon name="shield" size={15} className="shrink-0 text-green" />
                  카메라 영상은 기기 안에서만 처리하고 저장하지 않아요.
                </p>
              </div>
            </div>
            <div className="dashboard-ritual__character">
              <div className="character-stage" aria-hidden="true">
                <span className="character-stage__orbit character-stage__orbit--outer" />
                <span className="character-stage__orbit character-stage__orbit--inner" />
                <span className="character-stage__spark character-stage__spark--one">✦</span>
                <span className="character-stage__spark character-stage__spark--two">·</span>
                <div className="character-stage__figure">
                  <CharacterViewport stage={1} size={242} decorative />
                </div>
              </div>
              <div className="dashboard-ritual__character-note" aria-hidden="true">
                <span>오늘의 동료</span>
                <strong>뽀각 거북</strong>
                <small>나와 함께 천천히 자라요</small>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card tone="pink" className="dashboard-focus-card mb-6 p-0">
          <div className="dashboard-focus-card__top">
            <div className="dashboard-focus-card__copy">
              <p className="dashboard-kicker">오늘의 집중</p>
              <h2 className="dashboard-focus-card__title">
                {isMonitoring
                  ? POSTURE_COPY[snapshot.state].message
                  : '목표 하나를 정하고, 편안한 흐름을 이어가요.'}
              </h2>
              {isMonitoring ? (
                <div className="dashboard-focus-card__posture">
                  <PostureStatusBadge state={snapshot.state} quality={snapshot.quality} />
                </div>
              ) : (
                <p className="dashboard-focus-card__description">
                  세션 중에는 처음 등록한 기준에서의 변화를 알려드려요.
                </p>
              )}
              <div className="dashboard-focus-card__combo">
                <RecoveryCombo combo={combo} best={bestCombo} />
              </div>
            </div>
            <div className="dashboard-focus-card__character">
              <div className="character-stage" aria-hidden="true">
                <span className="character-stage__orbit character-stage__orbit--outer" />
                <span className="character-stage__orbit character-stage__orbit--inner" />
                <span className="character-stage__spark character-stage__spark--one">✦</span>
                <span className="character-stage__spark character-stage__spark--two">·</span>
                <div className="character-stage__figure">
                  <CharacterWithGear
                    stage={stage}
                    postureState={isMonitoring ? snapshot.state : 'good'}
                    size={228}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="dashboard-focus-card__actions">
            <div>
              <p className="dashboard-kicker">이번 집중 길이</p>
              <div className="dashboard-session-options mt-3">
                <SegmentedControl
                  ariaLabel="세션 길이 선택"
                  columns={2}
                  value={lengthId}
                  onChange={(id) => configure({ lengthId: id })}
                  options={SESSION_LENGTHS.map((o) => ({
                    id: o.id,
                    label: o.label,
                    sublabel: o.restLabel,
                  }))}
                />
              </div>
              <p className="dashboard-focus-card__privacy">
                <Icon name="shield" size={14} /> 개인 기준만 기기 안에서 사용해요.
              </p>
            </div>
            <Button
              size="lg"
              className="dashboard-focus-card__start"
              onClick={() => navigate(hasCalibration ? ROUTES.sessionSetup : ROUTES.camera)}
            >
              <Icon name="play" size={18} />
              지금 집중 시작
            </Button>
          </div>
        </Card>
      )}

      <Card className="dashboard-growth mb-6">
        <GrowthTimeline xp={xp} />
      </Card>

      {!isFirstVisit && <section aria-labelledby="recent-session-title">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="dashboard-kicker">돌아보기</p>
            <h2 id="recent-session-title" className="mt-1 text-xl font-bold text-ink">최근 세션</h2>
          </div>
        </div>
        {stats.completedCount === 0 && summaries.length === 0 ? (
          <EmptyState
            title="아직 기록이 없어요"
            description="첫 세션을 마치면 여기에 회복 콤보와 감지 가능 시간이 쌓여요."
            action={
              <Button size="sm" onClick={() => navigate(ROUTES.sessionSetup)}>
                첫 세션 시작하기
              </Button>
            }
          />
        ) : (
          <Card tone="canvas" className="dashboard-history-summary p-5">
            <p className="text-sm text-ink-soft">
              {`완료한 세션 ${stats.completedCount}회 · 누적 집중 ${formatDuration(totalFocusMs)}`}
            </p>
          </Card>
        )}
      </section>}
    </AppShell>
  )
}

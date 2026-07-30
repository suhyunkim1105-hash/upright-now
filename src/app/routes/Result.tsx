import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell, PageHeader } from '@/components/layout/AppShell'
import { CharacterViewport } from '@/components/character/CharacterViewport'
import { GrowthTimeline } from '@/components/character/GrowthTimeline'
import { BossHealthBar } from '@/components/game/BossHealthBar'
import { Badge, Button, Card, CardTitle, StatTile } from '@/components/ui'
import { TARGET_PROGRESS_OPTIONS } from '@/constants/copy'
import { ROUTES } from '@/constants/routes'
import { formatDuration } from '@/features/sessions/sessionMachine'
import { buildSessionSummary } from '@/features/sessions/buildSummary'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { selectDamageDealt, useGameStore } from '@/features/game/gameStore'
import {
  useCharacterStage,
  useProgressionStore,
} from '@/features/progression/progressionStore'
import { applyReward } from '@/features/game/rewards'
import { useToast } from '@/app/providers/ToastProvider'
import { useSessionHistoryStore } from '@/features/sessions/sessionHistoryStore'
import { useDemoStore } from '@/features/demo/demoMode'
import { MONSTER_THEMES, useActiveModeConfig } from '@/features/modes/modeStore'
import { sanitizeNextAction } from '@/features/sessions/sessionHistoryStore'
import { AiReportCard } from '@/features/ai-report/AiReportCard'
import { featureFlags } from '@/lib/feature-flags/flags'
import type { SessionSummary } from '@/types'
import {
  CampusProfileBadge,
  CampusShareCardFrame,
} from '@/components/campus/CampusBits'

/**
 * S-12 결과 — docs/05, docs/03 UF-12
 * 평균 자세 점수·CVA·정상/비정상 등급은 표시하지 않습니다. (docs/02 FR-012)
 */
export function Result() {
  const navigate = useNavigate()
  const { sessionId: paramId = 'demo' } = useParams()
  const stage = useCharacterStage()
  const xp = useProgressionStore((s) => s.xp)
  const session = useSessionStore()
  const game = useGameStore()
  const summaries = useSessionHistoryStore((s) => s.summaries)
  const updateSummary = useSessionHistoryStore((s) => s.update)
  const isDemo = useDemoStore((s) => s.isDemo)
  const modeConfig = useActiveModeConfig()
  // 새로고침해도 유지 — 저장된 기록에서 초기값을 복원합니다.
  const storedSummary = summaries.find(
    (x) => x.sessionId === session.sessionId || x.id === session.sessionId,
  )
  const [progress, setProgress] = useState<string | null>(
    () => storedSummary?.targetProgress ?? null,
  )
  const [nextAction, setNextAction] = useState(
    () => storedSummary?.nextAction ?? '',
  )
  const REASON_LABEL: Record<string, string> = {
    normal: '정상 완료',
    'under-80': '계획 시간 80% 미만',
    'no-detection': '감지 가능 시간 없음',
    test: '1분 테스트',
  }
  const reasonLabel = storedSummary?.completionReason
    ? REASON_LABEL[storedSummary.completionReason]
    : null
  const monsterName =
    session.mode === 'room'
      ? MONSTER_THEMES.komong.name
      : MONSTER_THEMES[modeConfig.monsterTheme].name
  const { push } = useToast()

  // URL 의 세션 id 를 실제로 검증합니다.
  // - 현재 세션 id 와 일치(또는 데모) → 현재 결과
  // - 과거 세션 id → 기록에서 조회해 표시
  // - 둘 다 아니면 가짜 0초 결과를 만들지 않고 '결과를 찾을 수 없어요'
  const isCurrent =
    isDemo || (session.sessionId === paramId && session.status !== 'idle')
  const pastSummary = isCurrent
    ? undefined
    : summaries.find((s) => s.sessionId === paramId || s.id === paramId)

  if (!isCurrent && pastSummary) {
    const past = pastSummary
    return (
      <AppShell chrome="focus">
        <PageHeader
          back={() => navigate(ROUTES.history)}
          title="지난 세션 결과"
          description={new Date(past.endedAt).toLocaleString('ko-KR')}
          action={
            <Badge tone={past.status === 'completed' ? 'green' : 'muted'}>
              {past.status === 'completed' ? '완료' : '중도 종료'}
            </Badge>
          }
        />
        <Card>
          <CardTitle>자세 요약</CardTitle>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatTile label="학습 세션 시간" value={formatDuration(past.elapsedMs)} tone="canvas" />
            <StatTile label="감지 가능 시간" value={formatDuration(past.detectableMs)} tone="canvas" />
            <StatTile
              label="회복 성공 / 회복 기회"
              value={`${past.recoveries} / ${past.recoveryOpportunities}`}
              tone="canvas"
            />
            <StatTile label="최고 콤보" value={String(past.bestCombo)} unit="회" tone="canvas" />
            <StatTile label="몬스터 피해량" value={String(past.damageDealt)} tone="canvas" />
            <StatTile label="획득" value={`${past.xpEarned} XP · ${past.pointsEarned}P`} tone="canvas" />
          </div>
        </Card>
        {(past.goal || past.targetProgressLabel || past.nextAction) && (
          <Card className="mt-4">
            <CardTitle>과제 메모</CardTitle>
            <dl className="mt-3 flex flex-col gap-1.5 text-sm">
              {past.goal && (
                <div className="flex gap-2">
                  <dt className="shrink-0 text-ink-soft">목표</dt>
                  <dd className="font-semibold text-ink">{past.goal}</dd>
                </div>
              )}
              {past.targetProgressLabel && (
                <div className="flex gap-2">
                  <dt className="shrink-0 text-ink-soft">진행도</dt>
                  <dd className="font-semibold text-ink">{past.targetProgressLabel}</dd>
                </div>
              )}
              {past.nextAction && (
                <div className="flex gap-2">
                  <dt className="shrink-0 text-ink-soft">다음 할 일</dt>
                  <dd className="font-semibold text-ink">{past.nextAction}</dd>
                </div>
              )}
            </dl>
          </Card>
        )}
        {featureFlags.aiReport && (
          <div className="mt-4">
            <AiReportCard
              summary={past}
              onSave={(aiReport) => updateSummary(past.sessionId ?? past.id, { aiReport })}
            />
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => navigate(ROUTES.history)}>
            기록 보기
          </Button>
          <Button onClick={() => navigate(ROUTES.home)}>대시보드로</Button>
        </div>
      </AppShell>
    )
  }

  if (!isCurrent) {
    return (
      <AppShell chrome="focus">
        <PageHeader
          back={() => navigate(ROUTES.home)}
          title="결과를 찾을 수 없어요"
          description="주소가 잘못됐거나 이미 정리된 세션이에요. 기록 화면에서 지난 세션을 볼 수 있어요."
        />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate(ROUTES.history)}>
            기록 보기
          </Button>
          <Button onClick={() => navigate(ROUTES.home)}>대시보드로</Button>
        </div>
      </AppShell>
    )
  }

  const completed = session.status === 'completed'
  const aiReportSummary =
    storedSummary ??
    buildSessionSummary(session, game, completed ? 'completed' : 'aborted')

  const selectProgress = (id: string) => {
    setProgress(id)
    // 같은 sessionId 기록을 제자리 업데이트 — 중복 기록을 만들지 않습니다.
    const option = TARGET_PROGRESS_OPTIONS.find((o) => o.id === id)
    updateSummary(session.sessionId, {
      targetProgress: id as SessionSummary['targetProgress'],
      targetProgressLabel: option?.label,
    })
    // 목표 완료 자기보고 → 보너스 (세션당 1회, applyReward 가 중복 차단)
    if (id === 'done' && completed) {
      const reward = applyReward({
        id: `goal-${session.sessionId}`,
        sessionId: session.sessionId,
        type: 'goal_completed',
      })
      if (reward.applied) {
        push({
          title: '오늘 목표 완료! 보너스 상자를 열었어요.',
          description: `+${reward.xp} XP · +${reward.points}P`,
          tone: 'success',
        })
      }
    }
  }

  return (
    <AppShell chrome="focus">
      <PageHeader
        back={() => navigate(ROUTES.home)}
        title={
          completed
            ? `오늘의 ${Math.round(session.plannedMs / 60000)}분을 마쳤어요.`
            : '여기까지의 기록을 정리했어요.'
        }
        description={
          (completed
            ? `회복 행동이 ${monsterName}에게 그대로 전달됐어요.`
            : '다음에 이어서 시작해도 괜찮아요.') +
          (reasonLabel ? ` (인정 사유: ${reasonLabel})` : '')
        }
        action={<Badge tone={completed ? 'green' : 'muted'}>{completed ? '완료' : '중도 종료'}</Badge>}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <Card tone="pink" className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-wide text-[#b8285a]">오늘의 회복 흐름</p>
                <CardTitle>보스 전투 결과</CardTitle>
              </div>
              <Badge tone="coral">회복 행동 반영</Badge>
            </div>
            <div className="mt-5 rounded-2xl bg-surface/80 p-4">
              <BossHealthBar hp={game.boss.hp} maxHp={game.boss.maxHp} name={monsterName} />
            </div>
            <div className="mt-3 max-w-[220px]">
              <StatTile
                label="몬스터 피해량"
                value={String(selectDamageDealt(game))}
                tone="surface"
              />
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold tracking-wide text-[#2b52a8]">세션 기록</p>
                <CardTitle>자세 요약</CardTitle>
              </div>
              <Badge tone="muted">점수 대신 흐름</Badge>
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              세션 시간과 자세를 안정적으로 측정할 수 있었던 시간은 따로 표시해요.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <StatTile label="학습 세션 시간" value={formatDuration(session.elapsedMs)} tone="canvas" />
              <StatTile label="감지 가능 시간" value={formatDuration(session.detectableMs)} tone="canvas" />
              <StatTile label="자리 비움 시간" value={formatDuration(session.awayMs)} tone="canvas" />
              <StatTile
                label="회복 성공 / 회복 기회"
                value={`${game.recoveries} / ${game.opportunities}`}
                tone="canvas"
              />
              <StatTile
                label="가장 빠른 회복"
                value={
                  game.fastestRecoveryMs === undefined
                    ? '—'
                    : formatDuration(game.fastestRecoveryMs)
                }
                tone="canvas"
              />
              <StatTile label="최고 콤보" value={String(game.bestCombo)} unit="회" tone="canvas" />
            </div>
          </Card>

          {featureFlags.aiReport && (
            <AiReportCard
              summary={aiReportSummary}
              onSave={(aiReport) => {
                if (!storedSummary) return
                updateSummary(storedSummary.sessionId ?? storedSummary.id, { aiReport })
              }}
            />
          )}
          <Card tone="blue">
            <GrowthTimeline xp={xp} />
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {/*
            결과 공유 카드 — 캠퍼스 테마가 켜져 있으면 학교 색 테두리가 감쌉니다.
            플래그가 꺼져 있으면 CampusShareCardFrame 이 자식을 그대로 통과시킵니다.
          */}
          <CampusShareCardFrame>
            <Card tone="yellow">
              <div className="flex flex-col items-center text-center">
                <CharacterViewport stage={stage} size={140} />
                <CardTitle>이번에 얻은 보상</CardTitle>
                <div className="mt-2 empty:hidden">
                  <CampusProfileBadge />
                </div>
                <div className="mt-3 grid w-full grid-cols-2 gap-2">
                  <StatTile label="경험치" value={`${game.sessionXp}`} unit="XP" tone="surface" />
                  <StatTile label="잎사귀" value={`${game.sessionPoints}`} unit="P" tone="surface" />
                </div>
              </div>
            </Card>
          </CampusShareCardFrame>

          <Card>
            <p className="text-xs font-bold tracking-wide text-[#b8285a]">마무리 한 가지</p>
            <CardTitle>이번 목표를 얼마나 진행했나요?</CardTitle>
            <p className="mt-1 text-xs leading-5 text-ink-soft">
              숫자보다 다음 행동을 남기면, 다음 세션을 다시 시작하기 쉬워져요.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {TARGET_PROGRESS_OPTIONS.map((option) => (
                <Button
                  key={option.id}
                  size="sm"
                  variant={progress === option.id ? 'primary' : 'secondary'}
                  onClick={() => selectProgress(option.id)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <label className="mt-3 flex flex-col gap-1 text-xs">
              <span className="font-semibold text-ink-soft">다음 할 일 (선택)</span>
              <input
                maxLength={80}
                placeholder="예: 4장 예제 2개 풀기"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                onBlur={() => {
                  const clean = sanitizeNextAction(nextAction)
                  setNextAction(clean)
                  updateSummary(session.sessionId, {
                    nextAction: clean || undefined,
                  })
                }}
                className="h-9 rounded-xl border border-line bg-surface px-2 text-sm"
              />
            </label>
            <p className="mt-3 text-xs text-ink-soft">
              자세로 집중 여부를 추론하지 않아요. 진행도는 직접 남기는 값이에요.
            </p>
          </Card>

          <div className="flex flex-col gap-2">
            <Button size="lg" fullWidth onClick={() => navigate(ROUTES.sessionSetup)}>
              같은 설정으로 다시 시작
            </Button>
            <Button variant="secondary" fullWidth onClick={() => navigate(ROUTES.home)}>
              대시보드로
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

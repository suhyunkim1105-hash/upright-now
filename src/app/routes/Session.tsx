import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell, BackButton } from '@/components/layout/AppShell'
import { CharacterViewport } from '@/components/character/CharacterViewport'
import { BossHealthBar } from '@/components/game/BossHealthBar'
import {
  PostureMessage,
  PostureStatusBadge,
} from '@/components/posture/PostureStatusBadge'
import { RecoveryCombo, SessionTimer } from '@/components/session/SessionBits'
import { Button, Card, CardTitle, StatTile } from '@/components/ui'
import { Icon } from '@/components/ui/Icon'
import { AWAY_PROMPT_MS } from '@/constants/posture'
import { AWAY_PROMPT } from '@/constants/copy'
import { ROUTES } from '@/constants/routes'
import { remainingMs } from '@/features/sessions/sessionMachine'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { usePostureStore } from '@/features/posture-engine/postureStore'
import { useCharacterVisualStore } from '@/features/posture-engine/characterVisualStore'
import { usePostureTicker } from '@/features/posture-engine/usePostureTicker'
import { useLiveClassifier } from '@/features/posture-engine/useLiveClassifier'
import { useCamera } from '@/features/calibration/useCamera'
import { useCalibrationStore, hasValidActiveProfile } from '@/features/calibration/calibrationStore'
import { useGameStore } from '@/features/game/gameStore'
import { useCharacterStage } from '@/features/progression/progressionStore'
import { useUserStore } from '@/features/onboarding/userStore'
import { useDemoStore } from '@/features/demo/demoMode'
import { finalizeSession } from '@/features/sessions/finalizeSession'
import { featureFlags } from '@/lib/feature-flags/flags'
import { useRoomStore } from '@/features/rooms/roomStore'
import { leaveRoom, setMyState } from '@/features/rooms/roomService'
import { useToast } from '@/app/providers/ToastProvider'
import { closePip, openPip, registerAutoPip } from '@/features/pip/pipController'
import { usePipStore } from '@/features/pip/pipStore'
import { MiniPostureWidget } from '@/components/session/MiniPostureWidget'
import { CoopArena } from '@/components/game/CoopArena'
import { useAttackSequence } from '@/features/game/useAttackSequence'
import { MONSTER_THEMES, useActiveModeConfig } from '@/features/modes/modeStore'
import { DAMAGE, FOCUS_ATTACK_INTERVAL_MS } from '@/constants/game'
import { useMonsterProgress } from '@/features/game/monsterProgress'

/**
 * 언마운트 안전망 타이머 — StrictMode 의 즉시 재마운트에서는 다음 마운트가
 * 이 타이머를 취소하므로, "진짜" 화면 이탈에서만 finalize 가 실행됩니다.
 */
let pendingUnmountFinalize: number | undefined
let pendingRoomCleanup: number | undefined

/**
 * S-09 집중 세션 — 사이드바를 숨기고 대시보드보다 단순하게 (docs/04 §3, docs/05 S-09)
 *
 * 화면 구성:
 *   왼쪽  캐릭터(가장 큼) + 자세 문구 + 마감괴수 체력
 *   오른쪽 남은 시간 · 이번 세션 결과 · 제어 버튼
 */
export function Session() {
  const navigate = useNavigate()
  const { sessionId = 'demo' } = useParams()
  const videoRef = useRef<HTMLVideoElement>(null)
  const { push } = useToast()

  const stage = useCharacterStage()
  const soundEnabled = useUserStore((s) => s.soundEnabled)
  const toggleSound = useUserStore((s) => s.toggleSound)
  const hasCalibration = useUserStore((s) => s.hasCalibration)
  const isDemo = useDemoStore((s) => s.isDemo)
  const snapshot = usePostureStore((s) => s.snapshot)
  const notice = usePostureStore((s) => s.notice)
  const visualIntent = useCharacterVisualStore((s) => s.intent)
  const session = useSessionStore()
  const game = useGameStore()
  const completedRef = useRef(false)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)

  const isBad = snapshot.state === 'bad'
  const isActive = session.status === 'running' || session.status === 'paused'

  // 사용자 플래그(hasCalibration)와 실제 프로필이 어긋나면(스토리지 유실 등)
  // 분류기가 영영 unstable 만 내므로, 프로필 실존 여부까지 확인합니다.
  const hasProfile = useCalibrationStore((s) => hasValidActiveProfile(s))
  const calProfileCount = useCalibrationStore((s) => s.profiles.length)
  const activeProfileName = useCalibrationStore((s) => s.profile?.name ?? null)
  // 저장 유실(프로필 0개) 전용 — 미선택 상태는 아래 idle 가드가 안내합니다.
  const missingProfile =
    featureFlags.camera && hasCalibration && calProfileCount === 0 && !isDemo

  // 실제 카메라 자세 감지: 카메라 기능이 켜지고, 기준이 등록됐고, 데모가 아닐 때만.
  const useRealCamera =
    featureFlags.camera && hasCalibration && hasProfile && !isDemo

  // 비데모 세션은 자세 기준 없이는 시작할 수 없습니다. (3분 데모만 예외)
  const calibrationRequired = featureFlags.camera && !isDemo && !hasProfile
  const { state: camera, start: startCamera, stop: stopCamera } =
    useCamera(videoRef)
  useLiveClassifier(videoRef, camera)

  // 회복 수명주기를 굴리는 상태 머신 티커 (카메라·QA 공통)
  usePostureTicker(true)

  // 세션이 시작되면 카메라를 켜고, 화면을 떠나면 트랙을 정지합니다.
  useEffect(() => {
    if (useRealCamera && session.status === 'running') startCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useRealCamera, session.status === 'running'])

  useEffect(() => stopCamera, [stopCamera])

  // 1초 틱. 자세로 집중 여부를 추론하지 않고, 시작 시점부터 시간만 잽니다.
  useEffect(() => {
    if (session.status !== 'running') return
    const timer = window.setInterval(() => {
      useSessionStore
        .getState()
        .tick(1000, usePostureStore.getState().snapshot.state)
      // 유효 감지 집중 5분마다 괴물 자동 공격 (자세를 무너뜨릴 필요 없음)
      const det = useSessionStore.getState().detectableMs
      const n = Math.floor(det / FOCUS_ATTACK_INTERVAL_MS)
      if (n > 0) {
        useGameStore.getState().focusAttack(`focus-${sessionId}-${n}`)
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [session.status, sessionId])

  // 타이머 정상 종료 → 단일 종료 함수로 atomic 처리 (중복 종료·중복 보상 차단)
  useEffect(() => {
    if (session.status !== 'completed' || completedRef.current) return
    completedRef.current = true
    finalizeSession('timer')
    stopCamera()
    closePip() // 세션이 끝나면 PiP·미니 위젯을 자동으로 닫습니다
  }, [session.status, stopCamera])

  // 유효하지 않은 세션 URL — 데모가 아니고, 이 화면이 아는 세션도 아니면
  // (직접 주소 입력·새로고침) 가짜 세션을 만들지 않고 설정 화면으로 복구합니다.
  // 예외: 진행 중인 친구 방의 내 세션 — 자세 기준이 없는 중간 합류자는
  // 시작 전(idle) 상태로 이 화면에 와서 기준 등록 안내를 봐야 합니다.
  useEffect(() => {
    if (isDemo || sessionId === 'demo') return
    const s = useSessionStore.getState()
    const room = useRoomStore.getState()
    const isMyRoomSession =
      s.mode === 'room' &&
      room.phase === 'running' &&
      sessionId === `room-${room.code}`
    if (s.status === 'idle' && s.sessionId !== sessionId && !isMyRoomSession) {
      navigate(ROUTES.sessionSetup, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 완료된 친구 방 세션에서 화면을 떠나면 방 상태를 정리하고 solo 로 복원합니다.
  // (StrictMode 즉시 재마운트는 다음 마운트가 타이머를 취소해 무시됩니다)
  useEffect(() => {
    window.clearTimeout(pendingRoomCleanup)
    return () => {
      pendingRoomCleanup = window.setTimeout(() => {
        const cur = useSessionStore.getState()
        const room = useRoomStore.getState()
        if (cur.status === 'completed' && cur.mode === 'room' && room.phase !== 'idle') {
          // 상시 방은 서버가 대기실로 되돌리므로 방을 나가지 않습니다.
          // 참가 상태를 유지해야 같은 방에서 다음 라운드를 이어갈 수 있어요.
          if (!room.isPersistent) void leaveRoom()
          cur.configure({ mode: 'solo' })
        }
      }, 150)
    }
  }, [])

  // 스트레칭에서 브라우저 뒤로가기로 돌아온 경우 — 세션을 이어서 진행합니다.
  // 마운트 시 1회만: beginRest 직후(화면 전환 transition 이 끝나기 전)에
  // 상태 변화 effect 가 바로 endRest 를 해버리면 안 되기 때문입니다.
  useEffect(() => {
    if (useSessionStore.getState().status === 'resting')
      useSessionStore.getState().endRest()
  }, [])

  // 활성 세션 중 브라우저 뒤로가기 — 조용히 사라지지 않게 확인 모달을 띄웁니다.
  // (BrowserRouter 선언형 라우터에는 useBlocker 가 없어 popstate 를 직접 다룹니다)
  useEffect(() => {
    if (!isActive) return

    const pushSentinel = () => {
      const state = window.history.state ?? {}
      if (state.uprightSessionGuard) return
      // router 가 쓰는 idx 를 이어가 보초 엔트리가 스택을 깨뜨리지 않게 합니다.
      window.history.pushState(
        { ...state, idx: (state.idx ?? 0) + 1, uprightSessionGuard: true },
        '',
      )
    }
    pushSentinel()

    const onPopState = () => {
      setLeaveConfirmOpen(true)
      pushSentinel()
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [isActive])

  // 새로고침·탭 닫기에서도 활성 세션이 소리 없이 사라지지 않게 확인을 요청합니다.
  useEffect(() => {
    if (!isActive) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isActive])

  // 안전망: 가드를 우회해 화면을 벗어난 활성 세션은 기록을 남기고 종료합니다.
  // (resting 은 스트레칭 뒤 같은 세션으로 돌아오므로 종료하지 않습니다)
  useEffect(() => {
    window.clearTimeout(pendingUnmountFinalize)
    return () => {
      pendingUnmountFinalize = window.setTimeout(() => {
        const current = useSessionStore.getState()
        if (current.status === 'running' || current.status === 'paused') {
          finalizeSession('manual')
          closePip()
        }
      }, 0)
    }
  }, [])

  // PiP 폴백 상태 + 자동 PiP(선택 확장, 카메라 사용 중일 때만 의미)
  const pipFallback = usePipStore((s) => s.fallbackActive)
  useEffect(() => {
    if (useRealCamera && session.status === 'running') registerAutoPip()
  }, [useRealCamera, session.status])

  // 친구 방 세션 — 공동 보스 표시 + 친구 성공 이벤트·기린 싱크 알림
  const roomPhase = useRoomStore((s) => s.phase)
  const roomId = useRoomStore((s) => s.roomId)
  const roomCode = useRoomStore((s) => s.code)
  const lastFriendEvent = useRoomStore((s) => s.lastFriendEvent)
  const syncFlashAt = useRoomStore((s) => s.syncFlashAt)
  // 4중 검사 — 오래된 room 상태가 개인 세션에 협동 화면을 남기지 않게 합니다.
  const isRoomSession =
    session.mode === 'room' &&
    roomPhase === 'running' &&
    roomId !== null &&
    sessionId === `room-${roomCode ?? ''}`

  useEffect(() => {
    if (!lastFriendEvent) return
    push({ title: lastFriendEvent, tone: 'info' })
    useRoomStore.getState().patch({ lastFriendEvent: null })
  }, [lastFriendEvent, push])

  useEffect(() => {
    if (!syncFlashAt) return
    push({
      title: '두 사람의 회복 에너지가 연결됐어요. 기린 싱크!',
      tone: 'success',
    })
  }, [syncFlashAt, push])

  // 공격 연출 3.2초: 회복 0~0.7 → 에너지 0.7~1.4 → 피격 1.4~2.5 → 보상 2.5~3.2
  const { energyActive, bossHitTick, rewardFlash } = useAttackSequence(game.attackTick)
  const modeConfig = useActiveModeConfig()
  const monsterPhase = useMonsterProgress((s) =>
    isRoomSession ? 1 : s.getBoss(modeConfig.monsterTheme).phase,
  )
  const monsterName = isRoomSession
    ? MONSTER_THEMES.komong.name
    : MONSTER_THEMES[modeConfig.monsterTheme].name

  const remaining = remainingMs(session)
  const showAwayPrompt =
    snapshot.state === 'away' && session.awayMs >= AWAY_PROMPT_MS

  const endSession = () => {
    // 계획 시간의 80% 이상이면 완료로 인정, 아니면 중도 종료 (완료 보상 0)
    completedRef.current = true
    finalizeSession('manual')
    stopCamera()
    closePip()
    // 가드의 보초 히스토리 엔트리를 결과 화면으로 교체합니다.
    navigate(ROUTES.result(sessionId), { replace: true })
  }

  const goStretch = () => {
    if (session.status === 'running' || session.status === 'paused') {
      // 세션 중 스트레칭: 타이머·자세 판정을 멈추고 같은 세션으로 돌아옵니다.
      useSessionStore.getState().beginRest()
      navigate(ROUTES.stretch(), {
        state: { origin: 'active-session', sessionId },
      })
      return
    }
    if (session.status === 'completed' || session.status === 'aborted') {
      // 이미 끝난 세션의 휴식: 완료 후 결과 화면으로 돌아갑니다.
      navigate(ROUTES.stretch(), { state: { origin: 'result', sessionId } })
      return
    }
    navigate(ROUTES.stretch())
  }

  return (
    <AppShell chrome="focus">
      {/* 활성 세션 이탈 확인 — 뒤로가기가 세션을 조용히 지우지 않게 합니다 */}
      {leaveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <dialog
            open
            aria-label="세션을 계속할까요?"
            className="static m-0 w-full max-w-sm border-0 bg-transparent p-0"
          >
            <Card className="w-full">
              <p className="text-lg font-bold text-ink">세션을 계속할까요?</p>
              <p className="mt-1 text-sm text-ink-soft">
                지금 나가면 여기까지 집중한 시간만 기록에 남아요.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <Button fullWidth onClick={() => setLeaveConfirmOpen(false)}>
                  계속 집중하기
                </Button>
                <Button
                  fullWidth
                  variant="secondary"
                  onClick={() => {
                    setLeaveConfirmOpen(false)
                    endSession()
                  }}
                >
                  세션 종료하고 나가기
                </Button>
              </div>
            </Card>
          </dialog>
        </div>
      )}

      {/* PiP 미지원·차단 시 화면 안 미니 위젯 (카메라 영상 미포함) */}
      {pipFallback && session.status !== 'idle' && <MiniPostureWidget />}

      {/* 자세 분석용 비디오. 화면에 크게 노출하지 않습니다. (docs/05 S-09) */}
      {useRealCamera && (
        <video
          ref={videoRef}
          playsInline
          muted
          className="pointer-events-none fixed bottom-3 right-3 h-24 w-32 -scale-x-100 rounded-xl border border-line object-cover opacity-80"
        />
      )}

      {/* 상단 — 과목·목표만 간결하게 */}
      <BackButton
        fallback={ROUTES.home}
        onClick={isActive ? () => setLeaveConfirmOpen(true) : undefined}
      />
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink-soft">
            {session.subject || '집중 세션'}
          </p>
          <h1 className="truncate text-2xl font-bold text-ink">
            {session.goal || '오늘의 목표를 끝내는 시간'}
          </h1>
        </div>
        <PostureStatusBadge state={snapshot.state} quality={snapshot.quality} />
      </header>

      {session.status === 'idle' && calibrationRequired && (
        <Card tone="yellow" className="mb-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">
              {calProfileCount > 0
                ? '사용할 자세 기준을 선택해 주세요. 세션 설정에서 고를 수 있어요.'
                : '자세 기준을 먼저 등록해야 세션을 시작할 수 있어요. 1분이면 돼요.'}
            </p>
            {calProfileCount > 0 ? (
              <Button size="sm" onClick={() => navigate(ROUTES.sessionSetup)}>
                자세 기준 선택하러 가기
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => navigate(`${ROUTES.calibration}?return=${ROUTES.session(sessionId)}`)}
              >
                자세 기준 등록
              </Button>
            )}
          </div>
        </Card>
      )}

      {session.status === 'idle' && !calibrationRequired && (
        <Card tone="blue" className="mb-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">
              시간은 시작 버튼을 누른 시점부터 재요.
            </p>
            <Button
              size="sm"
              onClick={() => {
                if (calibrationRequired) return
                useGameStore.getState().reset()
                session.start(sessionId)
                // 중간 합류자가 기준 등록 후 직접 시작하는 경우 —
                // 친구들에게도 집중 중으로 보이게 합니다.
                if (session.mode === 'room') void setMyState('focusing')
                // PiP 는 사용자 제스처 필요 — 같은 click handler 에서 요청
                if (useUserStore.getState().pipAutoOpen) {
                  void openPip().then((result) => {
                    if (result !== 'opened') {
                      push({
                        title:
                          '작은 별도 창을 열지 못해 화면 안 미니 위젯으로 표시해요.',
                        tone: 'info',
                      })
                    }
                  })
                }
              }}
            >
              <Icon name="play" size={16} />이 세션 시작하기
            </Button>
          </div>
        </Card>
      )}

      {missingProfile && (
        <Card tone="yellow" className="mb-4 p-4">
          <p className="text-sm font-bold text-ink">자세 기준을 찾을 수 없어요</p>
          <p className="mt-1 text-sm text-ink-soft">
            저장된 개인 기준이 없어 자세 변화를 비교할 수 없어요. 1분이면 다시
            등록할 수 있어요.
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={() => navigate(ROUTES.calibration)}
          >
            기준 다시 등록
          </Button>
        </Card>
      )}

      {notice === 'camera-distance' && (
        <Card tone="yellow" className="mb-4 p-4">
          <p className="text-sm font-bold text-ink">카메라 거리 확인</p>
          <p className="mt-1 text-sm text-ink-soft">
            지금 카메라와의 거리가 기준을 등록할 때와 달라요. 의자·카메라 위치를
            맞추거나, 이 자리에 맞게 기준을 다시 등록해 주세요.
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={() => navigate(ROUTES.calibration)}
          >
            기준 다시 등록
          </Button>
        </Card>
      )}

      {showAwayPrompt && (
        <Card tone="yellow" className="mb-4 p-4">
          <p className="text-sm font-bold text-ink">{AWAY_PROMPT.title}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => usePostureStore.getState().setPostureState('good')}
            >
              계속하기
            </Button>
            <Button size="sm" variant="secondary" onClick={() => session.pause()}>
              일시정지
            </Button>
            <Button size="sm" variant="ghost" onClick={endSession}>
              세션 종료
            </Button>
          </div>
        </Card>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* 왼쪽 — 캐릭터가 가장 먼저 보이고, 바로 아래 보스 체력 */}
        <Card
          tone={isBad ? 'coral' : 'pink'}
          className="transition-colors duration-300"
        >
          {isRoomSession && (
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-surface/70 px-3 py-2 text-[11px] text-ink-soft">
              <span className="font-bold text-ink">내 기기 감지</span>
              <span>{camera.status === 'ready' ? '카메라 연결됨' : '카메라 꺼짐'}</span>
              <span>{`기준: ${activeProfileName ?? '없음'}`}</span>
              <span>
                {snapshot.quality === 'good'
                  ? '측정 가능'
                  : snapshot.quality === 'limited'
                    ? '일부만 보임'
                    : '연결 끊김'}
              </span>
              <span className="text-muted">이 정보는 친구에게 전송되지 않아요.</span>
            </div>
          )}
          {isRoomSession ? (
            /* 친구 방: [내 캐릭터] [공동 괴물 + HP] [친구 캐릭터] */
            <CoopArena bossHitTick={bossHitTick} />
          ) : (
            <>
              <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                <div className="relative">
                  <CharacterViewport
                    stage={stage}
                    postureState={snapshot.state}
                    visualState={visualIntent ?? 'idle'}
                    attackTick={game.attackTick}
                    attackDurationMs={2200}
                    size={270}
                  />
                  {/* 0.7~1.4초: 에너지 이동 — ambient low 는 효과 최소화 */}
                  {energyActive && modeConfig.ambient !== 'low' && (
                    <span
                      aria-hidden="true"
                      className="anim-energy-beam pointer-events-none absolute top-1/2 right-0 h-4 w-10 rounded-full bg-gradient-to-r from-yellow to-coral"
                    />
                  )}
                  {/* rich: 추가 파티클·강조 링 */}
                  {energyActive && modeConfig.ambient === 'rich' && (
                    <span aria-hidden="true" data-testid="ambient-rich-fx" className="pointer-events-none absolute inset-0">
                      <span className="energy-burst absolute inset-[6%] rounded-full" />
                      <span className="absolute -top-1 left-1/4 animate-ping text-sm">✨</span>
                      <span className="absolute top-1/4 -right-1 animate-ping text-sm">✨</span>
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <PostureMessage state={snapshot.state} />
                  <p className="mt-2 text-sm text-ink-soft">
                    처음 등록한 개인 기준과 비교한 변화만 알려드려요.
                  </p>
                  <div className="mt-5 flex justify-center sm:justify-start">
                    <RecoveryCombo combo={game.combo} best={game.bestCombo} />
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-surface/80 p-4">
                {/* 1.4~2.5초: 피격·흔들림·피해 숫자 (bossHitTick 지연 틱) */}
                <BossHealthBar
                  hp={game.boss.hp}
                  maxHp={game.boss.maxHp}
                  attackTick={bossHitTick}
                  name={monsterName}
                  damage={DAMAGE.recovery}
                  monsterTheme={isRoomSession ? 'komong' : modeConfig.monsterTheme}
                  monsterPhase={monsterPhase}
                />
              </div>
            </>
          )}

          {/* 2.5~3.2초: 콤보·보상 표시 (조작을 막지 않는 한 줄) */}
          {rewardFlash && (
            <p
              aria-live="polite"
              className="anim-toast-in mt-2 text-center text-sm font-bold text-[#b8285a]"
            >
              {`콤보 ${game.combo} · +30 XP`}
            </p>
          )}
        </Card>

        {/* 오른쪽 — 남은 시간 · 이번 세션 · 제어 */}
        <div className="flex flex-col gap-3">
          <Card className="p-5">
            <SessionTimer remaining={remaining} />
          </Card>

          <Card className="p-5">
            <CardTitle>이번 세션</CardTitle>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <StatTile
                label="회복 성공"
                value={String(game.recoveries)}
                unit="회"
                tone="canvas"
              />
              <StatTile
                label="회복 기회"
                value={String(game.opportunities)}
                unit="회"
                tone="canvas"
              />
              <StatTile label="획득 XP" value={String(game.sessionXp)} tone="canvas" />
              <StatTile
                label="잎사귀"
                value={String(game.sessionPoints)}
                unit="P"
                tone="canvas"
              />
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={toggleSound}>
                {soundEnabled ? '소리 끄기' : '소리 켜기'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  // 사용자 클릭(제스처) 기반 PiP 열기 — 실패 시 화면 안 위젯
                  void openPip().then((result) => {
                    if (result !== 'opened') {
                      push({
                        title:
                          '작은 별도 창을 열지 못해 화면 안 미니 위젯으로 표시해요.',
                        tone: 'info',
                      })
                    }
                  })
                }}
              >
                미니 위젯 열기
              </Button>
              <Button size="sm" variant="secondary" onClick={goStretch}>
                잠깐 스트레칭
              </Button>
              {session.status === 'running' ? (
                <Button size="sm" variant="ghost" onClick={() => session.pause()}>
                  일시정지
                </Button>
              ) : session.status === 'paused' ? (
                <Button size="sm" variant="ghost" onClick={() => session.resume()}>
                  이어서 하기
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" onClick={endSession}>
                세션 종료
              </Button>
            </div>
          </Card>

          {session.status === 'completed' && (
            <Card tone="green" className="p-5">
              <p className="text-base font-bold text-ink">
                오늘의 세션을 마쳤어요.
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                {`${monsterName}에게 기본 공격이 들어갔어요.`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={goStretch}>
                  <Icon name="stretch" size={16} />회복 휴식 하기
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(ROUTES.result(sessionId))}
                >
                  결과 보기
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  )
}

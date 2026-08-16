import { useSessionStore } from './sessionStore'
import { useSessionHistoryStore } from './sessionHistoryStore'
import { buildSessionSummary } from './buildSummary'
import { useGameStore } from '@/features/game/gameStore'
import { applyReward } from '@/features/game/rewards'
import { useProgressionStore } from '@/features/progression/progressionStore'
import { useDemoStore } from '@/features/demo/demoMode'
import { registerSessionLockRelease } from './sessionLocks'
import { isRoomSessionActive } from '@/features/rooms/roomStore'
import { reportSessionComplete } from '@/features/rooms/roomService'
import { kstDateKey } from '@/lib/time/kst'
import { sessionCompletionReward } from '@/constants/game'
import {
  computeStreak,
  STREAK_MILESTONES,
  streakRewardEventType,
} from '@/features/progression/streak'
import { syncProgressionReward } from '@/features/progression/progressionRepository'
import { playSound } from '@/features/sound/soundEngine'

/**
 * 세션 종료의 단일 진입점 — atomic 하게 한 번만 실행됩니다.
 *
 * 순서: summary 저장 → 보상 이벤트 적용 → progression·출석 갱신 → 상태 확정.
 * sessionId 기준으로 중복 종료·중복 보상을 막습니다.
 *
 * 완료 인정: 타이머 정상 종료 또는 계획 시간의 80% 이상 진행 후 종료.
 * 17초 중도 종료는 완료 세션·출석·완주 보상에 포함되지 않습니다.
 */
export const COMPLETION_RATIO = 0.8

const finalizedSessionIds = new Set<string>()

// 세션 재시작 시 종료 잠금을 풉니다.
registerSessionLockRelease((sessionId) => finalizedSessionIds.delete(sessionId))

export function finalizeSession(reason: 'timer' | 'manual'): {
  completed: boolean
  alreadyFinalized: boolean
} {
  const session = useSessionStore.getState()
  const { sessionId } = session

  if (finalizedSessionIds.has(sessionId)) {
    return { completed: session.status === 'completed', alreadyFinalized: true }
  }
  finalizedSessionIds.add(sessionId)

  const timeOk =
    reason === 'timer' ||
    (session.plannedMs > 0 && session.elapsedMs >= COMPLETION_RATIO * session.plannedMs)

  const isDemo = useDemoStore.getState().isDemo

  // 비데모 세션에서 자세 감지가 0초였다면(기준 미등록·카메라 미동작)
  // 완주 보상·출석·상점 해제 대상이 아닙니다. 진행 시간은 중단 기록으로 남깁니다.
  const detectionOk = isDemo || session.detectableMs > 0
  const completed = timeOk && detectionOk
  // 1분 빠른 점검 — 완료해도 보상·출석·상점·괴물 진행에 반영하지 않습니다.
  const isTest = session.lengthId === 'test'
  const completionReason: NonNullable<
    import('@/types').SessionSummary['completionReason']
  > = isTest ? 'test' : completed ? 'normal' : !detectionOk ? 'no-detection' : 'under-80'

  const status = completed ? ('completed' as const) : ('aborted' as const)

  if (completed && !isTest) {
    // 기본 공격 (eventId 로 중복 차단)
    useGameStore.getState().sessionCompleted(`session-complete-${sessionId}`)
    // 친구 방 세션이면 공동 보스에도 완주 공격을 보냅니다.
    if (isRoomSessionActive()) {
      void reportSessionComplete()
    }
    // 완주 보상 — 반드시 applyReward 를 통해서만 (경제 v2: 길이별)
    applyReward({
      id: `session-complete-xp-${sessionId}`,
      sessionId,
      type: 'session_completed',
      override: sessionCompletionReward(Math.round(session.plannedMs / 60000)),
      plannedMinutes: Math.round(session.plannedMs / 60000),
    })
    // 친구 방 공동 완주 추가 보너스 (세션당 1회)
    if (isRoomSessionActive()) {
      applyReward({
        id: `friend-bonus-${sessionId}`,
        sessionId,
        type: 'friend_session_bonus',
      })
    }
    if (!isDemo) {
      // 출석 날짜는 KST 기준으로 통일합니다.
      const dateKey = kstDateKey()
      useProgressionStore.getState().completeSessionMark(dateKey)
      // 연속 출석 마일스톤 — 같은 날짜 중복 지급은 claimKey 가 차단합니다.
      const prog = useProgressionStore.getState()
      const streak = computeStreak(prog.attendance, dateKey)
      const milestone = STREAK_MILESTONES.find((m) => m.days === streak.current)
      if (milestone) {
        const granted = prog.grantStreakBonus(
          `streak-${milestone.days}:${dateKey}`,
          milestone.points,
          milestone.badge ? `streak-${milestone.days}` : undefined,
        )
        if (granted) {
          playSound('attendance_bonus')
          const eventType = streakRewardEventType(milestone.days)
          if (eventType) {
            void syncProgressionReward({
              eventId: `streak-${milestone.days}:${dateKey}`,
              eventType,
              metadata: {
                milestone_days: milestone.days,
                badge: milestone.badge,
              },
            })
          }
        }
      }
    }
  }

  // 기록 저장 — 중도 종료도 기록은 남기되 완료로 세지 않습니다.
  if (!isDemo && session.elapsedMs > 0) {
    useSessionHistoryStore
      .getState()
      .add(
        buildSessionSummary(
          useSessionStore.getState(),
          useGameStore.getState(),
          status,
          { isTest: isTest || undefined, completionReason },
        ),
      )
  }

  useSessionStore.getState().finish(status)

  return { completed, alreadyFinalized: false }
}

/** 새 세션 시작 시 같은 id 재사용을 허용하기 위해 호출합니다. */
export function releaseFinalizedSession(sessionId: string): void {
  finalizedSessionIds.delete(sessionId)
}

/** 테스트 전용 */
export function resetFinalizedForTest(): void {
  finalizedSessionIds.clear()
}

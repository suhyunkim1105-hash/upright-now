import { useProgressionStore } from '@/features/progression/progressionStore'
import { useGameStore } from './gameStore'
import { MAX_REWARDED_RECOVERIES } from '@/constants/posture'
import { REWARD } from '@/constants/game'
import { registerSessionLockRelease } from '@/features/sessions/sessionLocks'
import { syncProgressionReward } from '@/features/progression/progressionRepository'

/**
 * 보상 처리의 단일 진입점.
 * XP·잎사귀 포인트는 반드시 이 함수를 통해서만 적립됩니다.
 *
 * - 동일 id 는 두 번 적용되지 않습니다.
 * - recovery_success 의 XP·포인트 반영은 세션당 최대 5회입니다.
 *   (6회 이후에도 실제 회복 횟수는 gameStore 에 기록됩니다.)
 * - session_aborted 는 완료 보상이 없습니다.
 */
export type RewardType =
  | 'recovery_success'
  | 'session_completed'
  | 'stretch_completed'
  | 'goal_completed'
  | 'friend_session_bonus'

const REWARD_TABLE: Record<RewardType, { xp: number; points: number }> = {
  recovery_success: REWARD.recovery,
  session_completed: REWARD.sessionCompleted,
  stretch_completed: REWARD.stretch,
  goal_completed: REWARD.goalCompleted,
  friend_session_bonus: REWARD.roomCompleted,
}

/** 세션 중 화면 집계(획득 XP·잎사귀)에 반영되는 종류 */
const SESSION_SCOPED: RewardType[] = [
  'recovery_success',
  'session_completed',
  'friend_session_bonus',
]

/** 최근 획득 XP 목록에 남길 이름 */
const REWARD_LABEL: Record<RewardType, string> = {
  recovery_success: '자세 회복',
  session_completed: '세션 완주',
  stretch_completed: '스트레칭',
  goal_completed: '목표 완료',
  friend_session_bonus: '친구 공동 완주',
}

const appliedIds = new Set<string>()
const recoveryCountBySession = new Map<string, number>()
/** 세션별로 적립한 보상 id — 같은 sessionId 재시작 시 함께 풀어줍니다. */
const idsBySession = new Map<string, Set<string>>()

// 세션 재시작 시 회복 보상 상한과 해당 세션의 보상 id 잠금을 초기화합니다.
// (동일 실행 중 중복 클릭은 appliedIds 가 계속 차단하고,
//  잠금 해제는 sessionStore.start() 시점에만 일어납니다)
registerSessionLockRelease((sessionId) => {
  recoveryCountBySession.delete(sessionId)
  const ids = idsBySession.get(sessionId)
  if (ids) {
    for (const id of ids) appliedIds.delete(id)
    idsBySession.delete(sessionId)
  }
})

export interface RewardInput {
  id: string
  sessionId: string
  type: RewardType
  /** 길이별 세션 완주처럼 표 대신 쓸 지급량 (경제 v2) */
  override?: { xp: number; points: number }
}

export interface RewardOutcome {
  applied: boolean
  xp: number
  points: number
  /** recovery 상한에 걸려 0 이 지급된 경우 true */
  capped: boolean
}

export function applyReward(input: RewardInput): RewardOutcome {
  const { id, sessionId, type } = input

  if (appliedIds.has(id)) {
    return { applied: false, xp: 0, points: 0, capped: false }
  }
  appliedIds.add(id)
  if (sessionId) {
    const ids = idsBySession.get(sessionId) ?? new Set<string>()
    ids.add(id)
    idsBySession.set(sessionId, ids)
  }

  let { xp, points } = input.override ?? REWARD_TABLE[type]
  let capped = false

  if (type === 'recovery_success') {
    const count = recoveryCountBySession.get(sessionId) ?? 0
    if (count >= MAX_REWARDED_RECOVERIES) {
      xp = 0
      points = 0
      capped = true
    } else {
      recoveryCountBySession.set(sessionId, count + 1)
    }
  }

  if (xp > 0) {
    useProgressionStore.getState().addXp(xp)
    useProgressionStore.getState().logXpGain(REWARD_LABEL[type], xp)
  }
  if (points > 0) useProgressionStore.getState().addPoints(points)

  if (SESSION_SCOPED.includes(type) && (xp > 0 || points > 0)) {
    useGameStore.getState().addSessionEarnings(xp, points)
  }

  // 서버가 아직 길이별 세션 보상 계산을 알지 못하는 단계에서는
  // 고정 보상만 원장에 기록합니다. override 보상은 다음 migration에서
  // 세션 메타데이터 검증을 추가한 뒤 연결합니다.
  if (!input.override && (xp > 0 || points > 0)) {
    void syncProgressionReward({
      eventId: id,
      eventType: type,
      sessionId,
    })
  }

  return { applied: true, xp, points, capped }
}

/** 새 세션이 시작될 때 세션 단위 상한을 초기화합니다. */
export function resetSessionRewards(sessionId: string): void {
  recoveryCountBySession.delete(sessionId)
}

/** 테스트 전용 */
export function resetRewardsForTest(): void {
  appliedIds.clear()
  recoveryCountBySession.clear()
  idsBySession.clear()
}

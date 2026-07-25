/**
 * 마감순경 삐약 — 시간 알림 로직 (순수 함수).
 *
 * 역할: 처벌하지 않는 시간 알림 코치.
 * 자세 상태를 판정하지 않고, 포인트를 차감하지 않고, 세션을 강제 종료하지 않습니다.
 * 카메라·자세 데이터와 결합하지 않습니다.
 */
export type DeadlineStage = 't15' | 't5' | 't1' | 'overdue'

export type ChickPose = 'idle' | 'notice' | 'urgent' | 'celebrate'

export interface DeadlineAlert {
  stage: DeadlineStage
  pose: ChickPose
  message: string
}

export const DEADLINE_MESSAGES: Record<DeadlineStage, DeadlineAlert> = {
  t15: {
    stage: 't15',
    pose: 'notice',
    message: '마감까지 15분이에요. 지금 한 구간만 끝내볼까요?',
  },
  t5: {
    stage: 't5',
    pose: 'urgent',
    message: '5분 남았어요. 제출할 최소 형태부터 완성해요!',
  },
  t1: {
    stage: 't1',
    pose: 'urgent',
    message: '1분 남았어요. 저장하고 제출 화면을 열어주세요!',
  },
  overdue: {
    stage: 'overdue',
    pose: 'urgent',
    message: '시간이 지났어요. 지금 제출 가능한 버전부터 완성해요.',
  },
}

export const CELEBRATE_MESSAGE = '완료했어요! 오늘의 마감을 지켜냈어요.'

const MIN = 60_000

/** 현재 남은 시간에 해당하는 단계. 마감 없음이면 null. */
export function computeStage(
  now: number,
  deadlineAt: number | null,
): DeadlineStage | null {
  if (deadlineAt === null) return null
  const remaining = deadlineAt - now
  if (remaining <= 0) return 'overdue'
  if (remaining <= 1 * MIN) return 't1'
  if (remaining <= 5 * MIN) return 't5'
  if (remaining <= 15 * MIN) return 't15'
  return null
}

/**
 * 이번 틱에 새로 표시할 알림. 각 임계 구간은 한 번만 표시합니다.
 * (shownStages 는 저장되어 새로고침·PIP 재생성에도 중복 표시되지 않습니다)
 */
export function nextAlert(input: {
  now: number
  deadlineAt: number | null
  enabled: boolean
  completed: boolean
  shownStages: DeadlineStage[]
}): DeadlineAlert | null {
  const { now, deadlineAt, enabled, completed, shownStages } = input
  if (!enabled || completed) return null
  const stage = computeStage(now, deadlineAt)
  if (stage === null || shownStages.includes(stage)) return null
  return DEADLINE_MESSAGES[stage]
}

/**
 * 미루기 직후 "그 시점 단계"가 바로 다시 울리지 않도록,
 * 새 마감 기준으로 현재 단계 이하를 표시된 것으로 선반영합니다.
 * (예: 5분 미루기 → t15·t5 는 지나간 것으로 두고 t1·초과부터 알림)
 */
export function stagesAtOrBefore(
  now: number,
  deadlineAt: number,
): DeadlineStage[] {
  const order: DeadlineStage[] = ['t15', 't5', 't1', 'overdue']
  const current = computeStage(now, deadlineAt)
  if (current === null) return []
  return order.slice(0, order.indexOf(current) + 1)
}

/**
 * 회복 기회·회복 연출 중에는 알림을 최대 5초 지연합니다.
 * @returns true 면 아직 표시하지 말 것
 */
export const RECOVERY_DELAY_MS = 5000

export function shouldDelayForRecovery(
  recoveryActive: boolean,
  pendingSince: number | null,
  now: number,
): boolean {
  if (!recoveryActive) return false
  if (pendingSince === null) return true
  return now - pendingSince < RECOVERY_DELAY_MS
}

/** 남은 시간 표시 (음수면 초과) */
export function formatRemaining(now: number, deadlineAt: number): string {
  const diff = deadlineAt - now
  const abs = Math.abs(diff)
  const min = Math.floor(abs / MIN)
  const sec = Math.floor((abs % MIN) / 1000)
  const body = min > 0 ? `${min}분 ${sec}초` : `${sec}초`
  return diff >= 0 ? `${body} 남음` : `${body} 지남`
}

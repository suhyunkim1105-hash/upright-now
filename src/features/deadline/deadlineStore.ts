import { create } from 'zustand'
import { loadLocal, saveLocal } from '@/lib/storage/local'
import {
  CELEBRATE_MESSAGE,
  type ChickPose,
  type DeadlineAlert,
  type DeadlineStage,
  stagesAtOrBefore,
} from './deadlineLogic'

/**
 * 마감 시각 상태 — 세션 단위. 카메라·자세 데이터와 결합하지 않습니다.
 * shownStages 를 저장해 새로고침·PIP 재생성에도 같은 알림이 중복되지 않습니다.
 * 친구 방에는 taskDeadlineAt 을 전송하지 않습니다.
 */
interface PersistShape {
  sessionId: string | null
  taskDeadlineAt: number | null
  alertsEnabled: boolean
  shownStages: DeadlineStage[]
  completed: boolean
}

interface ActivePanel {
  pose: ChickPose
  message: string
  /** celebrate 는 버튼 없이 잠시 보였다가 사라집니다 */
  celebratory: boolean
}

interface DeadlineStoreState extends PersistShape {
  panel: ActivePanel | null

  /** 세션 설정에서 마감을 지정 (null = 마감 없음) */
  configure: (sessionId: string, deadlineAt: number | null) => void
  markShown: (alert: DeadlineAlert) => void
  snooze: (minutes: number) => void
  complete: () => void
  disableForSession: () => void
  hidePanel: () => void
  reset: () => void
}

const KEY = 'deadline'

const initial: PersistShape = {
  sessionId: null,
  taskDeadlineAt: null,
  alertsEnabled: true,
  shownStages: [],
  completed: false,
}

const persisted = loadLocal<PersistShape>(KEY, initial)

function persist(state: PersistShape): void {
  saveLocal(KEY, state)
}

export const useDeadlineStore = create<DeadlineStoreState>((set, get) => ({
  ...initial,
  ...persisted,
  panel: null,

  configure: (sessionId, deadlineAt) => {
    const next: PersistShape = {
      sessionId,
      taskDeadlineAt: deadlineAt,
      alertsEnabled: deadlineAt !== null,
      shownStages: [],
      completed: false,
    }
    persist(next)
    set({ ...next, panel: null })
  },

  markShown: (alert) => {
    const s = get()
    const shownStages = s.shownStages.includes(alert.stage)
      ? s.shownStages
      : [...s.shownStages, alert.stage]
    persist({ ...snapshotPersist(s), shownStages })
    set({
      shownStages,
      panel: { pose: alert.pose, message: alert.message, celebratory: false },
    })
  },

  /**
   * 미루기 — XP·포인트 차감 없음.
   * 새 마감 기준으로 "현재 단계 이하"는 지나간 것으로 두고 다음 단계부터 알립니다.
   */
  snooze: (minutes) => {
    const s = get()
    if (s.taskDeadlineAt === null) return
    const now = Date.now()
    const base = Math.max(s.taskDeadlineAt, now)
    const newDeadline = base + minutes * 60_000
    const next: PersistShape = {
      ...snapshotPersist(s),
      taskDeadlineAt: newDeadline,
      shownStages: stagesAtOrBefore(now, newDeadline),
    }
    persist(next)
    set({ ...next, panel: null })
  },

  complete: () => {
    const s = get()
    const next: PersistShape = { ...snapshotPersist(s), completed: true }
    persist(next)
    set({
      completed: true,
      panel: { pose: 'celebrate', message: CELEBRATE_MESSAGE, celebratory: true },
    })
  },

  /** 이번 세션에서 알림 끄기 — 언제든 가능, 측정·타이머에 영향 없음 */
  disableForSession: () => {
    const s = get()
    const next: PersistShape = { ...snapshotPersist(s), alertsEnabled: false }
    persist(next)
    set({ alertsEnabled: false, panel: null })
  },

  hidePanel: () => set({ panel: null }),

  reset: () => {
    persist(initial)
    set({ ...initial, panel: null })
  },
}))

function snapshotPersist(s: DeadlineStoreState): PersistShape {
  return {
    sessionId: s.sessionId,
    taskDeadlineAt: s.taskDeadlineAt,
    alertsEnabled: s.alertsEnabled,
    shownStages: s.shownStages,
    completed: s.completed,
  }
}

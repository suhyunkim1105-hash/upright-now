import { create } from 'zustand'
import {
  createSessionTimeState,
  tickSession,
  type SessionTimeState,
} from './sessionMachine'
import { releaseSessionLocks } from './sessionLocks'
import { clampCustomFocusMin, clampCustomRestMin, DEFAULT_SESSION_LENGTH_ID, getSessionLength } from '@/constants/session'
import { DEFAULT_PROFILE_ID } from '@/constants/profiles'
import type { LearningProfileKind, PostureState, SessionMode } from '@/types'

interface SessionStoreState extends SessionTimeState {
  sessionId: string
  /** start() 를 누른 시각 (epoch ms). 요약의 날짜 집계에 씁니다. */
  startedAt: number
  subject: string
  goal: string
  lengthId: string
  restSec: number
  profileId: LearningProfileKind
  mode: SessionMode
  /** 타이머를 실제 시간의 몇 배로 돌릴지 — QA Lab 전용 */
  timeScale: number

  configure: (input: {
    subject?: string
    goal?: string
    lengthId?: string
    customFocusMin?: number
    customRestMin?: number
    profileId?: LearningProfileKind
    mode?: SessionMode
    /**
     * 친구 방 중간 합류 전용 — 방의 남은 시간(ms)만큼만 계획합니다.
     * 길이 프리셋보다 늘릴 수는 없고, 최소 1분은 보장합니다.
     */
    plannedMsOverride?: number
  }) => void
  start: (sessionId: string) => void
  tick: (deltaMs: number, posture: PostureState) => void
  pause: () => void
  resume: () => void
  /** 세션 중 스트레칭 — 타이머·자세 판정을 멈추고 같은 세션으로 돌아옵니다. */
  beginRest: () => void
  endRest: () => void
  finish: (status: 'completed' | 'aborted') => void
  /** QA 데모용 — 남은 시간을 건너뛰고 정상 완료 상태로 만듭니다. */
  completeNow: () => void
  setTimeScale: (scale: number) => void
  reset: () => void
}

const defaultLength = getSessionLength(DEFAULT_SESSION_LENGTH_ID)

const initialState = {
  ...createSessionTimeState(defaultLength.focusSec * 1000),
  sessionId: 'demo',
  startedAt: 0,
  subject: '',
  goal: '',
  lengthId: DEFAULT_SESSION_LENGTH_ID,
  restSec: defaultLength.restSec,
  profileId: DEFAULT_PROFILE_ID as LearningProfileKind,
  mode: 'solo' as SessionMode,
  timeScale: 1,
}

export const useSessionStore = create<SessionStoreState>((set) => ({
  ...initialState,

  configure: ({ subject, goal, lengthId, profileId, mode, customFocusMin, customRestMin, plannedMsOverride }) =>
    set((s) => {
      // 1분 빠른 점검 — 카메라·연출 확인 전용, 보상·출석·집계 없음
      if (lengthId === 'test') {
        return {
          ...s,
          lengthId: 'test',
          plannedMs: 60_000,
          restSec: 0,
          mode: mode ?? s.mode,
          subject: subject ?? s.subject,
          goal: goal ?? s.goal,
          profileId: profileId ?? s.profileId,
        }
      }
      const nextLengthId = lengthId ?? s.lengthId
      // 직접 설정: 집중 5~120분(5분 단위) · 회복 휴식 0~30분
      const custom = nextLengthId === 'custom'
      const focusSec = custom
        ? clampCustomFocusMin(customFocusMin ?? s.plannedMs / 60000) * 60
        : getSessionLength(nextLengthId).focusSec
      const restSec = custom
        ? clampCustomRestMin(customRestMin ?? s.restSec / 60) * 60
        : getSessionLength(nextLengthId).restSec
      // 중간 합류 — 방의 남은 시간만 계획합니다. 줄이기만 가능, 최소 1분.
      const plannedMs =
        plannedMsOverride && plannedMsOverride > 0
          ? Math.max(60_000, Math.min(plannedMsOverride, focusSec * 1000))
          : focusSec * 1000
      return {
        subject: subject ?? s.subject,
        goal: goal ?? s.goal,
        lengthId: nextLengthId,
        plannedMs,
        restSec,
        profileId: profileId ?? s.profileId,
        mode: mode ?? s.mode,
      }
    }),

  start: (sessionId) => {
    // 같은 id 재시작 시 종료 잠금·보상 상한을 풀어줍니다. (finalize 는 동적 import 순환 방지)
    releaseSessionLocks(sessionId)
    set((s) => ({
      ...createSessionTimeState(s.plannedMs),
      sessionId,
      startedAt: Date.now(),
      status: 'running',
    }))
  },

  tick: (deltaMs, posture) =>
    set((s) => tickSession(s, deltaMs * s.timeScale, posture)),

  pause: () => set((s) => (s.status === 'running' ? { status: 'paused' } : s)),

  resume: () => set((s) => (s.status === 'paused' ? { status: 'running' } : s)),

  beginRest: () =>
    set((s) =>
      s.status === 'running' || s.status === 'paused'
        ? { status: 'resting' }
        : s,
    ),

  endRest: () => set((s) => (s.status === 'resting' ? { status: 'running' } : s)),

  finish: (status) => set({ status }),

  completeNow: () =>
    set((s) => {
      const remaining = Math.max(0, s.plannedMs - s.elapsedMs)
      return {
        status: 'completed',
        elapsedMs: s.plannedMs,
        // 건너뛴 시간은 감지 가능 시간으로 채웁니다. (away·unstable 은 그대로)
        detectableMs: s.detectableMs + remaining,
      }
    }),

  setTimeScale: (scale) => set({ timeScale: Math.max(1, scale) }),

  reset: () => set({ ...initialState, timeScale: 1 }),
}))

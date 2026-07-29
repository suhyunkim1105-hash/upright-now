import { create } from 'zustand'
import { loadLocal, STORAGE_KEYS } from '@/lib/storage/local'
import type { SessionSummary } from '@/types'

/**
 * 완료·중단한 세션 요약 목록 — docs/15 §5
 * 프레임별 편차 로그는 저장하지 않습니다. 세션당 집계값만 남깁니다.
 */
interface SessionHistoryState {
  summaries: SessionSummary[]
  add: (summary: SessionSummary) => void
  /** 같은 sessionId(구버전은 id) 기록을 제자리 업데이트 — 새 기록을 만들지 않음 */
  update: (
    sessionId: string,
    patch: Partial<
      Pick<
        SessionSummary,
        'targetProgress' | 'targetProgressLabel' | 'nextAction' | 'aiReport'
      >
    >,
  ) => void
  clear: () => void
}

const loaded = loadLocal<SessionSummary[]>(STORAGE_KEYS.sessions, [])

export const useSessionHistoryStore = create<SessionHistoryState>((set) => ({
  summaries: loaded,
  add: (summary) =>
    set((s) => {
      // 최근 100개만 유지합니다.
      const next = [summary, ...s.summaries].slice(0, 100)
      return { summaries: next }
    }),
  update: (sessionId, patch) =>
    set((s) => ({
      summaries: s.summaries.map((x) =>
        x.sessionId === sessionId || x.id === sessionId ? { ...x, ...patch } : x,
      ),
    })),

  clear: () => set({ summaries: [] }),
}))

/** 다음 할 일 입력 정리 — HTML 태그·제어문자 제거, 최대 80자 */
export function sanitizeNextAction(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

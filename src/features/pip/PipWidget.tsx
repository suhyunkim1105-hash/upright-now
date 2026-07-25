import { CharacterViewport } from '@/components/character/CharacterViewport'
import { POSTURE_COPY } from '@/constants/copy'
import { remainingMs, formatClock } from '@/features/sessions/sessionMachine'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { usePostureStore } from '@/features/posture-engine/postureStore'
import { useGameStore } from '@/features/game/gameStore'
import { useCharacterStage } from '@/features/progression/progressionStore'
import { DeadlineAlertPanel } from '@/components/deadline/DeadlineAlertPanel'

/**
 * PIP 창 내용 — 기존 store(posture/session/progression/game)를 그대로 공유합니다.
 * 별도 타이머·자세 엔진 없음. 카메라 원본 영상은 절대 넣지 않습니다.
 */
export function PipWidget({ onClose }: { onClose: () => void }) {
  const stage = useCharacterStage()
  const snapshot = usePostureStore((s) => s.snapshot)
  const session = useSessionStore()
  const combo = useGameStore((s) => s.combo)

  const copy = POSTURE_COPY[snapshot.state]
  const remaining = remainingMs(session)

  return (
    <div className="flex h-full flex-col items-center gap-2 bg-canvas p-3 text-center">
      <CharacterViewport stage={stage} postureState={snapshot.state} size={120} />

      <p className="tabular text-3xl leading-none font-bold text-ink">
        {formatClock(remaining)}
      </p>

      <p aria-live="polite" className="text-[13px] leading-snug font-semibold text-ink">
        <span aria-hidden="true">{copy.icon}</span> {copy.message}
      </p>

      <p className="text-xs text-ink-soft">
        {`회복 콤보 `}
        <span className="tabular font-bold text-ink">{combo}</span>
        {`회`}
      </p>

      {/* 마감순경 삐약 — 기존 콘텐츠를 가리지 않는 작은 패널 (같은 store 동기화) */}
      <div className="w-full">
        <DeadlineAlertPanel compact />
      </div>

      <div className="mt-auto flex w-full flex-col gap-1.5">
        {session.status === 'running' ? (
          <button
            type="button"
            className="h-9 rounded-xl bg-pink text-sm font-bold text-white"
            onClick={() => useSessionStore.getState().pause()}
          >
            일시정지
          </button>
        ) : session.status === 'paused' ? (
          <button
            type="button"
            className="h-9 rounded-xl bg-pink text-sm font-bold text-white"
            onClick={() => useSessionStore.getState().resume()}
          >
            이어서 하기
          </button>
        ) : null}

        <div className="flex gap-1.5">
          <button
            type="button"
            className="h-9 flex-1 rounded-xl border border-line bg-surface text-sm font-semibold text-ink"
            onClick={() => {
              // 원래 화면(오프너 탭)으로 포커스를 되돌립니다.
              window.focus()
            }}
          >
            원래 화면
          </button>
          <button
            type="button"
            className="h-9 flex-1 rounded-xl border border-line bg-surface text-sm font-semibold text-ink-soft"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

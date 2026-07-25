import { useState } from 'react'
import { CharacterViewport } from '@/components/character/CharacterViewport'
import { POSTURE_COPY } from '@/constants/copy'
import { formatClock, remainingMs } from '@/features/sessions/sessionMachine'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { usePostureStore } from '@/features/posture-engine/postureStore'
import { useGameStore } from '@/features/game/gameStore'
import { useCharacterStage } from '@/features/progression/progressionStore'
import { DeadlineAlertPanel } from '@/components/deadline/DeadlineAlertPanel'

/**
 * 화면 안 미니 위젯 — PiP 미지원·차단 시 오른쪽 아래에 표시하는 대체 UI.
 * 카메라 원본 영상은 표시하지 않습니다.
 */
export function MiniPostureWidget() {
  const stage = useCharacterStage()
  const snapshot = usePostureStore((s) => s.snapshot)
  const session = useSessionStore()
  const combo = useGameStore((s) => s.combo)
  const [hidden, setHidden] = useState(false)

  if (hidden) return null

  const copy = POSTURE_COPY[snapshot.state]

  return (
    <aside
      data-testid="mini-posture-widget"
      aria-label="자세 미니 위젯"
      className="fixed right-4 bottom-4 z-40 w-[200px] rounded-2xl border border-line bg-surface p-3 text-center shadow-card"
    >
      <div className="flex justify-center">
        <CharacterViewport stage={stage} postureState={snapshot.state} size={88} />
      </div>
      <p className="tabular mt-1 text-2xl leading-none font-bold text-ink">
        {formatClock(remainingMs(session))}
      </p>
      <p className="mt-1 text-[11px] leading-snug font-semibold text-ink">
        <span aria-hidden="true">{copy.icon}</span> {copy.message}
      </p>
      <p className="mt-0.5 text-[11px] text-ink-soft">
        {`회복 콤보 `}
        <span className="tabular font-bold text-ink">{combo}</span>
        {`회`}
      </p>
      {/* 마감순경 삐약 — PIP 미지원 시에도 같은 알림 패널 표시 */}
      <div className="mt-2">
        <DeadlineAlertPanel compact />
      </div>

      <button
        type="button"
        className="mt-2 h-7 w-full rounded-lg border border-line bg-canvas text-[11px] font-semibold text-ink-soft"
        onClick={() => setHidden(true)}
      >
        위젯 숨기기
      </button>
    </aside>
  )
}

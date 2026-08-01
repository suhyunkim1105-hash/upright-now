import { useState } from 'react'
import { CharacterViewport } from '@/components/character/CharacterViewport'
import { CameraStreamVideo } from '@/components/session/CameraStreamPreview'
import { POSTURE_COPY } from '@/constants/copy'
import { remainingMs, formatClock } from '@/features/sessions/sessionMachine'
import { useSessionStore } from '@/features/sessions/sessionStore'
import { usePostureStore } from '@/features/posture-engine/postureStore'
import { useGameStore } from '@/features/game/gameStore'

/**
 * PIP 창 내용 — 기존 store(posture/session/progression/game)를 그대로 공유합니다.
 * 별도 타이머·자세 엔진 없음. 사용자가 선택하면 현재 세션의 기존 스트림만 미리보기로
 * 연결하며, 새 권한 요청·캡처·저장·전송은 하지 않습니다.
 */
export function PipWidget({
  onClose,
  onFocusMain,
  cameraStream = null,
}: {
  onClose: () => void
  onFocusMain: () => void
  cameraStream?: MediaStream | null
}) {
  const snapshot = usePostureStore((s) => s.snapshot)
  const session = useSessionStore()
  const combo = useGameStore((s) => s.combo)
  const attackTick = useGameStore((s) => s.attackTick)
  const [previewOpen, setPreviewOpen] = useState(false)

  const copy = POSTURE_COPY[snapshot.state]
  const remaining = remainingMs(session)

  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-2 overflow-auto bg-canvas p-3 text-center">
      <div className="flex w-full items-center justify-between gap-2">
        <span className="rounded-full bg-pink-soft px-2.5 py-1 text-[10px] font-black tracking-wide text-[#b8285a]">
          UPRIGHT NOW
        </span>
        <span className="rounded-full bg-surface px-2 py-1 text-[10px] font-bold text-ink-soft">
          집중 미니창
        </span>
      </div>

      <div className="relative grid size-[112px] place-items-center rounded-2xl border border-line bg-surface shadow-card">
        <span aria-hidden="true" className="absolute right-2 top-2 text-sm text-yellow">✦</span>
        <CharacterViewport
          stage={1}
          postureState={snapshot.state}
          size={96}
          attackTick={attackTick}
          attackDurationMs={1500}
        />
      </div>

      <p className="tabular text-3xl leading-none font-bold tracking-tight text-ink">
        {formatClock(remaining)}
      </p>

      <p aria-live="polite" className="w-full rounded-xl bg-surface px-3 py-2 text-[13px] leading-snug font-semibold text-ink">
        <span aria-hidden="true">{copy.icon}</span> {copy.message}
      </p>

      <p className="rounded-full bg-green-soft px-3 py-1 text-xs text-ink">
        {`회복 콤보 `}
        <span className="tabular font-bold text-ink">{combo}</span>
        {`회`}
      </p>

      {cameraStream ? (
        <div className="w-full overflow-hidden rounded-xl border border-line bg-canvas text-left">
          <button
            type="button"
            aria-expanded={previewOpen}
            aria-controls="pip-camera-preview"
            className="flex h-8 w-full items-center justify-between px-2 text-xs font-semibold text-ink"
            onClick={() => setPreviewOpen((open) => !open)}
          >
            <span>{previewOpen ? '내 모습 숨기기' : '내 모습 보기'}</span>
            <span aria-hidden="true">{previewOpen ? '⌃' : '⌄'}</span>
          </button>
          {previewOpen && (
            <div id="pip-camera-preview">
              <CameraStreamVideo
                stream={cameraStream}
                testId="pip-camera-preview"
                className="aspect-[4/3] w-full -scale-x-100 bg-ink/5 object-cover"
              />
            </div>
          )}
        </div>
      ) : (
        <p className="w-full text-left text-[11px] leading-snug text-ink-soft">
          카메라를 연결하면 여기에서 내 모습을 확인할 수 있어요.
        </p>
      )}

      <div className="mt-auto flex w-full flex-col gap-1.5">
        {session.status === 'running' ? (
          <button
            type="button"
            className="h-9 rounded-xl bg-[#b8285a] text-sm font-bold text-white hover:bg-[#9f204b]"
            onClick={() => useSessionStore.getState().pause()}
          >
            일시정지
          </button>
        ) : session.status === 'paused' ? (
          <button
            type="button"
            className="h-9 rounded-xl bg-[#b8285a] text-sm font-bold text-white hover:bg-[#9f204b]"
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
              onFocusMain()
            }}
          >
            전체 보기
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

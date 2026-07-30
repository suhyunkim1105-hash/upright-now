import { useEffect, useId, useRef, useState } from 'react'
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'
import * as Tooltip from '@radix-ui/react-tooltip'
import { CharacterViewport } from '@/components/character/CharacterViewport'
import { useCharacterStage } from '@/features/progression/progressionStore'
import { usePostureStore } from '@/features/posture-engine/postureStore'

interface CameraStreamVideoProps {
  stream: MediaStream | null
  className: string
  testId?: string
}

/**
 * 기존 세션 스트림을 화면에만 연결하는 비디오입니다.
 * 새 권한 요청, 캡처, 저장, 네트워크 전송은 하지 않습니다.
 */
export function CameraStreamVideo({ stream, className, testId }: CameraStreamVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.srcObject = stream
    if (stream) {
      try {
        const playback = video.play?.()
        if (playback && typeof playback.catch === 'function') void playback.catch(() => {})
      } catch {
      }
    }

    return () => {
      if (video.srcObject === stream) video.srcObject = null
    }
  }, [stream])

  return (
    <video
      ref={videoRef}
      data-testid={testId}
      aria-label="내 모습 카메라 미리보기"
      muted
      playsInline
      className={className}
    />
  )
}

interface DragState {
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
}

const COLLAPSED_SIZE = 64
const EXPANDED_WIDTH = 208
const EXPANDED_HEIGHT = 260
const VIEWPORT_GUTTER = 16

function clampOffset(value: number, viewportSize: number, surfaceSize: number): number {
  return Math.min(0, Math.max(-(viewportSize - surfaceSize - VIEWPORT_GUTTER * 2), value))
}

function PrivacyHint() {
  const tooltipId = useId()
  const referenceRef = useRef<HTMLButtonElement>(null)
  const floatingRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const reference = referenceRef.current
    const floating = floatingRef.current
    if (!open || !reference || !floating) return

    const updatePosition = () => {
      void computePosition(reference, floating, {
        placement: 'top-end',
        strategy: 'fixed',
        middleware: [offset(8), flip(), shift({ padding: 12 })],
      }).then(({ x, y }) => {
        Object.assign(floating.style, {
          left: `${x}px`,
          top: `${y}px`,
        })
      })
    }

    return autoUpdate(reference, floating, updatePosition)
  }, [open])

  return (
    <>
      <button
        ref={referenceRef}
        type="button"
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        className="rounded-lg px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft hover:bg-canvas"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
        }}
      >
        왜 안전한가요?
      </button>
      {open && (
        <div
          ref={floatingRef}
          id={tooltipId}
          role="tooltip"
          className="fixed z-50 w-48 rounded-xl border border-green/25 bg-surface px-3 py-2 text-[11px] leading-5 text-ink-soft shadow-card"
        >
          이 미리보기는 이미 허용된 카메라 스트림만 화면에 보여 줘요. 저장하거나 외부로 보내지 않아요.
        </div>
      )}
    </>
  )
}

/**
 * 세션 화면의 선택형 자기 모습 PiP입니다.
 * Document PiP 창 위치는 브라우저가 관리하므로, 이 인앱 위젯에서만 기본 우측 하단과
 * 사용자의 드래그 위치 조절을 제공합니다.
 */
export function SessionCameraPreview({ stream }: { stream: MediaStream | null }) {
  const stage = useCharacterStage()
  const postureState = usePostureStore((s) => s.snapshot.state)
  const [expanded, setExpanded] = useState(false)
  const [previewOffset, setPreviewOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<DragState | null>(null)

  if (!stream) return null

  const surfaceWidth = expanded ? EXPANDED_WIDTH : COLLAPSED_SIZE
  const surfaceHeight = expanded ? EXPANDED_HEIGHT : COLLAPSED_SIZE

  const updateDragPosition = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    setPreviewOffset({
      x: clampOffset(
        drag.originX + event.clientX - drag.startX,
        window.innerWidth,
        surfaceWidth,
      ),
      y: clampOffset(
        drag.originY + event.clientY - drag.startY,
        window.innerHeight,
        surfaceHeight,
      ),
    })
  }

  const movePreview = (deltaX: number, deltaY: number) => {
    setPreviewOffset((current) => ({
      x: clampOffset(current.x + deltaX, window.innerWidth, surfaceWidth),
      y: clampOffset(current.y + deltaY, window.innerHeight, surfaceHeight),
    }))
  }

  return (
    <aside
      data-testid="session-camera-preview"
      aria-label="내 모습 미리보기"
      className="fixed right-4 bottom-4 z-40"
      style={{ transform: `translate3d(${previewOffset.x}px, ${previewOffset.y}px, 0)` }}
    >
      {expanded ? (
        <div className="w-52 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="flex items-center justify-between gap-2 border-b border-line bg-canvas px-3 py-2">
            <button
              type="button"
              aria-label="미리보기 위치 이동"
              className="cursor-grab touch-none rounded-lg px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft active:cursor-grabbing"
              onPointerDown={(event) => {
                if (event.button !== 0) return
                event.currentTarget.setPointerCapture?.(event.pointerId)
                dragRef.current = {
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                  originX: previewOffset.x,
                  originY: previewOffset.y,
                }
              }}
              onPointerMove={updateDragPosition}
              onPointerUp={(event) => {
                if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
              }}
              onPointerCancel={() => {
                dragRef.current = null
              }}
              onKeyDown={(event) => {
                const distance = 16
                if (event.key === 'ArrowLeft') movePreview(-distance, 0)
                else if (event.key === 'ArrowRight') movePreview(distance, 0)
                else if (event.key === 'ArrowUp') movePreview(0, -distance)
                else if (event.key === 'ArrowDown') movePreview(0, distance)
                else return
                event.preventDefault()
              }}
            >
              내 모습 · 드래그해 이동
            </button>
            <button
              type="button"
              className="rounded-lg px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft"
              onClick={() => setExpanded(false)}
            >
              접기
            </button>
          </div>
          <CameraStreamVideo
            stream={stream}
            testId="session-camera-preview-video"
            className="aspect-[4/3] w-full -scale-x-100 bg-ink/5 object-cover"
          />
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] leading-snug text-ink-soft">내 기기에서만 확인해요.</p>
              <PrivacyHint />
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft"
              onClick={() => setPreviewOffset({ x: 0, y: 0 })}
            >
              위치 초기화
            </button>
          </div>
        </div>
      ) : (
        <Tooltip.Provider delayDuration={300}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                aria-expanded="false"
                aria-label="내 모습 보기"
                className="group relative grid size-16 place-items-center overflow-hidden rounded-2xl border border-pink/30 bg-pink-soft shadow-card"
                onClick={() => setExpanded(true)}
              >
                <span
                  aria-hidden="true"
                  className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-surface text-[9px] font-black text-pink"
                >
                  +
                </span>
                <CharacterViewport stage={stage} postureState={postureState} size={48} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="left"
                sideOffset={8}
                className="z-50 rounded-lg bg-ink px-2 py-1 text-[11px] font-semibold text-white shadow-card"
              >
                내 모습 확인하기
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      )}
    </aside>
  )
}

import { useEffect, useRef, useState } from 'react'
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
const EXPANDED_WIDTH = 176
const EXPANDED_HEIGHT = 178
const VIEWPORT_GUTTER = 16

function clampOffset(value: number, viewportSize: number, surfaceSize: number): number {
  return Math.min(0, Math.max(-(viewportSize - surfaceSize - VIEWPORT_GUTTER * 2), value))
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
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<DragState | null>(null)

  if (!stream) return null

  const surfaceWidth = expanded ? EXPANDED_WIDTH : COLLAPSED_SIZE
  const surfaceHeight = expanded ? EXPANDED_HEIGHT : COLLAPSED_SIZE

  const updateDragPosition = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    setOffset({
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
    setOffset((current) => ({
      x: clampOffset(current.x + deltaX, window.innerWidth, surfaceWidth),
      y: clampOffset(current.y + deltaY, window.innerHeight, surfaceHeight),
    }))
  }

  return (
    <aside
      data-testid="session-camera-preview"
      aria-label="내 모습 미리보기"
      className="fixed right-4 bottom-4 z-40"
      style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
    >
      {expanded ? (
        <div className="w-44 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="flex items-center justify-between gap-2 border-b border-line bg-canvas px-2 py-1.5">
            <button
              type="button"
              aria-label="미리보기 위치 이동"
              className="cursor-grab touch-none rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft active:cursor-grabbing"
              onPointerDown={(event) => {
                if (event.button !== 0) return
                event.currentTarget.setPointerCapture?.(event.pointerId)
                dragRef.current = {
                  pointerId: event.pointerId,
                  startX: event.clientX,
                  startY: event.clientY,
                  originX: offset.x,
                  originY: offset.y,
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
              드래그해 이동
            </button>
            <button
              type="button"
              className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft"
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
          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
            <p className="text-[10px] leading-snug text-ink-soft">영상은 저장하지 않아요.</p>
            <button
              type="button"
              className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft"
              onClick={() => setOffset({ x: 0, y: 0 })}
            >
              위치 초기화
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          aria-expanded="false"
          aria-label="내 모습 보기"
          title="내 모습 보기"
          className="grid size-16 place-items-center rounded-2xl border border-line bg-surface shadow-card"
          onClick={() => setExpanded(true)}
        >
          <CharacterViewport stage={stage} postureState={postureState} size={48} />
        </button>
      )}
    </aside>
  )
}

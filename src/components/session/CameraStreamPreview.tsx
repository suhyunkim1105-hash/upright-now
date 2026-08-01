import { useEffect, useRef } from 'react'

interface CameraStreamVideoProps {
  stream: MediaStream | null
  className: string
  testId?: string
}

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
      } catch {}
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

export function SessionCameraPanel({
  stream,
  status,
  onRetry,
}: {
  stream: MediaStream | null
  status: 'idle' | 'requesting' | 'ready' | 'error'
  onRetry?: () => void
}) {
  return (
    <section
      data-testid="session-camera-panel"
      aria-label="세션 카메라 확인"
      className="overflow-hidden rounded-2xl border border-ink/10 bg-surface shadow-card"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line bg-canvas px-3 py-2">
        <p className="text-xs font-bold text-ink">내 모습</p>
        <span className="rounded-full bg-green-soft px-2 py-0.5 text-[10px] font-bold text-green">
          내 기기에서만 확인
        </span>
      </div>
      {stream ? (
        <CameraStreamVideo
          stream={stream}
          testId="session-camera-panel-video"
          className="aspect-[4/3] w-full -scale-x-100 bg-ink/5 object-cover"
        />
      ) : (
        <div className="grid aspect-[4/3] place-items-center bg-canvas px-5 text-center text-xs leading-5 text-ink-soft">
          {status === 'error'
            ? '카메라를 연결하지 못했어요. 권한과 다른 앱의 카메라 사용 여부를 확인해 주세요.'
            : '세션 카메라를 연결하고 있어요.'}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <p className="text-[11px] leading-5 text-ink-soft">
          이 영상은 저장하거나 외부로 전송하지 않아요. 탭을 벗어나면 아기 거북이 PiP에서 다시 열 수 있어요.
        </p>
        {status === 'error' && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded-lg border border-line bg-canvas px-2 py-1 text-[11px] font-bold text-ink"
          >
            다시 연결
          </button>
        )}
      </div>
    </section>
  )
}

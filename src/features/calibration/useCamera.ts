import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * getUserMedia 카메라 수명주기 — docs/14 §3
 *
 * 권한 요청은 사용자 CTA 이후에만. 화면·세션 종료 시 모든 트랙을 정지합니다.
 * 카메라 영상·프레임은 브라우저 메모리에서만 쓰고 네트워크로 보내지 않습니다.
 */
export type CameraError =
  | 'permission-denied'
  | 'no-device'
  | 'in-use'
  | 'unknown'

export interface CameraState {
  status: 'idle' | 'requesting' | 'ready' | 'error'
  error: CameraError | null
  devices: MediaDeviceInfo[]
  deviceId: string | null
}

export interface UseCameraOptions {
  keepStreamOnUnmount?: boolean
}

let activeStream: MediaStream | null = null

function hasLiveVideoTrack(stream: MediaStream | null): stream is MediaStream {
  return Boolean(
    stream?.getVideoTracks().some((track) => track.readyState === 'live'),
  )
}

function classifyError(error: unknown): CameraError {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'permission-denied'
    }
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
      return 'no-device'
    }
    if (error.name === 'NotReadableError' || error.name === 'AbortError') {
      return 'in-use'
    }
  }
  return 'unknown'
}

export function useCamera(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: UseCameraOptions = {},
) {
  const streamRef = useRef<MediaStream | null>(activeStream)
  const [stream, setStream] = useState<MediaStream | null>(() =>
    hasLiveVideoTrack(activeStream) ? activeStream : null,
  )
  const [state, setState] = useState<CameraState>({
    status: 'idle',
    error: null,
    devices: [],
    deviceId: null,
  })
  const startPromiseRef = useRef<Promise<void> | null>(null)

  const stop = useCallback(() => {
    if (streamRef.current) {
      // 모든 MediaStreamTrack 을 반드시 정지합니다.
      for (const track of streamRef.current.getTracks()) track.stop()
      if (activeStream === streamRef.current) activeStream = null
      streamRef.current = null
      setStream(null)
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setState((s) => ({ ...s, status: 'idle', error: null }))
  }, [videoRef])

  const start = useCallback(
    (deviceId?: string) => {
      if (startPromiseRef.current) return startPromiseRef.current

      const request = (async () => {
      setState((s) => ({ ...s, status: 'requesting', error: null }))
      try {
        const reusableStream =
          !deviceId && hasLiveVideoTrack(activeStream) ? activeStream : null

        if (reusableStream) {
          streamRef.current = reusableStream
          setStream(reusableStream)
          if (videoRef.current) {
            videoRef.current.srcObject = reusableStream
            const playback = videoRef.current.play?.()
            if (playback && typeof playback.catch === 'function') {
              await playback.catch(() => {})
            }
          }

          const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
            (d) => d.kind === 'videoinput',
          )
          const activeId =
            reusableStream.getVideoTracks()[0]?.getSettings().deviceId ?? null
          setState({ status: 'ready', error: null, devices, deviceId: activeId })
          return
        }

        // 기존 스트림이 있으면 먼저 정지합니다.
        if (streamRef.current) {
          for (const track of streamRef.current.getTracks()) track.stop()
          streamRef.current = null
        }

        const constraints: MediaStreamConstraints = {
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        }

        const nextStream = await navigator.mediaDevices.getUserMedia(constraints)
        streamRef.current = nextStream
        activeStream = nextStream
        setStream(nextStream)
        if (videoRef.current) {
          videoRef.current.srcObject = nextStream
          // jsdom 등에서는 play() 가 Promise 를 반환하지 않을 수 있습니다.
          const playback = videoRef.current.play?.()
          if (playback && typeof playback.catch === 'function') {
            await playback.catch(() => {})
          }
        }

        // 권한을 얻은 뒤에야 장치 라벨이 채워집니다.
        const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
          (d) => d.kind === 'videoinput',
        )
        const activeId =
          nextStream.getVideoTracks()[0]?.getSettings().deviceId ?? deviceId ?? null

        setState({ status: 'ready', error: null, devices, deviceId: activeId })
      } catch (error) {
        setState((s) => ({
          ...s,
          status: 'error',
          error: classifyError(error),
        }))
      }
      })()

      startPromiseRef.current = request.finally(() => {
        if (startPromiseRef.current === request) startPromiseRef.current = null
      })
      return startPromiseRef.current
    },
    [videoRef],
  )

  // 언마운트 시 항상 정지합니다.
  useEffect(() => {
    const video = videoRef.current
    return () => {
      if (options.keepStreamOnUnmount) {
        if (video) video.srcObject = null
        return
      }
      stop()
    }
  }, [options.keepStreamOnUnmount, stop, videoRef])

  return { state, stream, start, stop }
}

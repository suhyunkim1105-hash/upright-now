import { useEffect, useRef, useState } from 'react'
import { loadFaceLandmarker, loadPoseLandmarker } from '@/lib/mediapipe/loader'
import { analyzeLandmarks, type Landmark, type LandmarkAnalysis } from './features'
import { LandmarkSmoother } from './oneEuro'
import { headPoseFromMatrix } from './headPose'

/**
 * 비디오 프레임에서 Pose 를 추론해 랜드마크 분석을 콜백으로 넘깁니다. — docs/06 §14
 *
 * - 추론 빈도를 제한합니다(기본 ~12fps).
 * - 같은 프레임을 중복 처리하지 않습니다.
 * - 원본 프레임·랜드마크 시계열을 저장하지 않습니다. 각 프레임은 즉시 폐기됩니다.
 * - 두 명 이상 인식되면 multiPerson 으로 알립니다.
 */
export interface PoseFrame {
  analysis: LandmarkAnalysis | null
  multiPerson: boolean
}

export interface PoseDetectionOptions {
  enabled: boolean
  fps?: number
  onFrame: (frame: PoseFrame) => void
}

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error'

export function usePoseDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  { enabled, fps = 12, onFrame }: PoseDetectionOptions,
) {
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle')
  const onFrameRef = useRef(onFrame)
  onFrameRef.current = onFrame

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let rafId = 0
    let timeoutId = 0
    let lastAt = 0
    const smoother = new LandmarkSmoother()
    let faceLandmarker: Awaited<ReturnType<typeof loadFaceLandmarker>> | null = null
    let lastVideoTime = -1
    const minInterval = 1000 / fps

    const run = async () => {
      setModelStatus('loading')
      let landmarker
      try {
        landmarker = await loadPoseLandmarker()
      } catch {
        if (!cancelled) setModelStatus('error')
        return
      }
      if (cancelled) return
      setModelStatus('ready')

      // 얼굴 메시는 **있으면 좋은** 것입니다. 로드에 실패해도 Pose 축만으로
      // 판정을 계속합니다 — 새 모델 때문에 세션이 통째로 막히면 안 됩니다.
      loadFaceLandmarker()
        .then((lm) => {
          if (cancelled) lm.close()
          else faceLandmarker = lm
        })
        .catch((error) => {
          console.warn('Face Landmarker 없이 진행합니다.', error)
        })

      // 탭이 백그라운드로 가면 rAF 가 멈춰 감지가 통째로 얼어붙습니다
      // (PiP 위젯이 unstable 로 굳던 원인). 숨김 상태에서는 setTimeout 으로
      // 루프를 이어갑니다. 카메라를 캡처 중인 탭은 브라우저의 공격적 타이머
      // 지연 대상에서 제외되어 감지 주기가 유지됩니다.
      const schedule = () => {
        if (typeof document !== 'undefined' && document.hidden) {
          timeoutId = window.setTimeout(loop, minInterval)
        } else {
          rafId = requestAnimationFrame(loop)
        }
      }

      const loop = () => {
        if (cancelled) return
        schedule()

        const video = videoRef.current
        if (!video || video.readyState < 2) return

        const now = performance.now()
        if (now - lastAt < minInterval) return
        // 같은 프레임은 중복 처리하지 않습니다.
        if (video.currentTime === lastVideoTime) return
        lastAt = now
        lastVideoTime = video.currentTime

        try {
          const result = landmarker.detectForVideo(video, now)
          const people = result.landmarks ?? []
          const raw = people[0] as Landmark[] | undefined
          // 지터를 먼저 깎아야 눈 사이 거리 같은 작은 축이 신호를 유지합니다.
          // 사람을 놓치면 필터를 비워, 다음 사람의 첫 프레임이 이전 좌표에서
          // 서서히 끌려오지 않게 합니다.
          if (!raw) smoother.reset()

          // 같은 프레임, 같은 타임스탬프로 얼굴도 한 번 추론합니다.
          // 실패는 삼키고 머리 축만 비웁니다.
          let headPose = null
          if (faceLandmarker && raw) {
            try {
              const face = faceLandmarker.detectForVideo(video, now)
              headPose = headPoseFromMatrix(
                face.facialTransformationMatrixes?.[0]?.data,
              )
            } catch {
              headPose = null
            }
          }

          onFrameRef.current({
            analysis: analyzeLandmarks(smoother.smooth(raw, now), headPose),
            multiPerson: people.length > 1,
          })
        } catch {
          smoother.reset()
          onFrameRef.current({ analysis: null, multiPerson: false })
        }
      }
      loop()
    }

    run()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      window.clearTimeout(timeoutId)
    }
  }, [enabled, fps, videoRef])

  return { modelStatus }
}

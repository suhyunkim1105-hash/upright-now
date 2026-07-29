import { useEffect, useRef, useState } from 'react'
import {
  evaluateFrameQuality,
  sampleLuminance,
  type FrameQualityReading,
} from './frameQuality'

const SAMPLE_WIDTH = 32
const SAMPLE_HEIGHT = 24

const PENDING_READING: FrameQualityReading = {
  quality: 'pending',
  luminance: 0,
  contrast: 0,
  motion: 0,
}

export function useFrameQuality(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  fps = 4,
) {
  const [reading, setReading] = useState<FrameQualityReading>(PENDING_READING)
  const previousRef = useRef<Float32Array | null>(null)

  useEffect(() => {
    if (!enabled) {
      previousRef.current = null
      setReading(PENDING_READING)
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = SAMPLE_WIDTH
    canvas.height = SAMPLE_HEIGHT
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) return

    let cancelled = false
    let rafId = 0
    let lastSampleAt = 0
    const interval = 1000 / fps

    const sample = () => {
      if (cancelled) return
      rafId = requestAnimationFrame(sample)

      const video = videoRef.current
      const now = performance.now()
      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || now - lastSampleAt < interval) {
        return
      }

      lastSampleAt = now
      context.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT)
      const luminance = sampleLuminance(
        context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data,
      )
      const next = evaluateFrameQuality(luminance, previousRef.current)
      previousRef.current = luminance
      setReading(next)
    }

    sample()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      previousRef.current = null
    }
  }, [enabled, fps, videoRef])

  return reading
}

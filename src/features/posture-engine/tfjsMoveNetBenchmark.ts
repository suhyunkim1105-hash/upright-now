import * as tf from '@tensorflow/tfjs-core'
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm'
import { load as loadMoveNet } from '@tensorflow-models/pose-detection/dist/movenet/detector'
import type { PoseDetector } from '@tensorflow-models/pose-detection/dist/pose_detector'
import wasmPath from '@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm.wasm?url'
import wasmSimdPath from '@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm-simd.wasm?url'
import wasmThreadedSimdPath from '@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm-threaded-simd.wasm?url'

export interface MoveNetBenchmark {
  status: 'ready'
  backend: 'wasm'
  loadMs: number
  medianInferenceMs: number
  estimatedFps: number
  detectedFrames: number
  sampleCount: number
}

export interface MoveNetBenchmarkFailure {
  status: 'error'
  message: string
}

export type MoveNetBenchmarkResult = MoveNetBenchmark | MoveNetBenchmarkFailure

function median(values: number[]): number {
  const sorted: number[] = []
  for (const value of values) {
    const index = sorted.findIndex((item) => item > value)
    if (index === -1) sorted.push(value)
    else sorted.splice(index, 0, value)
  }
  const midpoint = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint]
}

export function summarizeMoveNetBenchmark(
  loadMs: number,
  inferenceMs: number[],
  detectedFrames: number,
): MoveNetBenchmark {
  const medianInferenceMs = Math.round(median(inferenceMs))
  return {
    status: 'ready',
    backend: 'wasm',
    loadMs: Math.round(loadMs),
    medianInferenceMs,
    estimatedFps: Math.max(1, Math.round(1000 / medianInferenceMs)),
    detectedFrames,
    sampleCount: inferenceMs.length,
  }
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

export async function benchmarkMoveNet(
  video: HTMLVideoElement,
  sampleCount = 10,
): Promise<MoveNetBenchmarkResult> {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return { status: 'error', message: '카메라 프레임을 기다리는 중이에요.' }
  }

  const startedAt = performance.now()
  let detector: PoseDetector | null = null

  try {
    setWasmPaths({
      'tfjs-backend-wasm.wasm': wasmPath,
      'tfjs-backend-wasm-simd.wasm': wasmSimdPath,
      'tfjs-backend-wasm-threaded-simd.wasm': wasmThreadedSimdPath,
    })
    const active = await tf.setBackend('wasm')
    if (!active) return { status: 'error', message: 'WASM 실행 환경을 준비하지 못했어요.' }
    await tf.ready()

    detector = await loadMoveNet({
      modelType: 'SinglePose.Lightning',
      enableSmoothing: true,
    })
    const loadMs = performance.now() - startedAt
    const durations: number[] = []
    let detectedFrames = 0

    for (let index = 0; index < sampleCount; index += 1) {
      await nextAnimationFrame()
      const inferenceStartedAt = performance.now()
      const poses = await detector.estimatePoses(video, { flipHorizontal: true })
      durations.push(performance.now() - inferenceStartedAt)
      if (poses.length > 0) detectedFrames += 1
    }

    return summarizeMoveNetBenchmark(loadMs, durations, detectedFrames)
  } catch {
    return { status: 'error', message: 'MoveNet/WASM 진단을 준비하지 못했어요.' }
  } finally {
    detector?.dispose()
  }
}

import { describe, expect, it } from 'vitest'
import { summarizeMoveNetBenchmark } from './tfjsMoveNetBenchmark'

describe('MoveNet/WASM benchmark summary', () => {
  it('중앙값 추론 시간과 감지 프레임만 요약한다', () => {
    expect(summarizeMoveNetBenchmark(250.4, [18, 20, 22, 24, 400], 4)).toEqual({
      status: 'ready',
      backend: 'wasm',
      loadMs: 250,
      medianInferenceMs: 22,
      estimatedFps: 45,
      detectedFrames: 4,
      sampleCount: 5,
    })
  })
})

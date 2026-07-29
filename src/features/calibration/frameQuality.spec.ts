import { describe, expect, it } from 'vitest'
import { evaluateFrameQuality, sampleLuminance } from './frameQuality'

function pixels(values: number[]): Uint8ClampedArray {
  return new Uint8ClampedArray(values.flatMap((value) => [value, value, value, 255]))
}

describe('frame quality — 브라우저 메모리 내 조도·대비·움직임 게이트', () => {
  it('밝고 대비가 있는 프레임은 good 이다', () => {
    const luminance = sampleLuminance(pixels([40, 210, 45, 205]))
    expect(evaluateFrameQuality(luminance, null).quality).toBe('good')
  })

  it('어두운 프레임은 dim 으로 제외한다', () => {
    const luminance = sampleLuminance(pixels([12, 18, 20, 16]))
    expect(evaluateFrameQuality(luminance, null).quality).toBe('dim')
  })

  it('대비가 부족한 프레임은 low-contrast 로 제외한다', () => {
    const luminance = sampleLuminance(pixels([128, 129, 127, 128]))
    expect(evaluateFrameQuality(luminance, null).quality).toBe('low-contrast')
  })

  it('연속 프레임 변화가 과하면 motion 으로 제외한다', () => {
    const previous = sampleLuminance(pixels([50, 60, 70, 80]))
    const current = sampleLuminance(pixels([180, 190, 200, 210]))
    expect(evaluateFrameQuality(current, previous).quality).toBe('motion')
  })
})

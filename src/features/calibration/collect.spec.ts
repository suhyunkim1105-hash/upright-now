import { describe, expect, it } from 'vitest'
import {
  collectStep,
  createCollectState,
  FRAMING_MS,
  MIN_VALID_SAMPLES,
  TARGET_MS,
  type CollectState,
} from './collect'
import { analyzeLandmarks } from '@/features/posture-engine/features'
import { makeLandmarks } from '@/features/posture-engine/testFixtures'
import { isDistanceMismatch } from '@/features/posture-engine/classify'

const goodFrame = () => analyzeLandmarks(makeLandmarks())

/** intervalMs 간격으로 프레임을 흘려보냅니다. */
function feed(
  state: CollectState,
  fromMs: number,
  toMs: number,
  intervalMs = 83,
): { state: CollectState; profile: ReturnType<typeof collectStep>['profile']; lastStep: 1 | 2 | 3 } {
  let s = state
  let profile = null
  let lastStep: 1 | 2 | 3 = 1
  for (let now = fromMs; now <= toMs; now += intervalMs) {
    const step = collectStep(s, { analysis: goodFrame(), now, deviceIdHash: 'dev1' })
    s = step.state
    lastStep = step.step
    if (step.profile) profile = step.profile
  }
  return { state: s, profile, lastStep }
}

describe('캘리브레이션 v3 타이밍 (MODE+CALIBRATION 스프린트)', () => {
  it('프레이밍 1.5초 전에는 표본을 모으지 않는다 (1단계)', () => {
    const { state, lastStep } = feed(createCollectState(), 0, FRAMING_MS - 100)
    expect(state.samples.length).toBe(0)
    expect(lastStep).toBe(1)
  })

  it('표본 40개가 일찍 쌓여도 5초 전에는 완료되지 않는다', () => {
    // 10ms 간격 폭주 → 2초 안에 표본 40개 초과
    const fast = feed(createCollectState(), 0, FRAMING_MS + 2500, 10)
    expect(fast.state.samples.length).toBeGreaterThan(MIN_VALID_SAMPLES)
    expect(fast.profile).toBeNull() // wall-clock 5초 미달 → 미완료
  })

  it('wall-clock 5초 + 40표본 + 5구간 커버일 때만 완료된다', () => {
    const { profile } = feed(
      createCollectState(),
      0,
      FRAMING_MS + TARGET_MS + 300,
    )
    expect(profile).not.toBeNull()
    expect(profile!.quality.validSampleCount).toBeGreaterThanOrEqual(
      MIN_VALID_SAMPLES,
    )
    expect(profile!.deviceIdHash).toBe('dev1')
  })

  it('한 1초 구간이 통째로 비면(가림 등) 5초가 지나도 완료되지 않는다', () => {
    let s = createCollectState()
    // 프레이밍 + 표본 구간 0·1 정상 (수집 경과 <2000ms 까지만)
    let r = feed(s, 0, FRAMING_MS + 1900, 50)
    s = r.state
    // 수집 경과 2000~3000ms 구간 전체: 사람 미감지 (버킷 2 완전 비움)
    for (let now = FRAMING_MS + 1950; now <= FRAMING_MS + 3050; now += 50) {
      const step = collectStep(s, { analysis: null, now })
      s = step.state
      expect(step.profile).toBeNull()
    }
    // 이후 정상 프레임으로 5초 경과
    r = feed(s, FRAMING_MS + 3100, FRAMING_MS + TARGET_MS + 600, 50)
    // 표본 수는 충분해도 구간 2 가 비어 미완료
    expect(r.state.samples.length).toBeGreaterThanOrEqual(MIN_VALID_SAMPLES)
    expect(r.profile).toBeNull()
  })

  it('사람 미감지·한쪽 어깨 없음은 프레이밍 연속성을 끊는다', () => {
    let s = createCollectState()
    s = collectStep(s, { analysis: goodFrame(), now: 0 }).state
    s = collectStep(s, { analysis: null, now: 500 }).state
    // 다시 유효 프레임 — framingSince 가 리셋되어 1.5초를 다시 채워야 함
    const r = collectStep(s, { analysis: goodFrame(), now: 600 })
    expect(r.step).toBe(1)
    expect(r.state.samplingStartedAt).toBeNull()
  })

  it('어두움·저대비·카메라 흔들림 프레임은 표본으로 쓰지 않는다', () => {
    for (const [frameQuality, expected] of [
      ['dim', 'dim'],
      ['low-contrast', 'low-contrast'],
      ['motion', 'camera-motion'],
    ] as const) {
      const result = collectStep(createCollectState(), {
        analysis: goodFrame(),
        now: 0,
        frameQuality,
      })
      expect(result.quality).toBe(expected)
      expect(result.validCount).toBe(0)
      expect(result.state.framingSince).toBeNull()
    }
  })

  it('원본 좌표·프레임은 프로필에 저장되지 않는다', () => {
    const { profile } = feed(createCollectState(), 0, FRAMING_MS + TARGET_MS + 300)
    const json = JSON.stringify(profile)
    expect(json).not.toContain('"x"')
    expect(json).not.toContain('landmark')
    expect(json).not.toContain('points')
    // 요약 통계만 존재
    expect(profile!.features.faceScaleRatio?.median).toBeGreaterThan(0)
    expect(profile!.features.faceScaleRatio?.mad).toBeDefined()
  })
})

describe('카메라 거리 확인', () => {
  it('어깨 너비가 기준보다 20% 이상 다르면 안내 대상이다', () => {
    expect(isDistanceMismatch(0.24, 0.24)).toBe(false)
    expect(isDistanceMismatch(0.24 * 1.25, 0.24)).toBe(true)
  })
})

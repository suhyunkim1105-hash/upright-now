/**
 * 합성 자세 평가 하네스 — 판정 축 선택이 실제로 맞는지 숫자로 확인합니다.
 *
 * 단위 테스트가 아니라 **측정 도구**입니다. 3D 인체 모형을 원근 투영해
 * MediaPipe 랜드마크를 흉내 내고, 시나리오별 검출률/오탐률을 잽니다.
 * 임계값이나 특징 목록을 건드릴 때 이 파일을 먼저 돌려 보세요.
 *
 * 좌표계: 어깨 중앙이 원점. x 오른쪽, y 위, z 카메라 쪽이 +.
 */
import { describe, expect, it } from 'vitest'
import { analyzeLandmarks, mad, median, type Landmark } from './features'
import { computeVotes } from './classify'
import { LandmarkSmoother } from './oneEuro'
import type { HeadPose } from './headPose'
import type { CalibrationProfile } from '@/features/calibration/calibrationStore'
import type { FeatureKey } from './features'

/* ------------------------------ 인체 모형 ------------------------------ */

/** 목뿌리(C7) 기준 머리 국소 좌표 (미터) */
const HEAD_LOCAL = {
  leftEyeOuter: [0.032, 0.155, 0.075],
  rightEyeOuter: [-0.032, 0.155, 0.075],
  nose: [0, 0.125, 0.115],
  leftEar: [0.075, 0.15, -0.01],
  rightEar: [-0.075, 0.15, -0.01],
} as const

/** 어깨 원점 기준 몸통 좌표 */
const BODY = {
  leftShoulder: [0.19, 0, 0],
  rightShoulder: [-0.19, 0, 0],
  leftHip: [0.13, -0.5, 0.02],
  rightHip: [-0.13, -0.5, 0.02],
} as const

const NECK_PIVOT = [0, 0.1, -0.02] as const

const CAMERA_DISTANCE = 1.6
const FOCAL = 1.0

interface Pose {
  /** 머리가 목뿌리에서 앞으로 나간 거리 (m) — 거북목의 본체 */
  headForward: number
  /** 고개 숙임 각도 (rad, + = 턱 내림) */
  headPitch: number
  /** 몸 전체가 카메라 쪽으로 이동 (m) */
  bodyForward: number
  /** 좌우 쏠림 (m) */
  bodyLateral: number
  /** MediaPipe z 채널 전역 드리프트 (조명·거리 변화 흉내) */
  zDrift: number
}

const NEUTRAL: Pose = {
  headForward: 0,
  headPitch: 0,
  bodyForward: 0,
  bodyLateral: 0,
  zDrift: 0,
}

/** x축 회전 (+ = 턱 내림): 앞으로 튀어나온 점이 아래로 내려갑니다. */
function pitchX([x, y, z]: readonly number[], t: number): number[] {
  const c = Math.cos(t)
  const s = Math.sin(t)
  return [x, y * c - z * s, y * s + z * c]
}

/**
 * 3D 모형 → MediaPipe 랜드마크.
 * z 는 MediaPipe 규약을 따라 "가까울수록 작다"이고 x 와 대략 같은 스케일입니다.
 */
function renderPose(pose: Pose, rng: () => number, jitter: number): Landmark[] {
  const world: Record<string, number[]> = {}

  for (const [name, p] of Object.entries(BODY)) {
    world[name] = [p[0] + pose.bodyLateral, p[1], p[2] + pose.bodyForward]
  }

  for (const [name, local] of Object.entries(HEAD_LOCAL)) {
    const rotated = pitchX(local, pose.headPitch)
    world[name] = [
      rotated[0] + NECK_PIVOT[0] + pose.bodyLateral,
      rotated[1] + NECK_PIVOT[1],
      rotated[2] + NECK_PIVOT[2] + pose.headForward + pose.bodyForward,
    ]
  }

  const out: Landmark[] = Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
    z: 0,
    visibility: 0,
  }))

  const IDX: Record<string, number> = {
    nose: 0,
    leftEyeOuter: 3,
    rightEyeOuter: 6,
    leftEar: 7,
    rightEar: 8,
    leftShoulder: 11,
    rightShoulder: 12,
    leftHip: 23,
    rightHip: 24,
  }

  for (const [name, [x, y, z]] of Object.entries(world)) {
    const scale = FOCAL / (CAMERA_DISTANCE - z)
    out[IDX[name]] = {
      x: 0.5 + x * scale + (rng() - 0.5) * jitter,
      y: 0.5 - y * scale + (rng() - 0.5) * jitter,
      // MediaPipe z: 가까울수록 작음. x 와 같은 스케일. 드리프트는 전역으로 더함.
      z: -z * scale + pose.zDrift + (rng() - 0.5) * jitter * 2,
      visibility: 0.95,
    }
  }
  return out
}

/** 재현 가능한 난수 (mulberry32) */
function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CALIB_JITTER = 0.006
const LIVE_JITTER = 0.006
/** 12fps — usePoseDetection 기본값과 같게 둡니다. */
const FRAME_MS = 1000 / 12

function featuresOf(
  pose: Pose,
  rng: () => number,
  jitter: number,
  smoother: LandmarkSmoother,
  frame: number,
) {
  const raw = renderPose(pose, rng, jitter)
  const analysis = analyzeLandmarks(
    smoother.smooth(raw, frame * FRAME_MS),
    renderHeadPose(pose, rng),
  )
  if (!analysis) throw new Error('랜드마크 분석 실패')
  return analysis
}

/**
 * Face Landmarker 출력 흉내.
 * 표준 얼굴 모형 정합이라 잡음이 랜드마크보다 훨씬 작습니다 (거리 ±4mm, 각도 ±1°).
 */
function renderHeadPose(pose: Pose, rng: () => number): HeadPose {
  const faceZ = 0.055 + pose.headForward + pose.bodyForward
  return {
    headDistanceCm: (CAMERA_DISTANCE - faceZ) * 100 + (rng() - 0.5) * 0.8,
    headPitchDeg: (pose.headPitch * 180) / Math.PI + (rng() - 0.5) * 2,
    headYawDeg: 0,
    headRollDeg: 0,
  }
}

/** 필터가 수렴하기 전 프레임은 버립니다 (실제로도 캘리브레이션 전 예열이 있습니다). */
const WARMUP_FRAMES = 12

/** 중립 자세 48프레임으로 실제 캘리브레이션과 같은 방식의 프로필을 만듭니다. */
function calibrate(seed = 1): CalibrationProfile {
  const rng = makeRng(seed)
  const smoother = new LandmarkSmoother()
  const samples: Partial<Record<FeatureKey, number[]>> = {}
  const widths: number[] = []

  for (let i = 0; i < WARMUP_FRAMES + 48; i += 1) {
    const analysis = featuresOf(NEUTRAL, rng, CALIB_JITTER, smoother, i)
    if (i < WARMUP_FRAMES) continue
    widths.push(analysis.shoulderWidth)
    for (const [key, value] of Object.entries(analysis.features)) {
      const k = key as FeatureKey
      ;(samples[k] ??= []).push(value)
    }
  }

  const features: CalibrationProfile['features'] = {}
  for (const [key, values] of Object.entries(samples)) {
    const m = median(values)
    features[key as FeatureKey] = {
      median: m,
      mad: mad(values, m),
      validSampleCount: values.length,
    }
  }

  return {
    version: 3,
    id: 'eval',
    name: '합성 기준',
    createdAt: 0,
    features,
    shoulderWidthMedian: median(widths),
    deviceIdHash: null,
    quality: { validSampleCount: 48, meanVisibility: 0.95 },
  }
}

/** 시나리오 60프레임을 돌려 bad/warning 프레임 비율을 냅니다. */
function run(profile: CalibrationProfile, pose: Pose, seed: number) {
  const rng = makeRng(seed)
  const smoother = new LandmarkSmoother()
  let bad = 0
  let warning = 0
  const peak: Partial<Record<FeatureKey, number>> = {}

  for (let i = 0; i < WARMUP_FRAMES + 60; i += 1) {
    const analysis = featuresOf(pose, rng, LIVE_JITTER, smoother, i)
    if (i < WARMUP_FRAMES) continue
    const votes = computeVotes(analysis.features, profile, 'default', true)
    if (votes.voteBad) bad += 1
    else if (votes.voteWarning) warning += 1
    for (const d of votes.details) {
      peak[d.key] = Math.max(peak[d.key] ?? 0, d.deviation)
    }
  }
  return { bad: bad / 60, warning: warning / 60, peak }
}

/* ------------------------------ 시나리오 ------------------------------ */

const SCENARIOS: Array<{ name: string; pose: Pose; shouldFlag: boolean }> = [
  { name: '중립 유지', pose: NEUTRAL, shouldFlag: false },
  {
    name: '거북목 약(머리 6cm 전방, 12°)',
    pose: { ...NEUTRAL, headForward: 0.06, headPitch: 0.21 },
    shouldFlag: true,
  },
  {
    name: '거북목 강(머리 10cm 전방, 22°)',
    pose: { ...NEUTRAL, headForward: 0.1, headPitch: 0.38 },
    shouldFlag: true,
  },
  {
    name: '목만 전방(각도 없음, 8cm)',
    pose: { ...NEUTRAL, headForward: 0.08, headPitch: 0 },
    shouldFlag: true,
  },
  {
    // 전형적 forward head 는 아래목 굴곡 + 윗목 신전이라 턱이 앞·위로 나옵니다.
    // 숙임만 보는 축은 이걸 놓치므로 반드시 확인해야 합니다.
    name: '턱 내밀기(8cm 전방, -8°)',
    pose: { ...NEUTRAL, headForward: 0.08, headPitch: -0.14 },
    shouldFlag: true,
  },
  {
    name: '몸 전체 앞으로(10cm)',
    pose: { ...NEUTRAL, bodyForward: 0.1 },
    shouldFlag: true,
  },
  {
    name: '자세 그대로, z 드리프트 +0.12',
    pose: { ...NEUTRAL, zDrift: 0.12 },
    shouldFlag: false,
  },
  {
    name: '자세 그대로, z 드리프트 +0.25',
    pose: { ...NEUTRAL, zDrift: 0.25 },
    shouldFlag: false,
  },
  {
    name: '편하게 좌측 5cm 쏠림 — 오탐 확인',
    pose: { ...NEUTRAL, bodyLateral: 0.05 },
    shouldFlag: false,
  },
]

describe('자세 판정 축 평가', () => {
  it('시나리오별 검출률을 출력한다', () => {
    const profile = calibrate()
    const rows: string[] = []

    for (const [i, s] of SCENARIOS.entries()) {
      const r = run(profile, s.pose, 100 + i)
      const top = Object.entries(r.peak)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}=${v.toFixed(2)}`)
        .join(' ')
      rows.push(
        `${s.shouldFlag ? '[탐지대상]' : '[정상   ]'} ${s.name.padEnd(28)} ` +
          `bad ${(r.bad * 100).toFixed(0).padStart(3)}% ` +
          `warn ${(r.warning * 100).toFixed(0).padStart(3)}%  ${top}`,
      )
    }

    console.log('\n' + rows.join('\n') + '\n')
    expect(rows).toHaveLength(SCENARIOS.length)
  })

  it('거북목 시나리오를 전부 잡고, 정상 자세를 하나도 잡지 않는다', () => {
    const profile = calibrate()

    for (const [i, s] of SCENARIOS.entries()) {
      const r = run(profile, s.pose, 100 + i)
      if (s.shouldFlag) {
        // 이탈 자세는 프레임 대부분에서 bad 표가 나와야 합니다.
        expect.soft(r.bad, `${s.name} 미검출`).toBeGreaterThan(0.8)
      } else {
        // 정상 자세는 warning 조차 나오면 안 됩니다.
        expect.soft(r.bad + r.warning, `${s.name} 오탐`).toBe(0)
      }
    }
  })

  it('얼굴 메시가 없어도 고개 숙임형 거북목은 잡는다', () => {
    // Face Landmarker 로드에 실패한 기기에서도 판정이 살아 있어야 합니다.
    const stripHead = (p: CalibrationProfile): CalibrationProfile => ({
      ...p,
      features: Object.fromEntries(
        Object.entries(p.features).filter(
          ([k]) => k !== 'headDistanceCm' && k !== 'headPitchDeg',
        ),
      ),
    })

    const profile = stripHead(calibrate())
    const rng = makeRng(7)
    const smoother = new LandmarkSmoother()
    let bad = 0

    for (let i = 0; i < WARMUP_FRAMES + 60; i += 1) {
      const raw = renderPose(
        { ...NEUTRAL, headForward: 0.1, headPitch: 0.38 },
        rng,
        LIVE_JITTER,
      )
      const analysis = analyzeLandmarks(smoother.smooth(raw, i * FRAME_MS))
      if (i < WARMUP_FRAMES) continue
      if (computeVotes(analysis!.features, profile, 'default', true).voteBad) {
        bad += 1
      }
    }

    expect(bad / 60).toBeGreaterThan(0.8)
  })
})

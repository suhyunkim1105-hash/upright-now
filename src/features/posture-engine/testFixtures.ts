import type { Landmark } from './features'
import type { CalibrationProfile } from '@/features/calibration/calibrationStore'

/**
 * 테스트용 합성 랜드마크 — 정면 웹캠 앞에 편안히 앉은 사람.
 * 좌표는 [0,1] 정규화. 어깨 너비 0.24, 눈 사이 0.09.
 */
export interface FixtureOverrides {
  /** 특정 포인트의 visibility 를 낮춥니다 (귀 가림·엉덩이 화면 밖 등) */
  visibility?: Partial<Record<FixturePoint, number>>
  /** 특정 포인트의 위치를 이동합니다 */
  move?: Partial<Record<FixturePoint, { dx?: number; dy?: number; dz?: number }>>
  /** 전체 스케일 (카메라 거리 변화 흉내) — 어깨 중심 기준 */
  scale?: number
}

export type FixturePoint =
  | 'nose'
  | 'leftEyeOuter'
  | 'rightEyeOuter'
  | 'leftEar'
  | 'rightEar'
  | 'leftShoulder'
  | 'rightShoulder'
  | 'leftHip'
  | 'rightHip'

const BASE: Record<FixturePoint, { x: number; y: number; z: number }> = {
  nose: { x: 0.5, y: 0.35, z: -0.3 },
  leftEyeOuter: { x: 0.545, y: 0.33, z: -0.25 },
  rightEyeOuter: { x: 0.455, y: 0.33, z: -0.25 },
  leftEar: { x: 0.575, y: 0.345, z: -0.1 },
  rightEar: { x: 0.425, y: 0.345, z: -0.1 },
  leftShoulder: { x: 0.62, y: 0.55, z: 0 },
  rightShoulder: { x: 0.38, y: 0.55, z: 0 },
  leftHip: { x: 0.58, y: 0.95, z: 0 },
  rightHip: { x: 0.42, y: 0.95, z: 0 },
}

const INDEX: Record<FixturePoint, number> = {
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

const CENTER = { x: 0.5, y: 0.55 }

export function makeLandmarks(overrides: FixtureOverrides = {}): Landmark[] {
  const landmarks: Landmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0,
  }))

  const scale = overrides.scale ?? 1

  for (const name of Object.keys(BASE) as FixturePoint[]) {
    const base = BASE[name]
    const move = overrides.move?.[name] ?? {}
    const x = CENTER.x + (base.x - CENTER.x) * scale + (move.dx ?? 0)
    const y = CENTER.y + (base.y - CENTER.y) * scale + (move.dy ?? 0)
    const z = base.z + (move.dz ?? 0)
    landmarks[INDEX[name]] = {
      x,
      y,
      z,
      visibility: overrides.visibility?.[name] ?? 0.9,
    }
  }

  return landmarks
}

/** 위 기본 자세로 만든 v2 캘리브레이션 프로필 (MAD 는 작게 → tolerance = floor) */
export function makeProfile(): CalibrationProfile {
  const stat = (median: number) => ({ median, mad: 0.002, validSampleCount: 48 })
  return {
    version: 3,
    id: 'cal-test',
    name: '테스트 기준',
    createdAt: Date.now(),
    features: {
      faceScaleRatio: stat(0.09 / 0.24),
      headHeightRatio: stat((0.55 - 0.33) / 0.24),
      lateralOffsetRatio: stat(0),
      shoulderTiltRatio: stat(0),
      forwardDepthRatio: stat(0.3),
      torsoLean: stat(0),
    },
    shoulderWidthMedian: 0.24,
    deviceIdHash: 'abc123',
    quality: { validSampleCount: 48, meanVisibility: 0.9 },
  }
}

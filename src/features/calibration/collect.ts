import { mad, median, MIN_SHOULDER_WIDTH, PRIMARY_FEATURES, AUXILIARY_FEATURES } from '@/features/posture-engine/features'
import type { FeatureKey, LandmarkAnalysis } from '@/features/posture-engine/features'
import type { CalibrationProfile, FeatureStat } from './calibrationStore'
import { checkCalibrationFraming } from './framingGate'
import type { CameraFrameQuality } from './frameQuality'

/**
 * 캘리브레이션 표본 수집 v3 — 순수 로직. 시간은 호출자가 넘깁니다.
 *
 * 완료 조건 (모두 만족해야 함 — 표본이 일찍 쌓여도 5초 전 완료 금지):
 * 1) 카메라·프레이밍 확인 1.5초 연속 유지 (framing 단계)
 * 2) 표본 수집 실제 wall-clock 5.0초 경과
 * 3) 유효 표본 40개 이상
 * 4) 5개의 1초 구간마다 유효 표본 1개 이상
 *
 * 움직임 과다·어두움·저대비·카메라 흔들림·얼굴 미감지·한쪽 어깨 없음 → 해당 프레임 제외(진행 일시정지).
 * 귀·엉덩이 없음 → limited 로 계속 진행.
 * 원본 프레임·랜드마크 시계열은 저장하지 않습니다.
 */
export const FRAMING_MS = 1500
export const TARGET_MS = 5000
export const TIMEOUT_MS = 20000
export const MIN_VALID_SAMPLES = 40
export const BUCKET_COUNT = 5
/** 특징이 기준에 포함되기 위한 최소 표본 수 */
const MIN_FEATURE_SAMPLES = 30
const MOVEMENT_LIMIT = 0.2

export type CalibrationQuality =
  | 'idle'
  | 'framing'
  | 'ok'
  | 'no-person'
  | 'low-visibility'
  | 'moving'
  | 'dim'
  | 'low-contrast'
  | 'camera-motion'
  | 'rotated'
  | 'tilted'
  | 'timeout'

interface Sample {
  features: Partial<Record<FeatureKey, number>>
  shoulderWidth: number
  visibility: number
  /** 수집 시작 기준 1초 구간 인덱스 (0~4, 이후는 4 로 클램프) */
  bucket: number
}

export interface CollectState {
  /** 프레이밍(유효 프레임 연속) 시작 시각 */
  framingSince: number | null
  /** 표본 수집 시작 시각 — 프레이밍 1.5초 충족 후 설정 */
  samplingStartedAt: number | null
  samples: Sample[]
  startedAt: number | null
}

export interface CollectResult {
  state: CollectState
  quality: CalibrationQuality
  /** 화면 단계: 1 얼굴·어깨 확인 → 2 5초 유지 → 3 저장 완료 */
  step: 1 | 2 | 3
  /** 0~1 (framing 0~0.2, sampling 0.2~1) */
  progress: number
  validCount: number
  profile: CalibrationProfile | null
  failed: boolean
}

export function createCollectState(): CollectState {
  return { framingSince: null, samplingStartedAt: null, samples: [], startedAt: null }
}

function movedTooMuch(next: Sample, prev: Sample | undefined): boolean {
  if (!prev) return false
  const keys: FeatureKey[] = ['faceScaleRatio', 'headHeightRatio', 'lateralOffsetRatio']
  return keys.some((key) => {
    const a = next.features[key]
    const b = prev.features[key]
    return a !== undefined && b !== undefined && Math.abs(a - b) > MOVEMENT_LIMIT
  })
}

function bucketsCovered(samples: Sample[]): boolean {
  const seen = new Set(samples.map((s) => s.bucket))
  for (let i = 0; i < BUCKET_COUNT; i += 1) {
    if (!seen.has(i)) return false
  }
  return true
}

export function collectStep(
  state: CollectState,
  input: {
    analysis: LandmarkAnalysis | null
    now: number
    deviceIdHash?: string | null
    profileName?: string
    frameQuality?: Exclude<CameraFrameQuality, 'pending'>
  },
): CollectResult {
  const {
    analysis,
    now,
    deviceIdHash = null,
    profileName = '기준 자세',
    frameQuality,
  } = input

  const startedAt = state.startedAt ?? now
  const sampling = state.samplingStartedAt !== null
  const samplingElapsed = sampling ? now - state.samplingStartedAt! : 0
  const progress = sampling
    ? 0.2 + 0.8 * Math.min(1, samplingElapsed / TARGET_MS)
    : state.framingSince
      ? 0.2 * Math.min(1, (now - state.framingSince) / FRAMING_MS)
      : 0

  const base: Omit<CollectResult, 'quality'> = {
    state: { ...state, startedAt },
    step: sampling ? 2 : 1,
    progress,
    validCount: state.samples.length,
    profile: null,
    failed: false,
  }

  // 전체 시간 초과 → 처음부터
  if (now - startedAt > TIMEOUT_MS) {
    return {
      ...base,
      state: createCollectState(),
      quality: 'timeout',
      step: 1,
      progress: 0,
      validCount: 0,
      failed: true,
    }
  }

  // ---- 프레임 유효성 (나쁜 프레임은 프레이밍 연속성만 깨고, 표본은 유지) ----
  const invalid = (quality: CalibrationQuality): CollectResult => ({
    ...base,
    state: { ...base.state, framingSince: null },
    quality,
  })

  if (frameQuality === 'dim') return invalid('dim')
  if (frameQuality === 'low-contrast') return invalid('low-contrast')
  if (frameQuality === 'motion') return invalid('camera-motion')
  if (!analysis) return invalid('no-person')
  if (!analysis.faceCoreOk || !analysis.bothShouldersOk)
    return invalid('low-visibility')
  if (analysis.shoulderWidth < MIN_SHOULDER_WIDTH || !analysis.inFrame)
    return invalid('low-visibility')
  if (analysis.severeRotation) return invalid('rotated')

  // ---- 캘리브레이션 전용 프레이밍 게이트 (심한 기울임·누운 자세) ----
  // hard invalid: 기울어진 상태의 표본이 기존 표본과 섞이지 않도록
  // 표본 전체를 버리고 프레이밍 1.5초부터 처음부터 다시 시작합니다.
  // (한 프레임 흔들림은 위의 moving 처리로 일시정지만 됩니다)
  const framing = checkCalibrationFraming(analysis)
  if (!framing.ok) {
    return {
      ...base,
      state: { ...createCollectState(), startedAt },
      quality: 'tilted',
      step: 1,
      progress: 0,
      validCount: 0,
    }
  }

  // ---- 1단계: 카메라·프레이밍 확인 1.5초 ----
  if (!sampling) {
    const framingSince = state.framingSince ?? now
    if (now - framingSince < FRAMING_MS) {
      return {
        ...base,
        state: { ...base.state, framingSince },
        quality: 'framing',
        step: 1,
      }
    }
    // 프레이밍 통과 → 표본 수집 시작
    return {
      ...base,
      state: { ...base.state, framingSince, samplingStartedAt: now },
      quality: 'ok',
      step: 2,
    }
  }

  // ---- 2단계: 5초 표본 수집 ----
  const sample: Sample = {
    features: analysis.features,
    shoulderWidth: analysis.shoulderWidth,
    visibility: analysis.meanCoreVisibility,
    bucket: Math.min(BUCKET_COUNT - 1, Math.floor(samplingElapsed / 1000)),
  }

  if (movedTooMuch(sample, state.samples.at(-1))) {
    return { ...base, quality: 'moving', step: 2 }
  }

  const samples = [...state.samples, sample]
  const nextState: CollectState = { ...base.state, samples }

  // 완료: wall-clock 5초 + 유효 40개 + 5개 구간 커버 — 모두 필요.
  // (표본 40개가 일찍 쌓여도 5초 전에는 절대 완료하지 않음)
  if (
    samplingElapsed >= TARGET_MS &&
    samples.length >= MIN_VALID_SAMPLES &&
    bucketsCovered(samples)
  ) {
    return {
      state: createCollectState(),
      quality: 'ok',
      step: 3,
      progress: 1,
      validCount: samples.length,
      profile: buildProfile(samples, now, deviceIdHash, profileName),
      failed: false,
    }
  }

  return {
    ...base,
    state: nextState,
    quality: 'ok',
    step: 2,
    validCount: samples.length,
  }
}

function buildProfile(
  samples: Sample[],
  now: number,
  deviceIdHash: string | null,
  name: string,
): CalibrationProfile {
  const features: Partial<Record<FeatureKey, FeatureStat>> = {}

  for (const key of [...PRIMARY_FEATURES, ...AUXILIARY_FEATURES]) {
    const values = samples
      .map((s) => s.features[key])
      .filter((v): v is number => v !== undefined)
    // 표본이 부족한 특징(예: 화면 밖 엉덩이의 torsoLean)은 기준에서 제외합니다.
    if (values.length < MIN_FEATURE_SAMPLES) continue
    const center = median(values)
    features[key] = {
      median: center,
      mad: mad(values, center),
      validSampleCount: values.length,
    }
  }

  return {
    version: 2,
    id: `cal-${Math.round(now)}-${Math.round(Math.abs(samples[0]?.shoulderWidth ?? 0) * 1e6) % 997}`,
    name,
    createdAt: Date.now(),
    features,
    shoulderWidthMedian: median(samples.map((s) => s.shoulderWidth)),
    deviceIdHash,
    quality: {
      validSampleCount: samples.length,
      meanVisibility:
        samples.reduce((sum, s) => sum + s.visibility, 0) / samples.length,
    },
  }
}

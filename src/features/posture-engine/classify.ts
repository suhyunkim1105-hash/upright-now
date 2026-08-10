import {
  AUXILIARY_FEATURES,
  PRIMARY_FEATURES,
  type FeatureKey,
} from './features'
import type { CalibrationProfile } from '@/features/calibration/calibrationStore'
import { BAD_HOLD_MS, type Sensitivity } from '@/constants/posture'

/**
 * 개인 기준 대비 방향성 편차 → 투표 → 지속 시간 기반 상태 확정 (긴급 안정화)
 *
 * - 단순 평균도, 신뢰도 없는 raw max 도 쓰지 않습니다.
 * - 각 특징의 "나빠지는 방향" 편차만 baseline tolerance 단위로 계산합니다.
 * - warning: 주 특징 1개 이상 > 1.0 이 1.5초 지속
 * - bad: 주 특징 2개 이상 > 1.0 또는 주 특징 1개 > 1.8 + 품질 good, 5초 지속
 * - good: 주 특징이 모두 < 0.8 이 2초 지속
 * - z(forwardDepthRatio)는 보조: warning/bad 표가 되지 않고 good 복귀도
 *   막지 않습니다. (실카메라에서 z 는 조명·거리에 따라 흘러다녀,
 *   marginal 한 주 특징을 bad 로 승격시키거나 회복을 영영 막던 원인)
 *
 * ## 시상면 축을 왜 늘렸는가
 *
 * 초기 주 특징 5개 중 3개(lateral·tilt·torso)는 **좌우** 축이라 거북목에
 * 전혀 반응하지 않았습니다. 남은 2개도 shoulderWidth 로 정규화해서, 상체가
 * 같이 앞으로 나오면 분자·분모가 함께 커져 신호가 상쇄됐습니다.
 * `postureEval.spec.ts` 로 재 보니 **머리 10cm 전방 + 22° 숙임이 warning 조차
 * 뜨지 않았습니다**(최대 편차 0.82).
 *
 * 그래서 z 를 주 특징으로 올리는 대신(위의 드리프트 문제가 그대로 돌아옵니다)
 * 흘러다니지 않는 축을 넷 더했습니다.
 *
 * | 축 | 정규화 | 잡아내는 것 |
 * |---|---|---|
 * | `facePitchRatio` | eyeDist | 고개 숙임 (코가 얼굴 평면보다 앞) |
 * | `earEyeRatio` | eyeDist | 고개 숙임 (귀가 눈보다 뒤) |
 * | `shoulderSpan` | 없음 | 몸 전체가 화면으로 접근 |
 * | `headDistanceCm`·`headPitchDeg` | 없음(cm·도) | 얼굴 메시 6DoF |
 *
 * 얼굴 메시 두 축은 Face Landmarker 가 있을 때만 채워집니다. 없으면 나머지로
 * 판정하고, 고개 숙임형 거북목은 그대로 잡힙니다(평가 3번째 케이스).
 */

/** 나빠지는 방향: +1 = 증가가 이탈, -1 = 감소가 이탈 */
const DIRECTION: Record<FeatureKey, 1 | -1> = {
  faceScaleRatio: 1, // 얼굴이 커짐 = 카메라 쪽으로 접근
  headHeightRatio: -1, // 눈-어깨 거리가 줄어듦 = 고개 숙임·움츠림
  facePitchRatio: 1, // 눈-코 세로 간격이 벌어짐 = 고개 숙임
  earEyeRatio: -1, // 귀가 눈보다 올라감 = 고개 숙임
  shoulderSpan: 1, // 어깨폭이 넓어짐 = 몸 전체가 화면으로 접근
  lateralOffsetRatio: 1, // 코가 어깨 중앙에서 벗어남 = 좌우 기울기
  shoulderTiltRatio: 1, // 어깨 높이 차 증가
  forwardDepthRatio: 1, // 코가 어깨보다 카메라 쪽 (보조)
  torsoLean: 1, // 상체 좌우 쏠림 (엉덩이 보일 때만)
  headDistanceCm: -1, // 얼굴이 카메라에 가까워짐 = 머리 전방 이동
  headPitchDeg: 1, // 턱을 내림 = 고개 숙임
}

/**
 * 축별 최소 허용 오차 — 캘리브레이션 중 가만히 앉아 MAD 가 0에 가까워도
 * 정상적인 미세 움직임이 이탈로 잡히지 않게 하는 바닥값입니다.
 *
 * 좌우 비대칭 축(lateral·tilt·torso)은 앞으로 숙임 감지와 무관하고,
 * 편안히 앉으면(팔걸이에 기대기 등) 캘리브레이션의 정자세 대비 자연스럽게
 * 벌어지는 값이라 바닥을 약간 넓게 둡니다. 숙임·접근 축(face·head)은
 * 거북목 감지의 핵심이므로 그대로 둡니다.
 */
const FLOOR: Record<FeatureKey, number> = {
  faceScaleRatio: 0.03,
  headHeightRatio: 0.08,
  facePitchRatio: 0.06,
  earEyeRatio: 0.06,
  shoulderSpan: 0.012,
  lateralOffsetRatio: 0.1,
  shoulderTiltRatio: 0.08,
  forwardDepthRatio: 0.35,
  torsoLean: 0.1,
  // cm·도 단위라 다른 축과 스케일이 다릅니다. 4cm 접근 / 8도 숙임을 1.0 으로 봅니다.
  headDistanceCm: 4,
  headPitchDeg: 8,
}

/** MAD → tolerance 배수 */
const MAD_K = 8

const SENSITIVITY_MULT: Record<Sensitivity, number> = {
  gentle: 1.4,
  default: 1.0,
  sensitive: 0.75,
}

export const WARNING_ENTER = 1.0
export const BAD_STRONG = 1.8
/**
 * good 복귀 상한 — 0.65 였을 때는 0.65~1.0 사이에 자리 잡은 편안한 자세가
 * warning 에서 영영 못 빠져나오는 함정 구간이 너무 넓었습니다.
 * (히스테리시스는 1.0 진입 / 0.8 복귀로 유지)
 */
export const GOOD_EXIT = 0.8

export interface DeviationDetail {
  key: FeatureKey
  value: number
  baseline: number
  tolerance: number
  /** 방향성 편차 (나빠지는 방향만, ≥0) */
  deviation: number
  /** 주 특징인지 (z 는 보조) */
  primary: boolean
  exceeded: boolean
}

export interface FrameVotes {
  details: DeviationDetail[]
  /** 1.0 을 넘은 주 특징 수 */
  primaryExceedCount: number
  /** 1.0 을 넘은 보조(z) 특징 수 */
  auxExceedCount: number
  /** 주 특징 최대 편차 */
  maxPrimary: number
  usedFeatureCount: number
  voteWarning: boolean
  voteBad: boolean
  voteGood: boolean
}

export function computeVotes(
  features: Partial<Record<FeatureKey, number>>,
  profile: CalibrationProfile,
  sensitivity: Sensitivity,
  qualityGood: boolean,
): FrameVotes {
  const mult = SENSITIVITY_MULT[sensitivity]
  const details: DeviationDetail[] = []

  for (const key of [...PRIMARY_FEATURES, ...AUXILIARY_FEATURES]) {
    const value = features[key]
    const stat = profile.features[key]
    // 이번 프레임에 없거나 기준에 없는 특징은 판정에서 제외합니다.
    if (value === undefined || !stat) continue

    const tolerance = mult * Math.max(FLOOR[key], stat.mad * MAD_K)
    const delta = (value - stat.median) * DIRECTION[key]
    const deviation = Math.max(0, delta) / tolerance

    details.push({
      key,
      value,
      baseline: stat.median,
      tolerance,
      deviation,
      primary: PRIMARY_FEATURES.includes(key),
      exceeded: deviation > WARNING_ENTER,
    })
  }

  const primaries = details.filter((d) => d.primary)
  const primaryExceedCount = primaries.filter((d) => d.exceeded).length
  const auxExceedCount = details.filter((d) => !d.primary && d.exceeded).length
  const maxPrimary = primaries.reduce((max, d) => Math.max(max, d.deviation), 0)

  // z 는 표가 아닙니다: bad 의 두 번째 표도, good 복귀의 거부권도 갖지 않습니다.
  const voteWarning = primaryExceedCount >= 1
  const voteBad =
    primaryExceedCount >= 2 || (maxPrimary > BAD_STRONG && qualityGood)
  const voteGood = primaries.every((d) => d.deviation < GOOD_EXIT)

  return {
    details,
    primaryExceedCount,
    auxExceedCount,
    maxPrimary,
    usedFeatureCount: details.length,
    voteWarning,
    voteBad,
    voteGood,
  }
}

/** 어깨 너비가 기준보다 20% 이상 달라졌는지 — 카메라 거리 확인 안내용 */
export function isDistanceMismatch(
  shoulderWidth: number,
  baselineShoulderWidth: number,
  tolerance = 0.2,
): boolean {
  if (baselineShoulderWidth <= 0) return false
  return (
    Math.abs(shoulderWidth - baselineShoulderWidth) / baselineShoulderWidth >
    tolerance
  )
}

/* ------------------- 지속 시간 기반 상태 확정 (순수) ------------------- */

export type ArbiterPosture = 'good' | 'warning' | 'bad'

export interface ArbiterState {
  current: ArbiterPosture
  candidate: ArbiterPosture | null
  candidateSince: number
}

/**
 * 상태 확정 지속 시간 — bad 5초의 유일한 소유자입니다.
 * postureMachine 은 여기서 확정된 bad 를 받아 즉시 회복 기회를 엽니다.
 */
const HOLD_MS: Record<ArbiterPosture, number> = {
  warning: 1500,
  bad: BAD_HOLD_MS,
  good: 2000,
}

export function createArbiter(): ArbiterState {
  return { current: 'good', candidate: null, candidateSince: 0 }
}

/**
 * 프레임 투표를 지속 시간으로 확정합니다.
 * 투표가 중간 지대(0.65~1.0)면 후보를 지우고 현재 상태를 유지합니다(히스테리시스).
 */
export function arbiterStep(
  state: ArbiterState,
  votes: Pick<FrameVotes, 'voteWarning' | 'voteBad' | 'voteGood'>,
  now: number,
): ArbiterState {
  const target: ArbiterPosture | null = votes.voteBad
    ? 'bad'
    : votes.voteWarning
      ? 'warning'
      : votes.voteGood
        ? 'good'
        : null

  if (target === null || target === state.current) {
    return { ...state, candidate: null, candidateSince: now }
  }

  if (state.candidate !== target) {
    return { ...state, candidate: target, candidateSince: now }
  }

  if (now - state.candidateSince >= HOLD_MS[target]) {
    return { current: target, candidate: null, candidateSince: now }
  }

  return state
}

/**
 * 얼굴 변환 행렬 → 머리 6DoF (정면 카메라 거북목 판정의 핵심 축)
 *
 * MediaPipe Face Landmarker 는 478점을 표준 얼굴 모형(cm 단위)에 맞춘
 * 4×4 변환 행렬을 돌려줍니다. 여기서 두 가지를 뽑습니다.
 *
 * - `headDistanceCm` — 카메라까지의 실제 거리. 머리가 8cm 앞으로 나오면
 *   50 → 42 로 16% 바뀝니다. 같은 움직임이 Pose 의 눈 사이 거리에서는 5%
 *   변화에 그쳐 지터에 묻히던 것과 대비됩니다.
 * - `headPitchDeg` — 고개 숙임 각도. 모니터를 보며 생기는 거북목의 주 성분.
 *
 * yaw·roll 은 판정에 쓰지 않고 **측정 제한 게이트**로만 씁니다. 고개를 돌리면
 * 거리·각도 추정이 함께 흔들리므로, 이탈로 과금하지 않고 제외합니다.
 *
 * 행렬은 열 우선(column-major)입니다: R[row][col] = data[col * 4 + row].
 */

export interface HeadPose {
  /** 카메라까지 거리 (cm) — 작을수록 가까움 */
  headDistanceCm: number
  /** 고개 숙임 (도) — + 가 턱 내림 */
  headPitchDeg: number
  /** 고개 좌우 돌림 (도) */
  headYawDeg: number
  /** 고개 좌우 기울임 (도) */
  headRollDeg: number
}

const RAD_TO_DEG = 180 / Math.PI

/** 이 이상 돌리거나 기울이면 거리·각도 추정을 믿지 않습니다. */
export const HEAD_YAW_LIMIT_DEG = 25
export const HEAD_ROLL_LIMIT_DEG = 25

/** 표준 얼굴 모형이 만들 수 있는 거리 범위 밖이면 잘못 맞춘 것으로 봅니다. */
const DISTANCE_MIN_CM = 20
const DISTANCE_MAX_CM = 150

export function headPoseFromMatrix(
  data: ArrayLike<number> | undefined,
): HeadPose | null {
  if (!data || data.length < 16) return null

  const r00 = data[0]
  const r10 = data[1]
  const r20 = data[2]
  const r21 = data[6]
  const r22 = data[10]
  const tz = data[14]

  const headDistanceCm = Math.abs(tz)
  if (
    !Number.isFinite(headDistanceCm) ||
    headDistanceCm < DISTANCE_MIN_CM ||
    headDistanceCm > DISTANCE_MAX_CM
  ) {
    return null
  }

  return {
    headDistanceCm,
    // 모형은 y 가 위입니다. 화면 좌표계(아래가 +)와 맞추려고 부호를 뒤집어,
    // 턱을 내리면 + 가 되게 합니다.
    headPitchDeg: -Math.atan2(r21, r22) * RAD_TO_DEG,
    headYawDeg: Math.atan2(-r20, Math.hypot(r21, r22)) * RAD_TO_DEG,
    headRollDeg: Math.atan2(r10, r00) * RAD_TO_DEG,
  }
}

/** 돌림·기울임이 심하면 이번 프레임의 머리 축을 쓰지 않습니다. */
export function headPoseUsable(pose: HeadPose): boolean {
  return (
    Math.abs(pose.headYawDeg) <= HEAD_YAW_LIMIT_DEG &&
    Math.abs(pose.headRollDeg) <= HEAD_ROLL_LIMIT_DEG
  )
}

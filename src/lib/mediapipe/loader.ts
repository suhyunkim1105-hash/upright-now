import type {
  FaceLandmarker,
  PoseLandmarker,
  PoseLandmarkerResult,
} from '@mediapipe/tasks-vision'

/**
 * Pose Landmarker 지연 로드 — docs/06 §1, §14
 * 무거운 tasks-vision 라이브러리는 동적 import 로 분리해, 카메라를 쓸 때만 받습니다.
 * WASM·경량 모델은 CDN 에서 받고, GPU 실패 시 CPU 로 폴백합니다.
 * 추론은 브라우저 안에서만 수행하고 프레임을 네트워크로 보내지 않습니다.
 */
const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

let landmarkerPromise: Promise<PoseLandmarker> | null = null

async function build(delegate: 'GPU' | 'CPU'): Promise<PoseLandmarker> {
  const { FilesetResolver, PoseLandmarker } = await import(
    '@mediapipe/tasks-vision'
  )
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO',
    // 2로 두어 "두 명 이상 인식" 상황을 감지합니다. 판정에는 첫 번째 사람만 씁니다.
    numPoses: 2,
  })
}

export async function loadPoseLandmarker(): Promise<PoseLandmarker> {
  if (landmarkerPromise) return landmarkerPromise

  landmarkerPromise = build('GPU').catch((gpuError) => {
    console.warn('Pose Landmarker GPU 실패, CPU 로 폴백합니다.', gpuError)
    return build('CPU')
  })

  try {
    return await landmarkerPromise
  } catch (error) {
    // 실패하면 다음 시도를 위해 캐시를 비웁니다.
    landmarkerPromise = null
    throw error
  }
}

export function disposePoseLandmarker(): void {
  if (!landmarkerPromise) return
  landmarkerPromise
    .then((lm) => lm.close())
    .catch(() => {})
    .finally(() => {
      landmarkerPromise = null
    })
}

export type { PoseLandmarkerResult }

/* ---------------------- Face Landmarker (머리 자세) ---------------------- */

/**
 * 얼굴 메시로 머리 6DoF 를 얻습니다 — 정면 카메라의 거북목 판정용.
 *
 * Pose 의 성긴 랜드마크만으로는 머리가 8cm 앞으로 나온 것을 잡을 수 없습니다.
 * 1.6m 거리에서 8cm 는 배율 5% 변화이고, 눈 사이 거리는 화면 폭의 4% 라
 * 랜드마크 지터에 묻힙니다. Face Landmarker 는 478점을 표준 얼굴 모형에
 * 맞춰 **cm 단위 거리와 각도**를 직접 돌려주므로 이 문제를 우회합니다.
 *
 * 같은 `@mediapipe/tasks-vision` 패키지라 의존성이 늘지 않습니다.
 * 실패해도 Pose 판정은 그대로 돌아갑니다 (호출부에서 null 처리).
 */
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

let facePromise: Promise<FaceLandmarker> | null = null

async function buildFace(delegate: 'GPU' | 'CPU'): Promise<FaceLandmarker> {
  const { FilesetResolver, FaceLandmarker } = await import(
    '@mediapipe/tasks-vision'
  )
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate },
    runningMode: 'VIDEO',
    numFaces: 1,
    // 필요한 건 이 행렬 하나뿐입니다. 표정 블렌드셰이프는 켜지 않습니다.
    outputFacialTransformationMatrixes: true,
    outputFaceBlendshapes: false,
  })
}

export async function loadFaceLandmarker(): Promise<FaceLandmarker> {
  if (facePromise) return facePromise

  facePromise = buildFace('GPU').catch((gpuError) => {
    console.warn('Face Landmarker GPU 실패, CPU 로 폴백합니다.', gpuError)
    return buildFace('CPU')
  })

  try {
    return await facePromise
  } catch (error) {
    facePromise = null
    throw error
  }
}

export function disposeFaceLandmarker(): void {
  if (!facePromise) return
  facePromise
    .then((lm) => lm.close())
    .catch(() => {})
    .finally(() => {
      facePromise = null
    })
}

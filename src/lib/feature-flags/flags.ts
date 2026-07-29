/**
 * 기능 플래그 — docs/15_TECHNICAL_ARCHITECTURE.md §13
 * Supabase가 없는 로컬 환경에서도 혼자 모드가 작동해야 합니다.
 */
export interface FeatureFlags {
  /** 실제 웹캠 연결(getUserMedia + Pose Landmarker) */
  camera: boolean
  /** 실제 2인 친구 방(Supabase Realtime) */
  friendRoom: boolean
  realtimeRoom: boolean
  pictureInPicture: boolean
  aiReport: boolean
  qaLab: boolean
  optionalSlouchCalibration: boolean
  /** 캠퍼스 테마(학교 선택 → 색·배지·배너·배경) */
  campusTheme: boolean
  /** 캠퍼스 영토전 지도·기여도 */
  campusTerritory: boolean
  /** 설정의 학교 선택 노출 — 테마 또는 영토전 중 하나라도 켜져 있으면 필요합니다. */
  campusSchoolPicker: boolean
}

export function parseFlag(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback
  return value === 'true' || value === '1'
}

export function readFeatureFlags(env: ImportMetaEnv): FeatureFlags {
  const friendRoom = parseFlag(env.VITE_ENABLE_FRIEND_ROOM, false)
  // 캠퍼스 기능은 기본값이 false 입니다. 꺼져 있으면 기존 앱과 완전히 동일하게 동작합니다.
  const campusTheme = parseFlag(env.VITE_ENABLE_CAMPUS_THEME, false)
  const campusTerritory = parseFlag(env.VITE_ENABLE_CAMPUS_TERRITORY, false)

  return {
    camera: parseFlag(env.VITE_ENABLE_CAMERA, false),
    friendRoom,
    // 친구 방이 꺼져 있으면 Realtime 도 켜지 않습니다.
    realtimeRoom: friendRoom && parseFlag(env.VITE_ENABLE_REALTIME, false),
    pictureInPicture: parseFlag(env.VITE_ENABLE_PIP, false),
    aiReport: parseFlag(env.VITE_ENABLE_AI_REPORT, false),
    // 개발 환경에서는 QA Lab을 기본으로 켭니다. 운영은 명시적으로 켜야 합니다.
    qaLab: parseFlag(env.VITE_ENABLE_QA_LAB, import.meta.env.DEV),
    optionalSlouchCalibration: false,
    campusTheme,
    campusTerritory,
    campusSchoolPicker: campusTheme || campusTerritory,
  }
}

export const featureFlags: FeatureFlags = readFeatureFlags(import.meta.env)

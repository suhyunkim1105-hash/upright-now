import { create } from 'zustand'
import { loadLocal, saveLocal, STORAGE_KEYS } from '@/lib/storage/local'
import type { FeatureKey } from '@/features/posture-engine/features'
import type { Sensitivity } from '@/constants/posture'

/**
 * 개인 자세 기준 — 여러 프로필 저장 (집 책상·학교 도서관·팀플 회의실 …).
 *
 * 각 프로필: 특징별 median + MAD + 표본 수 요약만. (평균만 저장 금지)
 * 원본 영상·프레임·랜드마크 좌표는 저장하지 않습니다.
 * 판정 엔진(useLiveClassifier)은 기존처럼 `profile`(활성 프로필)만 읽습니다.
 */
export interface FeatureStat {
  median: number
  mad: number
  validSampleCount: number
}

export interface CalibrationProfile {
  version: 3
  id: string
  name: string
  createdAt: number
  features: Partial<Record<FeatureKey, FeatureStat>>
  shoulderWidthMedian: number
  /** 카메라 식별용 안전한 해시 (원본 deviceId 아님) */
  deviceIdHash: string | null
  quality: {
    validSampleCount: number
    meanVisibility: number
  }
}

interface CalibrationStoreState {
  profiles: CalibrationProfile[]
  activeProfileId: string | null
  /** 활성 프로필 파생값 — 판정 엔진 호환용 (직접 쓰지 말 것) */
  profile: CalibrationProfile | null
  sensitivity: Sensitivity

  /** 새 기준 저장 + 활성화 */
  addProfile: (profile: CalibrationProfile) => void
  /** @deprecated addProfile 별칭 — 기존 호출부 호환 */
  setProfile: (profile: CalibrationProfile) => void
  selectProfile: (id: string) => void
  renameProfile: (id: string, name: string) => void
  removeProfile: (id: string) => void
  setSensitivity: (value: Sensitivity) => void
  clear: () => void
}

interface PersistShape {
  profiles: CalibrationProfile[]
  activeProfileId: string | null
  sensitivity: Sensitivity
}

/** 구(단일 프로필) 저장형과 신형을 모두 읽습니다. */
interface LegacyShape {
  profile?: CalibrationProfile | null
  profiles?: CalibrationProfile[]
  activeProfileId?: string | null
  sensitivity: Sensitivity
}

const loaded = loadLocal<LegacyShape>(STORAGE_KEYS.calibration, {
  profile: null,
  sensitivity: 'default',
})

const migratedProfiles: CalibrationProfile[] = (
  loaded.profiles ?? (loaded.profile ? [loaded.profile] : [])
).filter((p) => p && p.version === 3)

// 구버전(단일 프로필) 저장형만 첫 프로필을 활성으로 승격합니다.
// 신형 저장형에서 activeProfileId 가 비었거나 삭제된 프로필을 가리키면
// 임의로 첫 프로필을 고르지 않고 사용자가 직접 선택하게 둡니다.
const migratedActiveId = (() => {
  if (loaded.activeProfileId === undefined) return migratedProfiles[0]?.id ?? null
  if (
    loaded.activeProfileId &&
    migratedProfiles.some((p) => p.id === loaded.activeProfileId)
  ) {
    return loaded.activeProfileId
  }
  return null
})()

function activeOf(
  profiles: CalibrationProfile[],
  id: string | null,
): CalibrationProfile | null {
  return profiles.find((p) => p.id === id) ?? null
}

function persist(s: PersistShape): void {
  saveLocal(STORAGE_KEYS.calibration, s)
}

export const useCalibrationStore = create<CalibrationStoreState>((set, get) => ({
  profiles: migratedProfiles,
  activeProfileId: migratedActiveId,
  profile: activeOf(migratedProfiles, migratedActiveId),
  sensitivity: loaded.sensitivity ?? 'default',

  addProfile: (profile) => {
    const s = get()
    const profiles = [...s.profiles.filter((p) => p.id !== profile.id), profile]
    persist({ profiles, activeProfileId: profile.id, sensitivity: s.sensitivity })
    set({ profiles, activeProfileId: profile.id, profile })
  },

  setProfile: (profile) => get().addProfile(profile),

  selectProfile: (id) => {
    const s = get()
    const profile = activeOf(s.profiles, id)
    if (!profile) return
    persist({ profiles: s.profiles, activeProfileId: id, sensitivity: s.sensitivity })
    set({ activeProfileId: id, profile })
  },

  renameProfile: (id, name) => {
    const s = get()
    const profiles = s.profiles.map((p) =>
      p.id === id ? { ...p, name: name.slice(0, 20) || p.name } : p,
    )
    persist({ profiles, activeProfileId: s.activeProfileId, sensitivity: s.sensitivity })
    set({ profiles, profile: activeOf(profiles, s.activeProfileId) })
  },

  removeProfile: (id) => {
    const s = get()
    const profiles = s.profiles.filter((p) => p.id !== id)
    // 활성 프로필을 지우면 다른 프로필을 임의로 자동 선택하지 않습니다.
    // 세션 시작은 hasValidActiveProfile 가드가 막고, 사용자가 직접 고릅니다.
    const activeProfileId = s.activeProfileId === id ? null : s.activeProfileId
    persist({ profiles, activeProfileId, sensitivity: s.sensitivity })
    set({ profiles, activeProfileId, profile: activeOf(profiles, activeProfileId) })
  },

  setSensitivity: (sensitivity) => {
    const s = get()
    persist({ profiles: s.profiles, activeProfileId: s.activeProfileId, sensitivity })
    set({ sensitivity })
  },

  clear: () => {
    persist({ profiles: [], activeProfileId: null, sensitivity: get().sensitivity })
    set({ profiles: [], activeProfileId: null, profile: null })
  },
}))

/** deviceId 를 저장 가능한 짧은 해시로 바꿉니다. (djb2, 복원 불가) */
export function hashDeviceId(deviceId: string | null | undefined): string | null {
  if (!deviceId) return null
  let hash = 5381
  for (let i = 0; i < deviceId.length; i += 1) {
    hash = ((hash << 5) + hash + deviceId.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(16)
}

/**
 * 세션 시작 가능 조건 — 활성 기준의 실제 유효성.
 * activeProfileId 가 있고, 그 id 의 프로필이 실제로 존재하며,
 * 현재 스키마 버전(v2)일 때만 참. (프로필 개수만 세지 않습니다)
 */
export function hasValidActiveProfile(
  s: {
    profiles: CalibrationProfile[]
    activeProfileId: string | null
  } = useCalibrationStore.getState(),
): boolean {
  if (!s.activeProfileId) return false
  const active = s.profiles.find((p) => p.id === s.activeProfileId)
  return Boolean(active && active.version === 3)
}

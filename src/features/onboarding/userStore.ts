import { create } from 'zustand'
import { DEFAULT_NICKNAME } from '@/constants/copy'
import { DEFAULT_PROFILE_ID } from '@/constants/profiles'
import { loadLocal, STORAGE_KEYS } from '@/lib/storage/local'
import type { LearningProfileKind } from '@/types'

/**
 * 실제 사용자 설정을 localStorage 에 저장합니다. (데모 값은 저장하지 않음)
 */
interface UserStoreState {
  nickname: string
  hasOnboarded: boolean
  profileId: LearningProfileKind
  hasCalibration: boolean
  soundEnabled: boolean
  /** 반응 수신 소리 — 전역 소리와 별개로 끌 수 있음 */
  reactionSoundEnabled: boolean
  /** 내 응원 문구 (최대 3개, 2~16자) */
  customReactions: string[]
  /** 세션 시작 시 PiP 미니 위젯 자동 열기 */
  pipAutoOpen: boolean
  /**
   * 친구 방 안에서만 소리를 잠시 끄기.
   * 모드별 소리 설정(soundPack)을 지우지 않고 방에 있는 동안만 덮습니다.
   * 방을 나가도 값은 남아 다음 방에서도 같은 선택이 이어집니다.
   */
  roomSoundMuted: boolean
  setNickname: (value: string) => void
  setProfile: (id: LearningProfileKind) => void
  setCalibrated: (value: boolean) => void
  toggleSound: () => void
  toggleReactionSound: () => void
  setCustomReactions: (list: string[]) => void
  togglePipAutoOpen: () => void
  toggleRoomSoundMuted: () => void
  reset: () => void
}


/** 닉네임 정리 — 최대 12자, 제어문자 제거, 빈 값이면 기본 닉네임 (docs/14 §8) */
export function normalizeNickname(raw: string): string {
  const cleaned = Array.from(raw)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0
      return code > 0x1f && code !== 0x7f
    })
    .join('')
    .trim()
  if (cleaned.length === 0) return DEFAULT_NICKNAME
  return cleaned.slice(0, 12)
}

const initialState = {
  nickname: DEFAULT_NICKNAME,
  hasOnboarded: false,
  profileId: DEFAULT_PROFILE_ID as LearningProfileKind,
  hasCalibration: false,
  soundEnabled: false,
  reactionSoundEnabled: true,
  customReactions: [] as string[],
  pipAutoOpen: false,
  roomSoundMuted: false,
}

const persisted = loadLocal(STORAGE_KEYS.user, initialState)

export const useUserStore = create<UserStoreState>((set) => ({
  ...initialState,
  ...persisted,
  // 구버전 저장분에는 없는 신규 필드 — undefined 덮어쓰기 방지
  customReactions: (persisted as { customReactions?: string[] }).customReactions ?? [],
  reactionSoundEnabled:
    (persisted as { reactionSoundEnabled?: boolean }).reactionSoundEnabled ?? true,
  roomSoundMuted:
    (persisted as { roomSoundMuted?: boolean }).roomSoundMuted ?? false,

  setNickname: (value) =>
    set({ nickname: normalizeNickname(value), hasOnboarded: true }),

  setProfile: (id) => set({ profileId: id }),

  setCalibrated: (value) => set({ hasCalibration: value }),

  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
  toggleReactionSound: () =>
    set((s) => ({ reactionSoundEnabled: !s.reactionSoundEnabled })),
  setCustomReactions: (list: string[]) =>
    set({ customReactions: list.slice(0, 3) }),

  togglePipAutoOpen: () =>
    set((s) => ({ pipAutoOpen: !s.pipAutoOpen })),

  toggleRoomSoundMuted: () =>
    set((s) => ({ roomSoundMuted: !s.roomSoundMuted })),

  reset: () => set(initialState),
}))

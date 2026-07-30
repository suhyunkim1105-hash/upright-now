import { create } from 'zustand'
import { loadLocal, saveLocal, STORAGE_KEYS } from '@/lib/storage/local'
import { useDemoStore } from '@/features/demo/demoMode'
import { CUSTOM_DEFAULT_COLOR } from '@/constants/campus'
import { normalizeHexColor, resolveCampusTheme } from './theme'
import { useCampusDirectoryStore } from './directoryStore'
import { seasonAt } from './season'
import {
  applySchoolChange,
  canChangeSchool,
  type SchoolChangeDecision,
  type SchoolChangeHistory,
} from './schoolChange'
import type { CampusThemeTokens } from './types'

/**
 * 캠퍼스 테마 선택 상태.
 *
 * 학교·직접 고른 색·변경 이력만 저장합니다.
 * 자세·카메라 관련 값은 여기에 들어오지 않습니다.
 */
interface CampusThemePersisted {
  schoolId: string | null
  customColor: string
  /** 기타/직접 설정 학교의 표시 이름 (2~30자, sanitize 후 저장) */
  customSchoolName: string
  /** 배지 등 짧은 표기 (2~8자) */
  customSchoolShortName: string
  lastChangedAt: number | null
  lastChangedSeasonId: string | null
  changesInSeason: number
  /** 지도에서 고른 기여 대상 타일 */
  targetTileId: string | null
}

interface CampusThemeState extends CampusThemePersisted {
  /** 서버 membership 동기화 결과 안내 (Settings 에서 표시 후 비움) */
  syncNotice: string | null
  /** 서버 처리 상태 — 저장 버튼·안내 표시용 */
  syncStatus: 'idle' | 'saving' | 'ok' | 'error'
  clearSyncNotice: () => void
  /**
   * 기타 학교 명시 저장 — 이름·짧은 이름·색이 모두 유효할 때만.
   * 서버(upsert existing 포함 → select) 성공 후에 로컬 선택을 확정합니다.
   */
  saveCustomSchool: (now?: number) => SchoolChangeDecision
  /** 학교를 고르거나 바꿉니다. 제한에 걸리면 상태를 바꾸지 않습니다. */
  selectSchool: (schoolId: string, now?: number) => SchoolChangeDecision
  /** 기타 / 직접 설정의 색만 바꿉니다. 학교 변경 제한과 무관합니다. */
  setCustomColor: (color: string) => boolean
  /** 기타 학교 이름 설정 — sanitize 후 저장. 학교 변경 제한과 무관 */
  setCustomSchoolName: (name: string, shortName: string) => void
  /**
   * 서버 membership 복원 전용(다른 기기·localStorage 유실) —
   * 변경 이력·쿨다운을 소모하지 않고 서버 학교를 채택합니다.
   */
  adoptServerSchool: (
    schoolId: string,
    entry: {
      displayName: string
      shortName: string
      color: string
      isCustom: boolean
    } | null,
  ) => void
  setTargetTile: (tileId: string | null) => void
  /** 지금 학교를 바꿀 수 있는지 미리 확인합니다. */
  checkChange: (schoolId: string, now?: number) => SchoolChangeDecision
  reset: () => void
}

const initialState: CampusThemePersisted = {
  schoolId: null,
  customColor: CUSTOM_DEFAULT_COLOR,
  customSchoolName: '',
  customSchoolShortName: '',
  lastChangedAt: null,
  lastChangedSeasonId: null,
  changesInSeason: 0,
  targetTileId: null,
}

const persisted = loadLocal<CampusThemePersisted>(STORAGE_KEYS.campus, initialState)

function persist(state: CampusThemePersisted): void {
  // 데모 값이 실제 설정으로 새지 않게 합니다. (persist.ts 와 같은 규칙)
  if (useDemoStore.getState().isDemo) return
  saveLocal(STORAGE_KEYS.campus, {
    schoolId: state.schoolId,
    customColor: state.customColor,
    customSchoolName: state.customSchoolName,
    customSchoolShortName: state.customSchoolShortName,
    lastChangedAt: state.lastChangedAt,
    lastChangedSeasonId: state.lastChangedSeasonId,
    changesInSeason: state.changesInSeason,
    targetTileId: state.targetTileId,
  })
}

function historyOf(state: CampusThemePersisted): SchoolChangeHistory {
  return {
    schoolId: state.schoolId,
    lastChangedAt: state.lastChangedAt,
    lastChangedSeasonId: state.lastChangedSeasonId,
    changesInSeason: state.changesInSeason,
  }
}

export const useCampusThemeStore = create<CampusThemeState>((set, get) => ({
  syncNotice: null,
  syncStatus: 'idle',
  clearSyncNotice: () => set({ syncNotice: null, syncStatus: 'idle' }),

  saveCustomSchool: (now = Date.now()) => {
    const name = sanitizeSchoolName(get().customSchoolName, 30)
    const shortName = sanitizeSchoolName(get().customSchoolShortName, 8)
    const color = normalizeHexColor(get().customColor)
    if (name.length < 2 || shortName.length < 2 || !color) {
      set({
        syncStatus: 'error',
        syncNotice: '학교 이름(2~30자)·짧은 이름(2~8자)·색을 확인해 주세요.',
      })
      return { allowed: false, firstPick: false }
    }
    const stableKey = customSchoolStableKey(name)
    // 같은 학교 재저장(짧은 이름·색 수정)은 "학교 변경"이 아니므로
    // 변경 제한을 검사하지 않고 변경 이력도 소모하지 않습니다.
    const isSameSchool = stableKey === get().schoolId
    const decision: SchoolChangeDecision = isSameSchool
      ? { allowed: true, firstPick: false }
      : get().checkChange(stableKey, now)
    if (!decision.allowed) return decision

    const prev: CampusThemePersisted = {
      schoolId: get().schoolId,
      customColor: get().customColor,
      customSchoolName: get().customSchoolName,
      customSchoolShortName: get().customSchoolShortName,
      lastChangedAt: get().lastChangedAt,
      lastChangedSeasonId: get().lastChangedSeasonId,
      changesInSeason: get().changesInSeason,
      targetTileId: get().targetTileId,
    }
    const season = seasonAt(now)
    const nextHistory = isSameSchool
      ? historyOf(get())
      : applySchoolChange(historyOf(get()), stableKey, season.id, now)
    const next: CampusThemePersisted = {
      ...prev,
      schoolId: stableKey,
      lastChangedAt: nextHistory.lastChangedAt,
      lastChangedSeasonId: nextHistory.lastChangedSeasonId,
      changesInSeason: nextHistory.changesInSeason,
      // 학교가 실제로 바뀔 때만 목표 타일을 초기화합니다.
      targetTileId: isSameSchool ? prev.targetTileId : null,
    }
    set({ ...next, syncStatus: 'saving', syncNotice: '학교 정보를 저장하는 중이에요…' })
    persist(next)

    void import('./campusStore').then(async (m) => {
      const result = await m.syncSchoolSelection(stableKey)
      if (
        result === 'change_limit' ||
        result === 'change_cooldown' ||
        result === 'ownership_conflict' ||
        result === 'name_conflict' ||
        result === 'not_ready'
      ) {
        persist(prev)
        set({
          ...prev,
          syncStatus: 'error',
          syncNotice:
            result === 'change_limit'
              ? '이번 시즌 학교 변경 횟수를 다 썼어요. 다음 시즌에 바꿀 수 있어요.'
              : result === 'change_cooldown'
                ? '학교는 마지막 변경 후 7일이 지나야 바꿀 수 있어요.'
                : result === 'ownership_conflict'
                  ? '다른 사용자가 등록한 학교예요. 같은 이름 그대로면 참여할 수 있지만 표시 정보는 바꿀 수 없어요.'
                  : result === 'name_conflict'
                    ? '이미 다른 학교가 쓰는 표기와 겹쳐요. 다른 이름을 골라 주세요.'
                    : '서버에 학교 정보를 저장하지 못했어요. 이전 학교를 유지할게요.',
        })
      } else {
        set({
          syncStatus: 'ok',
          syncNotice: '학교 정보가 저장되고 선택됐어요.',
        })
      }
    })
    return decision
  },
  ...initialState,
  ...persisted,
  // 구버전 저장분 가드 — 신규 필드 undefined 방지
  customSchoolName: persisted.customSchoolName ?? '',
  customSchoolShortName: persisted.customSchoolShortName ?? '',
  // 구버전 'custom' id migration — 이름이 있으면 이름 기반 stable key 로.
  // (사용자 데이터 삭제 없음. 이름이 없으면 그대로 두고 저장 버튼이 유도)
  schoolId:
    persisted.schoolId === 'custom' &&
    (persisted.customSchoolName ?? '').trim().length >= 2
      ? customSchoolStableKey(persisted.customSchoolName ?? '')
      : (persisted.schoolId ?? null),

  checkChange: (schoolId, now = Date.now()) => {
    const season = seasonAt(now)
    return canChangeSchool(
      {
        history: historyOf(get()),
        seasonId: season.id,
        seasonEndsAt: season.endsAt,
        now,
      },
      schoolId,
    )
  },

  selectSchool: (schoolId, now = Date.now()) => {
    const decision = get().checkChange(schoolId, now)
    if (!decision.allowed) return decision
    // 커스텀 학교는 saveCustomSchool 의 명시 저장 버튼으로만 확정합니다.
    // 라디오/프로그램 호출로는 로컬도 서버도 바뀌지 않습니다.
    if (schoolId === 'custom' || schoolId.startsWith('custom-')) {
      return decision
    }
    // 서버가 거부하면 되돌릴 이전 상태
    const prevSnapshot: CampusThemePersisted = {
      schoolId: get().schoolId,
      customColor: get().customColor,
      customSchoolName: get().customSchoolName,
      customSchoolShortName: get().customSchoolShortName,
      lastChangedAt: get().lastChangedAt,
      lastChangedSeasonId: get().lastChangedSeasonId,
      changesInSeason: get().changesInSeason,
      targetTileId: get().targetTileId,
    }

    const season = seasonAt(now)
    const nextHistory = applySchoolChange(historyOf(get()), schoolId, season.id, now)
    const next: CampusThemePersisted = {
      ...get(),
      schoolId: nextHistory.schoolId,
      lastChangedAt: nextHistory.lastChangedAt,
      lastChangedSeasonId: nextHistory.lastChangedSeasonId,
      changesInSeason: nextHistory.changesInSeason,
      // 학교가 바뀌면 이전 학교에서 고른 대상 타일도 버립니다.
      targetTileId: null,
    }
    set(next)
    persist(next)
    /*
      Supabase 저장소가 켜져 있으면 서버 membership 이 최종 판정입니다.
      서버가 change_limit / not_ready 를 돌려주면 로컬 선택을 원복하고
      안내 문구(syncNotice)를 남깁니다. mock 은 'unchanged' 로 통과합니다.
    */
    const before = { ...prevSnapshot }
    void import('./campusStore').then(async (m) => {
      const result = await m.syncSchoolSelection(schoolId)
      if (result === 'verification_required') {
        set({
          syncStatus: 'ok',
          syncNotice: '학교 이메일 인증을 완료하면 영토전에 기여할 수 있어요.',
        })
        return
      }
      if (
        result === 'change_limit' ||
        result === 'change_cooldown' ||
        result === 'not_ready'
      ) {
        persist(before)
        set({
          ...before,
          syncNotice:
            result === 'change_limit'
              ? '이번 시즌 학교 변경 횟수를 다 썼어요. 다음 시즌에 바꿀 수 있어요.'
              : result === 'change_cooldown'
                ? '학교는 마지막 변경 후 7일이 지나야 바꿀 수 있어요.'
                : '서버에 학교 선택을 저장하지 못했어요. 이전 학교를 유지할게요.',
        })
      } else if (result === 'selected' || result === 'changed') {
        set({ syncNotice: '학교 선택이 서버에 저장됐어요.' })
      }
    })
    return decision
  },

  adoptServerSchool: (schoolId, entry) => {
    const next: CampusThemePersisted = {
      ...get(),
      schoolId,
      customSchoolName: entry?.isCustom ? sanitizeSchoolName(entry.displayName, 30) : get().customSchoolName,
      customSchoolShortName: entry?.isCustom
        ? sanitizeSchoolName(entry.shortName, 8)
        : get().customSchoolShortName,
      customColor:
        entry?.isCustom && normalizeHexColor(entry.color)
          ? normalizeHexColor(entry.color)!
          : get().customColor,
      targetTileId: null,
    }
    set(next)
    persist(next)
    set({ syncNotice: '이 기기에서 서버의 학교 선택을 복원했어요.', syncStatus: 'ok' })
  },

  setCustomSchoolName: (name, shortName) => {
    const next = {
      ...get(),
      customSchoolName: sanitizeSchoolName(name, 30),
      customSchoolShortName: sanitizeSchoolName(shortName, 8),
    }
    persist(next)
    set({
      customSchoolName: next.customSchoolName,
      customSchoolShortName: next.customSchoolShortName,
    })
  },

  setCustomColor: (color) => {
    const normalized = normalizeHexColor(color)
    if (!normalized) return false
    const next = { ...get(), customColor: normalized }
    set({ customColor: normalized })
    persist(next)
    return true
  },

  setTargetTile: (tileId) => {
    const next = { ...get(), targetTileId: tileId }
    set({ targetTileId: tileId })
    persist(next)
  },

  reset: () => {
    set(initialState)
    persist(initialState)
  },
}))

/**
 * 커스텀 학교 토큰에 실제 이름·짧은 이름을 입힙니다.
 * 우선순위: 서버 디렉터리 → 내 로컬 입력 → (마지막) 프리셋 일반명.
 * "직접 설정"·stable key 가 화면에 노출되지 않게 하는 단일 지점입니다.
 */
function withCustomIdentity(
  tokens: CampusThemeTokens | null,
  schoolId: string | null,
  localName: string,
  localShort: string,
): CampusThemeTokens | null {
  if (!tokens || !schoolId?.startsWith('custom')) return tokens
  const entry = useCampusDirectoryStore.getState().entries[schoolId]
  const name =
    entry?.displayName && entry.displayName.trim().length >= 2
      ? entry.displayName
      : localName.trim().length >= 2
        ? localName
        : tokens.schoolName
  const short =
    entry?.shortName && entry.shortName.trim().length >= 2
      ? entry.shortName
      : localShort.trim().length >= 2
        ? localShort
        : tokens.short
  if (name === tokens.schoolName && short === tokens.short) return tokens
  return { ...tokens, schoolName: name, short }
}

/** 현재 선택에서 파생된 테마 토큰. 학교를 고르지 않았으면 null. */
export function selectCampusTheme(state: CampusThemeState): CampusThemeTokens | null {
  return withCustomIdentity(
    resolveCampusTheme(state.schoolId, state.customColor),
    state.schoolId,
    state.customSchoolName,
    state.customSchoolShortName,
  )
}

export function useCampusTheme(): CampusThemeTokens | null {
  const schoolId = useCampusThemeStore((s) => s.schoolId)
  const customColor = useCampusThemeStore((s) => s.customColor)
  const customSchoolName = useCampusThemeStore((s) => s.customSchoolName)
  const customSchoolShortName = useCampusThemeStore((s) => s.customSchoolShortName)
  // 디렉터리 갱신(다른 브라우저의 등록 등)에도 배지가 즉시 따라오게 구독합니다.
  useCampusDirectoryStore((s) => s.entries)
  return withCustomIdentity(
    resolveCampusTheme(schoolId, customColor),
    schoolId,
    customSchoolName,
    customSchoolShortName,
  )
}

/** 학교 이름 정리 — HTML 태그·제어문자 제거 */
export function sanitizeSchoolName(raw: string, max: number): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/**
 * 커스텀 학교의 안정 내부 key — 표시 이름과 분리됩니다.
 * 같은 이름(정규화 기준)은 항상 같은 key 가 됩니다. (djb2 해시)
 */
export function customSchoolStableKey(name: string): string {
  const normalized = sanitizeSchoolName(name, 30)
    .toLowerCase()
    .replace(/\s+/g, '')
  let hash = 5381
  for (let i = 0; i < normalized.length; i += 1) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0
  }
  return `custom-${(hash >>> 0).toString(16)}`
}

/** 화면 표시용 학교 이름 — 커스텀이면 사용자가 입력한 이름 */
export function displaySchoolName(
  schoolId: string | null,
  presetName: string | undefined,
  customName: string,
): string {
  if (schoolId === 'custom' || schoolId?.startsWith('custom-')) {
    return customName || '직접 설정 학교'
  }
  return presetName ?? '미선택'
}

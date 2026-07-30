import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  customSchoolStableKey,
  useCampusThemeStore,
} from './campusThemeStore'
import { resolveCampusTheme } from './theme'

/**
 * 기타 학교 "명시 저장" 흐름 검증.
 *
 * - 라디오/selectSchool 만으로는 서버 호출도 로컬 확정도 없어야 합니다.
 * - [학교 정보 저장하고 선택] = saveCustomSchool 만 서버 upsert → select 를
 *   수행하고, 서버 성공 후에만 로컬 선택이 유지됩니다.
 */

const syncSchoolSelection = vi.fn<(id: string) => Promise<string>>()

vi.mock('./campusStore', () => ({
  get syncSchoolSelection() {
    return syncSchoolSelection
  },
}))

const VALID = {
  customSchoolName: '한밭대학교',
  customSchoolShortName: '한밭대',
  customColor: '#4A5CA8',
}

function seedState(overrides: Partial<ReturnType<typeof useCampusThemeStore.getState>> = {}) {
  useCampusThemeStore.setState({
    schoolId: null,
    customColor: '#4A5CA8',
    customSchoolName: '',
    customSchoolShortName: '',
    lastChangedAt: null,
    lastChangedSeasonId: null,
    changesInSeason: 0,
    targetTileId: null,
    syncNotice: null,
    syncStatus: 'idle',
    ...overrides,
  })
}

async function flush(): Promise<void> {
  // 동적 import + await 체인이 끝날 때까지 매크로태스크 2회를 기다립니다.
  await new Promise((r) => setTimeout(r, 0))
  await new Promise((r) => setTimeout(r, 0))
}

beforeEach(async () => {
  // 스토어 내부의 동적 import 가 캐시에서 즉시 풀리도록 미리 로드합니다.
  const mocked = await import('./campusStore')
  expect(mocked.syncSchoolSelection).toBe(syncSchoolSelection)
  syncSchoolSelection.mockReset()
  syncSchoolSelection.mockResolvedValue('selected')
  seedState()
})

describe('커스텀 학교 — 라디오 선택만으로는 아무 일도 없다', () => {
  it("selectSchool('custom') 은 서버를 호출하지 않고 로컬도 바꾸지 않는다", async () => {
    const decision = useCampusThemeStore.getState().selectSchool('custom', Date.now())
    await flush()
    expect(decision.allowed).toBe(true)
    expect(useCampusThemeStore.getState().schoolId).toBeNull()
    expect(syncSchoolSelection).not.toHaveBeenCalled()
  })

  it('custom-* stable key 를 직접 넘겨도 동일하다', async () => {
    useCampusThemeStore.getState().selectSchool('custom-deadbeef', Date.now())
    await flush()
    expect(useCampusThemeStore.getState().schoolId).toBeNull()
    expect(syncSchoolSelection).not.toHaveBeenCalled()
  })

  it('프리셋 학교 선택은 기존처럼 서버 sync 를 수행한다', async () => {
    useCampusThemeStore.getState().selectSchool('knu', Date.now())
    await flush()
    expect(useCampusThemeStore.getState().schoolId).toBe('knu')
    expect(syncSchoolSelection).toHaveBeenCalledWith('knu')
  })

  it('이메일 인증이 필요한 학교는 선택을 유지해 인증 화면으로 이어진다', async () => {
    syncSchoolSelection.mockResolvedValue('verification_required')
    useCampusThemeStore.getState().selectSchool('snu', Date.now())
    await flush()
    expect(useCampusThemeStore.getState().schoolId).toBe('snu')
    expect(useCampusThemeStore.getState().syncStatus).toBe('ok')
    expect(useCampusThemeStore.getState().syncNotice).toContain('이메일 인증')
  })
})

describe('saveCustomSchool — 유효성', () => {
  it('이름이 비었으면 저장하지 않는다 (서버 호출 0)', async () => {
    seedState({ ...VALID, customSchoolName: '' })
    const decision = useCampusThemeStore.getState().saveCustomSchool(Date.now())
    await flush()
    expect(decision.allowed).toBe(false)
    expect(useCampusThemeStore.getState().schoolId).toBeNull()
    expect(useCampusThemeStore.getState().syncStatus).toBe('error')
    expect(syncSchoolSelection).not.toHaveBeenCalled()
  })

  it('이름 1자·짧은 이름 1자는 차단된다', async () => {
    seedState({ ...VALID, customSchoolName: '한' })
    expect(useCampusThemeStore.getState().saveCustomSchool(Date.now()).allowed).toBe(false)
    seedState({ ...VALID, customSchoolShortName: '한' })
    expect(useCampusThemeStore.getState().saveCustomSchool(Date.now()).allowed).toBe(false)
    await flush()
    expect(syncSchoolSelection).not.toHaveBeenCalled()
  })
})

describe('saveCustomSchool — 서버 확정/롤백', () => {
  it('유효 입력이면 stable key 로 확정하고 서버 sync 를 호출한다', async () => {
    seedState(VALID)
    const decision = useCampusThemeStore.getState().saveCustomSchool(Date.now())
    expect(decision.allowed).toBe(true)
    const key = customSchoolStableKey(VALID.customSchoolName)
    expect(key).toMatch(/^custom-[0-9a-f]{1,8}$/)
    expect(useCampusThemeStore.getState().schoolId).toBe(key)
    expect(useCampusThemeStore.getState().syncStatus).toBe('saving')
    await flush()
    expect(syncSchoolSelection).toHaveBeenCalledWith(key)
    expect(useCampusThemeStore.getState().syncStatus).toBe('ok')
  })

  it('서버가 change_cooldown 을 돌려주면 이전 학교로 원복한다', async () => {
    syncSchoolSelection.mockResolvedValue('change_cooldown')
    seedState({ ...VALID, schoolId: 'knu' })
    useCampusThemeStore.getState().saveCustomSchool(Date.now())
    await flush()
    expect(useCampusThemeStore.getState().schoolId).toBe('knu')
    expect(useCampusThemeStore.getState().syncStatus).toBe('error')
    expect(useCampusThemeStore.getState().syncNotice).toContain('7일')
  })

  it('ownership_conflict 도 이전 학교를 유지하고 사유를 안내한다', async () => {
    syncSchoolSelection.mockResolvedValue('ownership_conflict')
    seedState({ ...VALID, schoolId: 'knu' })
    useCampusThemeStore.getState().saveCustomSchool(Date.now())
    await flush()
    expect(useCampusThemeStore.getState().schoolId).toBe('knu')
    expect(useCampusThemeStore.getState().syncNotice).toContain('다른 사용자')
  })

  it('같은 학교 재저장(표시정보 수정)은 변경 이력을 소모하지 않는다', async () => {
    const key = customSchoolStableKey(VALID.customSchoolName)
    seedState({
      ...VALID,
      schoolId: key,
      changesInSeason: 1,
      lastChangedAt: 1_000,
      targetTileId: 'season-1:3-4',
    })
    const decision = useCampusThemeStore.getState().saveCustomSchool(Date.now())
    await flush()
    expect(decision.allowed).toBe(true)
    const s = useCampusThemeStore.getState()
    expect(s.schoolId).toBe(key)
    expect(s.changesInSeason).toBe(1)
    expect(s.lastChangedAt).toBe(1_000)
    expect(s.targetTileId).toBe('season-1:3-4')
    expect(syncSchoolSelection).toHaveBeenCalledWith(key)
  })
})

describe('custom stable key — 테마·마이그레이션', () => {
  it('custom-* stable key 도 커스텀 테마로 해석된다', () => {
    const theme = resolveCampusTheme('custom-1a2b3c4d', '#4A5CA8')
    expect(theme).not.toBeNull()
    expect(theme?.primary.toUpperCase()).toBe('#4A5CA8')
  })

  it("구버전 schoolId='custom' 저장분은 이름 기반 stable key 로 이관된다", async () => {
    vi.resetModules()
    localStorage.setItem(
      'upright-now:campus',
      JSON.stringify({
        v: 2,
        data: {
          schoolId: 'custom',
          customColor: '#4A5CA8',
          customSchoolName: '한밭대학교',
          customSchoolShortName: '한밭대',
          lastChangedAt: 123,
          lastChangedSeasonId: 'season-1',
          changesInSeason: 1,
          targetTileId: null,
        },
      }),
    )
    const fresh = await import('./campusThemeStore')
    const migrated = fresh.useCampusThemeStore.getState()
    expect(migrated.schoolId).toBe(fresh.customSchoolStableKey('한밭대학교'))
    // 나머지 값은 무손실
    expect(migrated.customSchoolName).toBe('한밭대학교')
    expect(migrated.changesInSeason).toBe(1)
    localStorage.removeItem('upright-now:campus')
  })
})

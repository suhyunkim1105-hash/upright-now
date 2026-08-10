import { beforeEach, describe, expect, it } from 'vitest'
import { hasValidActiveProfile, useCalibrationStore } from './calibrationStore'
import { makeProfile } from '@/features/posture-engine/testFixtures'

describe('활성 자세 기준 검증 — 프로필 개수가 아니라 활성 기준의 유효성', () => {
  beforeEach(() => {
    useCalibrationStore.getState().clear()
  })

  it('프로필은 있지만 activeProfileId 가 없으면 시작 불가', () => {
    expect(
      hasValidActiveProfile({
        profiles: [makeProfile()],
        activeProfileId: null,
      }),
    ).toBe(false)
  })

  it('activeProfileId 가 삭제된 프로필을 가리키면 시작 불가', () => {
    expect(
      hasValidActiveProfile({
        profiles: [{ ...makeProfile(), id: 'p-alive' }],
        activeProfileId: 'p-deleted',
      }),
    ).toBe(false)
  })

  it('유효한 활성 프로필이면 시작 가능', () => {
    const p = { ...makeProfile(), id: 'p-1' }
    expect(
      hasValidActiveProfile({ profiles: [p], activeProfileId: 'p-1' }),
    ).toBe(true)
  })

  it('스키마 버전이 다르면 시작 불가', () => {
    const stale = { ...makeProfile(), id: 'p-old', version: 2 as unknown as 3 }
    expect(
      hasValidActiveProfile({ profiles: [stale], activeProfileId: 'p-old' }),
    ).toBe(false)
  })

  it('활성 프로필을 삭제하면 다른 프로필을 자동 선택하지 않는다', () => {
    const store = useCalibrationStore.getState()
    store.addProfile({ ...makeProfile(), id: 'p-1', name: '집 책상' })
    store.addProfile({ ...makeProfile(), id: 'p-2', name: '도서관' })
    store.selectProfile('p-2')

    store.removeProfile('p-2')

    const s = useCalibrationStore.getState()
    expect(s.profiles).toHaveLength(1)
    expect(s.activeProfileId).toBeNull()
    expect(s.profile).toBeNull()
    expect(hasValidActiveProfile(s)).toBe(false)
  })

  it('활성이 아닌 프로필을 삭제하면 활성 선택은 유지된다', () => {
    const store = useCalibrationStore.getState()
    store.addProfile({ ...makeProfile(), id: 'p-1' })
    store.addProfile({ ...makeProfile(), id: 'p-2' })
    store.selectProfile('p-1')

    store.removeProfile('p-2')

    expect(useCalibrationStore.getState().activeProfileId).toBe('p-1')
    expect(hasValidActiveProfile(useCalibrationStore.getState())).toBe(true)
  })
})

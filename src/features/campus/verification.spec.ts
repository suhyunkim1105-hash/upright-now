import { describe, expect, it } from 'vitest'
import { normalizeSchoolEmail, verificationActionState } from './verification'

describe('campus school verification helpers', () => {
  it('normalizes an email and derives its domain', () => {
    expect(normalizeSchoolEmail(' Student@SNU.AC.KR ')).toEqual({
      email: 'student@snu.ac.kr',
      domain: 'snu.ac.kr',
    })
  })

  it('rejects malformed email input', () => {
    expect(normalizeSchoolEmail('not-an-email')).toBeNull()
  })

  it('allows territory contribution only for the matching verified school', () => {
    expect(verificationActionState({ schoolId: 'snu', verifiedSchoolId: null }))
      .toBe('verification_required')
    expect(verificationActionState({ schoolId: 'snu', verifiedSchoolId: 'yonsei' }))
      .toBe('school_mismatch')
    expect(verificationActionState({ schoolId: 'snu', verifiedSchoolId: 'snu' }))
      .toBe('allowed')
  })
})

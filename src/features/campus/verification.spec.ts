import { describe, expect, it } from 'vitest'
import { isSchoolEmailDomain, normalizeSchoolEmail, verificationActionState } from './verification'

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

  it('checks the selected school domain before sending a link', () => {
    expect(isSchoolEmailDomain('yonsei', 'yonsei.ac.kr')).toBe(true)
    expect(isSchoolEmailDomain('yonsei', 'gmail.com')).toBe(false)
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

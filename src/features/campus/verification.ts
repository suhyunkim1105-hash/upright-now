export type CampusVerificationActionState =
  | 'school_required'
  | 'verification_required'
  | 'school_mismatch'
  | 'allowed'

export function normalizeSchoolEmail(raw: string): { email: string; domain: string } | null {
  const email = raw.trim().toLowerCase()
  const match = /^([^@\s]+)@([a-z0-9.-]+\.[a-z]{2,})$/i.exec(email)
  return match ? { email, domain: match[2] } : null
}

export function verificationActionState(input: {
  schoolId: string | null
  verifiedSchoolId: string | null
}): CampusVerificationActionState {
  if (!input.schoolId) return 'school_required'
  if (!input.verifiedSchoolId) return 'verification_required'
  return input.schoolId === input.verifiedSchoolId ? 'allowed' : 'school_mismatch'
}

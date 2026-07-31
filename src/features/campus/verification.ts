export type CampusVerificationActionState =
  | 'school_required'
  | 'verification_required'
  | 'school_mismatch'
  | 'allowed'

/** Supabase campus_school_domains 시드와 동일한 프리셋 도메인입니다. */
export const SCHOOL_EMAIL_DOMAINS: Record<string, string> = {
  snu: 'snu.ac.kr',
  yonsei: 'yonsei.ac.kr',
  korea: 'korea.ac.kr',
  sogang: 'sogang.ac.kr',
  skku: 'skku.edu',
  hanyang: 'hanyang.ac.kr',
  cau: 'cau.ac.kr',
  khu: 'khu.ac.kr',
  hufs: 'hufs.ac.kr',
  uos: 'uos.ac.kr',
}

export function normalizeSchoolEmail(raw: string): { email: string; domain: string } | null {
  const email = raw.trim().toLowerCase()
  const match = /^([^@\s]+)@([a-z0-9.-]+\.[a-z]{2,})$/i.exec(email)
  return match ? { email, domain: match[2] } : null
}

export function isSchoolEmailDomain(schoolId: string, domain: string): boolean {
  return SCHOOL_EMAIL_DOMAINS[schoolId] === domain.toLowerCase()
}

export function verificationActionState(input: {
  schoolId: string | null
  verifiedSchoolId: string | null
}): CampusVerificationActionState {
  if (!input.schoolId) return 'school_required'
  if (!input.verifiedSchoolId) return 'verification_required'
  return input.schoolId === input.verifiedSchoolId ? 'allowed' : 'school_mismatch'
}

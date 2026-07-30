import { useState } from 'react'
import { Button, Card } from '@/components/ui'
import {
  getCampusRepository,
  syncSchoolSelection,
  useCampusStore,
} from '@/features/campus/campusStore'
import { normalizeSchoolEmail } from '@/features/campus/verification'

const MESSAGE: Record<string, string> = {
  invalid_email: '학교 이메일 주소를 확인해 주세요.',
  network_error: '인증 요청에 실패했어요. 잠시 후 다시 시도해 주세요.',
  otp_invalid: '인증 코드가 맞지 않아요.',
  otp_expired: '인증 코드가 만료됐어요. 새 코드를 받아 주세요.',
  domain_mismatch: '선택한 학교의 이메일 도메인이 아니에요.',
}

export function SchoolVerification({ schoolId, schoolName }: { schoolId: string; schoolName: string }) {
  const verification = useCampusStore((s) => s.verification)
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [sent, setSent] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (verification?.schoolId === schoolId) {
    return <p className="rounded-xl bg-green-soft px-3 py-2 text-xs font-bold text-ink">{`${schoolName} 이메일 인증이 완료됐어요. 영토전에 참여할 수 있어요.`}</p>
  }

  const requestCode = async () => {
    const normalized = normalizeSchoolEmail(email)
    if (!normalized) return setMessage(MESSAGE.invalid_email)
    const repository = getCampusRepository()
    if (!repository?.requestSchoolVerification) return setMessage('서버 연결 후 인증할 수 있어요.')
    setBusy(true)
    const result = await repository.requestSchoolVerification(normalized.email)
    setBusy(false)
    if (result === 'sent') { setSent(true); setMessage(null) } else setMessage(MESSAGE[result])
  }

  const confirmCode = async () => {
    const normalized = normalizeSchoolEmail(email)
    const repository = getCampusRepository()
    if (!normalized || !repository?.confirmSchoolVerification) return setMessage(MESSAGE.invalid_email)
    setBusy(true)
    const result = await repository.confirmSchoolVerification(schoolId, normalized.email, token.trim())
    if (result === 'verified') {
      const next = await repository.fetchMyVerification?.()
      useCampusStore.setState({ verification: next ?? null })
      await syncSchoolSelection(schoolId)
      setMessage(null)
    } else setMessage(MESSAGE[result])
    setBusy(false)
  }

  return <Card className="mb-4 p-4"><p className="font-bold text-ink">학교 이메일 인증이 필요해요</p><p className="mt-1 text-xs text-ink-soft">인증을 마치면 {schoolName} 이름으로 영토전에 기여하고 점령할 수 있어요.</p><label className="mt-3 block text-xs font-bold text-ink" htmlFor="school-email">{`${schoolName} 이메일`}</label><input id="school-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm" placeholder="student@university.ac.kr" />{sent && <><label className="mt-3 block text-xs font-bold text-ink" htmlFor="school-code">6자리 인증 코드</label><input id="school-code" value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm" /></>}{message && <p role="status" className="mt-2 text-xs text-coral">{message}</p>}<Button size="sm" className="mt-3" disabled={busy || (sent && token.length !== 6)} onClick={() => void (sent ? confirmCode() : requestCode())}>{sent ? '인증 완료' : '인증 코드 받기'}</Button></Card>
}

import { useEffect, useState } from 'react'
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
  redirect_not_allowed: 'Supabase URL Configuration에 현재 주소를 Redirect URL로 추가해 주세요.',
  domain_mismatch: '선택한 학교의 이메일 도메인이 아니에요.',
}

export function SchoolVerification({ schoolId, schoolName }: { schoolId: string; schoolName: string }) {
  const verification = useCampusStore((s) => s.verification)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const finishVerification = async () => {
    const repository = getCampusRepository()
    if (!repository?.confirmSchoolVerification) return setMessage('서버 연결 후 인증할 수 있어요.')
    setBusy(true)
    const result = await repository.confirmSchoolVerification(schoolId)
    if (result === 'verified') {
      localStorage.removeItem('upright-now:campus:verification-pending')
      const next = await repository.fetchMyVerification?.()
      useCampusStore.setState({ verification: next ?? null })
      await syncSchoolSelection(schoolId)
      setMessage(null)
    } else setMessage(MESSAGE[result])
    setBusy(false)
  }

  useEffect(() => {
    try {
      const pending = JSON.parse(
        localStorage.getItem('upright-now:campus:verification-pending') ?? 'null',
      ) as { schoolId?: string; email?: string } | null
      if (pending?.schoolId !== schoolId || !pending.email) return
      setEmail(pending.email)
      setSent(true)
      void finishVerification()
    } catch {
      // 손상된 로컬 대기 상태는 무시하고 사용자가 다시 요청할 수 있게 합니다.
    }
  }, [schoolId])

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
    if (result === 'sent') {
      localStorage.setItem(
        'upright-now:campus:verification-pending',
        JSON.stringify({ schoolId, email: normalized.email }),
      )
      setSent(true)
      setMessage(null)
    } else setMessage(MESSAGE[result])
  }

  return <Card className="mb-4 p-4"><p className="font-bold text-ink">학교 이메일 인증이 필요해요</p><p className="mt-1 text-xs text-ink-soft">인증을 마치면 {schoolName} 이름으로 영토전에 기여하고 점령할 수 있어요.</p><label className="mt-3 block text-xs font-bold text-ink" htmlFor="school-email">{`${schoolName} 이메일`}</label><input id="school-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" className="mt-1 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm" placeholder="student@university.ac.kr" />{sent && <p className="mt-3 rounded-xl bg-blue-soft px-3 py-2 text-xs text-ink">메일의 <strong>Sign in</strong> 링크를 누르면 인증이 자동으로 완료돼요. 이 화면으로 돌아오면 잠시 기다려 주세요.</p>}{message && <output className="mt-2 block text-xs text-coral">{message}</output>}<Button size="sm" className="mt-3" disabled={busy} onClick={() => void (sent ? finishVerification() : requestCode())}>{sent ? '메일 링크 인증 완료' : '인증 메일 보내기'}</Button></Card>
}

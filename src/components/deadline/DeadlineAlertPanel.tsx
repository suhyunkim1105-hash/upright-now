import { useEffect } from 'react'
import { DeadlineChick } from './DeadlineChick'
import { formatRemaining } from '@/features/deadline/deadlineLogic'
import { useDeadlineStore } from '@/features/deadline/deadlineStore'

/**
 * 마감순경 삐약 알림 패널 — 기존 콘텐츠를 가리지 않는 작은 패널.
 * 세션 화면·PIP·화면 안 미니 위젯에서 같은 store 를 구독해 동기화됩니다.
 * 미루기에는 XP·포인트 차감이 없고, 알림은 언제든 끌 수 있습니다.
 */
export function DeadlineAlertPanel({ compact = false }: { compact?: boolean }) {
  const panel = useDeadlineStore((s) => s.panel)
  const deadlineAt = useDeadlineStore((s) => s.taskDeadlineAt)
  const snooze = useDeadlineStore((s) => s.snooze)
  const complete = useDeadlineStore((s) => s.complete)
  const disableForSession = useDeadlineStore((s) => s.disableForSession)
  const hidePanel = useDeadlineStore((s) => s.hidePanel)

  // 축하 패널은 잠시 보였다가 스스로 사라집니다.
  useEffect(() => {
    if (!panel?.celebratory) return
    const timer = window.setTimeout(hidePanel, 6000)
    return () => window.clearTimeout(timer)
  }, [panel, hidePanel])

  if (!panel) return null

  return (
    <section
      data-testid="deadline-alert-panel"
      aria-live="polite"
      className={[
        'rounded-2xl border border-yellow bg-yellow-soft shadow-card',
        compact ? 'p-2.5' : 'p-3.5',
      ].join(' ')}
    >
      <div className="flex items-start gap-2.5">
        <DeadlineChick pose={panel.pose} size={compact ? 40 : 52} />
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[11px] font-bold text-[#8a6b12]">
            마감순경 삐약
            {deadlineAt !== null && !panel.celebratory && (
              <span className="tabular ml-1.5 font-semibold">
                {formatRemaining(Date.now(), deadlineAt)}
              </span>
            )}
          </p>
          <p
            className={[
              'mt-0.5 leading-snug font-semibold text-ink',
              compact ? 'text-[12px]' : 'text-sm',
            ].join(' ')}
          >
            {panel.message}
          </p>
        </div>
      </div>

      {!panel.celebratory && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            type="button"
            className="h-7 rounded-lg bg-pink px-2.5 text-[11px] font-bold text-white"
            onClick={complete}
          >
            완료
          </button>
          {[5, 15, 60].map((minutes) => (
            <button
              key={minutes}
              type="button"
              className="h-7 rounded-lg border border-line bg-surface px-2 text-[11px] font-semibold text-ink"
              onClick={() => snooze(minutes)}
            >
              {minutes === 60 ? '1시간' : `${minutes}분`} 미루기
            </button>
          ))}
          <button
            type="button"
            className="h-7 rounded-lg px-2 text-[11px] font-semibold text-ink-soft"
            onClick={disableForSession}
          >
            이번 세션에서 끄기
          </button>
        </div>
      )}
    </section>
  )
}

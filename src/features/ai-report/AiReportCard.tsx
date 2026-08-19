import { useState } from 'react'
import { authedFetch } from '@/lib/supabase/client'
import { useObject } from '@ai-sdk/react'
import { Badge, Button, Card, CardTitle } from '@/components/ui'
import {
  AiSessionReportSchema,
  createAiReportInput,
  isSafeAiSessionReport,
} from './contract'
import type { AiSessionReport, SessionSummary } from '@/types'

function errorMessage(error: Error): string {
  if (error.message.includes('AI_REPORT_UNAVAILABLE')) {
    return 'AI 회고가 아직 준비되지 않았어요. 잠시 뒤 다시 시도해 주세요.'
  }
  if (error.message.includes('AI_REPORT_RATE_LIMITED')) {
    return '짧은 시간에 여러 번 요청했어요. 잠시 뒤 다시 시도해 주세요.'
  }
  return 'AI 회고를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.'
}

/**
 * 다섯 칸 — docs/23_AI_REPORT_SPEC.md §3.
 * 위에서 아래로 읽으면 끝나고, 1번만 읽고 닫아도 세션이 완결됩니다.
 */
function ReportContent({ report }: { report: AiSessionReport }) {
  return (
    <div className="mt-4 space-y-4">
      {/* 1 · 한 줄 */}
      <div className="rounded-2xl border border-blue/25 bg-surface px-4 py-4">
        <p className="text-xs font-bold tracking-wide text-[#2b52a8]">이번 세션</p>
        <h3 className="mt-1 text-base font-bold text-ink">{report.headline}</h3>
      </div>

      {/* 2 · 오늘의 숫자 */}
      <dl className="grid grid-cols-3 gap-2">
        {report.stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-blue/15 bg-surface/80 px-3 py-3"
          >
            <dt className="text-xs text-ink-soft">{stat.label}</dt>
            <dd className="mt-0.5 text-sm font-bold tabular-nums text-ink">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {/* 3 · 무엇이 흔들렸나 — 관찰이 없으면 이 칸 자체가 없습니다.
             빈 제목만 남기면 "분석 실패" 처럼 보입니다. */}
      {report.observations.length > 0 && (
        <ul className="space-y-2">
          {report.observations.map((o) => (
            <li
              key={o.fact}
              className="rounded-xl border border-blue/15 bg-surface/80 px-3 py-3"
            >
              {/* 사실과 해석을 시각적으로도 나눕니다 — 어디까지가 측정인지
                  보이지 않으면 둘 다 의심받습니다. */}
              <p className="text-sm font-bold text-ink">{o.fact}</p>
              <p className="mt-1 text-xs leading-5 text-ink-soft">{o.read}</p>
            </li>
          ))}
        </ul>
      )}

      {/* 4 · 다음 세션 한 가지 */}
      <div className="rounded-2xl border border-pink/25 bg-pink-soft/70 px-4 py-4">
        <p className="text-xs font-bold tracking-wide text-[#b8285a]">
          다음 {report.nextAction.durationMinutes}분
        </p>
        <p className="mt-1 text-sm font-bold text-ink">{report.nextAction.title}</p>
        <p className="mt-1 text-xs leading-5 text-ink">{report.nextAction.instruction}</p>
        <p className="mt-2 text-xs leading-5 text-ink-soft">{report.nextAction.because}</p>
      </div>
    </div>
  )
}

export function AiReportCard({
  summary,
  onSave,
}: {
  summary: SessionSummary
  onSave: (report: AiSessionReport) => void
}) {
  const [consented, setConsented] = useState(false)
  const { object, error, isLoading, submit } = useObject({
    api: '/api/ai-report',
    /* 로그인 토큰을 실어 보냅니다. 서버가 인증을 요구하게 바뀌었습니다. */
    fetch: authedFetch,
    schema: AiSessionReportSchema,
    initialValue: summary.aiReport,
    onFinish: ({ object: completedObject, error: finishError }) => {
      if (finishError || !completedObject) return
      const result = AiSessionReportSchema.safeParse(completedObject)
      if (result.success && isSafeAiSessionReport(result.data)) onSave(result.data)
    },
  })
  const reportResult = summary.aiReport
    ? { success: true as const, data: summary.aiReport }
    : AiSessionReportSchema.safeParse(object)

  return (
    <Card tone="blue" className="relative overflow-hidden">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-4 -top-8 text-8xl font-black leading-none text-blue/10"
      >
        ✦
      </span>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-wide text-[#2b52a8]">세션을 마친 뒤에만</p>
          <CardTitle>AI 세션 회고</CardTitle>
        </div>
        <Badge tone="blue">선택 기능</Badge>
      </div>
      <p className="relative mt-2 max-w-xl text-sm leading-6 text-ink">
        집중 시간과 회복 횟수 같은 세션 집계만 바탕으로 다음 행동을 짧게 정리해요.
      </p>

      {reportResult.success && isSafeAiSessionReport(reportResult.data) ? (
        <ReportContent report={reportResult.data} />
      ) : (
        <div className="mt-4 space-y-3">
          <fieldset className="m-0 rounded-2xl border border-line bg-surface px-4 py-4 text-xs leading-5 text-ink-soft">
            <legend className="sr-only">AI 회고 생성 동의</legend>
            <label
              aria-label="세션 요약을 외부 AI로 정리하는 데 동의"
              className="flex cursor-pointer items-start gap-3"
            >
              <input
                type="checkbox"
                checked={consented}
                onChange={(event) => setConsented(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-pink"
              />
              <span>
                <strong className="block text-sm text-ink">세션 요약을 외부 AI로 정리하는 데 동의해요.</strong>
                <span className="mt-1 block">
                  동의한 뒤에만 회고 요청을 보냅니다. 동의하지 않으면 아무 정보도 전송하지 않아요.
                </span>
              </span>
            </label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-canvas px-3 py-2">
                <strong className="block text-ink">보내는 정보</strong>
                집중 시간, 회복 횟수 등 세션 집계
              </div>
              <div className="rounded-xl bg-green-soft px-3 py-2">
                <strong className="block text-green">보내지 않는 정보</strong>
                영상·사진·얼굴 정보·좌표·자세 상태
              </div>
            </div>
          </fieldset>
          {error && <p role="alert" className="text-xs font-bold text-coral">{errorMessage(error)}</p>}
          <Button
            size="sm"
            variant="secondary"
            disabled={!consented || isLoading}
            onClick={() => submit(createAiReportInput(summary))}
          >
            {isLoading ? 'AI 회고 정리 중…' : 'AI 회고 만들기'}
          </Button>
        </div>
      )}
    </Card>
  )
}

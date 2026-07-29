import { useState } from 'react'
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

function ReportContent({ report }: { report: AiSessionReport }) {
  return (
    <div className="mt-4 space-y-4">
      <div>
        <h3 className="text-base font-bold text-ink">{report.headline}</h3>
        <p className="mt-1 text-sm leading-6 text-ink-soft">{report.reflection}</p>
      </div>
      <ul className="grid gap-2">
        {report.highlights.map((highlight) => (
          <li key={`${highlight.label}-${highlight.detail}`} className="rounded-xl bg-surface px-3 py-2">
            <p className="text-xs font-bold text-ink">{highlight.label}</p>
            <p className="mt-0.5 text-xs leading-5 text-ink-soft">{highlight.detail}</p>
          </li>
        ))}
      </ul>
      <div className="rounded-xl border border-line bg-surface px-3 py-3">
        <p className="text-xs font-bold text-ink-soft">다음 {report.nextAction.durationMinutes}분</p>
        <p className="mt-1 text-sm font-bold text-ink">{report.nextAction.title}</p>
        <p className="mt-1 text-xs leading-5 text-ink-soft">{report.nextAction.instruction}</p>
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
    <Card tone="blue">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>AI 세션 회고</CardTitle>
        <Badge tone="blue">선택 기능</Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-ink-soft">
        집중 시간과 회복 횟수 같은 세션 집계만 바탕으로 다음 행동을 짧게 정리해요.
      </p>

      {reportResult.success && isSafeAiSessionReport(reportResult.data) ? (
        <ReportContent report={reportResult.data} />
      ) : (
        <div className="mt-4 space-y-3">
          <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-surface px-3 py-3 text-xs leading-5 text-ink-soft">
            <input
              type="checkbox"
              checked={consented}
              onChange={(event) => setConsented(event.target.checked)}
              className="mt-1 size-4 shrink-0 accent-pink"
            />
            <span>
              세션 집계값을 외부 AI에 보내 회고를 만들겠습니다. 영상·사진·얼굴 정보·좌표·자세 상태는 보내지 않습니다.
            </span>
          </label>
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

import { z } from 'zod'
import type { AiSessionReport, SessionSummary } from '../../types/index.js'

export const AI_REPORT_SCHEMA_VERSION = '2026-07-30'

export const AI_REPORT_INPUT_FIELDS = [
  'plannedMinutes',
  'elapsedMinutes',
  'detectableMinutes',
  'awayMinutes',
  'recoveryOpportunities',
  'recoveries',
  'bestCombo',
  'status',
] as const

export const AiReportInputSchema = z
  .object({
    plannedMinutes: z.number().int().min(1).max(300),
    elapsedMinutes: z.number().int().min(0).max(360),
    detectableMinutes: z.number().int().min(0).max(360),
    awayMinutes: z.number().int().min(0).max(360),
    recoveryOpportunities: z.number().int().min(0).max(1_000),
    recoveries: z.number().int().min(0).max(1_000),
    bestCombo: z.number().int().min(0).max(1_000),
    status: z.enum(['completed', 'aborted']),
  })
  .strict()

export type AiReportInput = z.infer<typeof AiReportInputSchema>

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 32 || codePoint === 127
  })
}

const reportText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !hasControlCharacter(value), '제어 문자는 허용하지 않습니다.')

export const AiSessionReportSchema = z
  .object({
    headline: reportText(48),
    reflection: reportText(160),
    highlights: z
      .array(
        z
          .object({
            label: reportText(24),
            detail: reportText(80),
          })
          .strict(),
      )
      .length(3),
    nextAction: z
      .object({
        title: reportText(32),
        instruction: reportText(80),
        durationMinutes: z.number().int().min(1).max(5),
      })
      .strict(),
  })
  .strict() as z.ZodType<AiSessionReport>

const UNSAFE_REPORT_TERMS = /진단|치료|처방|질환|통증|거북목|정상\s*자세|자세\s*교정/

export function isSafeAiSessionReport(report: AiSessionReport): boolean {
  return !UNSAFE_REPORT_TERMS.test(JSON.stringify(report))
}

function toMinutes(milliseconds: number): number {
  return Math.max(0, Math.round(milliseconds / 60_000))
}

/**
 * 외부 AI에 보낼 수 있는 세션 집계값의 유일한 생성 경로입니다.
 * 카메라 원본·스냅샷·좌표·자세 상태·목표 문구·식별자는 포함하지 않습니다.
 */
export function createAiReportInput(summary: SessionSummary): AiReportInput {
  return AiReportInputSchema.parse({
    plannedMinutes: Math.max(1, toMinutes(summary.plannedDurationMs)),
    elapsedMinutes: toMinutes(summary.elapsedMs),
    detectableMinutes: toMinutes(summary.detectableMs),
    awayMinutes: toMinutes(summary.awayMs),
    recoveryOpportunities: summary.recoveryOpportunities,
    recoveries: summary.recoveries,
    bestCombo: summary.bestCombo,
    status: summary.status,
  })
}

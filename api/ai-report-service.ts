import { GoogleGenAI } from '@google/genai'
import { LangfuseClient } from '@langfuse/client'
import { z } from 'zod'
import {
  AI_REPORT_SCHEMA_VERSION,
  AiSessionReportSchema,
  isSafeAiSessionReport,
  type AiReportInput,
} from '../src/features/ai-report/contract'
import { buildAiReportPrompt } from '../src/features/ai-report/prompt'
import type { AiSessionReport } from '../src/types'

export const AI_REPORT_MODEL = 'gemini-3.5-flash'

export class AiReportConfigurationError extends Error {}

export async function generateAiSessionReport(
  input: AiReportInput,
  apiKey = process.env.GEMINI_API_KEY,
): Promise<AiSessionReport> {
  if (!apiKey) throw new AiReportConfigurationError('AI report is not configured.')

  const client = new GoogleGenAI({ apiKey })
  const interaction = await client.interactions.create({
    model: AI_REPORT_MODEL,
    input: buildAiReportPrompt(input),
    store: false,
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: z.toJSONSchema(AiSessionReportSchema),
    },
  })
  const text = interaction.output_text

  if (!text) throw new Error('AI report response was empty.')

  const report = AiSessionReportSchema.parse(JSON.parse(text))
  if (!isSafeAiSessionReport(report)) throw new Error('AI report did not meet safety rules.')

  return report
}

export type AiReportObservation = {
  outcome: 'success' | 'failed'
  durationMs: number
}

export async function recordAiReportObservation({
  outcome,
  durationMs,
}: AiReportObservation): Promise<void> {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const secretKey = process.env.LANGFUSE_SECRET_KEY

  if (!publicKey || !secretKey) return

  const now = new Date().toISOString()
  const traceId = crypto.randomUUID()
  const client = new LangfuseClient({
    publicKey,
    secretKey,
    baseUrl: process.env.LANGFUSE_BASE_URL,
    timeout: 1,
  })

  try {
    await client.api.ingestion.batch({
      batch: [
        {
          type: 'trace-create',
          id: traceId,
          timestamp: now,
          body: {
            id: traceId,
            timestamp: now,
            environment: process.env.VERCEL_ENV ?? 'development',
            name: 'upright-ai-report',
            metadata: {
              model: AI_REPORT_MODEL,
              outcome,
              schemaVersion: AI_REPORT_SCHEMA_VERSION,
              durationMs: Math.round(durationMs),
            },
          },
        },
      ],
    })
  } catch {
    return
  }
}

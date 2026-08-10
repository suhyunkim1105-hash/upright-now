import { googleAI } from '@genkit-ai/google-genai'
import { genkit, z } from 'genkit'
import { AI_REPORT_MODEL } from '../api/ai-report-service'
import { isSafeAiSessionReport } from '../src/features/ai-report/contract'
import { buildAiReportPrompt } from '../src/features/ai-report/prompt'

const AiReportInputFlowSchema = z.object({
  plannedMinutes: z.number().int().min(1).max(300),
  elapsedMinutes: z.number().int().min(0).max(360),
  detectableMinutes: z.number().int().min(0).max(360),
  awayMinutes: z.number().int().min(0).max(360),
  recoveryOpportunities: z.number().int().min(0).max(1_000),
  recoveries: z.number().int().min(0).max(1_000),
  bestCombo: z.number().int().min(0).max(1_000),
  status: z.enum(['completed', 'aborted']),
})

/* contract.ts 의 AiSessionReportSchema 와 같은 모양이어야 합니다.
   Genkit 은 자체 zod 인스턴스를 쓰므로 재사용이 안 되고 옮겨 적습니다 —
   한쪽만 고치면 개발용 플로우와 운영이 서로 다른 리포트를 만듭니다. */
const AiSessionReportFlowSchema = z.object({
  headline: z.string().min(1).max(48),
  stats: z
    .array(
      z.object({
        label: z.string().min(1).max(12),
        value: z.string().min(1).max(16),
      }),
    )
    .length(3),
  observations: z
    .array(
      z.object({
        fact: z.string().min(1).max(60),
        read: z.string().min(1).max(90),
      }),
    )
    .max(2),
  nextAction: z.object({
    title: z.string().min(1).max(24),
    instruction: z.string().min(1).max(80),
    because: z.string().min(1).max(60),
    durationMinutes: z.number().int().min(1).max(5),
  }),
  followUps: z.array(z.string().min(1).max(28)).max(3),
})

const ai = genkit({
  plugins: [googleAI({ apiKey: process.env.GEMINI_API_KEY ?? false })],
})

export const aiReportFlow = ai.defineFlow(
  {
    name: 'aiReportFlow',
    inputSchema: AiReportInputFlowSchema,
    outputSchema: AiSessionReportFlowSchema,
  },
  async (input) => {
    if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is required.')

    const response = await ai.generate({
      model: googleAI.model(AI_REPORT_MODEL),
      prompt: buildAiReportPrompt(input),
      output: { schema: AiSessionReportFlowSchema },
    })

    if (!response.output || !isSafeAiSessionReport(response.output)) {
      throw new Error('Generated report did not pass safety validation.')
    }

    return response.output
  },
)

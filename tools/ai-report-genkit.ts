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

const AiSessionReportFlowSchema = z.object({
  headline: z.string().min(1).max(48),
  reflection: z.string().min(1).max(160),
  highlights: z
    .array(
      z.object({
        label: z.string().min(1).max(24),
        detail: z.string().min(1).max(80),
      }),
    )
    .length(3),
  nextAction: z.object({
    title: z.string().min(1).max(32),
    instruction: z.string().min(1).max(80),
    durationMinutes: z.number().int().min(1).max(5),
  }),
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

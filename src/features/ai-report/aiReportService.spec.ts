import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiSessionReport } from '@/types'
import type { AiReportInput } from './contract'

const { createInteraction, ingestBatch } = vi.hoisted(() => ({
  createInteraction: vi.fn(),
  ingestBatch: vi.fn(),
}))

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    interactions = { create: createInteraction }
  },
}))

vi.mock('@langfuse/client', () => ({
  LangfuseClient: class {
    api = { ingestion: { batch: ingestBatch } }
  },
}))

const { generateAiSessionReport, recordAiReportObservation } = await import(
  '../../../api/ai-report-service'
)

const INPUT: AiReportInput = {
  plannedMinutes: 25,
  elapsedMinutes: 25,
  detectableMinutes: 23,
  awayMinutes: 1,
  recoveryOpportunities: 3,
  recoveries: 2,
  bestCombo: 2,
  status: 'completed',
}

const REPORT: AiSessionReport = {
  headline: '이번 흐름을 짧게 정리했어요.',
  stats: [
      { label: '앉은 시간', value: '21분 / 25분' },
      { label: '잰 시간', value: '18분' },
      { label: '돌아온 횟수', value: '4번' },
    ],
    observations: [],
    followUps: [],
    nextAction: {
    title: '2분 정리 후 다시 시작',
    instruction: '다음 할 일을 적고 2분 안에 시작해 보세요.',
    because: '이번 세션 이탈이 화면과의 거리에 몰렸어요',
    durationMinutes: 2,
  },
}

describe('Gemini AI 세션 회고 서비스', () => {
  beforeEach(() => {
    createInteraction.mockReset()
    ingestBatch.mockReset()
    delete process.env.LANGFUSE_PUBLIC_KEY
    delete process.env.LANGFUSE_SECRET_KEY
  })

  afterEach(() => vi.restoreAllMocks())

  it('Gemini 상호작용 저장을 끄고 구조화 JSON만 요청한다', async () => {
    createInteraction.mockResolvedValue({ output_text: JSON.stringify(REPORT) })

    await expect(generateAiSessionReport(INPUT, 'test-key')).resolves.toEqual(REPORT)

    expect(createInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3.5-flash',
        store: false,
        response_format: expect.objectContaining({
          mime_type: 'application/json',
        }),
      }),
    )
    expect(createInteraction.mock.calls[0][0].input).not.toContain('cameraFrame')
    expect(createInteraction.mock.calls[0][0].input).not.toContain('landmark')
  })

  it('안전하지 않은 Gemini 문장은 응답으로 내보내지 않는다', async () => {
    // 관찰 칸이 의료 표현이 새어 나올 가능성이 가장 높은 자리입니다 —
    // 모델이 숫자를 보고 원인을 해석하려 드는 곳이라서요.
    createInteraction.mockResolvedValue({
      output_text: JSON.stringify({
        ...REPORT,
        observations: [
          { fact: '후반에 이탈이 몰렸어요', read: '통증으로 이어질 수 있어요' },
        ],
      }),
    })

    await expect(generateAiSessionReport(INPUT, 'test-key')).rejects.toThrow(
      'safety rules',
    )
  })

  it('Langfuse 관찰에는 원문 대신 운영 메타데이터만 남긴다', async () => {
    process.env.LANGFUSE_PUBLIC_KEY = 'public-test-key'
    process.env.LANGFUSE_SECRET_KEY = 'secret-test-key'
    ingestBatch.mockResolvedValue({})

    await recordAiReportObservation({ outcome: 'success', durationMs: 432 })

    const payload = ingestBatch.mock.calls[0][0]
    expect(payload.batch[0].body.metadata).toEqual({
      model: 'gemini-3.5-flash',
      outcome: 'success',
      schemaVersion: '2026-07-30',
      durationMs: 432,
    })
    expect(JSON.stringify(payload)).not.toContain('headline')
    expect(JSON.stringify(payload)).not.toContain('sessionSummary')
  })
})

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
  reflection: '집중 시간과 회복 행동을 다음 세션의 출발점으로 남겨 보세요.',
  highlights: [
    { label: '집중 시간', detail: '계획한 흐름을 끝까지 이어 갔어요.' },
    { label: '회복 행동', detail: '리셋이 필요할 때 다시 흐름을 만들었어요.' },
    { label: '다음 시도', detail: '짧은 단위로 바로 이어 가기 좋아요.' },
  ],
  nextAction: {
    title: '2분 정리 후 다시 시작',
    instruction: '다음 할 일을 적고 2분 안에 시작해 보세요.',
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
    createInteraction.mockResolvedValue({
      output_text: JSON.stringify({ ...REPORT, reflection: '진단을 위해 확인하세요.' }),
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

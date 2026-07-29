import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  handleAiReport,
  resetAiReportRateLimitsForTest,
} from '../../../api/ai-report-handler'
import {
  AI_REPORT_INPUT_FIELDS,
  createAiReportInput,
  type AiReportInput,
} from './contract'
import type { AiSessionReport, SessionSummary } from '@/types'

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
  headline: '이번 집중 흐름을 이어 갔어요.',
  reflection: '짧은 리셋을 다음 시작에도 이어 가면 좋아요.',
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

function request(body: unknown): Request {
  return new Request('http://localhost/api/ai-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('AI 세션 회고 API', () => {
  beforeEach(() => resetAiReportRateLimitsForTest())

  it('허용한 세션 집계 필드만 외부 생성기에 전달한다', async () => {
    const generate = vi.fn(async () => REPORT)
    const observe = vi.fn(async () => {})
    const response = await handleAiReport(request(INPUT), {
      enabled: true,
      generate,
      observe,
    })

    expect(response.status).toBe(200)
    expect(generate).toHaveBeenCalledWith(INPUT)
    expect(await response.json()).toEqual(REPORT)
    expect(observe).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'success' }))
  })

  it('카메라 데이터처럼 계약 밖 필드가 있으면 생성기에 도달하지 않는다', async () => {
    const generate = vi.fn(async () => REPORT)
    const response = await handleAiReport(
      request({ ...INPUT, cameraFrame: 'forbidden' }),
      { enabled: true, generate },
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ code: 'INVALID_REPORT_INPUT' })
    expect(generate).not.toHaveBeenCalled()
  })

  it('의료 표현이 든 생성 결과는 저장·표시 전에 차단한다', async () => {
    const response = await handleAiReport(request(INPUT), {
      enabled: true,
      generate: async () => ({ ...REPORT, reflection: '진단을 위해 병원에 가세요.' }),
    })

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ code: 'AI_REPORT_GENERATION_FAILED' })
  })

  it('세 번을 넘는 요청은 같은 10분 창에서 제한한다', async () => {
    for (let index = 0; index < 3; index += 1) {
      const response = await handleAiReport(request(INPUT), {
        enabled: true,
        generate: async () => REPORT,
      })
      expect(response.status).toBe(200)
    }

    const response = await handleAiReport(request(INPUT), {
      enabled: true,
      generate: async () => REPORT,
    })
    expect(response.status).toBe(429)
  })

  it('세션 요약에서 허용된 8개 집계만 추출한다', () => {
    const summary: SessionSummary = {
      id: 'summary-1',
      sessionId: 'session-1',
      startedAt: 0,
      endedAt: 1,
      status: 'completed',
      subject: '민감한 과제명',
      goal: '개인 목표',
      plannedDurationMs: 25 * 60_000,
      elapsedMs: 24 * 60_000,
      detectableMs: 22 * 60_000,
      awayMs: 60_000,
      unstableMs: 2 * 60_000,
      recoveryOpportunities: 3,
      recoveries: 2,
      bestCombo: 2,
      damageDealt: 80,
      xpEarned: 10,
      pointsEarned: 3,
    }

    const input = createAiReportInput(summary)
    expect(Object.keys(input)).toEqual(AI_REPORT_INPUT_FIELDS)
    expect(input).not.toHaveProperty('subject')
    expect(input).not.toHaveProperty('goal')
    expect(input).not.toHaveProperty('unstableMs')
    expect(input).not.toHaveProperty('sessionId')
  })
})

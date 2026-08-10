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
    // 관찰 칸에 넣습니다 — 실제로 의료 표현이 새어 나올 가능성이 가장 높은
    // 자리입니다. 모델이 숫자를 보고 원인을 해석하려 드는 곳이라서요.
    const response = await handleAiReport(request(INPUT), {
      enabled: true,
      generate: async () => ({
        ...REPORT,
        observations: [
          { fact: '후반에 이탈이 몰렸어요', read: '거북목이 진행 중일 수 있어요' },
        ],
      }),
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

  it('세션 요약에서 허용 목록 밖의 값은 나가지 않는다', () => {
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
    // 엔진 집계가 선택 필드로 들어오면서 개수로는 못 셉니다.
    // 지켜야 할 것은 개수가 아니라 **허용 목록 밖의 값이 새지 않는 것** 입니다.
    for (const key of Object.keys(input)) {
      expect(AI_REPORT_INPUT_FIELDS).toContain(key)
    }
    expect(input).not.toHaveProperty('subject')
    expect(input).not.toHaveProperty('goal')
    expect(input).not.toHaveProperty('unstableMs')
    expect(input).not.toHaveProperty('sessionId')
  })
})

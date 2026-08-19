import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  handleAiReport,
  resetAiReportRateLimitsForTest,
} from '../../../api/ai-report-handler'
import { AuthError } from '../../../api/require-auth'
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

/* 로그인한 사람으로 부릅니다. 실제 서명 검증은 Supabase 가 하고, 여기서는
   그 자리를 대신 채웁니다 — `enabled`·`generate` 와 같은 주입 방식입니다. */
const VERIFY = async () => ({ id: 'user-1', email: 'a@mju.ac.kr' })

function request(body: unknown, token: string | null = 'tok'): Request {
  return new Request('http://localhost/api/ai-report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('AI 세션 회고 API', () => {
  beforeEach(() => resetAiReportRateLimitsForTest())

  it('허용한 세션 집계 필드만 외부 생성기에 전달한다', async () => {
    const generate = vi.fn(async () => REPORT)
    const observe = vi.fn(async () => {})
    const response = await handleAiReport(request(INPUT), {
      verify: VERIFY,
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
    const response = await handleAiReport(request({ ...INPUT, cameraFrame: 'forbidden' }), {
      verify: VERIFY, enabled: true, generate },
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ code: 'INVALID_REPORT_INPUT' })
    expect(generate).not.toHaveBeenCalled()
  })

  it('의료 표현이 든 생성 결과는 저장·표시 전에 차단한다', async () => {
    // 관찰 칸에 넣습니다 — 실제로 의료 표현이 새어 나올 가능성이 가장 높은
    // 자리입니다. 모델이 숫자를 보고 원인을 해석하려 드는 곳이라서요.
    const response = await handleAiReport(request(INPUT), {
      verify: VERIFY,
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
      verify: VERIFY,
        enabled: true,
        generate: async () => REPORT,
      })
      expect(response.status).toBe(200)
    }

    const response = await handleAiReport(request(INPUT), {
      verify: VERIFY,
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

  /* ---- 인증 ----
     이 뒤로 **우리 돈이 나갑니다.** 문이 열려 있으면 주소만 아는 사람이
     청구서를 씁니다. 검사가 없으면 다음 사람이 조용히 걷어냅니다. */
  it('토큰이 없으면 401 이고 생성기를 부르지 않는다', async () => {
    const generate = vi.fn()
    const response = await handleAiReport(request(INPUT, null), { enabled: true, verify: VERIFY, generate })
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: 'AUTH_REQUIRED' })
    expect(generate).not.toHaveBeenCalled()
  })

  it('토큰이 틀리면 401 이고 생성기를 부르지 않는다', async () => {
    const generate = vi.fn()
    const response = await handleAiReport(request(INPUT), {
      enabled: true,
      verify: async () => {
        throw new AuthError('AUTH_INVALID')
      },
      generate,
    })
    expect(response.status).toBe(401)
    expect(generate).not.toHaveBeenCalled()
  })

  it('한 사람이 많이 불러도 다른 사람은 안 막힌다', async () => {
    const generate = async () => REPORT
    for (let i = 0; i < 3; i += 1) {
      await handleAiReport(request(INPUT), {
        enabled: true,
        verify: async () => ({ id: 'heavy', email: null }),
        generate,
      })
    }
    /* 위 사람은 막혔지만 — */
    const blocked = await handleAiReport(request(INPUT), {
      enabled: true,
      verify: async () => ({ id: 'heavy', email: null }),
      generate,
    })
    expect(blocked.status).toBe(429)
    /* 다른 사람은 그대로 지나갑니다. IP 로 셀 때는 이게 안 됐습니다. */
    const other = await handleAiReport(request(INPUT), {
      enabled: true,
      verify: async () => ({ id: 'other', email: null }),
      generate,
    })
    expect(other.status).toBe(200)
  })
})

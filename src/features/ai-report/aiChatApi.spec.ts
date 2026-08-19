import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleAiChat, resetAiChatRateLimitsForTest } from '../../../api/ai-chat'
import { AuthError } from '../../../api/require-auth'

/* 로그인한 사람으로 부릅니다. 실제 서명 검증은 Supabase 가 하고, 여기서는
   그 자리를 대신 채웁니다 — `enabled`·`generate` 와 같은 주입 방식입니다. */
const VERIFY = async () => ({ id: 'user-1', email: 'a@mju.ac.kr' })

function request(body: unknown, token: string | null = 'tok'): Request {
  return new Request('http://localhost/api/ai-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

const OK = { question: '의자를 어떻게 놓을까요?' }

describe('자세 코치 대화 API', () => {
  beforeEach(() => resetAiChatRateLimitsForTest())

  it('질문과 대화 기록만 생성기에 전달한다', async () => {
    let seen: Array<{ role: string; text: string }> = []
    const generate = async (
      _system: string,
      turns: Array<{ role: string; text: string }>,
    ) => {
      seen = turns
      return '등받이에 등을 붙이고 앉아 보세요.'
    }
    const response = await handleAiChat(request({
        ...OK,
        history: [
          { role: 'user', text: '25분이 저한테 긴가요?' },
          { role: 'model', text: '끝까지 채우셨으니 맞는 것 같아요.' },
        ],
      }), {
      verify: VERIFY, enabled: true, generate },
    )

    expect(response.status).toBe(200)
    // 마지막 턴이 이번 질문, 앞의 둘이 기록
    expect(seen).toHaveLength(3)
    expect(seen[2]).toEqual({ role: 'user', text: OK.question })
  })

  it('계약 밖 필드가 있으면 생성기에 도달하지 않는다', async () => {
    const generate = vi.fn(async () => '답')
    const response = await handleAiChat(request({ ...OK, cameraFrame: 'forbidden' }), {
      verify: VERIFY, enabled: true, generate },
    )

    expect(response.status).toBe(400)
    expect(generate).not.toHaveBeenCalled()
  })

  it('아픔을 말하면 모델에 보내지 않고 전문가를 권한다', async () => {
    const generate = vi.fn(async () => '이건 호출되면 안 됩니다')
    const response = await handleAiChat(request({ question: '목이 아픈데 어떻게 해요?' }), {
      verify: VERIFY, enabled: true, generate },
    )

    expect(response.status).toBe(200)
    expect(generate).not.toHaveBeenCalled()
    const body = (await response.json()) as { refused?: string; answer: string }
    expect(body.refused).toBe('medical')
    expect(body.answer).toContain('전문가')
  })

  it('의료 표현이 든 모델 응답은 내보내지 않는다', async () => {
    const response = await handleAiChat(request(OK), {
      verify: VERIFY,
      enabled: true,
      generate: async () => '자세 교정을 위해 병원에서 진단을 받아 보세요.',
    })

    expect(response.status).toBe(503)
  })

  it('같은 10분 창에서 스무 번을 넘으면 제한한다', async () => {
    for (let index = 0; index < 20; index += 1) {
      const response = await handleAiChat(request(OK), {
      verify: VERIFY,
        enabled: true,
        generate: async () => '답',
      })
      expect(response.status).toBe(200)
    }

    const response = await handleAiChat(request(OK), {
      verify: VERIFY,
      enabled: true,
      generate: async () => '답',
    })
    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ code: 'AI_CHAT_RATE_LIMITED' })
  })

  it('기능이 꺼져 있으면 생성기를 부르지 않는다', async () => {
    const generate = vi.fn(async () => '답')
    const response = await handleAiChat(request(OK), {
      verify: VERIFY, enabled: false, generate })

    expect(response.status).toBe(503)
    expect(generate).not.toHaveBeenCalled()
  })

  /* ---- 인증 ----
     이 뒤로 **우리 돈이 나갑니다.** 문이 열려 있으면 주소만 아는 사람이
     청구서를 씁니다. 검사가 없으면 다음 사람이 조용히 걷어냅니다. */
  it('토큰이 없으면 401 이고 생성기를 부르지 않는다', async () => {
    const generate = vi.fn()
    const response = await handleAiChat(request(OK, null), { enabled: true, verify: VERIFY, generate })
    expect(response.status).toBe(401)
    expect(await response.json()).toMatchObject({ code: 'AUTH_REQUIRED' })
    expect(generate).not.toHaveBeenCalled()
  })

  it('토큰이 틀리면 401 이고 생성기를 부르지 않는다', async () => {
    const generate = vi.fn()
    const response = await handleAiChat(request(OK), {
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
    const generate = async () => '등을 붙여 보세요.'
    for (let i = 0; i < 20; i += 1) {
      await handleAiChat(request(OK), {
        enabled: true,
        verify: async () => ({ id: 'heavy', email: null }),
        generate,
      })
    }
    /* 위 사람은 막혔지만 — */
    const blocked = await handleAiChat(request(OK), {
      enabled: true,
      verify: async () => ({ id: 'heavy', email: null }),
      generate,
    })
    expect(blocked.status).toBe(429)
    /* 다른 사람은 그대로 지나갑니다. IP 로 셀 때는 이게 안 됐습니다. */
    const other = await handleAiChat(request(OK), {
      enabled: true,
      verify: async () => ({ id: 'other', email: null }),
      generate,
    })
    expect(other.status).toBe(200)
  })
})

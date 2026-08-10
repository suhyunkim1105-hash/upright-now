import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleAiChat, resetAiChatRateLimitsForTest } from '../../../api/ai-chat'

function request(body: unknown): Request {
  return new Request('http://localhost/api/ai-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    const response = await handleAiChat(
      request({
        ...OK,
        history: [
          { role: 'user', text: '25분이 저한테 긴가요?' },
          { role: 'model', text: '끝까지 채우셨으니 맞는 것 같아요.' },
        ],
      }),
      { enabled: true, generate },
    )

    expect(response.status).toBe(200)
    // 마지막 턴이 이번 질문, 앞의 둘이 기록
    expect(seen).toHaveLength(3)
    expect(seen[2]).toEqual({ role: 'user', text: OK.question })
  })

  it('계약 밖 필드가 있으면 생성기에 도달하지 않는다', async () => {
    const generate = vi.fn(async () => '답')
    const response = await handleAiChat(
      request({ ...OK, cameraFrame: 'forbidden' }),
      { enabled: true, generate },
    )

    expect(response.status).toBe(400)
    expect(generate).not.toHaveBeenCalled()
  })

  it('아픔을 말하면 모델에 보내지 않고 전문가를 권한다', async () => {
    const generate = vi.fn(async () => '이건 호출되면 안 됩니다')
    const response = await handleAiChat(
      request({ question: '목이 아픈데 어떻게 해요?' }),
      { enabled: true, generate },
    )

    expect(response.status).toBe(200)
    expect(generate).not.toHaveBeenCalled()
    const body = (await response.json()) as { refused?: string; answer: string }
    expect(body.refused).toBe('medical')
    expect(body.answer).toContain('전문가')
  })

  it('의료 표현이 든 모델 응답은 내보내지 않는다', async () => {
    const response = await handleAiChat(request(OK), {
      enabled: true,
      generate: async () => '자세 교정을 위해 병원에서 진단을 받아 보세요.',
    })

    expect(response.status).toBe(503)
  })

  it('같은 10분 창에서 스무 번을 넘으면 제한한다', async () => {
    for (let index = 0; index < 20; index += 1) {
      const response = await handleAiChat(request(OK), {
        enabled: true,
        generate: async () => '답',
      })
      expect(response.status).toBe(200)
    }

    const response = await handleAiChat(request(OK), {
      enabled: true,
      generate: async () => '답',
    })
    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ code: 'AI_CHAT_RATE_LIMITED' })
  })

  it('기능이 꺼져 있으면 생성기를 부르지 않는다', async () => {
    const generate = vi.fn(async () => '답')
    const response = await handleAiChat(request(OK), { enabled: false, generate })

    expect(response.status).toBe(503)
    expect(generate).not.toHaveBeenCalled()
  })
})

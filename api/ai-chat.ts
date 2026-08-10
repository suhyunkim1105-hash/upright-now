import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import { AiReportInputSchema } from '../src/features/ai-report/contract.js'
import { buildChatSystemPrompt } from '../src/features/ai-report/chatPrompt.js'

/**
 * 자세 코치 대화.
 *
 * 키는 이 함수에만 있습니다(process.env.GEMINI_API_KEY). 프론트엔드는
 * 이 엔드포인트만 부르고, 키를 본 적이 없습니다.
 *
 * 대화 기록을 서버에 저장하지 않습니다. store:false 이고 로그에도
 * 남기지 않습니다 — 사람이 자기 몸 이야기를 하는 창구입니다.
 */
export const AI_CHAT_MODEL = 'gemini-3.5-flash'

/*
  레이트리밋 — 리포트(10분 3회)보다 넉넉합니다. 대화는 원래 여러 번
  주고받는 것이라 3회로 묶으면 쓸 수가 없습니다. 다만 무제한이면 키가
  남의 챗봇 백엔드가 됩니다.

  같은 프로세스 안의 Map 이라 서버리스에서는 인스턴스마다 따로 셉니다.
  완벽한 방어가 아니라 **실수와 장난을 막는 문**입니다. 진짜 방어는
  인증이 붙은 뒤에 사용자 단위로 겁니다.
*/
const RATE_WINDOW_MS = 10 * 60_000
const RATE_MAX = 20

type RateEntry = { count: number; resetAt: number }
const rateLimits = new Map<string, RateEntry>()

function requestKey(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

function withinRateLimit(key: string, now: number): boolean {
  const current = rateLimits.get(key)
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (current.count >= RATE_MAX) return false
  current.count += 1
  return true
}

export function resetAiChatRateLimitsForTest(): void {
  rateLimits.clear()
}

const ChatRequestSchema = z
  .object({
    question: z.string().trim().min(1).max(300),
    /* 이전 대화. 서버가 아니라 브라우저가 들고 있다가 실어 보냅니다. */
    history: z
      .array(
        z
          .object({
            role: z.enum(['user', 'model']),
            text: z.string().trim().min(1).max(1_200),
          })
          .strict(),
      )
      .max(10)
      .optional(),
    session: AiReportInputSchema.optional(),
  })
  .strict()

/* 리포트와 같은 금칙어입니다. 두 곳에서 기준이 다르면 한쪽으로 새어 나갑니다. */
const UNSAFE = /진단|처방|질환|거북목|정상\s*자세|자세\s*교정/

/* 사용자가 아픔을 말하면 모델에 보내기 전에 여기서 끊습니다.
   모델이 잘 답할 거라고 믿는 것보다 안 보내는 쪽이 확실합니다. */
const MEDICAL_Q = /아프|아픈|아파|아팠|저리|저림|쑤시|결려|결림|뻐근|통증|디스크|병원|치료|처방|한의원|물리치료|정형외과/

const MEDICAL_ANSWER =
  '그건 제가 답할 수 있는 범위가 아니에요. 몸이 아프거나 저리면 앱을 잠시 쉬고 ' +
  '전문가에게 물어보시는 게 맞아요. 여기서는 앉는 자리와 세션 길이 정도만 같이 볼 수 있어요.'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function handleAiChat(
  request: Request,
  deps: {
    enabled?: boolean
    generate?: (systemPrompt: string, turns: Array<{ role: string; text: string }>) => Promise<string>
  } = {},
): Promise<Response> {
  if (request.method !== 'POST') return json({ code: 'METHOD_NOT_ALLOWED' }, 405)

  const enabled = deps.enabled ?? process.env.AI_REPORT_ENABLED === 'true'
  if (!enabled) return json({ code: 'AI_CHAT_UNAVAILABLE' }, 503)

  if (!withinRateLimit(requestKey(request), Date.now())) {
    return json({ code: 'AI_CHAT_RATE_LIMITED' }, 429)
  }

  let parsed
  try {
    parsed = ChatRequestSchema.parse(await request.json())
  } catch {
    return json({ code: 'INVALID_CHAT_INPUT' }, 400)
  }

  if (MEDICAL_Q.test(parsed.question)) {
    return json({ answer: MEDICAL_ANSWER, refused: 'medical' })
  }

  const system = buildChatSystemPrompt(parsed.session)
  const turns = [
    ...(parsed.history ?? []).map((h) => ({ role: h.role, text: h.text })),
    { role: 'user', text: parsed.question },
  ]

  try {
    const answer = deps.generate
      ? await deps.generate(system, turns)
      : await generateWithGemini(system, turns)

    if (!answer || UNSAFE.test(answer)) {
      /* 모델이 선을 넘었습니다. 고쳐 쓰지 않고 버립니다 — 부분적으로
         지운 문장은 뜻이 달라져서 더 위험합니다. */
      return json({ code: 'AI_CHAT_GENERATION_FAILED' }, 503)
    }
    return json({ answer })
  } catch {
    return json({ code: 'AI_CHAT_GENERATION_FAILED' }, 503)
  }
}

async function generateWithGemini(
  system: string,
  turns: Array<{ role: string; text: string }>,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('AI chat is not configured.')

  const client = new GoogleGenAI({ apiKey })
  const interaction = await client.interactions.create({
    model: AI_CHAT_MODEL,
    /* 저장하지 않습니다. 사람이 자기 몸 이야기를 하는 창구입니다. */
    store: false,
    input:
      system +
      '\n\n## 대화\n' +
      turns.map((t) => (t.role === 'user' ? '사용자: ' : '코치: ') + t.text).join('\n') +
      '\n코치:',
  })
  return (interaction.output_text ?? '').trim()
}

export default async function handler(request: Request): Promise<Response> {
  return handleAiChat(request)
}

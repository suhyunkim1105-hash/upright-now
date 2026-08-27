import {
  AiReportInputSchema,
  AiSessionReportSchema,
  isSafeAiSessionReport,
  type AiReportInput,
} from '../api/_shared/contract.js'
import type { AiSessionReport } from '../api/_shared/types.js'
import {
  AiReportConfigurationError,
  generateAiSessionReport,
  recordAiReportObservation,
} from './ai-report-service.js'
import { authErrorStatus, requireUser, type AuthedUser } from './require-auth.js'

const MAX_BODY_BYTES = 12_000
const RATE_LIMIT_WINDOW_MS = 10 * 60_000
const RATE_LIMIT_MAX_REQUESTS = 3

type RateLimitEntry = { count: number; resetAt: number }

const rateLimits = new Map<string, RateLimitEntry>()

export interface AiReportHandlerDependencies {
  enabled?: boolean
  generate?: (input: AiReportInput) => Promise<AiSessionReport>
  observe?: (input: { outcome: 'success' | 'failed'; durationMs: number }) => Promise<void>
  verify?: (token: string) => Promise<AuthedUser>
}

class RequestBodyError extends Error {}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!origin || !host) return true

  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/* **사용자 id 로 셉니다.** 전에는 `x-forwarded-for` 를 썼는데 그건 보내는
   쪽이 정하는 값이라, 매번 다른 가짜 IP 를 실으면 통이 무한히 열렸습니다. */
function requestKey(user: AuthedUser): string {
  return user.id
}

function withinRateLimit(key: string, now: number): boolean {
  const current = rateLimits.get(key)
  if (!current || current.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) return false
  current.count += 1
  return true
}

async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new RequestBodyError('Request body is too large.')
  }

  const reader = request.body?.getReader()
  if (!reader) throw new RequestBodyError('Request body is required.')

  const chunks: Uint8Array[] = []
  let size = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY_BYTES) {
      await reader.cancel()
      throw new RequestBodyError('Request body is too large.')
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new RequestBodyError('Request body must be JSON.')
  }
}

export async function handleAiReport(
  request: Request,
  dependencies: AiReportHandlerDependencies = {},
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse(405, { code: 'METHOD_NOT_ALLOWED' })
  if (!isSameOrigin(request)) return jsonResponse(403, { code: 'ORIGIN_NOT_ALLOWED' })
  const enabled = dependencies.enabled ?? process.env.AI_REPORT_ENABLED === 'true'
  if (!enabled) {
    return jsonResponse(503, { code: 'AI_REPORT_UNAVAILABLE' })
  }

  /* 이 뒤부터 **우리 돈이 나갑니다.** 로그인한 사람만 지나갑니다.
     입력 파싱보다 앞에 둡니다 — 로그인 안 한 사람의 본문을 읽고 검사할
     이유가 없습니다. */
  let user: AuthedUser
  try {
    user = await requireUser(request, dependencies.verify)
  } catch (error) {
    const { status, code } = authErrorStatus(error)
    return jsonResponse(status, { code })
  }

  let input: AiReportInput
  try {
    input = AiReportInputSchema.parse(await readJsonBody(request))
  } catch (error) {
    const code = error instanceof RequestBodyError ? 'INVALID_REQUEST_BODY' : 'INVALID_REPORT_INPUT'
    return jsonResponse(400, { code })
  }

  if (!withinRateLimit(requestKey(user), Date.now())) {
    return jsonResponse(429, { code: 'AI_REPORT_RATE_LIMITED' })
  }

  const startedAt = Date.now()
  const generate = dependencies.generate ?? generateAiSessionReport
  const observe = dependencies.observe ?? recordAiReportObservation

  try {
    const report = AiSessionReportSchema.parse(await generate(input))
    if (!isSafeAiSessionReport(report)) throw new Error('Unsafe AI report.')
    await observe({ outcome: 'success', durationMs: Date.now() - startedAt })
    return new Response(JSON.stringify(report), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  } catch (error) {
    await observe({ outcome: 'failed', durationMs: Date.now() - startedAt })
    const code =
      error instanceof AiReportConfigurationError
        ? 'AI_REPORT_UNAVAILABLE'
        : 'AI_REPORT_GENERATION_FAILED'
    return jsonResponse(503, { code })
  }
}

export function resetAiReportRateLimitsForTest(): void {
  rateLimits.clear()
}

/* 로그인한 사람만 통과시킵니다.
   ==================================================================
   왜 필요한가 — 이 뒤에는 **우리 돈으로 도는 모델**이 있습니다.
   인증이 없으면 주소만 아는 사람이 청구서를 씁니다.

   전에는 `x-forwarded-for` 로 IP 를 세서 막고 있었습니다. 그건 방어가
   아닙니다.

     · **요청 헤더는 보내는 쪽이 정합니다.** 가짜 IP 를 매번 다르게
       실으면 사람마다 새 통이 열립니다.
     · 통은 서버리스 인스턴스 안의 Map 이라 인스턴스가 바뀔 때마다
       0 으로 돌아갑니다.

   그래서 세는 열쇠를 **위조할 수 없는 것**으로 바꿉니다 — Supabase 가
   서명한 토큰에서 꺼낸 사용자 id 입니다.

   검증은 Supabase 에 물어봅니다(`/auth/v1/user`). 직접 HS256 서명을
   확인하면 왕복이 없어 빠르지만 `SUPABASE_JWT_SECRET` 을 하나 더
   관리해야 하고, 그 비밀이 새면 **아무 사용자나 위조**할 수 있습니다.
   이 뒤에 붙는 일이 모델 호출(수 초)이라 왕복 한 번은 값이 안 나갑니다.
   비밀을 늘리지 않는 쪽을 택합니다.
   ================================================================== */

export type AuthedUser = { id: string; email: string | null }

export type AuthErrorCode = 'AUTH_REQUIRED' | 'AUTH_INVALID' | 'AUTH_UNAVAILABLE'

export class AuthError extends Error {
  /* 파라미터 프로퍼티(`constructor(readonly code)`)를 안 쓰는 이유 —
     이 저장소는 `erasableSyntaxOnly` 라, 타입만 지워도 JS 가 되는
     문법만 허용합니다. 그 축약은 필드를 **만들어 내므로** 안 됩니다. */
  readonly code: AuthErrorCode

  constructor(code: AuthErrorCode) {
    super(code)
    this.code = code
  }
}

/** `Authorization: Bearer <token>` 에서 토큰만. 없으면 null. */
function bearer(request: Request): string | null {
  const raw = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (!raw) return null
  const [scheme, token] = raw.split(/\s+/)
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null
  return token
}

/** 토큰을 발급한 곳에 되물어 확인합니다.
 *
 *  `anon` 키를 apikey 로 같이 보내야 합니다 — Supabase 는 프로젝트를
 *  그것으로 고릅니다. anon 키는 브라우저에도 나가는 공개 키라 서버에
 *  두는 것이 위험을 늘리지 않습니다. */
async function askSupabase(token: string): Promise<AuthedUser> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  /* 설정이 없으면 **열어 두지 않고 닫습니다.** 인증을 못 하는 상태에서
     통과시키면, 환경변수 하나를 빠뜨린 배포가 곧 열린 문이 됩니다. */
  if (!url || !anon) throw new AuthError('AUTH_UNAVAILABLE')

  let res: Response
  try {
    res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new AuthError('AUTH_UNAVAILABLE')
  }
  if (!res.ok) throw new AuthError('AUTH_INVALID')

  const body = (await res.json()) as { id?: string; email?: string | null }
  if (!body?.id) throw new AuthError('AUTH_INVALID')
  return { id: body.id, email: body.email ?? null }
}

/** 통과하면 사용자, 아니면 던집니다.
 *
 *  `verify` 를 주입할 수 있게 둔 것은 시험 때문입니다 — 이 파일의 다른
 *  기본값들(`enabled`, `generate`)과 같은 방식입니다. */
export async function requireUser(
  request: Request,
  verify: (token: string) => Promise<AuthedUser> = askSupabase,
): Promise<AuthedUser> {
  const token = bearer(request)
  if (!token) throw new AuthError('AUTH_REQUIRED')
  return verify(token)
}

/** 에러를 HTTP 로. 401 과 503 을 가릅니다 — 앞엣것은 사람이 다시 로그인해서
 *  풀 수 있고, 뒤엣것은 서버가 고장 난 것이라 다시 로그인해도 안 풀립니다. */
export function authErrorStatus(error: unknown): { status: number; code: string } {
  if (error instanceof AuthError) {
    return error.code === 'AUTH_UNAVAILABLE'
      ? { status: 503, code: 'AUTH_UNAVAILABLE' }
      : { status: 401, code: error.code }
  }
  return { status: 401, code: 'AUTH_REQUIRED' }
}

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase 클라이언트 — 친구 방 전용.
 * env 가 없으면 null 을 돌려주고, 개인 앱은 아무 영향 없이 동작합니다.
 * 카메라 영상·프레임·랜드마크·자세 좌표는 절대 이 클라이언트로 보내지 않습니다.
 */
let cached: SupabaseClient | null = null

export function isRoomConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
      (import.meta.env.VITE_SUPABASE_ANON_KEY ||
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),
  )
}

/**
 * Supabase 내부 서비스 간 시계 오차로, 익명 가입 직후 ~1초 동안
 * "JWT issued at future"(PGRST303, 401) 가 간헐적으로 발생합니다.
 * 요청은 실행되지 않은 채 거부된 것이므로 짧게 기다렸다 1회 재시도합니다.
 * (신규 사용자의 첫 방 만들기/학교 선택이 이 창에 정확히 걸립니다)
 */
export async function fetchRetryingClockSkew(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init)
  if (res.status !== 401) return res
  try {
    const body = (await res.clone().json()) as { code?: string } | null
    if (body?.code !== 'PGRST303') return res
  } catch {
    return res
  }
  await new Promise((resolve) => setTimeout(resolve, 1200))
  return fetch(input, init)
}

export async function getSupabase(): Promise<SupabaseClient | null> {
  if (cached) return cached

  if (!isRoomConfigured()) return null

  const { createClient } = await import('@supabase/supabase-js')
  cached = createClient(
    import.meta.env.VITE_SUPABASE_URL!,
    (import.meta.env.VITE_SUPABASE_ANON_KEY ??
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)!,
    {
      auth: { persistSession: true, detectSessionInUrl: true },
      global: { fetch: fetchRetryingClockSkew },
    },
  )
  return cached
}

/**
 * 메일 링크가 돌아온 뒤 PKCE `code`를 세션으로 교환합니다.
 * Supabase 기본 템플릿은 6자리 토큰 대신 이 링크를 보내므로,
 * 콜백을 앱 진입 시 명시적으로 소비해야 배포 환경에서도 인증이 확정됩니다.
 */
export async function consumeAuthCallback(): Promise<boolean> {
  const supabase = await getSupabase()
  if (!supabase || typeof window === 'undefined') return false

  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return false
    url.searchParams.delete('code')
    window.history.replaceState({}, document.title, url.toString())
    return true
  }

  const { data } = await supabase.auth.getSession()
  return Boolean(data.session?.user)
}

/** 익명 로그인 — 이메일·비밀번호를 요구하지 않습니다. */
export async function ensureAnonymousUser(): Promise<string | null> {
  const supabase = await getSupabase()
  if (!supabase) return null

  await consumeAuthCallback()
  const { data: sessionData } = await supabase.auth.getSession()
  if (sessionData.session?.user) return sessionData.session.user.id

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error || !data.user) return null
  return data.user.id
}

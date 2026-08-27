/*
 * 노션 공개 통합 — 사람마다 자기 워크스페이스에 연결합니다.
 *
 * 내부 통합과 무엇이 다른가
 * -------------------------
 * 내부 통합은 토큰이 하나라 **모든 사람의 녹음이 우리 워크스페이스**로
 * 갑니다. 시연에는 되지만 남에게 내보낼 수는 없습니다. 공개 통합은
 * 사람마다 토큰이 따로 나오고, 각자 자기 노션에 쌓입니다.
 *
 * 이 함수가 하는 일 셋
 * --------------------
 *   GET  ?start=1   로그인한 사람에게 승인 주소를 만들어 줍니다
 *   GET  ?code=…    노션이 되돌려보낸 곳. 토큰으로 바꿔 저장하고 월드로 돌려보냅니다
 *   GET  (그냥)     지금 연결됐나 (토큰은 절대 안 돌려줍니다)
 *   DELETE          연결 끊기
 *
 * state 를 왜 서명하나
 * --------------------
 * 노션이 되돌려보낼 때는 우리 Authorization 헤더가 없습니다. 브라우저가
 * 그냥 redirect_uri 로 오는 것뿐이라, **누가 시작한 승인인지**를 code
 * 만으로는 알 수 없습니다. 그래서 시작할 때 사용자 id 를 state 에 담고
 * client_secret 으로 HMAC 서명합니다. 표를 하나 더 두지 않고, 남이
 * 지어낸 state 로 남의 계정에 토큰을 꽂는 것도 막습니다.
 *
 * 토큰을 왜 브라우저에 안 주나
 * ---------------------------
 * 이 access_token 은 그 사람이 승인한 노션 범위를 읽고 쓸 수 있습니다.
 * 브라우저에 한 번이라도 내려보내면 그때부터 그건 공개된 값입니다.
 * 표는 RLS 로 통째로 막아 두었고(정책 없음), 이 함수만 service_role 로
 * 읽습니다.
 *
 * 켜는 법 — 노션 화면에서 셋
 * --------------------------
 *  1. notion.so/my-integrations → New integration → **Public** 선택
 *  2. Redirect URI 에  https://<도메인>/api/notion-oauth
 *     "Notion URL for optional template" 에 회의록 템플릿 페이지 주소
 *     (공개 페이지여야 합니다. 이걸 걸면 승인할 때 노션이 그 페이지를
 *      사용자 워크스페이스에 복제해 주고 id 를 돌려줍니다 — 저장 위치를
 *      우리가 물어볼 필요가 없어집니다.)
 *  3. Vercel > Settings > Environment Variables
 *       NOTION_CLIENT_ID          = <통합의 OAuth client ID>
 *       NOTION_CLIENT_SECRET      = <OAuth client secret>
 *       NOTION_REDIRECT_URI       = https://<도메인>/api/notion-oauth
 *       SUPABASE_URL              = (이미 있음)
 *       SUPABASE_SERVICE_ROLE_KEY = <service_role 키 — 브라우저에 절대 금지>
 *
 * 그리고 supabase/migrations/20260827_notion_connections.sql 을 한 번 돌립니다.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { requireUser, authErrorStatus } from './require-auth.js'

export const maxDuration = 15

const AUTHORIZE = 'https://api.notion.com/v1/oauth/authorize'
const TOKEN = 'https://api.notion.com/v1/oauth/token'
const VERSION = '2026-03-11'

type Env = {
  id?: string; secret?: string; redirect?: string
  sbUrl?: string; sbKey?: string
}
const env = (): Env => ({
  id: process.env.NOTION_CLIENT_ID,
  secret: process.env.NOTION_CLIENT_SECRET,
  redirect: process.env.NOTION_REDIRECT_URI,
  sbUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL,
  sbKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
})
const ready = (e: Env) => !!(e.id && e.secret && e.redirect && e.sbUrl && e.sbKey)

/* ── state — 사용자 id + 서명 ── */
const b64u = (s: string | Buffer) =>
  Buffer.from(s as any).toString('base64url')
function signState(userId: string, secret: string) {
  const body = b64u(`${userId}.${Date.now()}`)
  const mac = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${mac}`
}
function readState(state: string, secret: string): string | null {
  const [body, mac] = String(state || '').split('.')
  if (!body || !mac) return null
  const want = createHmac('sha256', secret).update(body).digest('base64url')
  /* 길이가 다르면 timingSafeEqual 이 던집니다 — 먼저 봅니다 */
  if (mac.length !== want.length) return null
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null
  const [userId, at] = Buffer.from(body, 'base64url').toString().split('.')
  /* 10분 지난 승인은 안 받습니다. 링크가 어딘가에 남아 나중에 눌리는 것을 막습니다 */
  if (!userId || Date.now() - Number(at) > 10 * 60 * 1000) return null
  return userId
}

/* ── Supabase — service_role 로만 ── */
async function sb(e: Env, path: string, init: RequestInit = {}) {
  const r = await fetch(`${e.sbUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: e.sbKey!, Authorization: `Bearer ${e.sbKey}`,
      'Content-Type': 'application/json', ...init.headers,
    },
  })
  if (!r.ok) throw new Error(`supabase ${r.status}: ${(await r.text()).slice(0, 160)}`)
  const t = await r.text()
  return t ? JSON.parse(t) : null
}

export async function saveConnection(e: Env, userId: string, tok: any) {
  await sb(e, 'notion_connections', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      user_id: userId,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token ?? null,
      workspace_id: tok.workspace_id ?? null,
      workspace_name: tok.workspace_name ?? null,
      page_id: tok.duplicated_template_id ?? null,
    }),
  })
}

/** 이 사람의 노션 토큰. 없으면 null. 다른 함수(notion-meeting)도 씁니다. */
export async function getConnection(userId: string) {
  const e = env()
  if (!ready(e)) return null
  const rows = await sb(e, `notion_connections?user_id=eq.${userId}&select=*`)
  return rows?.[0] ?? null
}

/** 만료됐을 때 한 번 갱신합니다. 노션은 refresh_token 을 같이 줍니다. */
export async function refresh(userId: string, refreshToken: string) {
  const e = env()
  if (!ready(e) || !refreshToken) return null
  const basic = Buffer.from(`${e.id}:${e.secret}`).toString('base64')
  const r = await fetch(TOKEN, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json',
      'Notion-Version': VERSION },
    body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  })
  if (!r.ok) return null
  const tok = await r.json()
  await saveConnection(e, userId, tok)
  return tok.access_token as string
}

export default async function handler(req: any, res: any) {
  const e = env()
  const send = (code: number, body: unknown) => {
    res.statusCode = code
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(body))
  }
  const url = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`)

  if (!ready(e)) return send(200, { configured: false })

  /* ── 노션이 되돌려보낸 곳 ── 여기만 Authorization 헤더가 없습니다 */
  const code = url.searchParams.get('code')
  if (code) {
    const back = (q: string) => {
      res.statusCode = 302
      res.setHeader('Location', `/prototypes/campus3d/index.html?notion=${q}`)
      res.end()
    }
    const userId = readState(url.searchParams.get('state') || '', e.secret!)
    if (!userId) return back('bad-state')
    try {
      const basic = Buffer.from(`${e.id}:${e.secret}`).toString('base64')
      const r = await fetch(TOKEN, {
        method: 'POST',
        headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json',
          'Notion-Version': VERSION },
        body: JSON.stringify({
          grant_type: 'authorization_code', code,
          redirect_uri: e.redirect,
        }),
      })
      if (!r.ok) return back('token-failed')
      await saveConnection(e, userId, await r.json())
      return back('ok')
    } catch { return back('failed') }
  }
  if (url.searchParams.get('error')) {
    res.statusCode = 302
    res.setHeader('Location', '/prototypes/campus3d/index.html?notion=denied')
    return res.end()
  }

  /* ── 아래는 로그인한 사람만 ── */
  let user
  try {
    /* node 의 headers 는 값이 string[] 일 수 있어 Request 가 그대로는 안 받습니다 */
    const h = new Headers()
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') h.set(k, v)
      else if (Array.isArray(v)) h.set(k, v.join(', '))
    }
    user = await requireUser(new Request(url.toString(), { headers: h }))
  } catch (err) {
    const failed = authErrorStatus(err)
    return send(failed.status, { error: failed.code })
  }

  if (req.method === 'DELETE') {
    await sb(e, `notion_connections?user_id=eq.${user.id}`, { method: 'DELETE' })
    return send(200, { connected: false })
  }

  if (url.searchParams.get('start')) {
    const q = new URLSearchParams({
      client_id: e.id!, redirect_uri: e.redirect!,
      response_type: 'code', owner: 'user',
      state: signState(user.id, e.secret!),
    })
    return send(200, { configured: true, url: `${AUTHORIZE}?${q}` })
  }

  const row = await getConnection(user.id)
  /* 토큰은 안 나갑니다. 연결됐는지와 어느 워크스페이스인지만. */
  return send(200, {
    configured: true,
    connected: !!row,
    workspace: row?.workspace_name ?? null,
    page: !!row?.page_id,
  })
}

/*
 * 비공개 세션 녹음 → 노션 AI 회의록.
 *
 * 무엇을 하는가
 * -------------
 * 브라우저가 녹음한 오디오(AAC/m4a)를 받아 노션에 올리고, 노션 AI 회의록
 * 블록을 만듭니다. 전사·요약은 노션이 합니다. 우리는 음성을 저장하지도
 * 분석하지도 않습니다 — 받아서 그대로 넘기고 버립니다.
 *
 * 왜 서버 함수인가
 * ----------------
 * 노션 토큰은 비밀입니다. 브라우저에 넣으면 남이 이 워크스페이스에
 * 아무 페이지나 쓸 수 있습니다. weather.ts 가 KMA_SERVICE_KEY 를,
 * ai-chat.ts 가 GEMINI_API_KEY 를 다루는 방식과 같습니다.
 * 노션의 파일 올리기 2단계도 Authorization 을 요구하므로 브라우저가
 * upload_url 로 직접 쏘는 길은 없습니다. 파일이 이 함수를 지나가야 합니다.
 *
 * 노션이 시키는 순서 (Notion-Version: 2026-03-11)
 * -----------------------------------------------
 *   1. POST /v1/file_uploads              → { id, upload_url }
 *   2. POST /v1/file_uploads/{id}/send    multipart, 20MB 까지
 *   3. POST /v1/blocks/meeting_notes      { source:{file_upload_id}, parent, language }
 * 3단계는 즉시 돌아오고 전사는 뒤에서 돕니다. status 가 notes_ready 가
 * 되기 전까지 자식 블록은 아직 없습니다 — 부르는 쪽은 링크만 받고 갑니다.
 *
 * **WebM 은 노션이 안 받습니다.** 크롬의 MediaRecorder 기본값이 WebM 이라
 * 여기서 제일 많이 걸립니다. 브라우저 쪽에서 audio/mp4(AAC)로 녹음하고
 * content_type 도 audio/mp4 로 보냅니다(m4a 의 정식 MIME 입니다).
 *
 * 크기 한도
 * ---------
 * 노션은 20MB 까지 받지만 **Vercel 함수의 요청 본문이 4.5MB** 라 그쪽이
 * 먼저 걸립니다. 24kbps 모노 AAC(사람 말에는 충분)면 3KB/s 이므로
 * 약 25분이 한도입니다. 넘으면 실패가 아니라 그 사실을 그대로 돌려줍니다.
 *
 * 어느 노션에 쓰나 — 둘 중 하나
 * -----------------------------
 *  · 부르는 사람이 **자기 노션을 연결해 두었으면** 거기에 씁니다.
 *    (공개 통합 + OAuth. notion-oauth.ts 가 그 연결을 만듭니다.)
 *  · 아니면 아래 내부 통합으로 물러납니다 — 전부 한 워크스페이스로
 *    갑니다. 시연에는 되지만 남에게 내보내는 값은 아닙니다.
 *
 * 켜는 법 (내부 통합 · 시연용)
 * ---------------------------
 *  1. notion.so/my-integrations 에서 내부 통합을 만들고 토큰(ntn_…)을 복사
 *  2. 회의록이 쌓일 노션 페이지를 하나 만들고 그 통합을 초대(⋯ → 연결)
 *  3. Vercel > Settings > Environment Variables 에
 *       NOTION_TOKEN          = ntn_…
 *       NOTION_PARENT_PAGE_ID = <그 페이지 id 32자리>
 *     를 넣고 재배포
 *
 * 키가 없으면 실패가 아니라 { configured: false } 를 돌려줍니다. 그때
 * 월드는 녹음 단추를 아예 안 보여 줍니다 — 눌러도 안 되는 단추를
 * 띄우는 것이 제일 나쁩니다.
 *
 * 확인: 배포 후 https://<도메인>/api/notion-meeting 을 GET 하면
 *   {"configured":true} 가 나옵니다.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { requireUser } from './require-auth.js'
import { getConnection, refresh } from './notion-oauth.js'

export const maxDuration = 60

const API = 'https://api.notion.com/v1'
const VERSION = '2026-03-11'
/* Vercel 서버리스 요청 본문 한도. 노션의 20MB 보다 이쪽이 작습니다. */
const MAX_BYTES = 4.5 * 1024 * 1024

/* 노션이 받는 소리 형식만 통과시킵니다. WebM 은 여기서 막아야 3단계에서
   전사가 통째로 실패하는 것을 피합니다. */
const OK_TYPES: Record<string, string> = {
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
}

type Cfg = { token?: string; parent?: string; who?: string; refresh?: string }

/* 내부 통합(우리 워크스페이스 하나)의 설정. 시연용 뒷길입니다. */
function shared(): Cfg {
  return {
    token: process.env.NOTION_TOKEN,
    parent: (process.env.NOTION_PARENT_PAGE_ID || '').replace(/-/g, ''),
  }
}

/* 어느 노션에 쓸지 고릅니다.
   1순위는 **부르는 사람 자기 노션**(OAuth). 로그인해서 연결해 둔 사람은
   자기 워크스페이스에 쌓입니다.
   그게 없으면 내부 통합으로 물러납니다 — 그건 전부 한 워크스페이스로
   갑니다. 시연에는 되지만 남에게 내보내는 값은 아닙니다. */
async function pick(req: IncomingMessage): Promise<Cfg> {
  try {
    const h = new Headers()
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') h.set(k, v)
      else if (Array.isArray(v)) h.set(k, v.join(', '))
    }
    if (h.get('authorization')) {
      const user = await requireUser(new Request('https://x/', { headers: h }))
      const row = await getConnection(user.id)
      if (row?.access_token) {
        return {
          token: row.access_token,
          parent: String(row.page_id || '').replace(/-/g, ''),
          who: user.id,
          refresh: row.refresh_token || undefined,
        }
      }
    }
  } catch { /* 로그인 안 했거나 연결 안 했으면 아래로 */ }
  return shared()
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const parts: Buffer[] = []
  let n = 0
  for await (const chunk of req) {
    const b = chunk as Buffer
    n += b.length
    /* 한도를 넘으면 끝까지 읽지 않고 끊습니다. 다 받아 놓고 버리면
       그 시간과 메모리가 그냥 버려집니다. */
    if (n > MAX_BYTES) throw new Error('too-large')
    parts.push(b)
  }
  return Buffer.concat(parts)
}

async function notion(path: string, token: string, init: RequestInit = {}) {
  const r = await fetch(API + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': VERSION,
      ...init.headers,
    },
  })
  const text = await r.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* 노션이 HTML 을 돌려줄 때가 있습니다 */ }
  if (!r.ok) {
    const why = json?.message || text.slice(0, 200) || `HTTP ${r.status}`
    throw new Error(`notion ${path}: ${why}`)
  }
  return json
}

export default async function handler(req: IncomingMessage & { method?: string },
                                      res: ServerResponse) {
  const send = (code: number, body: unknown) => {
    res.statusCode = code
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(body))
  }
  const cfg = await pick(req)
  const { parent } = cfg
  let { token } = cfg

  /* GET 은 "켜져 있나" 만 답합니다. 월드가 부팅할 때 이걸 보고 녹음
     단추를 보일지 정합니다. 토큰 자체는 절대 안 돌려줍니다. */
  if (req.method === 'GET') {
    return send(200, { configured: !!(token && parent), mine: !!cfg.who })
  }
  if (req.method !== 'POST') return send(405, { error: 'method' })
  if (!token || !parent) return send(200, { configured: false })

  const type = String((req.headers['content-type'] || '')).split(';')[0].trim()
  const ext = OK_TYPES[type]
  if (!ext) {
    return send(415, {
      error: 'type',
      message: `${type || '알 수 없는 형식'} 은 노션이 안 받습니다. audio/mp4 로 녹음해 주세요.`,
    })
  }

  let audio: Buffer
  try {
    audio = await readBody(req)
  } catch (e) {
    if ((e as Error).message === 'too-large') {
      return send(413, { error: 'too-large',
        message: '녹음이 너무 깁니다. 25분까지 보낼 수 있어요.' })
    }
    return send(400, { error: 'body' })
  }
  if (!audio.length) return send(400, { error: 'empty' })

  /* 제목은 부르는 쪽이 줍니다. 헤더로 받는 이유는 본문이 통째로
     오디오이기 때문입니다 — multipart 로 감싸면 4.5MB 를 더 깎습니다. */
  const rawTitle = String(req.headers['x-session-title'] || '')
  let title = '비공개 세션'
  try { title = decodeURIComponent(rawTitle) || title } catch { /* 잘못 인코딩된 값은 무시 */ }
  title = title.slice(0, 200)

  try {
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
    const filename = `deskfit-${Date.now()}.${ext}`

    // 1 — 올릴 자리를 받습니다.
    //     토큰이 만료됐으면 여기서 걸리므로, 한 번만 갱신하고 다시 겁니다.
    let up
    try {
      up = await notion('/file_uploads', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content_type: type }),
      })
    } catch (err) {
      const fresh = cfg.who && cfg.refresh ? await refresh(cfg.who, cfg.refresh) : null
      if (!fresh) throw err
      token = fresh
      up = await notion('/file_uploads', token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content_type: type }),
      })
    }

    // 2 — 파일을 보냅니다. multipart 는 여기서만 씁니다
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(audio)], { type }), filename)
    await notion(`/file_uploads/${up.id}/send`, token, { method: 'POST', body: form })

    // 3 — 회의록 블록. 전사는 노션이 뒤에서 돕니다
    const note = await notion('/blocks/meeting_notes', token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: { type: 'file_upload', file_upload_id: up.id },
        parent: { type: 'page_id', page_id: parent },
        title: `${title} · ${stamp}`,
        language: 'ko',
        options: { kickoff_summary: true },
      }),
    })

    return send(200, {
      configured: true,
      id: note.id,
      status: note.meeting_notes?.status || 'transcription_not_started',
      url: `https://www.notion.so/${String(note.id).replace(/-/g, '')}`,
      seconds: Math.round(audio.length / 3072),   // 24kbps 기준 어림값
    })
  } catch (e) {
    /* 노션이 왜 거절했는지를 그대로 넘깁니다. "실패했어요" 만 돌려주면
       토큰이 잘못된 것인지 페이지를 안 붙인 것인지 알 길이 없습니다. */
    return send(502, { error: 'notion', message: (e as Error).message })
  }
}

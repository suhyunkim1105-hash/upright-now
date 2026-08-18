/*
 * 기상청 단기예보 → 월드 날씨.
 *
 * 왜 서버 함수인가 (브라우저에서 바로 부르면 안 되는 이유 둘)
 * ---------------------------------------------------------
 *  1. data.go.kr 은 CORS 헤더를 안 줍니다. 브라우저 fetch 는 무조건 막힙니다.
 *  2. serviceKey 는 비밀입니다. 브라우저에 넣으면 남이 내 하루 10,000회를
 *     써 버립니다. ai-chat.ts 가 GEMINI_API_KEY 를 다루는 방식과 같습니다.
 *
 * 키가 없으면 실패가 아니라 **"설정 안 됨"** 을 돌려줍니다. 월드는 그때
 * 지금까지 쓰던 절차적 날씨(날짜·시각으로 정해지는 곡선)를 그대로 씁니다 —
 * 화면에 가짜 예보를 띄우지 않습니다.
 *
 * 수현이 할 일
 * ------------
 *  1. data.go.kr 가입 → "기상청_단기예보 ((구)_동네예보) 조회서비스" 활용신청.
 *     자동 승인이고 하루 10,000회입니다.
 *  2. 마이페이지 > 인증키에서 **일반 인증키(Decoding)** 를 복사합니다.
 *  3. Vercel > 프로젝트 > Settings > Environment Variables 에
 *       KMA_SERVICE_KEY = <복사한 키>
 *     를 넣고 재배포합니다.
 *  4. (선택) 기본 격자는 서울(nx=60, ny=127)입니다. 다른 지역으로 바꾸려면
 *     기상청이 배포하는 "동네예보 격자 좌표" 엑셀에서 nx·ny 를 찾아
 *     아래 DEFAULT_GRID 를 고치거나, 클라이언트가 ?nx=..&ny=.. 로 넘깁니다.
 *
 * 확인 방법: 배포 후 https://<도메인>/api/weather 를 열어
 *   {"configured":true,"pty":0,...} 가 나오면 된 것입니다.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

export const maxDuration = 10

/* 서울 중구. 기상청 격자는 위경도가 아니라 자체 격자입니다. */
const DEFAULT_GRID = { nx: 60, ny: 127 }

const BASE =
  'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst'

/* 단기예보는 하루 여덟 번(02·05·08·11·14·17·20·23시)만 새로 나옵니다.
   아무 시각이나 넣으면 NO_DATA 입니다. 발표 후 10분쯤 지나야 조회되므로
   여유를 두고 한 칸 전을 씁니다. */
function baseSlot(now: Date): { date: string; time: string } {
  /* KST 로 옮깁니다. Vercel 함수는 UTC 로 돕니다. */
  const kst = new Date(now.getTime() + 9 * 3600_000)
  const slots = [23, 20, 17, 14, 11, 8, 5, 2]
  const h = kst.getUTCHours()
  const m = kst.getUTCMinutes()
  let pick = slots.find((s) => h > s || (h === s && m >= 15))
  const d = new Date(kst)
  if (pick === undefined) {
    /* 02시 15분 이전 — 어제 23시 발표가 가장 최근입니다 */
    pick = 23
    d.setUTCDate(d.getUTCDate() - 1)
  }
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return { date: `${yyyy}${mm}${dd}`, time: String(pick).padStart(2, '0') + '00' }
}

type Item = { category: string; fcstDate: string; fcstTime: string; fcstValue: string }

/** 예보 목록에서 **가장 이른 시각**의 값들만 뽑습니다 = 지금에 가장 가까운 예보. */
function nearest(items: Item[]): Record<string, string> {
  if (!items.length) return {}
  const key = (i: Item) => i.fcstDate + i.fcstTime
  let first = key(items[0])
  for (const i of items) if (key(i) < first) first = key(i)
  const out: Record<string, string> = {}
  for (const i of items) if (key(i) === first) out[i.category] = i.fcstValue
  return out
}

function json(res: ServerResponse, code: number, body: unknown): void {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  /* 예보는 한 시간에 한 번꼴로 바뀝니다. 브라우저마다 새로 부르면
     하루 10,000회를 금방 씁니다. */
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=1800')
  res.end(JSON.stringify(body))
}

export default async function weather(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const key = process.env.KMA_SERVICE_KEY
  if (!key) {
    /* 200 으로 돌려줍니다. 오류가 아니라 **아직 안 켠 기능**입니다 —
       4xx/5xx 로 주면 콘솔이 빨개지고, 화면은 어차피 같은 말을 합니다. */
    return json(response, 200, {
      configured: false,
      reason: 'KMA_SERVICE_KEY 가 없습니다. api/weather.ts 머리말을 보세요.',
    })
  }

  const url = new URL(request.url ?? '/', 'http://x')
  const nx = Number(url.searchParams.get('nx')) || DEFAULT_GRID.nx
  const ny = Number(url.searchParams.get('ny')) || DEFAULT_GRID.ny
  const slot = baseSlot(new Date())

  const q = new URLSearchParams({
    serviceKey: key,
    dataType: 'JSON',
    numOfRows: '60',      // 한 시각당 12개 항목 × 몇 시간이면 충분합니다
    pageNo: '1',
    base_date: slot.date,
    base_time: slot.time,
    nx: String(nx),
    ny: String(ny),
  })

  try {
    const r = await fetch(BASE + '?' + q.toString(), {
      signal: AbortSignal.timeout(6000),
    })
    if (!r.ok) return json(response, 200, { configured: true, ok: false, reason: 'HTTP ' + r.status })
    const body = (await r.json()) as {
      response?: { header?: { resultCode?: string; resultMsg?: string }; body?: { items?: { item?: Item[] } } }
    }
    const head = body.response?.header
    if (head?.resultCode !== '00') {
      /* 키가 아직 승인 대기이거나 격자가 틀렸을 때 여기로 옵니다.
         기상청 메시지를 그대로 넘깁니다 — 우리가 지어내면 고칠 수가 없습니다. */
      return json(response, 200, {
        configured: true, ok: false,
        reason: (head?.resultCode ?? '?') + ' ' + (head?.resultMsg ?? '알 수 없는 응답'),
      })
    }
    const near = nearest(body.response?.body?.items?.item ?? [])
    const pty = Number(near.PTY ?? 0)
    const pop = Number(near.POP ?? 0)
    return json(response, 200, {
      configured: true,
      ok: true,
      /* PTY 0 없음 · 1 비 · 2 비/눈 · 3 눈 · 4 소나기 · 5 빗방울 · 6 빗방울눈날림 · 7 눈날림 */
      pty,
      /* SKY 1 맑음 · 3 구름많음 · 4 흐림 */
      sky: Number(near.SKY ?? 1),
      /* 기온(°C)과 강수확률(%) */
      tempC: near.TMP === undefined ? null : Number(near.TMP),
      pop,
      grid: { nx, ny },
      baseAt: slot.date + slot.time,
    })
  } catch (e) {
    return json(response, 200, {
      configured: true, ok: false,
      reason: e instanceof Error && e.name === 'TimeoutError' ? '기상청이 늦게 답합니다' : '기상청에 못 닿았습니다',
    })
  }
}

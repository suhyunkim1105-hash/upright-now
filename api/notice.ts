/*
 * 학교 공지 → 중앙 광장 게시판.
 *
 * 왜 서버 함수인가
 * ----------------
 *  대학 사이트는 CORS 헤더를 안 줍니다. 브라우저에서 fetch 하면 무조건
 *  막힙니다(api/weather.ts 와 같은 이유). 여기서 받아 JSON 으로 바꿔 줍니다.
 *
 * 왜 크롤링이 아니라 RSS 인가
 * ---------------------------
 *  학교가 **스스로 공개한 피드**만 씁니다. 화면을 긁어 오는 것은 남의 집
 *  구조에 기대는 일이고, 그 집이 개편하는 날 조용히 깨집니다. 그리고
 *  링커리어·에브리타임처럼 약관이 명시적으로 금지하는 곳은 아예 안 봅니다
 *  (링커리어 이용약관 제20조 4항 · 에브리타임 2022년 크롤링 유죄 판례).
 *
 * 주소는 **이 표 안에 있는 것만** 부릅니다
 * ----------------------------------------
 *  클라이언트가 넘긴 주소를 그대로 fetch 하면 우리 서버가 아무 데나
 *  대신 들어가 주는 문이 됩니다(SSRF). 학교 도메인만 받고, 그 도메인이
 *  이 파일에 적혀 있을 때만 나갑니다.
 *
 * 학교 하나 늘리기 — 5분
 * ----------------------
 *  1. 그 학교 공지 페이지를 엽니다.
 *  2. 글 하나의 링크 주소를 봅니다. `…/bbs/<사이트>/<번호>/<글번호>/artclView.do`
 *     꼴이면 그 CMS 입니다. 가운데 <번호>가 **게시판 번호**입니다.
 *     (페이지 주소의 subview.do 앞 번호가 아닙니다 — 그건 메뉴 번호이고,
 *      그걸로 rssList 를 부르면 "No exist data in target board" 가 옵니다.
 *      실제로 그 함정에 한 번 빠졌습니다.)
 *  3. 아래 표에 { kind:'rss', host, rss, page, name } 한 줄을 넣습니다.
 *  4. 브라우저에서 https://<도메인>/api/notice?school=<학교도메인> 을 열어
 *     items 가 차 있으면 된 것입니다.
 *
 * 표에 rss 가 없는 학교는 **거짓말하지 않고** page 만 돌려줍니다. 화면은
 * "목록은 아직 못 받아와요" 라고 말하고 공지 페이지를 여는 단추를 답니다.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

export const maxDuration = 10

type Source = {
  name: string
  /** 사람이 눌러서 여는 공지 페이지. 모든 학교가 이건 있습니다. */
  page: string
  /** 학교가 공개한 RSS. 확인한 곳만 채웁니다. */
  rss?: string
  /** RSS 안 링크가 /bbs/... 로 시작할 때 앞에 붙일 주소 */
  host?: string
}

/* 2026-08-20 기준. rss 가 있는 곳은 실제로 불러서 글이 나오는 것을
   확인했습니다. 나머지는 공지 **페이지 주소만** 확인했습니다 —
   게시판 번호는 위 안내대로 한 학교씩 채우면 됩니다. */
const SOURCES: Record<string, Source> = {
  'mju.ac.kr': {
    name: '명지대학교 학사공지',
    host: 'https://www.mju.ac.kr',
    rss: 'https://www.mju.ac.kr/bbs/mjukr/143/rssList.do?row=15',
    page: 'https://www.mju.ac.kr/mjukr/257/subview.do',
  },
  'snu.ac.kr':     { name: '서울대학교 일반공지',   page: 'https://www.snu.ac.kr/snunow/notice/genernal' },
  'yonsei.ac.kr':  { name: '연세대학교 공지사항',   page: 'https://www.yonsei.ac.kr/wj/1415/subview.do' },
  'korea.ac.kr':   { name: '고려대학교 공지사항',   page: 'https://www.korea.ac.kr/user/boardList.do?siteId=university&boardId=1' },
  'skku.edu':      { name: '성균관대학교 공지사항', page: 'https://www.skku.edu/skku/campus/skk_comm/notice01.do' },
  'hanyang.ac.kr': { name: '한양대학교 서울캠퍼스 게시판', page: 'https://www.hanyang.ac.kr/bbsseoul' },
  'cau.ac.kr':     { name: '중앙대학교 공지사항',   page: 'https://www.cau.ac.kr/index.do' },
  'khu.ac.kr':     { name: '경희대학교 공지사항',   page: 'https://www.khu.ac.kr/kor/user/bbs/BMSR00040/list.do?menuNo=200318' },
  'ewha.ac.kr':    { name: '이화여자대학교 공지사항', page: 'https://www.ewha.ac.kr/ewha/news/notice.do' },
  'sogang.ac.kr':  { name: '서강대학교 일반 공지',  page: 'https://www.sogang.ac.kr/ko/story/notification-general' },
}

/* RSS 2.0 만 봅니다. XML 파서를 하나 더 들이는 대신 <item> 안에서 셋만
   꺼냅니다 — 우리가 쓰는 것이 제목·주소·날짜 셋뿐이라, 파서가 해 주는
   나머지 일이 전부 낭비입니다. CDATA 는 학교마다 쓰기도 하고 안 쓰기도
   해서 둘 다 받습니다. */
function tag(block: string, name: string): string {
  const m = new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>', 'i').exec(block)
  if (!m) return ''
  const raw = m[1].trim()
  const cd = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(raw)
  return (cd ? cd[1] : raw).trim()
}
function unescapeOnce(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')     // 마지막이어야 합니다 — &amp;lt; 가 <
}
function unescapeXml(s: string): string {
  /* 학교 CMS 는 제목을 **두 번** 감싸는 일이 흔합니다 — 원문의 큰따옴표가
     &amp;quot; 로 옵니다. 한 번만 풀면 화면에 &quot; 라는 글자가 그대로
     박힙니다. 그렇다고 무조건 두 번 풀면 진짜 &amp; 하나를 쓴 제목이
     망가지므로, 한 번 푼 뒤에도 실체 참조가 남아 있을 때만 더 풉니다. */
  let out = unescapeOnce(s)
  if (/&(lt|gt|quot|amp|apos|#\d+);/i.test(out)) out = unescapeOnce(out)
  return out.replace(/\s+/g, ' ').trim()
}
/** "2026-08-10 10:41:46.0" · RFC822 둘 다 받아 YYYY-MM-DD 로 */
function ymd(s: string): string {
  const iso = /(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})/.exec(s)
  if (iso) return iso[1] + '-' + iso[2].padStart(2, '0') + '-' + iso[3].padStart(2, '0')
  const t = Date.parse(s)
  if (Number.isNaN(t)) return ''
  const d = new Date(t)
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0')
    + '-' + String(d.getUTCDate()).padStart(2, '0')
}

type Item = { title: string; link: string; at: string }

function parseRss(xml: string, host: string | undefined, cap: number): Item[] {
  const out: Item[] = []
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []
  for (const b of blocks) {
    const title = unescapeXml(tag(b, 'title'))
    let link = unescapeXml(tag(b, 'link'))
    /* 이 CMS 는 링크를 /bbs/... 로 줍니다. 그대로 화면에 걸면 우리
       도메인 안에서 열려 404 가 됩니다. */
    if (link && !/^https?:\/\//i.test(link)) link = (host ?? '') + (link.startsWith('/') ? '' : '/') + link
    if (!title) continue
    /* 빈 판을 알리는 안내 항목이 item 하나로 옵니다("No exist data in
       target board"). 링크가 없으면 글이 아닙니다. */
    if (!link) continue
    out.push({ title, link, at: ymd(tag(b, 'pubDate') || tag(b, 'dc:date')) })
    if (out.length >= cap) break
  }
  return out
}

function json(res: ServerResponse, body: unknown): void {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  /* 공지는 하루에 몇 개 붙습니다. 사람마다 새로 부를 이유가 없습니다. */
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=1800')
  res.end(JSON.stringify(body))
}

export default async function notice(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://x')
  const school = (url.searchParams.get('school') ?? '').toLowerCase().trim()
  const src = SOURCES[school]

  if (!src) {
    /* 200 으로 돌려줍니다. 오류가 아니라 **아직 안 넣은 학교**입니다 —
       4xx 로 주면 콘솔이 빨개지고, 화면은 어차피 같은 말을 합니다. */
    return json(response, {
      ok: false, known: false, school,
      reason: '이 학교는 아직 목록에 없어요.',
    })
  }
  if (!src.rss) {
    return json(response, {
      ok: false, known: true, school, name: src.name, page: src.page,
      reason: '공지 목록 자동 연동을 준비 중이에요.',
    })
  }

  try {
    const r = await fetch(src.rss, {
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'Deskfit-Girin/1.0 (+campus notice reader)' },
    })
    if (!r.ok) {
      return json(response, {
        ok: false, known: true, school, name: src.name, page: src.page,
        reason: 'HTTP ' + r.status,
      })
    }
    const items = parseRss(await r.text(), src.host, 15)
    return json(response, {
      ok: items.length > 0, known: true, school,
      name: src.name, page: src.page, items,
      reason: items.length ? '' : '지금은 올라온 글이 없어요.',
    })
  } catch (e) {
    return json(response, {
      ok: false, known: true, school, name: src.name, page: src.page,
      reason: e instanceof Error && e.name === 'TimeoutError'
        ? '학교 서버가 늦게 답해요' : '학교 서버에 못 닿았어요',
    })
  }
}

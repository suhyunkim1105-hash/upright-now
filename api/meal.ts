/*
 * 학교별 공식 식단 → 학생회관 "오늘의 학식".
 *
 * 학교가 공개한 식단 페이지만 서버에서 읽습니다. 에브리타임·링커리어처럼
 * 제3자 서비스나 로그인 화면은 긁지 않습니다. 학교마다 공통 API가 없어서
 * 현재 HTML 식단표가 안정적으로 공개된 서울대·고려대·명지대만 자동
 * 연동하고, 나머지는 공식 페이지를 돌려줍니다. 가짜 메뉴로 빈칸을 채우지
 * 않는 것이 이 함수의 가장 중요한 규칙입니다.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

export const maxDuration = 10

type Source = { name: string; page: string; feed?: string; parser?: 'table' | 'k2' }
type Meal = { place: string; meal: string; menu: string[] }

const SOURCES: Record<string, Source> = {
  'snu.ac.kr': {
    name: '서울대학교 생활협동조합', page: 'https://snuco.snu.ac.kr/foodmenu/',
    feed: 'https://snuco.snu.ac.kr/foodmenu/', parser: 'table',
  },
  'korea.ac.kr': {
    name: '고려대학교 학생회관 학생식당', page: 'https://www.korea.ac.kr/ko/508/subview.do',
    feed: 'https://www.korea.ac.kr/ko/508/subview.do', parser: 'k2',
  },
  'mju.ac.kr': {
    name: '명지대학교 인문캠퍼스 학생회관식당', page: 'https://www.mju.ac.kr/mjukr/8595/subview.do',
    feed: 'https://www.mju.ac.kr/mjukr/8595/subview.do', parser: 'k2',
  },
  'yonsei.ac.kr': { name: '연세대학교 생활협동조합', page: 'https://www.yonsei.ac.kr/sc/campus/etc3.jsp' },
  'skku.edu': { name: '성균관대학교 교내 편의시설', page: 'https://www.skku.edu/skku/campus/support/welfare_01.do' },
  'hanyang.ac.kr': { name: '한양대학교 학생식당', page: 'https://www.hanyang.ac.kr/web/www/re1' },
  'cau.ac.kr': { name: '중앙대학교', page: 'https://www.cau.ac.kr' },
  'khu.ac.kr': { name: '경희대학교', page: 'https://www.khu.ac.kr' },
  'ewha.ac.kr': { name: '이화여자대학교', page: 'https://www.ewha.ac.kr' },
  'sogang.ac.kr': { name: '서강대학교', page: 'https://www.sogang.ac.kr' },
}
const entity = (s: string): string => s
  .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
  .replace(/&#0?39;|&apos;/gi, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))

function text(html: string): string {
  return entity(html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/td>|<\/th>|<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n').trim()
}

function cleanMenu(lines: string[]): string[] {
  return lines.map((s) => s.trim()).filter((s) => s
    && !/등록된 .*없습니다|원산지|알레르기|운영시간|혼잡시간|식자재|^[-|]$/.test(s))
    .slice(0, 12)
}

/** 일반 HTML 식단표: 식당 한 줄 × 아침·점심·저녁 셀. */
function parseTable(html: string): Meal[] {
  const out: Meal[] = []
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []
  for (const row of rows) {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => text(m[1]))
    if (cells.length < 2 || /식당\s*$/.test(cells[0]) && /아침|점심|저녁/.test(cells.slice(1).join(' '))) continue
    const place = cells[0].split('\n')[0].trim()
    if (!place || !/식당|푸드|키친|카페/.test(place)) continue
    ;['아침', '점심', '저녁'].forEach((meal, i) => {
      const menu = cleanMenu((cells[i + 1] || '').split('\n'))
      if (menu.length) out.push({ place, meal, menu })
    })
  }
  return out.slice(0, 12)
}

/** K2Web 주간 식단표: 오늘 날짜부터 다음 날짜 전까지만 읽습니다. */
function parseK2(html: string, now = new Date()): Meal[] {
  const kst = new Date(now.getTime() + 9 * 3600_000)
  const y = kst.getUTCFullYear(), m = kst.getUTCMonth() + 1, d = kst.getUTCDate()
  const all = text(html)
  const markers = [`${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}.`,
    `${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`]
  let at = -1
  for (const q of markers) { at = all.indexOf(q); if (at >= 0) break }
  if (at < 0) return []
  let block = all.slice(at, at + 2400)
  const next = /\n(?:20\d{2}\.)?\d{2}\.\d{2}(?:\.|\s)/.exec(block.slice(12))
  if (next) block = block.slice(0, next.index + 12)
  const out: Meal[] = []
  const re = /(?:^|\n)(천원의아침(?:\([^)]*\))?|조식|중식(?:\([^)]*\))?|석식)(?:\n|\s)([\s\S]*?)(?=\n(?:천원의아침|조식|중식|석식)(?:\([^)]*\))?(?:\n|\s)|$)/g
  let hit
  while ((hit = re.exec(block))) {
    const menu = cleanMenu(hit[2].split('\n'))
    if (menu.length) out.push({ place: '학생식당', meal: /조식|아침/.test(hit[1]) ? '아침' : /석식/.test(hit[1]) ? '저녁' : '점심', menu })
  }
  return out.slice(0, 8)
}

function json(res: ServerResponse, body: unknown): void {
  res.statusCode = 200
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=1800')
  res.end(JSON.stringify(body))
}

export default async function meal(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://x')
  const school = (url.searchParams.get('school') ?? '').toLowerCase().trim()
  const src = SOURCES[school]
  if (!src) return json(res, { ok: false, known: false, school, reason: '이 학교는 아직 식단 목록에 없어요.' })
  if (!src.feed || !src.parser) return json(res, {
    ok: false, known: true, school, name: src.name, page: src.page,
    reason: '공식 식단 페이지는 있지만 공개 API나 안정적인 자동 식단표를 확인하지 못했어요.',
  })
  try {
    const r = await fetch(src.feed, { signal: AbortSignal.timeout(6500),
      headers: { 'User-Agent': 'Deskfit-Girin/1.0 (+official campus meal reader)' } })
    if (!r.ok) return json(res, { ok: false, known: true, school, name: src.name, page: src.page, reason: 'HTTP ' + r.status })
    const html = await r.text()
    const items = src.parser === 'table' ? parseTable(html) : parseK2(html)
    const kst = new Date(Date.now() + 9 * 3600_000)
    const date = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`
    return json(res, { ok: items.length > 0, known: true, school, name: src.name, page: src.page, date, items,
      reason: items.length ? '' : '오늘 등록된 메뉴가 없거나 학교 식단표 형식이 바뀌었어요.' })
  } catch (e) {
    return json(res, { ok: false, known: true, school, name: src.name, page: src.page,
      reason: e instanceof Error && e.name === 'TimeoutError' ? '학교 식단 서버가 늦게 답해요.' : '학교 식단 서버에 닿지 못했어요.' })
  }
}

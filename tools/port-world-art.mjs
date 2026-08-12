/*
 * 프로토타입의 그림·맵·존을 src 로 다시 옮깁니다.
 *
 *   node tools/port-world-art.mjs
 *   npx playwright test e2e/world-parity.spec.ts --project=chromium
 *
 * 왜 도구인가 - 로컬에서 서비스를 완성한 뒤 이식하기로 했는데, 그동안
 * 프로토타입은 계속 바뀝니다. 이식본을 손대지 않고 두면 대조검사가 곧
 * 깨지고 저장소에 빨간 테스트가 남습니다. 매번 손으로 다시 옮기는 것도
 * 답이 아닙니다 - 2,500 줄을 사람이 옮기면 어딘가 한 글자가 틀리고, 이
 * 코드에서 한 글자는 픽셀 하나로만 나타나 눈으로는 안 잡힙니다.
 *
 * 그래서 옮기는 일을 한 줄로 만들어 둡니다. 프로토타입의 그림·맵·존을
 * 고쳤으면 이걸 돌리고 대조검사를 돌립니다. 그러면 이식본이 항상
 * 최신이고, 나중에 남는 일은 화면·이동·세션·패널뿐입니다.
 *
 * 옮기는 범위 - 순수한 구간만입니다. DOM 을 만지지 않고 이미지에 기대지
 * 않는 부분(그림·맵·존)이 여기 해당합니다. 화면·입력·세션은 React 로
 * 다시 짜므로 이 도구가 건드리지 않습니다.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..')

/* 프로토타입은 두 곳에 있습니다. 저장소 안의 사본을 먼저 보고, 없으면
   워크스페이스 원본을 봅니다. 사본이 최신인지는 아래에서 확인합니다. */
const CANDIDATES = [
  resolve(repo, 'prototypes/openworld/index.html'),
  resolve(repo, '../prototypes/openworld/index.html'),
]
const SRC = CANDIDATES.find((p) => existsSync(p))
if (!SRC) {
  console.error('프로토타입을 못 찾았습니다. 찾아본 곳:')
  CANDIDATES.forEach((p) => console.error('  ' + p))
  process.exit(1)
}

const OUT = resolve(repo, 'src/features/world/art.ts')

/* 두 사본이 갈라져 있으면 어느 쪽을 옮긴 것인지 알 수 없습니다 */
const other = CANDIDATES.find((p) => p !== SRC && existsSync(p))
if (other && readFileSync(SRC, 'utf8') !== readFileSync(other, 'utf8')) {
  console.error('프로토타입 사본 둘이 다릅니다. 맞춘 뒤에 다시 돌리세요.')
  console.error('  ' + SRC)
  console.error('  ' + other)
  process.exit(1)
}

const lines = readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n').split('\n')

/* 경계는 줄 번호로 박지 않습니다. 프로토타입이 자라면 번호가 밀립니다.
   내용으로 찾습니다: script 시작 ~ bake 를 전부 굽는 줄까지. */
const scriptAt = lines.findIndex((l) => l.trim() === '<script>')
const bakeAt = lines.findIndex((l) => l.includes('Object.values(ZONES).forEach(bake);'))
if (scriptAt < 0) { console.error('<script> 를 못 찾았습니다'); process.exit(1) }
if (bakeAt < 0) { console.error('Object.values(ZONES).forEach(bake); 를 못 찾았습니다'); process.exit(1) }

const body = lines.slice(scriptAt + 1, bakeAt + 1)

/* 순수한지 확인합니다. 프로토타입이 자라다 이 구간에 DOM 이 섞이면
   import 시점에 터지므로, 옮기기 전에 잡습니다. */
const impure = []
body.forEach((l, i) => {
  const code = l.replace(/\/\*.*?\*\//g, '').split('//')[0]
  if (/getElementById|querySelector|localStorage|addEventListener/.test(code)) {
    impure.push('L' + (scriptAt + 2 + i) + ': ' + l.trim().slice(0, 70))
  }
})
if (impure.length) {
  console.error('순수하지 않은 줄이 섞였습니다. 이 구간은 화면을 만지면 안 됩니다:')
  impure.slice(0, 10).forEach((l) => console.error('  ' + l))
  console.error('그림·맵·존이 아닌 코드가 들어왔는지 보세요.')
  process.exit(1)
}

/* 최상위 선언을 긁어 내보냅니다. 손으로 적으면 새로 만든 것이 빠집니다. */
const names = []
for (const l of body) {
  const m = l.match(/^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/)
  if (m) names.push(m[1])
}

/* 타입 - 그리기 인자는 느슨하게, 경계면은 제대로 (DECISIONS.md §7) */
const CTX = 'CanvasRenderingContext2D'

/* 인자 타입은 정규식으로 문법 형태를 맞히지 않습니다. function 선언,
   화살표, 콜백, 구조분해까지 형태가 여러 가지라 하나를 빼먹으면 그
   자리만 암시 any 로 남고 빌드가 깨집니다.

   대신 tsc 에게 물어봅니다. 파일을 써 놓고 typecheck 를 돌려 "이 줄
   이 열의 인자 X 가 암시 any" 를 받아 그 자리에만 넣습니다. tsc 가
   조용해질 때까지 반복하므로 빠지는 자리가 없습니다. */
const typed = body.map((l) =>
  /* getContext('2d') 는 널을 반환할 수 있지만, 방금 만든 캔버스라 반드시 있습니다 */
  l.replace(/\.getContext\('2d'\)(?!!)/g, ".getContext('2d')!"),
)

/* ---------------- 경계면 타입 ----------------
   위의 기계적 처리는 그리기 인자만 봅니다. 컨테이너와 존은 다른 파일이
   읽는 물건이라 모양을 제대로 적어야 합니다.

   프로토타입에서 이 선언들이 바뀌면 아래가 빗나갑니다. 그때는 조용히
   깨진 타입을 내보내는 대신 여기서 멈추고 무엇이 안 맞는지 말합니다. */
const WORLD_TYPES = `
/* ---------------- 존 ----------------
   맵 하나의 모양입니다. makeMap 이 뼈대를 만들고, 존을 짓는 쪽이 이름과
   그림을 붙이고, bake 가 충돌을 굽습니다. 세 단계라 나중에 붙는 것은
   전부 선택입니다.

   이 타입만 제대로 쓰는 이유 - 화면·이동·세션·저장이 전부 존을 읽습니다.
   여기서 이름 하나를 틀리면 그 오류가 파일 밖으로 나갑니다. */
export interface WorldProp { kind: string; x: number; y: number }
export interface WorldPortal {
  x: number; y: number; w: number; h: number;
  to: string; sx: number; sy: number; label: string;
}
export interface WorldThing { x: number; y: number; name: string; panel?: string }
export interface WorldNpc { x: number; y: number; name: string; [k: string]: any }
export interface WorldWall { c: HTMLCanvasElement; x: number; y: number }

export interface WorldMap {
  w: number; h: number;
  base: Uint16Array;          // 바닥 타일 인덱스
  over: Uint8Array;           // 오토타일 재질 (0 = 없음)
  props: WorldProp[];
  portals: WorldPortal[];
  npcs: WorldNpc[];
  things: WorldThing[];

  /* 존을 지으면서 붙습니다 */
  name?: string;
  sub?: string;
  floor?: HTMLCanvasElement;   // 실내 - 방 전체가 한 장
  ground?: HTMLCanvasElement;  // 야외 - 잔디를 한 장으로
  walls?: WorldWall[];
  spawn?: { x: number; y: number };
  clock?: { x: number; y: number };

  /* bake() 가 굽습니다 */
  solid?: Uint8Array;
  sitSpots?: { x: number; y: number }[];
}

`

const BOUNDARY = [
  /* 소품표 - 80 종이 세 모양(시트·손그림·건물)으로 섞여 있어 값은 열어 둡니다 */
  ['const PROP = {', 'const PROP: Record<string, any> = {'],
  /* 그려 둔 캔버스 - 값이 캔버스가 아니면 그리기가 조용히 실패하므로 잠급니다 */
  ['const PAINTED = {};', 'const PAINTED: Record<string, HTMLCanvasElement> = {};'],
  ['const ZONES = {};', 'const ZONES: Record<string, WorldMap> = {};'],
  /* 없는 글자를 물으면 undefined 가 나와야 handText 가 잘라 쓰기로 넘어갑니다 */
  ['const GLYPH8 = {', 'const GLYPH8: Record<string, string[]> = {'],
  ['const PXTEXT = new Map();', 'const PXTEXT = new Map<string, HTMLCanvasElement>();'],
  /* Map.has() 는 타입을 좁혀 주지 않습니다 */
  ['  if (PXTEXT.has(key)) return PXTEXT.get(key);',
   '  const hit = PXTEXT.get(key);\n  if (hit) return hit;   // has() 는 타입을 좁혀 주지 않습니다'],
  /* 원래 선택이던 꼬리 인자들. 여기서 타입까지 적어 둡니다 - 아래 tsc
     통과는 "암시 any" 만 채우므로, ? 만 붙여 두면 타입 없는 ? 가 남아
     문법 오류가 됩니다. */
  [`function roofIcon(g, kind, cx, cy, R) {`,
   `function roofIcon(g: ${CTX}, kind: any, cx: any, cy: any, R?: any) {`],
  ['function paintedProp(key, w, h, solidRows) {',
   'function paintedProp(key: any, w: any, h: any, solidRows?: any) {'],
  ['function paintFloor(w, h, kind, P) {',
   'function paintFloor(w: any, h: any, kind: any) {'],
  /* 존을 받는 도구들 */
  ['const at = (m,', 'const at = (m: WorldMap,'],
  ['const inMap = (m,', 'const inMap = (m: WorldMap,'],
  ['function fillBase(m,', 'function fillBase(m: WorldMap,'],
  ['function fillOver(m,', 'function fillOver(m: WorldMap,'],
  ['function fillEllipse(m,', 'function fillEllipse(m: WorldMap,'],
  ['function ring(m,', 'function ring(m: WorldMap,'],
  ['function prop(m,', 'function prop(m: WorldMap,'],
  ['function rowOf(m,', 'function rowOf(m: WorldMap,'],
  ['function placeBuilding(m,', 'function placeBuilding(m: WorldMap,'],
  ['function dressRoom(m,', 'function dressRoom(m: WorldMap,'],
  ['function bake(m) {', 'function bake(m: WorldMap) {'],
]

let joined = typed.join('\n')

/* makeMap 앞에 존 타입을 세우고 반환형을 붙입니다 */
const MAKEMAP = 'function makeMap(w, h, baseTile) {'
if (!joined.includes(MAKEMAP)) {
  console.error('makeMap 선언이 예상과 다릅니다. 프로토타입에서 바뀌었는지 보세요.')
  console.error('  찾던 것: ' + MAKEMAP)
  process.exit(1)
}
joined = joined.replace(
  MAKEMAP,
  WORLD_TYPES + 'function makeMap(w: number, h: number, baseTile: number): WorldMap {',
)

const missed = []
for (const [a, b] of BOUNDARY) {
  if (!joined.includes(a)) { missed.push(a); continue }
  joined = joined.replace(a, b)
}
if (missed.length) {
  console.error('경계면 선언 ' + missed.length + '곳이 예상과 다릅니다:')
  missed.forEach((m) => console.error('  ' + m))
  console.error('프로토타입에서 바뀌었다면 tools/port-world-art.mjs 의 BOUNDARY 도 같이 고치세요.')
  process.exit(1)
}

/* 빈 배열로 시작해 밀어 넣는 충돌 격자 - never[] 로 추론됩니다 */
joined = joined.replace(/^  const c = \[\];$/gm, '  const c: number[][] = [];')

const head = `/* ==================================================================
   기린캠퍼스 - 월드 그림·맵·존

   **이 파일은 손으로 고치지 마세요.** prototypes/openworld/index.html 에서
   자동으로 뽑아 옵니다. 고칠 곳은 프로토타입이고, 고친 뒤에

     node tools/port-world-art.mjs
     npx playwright test e2e/world-parity.spec.ts --project=chromium

   을 돌리면 여기가 따라옵니다. 대조검사가 픽셀 단위로 확인합니다.

   이 구간은 DOM 을 만지지 않습니다. document.createElement('canvas') 만
   쓰므로 import 시점에 안전합니다. 화면·입력·세션은 React 로 다시 짜므로
   여기 없습니다.

   타입이 느슨한 이유는 DECISIONS.md §7 에 있습니다. px() 에 number 를
   붙여 잡히는 버그는 없고, 타입이 일하는 곳은 WorldMap 같은 경계면입니다.
   ================================================================== */
/* eslint-disable */

`

const tail = `
/* ---------------- 내보내기 ----------------
   최상위 선언 전부. 목록을 손으로 적으면 새로 만든 것이 빠집니다. */
export {
${names.map((n) => '  ' + n + ',').join('\n')}
};
`

mkdirSync(dirname(OUT), { recursive: true })
const prev = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
writeFileSync(OUT, head + joined + tail, 'utf8')

/* ---------------- 인자 타입: tsc 에게 물어 채웁니다 ----------------
   써 놓고 typecheck 를 돌려 "암시 any" 자리만 받아 넣습니다. 한 번에
   안 끝나는 이유는, 타입을 넣으면 그 아래에서 새 오류가 드러나기
   때문입니다. 조용해질 때까지 돕니다. */
function implicitAny() {
  let out = ''
  try {
    out = execSync('npm run typecheck 2>&1', { cwd: repo, encoding: 'utf8' })
  } catch (e) {
    out = (e.stdout || '') + (e.stderr || '')
  }
  return out
    .split('\n')
    .map((l) => l.match(/src[\\/]features[\\/]world[\\/]art\.ts\((\d+),(\d+)\): error TS7006: Parameter '([^']+)'/))
    .filter(Boolean)
    .map((m) => ({ line: +m[1], col: +m[2], name: m[3] }))
}

let rounds = 0
for (;;) {
  const spots = implicitAny()
  if (!spots.length) break
  if (++rounds > 8) {
    console.error('8 회를 돌아도 암시 any 가 남습니다. 남은 자리:')
    spots.slice(0, 6).forEach((s) => console.error(`  L${s.line} ${s.name}`))
    process.exit(1)
  }
  const cur = readFileSync(OUT, 'utf8').split('\n')
  const byLine = new Map()
  for (const s of spots) {
    if (!byLine.has(s.line)) byLine.set(s.line, [])
    byLine.get(s.line).push(s)
  }
  /* 한 줄 안에서는 오른쪽부터 넣어야 앞 자리의 열 번호가 안 밀립니다 */
  for (const [ln, items] of byLine) {
    const i = ln - 1
    if (i < 0 || i >= cur.length) continue
    items.sort((a, b) => b.col - a.col)
    for (const it of items) {
      const at = it.col - 1 + it.name.length
      cur[i] = cur[i].slice(0, at) + ': ' + (it.name === 'g' ? CTX : 'any') + cur[i].slice(at)
    }
  }
  writeFileSync(OUT, cur.join('\n'), 'utf8')
}

const next = readFileSync(OUT, 'utf8')

console.log('출처   :', SRC.replace(repo, '.'))
console.log('옮긴 줄:', body.length)
console.log('내보냄 :', names.length, '개')
console.log('결과   :', prev === next ? '변화 없음' : '갱신됨')
console.log()
console.log('다음: npx playwright test e2e/world-parity.spec.ts --project=chromium')

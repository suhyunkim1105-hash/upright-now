#!/usr/bin/env node
/**
 * build-items.mjs — 상점 꾸미기 아이템 픽셀 에셋 생성기
 *
 * 규격: docs/item-spec.md  (상위: docs/character-spec-common.md)
 * 결과: assets/03_items/{카테고리}/{이름}.png   — 128 x 48 (32x48 x 4방향)
 *       assets/03_items/items.js / items.json   — 매니페스트
 *       assets/03_items/_test/mannequin.png     — 겹침 검사용 마네킹
 *
 * 의존성 없음 (node 내장 zlib 로 PNG 를 직접 씁니다).
 *   node scripts/build-items.mjs
 *
 * 숫자를 바꾸려면 문서가 아니라 아래 Y / SLOT 상수를 고치세요.
 * 시작할 때 layout.json 과 대조해서 어긋나면 멈춥니다.
 */

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'assets/03_items')
const LAYOUT_JSON = resolve(ROOT, 'assets/02_character/_template/layout.json')
const SILHOUETTE_JSON = resolve(ROOT, 'assets/02_character/_template/silhouettes.json')

// ─────────────────────────────────────────────────────────────────────────────
// 1. 좌표 — docs/item-spec.md §2·§3·§4
// ─────────────────────────────────────────────────────────────────────────────

const FRAME_W = 32
const FRAME_H = 48

/** 시트 프레임 순서. 캐릭터 layout.json 의 idle 순서와 반드시 같아야 합니다. */
const DIRS = ['right', 'up', 'left', 'down']

const Y = {
  timerReserve: 5, // y < 5 는 어떤 아이템도 픽셀 금지 (시안 머리 꼭대기가 y6-9)
  headTop0: 8, // 기준 종(거북이·기린·백조)의 머리 꼭대기
  headBottom: 24,

  hatSeat0: 8, // 모자 안착면 4줄
  hatSeat1: 11,
  hatHangMax: 14, // 술 등 늘어짐 한계

  eyeTop: 14, // 눈 윗줄 — 시안 8종이 이 줄에 모여 있습니다
  face0: 14, // 안경 슬롯 (눈이 4줄이라 3줄 -> 4줄)
  face1: 17,

  shoulder: 25, // attachY
  collar: 26,
  upper0: 27, // 소매
  upper1: 29,
  fore0: 30, // 팔뚝 — 반팔은 여기를 비운다
  fore1: 32,
  hand0: 33, // 손·앞발 — 어떤 상의도 덮지 않는다
  hand1: 35,
  waist0: 34,
  waist1: 36,
  belt: 37, // beltY

  leg0: 38,
  leg1: 42,
  feet0: 42, // feetTopY — 신발이 발목선·본체 2줄·밑창 4줄이 되도록
  ground: 45, // groundY — 시안 y46 은 바닥 그림자라 뺐습니다
}

/** 슬롯 사각형 [x0, y0, x1, y1] — 양 끝 포함 */
const SLOT = {
  feet: { z: 20, rect: [10, 42, 21, 45] },
  legs: { z: 30, rect: [10, 37, 21, 45] },
  torso: { z: 40, rect: [5, 25, 26, 37] },
  bag: { z: 50, rect: [3, 25, 28, 40] },
  face: { z: 60, rect: [9, 14, 22, 18] },
  hat: { z: 70, rect: [5, 8, 26, 14] },
}

/* 상의가 덮는 폭 — 시안 몸통은 팔까지 x5-26 입니다 (기존 x10-21 의 약 두 배) */
const CLOTH_FRONT = [5, 26] // down / up
/* 옆모습은 정면을 눌러 만들지 않고 얼굴만 옮겨 만듭니다(derive-frames.mjs).
   그래서 네 방향의 몸 폭이 같고, 옷도 같은 폭을 씁니다. */
const CLOTH_SIDE = [5, 26] // left / right

/* 하의·신발이 덮는 폭 — 다리는 몸통보다 좁습니다 */
const LEG_FRONT = [10, 21]
const LEG_SIDE = [10, 21]

const isSide = (dir) => dir === 'left' || dir === 'right'
const clothX = (dir) => (isSide(dir) ? CLOTH_SIDE : CLOTH_FRONT)
const legX = (dir) => (isSide(dir) ? LEG_SIDE : LEG_FRONT)

/**
 * 팔 자리. 시안의 팔은 1px 이 아니라 4px 짜리 덩어리라
 * 예전처럼 기둥 한 줄이 아니라 구간을 돌려줍니다.
 * 몸통과 팔의 경계선은 x10 · x21 입니다 (거북이 시안에서 확인).
 */
function armCols(dir) {
  const [x0, x1] = clothX(dir)
  if (dir === 'right') return [x1 - 4, x1 - 3, x1 - 2, x1 - 1]
  if (dir === 'left') return [x0 + 1, x0 + 2, x0 + 3, x0 + 4]
  return [x0 + 1, x0 + 2, x0 + 3, x0 + 4, x1 - 4, x1 - 3, x1 - 2, x1 - 1]
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. 팔레트 — docs/item-spec.md §8. 문자 하나 = 색 하나. null 은 투명
//    '#' '%' 는 과잠 마스크 자리표시자라 팔레트 밖입니다.
// ─────────────────────────────────────────────────────────────────────────────

const PALETTE = {
  O: '#2b2438', // 아웃라인 — 캐릭터와 공용
  E: '#eae6de', // 밝은 천
  e: '#bdb7ae', // 밝은 천 그늘
  N: '#6b7385', // 중간 회청
  n: '#454c5c', // 짙은 회청
  J: '#46628f', // 파랑
  j: '#32486b', // 파랑 그늘
  D: '#b8503f', // 빨강
  d: '#8a3a2d', // 빨강 그늘
  G: '#5b8f5c', // 초록
  B: '#d9a441', // 카키·금
  H: '#6b4a35', // 갈색
}

const MASK = '#' // 학교 색이 들어갈 자리
const MASK_SHADE = '%' // 학교 색 그늘

/** 마네킹 전용. 아이템 팔레트 검사에서 제외됩니다. */
const SKIN = '#f6cda6'
const SKIN_SHADE = '#d9a87e'
const BODY_TOP = '#eae6de'
const BODY_TOP_SHADE = '#bdb7ae'
const BODY_LEG = '#4b5a80'
const BODY_SHOE = '#6b4a35'
const HEAD = '#69bf6a'
const HEAD_SHADE = '#3f8f57'
const EYE = '#ffffff'

const hex = (s) => [
  parseInt(s.slice(1, 3), 16),
  parseInt(s.slice(3, 5), 16),
  parseInt(s.slice(5, 7), 16),
  255,
]

const darken = (rgb, k) => [
  Math.round(rgb[0] * k),
  Math.round(rgb[1] * k),
  Math.round(rgb[2] * k),
  255,
]

// ─────────────────────────────────────────────────────────────────────────────
// 3. PNG 인코더 (scripts/build-sprite-template.mjs 와 동일 — 의존성 없음)
// ─────────────────────────────────────────────────────────────────────────────

const CRC = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

const crc32 = (buf) => {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

class Canvas {
  constructor(w, h) {
    this.w = w
    this.h = h
    this.px = Buffer.alloc(w * h * 4, 0)
  }
  set(x, y, c) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const i = (y * this.w + x) * 4
    this.px[i] = c[0]
    this.px[i + 1] = c[1]
    this.px[i + 2] = c[2]
    this.px[i + 3] = c[3] ?? 255
  }
  toPNG() {
    const stride = this.w * 4 + 1
    const raw = Buffer.alloc(stride * this.h)
    for (let y = 0; y < this.h; y++) {
      raw[y * stride] = 0
      this.px.copy(raw, y * stride + 1, y * this.w * 4, (y + 1) * this.w * 4)
    }
    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(this.w, 0)
    ihdr.writeUInt32BE(this.h, 4)
    ihdr[8] = 8
    ihdr[9] = 6
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ])
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Sprite — 32x48 한 장. 색이 아니라 "팔레트 문자"를 담습니다.
//    (과잠 base/mask 를 같은 그림에서 갈라 내려면 문자로 들고 있어야 합니다)
// ─────────────────────────────────────────────────────────────────────────────

class Sprite {
  constructor() {
    this.d = new Array(FRAME_W * FRAME_H).fill(null)
  }
  set(x, y, k) {
    if (k == null) return
    if (x < 0 || y < 0 || x >= FRAME_W || y >= FRAME_H)
      throw new Error(`캔버스 이탈: (${x}, ${y})`)
    this.d[y * FRAME_W + x] = k
  }
  clear(x, y) {
    if (x < 0 || y < 0 || x >= FRAME_W || y >= FRAME_H) return
    this.d[y * FRAME_W + x] = null
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= FRAME_W || y >= FRAME_H) return null
    return this.d[y * FRAME_W + x]
  }
  /** x0..x1 (양 끝 포함) 가로줄 */
  hspan(x0, x1, y, k) {
    for (let x = x0; x <= x1; x++) this.set(x, y, k)
  }
  vspan(x, y0, y1, k) {
    for (let y = y0; y <= y1; y++) this.set(x, y, k)
  }
  box(x0, y0, x1, y1, k) {
    for (let y = y0; y <= y1; y++) this.hspan(x0, x1, y, k)
  }
  /** 대칭축 x15.5 기준 좌우반전 */
  mirror() {
    const s = new Sprite()
    for (let y = 0; y < FRAME_H; y++)
      for (let x = 0; x < FRAME_W; x++) s.d[y * FRAME_W + (FRAME_W - 1 - x)] = this.d[y * FRAME_W + x]
    return s
  }
  count() {
    return this.d.reduce((n, k) => n + (k ? 1 : 0), 0)
  }
}

/** right 를 그리고 left 는 뒤집어서 만듭니다 — 좌우가 어긋날 수 없습니다. */
function fourWay(draw) {
  const f = { right: draw('right'), up: draw('up'), down: draw('down') }
  f.left = f.right.mirror()
  return f
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. 렌더 모드 — 같은 Sprite 에서 flat / base / mask 세 가지를 뽑습니다
// ─────────────────────────────────────────────────────────────────────────────

const MODE = {
  /** 과잠이 아닌 보통 아이템. 마스크 문자가 있으면 학교 색으로 채웁니다 */
  flat: (schoolHex) => (k) => {
    if (k === MASK) return hex(schoolHex)
    if (k === MASK_SHADE) return darken(hex(schoolHex), 0.69)
    return PALETTE[k] ? hex(PALETTE[k]) : null
  },
  /** 학교 색이 아닌 부분만 */
  base: () => (k) => (k === MASK || k === MASK_SHADE ? null : PALETTE[k] ? hex(PALETTE[k]) : null),
  /** 학교 색이 들어갈 부분만. 회색 2단계 → 곱셈하면 명암이 따라옵니다 */
  mask: () => (k) =>
    k === MASK ? [255, 255, 255, 255] : k === MASK_SHADE ? [176, 176, 176, 255] : null,
}

function sheet(frames, resolve) {
  const cv = new Canvas(FRAME_W * DIRS.length, FRAME_H)
  DIRS.forEach((dir, i) => {
    const s = frames[dir]
    for (let y = 0; y < FRAME_H; y++)
      for (let x = 0; x < FRAME_W; x++) {
        const c = resolve(s.get(x, y))
        if (c) cv.set(i * FRAME_W + x, y, c)
      }
  })
  return cv
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. 상의 — docs/item-spec.md §3
//
//    골격은 공통이고 style 마다 detail() 만 다릅니다.
//    손(y33-34) 팔 기둥은 절대 찍지 않습니다.
// ─────────────────────────────────────────────────────────────────────────────

function topFrame(dir, spec) {
  const s = new Sprite()
  const [x0, x1] = clothX(dir)
  const arms = armCols(dir)
  const isArm = (x) => arms.includes(x)
  const shadeCol = isSide(dir) ? x0 + 5 : x1 - 6 // 몸통 안쪽 (팔 구간을 피해서)

  // 소매 폭. 몸통의 팔은 1px 이지만 옷소매는 더 두꺼워도 됩니다.
  // 과잠처럼 소매 색이 정체성인 옷은 2px 로 넓혀야 알아볼 수 있습니다.
  const sleeveW = spec.sleeveW ?? 1
  const sleeveEnd = spec.sleeve === 'short' ? Y.upper1 : Y.fore1
  const sleeveCols = new Set()
  for (const a of arms) {
    const inward = a < 16 ? 1 : -1
    for (let i = 0; i < sleeveW; i++) sleeveCols.add(a + inward * i)
  }

  // 어깨 — 아웃라인 1px 안쪽으로
  s.hspan(x0 + 1, x1 - 1, Y.shoulder, 'O')

  for (let y = Y.collar; y <= Y.belt; y++) {
    s.set(x0, y, 'O')
    s.set(x1, y, 'O')
    const onSleeve = y >= Y.upper0 && y <= sleeveEnd

    for (let x = x0 + 1; x <= x1 - 1; x++) {
      if (isArm(x)) {
        if (y >= Y.hand0 && y <= Y.hand1) continue // 손 — 항상 비움
        if (spec.sleeve === 'short' && y >= Y.fore0 && y <= Y.fore1) continue // 팔뚝
        s.set(x, y, onSleeve ? spec.sleeveC : spec.base)
      } else if (onSleeve && sleeveCols.has(x)) {
        s.set(x, y, spec.sleeveC)
      } else {
        s.set(x, y, x === shadeCol && y > Y.collar ? spec.bodyShade : spec.base)
      }
    }
  }

  spec.detail?.(s, { dir, x0, x1, arms, shadeCol, sleeveCols, spec })
  return s
}

const TOPS = {
  varsity: {
    label: '과잠',
    mask: true,
    base: MASK,
    bodyShade: MASK_SHADE,
    sleeveC: 'E',
    sleeveW: 2, // 흰 소매가 과잠의 정체성 — 1px 이면 알아볼 수 없습니다
    sleeve: 'long',
    detail(s, { dir, x0, x1, arms, sleeveCols }) {
      // 립 칼라 · 립 밑단 — 과잠의 흰 띠
      s.hspan(x0 + 1, x1 - 1, Y.collar, 'E')
      s.hspan(x0 + 1, x1 - 1, Y.belt, 'E')
      // 소매 커프스 · 어깨 이음선
      for (const c of sleeveCols) {
        s.set(c, Y.fore1, 'e')
        s.set(c, Y.upper0, 'e')
      }
      for (const a of arms) if (a >= 0) s.clear(a, Y.hand0), s.clear(a, Y.hand1)

      if (dir === 'down') {
        s.vspan(15, Y.collar + 1, Y.belt - 1, MASK_SHADE) // 앞섶
        s.set(16, Y.upper1, 'E') // 스냅 단추
        s.set(16, Y.hand0, 'E')
      } else if (dir === 'up') {
        // 등판 엠블럼 — 4px 폭에 글자는 안 들어가므로 테두리 있는 패치로
        s.box(14, Y.upper0 + 1, 17, Y.fore1, 'E')
        s.box(15, Y.upper0 + 2, 16, Y.fore1 - 1, MASK)
      }
    },
  },
  hoodie: {
    label: '후드티',
    base: 'N',
    bodyShade: 'n',
    sleeveC: 'n',
    sleeve: 'long',
    detail(s, { dir, x0, x1 }) {
      // 목 뒤로 접힌 후드
      s.hspan(x0 + 1, x1 - 1, Y.collar, 'n')
      if (dir === 'up') {
        s.hspan(x0 + 1, x1 - 1, Y.upper0, 'n') // 뒷면은 후드가 더 두툼하다
        s.hspan(x0 + 2, x1 - 2, Y.upper0 + 1, 'n')
      }
      if (dir === 'down') {
        s.set(14, Y.upper0, 'E') // 조임끈
        s.set(17, Y.upper0, 'E')
        s.set(14, Y.upper0 + 1, 'E')
        s.set(17, Y.upper0 + 1, 'E')
        s.box(13, Y.waist0, 18, Y.waist1, 'n') // 배 주머니
      }
      s.hspan(x0 + 1, x1 - 1, Y.belt, 'n') // 립 밑단
    },
  },
  shirt: {
    label: '셔츠',
    base: 'E',
    bodyShade: 'e',
    sleeveC: 'e',
    sleeve: 'long',
    detail(s, { dir, x0, x1 }) {
      if (dir === 'down') {
        s.set(13, Y.collar, 'O') // 깃
        s.set(18, Y.collar, 'O')
        s.set(14, Y.collar, 'e')
        s.set(17, Y.collar, 'e')
        s.vspan(15, Y.collar + 1, Y.belt - 1, 'e') // 앞단
        s.set(16, Y.upper1, 'O') // 단추
        s.set(16, Y.waist0, 'O')
      } else if (dir === 'up') {
        s.hspan(13, 18, Y.collar, 'e') // 뒷깃
        s.hspan(x0 + 2, x1 - 2, Y.upper0, 'e') // 요크
      } else {
        s.set(x1 - 3, Y.collar, 'O')
        s.set(x1 - 4, Y.collar, 'e')
      }
    },
  },
  tee: {
    label: '반팔티',
    base: 'D',
    bodyShade: 'd',
    sleeveC: 'd',
    sleeve: 'short',
    detail(s, { dir, x0, x1, arms }) {
      s.hspan(x0 + 2, x1 - 2, Y.collar, 'd') // 목 시보리
      for (const a of arms) s.set(a, Y.upper1, 'd') // 소매 끝단
      if (dir === 'down') s.box(14, Y.upper1, 17, Y.fore1, 'E') // 가슴 프린트
      if (dir === 'up') s.hspan(13, 18, Y.upper0, 'd')
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. 하의 — 벨트(37)부터. 긴바지는 신발 윗줄(44)까지 덮습니다.
// ─────────────────────────────────────────────────────────────────────────────

function bottomFrame(dir, spec) {
  const s = new Sprite()
  const [x0, x1] = legX(dir)
  const hem = spec.length === 'long' ? Y.feet0 - 1 : Y.leg0 + 2 // 긴바지 42 / 반바지 40
  const split = Y.leg0 + 2 // 40 부터 두 갈래

  for (let y = Y.belt; y <= hem; y++) {
    s.set(x0, y, 'O')
    s.set(x1, y, 'O')
    for (let x = x0 + 1; x <= x1 - 1; x++) s.set(x, y, spec.base)
  }

  if (!isSide(dir)) {
    // 가랑이 — 정면·뒷면만 두 갈래로 쪼갠다
    for (let y = split; y <= hem; y++) {
      s.set(15, y, 'O')
      s.set(16, y, 'O')
    }
  }

  // 허리춤 (상의가 덮지만 짧은 상의를 대비해 그려 둔다)
  s.hspan(x0 + 1, x1 - 1, Y.belt, spec.shade)
  // 밑단
  s.hspan(x0 + 1, x1 - 1, hem, spec.shade)

  spec.detail?.(s, { dir, x0, x1, hem, split, spec })
  return s
}

const BOTTOMS = {
  jeans: {
    label: '청바지',
    base: 'J',
    shade: 'j',
    length: 'long',
    detail(s, { dir, x0, x1 }) {
      if (dir === 'down') {
        s.set(12, Y.leg0, 'j') // 주머니
        s.set(19, Y.leg0, 'j')
        s.set(12, Y.leg0 + 1, 'j')
        s.set(19, Y.leg0 + 1, 'j')
      }
      if (dir === 'up') {
        s.box(12, Y.leg0, 13, Y.leg0 + 1, 'j') // 뒷주머니
        s.box(18, Y.leg0, 19, Y.leg0 + 1, 'j')
      }
      if (isSide(dir)) s.vspan(x1 - 1, Y.leg0, Y.leg1, 'j') // 옆선
    },
  },
  trainers: {
    label: '트레이닝복',
    base: 'N',
    shade: 'n',
    length: 'long',
    detail(s, { dir, x0, x1, hem }) {
      // 옆줄 — 트레이닝복의 상징
      if (isSide(dir)) {
        s.vspan(x1 - 1, Y.belt + 1, hem - 1, 'E')
      } else {
        s.vspan(x0 + 1, Y.belt + 1, hem - 1, 'E')
        s.vspan(x1 - 1, Y.belt + 1, hem - 1, 'E')
      }
      s.hspan(x0 + 1, x1 - 1, hem, 'n') // 발목 시보리
      s.hspan(x0 + 1, x1 - 1, hem - 1, 'n')
    },
  },
  slacks: {
    label: '슬랙스',
    base: 'n',
    shade: 'O',
    length: 'long',
    detail(s, { dir, x0, x1 }) {
      // 주름 한 줄
      if (!isSide(dir)) {
        s.vspan(13, Y.leg0 + 1, Y.feet0 - 1, 'N')
        s.vspan(18, Y.leg0 + 1, Y.feet0 - 1, 'N')
      } else {
        s.vspan(x0 + 2, Y.leg0 + 1, Y.feet0 - 1, 'N')
      }
    },
  },
  shorts: {
    label: '반바지',
    base: 'B',
    shade: 'H',
    length: 'short',
    detail(s, { dir, x0, x1, hem }) {
      s.hspan(x0 + 1, x1 - 1, hem, 'H') // 접힌 밑단
      if (dir === 'down') {
        s.set(12, Y.leg0 + 1, 'H')
        s.set(19, Y.leg0 + 1, 'H')
      }
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. 신발 — y44..47. 하의가 윗줄을 덮습니다.
// ─────────────────────────────────────────────────────────────────────────────

function shoeFrame(dir, spec) {
  const s = new Sprite()
  const top = Y.feet0 + (spec.open ? 1 : 0) // 슬리퍼는 발목이 없다

  if (isSide(dir)) {
    // 옆모습 — 앞코가 진행방향으로 나온다
    s.hspan(13, 17, top, 'O')
    for (let y = top + 1; y <= Y.ground - 1; y++) {
      s.set(11, y, 'O')
      for (let x = 12; x <= 18; x++) s.set(x, y, spec.base)
      s.set(19, y, spec.base)
      s.set(20, y, 'O')
    }
    s.hspan(11, 20, Y.ground, 'O') // 밑창
    spec.detail?.(s, { dir, spec, top })
    return s
  }

  // 정면·뒷면 — 두 짝
  for (const [a, b] of [
    [10, 14],
    [17, 21],
  ]) {
    s.hspan(a + 1, b - 1, top, 'O') // 발목 라인
    for (let y = top + 1; y <= Y.ground - 1; y++) {
      s.set(a, y, 'O')
      for (let x = a + 1; x <= b - 1; x++) s.set(x, y, spec.base)
      s.set(b, y, 'O')
    }
    s.hspan(a, b, Y.ground, 'O') // 밑창
  }
  spec.detail?.(s, { dir, spec, top })
  return s
}

const SHOES = {
  sneakers: {
    label: '운동화',
    base: 'E',
    detail(s, { dir, top }) {
      if (isSide(dir)) {
        s.hspan(12, 16, top + 1, 'D') // 사선 스트라이프
        s.set(17, top + 2, 'D')
        s.set(18, top + 2, 'D')
      } else {
        for (const [a, b] of [
          [10, 14],
          [17, 21],
        ]) {
          s.set(a + 2, top + 1, 'D')
          s.set(b - 2, top + 1, 'D')
        }
      }
    },
  },
  slippers: {
    label: '슬리퍼',
    base: 'n', // 반바지(카키)와 색이 겹치면 다리와 발이 한 덩어리로 보입니다
    detail(s, { dir, top }) {
      // 삼선 슬리퍼 — 흰 줄은 긴바지를 입어도 보이도록 y45 에 둡니다
      if (isSide(dir)) {
        s.hspan(12, 18, top, 'n')
        s.set(13, top + 1, 'E')
        s.set(15, top + 1, 'E')
        s.set(17, top + 1, 'E')
      } else {
        for (const [a, b] of [
          [10, 14],
          [17, 21],
        ]) {
          s.hspan(a + 1, b - 1, top, 'n')
          s.set(a + 1, top + 1, 'E')
          s.set(a + 3, top + 1, 'E')
        }
      }
    },
  },
  dress: {
    label: '구두',
    base: 'H',
    detail(s, { dir, top }) {
      if (isSide(dir)) {
        s.hspan(12, 15, top + 1, 'O') // 구두끈 자리
        s.set(18, top + 1, 'e') // 앞코 광
        s.set(19, top + 1, 'e')
      } else {
        // 끈은 점 하나로. 줄 전체를 덮으면 긴바지 아래에서 가죽색이 한 줄도 안 남습니다
        for (const [a, b] of [
          [10, 14],
          [17, 21],
        ]) {
          s.set(a + 2, top + 1, 'O') // 끈 매듭
          s.set(a + 1, top + 2, 'e') // 앞코 광
        }
      }
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. 모자 — 목 0 기준 y14..17 안착. y14 위로 절대 못 올라갑니다 (기린 한계).
// ─────────────────────────────────────────────────────────────────────────────

const HATS = {
  grad_cap: {
    label: '학사모',
    frame(dir) {
      const s = new Sprite()
      // 판 — 안착면 맨 윗줄을 꽉 채운다
      s.hspan(10, 21, Y.hatSeat0, 'O')
      s.hspan(11, 20, Y.hatSeat0 + 1, 'O')
      // 두상 덮개
      s.hspan(12, 19, Y.hatSeat0 + 2, 'O')
      s.hspan(12, 19, Y.hatSeat1, 'O')
      s.hspan(13, 18, Y.hatSeat0 + 2, 'n') // 살짝 밝은 면으로 판/모자 구분
      if (dir === 'down') {
        s.set(15, Y.hatSeat0 + 1, 'B') // 가운데 단추
        s.set(16, Y.hatSeat0 + 1, 'B')
        // 술은 안착면 안(y17)까지만. 더 내리면 안경 윗테(y18)를 잘라먹습니다
        s.vspan(20, Y.hatSeat0 + 1, Y.hatSeat1, 'B')
        s.set(21, Y.hatSeat0 + 2, 'B')
      } else if (dir === 'up') {
        s.set(15, Y.hatSeat0 + 1, 'B')
        s.set(16, Y.hatSeat0 + 1, 'B')
        s.vspan(11, Y.hatSeat0 + 1, Y.hatSeat1 + 1, 'B')
      } else {
        s.vspan(11, Y.hatSeat0 + 1, Y.hatHangMax, 'B') // 옆모습은 뒤로 늘어진다
      }
      return s
    },
  },
  cap: {
    label: '볼캡',
    frame(dir) {
      const s = new Sprite()
      s.hspan(12, 19, Y.hatSeat0, 'O')
      s.hspan(11, 20, Y.hatSeat0 + 1, 'O')
      s.hspan(13, 18, Y.hatSeat0, 'D')
      s.hspan(12, 19, Y.hatSeat0 + 1, 'D')
      s.set(11, Y.hatSeat0 + 2, 'O')
      s.set(20, Y.hatSeat0 + 2, 'O')
      s.hspan(12, 19, Y.hatSeat0 + 2, 'D')

      if (dir === 'down') {
        s.hspan(10, 21, Y.hatSeat1, 'd') // 챙이 앞으로 — 정면에선 넓게
        s.set(10, Y.hatSeat1, 'O')
        s.set(21, Y.hatSeat1, 'O')
      } else if (dir === 'up') {
        s.hspan(11, 20, Y.hatSeat1, 'D')
        s.set(15, Y.hatSeat1, 'e') // 뒤 조절 스트랩
        s.set(16, Y.hatSeat1, 'e')
      } else {
        s.hspan(12, 20, Y.hatSeat1, 'd') // 옆모습 — 챙이 보는 쪽으로
        s.set(21, Y.hatSeat1, 'O')
        s.set(11, Y.hatSeat1, 'O')
      }
      return s
    },
  },
  beanie: {
    label: '비니',
    frame(dir) {
      const s = new Sprite()
      s.hspan(12, 19, Y.hatSeat0, 'O')
      s.hspan(13, 18, Y.hatSeat0, 'J')
      s.set(11, Y.hatSeat0 + 1, 'O')
      s.set(20, Y.hatSeat0 + 1, 'O')
      s.hspan(12, 19, Y.hatSeat0 + 1, 'J')
      s.set(11, Y.hatSeat0 + 2, 'O')
      s.set(20, Y.hatSeat0 + 2, 'O')
      s.hspan(12, 19, Y.hatSeat0 + 2, 'J')
      // 접단 — 안착면보다 1px 넓다
      s.hspan(10, 21, Y.hatSeat1, 'j')
      s.set(10, Y.hatSeat1, 'O')
      s.set(21, Y.hatSeat1, 'O')
      if (dir !== 'up') {
        s.set(14, Y.hatSeat0 + 1, 'j') // 뜨개 무늬
        s.set(17, Y.hatSeat0 + 2, 'j')
      }
      return s
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. 안경 — y18..20. 모자 안착면(14-17)과 겹치지 않습니다.
// ─────────────────────────────────────────────────────────────────────────────

/** 뒷모습은 관자놀이에 걸린 다리만 보입니다 */
function templesOnly(s, k) {
  s.set(10, Y.face0 + 1, k)
  s.set(11, Y.face0 + 1, k)
  s.set(20, Y.face0 + 1, k)
  s.set(21, Y.face0 + 1, k)
}

const GLASSES = {
  horn: {
    label: '뿔테',
    frame(dir) {
      const s = new Sprite()
      if (dir === 'up') return templesOnly(s, 'O'), s
      if (isSide(dir)) {
        s.hspan(13, 17, Y.face0, 'O') // 두꺼운 윗테
        s.set(13, Y.face0 + 1, 'O')
        s.set(17, Y.face0 + 1, 'O')
        s.hspan(14, 16, Y.face0 + 1, 'E')
        s.hspan(14, 17, Y.face1, 'O')
        s.hspan(18, 20, Y.face0, 'O') // 안경다리
        return s
      }
      s.hspan(10, 21, Y.face0, 'O') // 뿔테 — 윗테가 눈썹처럼 굵다
      s.set(11, Y.face0 + 1, 'O')
      s.set(14, Y.face0 + 1, 'O')
      s.set(17, Y.face0 + 1, 'O')
      s.set(20, Y.face0 + 1, 'O')
      s.hspan(12, 13, Y.face0 + 1, 'E')
      s.hspan(18, 19, Y.face0 + 1, 'E')
      s.set(15, Y.face0 + 1, 'O') // 브리지
      s.set(16, Y.face0 + 1, 'O')
      s.hspan(12, 13, Y.face1, 'O')
      s.hspan(18, 19, Y.face1, 'O')
      return s
    },
  },
  round: {
    label: '동그란테',
    frame(dir) {
      const s = new Sprite()
      if (dir === 'up') return templesOnly(s, 'H'), s
      if (isSide(dir)) {
        s.hspan(14, 16, Y.face0, 'H')
        s.set(13, Y.face0 + 1, 'H')
        s.set(17, Y.face0 + 1, 'H')
        s.hspan(14, 16, Y.face0 + 1, 'E')
        s.hspan(14, 16, Y.face1, 'H')
        s.hspan(18, 20, Y.face0 + 1, 'H')
        return s
      }
      // 동그란 알 두 개 — 모서리를 비워 원형으로 보이게
      for (const a of [11, 17]) {
        s.hspan(a + 1, a + 2, Y.face0, 'H')
        s.set(a, Y.face0 + 1, 'H')
        s.set(a + 3, Y.face0 + 1, 'H')
        s.hspan(a + 1, a + 2, Y.face0 + 1, 'E')
        s.hspan(a + 1, a + 2, Y.face1, 'H')
      }
      s.set(15, Y.face0 + 1, 'H') // 브리지
      s.set(16, Y.face0 + 1, 'H')
      return s
    },
  },
  sunglasses: {
    label: '선글라스',
    frame(dir) {
      const s = new Sprite()
      if (dir === 'up') return templesOnly(s, 'O'), s
      if (isSide(dir)) {
        s.box(13, Y.face0, 17, Y.face0 + 1, 'O')
        s.set(14, Y.face0, 'N') // 반사광
        s.hspan(18, 20, Y.face0, 'O')
        return s
      }
      s.box(11, Y.face0, 14, Y.face0 + 1, 'O') // 알이 꽉 찬 검은 렌즈
      s.box(17, Y.face0, 20, Y.face0 + 1, 'O')
      s.set(15, Y.face0, 'O')
      s.set(16, Y.face0, 'O')
      s.set(12, Y.face0, 'N')
      s.set(18, Y.face0, 'N')
      return s
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. 가방 — z50. 등 뒤로 튀어나오므로 x8..23 을 씁니다.
// ─────────────────────────────────────────────────────────────────────────────

/** 에코백 밑단. 슬롯 아래끝(y42)에 맞춥니다 — 더 내리면 발목을 가립니다 */
const BAG_HEM = SLOT.bag.rect[3]

const BAGS = {
  backpack: {
    label: '백팩',
    frame(dir) {
      const s = new Sprite()
      if (dir === 'up') {
        // 뒷모습 — 가방 본체가 통째로 보인다
        s.hspan(12, 19, Y.collar, 'O')
        for (let y = Y.upper0; y <= Y.waist1 + 2; y++) {
          s.set(11, y, 'O')
          for (let x = 12; x <= 19; x++) s.set(x, y, 'G')
          s.set(20, y, 'O')
        }
        s.hspan(11, 20, Y.waist1 + 3, 'O')
        s.hspan(13, 18, Y.fore1, 'O') // 앞주머니 선
        s.hspan(13, 18, Y.hand0, 'B') // 버클
        return s
      }
      if (dir === 'down') {
        // 정면 — 어깨끈만 보인다
        for (const x of [12, 13, 18, 19]) s.vspan(x, Y.collar, Y.hand1, 'G')
        for (const x of [12, 19]) s.vspan(x, Y.collar, Y.hand1, 'O')
        s.hspan(13, 18, Y.fore0, 'B') // 가슴 스트랩
        return s
      }
      // 옆모습 — 등 뒤로 불룩
      s.hspan(9, 12, Y.upper0 - 1, 'O')
      for (let y = Y.upper0; y <= Y.waist1; y++) {
        s.set(8, y, 'O')
        for (let x = 9; x <= 12; x++) s.set(x, y, 'G')
        s.set(13, y, 'O')
      }
      s.hspan(8, 13, Y.waist1 + 1, 'O')
      s.set(9, Y.fore1, 'B')
      s.vspan(14, Y.collar, Y.fore1, 'G') // 어깨끈
      s.vspan(15, Y.collar, Y.upper1, 'O')
      return s
    },
  },
  tote: {
    label: '에코백',
    frame(dir) {
      const s = new Sprite()
      if (dir === 'down' || dir === 'up') {
        // 한쪽 어깨에 사선으로 멘 끈 + 반대쪽 허리에 걸린 가방
        const strap = [
          [13, Y.collar],
          [13, Y.upper0],
          [14, Y.upper1],
          [15, Y.fore0],
          [16, Y.fore1],
          [17, Y.hand0],
          [17, Y.hand1],
          [18, Y.waist0],
          [18, Y.waist1],
        ]
        for (const [x, y] of strap) s.set(x, y, 'e')
        s.hspan(17, 21, Y.belt, 'O')
        for (let y = Y.leg0; y <= BAG_HEM - 1; y++) {
          s.set(17, y, 'O')
          for (let x = 18; x <= 21; x++) s.set(x, y, 'E')
          s.set(22, y, 'O')
        }
        s.hspan(17, 22, BAG_HEM, 'O')
        if (dir === 'down') s.box(19, Y.leg0 + 1, 20, Y.leg0 + 2, 'G') // 프린트
        return s
      }
      // 옆모습 — 가방이 몸 앞뒤로 살짝 나온다
      s.vspan(14, Y.collar, Y.upper1, 'e') // 어깨끈
      s.vspan(14, Y.fore0, Y.waist1, 'e')
      s.hspan(12, 17, Y.belt, 'O')
      for (let y = Y.leg0; y <= BAG_HEM - 1; y++) {
        s.set(11, y, 'O')
        for (let x = 12; x <= 17; x++) s.set(x, y, 'E')
        s.set(18, y, 'O')
      }
      s.hspan(11, 18, BAG_HEM, 'O')
      s.set(13, Y.leg0 + 1, 'e')
      return s
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. 검사용 마네킹 — 실제 캐릭터가 아닙니다 (docs/item-spec.md §11)
//     이 규격대로 그린 32x48 몸통이라, 아이템을 겹쳐 어긋나는지 셀 수 있습니다.
// ─────────────────────────────────────────────────────────────────────────────

function mannequinFrame(dir) {
  const s = new Sprite()
  const [x0, x1] = clothX(dir)
  const arms = armCols(dir)
  const O = 'O'
  const put = (x, y, c) => s.set(x, y, c) // 마네킹은 실제 색을 직접 담는다

  // ── 머리 (목 0 종 기준: y14..25)
  //    맨 위 4줄(모자 안착면)은 x11..20 으로 평평해야 합니다 — 상위 규격 §6.
  //    그래서 머리가 각져 보이는 것은 의도한 것입니다. 둥글리면 모자가 뜹니다.
  s.hspan(11, 20, Y.headTop0, O)
  for (let y = Y.headTop0 + 1; y <= Y.headBottom - 1; y++) {
    put(11, y, O)
    for (let x = 12; x <= 19; x++) put(x, y, y > Y.headBottom - 4 ? HEAD_SHADE : HEAD)
    put(20, y, O)
  }
  s.hspan(12, 19, Y.headBottom, O)
  // 눈 — y18 부터 2줄 (item-spec §6)
  if (dir !== 'up') {
    if (isSide(dir)) {
      put(16, Y.eyeTop, EYE)
      put(17, Y.eyeTop, EYE)
      put(16, Y.eyeTop + 1, O)
    } else {
      put(13, Y.eyeTop, EYE)
      put(14, Y.eyeTop, EYE)
      put(17, Y.eyeTop, EYE)
      put(18, Y.eyeTop, EYE)
      put(13, Y.eyeTop + 1, O)
      put(18, Y.eyeTop + 1, O)
    }
  }

  // ── 몸통 (기본 상의 + 팔 기둥)
  s.hspan(x0 + 1, x1 - 1, Y.shoulder, O)
  for (let y = Y.collar; y <= Y.belt; y++) {
    put(x0, y, O)
    put(x1, y, O)
    for (let x = x0 + 1; x <= x1 - 1; x++) {
      if (arms.includes(x)) {
        // item-spec §3: 소매 / 팔뚝(맨살) / 손(맨살)
        if (y >= Y.hand0 && y <= Y.hand1) put(x, y, SKIN)
        else if (y >= Y.fore0 && y <= Y.fore1) put(x, y, SKIN_SHADE)
        else if (y >= Y.upper0) put(x, y, BODY_TOP_SHADE)
        else put(x, y, BODY_TOP)
      } else {
        put(x, y, BODY_TOP)
      }
    }
  }
  s.hspan(x0 + 1, x1 - 1, Y.belt, BODY_TOP_SHADE)

  // ── 다리
  for (let y = Y.leg0; y <= Y.leg1; y++) {
    put(x0, y, O)
    put(x1, y, O)
    for (let x = x0 + 1; x <= x1 - 1; x++) put(x, y, y >= Y.leg0 + 2 ? SKIN : BODY_LEG)
    if (!isSide(dir) && y >= Y.leg0 + 2) {
      put(15, y, O)
      put(16, y, O)
    }
  }

  // ── 발
  if (isSide(dir)) {
    for (let y = Y.feet0; y <= Y.ground - 1; y++) {
      put(11, y, O)
      for (let x = 12; x <= 19; x++) put(x, y, BODY_SHOE)
      put(20, y, O)
    }
    s.hspan(11, 20, Y.ground, O)
  } else {
    for (const [a, b] of [
      [10, 14],
      [17, 21],
    ]) {
      for (let y = Y.feet0; y <= Y.ground - 1; y++) {
        put(a, y, O)
        for (let x = a + 1; x <= b - 1; x++) put(x, y, BODY_SHOE)
        put(b, y, O)
      }
      s.hspan(a, b, Y.ground, O)
    }
  }
  return s
}

/** 마네킹은 팔레트 문자가 아니라 '#rrggbb' 를 직접 담습니다 */
const mannequinResolve = (k) => (k ? (k === 'O' ? hex(PALETTE.O) : hex(k)) : null)

// ─────────────────────────────────────────────────────────────────────────────
// 13. 검사
// ─────────────────────────────────────────────────────────────────────────────

const errors = []
const fail = (msg) => errors.push(msg)

/** 상위 규격(layout.json)과 어긋나면 여기서 잡습니다 */
function checkAgainstLayout() {
  let L
  try {
    L = JSON.parse(readFileSync(LAYOUT_JSON, 'utf8'))
  } catch {
    fail(`layout.json 을 읽을 수 없습니다: ${LAYOUT_JSON}`)
    return
  }
  const eq = (name, got, want) => {
    if (JSON.stringify(got) !== JSON.stringify(want))
      fail(`규격 드리프트 — ${name}: build-items=${JSON.stringify(got)} layout.json=${JSON.stringify(want)}`)
  }
  eq('frame.w', FRAME_W, L.frame.w)
  eq('frame.h', FRAME_H, L.frame.h)
  eq('timerReserve', Y.timerReserve, L.timerReserve)
  eq('headTopY0', Y.headTop0, L.headTopY0)
  eq('headBottomY', Y.headBottom, L.headBottomY)
  eq('attachY', Y.shoulder, L.attachY)
  eq('beltY', Y.belt, L.beltY)
  eq('feetTopY', Y.feet0, L.feetTopY)
  eq('groundY', Y.ground, L.groundY)
  eq('clothX', CLOTH_FRONT, L.clothX)
  eq('slots.torso', SLOT.torso.rect, L.slots.torso.rect)
  eq('slots.legs', SLOT.legs.rect, L.slots.legs.rect)
  eq('slots.feet', SLOT.feet.rect, L.slots.feet.rect)
  // 모자 안착면 폭은 hatSeatX 와 hatSeatRows 로 검사
  eq('hatSeatRows', Y.hatSeat1 - Y.hatSeat0 + 1, L.hatSeatRows)
  const [hx0, hx1] = L.hatSeatX
  if (hx0 < SLOT.hat.rect[0] || hx1 > SLOT.hat.rect[2])
    fail(`모자 안착면 ${L.hatSeatX} 가 hat 슬롯 ${SLOT.hat.rect} 밖입니다`)
  // 기린 한계 재확인
  const worst = Math.min(...L.species.map((sp) => sp.headTopY))
  if (Y.hatSeat0 - (Y.headTop0 - worst) - 1 < Y.timerReserve)
    fail(`모자가 타이머 예약을 침범합니다 (최악 종 headTopY=${worst})`)
}

function checkItem(name, slot, frames) {
  const [rx0, ry0, rx1, ry1] = SLOT[slot].rect
  for (const dir of DIRS) {
    const s = frames[dir]
    for (let y = 0; y < FRAME_H; y++)
      for (let x = 0; x < FRAME_W; x++) {
        const k = s.get(x, y)
        if (!k) continue
        if (y < Y.timerReserve) fail(`${name}/${dir}: 타이머 예약 침범 (${x},${y})`)
        if (x < rx0 || x > rx1 || y < ry0 || y > ry1)
          fail(`${name}/${dir}: ${slot} 슬롯 [${rx0},${ry0}-${rx1},${ry1}] 밖 (${x},${y})`)
        if (k !== MASK && k !== MASK_SHADE && !PALETTE[k])
          fail(`${name}/${dir}: 팔레트 밖 색 '${k}' (${x},${y})`)
      }
    if (slot === 'hat')
      for (let x = 0; x < FRAME_W; x++)
        for (let y = 0; y < Y.hatSeat0; y++)
          if (s.get(x, y)) fail(`${name}/${dir}: 모자가 y${y} — y${Y.hatSeat0} 위는 기린이 타이머를 침범합니다`)
    if (slot === 'torso')
      for (const a of armCols(dir))
        for (let y = Y.hand0; y <= Y.hand1; y++)
          if (s.get(a, y)) fail(`${name}/${dir}: 상의가 손을 덮었습니다 (${a},${y})`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. 겹침 테스트 — 마네킹 위에 실제로 합성해서 셉니다 (docs/item-spec.md §11)
// ─────────────────────────────────────────────────────────────────────────────

function composite(mannequin, layers, dir) {
  const out = new Sprite()
  for (let y = 0; y < FRAME_H; y++)
    for (let x = 0; x < FRAME_W; x++) out.d[y * FRAME_W + x] = mannequin[dir].get(x, y)
  for (const { frames } of layers.sort((a, b) => a.z - b.z))
    for (let y = 0; y < FRAME_H; y++)
      for (let x = 0; x < FRAME_W; x++) {
        const k = frames[dir].get(x, y)
        if (k) out.d[y * FRAME_W + x] = k
      }
  return out
}

/* ───────────────────────────────────────────────────────────────────────────
   종별 맞춤 — 옷을 몸 실루엣 안으로 깎습니다.

   상의는 x5-26 사각형으로 그려집니다. 그런데 시안 8종은 어깨 높이와 몸통
   폭이 제각각이라(목 긴 종은 어깨가 8줄 아래에서 시작합니다) 그대로 얹으면
   소매가 몸 밖으로 판때기처럼 튀어나옵니다.

   그래서 옷 한 벌만 그려두고, 종마다 그 종의 몸 실루엣으로 깎아 냅니다.
   잘린 자리에는 테두리를 다시 칠합니다 — 안 그러면 단면이 속살처럼 보입니다.

   하의·신발·모자·안경은 8종이 이미 같은 자리라 깎지 않습니다.
   ─────────────────────────────────────────────────────────────────────────── */
function fitToSilhouette(frame, mask) {
  const out = new Sprite()
  const inside = (x, y) => {
    const r = mask[y]
    return !!r && x >= r[0] && x <= r[1]
  }
  for (let y = 0; y < FRAME_H; y++)
    for (let x = 0; x < FRAME_W; x++) {
      const k = frame.get(x, y)
      if (k && inside(x, y)) out.set(x, y, k)
    }
  // 잘린 가장자리에 테두리를 다시
  for (let y = 0; y < FRAME_H; y++)
    for (let x = 0; x < FRAME_W; x++) {
      if (!out.get(x, y)) continue
      const cut = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => {
        const nx = x + dx, ny = y + dy
        return frame.get(nx, ny) && !inside(nx, ny)
      })
      if (cut) out.set(x, y, 'O')
    }
  return out
}

function overlapTest(mannequin, items) {
  const results = []
  const check = (name, ok, detail) => results.push({ name, ok, detail })
  const L = (slot, id) => ({ z: SLOT[slot].z, frames: items[slot][id].frames })

  /* 4방향 팔 자리의 총 픽셀 수.
     예전엔 팔이 1px 기둥이고 손이 2줄이라 곱하기 2 가 박혀 있었는데,
     시안 팔은 4px 이고 손·팔뚝도 3줄이라 구간 길이에서 계산합니다. */
  const armW = DIRS.reduce((n, d) => n + armCols(d).length, 0)
  const handPixels = armW * (Y.hand1 - Y.hand0 + 1)
  const forePixels = armW * (Y.fore1 - Y.fore0 + 1)

  // ── 손 노출: 긴팔을 입어도 마네킹 손이 남아 있어야 한다
  for (const id of ['varsity', 'hoodie', 'shirt']) {
    let visible = 0
    for (const dir of DIRS) {
      const c = composite(mannequin, [L('torso', id)], dir)
      for (const a of armCols(dir))
        for (let y = Y.hand0; y <= Y.hand1; y++) if (c.get(a, y) === SKIN) visible++
    }
    check(`손 노출 · ${TOPS[id].label}(긴팔)`, visible === handPixels, `손 픽셀 ${visible}/${handPixels}`)
  }

  // ── 팔뚝 노출: 반팔은 팔뚝 맨살이 드러나야 한다
  {
    let bare = 0
    for (const dir of DIRS) {
      const c = composite(mannequin, [L('torso', 'tee')], dir)
      for (const a of armCols(dir))
        for (let y = Y.fore0; y <= Y.fore1; y++) if (c.get(a, y) === SKIN_SHADE) bare++
    }
    check('팔뚝 노출 · 반팔티', bare === forePixels, `팔뚝 맨살 ${bare}/${forePixels}`)
  }

  // ── 어깨 이음: 상의 y26 이 마네킹 어깨선과 같은 x 범위인가
  {
    let bad = []
    for (const id of Object.keys(TOPS))
      for (const dir of DIRS) {
        const span = (s) => {
          const xs = []
          for (let x = 0; x < FRAME_W; x++) if (s.get(x, Y.shoulder)) xs.push(x)
          return xs.length ? [xs[0], xs[xs.length - 1]] : null
        }
        const a = span(items.torso[id].frames[dir])
        const b = span(mannequin[dir])
        if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(`${id}/${dir} ${a}≠${b}`)
      }
    check('어깨 이음 (y26)', bad.length === 0, bad.length ? bad.join(', ') : '상의 4종 x 4방향 일치')
  }

  // ── 허리 이음: y37 에서 상의·하의 사이에 구멍이 없는가
  {
    let holes = []
    for (const t of Object.keys(TOPS))
      for (const b of Object.keys(BOTTOMS))
        for (const dir of DIRS) {
          const c = composite(mannequin, [L('torso', t), L('legs', b)], dir)
          const [x0, x1] = clothX(dir)
          for (let x = x0; x <= x1; x++)
            if (!c.get(x, Y.belt)) holes.push(`${t}+${b}/${dir}@x${x}`)
        }
    check('허리 이음 (y37)', holes.length === 0, holes.length ? holes.slice(0, 4).join(', ') : '16조합 x 4방향 구멍 없음')
  }

  // ── 발목 이음: 긴바지가 신발 윗줄을 덮고, 신발이 최소 2줄 남는가
  {
    let bad = []
    for (const b of ['jeans', 'trainers', 'slacks'])
      for (const sh of Object.keys(SHOES))
        for (const dir of DIRS) {
          const c = composite(mannequin, [L('feet', sh), L('legs', b)], dir)
          let rows = 0
          for (let y = Y.feet0; y <= Y.ground; y++) {
            let seen = false
            for (let x = 0; x < FRAME_W; x++) {
              const k = c.get(x, y)
              if (k && k !== 'O' && k === SHOES[sh].base) seen = true
            }
            if (seen) rows++
          }
          if (rows < 2) bad.push(`${b}+${sh}/${dir} ${rows}줄`)
        }
    check('발목 이음 (긴바지+신발)', bad.length === 0, bad.length ? bad.slice(0, 4).join(', ') : '9조합 x 4방향 신발 2줄 이상 노출')
  }

  // ── 실루엣: 합성 결과 안쪽에 혼자 뚫린 구멍이 없는가
  {
    let holes = []
    const full = (dir) => [
      L('feet', 'sneakers'),
      L('legs', 'jeans'),
      L('torso', 'varsity'),
      L('bag', 'backpack'),
      L('face', 'horn'),
      L('hat', 'cap'),
    ]
    for (const dir of DIRS) {
      const c = composite(mannequin, full(dir), dir)
      for (let y = Y.shoulder; y <= Y.ground; y++)
        for (let x = 1; x < FRAME_W - 1; x++)
          if (!c.get(x, y) && c.get(x - 1, y) && c.get(x + 1, y) && c.get(x, y - 1) && c.get(x, y + 1))
            holes.push(`${dir}(${x},${y})`)
    }
    check('실루엣 구멍', holes.length === 0, holes.length ? holes.slice(0, 6).join(', ') : '풀세트 4방향 구멍 없음')
  }

  // ── 모자·안경 충돌: 모자를 써도 안경이 살아 있는가
  {
    let bad = []
    for (const h of Object.keys(HATS))
      for (const g of Object.keys(GLASSES))
        for (const dir of DIRS) {
          const withG = composite(mannequin, [L('face', g), L('hat', h)], dir)
          let n = 0
          for (let y = Y.face0; y <= Y.face1; y++)
            for (let x = 0; x < FRAME_W; x++)
              if (items.face[g].frames[dir].get(x, y) && withG.get(x, y) === items.face[g].frames[dir].get(x, y)) n++
          const want = items.face[g].frames[dir].count()
          if (n < want) bad.push(`${h}+${g}/${dir} ${n}/${want}`)
        }
    check('모자 밑 안경 생존', bad.length === 0, bad.length ? bad.slice(0, 4).join(', ') : '9조합 x 4방향 안경 온전')
  }

  return results
}

// ─────────────────────────────────────────────────────────────────────────────
// 15. 실행
// ─────────────────────────────────────────────────────────────────────────────

const SCHOOL_PRESETS = {
  red: { label: '빨강', hex: '#c0392b' },
  blue: { label: '파랑', hex: '#2f5aa8' },
  green: { label: '초록', hex: '#2e7d4f' },
}

function main() {
  checkAgainstLayout()
  if (errors.length) {
    console.error('규격 검사 실패:\n' + errors.map((e) => '  - ' + e).join('\n'))
    process.exit(1)
  }

  // 아이템 생성
  const items = { torso: {}, legs: {}, feet: {}, hat: {}, face: {}, bag: {} }
  for (const [id, spec] of Object.entries(TOPS))
    items.torso[id] = { spec, frames: fourWay((d) => topFrame(d, spec)) }
  for (const [id, spec] of Object.entries(BOTTOMS))
    items.legs[id] = { spec, frames: fourWay((d) => bottomFrame(d, spec)) }
  for (const [id, spec] of Object.entries(SHOES))
    items.feet[id] = { spec, frames: fourWay((d) => shoeFrame(d, spec)) }
  for (const [id, spec] of Object.entries(HATS))
    items.hat[id] = { spec, frames: fourWay((d) => spec.frame(d)) }
  for (const [id, spec] of Object.entries(GLASSES))
    items.face[id] = { spec, frames: fourWay((d) => spec.frame(d)) }
  for (const [id, spec] of Object.entries(BAGS))
    items.bag[id] = { spec, frames: fourWay((d) => spec.frame(d)) }

  for (const [slot, group] of Object.entries(items))
    for (const [id, it] of Object.entries(group)) checkItem(id, slot, it.frames)

  if (errors.length) {
    console.error('아이템 검사 실패 — PNG 를 쓰지 않고 멈춥니다:\n' + errors.map((e) => '  - ' + e).join('\n'))
    process.exit(1)
  }

  // 쓰기
  const DIRMAP = { torso: 'tops', legs: 'bottoms', feet: 'shoes', hat: 'hats', face: 'glasses', bag: 'bags' }
  for (const d of Object.values(DIRMAP)) mkdirSync(resolve(OUT, d), { recursive: true })
  mkdirSync(resolve(OUT, '_test'), { recursive: true })

  const written = []
  const put = (folder, file, cv) => {
    writeFileSync(resolve(OUT, folder, file + '.png'), cv.toPNG())
    written.push(`${folder}/${file}.png`)
  }

  /* 종별 실루엣. 파일이 없으면 맞춤 단계를 건너뜁니다 (기존 동작 유지). */
  let SIL = null
  try {
    SIL = JSON.parse(readFileSync(SILHOUETTE_JSON, 'utf8'))
  } catch {
    console.log('  (silhouettes.json 이 없어 종별 맞춤을 건너뜁니다)')
  }
  const FIT_SLOTS = new Set(['torso', 'bag']) // 하의·신발·모자·안경은 8종이 같은 자리
  const putFitted = (slot, folder, file, frames, mode) => {
    if (!SIL || !FIT_SLOTS.has(slot)) return
    for (const [sp, mask] of Object.entries(SIL)) {
      const fitted = {}
      for (const dir of DIRS) fitted[dir] = fitToSilhouette(frames[dir], mask)
      mkdirSync(resolve(OUT, 'fitted', sp, folder), { recursive: true })
      writeFileSync(resolve(OUT, 'fitted', sp, folder, file + '.png'), sheet(fitted, mode).toPNG())
    }
  }

  const manifest = { generated: 'scripts/build-items.mjs', frame: { w: FRAME_W, h: FRAME_H }, dirs: DIRS, slots: SLOT, palette: PALETTE, school: SCHOOL_PRESETS, items: {} }

  for (const [slot, group] of Object.entries(items)) {
    const folder = DIRMAP[slot]
    manifest.items[slot] = []
    for (const [id, it] of Object.entries(group)) {
      if (it.spec.mask) {
        // 과잠 — base + mask + 프리셋 3벌
        put(folder, `${id}_base`, sheet(it.frames, MODE.base()))
        put(folder, `${id}_mask`, sheet(it.frames, MODE.mask()))
        /* 과잠은 학교 색을 코드에서 입히므로 미리 구운 세 벌 말고
           base·mask 자체도 종별로 깎아 둬야 합니다. 안 그러면 월드에서
           과잠만 종 실루엣을 벗어나 소매가 튀어나옵니다. */
        putFitted(slot, folder, `${id}_base`, it.frames, MODE.base())
        putFitted(slot, folder, `${id}_mask`, it.frames, MODE.mask())
        for (const [pid, p] of Object.entries(SCHOOL_PRESETS)) {
          put(folder, `${id}_${pid}`, sheet(it.frames, MODE.flat(p.hex)))
          putFitted(slot, folder, `${id}_${pid}`, it.frames, MODE.flat(p.hex))
          manifest.items[slot].push({
            id: `${id}_${pid}`, label: `${it.spec.label}(${p.label})`, file: `${folder}/${id}_${pid}.png`,
            z: SLOT[slot].z, recolor: { base: `${folder}/${id}_base.png`, mask: `${folder}/${id}_mask.png`, color: p.hex },
          })
        }
      } else {
        put(folder, id, sheet(it.frames, MODE.flat('#ffffff')))
        putFitted(slot, folder, id, it.frames, MODE.flat('#ffffff'))
        manifest.items[slot].push({ id, label: it.spec.label, file: `${folder}/${id}.png`, z: SLOT[slot].z })
      }
    }
  }

  // 마네킹 (검사용)
  const mannequin = fourWay(mannequinFrame)
  writeFileSync(resolve(OUT, '_test/mannequin.png'), sheet(mannequin, mannequinResolve).toPNG())
  written.push('_test/mannequin.png')

  // 겹침 테스트
  const results = overlapTest(mannequin, items)

  writeFileSync(resolve(OUT, 'items.json'), JSON.stringify(manifest, null, 2))
  writeFileSync(resolve(OUT, 'items.js'), `// 자동 생성 — scripts/build-items.mjs\n// preview.html 이 file:// 에서도 읽을 수 있게 JS 로도 냅니다.\nwindow.ITEMS = ${JSON.stringify(manifest, null, 2)}\n`)

  // 보고
  console.log(`\n  아이템 PNG ${written.length - 1}장 + 마네킹 1장`)
  for (const [slot, list] of Object.entries(manifest.items))
    console.log(`    ${DIRMAP[slot].padEnd(8)} ${list.length}종`)
  console.log(`\n  겹침 테스트`)
  let failed = 0
  for (const r of results) {
    if (!r.ok) failed++
    console.log(`    ${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(24)} ${r.detail}`)
  }
  console.log(`\n  ${results.length - failed}/${results.length} 통과`)
  if (failed) process.exit(1)
}

main()

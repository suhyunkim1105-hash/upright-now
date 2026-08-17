#!/usr/bin/env node
/**
 * build-items.mjs — 상점 꾸미기 아이템 픽셀 에셋 생성기
 *
 * 규격: assets/items/item-spec.md  (좌표의 정답은 characters/layout.json)
 * 결과: prototypes/openworld/assets/items/{카테고리}/{이름}.png — 128 x 48 (32x48 x 4방향)
 *       .../items/items.js / items.json      — 매니페스트
 *       .../items/_test/mannequin.png        — 겹침 검사용 마네킹
 *       .../items/fitted/{종}/...            — 종 실루엣에 맞춰 깎은 판
 *
 * 의존성 없음 (node 내장 zlib 로 PNG 를 직접 읽고 씁니다).
 *   node scripts/build-items.mjs
 *
 * 숫자를 바꾸려면 문서가 아니라 아래 Y / SLOT 상수를 고치세요.
 * 시작할 때 layout.json 과 대조해서 어긋나면 멈춥니다.
 *
 * 종 실루엣은 파일로 들고 있지 않고 **캐릭터 시트에서 매번 다시 잽니다.**
 * 예전엔 silhouettes.json 을 옆에 두었는데, 그 파일이 없어지면 맞춤 단계가
 * 조용히 꺼져서 옷이 몸 밖으로 튀어나온 판이 그대로 커밋됐습니다.
 */

import { deflateSync, inflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WORLD = resolve(ROOT, 'prototypes/openworld/assets')
const OUT = resolve(WORLD, 'items')
const CHAR_DIR = resolve(WORLD, 'characters')
const LAYOUT_JSON = resolve(CHAR_DIR, 'layout.json')

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

  /* 팔 좌표는 마네킹이 아니라 **실제 시안 8종에서 재서** 정했습니다.
     예전 값(소매 27-29 / 팔뚝 30-32 / 손 33-35)은 사람 몸 비례라
     이 치비 몸에서는 정반대였습니다. 8종 모두 y33-35 가 팔이고 y36 이
     손이라, 옛 값으로는 긴팔이 팔을 벗겨 두고 손을 덮었습니다. */
  upper0: 30, // 겨드랑이 위 — 팔이 아직 몸통에 붙어 있는 구간
  upper1: 32,
  fore0: 33, // 팔뚝 — 8종 모두 여기서 팔이 몸통 밖으로 벌어진다. 반팔은 비운다
  fore1: 35,
  hand0: 36, // 손 — 어떤 상의도 덮지 않는다 (y36 은 손과 몸통 사이가 1px 떠 있다)
  hand1: 36,
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

/**
 * 손 자리 — 팔 구간의 바깥 2px. 시안 8종의 y36 을 재 보면 손 두 덩이가
 * 몸통에서 1px 떨어져 있고, 그 덩이가 정확히 여기입니다.
 * 상의는 이 칸을 비워야 손이 살아남습니다.
 */
function handCols(dir) {
  const [x0, x1] = clothX(dir)
  if (dir === 'right') return [x1 - 2, x1 - 1]
  if (dir === 'left') return [x0 + 1, x0 + 2]
  return [x0 + 1, x0 + 2, x1 - 2, x1 - 1]
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
  S: '#c3d3e4', // 옅은 하늘 — 흰 털(백조·알파카) 위에서도 옷이 보이라고
  s: '#8fa3bb', // 옅은 하늘 그늘
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

/**
 * PNG 읽기 — 우리가 쓰는 캐릭터 시트만 봅니다 (8bit RGBA · 비인터레이스).
 * 종 실루엣을 잴 때만 필요하고, 그 외 형식이면 차라리 멈추는 편이 낫습니다.
 */
function readPNG(path) {
  const b = readFileSync(path)
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20)
  if (b[24] !== 8 || b[25] !== 6 || b[28] !== 0)
    throw new Error(`${path}: 8bit RGBA 비인터레이스 PNG 만 읽습니다`)
  const idat = []
  for (let off = 8; off + 8 <= b.length; ) {
    const len = b.readUInt32BE(off)
    if (b.toString('latin1', off + 4, off + 8) === 'IDAT') idat.push(b.subarray(off + 8, off + 8 + len))
    off += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * 4
  const px = Buffer.alloc(stride * h)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride)
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? px[y * stride + i - 4] : 0
      const up = y > 0 ? px[(y - 1) * stride + i] : 0
      const ul = y > 0 && i >= 4 ? px[(y - 1) * stride + i - 4] : 0
      let v = line[i]
      if (f === 1) v += a
      else if (f === 2) v += up
      else if (f === 3) v += (a + up) >> 1
      else if (f === 4) {
        const p = a + up - ul
        const pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - ul)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : ul
      }
      px[y * stride + i] = v & 0xff
    }
  }
  return { w, h, px }
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
// 6. 상의
//
//    골격은 공통이고 style 마다 detail() 만 다릅니다.
//    소매 = 어깨(y30-32) + 팔뚝(y33-35), 손(y36)은 절대 안 덮습니다.
// ─────────────────────────────────────────────────────────────────────────────

function topFrame(dir, spec) {
  const s = new Sprite()
  const [x0, x1] = clothX(dir)
  const arms = armCols(dir)
  const hands = handCols(dir)
  const sleeveEnd = spec.sleeve === 'short' ? Y.upper1 : Y.fore1

  /* 그늘 기둥 — 평평한 판때기로 안 보이게 하는 최소한입니다.
     바깥 테두리는 종별 맞춤이 다시 그리므로, 그늘은 8종이 모두 몸을 가진
     안쪽(x10-21)에 둬야 어느 종에서도 살아남습니다. */
  const shadeCol = isSide(dir) ? x0 + 5 : x1 - 5

  // 어깨 — 아웃라인 1px 안쪽으로
  s.hspan(x0 + 1, x1 - 1, Y.shoulder, 'O')

  for (let y = Y.collar; y <= Y.belt; y++) {
    s.set(x0, y, 'O')
    s.set(x1, y, 'O')
    for (let x = x0 + 1; x <= x1 - 1; x++) {
      if (arms.includes(x)) {
        if (y >= Y.hand0 && hands.includes(x)) continue // 손 — 항상 비움
        if (spec.sleeve === 'short' && y >= Y.fore0 && y <= Y.fore1) continue // 반팔 팔뚝
        if (y >= Y.upper0 && y <= sleeveEnd) {
          // 소매 끝 한 줄은 어둡게 — 소매와 손의 경계가 생깁니다
          s.set(x, y, y === sleeveEnd ? spec.cuffC || spec.bodyShade : spec.sleeveC)
          continue
        }
      }
      s.set(x, y, x === shadeCol && y > Y.collar ? spec.bodyShade : spec.base)
    }
  }
  /* 옷깃. 목이 짧은 종(거북이·고슴도치)은 이 줄이 보이고, 목이 긴 종
     (백조·알파카)은 이 줄이 잘린 뒤 맞춤 단계가 그린 테두리가 옷깃이 됩니다. */
  s.hspan(x0 + 1, x1 - 1, Y.collar, spec.collarC || spec.bodyShade)

  spec.detail?.(s, { dir, x0, x1, arms, hands, shadeCol, sleeveEnd, spec })
  return s
}

const TOPS = {
  varsity: {
    label: '과잠',
    mask: true,
    base: MASK,
    bodyShade: MASK_SHADE,
    sleeveC: 'E', // 흰 소매가 과잠의 정체성
    cuffC: 'e',
    collarC: 'E',
    sleeve: 'long',
    detail(s, { dir, x0, x1 }) {
      s.hspan(x0 + 1, x1 - 1, Y.belt, 'E') // 립 밑단
      if (dir === 'down') {
        s.vspan(15, Y.collar + 1, Y.belt - 1, MASK_SHADE) // 앞섶
        s.set(16, Y.upper0, 'E') // 스냅 단추
        s.set(16, Y.fore0, 'E')
      } else if (dir === 'up') {
        // 등판 엠블럼 — 4px 폭에 글자는 안 들어가므로 테두리 있는 패치로
        s.box(13, Y.upper0, 18, Y.fore0, 'E')
        s.box(14, Y.upper0 + 1, 17, Y.fore0 - 1, MASK)
      } else {
        s.vspan(x1 - 6, Y.collar + 1, Y.belt - 1, MASK_SHADE) // 옆선
      }
    },
  },
  hoodie: {
    label: '후드티',
    base: 'N',
    bodyShade: 'n',
    sleeveC: 'N',
    cuffC: 'n',
    collarC: 'n',
    sleeve: 'long',
    detail(s, { dir, x0, x1 }) {
      // 목 뒤로 접힌 후드 — 앞에서는 목둘레만, 뒤에서는 두툼한 덩어리
      if (dir === 'up') {
        s.box(12, Y.collar, 19, Y.collar + 2, 'n')
        s.hspan(13, 18, Y.collar + 3, 'n')
      } else {
        s.hspan(x0 + 2, x1 - 2, Y.collar + 1, 'n')
      }
      if (dir === 'down') {
        s.set(14, Y.collar + 2, 'E') // 조임끈
        s.set(17, Y.collar + 2, 'E')
        s.set(14, Y.collar + 3, 'E')
        s.set(17, Y.collar + 3, 'E')
        s.box(12, Y.waist0, 19, Y.waist1, 'n') // 배 주머니
        s.hspan(13, 18, Y.waist0, 'N')
      }
      s.hspan(x0 + 1, x1 - 1, Y.belt, 'n') // 립 밑단
    },
  },
  shirt: {
    /* 옅은 하늘색인 이유: 예전 셔츠는 흰색(#eae6de)이라 백조·알파카·고슴도치
       배 위에서 옷인지 털인지 구분이 안 됐습니다. 색상만 살짝 넣으면
       8종 어디서도 옷으로 읽힙니다. */
    label: '셔츠',
    base: 'S',
    bodyShade: 's',
    sleeveC: 'S',
    cuffC: 's',
    collarC: 'E',
    sleeve: 'long',
    detail(s, { dir, x0, x1 }) {
      if (dir === 'down') {
        s.set(13, Y.collar, 'O') // 깃 끝
        s.set(18, Y.collar, 'O')
        s.set(14, Y.collar + 1, 'E') // 깃이 벌어진 자리
        s.set(17, Y.collar + 1, 'E')
        s.vspan(15, Y.collar + 1, Y.belt - 1, 'E') // 앞단
        s.set(16, Y.upper0 + 1, 'O') // 단추
        s.set(16, Y.waist0, 'O')
      } else if (dir === 'up') {
        s.hspan(13, 18, Y.collar, 'E') // 뒷깃
        s.hspan(x0 + 2, x1 - 2, Y.collar + 1, 's') // 요크
      } else {
        s.set(x1 - 4, Y.collar, 'O')
        s.set(x1 - 5, Y.collar + 1, 'E')
      }
      s.hspan(x0 + 1, x1 - 1, Y.belt, 's') // 셔츠 자락
    },
  },
  tee: {
    label: '반팔티',
    base: 'D',
    bodyShade: 'd',
    sleeveC: 'D',
    cuffC: 'd',
    collarC: 'd',
    sleeve: 'short',
    detail(s, { dir }) {
      /* 가슴 프린트. 예전엔 4x4 흰 사각형이라 32px 에서 '뭔가 붙은 얼룩'
         이었습니다. 가로로 눕히면 로고처럼 읽힙니다. */
      if (dir === 'down') {
        s.hspan(13, 18, Y.upper1, 'E')
        s.hspan(14, 17, Y.fore0, 'E')
      }
      if (dir === 'up') s.hspan(13, 18, Y.upper0, 'd')
      s.hspan(13, 18, Y.belt, 'd') // 밑단
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. 하의 — 벨트(37)부터. 긴바지는 발목(42)까지 덮고 신발에 3줄을 남깁니다.
// ─────────────────────────────────────────────────────────────────────────────

function bottomFrame(dir, spec) {
  const s = new Sprite()
  const [x0, x1] = legX(dir)
  /* 긴바지 밑단을 41 -> 42 로 내렸습니다. 시안 8종의 다리는 y38-45 뿐이고
     그중 42-45 는 발이라, 41 에서 끊으면 바지가 4줄짜리 속옷처럼 보였습니다. */
  const hem = spec.length === 'long' ? Y.feet0 : Y.leg0 + 2 // 긴바지 42 / 반바지 40
  const split = spec.length === 'long' ? Y.leg0 + 3 : Y.leg0 + 2 // 가랑이 41 / 40

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
    detail(s, { dir, x0, x1, hem }) {
      if (dir === 'down') {
        s.set(11, Y.leg0, 'j') // 앞주머니
        s.set(20, Y.leg0, 'j')
        s.set(12, Y.leg0 + 1, 'j')
        s.set(19, Y.leg0 + 1, 'j')
      }
      if (dir === 'up') {
        s.box(11, Y.leg0, 13, Y.leg0 + 1, 'j') // 뒷주머니
        s.box(18, Y.leg0, 20, Y.leg0 + 1, 'j')
      }
      if (isSide(dir)) s.vspan(x1 - 1, Y.leg0, hem - 1, 'j') // 옆선
      s.hspan(x0 + 1, x1 - 1, hem - 1, 'J') // 접어 올린 밑단이 밝게 남는다
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
        s.vspan(x1 - 1, Y.belt + 1, hem - 2, 'E')
      } else {
        s.vspan(x0 + 1, Y.belt + 1, hem - 2, 'E')
        s.vspan(x1 - 1, Y.belt + 1, hem - 2, 'E')
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
    detail(s, { dir, x0, x1, hem }) {
      // 주름 한 줄 — 슬랙스를 슬랙스로 만드는 것
      if (!isSide(dir)) {
        s.vspan(12, Y.leg0 + 1, hem - 1, 'N')
        s.vspan(19, Y.leg0 + 1, hem - 1, 'N')
      } else {
        s.vspan(x0 + 2, Y.leg0 + 1, hem - 1, 'N')
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
      s.hspan(x0 + 1, x1 - 1, hem - 1, 'B')
      if (dir === 'down') {
        s.set(11, Y.leg0 + 1, 'H')
        s.set(20, Y.leg0 + 1, 'H')
      }
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. 신발 — y42..45. 긴바지가 윗줄(42)을 덮어 3줄이 남습니다.
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
    s.hspan(11, 20, Y.ground, spec.soleC || 'O') // 밑창
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
    s.hspan(a, b, Y.ground, spec.soleC || 'O') // 밑창
  }
  spec.detail?.(s, { dir, spec, top })
  return s
}

const SHOES = {
  sneakers: {
    label: '운동화',
    base: 'E',
    soleC: 'O',
    detail(s, { dir, top }) {
      if (isSide(dir)) {
        s.hspan(12, 16, top + 1, 'D') // 사선 스트라이프
        s.set(17, top + 2, 'D')
        s.set(18, top + 2, 'D')
        s.set(12, Y.ground - 1, 'e') // 미드솔 — 줄 전체를 덮으면 흰 갑피가 안 남습니다
        s.set(19, Y.ground - 1, 'e')
      } else {
        for (const [a, b] of [
          [10, 14],
          [17, 21],
        ]) {
          s.set(a + 2, top + 1, 'D')
          s.set(b - 2, top + 1, 'D')
          s.set(a + 1, Y.ground - 1, 'e')
        }
      }
    },
  },
  slippers: {
    label: '슬리퍼',
    base: 'n', // 반바지(카키)와 색이 겹치면 다리와 발이 한 덩어리로 보입니다
    open: true,
    detail(s, { dir, top }) {
      // 삼선 슬리퍼 — 발등을 가로지르는 세 줄이 정체성입니다
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
        s.set(18, top + 1, 'B') // 앞코 광
        s.set(19, top + 1, 'B')
      } else {
        // 끈은 점 하나로. 줄 전체를 덮으면 긴바지 아래에서 가죽색이 한 줄도 안 남습니다
        for (const [a, b] of [
          [10, 14],
          [17, 21],
        ]) {
          s.set(a + 2, top + 1, 'O') // 끈 매듭
          s.set(a + 1, top + 2, 'B') // 앞코 광
        }
      }
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. 모자 — y8..11 안착. y8 위로 절대 못 올라갑니다 (기린 한계).
//
//    개구리만 예외적으로 눈을 조금 덮습니다. 개구리는 **눈이 머리 꼭대기**라
//    (y10-13) 모자를 얹을 자리가 눈밖에 없습니다. hatDy 를 어떻게 줘도
//    눈을 피하면 모자가 허공에 뜹니다. 눈 아랫줄 두 줄이 남도록 잡았습니다.
// ─────────────────────────────────────────────────────────────────────────────

const HATS = {
  grad_cap: {
    label: '학사모',
    frame(dir) {
      const s = new Sprite()
      /* 판을 x8..23 으로 넓혔습니다. 예전 x10..21 은 머리 폭과 같아서
         '판'이 아니라 '띠'로 보였습니다. 학사모는 판이 튀어나와야 합니다. */
      s.hspan(8, 23, Y.hatSeat0, 'O')
      s.hspan(9, 22, Y.hatSeat0 + 1, 'n')
      s.set(8, Y.hatSeat0 + 1, 'O')
      s.set(23, Y.hatSeat0 + 1, 'O')
      // 두상 덮개
      s.hspan(12, 19, Y.hatSeat0 + 2, 'O')
      s.hspan(13, 18, Y.hatSeat0 + 2, 'n')
      s.hspan(12, 19, Y.hatSeat1, 'O')
      if (dir === 'down') {
        s.set(15, Y.hatSeat0, 'B') // 가운데 단추
        s.set(16, Y.hatSeat0, 'B')
        /* 술은 판 끝(x23)에서 늘어집니다. 안경 슬롯이 x9-22 이라 한 칸
           안쪽으로 늘어뜨리면 학사모가 안경 윗테를 잘라먹습니다. */
        s.vspan(23, Y.hatSeat0 + 1, Y.hatHangMax, 'B')
      } else if (dir === 'up') {
        s.set(15, Y.hatSeat0, 'B')
        s.set(16, Y.hatSeat0, 'B')
        s.vspan(8, Y.hatSeat0 + 1, Y.hatHangMax, 'B')
      } else {
        s.vspan(8, Y.hatSeat0 + 1, Y.hatHangMax, 'B') // 옆모습은 뒤로 늘어진다
      }
      return s
    },
  },
  cap: {
    label: '볼캡',
    frame(dir) {
      const s = new Sprite()
      // 크라운 — 위로 갈수록 좁아지는 돔
      s.hspan(13, 18, Y.hatSeat0, 'O')
      s.hspan(14, 17, Y.hatSeat0, 'D')
      s.hspan(12, 19, Y.hatSeat0 + 1, 'O')
      s.hspan(13, 18, Y.hatSeat0 + 1, 'D')
      s.hspan(11, 20, Y.hatSeat0 + 2, 'O')
      s.hspan(12, 19, Y.hatSeat0 + 2, 'D')

      /* 챙. 예전엔 크라운과 같은 폭·같은 계열 색의 1px 줄이라 정면에서
         모자가 아니라 머리띠로 보였습니다. 크라운보다 넓히고 색을 낮춥니다. */
      if (dir === 'down') {
        s.hspan(9, 22, Y.hatSeat1, 'd')
        s.set(9, Y.hatSeat1, 'O')
        s.set(22, Y.hatSeat1, 'O')
        s.set(15, Y.hatSeat0, 'e') // 정수리 단추
      } else if (dir === 'up') {
        s.hspan(11, 20, Y.hatSeat1, 'D')
        s.set(10, Y.hatSeat1, 'O')
        s.set(21, Y.hatSeat1, 'O')
        s.set(15, Y.hatSeat1, 'e') // 뒤 조절 스트랩
        s.set(16, Y.hatSeat1, 'e')
      } else {
        s.hspan(11, 22, Y.hatSeat1, 'd') // 옆모습 — 챙이 보는 쪽으로
        s.set(22, Y.hatSeat1, 'O')
        s.set(10, Y.hatSeat1, 'O')
        s.set(11, Y.hatSeat1, 'D')
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
      s.set(10, Y.hatSeat0 + 2, 'O')
      s.set(21, Y.hatSeat0 + 2, 'O')
      s.hspan(11, 20, Y.hatSeat0 + 2, 'J')
      // 접단 — 안착면보다 1px 넓고 한 톤 어둡다
      s.hspan(10, 21, Y.hatSeat1, 'j')
      s.set(9, Y.hatSeat1, 'O')
      s.set(22, Y.hatSeat1, 'O')
      if (dir !== 'up') {
        s.set(14, Y.hatSeat0 + 1, 'j') // 뜨개 무늬
        s.set(17, Y.hatSeat0 + 2, 'j')
      }
      return s
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. 안경 — y14..17. 모자 안착면(8-11)과 겹치지 않습니다.
//
//     알 안쪽은 **비워 둡니다.** 예전엔 밝은 천(E)으로 채웠는데, 8종 전부
//     눈이 통째로 사라져서 '안경 낀 얼굴'이 아니라 '눈 없는 얼굴'이 됐습니다.
//     선글라스만 예외로 알을 채웁니다 — 그건 선글라스의 정의입니다.
// ─────────────────────────────────────────────────────────────────────────────

/* 눈알 자리 — 시안 8종에서 잰 값입니다.
   옆모습도 눈이 둘 다 보이고(보는 쪽으로 몰려 있을 뿐) 알 두 개가 x17 을
   나눠 씁니다. 예전 옆모습 안경은 알을 하나만 그려서 반대쪽 눈이 맨눈이었습니다. */
const LENS = { front: [[9, 14], [17, 22]], right: [[13, 18], [18, 22]] }
/* left 프레임은 right 를 x->31-x 로 뒤집어 만듭니다. 알 자리도 같이 뒤집지
   않으면 검사만 반대쪽을 봅니다. */
const lensOf = (dir) =>
  dir === 'left'
    ? LENS.right.map(([a, b]) => [FRAME_W - 1 - b, FRAME_W - 1 - a])
    : dir === 'right'
      ? LENS.right
      : LENS.front

/** 뒷모습은 관자놀이에 걸린 다리만 보입니다 */
function templesOnly(s, k) {
  s.set(10, Y.face0 + 1, k)
  s.set(11, Y.face0 + 1, k)
  s.set(20, Y.face0 + 1, k)
  s.set(21, Y.face0 + 1, k)
}

/** 알 테두리만 그리고 안쪽은 비웁니다 */
function rimOnly(s, dir, k, { thickTop } = {}) {
  for (const [a, b] of lensOf(dir)) {
    s.hspan(a + 1, b - 1, Y.face0, k) // 윗테
    if (thickTop) {
      s.set(a, Y.face0, k)
      s.set(b, Y.face0, k)
    }
    s.set(a, Y.face0 + 1, k)
    s.set(b, Y.face0 + 1, k)
    s.set(a, Y.face0 + 2, k)
    s.set(b, Y.face0 + 2, k)
    s.hspan(a + 1, b - 1, Y.face1, k) // 아랫테
  }
  if (!isSide(dir)) {
    s.set(15, Y.face0 + 1, k) // 브리지
    s.set(16, Y.face0 + 1, k)
  }
}

const GLASSES = {
  horn: {
    label: '뿔테',
    frame(dir) {
      const s = new Sprite()
      if (dir === 'up') return templesOnly(s, 'O'), s
      rimOnly(s, dir, 'O', { thickTop: true })
      if (isSide(dir)) {
        s.hspan(10, 12, Y.face0 + 1, 'O') // 안경다리는 뒤로
      } else {
        s.set(9, Y.face0 + 1, 'O') // 관자놀이 다리
        s.set(22, Y.face0 + 1, 'O')
      }
      return s
    },
  },
  round: {
    label: '동그란테',
    frame(dir) {
      const s = new Sprite()
      if (dir === 'up') return templesOnly(s, 'H'), s
      rimOnly(s, dir, 'H') // 모서리를 비워 동그랗게
      if (isSide(dir)) s.hspan(10, 12, Y.face0 + 1, 'H')
      return s
    },
  },
  sunglasses: {
    label: '선글라스',
    opaque: true, // 알을 채우는 유일한 안경
    frame(dir) {
      const s = new Sprite()
      if (dir === 'up') return templesOnly(s, 'O'), s
      for (const [a, b] of lensOf(dir)) {
        s.box(a, Y.face0, b, Y.face0 + 2, 'O')
        s.set(a + 1, Y.face0, 'N') // 반사광
      }
      if (isSide(dir)) s.hspan(10, 12, Y.face0 + 1, 'O')
      else {
        s.set(15, Y.face0, 'O') // 브리지
        s.set(16, Y.face0, 'O')
      }
      return s
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. 가방 — z50.
//
//     가방도 종별 실루엣으로 깎입니다. 그래서 몸 밖으로 나가는 부분은
//     8종 중 몸이 가장 좁은 종(백조)에서 통째로 잘려 사라집니다.
//     가방 덩어리는 8종 모두가 몸을 가진 x9..22 · y30..40 안에 둡니다.
// ─────────────────────────────────────────────────────────────────────────────

const BAG_HEM = 40 // 가방 밑단. 더 내리면 발목을 가립니다

const BAGS = {
  backpack: {
    label: '백팩',
    frame(dir) {
      const s = new Sprite()
      if (dir === 'up') {
        // 뒷모습 — 가방 본체가 통째로 보인다
        s.hspan(11, 20, Y.collar + 1, 'O')
        for (let y = Y.collar + 2; y <= BAG_HEM - 1; y++) {
          s.set(10, y, 'O')
          for (let x = 11; x <= 20; x++) s.set(x, y, 'G')
          s.set(21, y, 'O')
        }
        s.hspan(10, 21, BAG_HEM, 'O')
        s.hspan(12, 19, Y.upper1, 'O') // 앞주머니 선
        s.hspan(13, 18, Y.upper1 + 1, 'B') // 버클
        s.set(12, Y.fore1, 'O')
        s.set(19, Y.fore1, 'O')
        return s
      }
      if (dir === 'down') {
        // 정면 — 어깨끈만 보인다
        for (const [a, b] of [[11, 13], [18, 20]]) {
          s.set(a, Y.collar, 'O')
          s.set(b, Y.collar, 'O')
          for (let y = Y.collar; y <= Y.fore0; y++) {
            s.set(a, y, 'O')
            s.set(a + 1, y, 'G')
            s.set(b, y, 'O')
            s.set(b - 1, y, 'G')
          }
        }
        s.hspan(12, 19, Y.upper1, 'B') // 가슴 스트랩
        return s
      }
      // 옆모습 — 등 뒤로 불룩
      s.hspan(10, 13, Y.collar + 1, 'O')
      for (let y = Y.collar + 2; y <= BAG_HEM - 1; y++) {
        s.set(9, y, 'O')
        for (let x = 10; x <= 13; x++) s.set(x, y, 'G')
        s.set(14, y, 'O')
      }
      s.hspan(9, 14, BAG_HEM, 'O')
      s.set(10, Y.fore0, 'B')
      s.vspan(15, Y.collar, Y.fore0, 'G') // 어깨끈
      s.vspan(16, Y.collar, Y.upper1, 'O')
      return s
    },
  },
  tote: {
    label: '에코백',
    /* 예전 에코백은 끈이 밝은 회색(e) 대각선 점선이라 밝은 털 위에서
       '긁힌 자국'이었고, 가방 몸통은 4x4 흰 사각형이라 이름표처럼 보였습니다.
       끈을 갈색으로 바꾸고 몸통을 배 옆으로 8x7 만큼 키웠습니다.
       가로 x15-21 · 세로 y31-38 은 8종이 전부 몸을 가진 자리라, 종별 맞춤에
       깎여 사라지지 않습니다. */
    frame(dir) {
      const s = new Sprite()
      const bagBody = (a, b, y0, y1, print) => {
        s.hspan(a, b, y0, 'O')
        for (let y = y0 + 1; y <= y1 - 1; y++) {
          s.set(a, y, 'O')
          for (let x = a + 1; x <= b - 1; x++) s.set(x, y, 'E')
          s.set(b, y, 'O')
          s.set(b - 1, y, 'e') // 접힌 면
        }
        s.hspan(a, b, y1, 'O')
        if (print) {
          s.hspan(a + 2, b - 2, y0 + 3, 'G')
          s.hspan(a + 3, b - 3, y0 + 4, 'G')
        }
      }
      if (dir === 'down' || dir === 'up') {
        // 한쪽 어깨에서 반대쪽 허리로 가로지르는 끈
        for (const [x, y] of [
          [11, Y.collar], [12, Y.collar], [11, Y.collar + 1], [12, Y.collar + 1],
          [12, Y.collar + 2], [13, Y.collar + 2], [12, Y.upper0], [13, Y.upper0],
          [13, Y.upper0 + 1], [14, Y.upper0 + 1], [13, Y.upper1], [14, Y.upper1],
          [14, Y.fore0], [15, Y.fore0],
        ])
          s.set(x, y, 'H')
        bagBody(15, 21, Y.upper0 + 1, Y.waist1 + 2, dir === 'down')
        return s
      }
      // 옆모습 — 끈이 어깨에서 곧게 내려오고 가방이 몸 옆에 붙는다
      s.vspan(13, Y.collar, Y.upper1, 'H')
      s.vspan(14, Y.collar, Y.upper1, 'H')
      bagBody(13, 19, Y.upper0 + 1, Y.waist1 + 2, true)
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
  //    팔뚝(y33-35)·손(y36) 자리는 시안 8종을 재서 맞춘 값입니다 — Y 상수 주석 참고.
  const hands = handCols(dir)
  s.hspan(x0 + 1, x1 - 1, Y.shoulder, O)
  for (let y = Y.collar; y <= Y.belt; y++) {
    put(x0, y, O)
    put(x1, y, O)
    for (let x = x0 + 1; x <= x1 - 1; x++) {
      if (arms.includes(x)) {
        if (y >= Y.hand0 && y <= Y.hand1) put(x, y, hands.includes(x) ? SKIN : BODY_TOP)
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

/** layout.json 은 좌표의 정답입니다. 읽고 나면 종 목록도 여기서 가져옵니다. */
let LAYOUT = null
let SPECIES = []

/** 상위 규격(layout.json)과 어긋나면 여기서 잡습니다 */
function checkAgainstLayout() {
  let L
  try {
    L = JSON.parse(readFileSync(LAYOUT_JSON, 'utf8'))
  } catch {
    fail(`layout.json 을 읽을 수 없습니다: ${LAYOUT_JSON}`)
    return
  }
  LAYOUT = L
  SPECIES = L.species.map((sp) => sp.name)
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
      for (const a of handCols(dir))
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
   폭이 제각각이라(거북이는 목이 없고 백조는 목이 8줄입니다) 그대로 얹으면
   소매가 몸 밖으로 판때기처럼 튀어나옵니다.

   그래서 옷 한 벌만 그려두고, 종마다 그 종의 몸 실루엣으로 깎아 냅니다.
   잘린 자리에는 테두리를 다시 칠합니다 — 안 그러면 단면이 속살처럼 보입니다.

   **방향마다 따로 깎습니다.** 예전엔 정면 한 장으로 잰 가로 구간을 네 방향에
   같이 썼는데, (1) 옆모습은 몸이 1px 어긋나 있고 (2) 가로 구간은 손과 몸통
   사이의 1px 틈을 메워 버려서, 백조 어깨와 기린 손 옆에 옷이 허공에 떠
   있었습니다(종당 최대 14px).

   하의·신발·모자·안경은 8종이 이미 같은 자리라 깎지 않습니다.
   ─────────────────────────────────────────────────────────────────────────── */
function fitToSilhouette(frame, inside) {
  const out = new Sprite()
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

/**
 * 캐릭터 시트에서 종별 몸 지도를 잽니다.
 *   body[dir][y*32+x]  그 자리에 몸이 있는가
 *   neckY              목이 끝나고 어깨가 시작하는 줄
 *
 * neckY 가 필요한 이유: 백조·알파카·기린은 y25 부터 y32 까지가 **목**입니다.
 * 옷을 y26 부터 채우면 목까지 감싸서 터틀넥이 되고, 짧은 목을 가진 거북이와
 * 완전히 다른 옷처럼 보입니다. 그래서 몸통 아이템은 목 위를 잘라 냅니다.
 * 기준은 "여기부터 벨트까지 계속 14px 이상 넓은 첫 줄" — 즉 어깨입니다.
 */
function measureSpecies(slug) {
  const img = readPNG(resolve(CHAR_DIR, slug + '.png'))
  if (img.w !== FRAME_W * DIRS.length || img.h !== FRAME_H)
    throw new Error(`${slug}.png 가 ${FRAME_W * DIRS.length}x${FRAME_H} 가 아닙니다`)
  const body = {}
  DIRS.forEach((dir, i) => {
    const m = new Uint8Array(FRAME_W * FRAME_H)
    for (let y = 0; y < FRAME_H; y++)
      for (let x = 0; x < FRAME_W; x++)
        m[y * FRAME_W + x] = img.px[(y * img.w + i * FRAME_W + x) * 4 + 3] > 0 ? 1 : 0
    body[dir] = m
  })
  const width = (y) => {
    let n = 0
    for (let x = 0; x < FRAME_W; x++) if (body.down[y * FRAME_W + x]) n++
    return n
  }
  /* 어깨는 "몸통에서 가장 넓은 줄에서 위로 올라가다가 좁아지는 곳" 입니다.
     벨트(y37)에서 시작하면 안 됩니다 — 개구리·펭귄은 y37 이 이미 다리
     너비(12px)라 첫 줄에서 멈춰 버려 상의가 통째로 잘렸습니다. */
  const SHOULDER_W = 14 // 옷깃이 앉을 만한 최소 어깨 폭
  let widest = Y.collar
  for (let y = Y.collar; y <= Y.belt; y++) if (width(y) > width(widest)) widest = y
  let neckY = widest
  for (let y = widest; y >= Y.collar; y--) {
    if (width(y) < SHOULDER_W) break
    neckY = y
  }
  return { body, neckY }
}

function overlapTest(mannequin, items, fit) {
  const results = []
  const check = (name, ok, detail) => results.push({ name, ok, detail })
  const L = (slot, id) => ({ z: SLOT[slot].z, frames: items[slot][id].frames })

  /* 4방향 팔 자리의 총 픽셀 수.
     예전엔 팔이 1px 기둥이고 손이 2줄이라 곱하기 2 가 박혀 있었는데,
     시안 팔은 4px 이고 손·팔뚝도 3줄이라 구간 길이에서 계산합니다. */
  const armW = DIRS.reduce((n, d) => n + armCols(d).length, 0)
  const handW = DIRS.reduce((n, d) => n + handCols(d).length, 0)
  const handPixels = handW * (Y.hand1 - Y.hand0 + 1)
  const forePixels = armW * (Y.fore1 - Y.fore0 + 1)

  // ── 손 노출: 긴팔을 입어도 마네킹 손이 남아 있어야 한다
  for (const id of ['varsity', 'hoodie', 'shirt']) {
    let visible = 0
    for (const dir of DIRS) {
      const c = composite(mannequin, [L('torso', id)], dir)
      for (const a of handCols(dir))
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

  /* ── 허공에 뜬 옷: 종별로 깎은 판이 그 종 몸 밖에 픽셀을 남기면 안 됩니다.
        예전 맞춤은 가로 구간만 봐서 손 옆 1px 틈과 백조 어깨 틈을 메웠고,
        그게 "소매가 떠 있다" 로 보였습니다. */
  {
    let bad = []
    let n = 0
    for (const sp of SPECIES)
      for (const slot of fit.FIT_SLOTS)
        for (const [id, it] of Object.entries(items[slot])) {
          const f = fit.fittedFrames(slot, it.frames, sp)
          for (const dir of DIRS) {
            n++
            const m = fit.SIL[sp].body[dir]
            let out = 0
            for (let y = 0; y < FRAME_H; y++)
              for (let x = 0; x < FRAME_W; x++)
                if (f[dir].get(x, y) && !m[y * FRAME_W + x]) out++
            if (out) bad.push(`${sp}/${id}/${dir} ${out}px`)
          }
        }
    check('허공에 뜬 옷', bad.length === 0, bad.length ? bad.slice(0, 4).join(', ') : `${n}판 전부 몸 안`)
  }

  /* ── 눈 노출: 선글라스가 아닌 안경은 알을 비워 둬야 캐릭터 눈이 보입니다.
        알을 밝은 천(E)으로 채웠더니 8종 전부 눈이 사라졌습니다. */
  {
    let bad = []
    for (const [id, it] of Object.entries(items.face)) {
      if (it.spec.opaque) continue
      for (const dir of DIRS) {
        if (dir === 'up') continue // 뒷모습은 관자놀이 다리만 있습니다
        let filled = 0
        for (const [a, b] of lensOf(dir))
          for (let x = a + 1; x <= b - 1; x++)
            for (let y = Y.face0 + 1; y <= Y.face1 - 1; y++)
              if (it.frames[dir].get(x, y)) filled++
        if (filled) bad.push(`${id}/${dir} ${filled}px`)
      }
    }
    check('안경 알 비움', bad.length === 0, bad.length ? bad.join(', ') : '뿔테·동그란테 알 안쪽 투명')
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

  /* 종별 몸 지도 — 캐릭터 시트에서 잽니다. 못 읽으면 맞춤 없는 판이
     그대로 커밋되므로 조용히 넘어가지 않고 멈춥니다. */
  const SIL = {}
  for (const sp of SPECIES) SIL[sp] = measureSpecies(sp)

  const FIT_SLOTS = new Set(['torso', 'bag']) // 하의·신발·모자·안경은 8종이 같은 자리
  const fittedFrames = (_slot, frames, sp) => {
    const { body, neckY } = SIL[sp]
    const out = {}
    for (const dir of DIRS) {
      const m = body[dir]
      /* 목 위는 잘라 냅니다. 백조·알파카는 y26-32 가 목이라, 안 자르면 옷은
         터틀넥이 되고 가방끈은 목걸이가 됩니다. */
      out[dir] = fitToSilhouette(frames[dir], (x, y) => y >= neckY && !!m[y * FRAME_W + x])
    }
    return out
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

  const putFitted = (slot, folder, file, frames, mode) => {
    if (!FIT_SLOTS.has(slot)) return
    for (const sp of SPECIES) {
      mkdirSync(resolve(OUT, 'fitted', sp, folder), { recursive: true })
      writeFileSync(
        resolve(OUT, 'fitted', sp, folder, file + '.png'),
        sheet(fittedFrames(slot, frames, sp), mode).toPNG()
      )
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
  const results = overlapTest(mannequin, items, { SIL, fittedFrames, FIT_SLOTS })

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

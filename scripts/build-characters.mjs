#!/usr/bin/env node
/**
 * build-characters.mjs — 캐릭터 시트 8종의 **뒷모습과 옆모습**을 다시 그립니다.
 *
 * 입력: prototypes/openworld/assets/characters/source/<종>.png  (제미나이 시안 원본)
 * 출력: prototypes/openworld/assets/characters/<종>.png          (월드가 읽는 시트)
 *
 * 의존성 없음 (node 내장 zlib 로 PNG 를 직접 읽고 씁니다).
 *   node scripts/build-characters.mjs
 *
 * 왜 원본을 따로 두는가 — 시안의 옆·뒤 프레임은 **정면 몸에 얼굴만 옮긴 것**
 * 이라, 거북이 등껍질이 배 쪽에 남고 펭귄 등이 하얗습니다. 그것을 고치려면
 * 픽셀을 덧칠해야 하는데, 결과 PNG 만 커밋하면 다음 사람이 다시 손볼 방법이
 * 없습니다(build-items.mjs 가 한 번 그렇게 죽었습니다). 그래서 손 안 댄 원본은
 * source/ 에 남기고, 덧칠은 전부 이 파일 안의 코드로만 합니다.
 *
 * 지키는 규칙 (아래 검사로 강제합니다)
 *   1. 정면(down)은 한 픽셀도 안 건드립니다 — bakeFace 와 상점 미리보기,
 *      그리고 8종의 인상이 전부 정면에서 나옵니다.
 *   2. 몸에서 픽셀을 빼지 않습니다. 덧칠하거나 더할 뿐입니다.
 *      아이템은 이 실루엣 안으로 깎이므로(build-items.mjs fitToSilhouette),
 *      실루엣이 줄면 그 자리의 옷이 같이 잘려 나갑니다.
 *   3. 새 색을 만들지 않습니다. 칠하는 색은 **그 종 원본 시트에 이미 있는 색**
 *      뿐입니다. 종마다 팔레트가 이미 10~30색이라 모자라지 않고, 이렇게 묶어
 *      두면 덧칠한 자리만 색감이 튀는 일이 없습니다.
 *   4. 머리 꼭대기를 더 높이지 않습니다 — y<5 는 머리 위 세션 시계 자리입니다
 *      (고슴도치 가시는 시안이 이미 y4 까지 쓰고 있어, 기준은 "원본보다 더
 *      올라가지 않는다" 입니다).
 */

import { deflateSync, inflateSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHAR_DIR = resolve(ROOT, 'prototypes/openworld/assets/characters')
const SRC_DIR = resolve(CHAR_DIR, 'source')

const FRAME_W = 32
const FRAME_H = 48
/** 시트 프레임 순서 — layout.json · build-items.mjs · ITEM_DIR 과 같아야 합니다. */
const DIRS = ['right', 'up', 'left', 'down']
const SPECIES = ['turtle', 'giraffe', 'penguin', 'hamster', 'frog', 'hedgehog', 'alpaca', 'swan']

/** layout.json 에서 온 값. 여기서 쓰는 것만 옮겨 적습니다(어긋나면 검사가 잡습니다). */
const Y = {
  timerReserve: 5,
  headTop: 8,
  headBottom: 24,
  attach: 25, // 어깨
  belt: 37,
  feetTop: 42,
  ground: 45,
}

// ─────────────────────────────────────────────────────────────────────────────
// PNG 입출력 — build-items.mjs 와 같은 코덱입니다 (8bit RGBA · 비인터레이스)
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

function readPNG(path) {
  const b = readFileSync(path)
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20)
  if (b[24] !== 8 || b[25] !== 6 || b[28] !== 0)
    throw new Error(`${path}: 8bit RGBA 비인터레이스 PNG 만 읽습니다`)
  const idat = []
  for (let off = 8; off + 8 <= b.length;) {
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

function writePNG(path, img) {
  const stride = img.w * 4 + 1
  const raw = Buffer.alloc(stride * img.h)
  for (let y = 0; y < img.h; y++) {
    raw[y * stride] = 0
    img.px.copy(raw, y * stride + 1, y * img.w * 4, (y + 1) * img.w * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(img.w, 0)
  ihdr.writeUInt32BE(img.h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]))
}

// ─────────────────────────────────────────────────────────────────────────────
// 프레임 — 32x48 한 장. 시트에서 잘라 왔다가 다시 붙입니다.
// ─────────────────────────────────────────────────────────────────────────────

class Frame {
  constructor() { this.px = Buffer.alloc(FRAME_W * FRAME_H * 4, 0) }
  static from(img, i) {
    const f = new Frame()
    for (let y = 0; y < FRAME_H; y++)
      for (let x = 0; x < FRAME_W; x++) {
        const s = (y * img.w + i * FRAME_W + x) * 4
        img.px.copy(f.px, (y * FRAME_W + x) * 4, s, s + 4)
      }
    return f
  }
  clone() { const f = new Frame(); this.px.copy(f.px); return f }
  get(x, y) {
    if (x < 0 || y < 0 || x >= FRAME_W || y >= FRAME_H) return null
    const i = (y * FRAME_W + x) * 4
    return this.px[i + 3] ? [this.px[i], this.px[i + 1], this.px[i + 2], this.px[i + 3]] : null
  }
  /** 색 문자열 '#rrggbb' 또는 null(투명) */
  key(x, y) {
    const c = this.get(x, y)
    return c ? rgbHex(c) : null
  }
  set(x, y, hex) {
    if (x < 0 || y < 0 || x >= FRAME_W || y >= FRAME_H) return
    const c = hexRgb(hex)
    const i = (y * FRAME_W + x) * 4
    this.px[i] = c[0]; this.px[i + 1] = c[1]; this.px[i + 2] = c[2]; this.px[i + 3] = 255
  }
  /** 이미 몸이 있는 자리에만 덧칠합니다 — 실루엣을 안 넓히고 색만 갈 때. */
  over(x, y, hex) { if (this.get(x, y)) this.set(x, y, hex) }
  box(x0, y0, x1, y1, hex, { onlyBody = true } = {}) {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) (onlyBody ? this.over : this.set).call(this, x, y, hex)
  }
  count() {
    let n = 0
    for (let i = 3; i < this.px.length; i += 4) if (this.px[i]) n++
    return n
  }
  /** x15.5 축 좌우반전 */
  mirror() {
    const f = new Frame()
    for (let y = 0; y < FRAME_H; y++)
      for (let x = 0; x < FRAME_W; x++)
        this.px.copy(f.px, (y * FRAME_W + (FRAME_W - 1 - x)) * 4, (y * FRAME_W + x) * 4, (y * FRAME_W + x) * 4 + 4)
    return f
  }
}

const rgbHex = (c) => '#' + [c[0], c[1], c[2]].map((v) => v.toString(16).padStart(2, '0')).join('')
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const lum = (h) => { const c = hexRgb(h); return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] }

/** 시트 전체에 쓰인 색 — 규칙 3(새 색 금지)의 기준입니다. */
function paletteOf(img) {
  const set = new Set()
  for (let i = 0; i < img.px.length; i += 4)
    if (img.px[i + 3]) set.add(rgbHex([img.px[i], img.px[i + 1], img.px[i + 2]]))
  return set
}

/**
 * 팔레트에서 "이 색보다 한 단 어두운 같은 계열" 을 고릅니다.
 * 규칙 3 때문에 곱셈으로 어둡게 할 수 없어서, 있는 색 중에 고릅니다.
 * 밝기가 목표(0.72배)에 가깝고 색상이 안 튀는 것을 고릅니다.
 */
function shadeTable(palette, k = 0.72) {
  const list = [...palette]
  const table = new Map()
  for (const from of list) {
    const a = hexRgb(from), want = lum(from) * k
    let best = null, bestCost = Infinity
    for (const to of list) {
      const b = hexRgb(to)
      if (lum(to) >= lum(from) - 6) continue // 더 어두워야 합니다
      /* 색상이 튀면 다른 재질로 보입니다 — 채널 비율 차이에 큰 벌점. */
      const hue = Math.abs((a[0] - a[2]) - (b[0] - b[2])) + Math.abs((a[1] - a[2]) - (b[1] - b[2]))
      const cost = Math.abs(lum(to) - want) + hue * 1.5
      if (cost < bestCost) { bestCost = cost; best = to }
    }
    table.set(from, best || from)
  }
  return table
}

// ─────────────────────────────────────────────────────────────────────────────
// 붓 — 종별 덧칠이 공통으로 쓰는 것들
// ─────────────────────────────────────────────────────────────────────────────

/** 그 줄에서 몸이 차지한 구간 [x0, x1]. 없으면 null. */
function span(f, y) {
  let x0 = -1, x1 = -1
  for (let x = 0; x < FRAME_W; x++) if (f.get(x, y)) { if (x0 < 0) x0 = x; x1 = x }
  return x0 < 0 ? null : [x0, x1]
}

/** 몸 안쪽인가 — 테두리에서 d 칸 이상 들어와 있는가. 덧칠이 윤곽을 안 먹게. */
const inset = (f, x, y, d = 1) => {
  const s = span(f, y)
  return !!s && x >= s[0] + d && x <= s[1] - d
}

/** 타원 안의 몸 픽셀에 색을 칠합니다. t 는 0(중심)~1(가장자리). */
function ellipse(f, cx, cy, rx, ry, pick, { d = 1 } = {}) {
  for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++)
    for (let x = Math.ceil(cx - rx); x <= Math.floor(cx + rx); x++) {
      const u = (x - cx) / rx, v = (y - cy) / ry
      const t = Math.sqrt(u * u + v * v)
      if (t > 1 || !f.get(x, y) || !inset(f, x, y, d)) continue
      const c = typeof pick === 'function' ? pick(x, y, t) : pick
      if (c) f.set(x, y, c)
    }
}

/** 세로줄 — 등뼈·갈기처럼 가운데를 따라 내려가는 선. */
function spine(f, x, y0, y1, hex, { d = 1 } = {}) {
  for (let y = y0; y <= y1; y++) if (inset(f, x, y, d)) f.over(x, y, hex)
}

/** 아래에서 위로 훑어 무늬를 찍습니다 — 배 무늬를 등 무늬로 갈 때 씁니다. */
function repaint(f, y0, y1, from, to, { d = 0 } = {}) {
  let n = 0
  for (let y = y0; y <= y1; y++)
    for (let x = 0; x < FRAME_W; x++) {
      const k = f.key(x, y)
      if (k && from.includes(k) && inset(f, x, y, d)) { f.set(x, y, to(k, x, y)); n++ }
    }
  return n
}

// ─────────────────────────────────────────────────────────────────────────────
// 눈 — 옆모습에서 **먼 쪽 눈 하나를 지웁니다**
//
// 시안의 옆모습은 정면 몸에 눈 두 개를 그대로 옮겨 놓은 것이라, 옆을 보는데
// 눈이 둘입니다. 어느 픽셀이 눈인지는 정면 프레임에서 배웁니다 — FACE_SPEC
// (index.html)이 종마다 정면 눈 자리를 이미 알고 있고, 그 안에 든 색이 곧
// 그 종의 눈 색입니다. 그 색을 옆모습 머리에서 다시 찾아 왼쪽 덩어리만
// 살갗으로 덮습니다.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 뒤통수에서 얼굴 자국을 지웁니다.
 * 시안의 뒷모습은 정면에서 눈만 대충 지운 것이라, 눈 하이라이트(흰 점)나
 * 주둥이 그늘이 남아 있습니다. 4배로 키워 의자에 앉혀 놓으면 그게 다시
 * 얼굴로 읽혀서, 뒤돌아 앉았는데 이쪽을 보는 것처럼 보입니다.
 * 테두리는 안 건드립니다(inset 2) — 지우면 머리 윤곽이 무너집니다.
 */
function noFace(f, marks, to, y0 = 9, y1 = 22) {
  let n = 0
  for (let y = y0; y <= y1; y++)
    for (let x = 0; x < FRAME_W; x++)
      if (marks.includes(f.key(x, y)) && inset(f, x, y, 2)) { f.set(x, y, to); n++ }
  return n
}

/** 정면 눈 상자 [x0, x1, y0, y1] 둘. index.html FACE_SPEC 의 ex/ey 와 같은 값입니다. */
const FACE = {
  turtle: { ex: [10, 18], ey: 14, skin: '#8cd296' },
  giraffe: { ex: [10, 18], ey: 14, skin: '#faf0c8' },
  penguin: { ex: [10, 18], ey: 14, skin: '#ffffff' },
  hamster: { ex: [10, 18], ey: 14, skin: '#dcaa78' },
  frog: { ex: [9, 19], ey: 10, skin: '#82dc3c' },
  hedgehog: { ex: [10, 18], ey: 14, skin: '#e6b48c' },
  alpaca: { ex: [10, 18], ey: 14, skin: '#fae6d2' },
  swan: { ex: [10, 18], ey: 14, skin: '#ffffff' },
}

/** 정면 눈 상자 안에서 살갗이 아닌 색 = 그 종의 눈 색. */
function eyeInk(slug, down) {
  const F = FACE[slug]
  const ink = new Set()
  for (const ex of F.ex)
    for (let y = F.ey; y <= F.ey + 3; y++)
      for (let x = ex; x <= ex + 3; x++) {
        const k = down.key(x, y)
        if (k && k !== F.skin) ink.add(k)
      }
  return ink
}

/**
 * 옆모습에서 먼 쪽(뒤쪽) 눈을 지웁니다.
 * 지운 자리는 **그 줄에서 눈 바로 옆에 있던 색**으로 메웁니다 — 살갗 상수로
 * 메우면 이마 그늘이 있는 종(햄스터·고슴도치)에서 네모난 자국이 남습니다.
 */
function dropFarEye(slug, side, down) {
  const ink = eyeInk(slug, down)
  const F = FACE[slug]
  const y0 = F.ey - 2, y1 = F.ey + 6
  const hit = []
  for (let y = y0; y <= y1; y++)
    for (let x = 6; x <= 25; x++) if (ink.has(side.key(x, y))) hit.push([x, y])
  if (!hit.length) return 0
  const xs = hit.map(([x]) => x)
  const mid = (Math.min(...xs) + Math.max(...xs)) / 2
  const far = hit.filter(([x]) => x < mid)
  /* 메울 색은 눈 덩어리 **왼쪽 바깥** 한 칸에서 가져옵니다. */
  const left = Math.min(...far.map(([x]) => x))
  for (const [x, y] of far) {
    let fill = null
    for (let k = left - 1; k >= 4 && !fill; k--) if (!ink.has(side.key(k, y))) fill = side.key(k, y)
    side.over(x, y, fill || F.skin)
  }
  return far.length
}

/**
 * 부리를 얼굴 앞으로 내보냅니다. 옆모습인데 부리가 얼굴 한가운데 있으면
 * 정면을 그대로 옮긴 티가 가장 크게 납니다.
 *
 * 미는 거리는 고정값이 아니라 **부리 오른쪽 끝이 얼굴 테두리 바로 밖에
 * 놓이도록** 계산합니다. 상수로 밀면 종마다 얼굴 폭이 달라서 부리가 허공에
 * 뜨거나(백조 +3) 얼굴에 파묻힙니다. 비운 자리는 살갗으로 메웁니다.
 */
function beakOut(f, colours, y0, y1, skin) {
  const move = []
  let edge = -1, right = -1
  for (let y = y0; y <= y1; y++)
    for (let x = 0; x < FRAME_W; x++) {
      const k = f.key(x, y)
      if (!k) continue
      if (colours.includes(k)) { move.push([x, y, k]); right = Math.max(right, x) }
    }
  if (!move.length) return 0
  const rows = new Set(move.map(([, y]) => y))
  for (const y of rows) for (let x = 0; x < FRAME_W; x++) if (f.get(x, y) && !colours.includes(f.key(x, y))) edge = Math.max(edge, x)
  const dx = Math.max(0, edge + 1 - right)
  for (const [x, y] of move) f.set(x, y, skin)
  for (const [x, y, k] of move) f.set(x + dx, y, k)
  return move.length
}

/**
 * 옆얼굴 — 앞쪽으로 주둥이·부리를 1~2px 내밉니다.
 * 실루엣이 **커지는** 쪽이라 아이템 깎기(fitToSilhouette)에는 안전합니다.
 * 모자 자리(y8-14)와 안경 자리(x9-22)는 피해서, 눈높이 아래로만 냅니다.
 */
function muzzle(f, rows, fill, line) {
  for (const [y, len] of rows) {
    const s = span(f, y)
    if (!s) continue
    for (let i = 0; i < len; i++) f.set(s[1] + 1 + i, y, i === len - 1 ? line : fill)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 종별 덧칠 — 뒷모습(up) · 옆모습(right, left 는 뒤집어 만듭니다)
// ─────────────────────────────────────────────────────────────────────────────

const PAINT = {
  /* ── 거북이 ──────────────────────────────────────────────────────────────
     뒤: 등껍질. 시안은 앞·옆에만 껍질이 있고(옆모습 x6-9 의 짙은 덩어리가
         그것입니다) 뒤는 배가 그대로 보였습니다. 등판 한가운데에 육각 딱지
         하나, 거기서 여섯 갈래로 이음선을 뻗고, 가장자리를 한 겹 어둡게.
     옆: 눈 하나 + 부리. 껍질은 시안에 이미 있습니다. */
  turtle: {
    back(f) {
      const shell = '#73ac7b', lit = '#8cc896', seam = '#214a29', rim = '#14321e', deep = '#3c6e46'
      /* 딱지 여섯 장 — 가운데 한 장에 둘레 다섯 장. 극좌표로 나눕니다:
         t 는 중심에서 가장자리(0~1), a 는 각도. 이음선을 픽셀 하나로 그으면
         이 크기에서는 때가 낀 것처럼 보여서, 안쪽 원과 다섯 갈래만 씁니다. */
      ellipse(f, 15.5, 30.5, 9, 8, (x, y, t) => {
        const a = Math.atan2((y - 30.5) / 8, (x - 15.5) / 9)
        if (t > 0.9) return rim
        const spoke = Math.abs(((a / Math.PI) * 2.5 + 5.5) % 1 - 0.5) < 0.09
        if (Math.abs(t - 0.56) < 0.075 || (spoke && t > 0.56)) return seam
        if (t > 0.78) return deep
        /* 왼쪽 위에서 빛이 옵니다 — 다른 기물과 같은 방향이어야 같은 방에 있어 보입니다. */
        return t < 0.42 && x + y < 45 ? lit : shell
      })
    },
    side(f, { src, slug }) {
      dropFarEye(slug, f, src.down)
      muzzle(f, [[16, 1], [17, 1]], '#8cd296', '#64a06e')
    },
  },

  /* ── 기린 ────────────────────────────────────────────────────────────────
     뒤: 목덜미부터 꼬리까지 내려오는 갈기. 기린은 등 한가운데 짧은 갈기가
         있고, 그게 뒷모습에서 유일하게 "뒤" 로 읽히는 부분입니다.
         무늬도 등 쪽이 더 뭉쳐 있어 얼룩 몇 개를 더 얹습니다.
     옆: 눈 하나 + 긴 주둥이. 기린 얼굴은 앞뒤로 긴 것이 특징이라 2px 냅니다. */
  giraffe: {
    back(f) {
      const mane = '#8c461e', maneLit = '#dc7828', spot = '#f08c32'
      /* 갈기는 목덜미에만. 머리부터 꼬리까지 두 줄로 그으면 갈기가 아니라
         지퍼로 보입니다 — 한 줄로 짧게, 끝은 엇갈리게 흐립니다. */
      for (let y = 21; y <= 27; y++) {
        if (!inset(f, 15, y, 1)) continue
        f.over(15, y, y > 25 ? maneLit : mane)
        if (y < 25) f.over(16, y, maneLit)
      }
      // 꼬리 — 엉덩이에서 한 줄 내려와 술로 끝납니다
      for (let y = 34; y <= 39; y++) if (inset(f, 15, y, 1)) f.over(15, y, maneLit)
      for (const [x, y] of [[15, 40], [15, 41], [16, 41]]) f.over(x, y, mane)
      for (const [x, y] of [[11, 28], [19, 30], [12, 34], [20, 35], [10, 31]])
        if (inset(f, x, y, 1)) { f.over(x, y, spot); f.over(x + 1, y, spot); f.over(x, y + 1, spot) }
    },
    side(f, { src, slug }) {
      dropFarEye(slug, f, src.down)
      muzzle(f, [[15, 1], [16, 2], [17, 2], [18, 1]], '#faf0c8', '#e6c896')
      // 갈기는 옆에서도 보입니다 — 목 뒤쪽 한 줄
      for (let y = 20; y <= 26; y++) if (inset(f, 9, y, 0)) f.over(9, y, '#8c461e')
    },
  },

  /* ── 펭귄 ────────────────────────────────────────────────────────────────
     뒤: 등은 새까맣습니다. 시안 뒷모습은 배도 얼굴 무늬도 하얀 채라
         뒤돌아도 앞으로 보였습니다. 흰 배·흰 얼굴을 등 색으로 덮습니다.
     옆: 눈 하나 + 부리를 앞으로. */
  penguin: {
    back(f) {
      const back = '#282832', edge = '#14141e'
      repaint(f, 7, 39, ['#ffffff', '#e6e6e6'], () => back)
      repaint(f, 7, 39, ['#c8d2dc', '#bec8d2', '#c8c8d2'], () => edge)
      /* 등 한가운데는 한 톤 밝게 — 새까만 덩어리로 두면 구멍처럼 보입니다.
         팔레트에 검정과 흰색 사이가 없어서, 있는 색 중 가장 어두운 회색을
         가장자리가 아니라 **가운데**에 씁니다. */
      ellipse(f, 15.5, 31, 6, 6.5, (x, y, t) => (t < 0.62 && x + y < 47 ? '#282828' : null), { d: 2 })
      /* 뒤통수와 등 사이에 어두운 선 한 줄. 온통 같은 검정으로 두면 목이
         없어져 한 덩어리로 보입니다. 밝은 빛줄기도 넣어 봤는데, 이 크기에서는
         깃털이 아니라 긁힌 자국으로 보여서 뺐습니다. */
      for (let y = 21; y <= 26; y++) {
        const s = span(f, y)
        if (s) { f.over(s[0] + 1, y, '#14141e'); f.over(s[1] - 1, y, '#14141e') }
      }
    },
    side(f, { src, slug }) {
      dropFarEye(slug, f, src.down)
      beakOut(f, ['#fa9632', '#fa8c28', '#fa9628', '#dc6e1e', '#b44614', '#d26e1e'], 14, 21, '#282832')
      muzzle(f, [[13, 1], [14, 1]], '#282832', '#14141e')
    },
  },

  /* ── 햄스터 ──────────────────────────────────────────────────────────────
     뒤: 배의 밝은 털을 등 털로 덮고, 등 한가운데 그늘 한 줄과 꼬리 한 점.
     옆: 눈 하나 + 짧은 코. */
  hamster: {
    back(f) {
      repaint(f, 24, 40, ['#e6c8a0', '#e6c896'], () => '#dcb478', { d: 1 })
      noFace(f, ['#fabebe', '#501e00', '#461e00'], '#dcb478')   // 귀는 뒤에서 보면 분홍 속이 안 보입니다
      /* 등은 가운데가 볼록합니다 — 가장자리로 갈수록 어둡게. 등뼈를 선으로
         그으면 지퍼가 됩니다(한 번 해 보고 지웠습니다). */
      ellipse(f, 15.5, 32, 10, 9, (x, y, t) => (t > 0.72 ? '#be8c64' : t > 0.5 ? '#dcaa78' : null), { d: 1 })
      // 꼬리 — 엉덩이 아래쪽에 짧게. 크게 그리면 꼬리로 안 보입니다
      ellipse(f, 15.5, 39, 2, 1.6, (x, y, t) => (t > 0.6 ? '#be8c64' : '#dcaa78'), { d: 1 })
    },
    side(f, { src, slug }) {
      dropFarEye(slug, f, src.down)
      muzzle(f, [[16, 1], [17, 1]], '#dcaa78', '#be8c64')
    },
  },

  /* ── 개구리 ──────────────────────────────────────────────────────────────
     뒤: 몸통은 시안이 이미 초록입니다. 뒤통수에 남은 목 밑 크림색을 덮고,
         등에 짙은 무늬를 얹습니다 — 개구리 등은 원래 얼룩덜룩합니다.
     옆: 눈 하나 + 넓은 입. */
  frog: {
    back(f) {
      repaint(f, 12, 26, ['#faf0a0', '#f0f0a0', '#e6d282', '#dcd282'], () => '#82dc3c')
      noFace(f, ['#ffffff', '#0a5028', '#0a4628', '#0a5032', '#5aa028', '#64aa28'], '#82dc3c')
      const mark = '#64aa28'
      for (const [x, y, w, h] of [[11, 28, 2, 2], [19, 28, 2, 2], [13, 33, 3, 2], [17, 33, 3, 2], [15, 25, 2, 2]])
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (inset(f, x + i, y + j, 1)) f.over(x + i, y + j, mark)
    },
    side(f, { src, slug }) {
      dropFarEye(slug, f, src.down)
      muzzle(f, [[16, 1], [17, 2], [18, 1]], '#82dc3c', '#64aa28')
    },
  },

  /* ── 고슴도치 ────────────────────────────────────────────────────────────
     뒤: 등 전체가 가시입니다. 시안 뒷모습은 머리 둘레에만 가시가 있고 등은
         맨살이었습니다. 옆모습(x6-9)에 이미 있는 가시 색으로 등을 채웁니다.
     옆: 눈 하나 + 뾰족한 코. */
  hedgehog: {
    back(f) {
      const q = ['#735242', '#523929', '#9c7352', '#391908']
      for (let y = 9; y <= 39; y++)
        for (let x = 6; x <= 25; x++) {
          if (!inset(f, x, y, y < 23 ? 2 : 1)) continue
          /* 가시는 줄마다 반 칸씩 엇갈린 비늘 무늬입니다. 세로줄로 그으면
             가시가 아니라 빗금으로 보입니다. */
          const row = y - 23
          const k = (x + (row % 2 ? 2 : 0)) % 4
          f.over(x, y, k === 0 ? q[0] : k === 2 ? q[1] : row % 4 === 0 ? q[2] : q[0])
          if (k === 1 && row % 2 === 0) f.over(x, y, q[3])
        }
      // 가장자리 한 겹은 더 짙게 — 등이 둥글게 부풀어 보입니다
      for (let y = 23; y <= 39; y++) {
        const s = span(f, y)
        if (s) { f.over(s[0] + 1, y, '#391908'); f.over(s[1] - 1, y, '#391908') }
      }
    },
    side(f, { src, slug }) {
      dropFarEye(slug, f, src.down)
      muzzle(f, [[16, 2], [17, 2], [18, 1]], '#e6b48c', '#be8c64')
    },
  },

  /* ── 알파카 ──────────────────────────────────────────────────────────────
     뒤: 등털. 알파카는 앞뒤가 온통 같은 크림색이라 아무것도 안 하면 뒤가
         앞처럼 보입니다. 곱슬 무늬를 등에 얹고 목덜미에 그늘을 넣습니다.
     옆: 눈 하나 + 긴 주둥이. */
  alpaca: {
    back(f) {
      const curl = '#dcbea0', deep = '#e6d2b4'
      for (let y = 25; y <= 39; y++)
        for (let x = 6; x <= 25; x++) {
          if (!inset(f, x, y, 1)) continue
          /* 곱슬 — 두 줄 간격으로 반 칸 엇갈린 점. 촘촘하면 때가 낀 것처럼
             보이고 성기면 무늬로 안 읽혀서, 3칸 간격이 이 크기의 한계입니다. */
          if ((x + (y % 4 < 2 ? 0 : 2)) % 4 === 0 && y % 2 === 0) f.over(x, y, curl)
          else if ((x + (y % 4 < 2 ? 0 : 2)) % 4 === 1 && y % 2 === 0) f.over(x, y, deep)
        }
      noFace(f, ['#786450', '#826450', '#785a46', '#785a50'], '#fae6d2')
      // 목덜미 그늘 — 네모로 칠하면 상자를 얹은 것처럼 보입니다
      ellipse(f, 15.5, 26, 5, 3, (x, y, t) => (t > 0.55 ? null : deep), { d: 1 })
      ellipse(f, 15.5, 38, 2.4, 2, (x, y, t) => (t > 0.6 ? '#dcbe96' : curl), { d: 1 })
    },
    side(f, { src, slug }) {
      dropFarEye(slug, f, src.down)
      muzzle(f, [[15, 1], [16, 2], [17, 2], [18, 1]], '#fae6d2', '#dcbea0')
    },
  },

  /* ── 백조 ────────────────────────────────────────────────────────────────
     뒤: 접은 날개 두 짝. 흰 새는 뒤에서 보면 날개 선이 전부라, 몸통 양쪽에
         날개를 얹고 깃 선을 긋습니다. 꼬리는 엉덩이에서 한 번 솟습니다.
     옆: 눈 하나 + 부리를 앞으로. */
  swan: {
    back(f) {
      const wing = '#d2d2d2', quill = '#acacac', edge = '#505050'
      noFace(f, ['#464646', '#505050'], '#ffffff')
      /* 날개는 흰 채로 두고 **테두리와 깃 선만** 긋습니다. 회색으로 채우면
         흰 새 등에 회색 덩이 둘을 얹은 꼴이라 가방으로 보입니다. */
      for (const s of [-1, 1]) {
        const cx = 15.5 + s * 3.4
        ellipse(f, cx, 33, 3.4, 5.4, (x, y, t) => {
          if (t > 0.86) return t > 0.94 ? edge : quill
          return (x * s + y) % 3 === 0 && t > 0.3 ? wing : null
        }, { d: 1 })
      }
      // 꼬리 — 엉덩이 한가운데가 한 번 솟습니다
      ellipse(f, 15.5, 38.5, 2.2, 2, (x, y, t) => (t > 0.62 ? quill : '#ffffff'), { d: 1 })
    },
    side(f, { src, slug }) {
      dropFarEye(slug, f, src.down)
      beakOut(f, ['#faa05a', '#f0823c'], 14, 21, '#ffffff')
      muzzle(f, [[16, 1], [17, 1]], '#ffffff', '#d2d2d2')
    },
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 검사
// ─────────────────────────────────────────────────────────────────────────────

const problems = []
const fail = (m) => problems.push(m)

function checkFrame(slug, dir, src, out, palette) {
  // 2. 몸에서 픽셀을 빼지 않았는가
  let lost = 0
  for (let y = 0; y < FRAME_H; y++)
    for (let x = 0; x < FRAME_W; x++) if (src.get(x, y) && !out.get(x, y)) lost++
  if (lost) fail(`${slug}/${dir}: 원본 몸에서 ${lost}px 이 사라졌습니다 (아이템이 그만큼 잘립니다)`)

  // 3. 새 색을 만들지 않았는가
  const strange = new Set()
  for (let y = 0; y < FRAME_H; y++)
    for (let x = 0; x < FRAME_W; x++) {
      const k = out.key(x, y)
      if (k && !palette.has(k)) strange.add(k)
    }
  if (strange.size) fail(`${slug}/${dir}: 원본에 없는 색 ${[...strange].join(' ')}`)

  /* 4. 머리 위 예약줄 — 고슴도치 가시는 시안이 이미 y4 까지 씁니다.
     그래서 "비어 있어야 한다" 가 아니라 "**더 높이 올리지 않는다**" 로 봅니다. */
  let raised = 0
  for (let y = 0; y < Y.timerReserve; y++)
    for (let x = 0; x < FRAME_W; x++) if (out.get(x, y) && !src.get(x, y)) raised++
  if (raised) fail(`${slug}/${dir}: 세션 시계 자리(y<${Y.timerReserve})로 ${raised}px 이 올라갔습니다`)
}

// ─────────────────────────────────────────────────────────────────────────────
// 실행
// ─────────────────────────────────────────────────────────────────────────────

function build(slug) {
  const img = readPNG(resolve(SRC_DIR, slug + '.png'))
  if (img.w !== FRAME_W * DIRS.length || img.h !== FRAME_H)
    throw new Error(`${slug}: 원본이 ${FRAME_W * DIRS.length}x${FRAME_H} 가 아닙니다`)
  const palette = paletteOf(img)
  const shade = shadeTable(palette)
  const src = {}
  DIRS.forEach((d, i) => { src[d] = Frame.from(img, i) })

  const out = { down: src.down, up: src.up.clone(), right: src.right.clone() }
  const P = PAINT[slug]
  const ctx = { slug, palette, shade, src, S: (k) => shade.get(k) || k }
  if (P?.back) P.back(out.up, ctx)
  if (P?.side) P.side(out.right, ctx)
  /* 왼쪽은 오른쪽을 뒤집어 만듭니다 — 좌우가 어긋날 수 없고, 원본도 그렇게
     되어 있습니다(left ≠ mirror(right) 인 픽셀이 8종 모두 0). */
  out.left = out.right.mirror()

  for (const d of DIRS) checkFrame(slug, d, src[d], out[d], palette)
  // 1. 정면은 그대로인가
  if (Buffer.compare(out.down.px, src.down.px) !== 0) fail(`${slug}: 정면(down)이 바뀌었습니다`)

  const sheet = { w: FRAME_W * DIRS.length, h: FRAME_H, px: Buffer.alloc(FRAME_W * DIRS.length * FRAME_H * 4, 0) }
  DIRS.forEach((d, i) => {
    for (let y = 0; y < FRAME_H; y++)
      for (let x = 0; x < FRAME_W; x++)
        out[d].px.copy(sheet.px, (y * sheet.w + i * FRAME_W + x) * 4, (y * FRAME_W + x) * 4, (y * FRAME_W + x) * 4 + 4)
  })
  writePNG(resolve(CHAR_DIR, slug + '.png'), sheet)
  return { slug, up: diffCount(src.up, out.up), side: diffCount(src.right, out.right), palette: palette.size }
}

function diffCount(a, b) {
  let n = 0
  for (let y = 0; y < FRAME_H; y++)
    for (let x = 0; x < FRAME_W; x++) if (a.key(x, y) !== b.key(x, y)) n++
  return n
}

const rows = SPECIES.map(build)
console.log('종         뒷모습 고친 px  옆모습 고친 px  팔레트')
for (const r of rows)
  console.log(r.slug.padEnd(10), String(r.up).padStart(8), String(r.side).padStart(14), String(r.palette).padStart(8))

if (problems.length) {
  console.error('\n검사 실패:')
  for (const p of problems) console.error(' ✗ ' + p)
  process.exit(1)
}
console.log('\n검사 통과 — 정면 그대로 · 실루엣 안 줄어듦 · 원본 팔레트 안 · 예약줄 비움')

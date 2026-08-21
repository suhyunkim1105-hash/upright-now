/* ══════════════════════════════════════════════════════════
   기린캠퍼스 야외 — 아이소메트릭 섬 하나.

   3D 판과 **같은 세계 좌표**를 씁니다. 건물 여섯의 자리·방향,
   광장 반지름, 섬 반지름이 전부 그대로라 자리 목록(spots.js)과
   사람 경로(npcs.js)를 한 줄도 안 고치고 씁니다.

   바닥은 매 프레임 칸을 다시 찍지 않습니다. 섬 전체를 큰 그림 한 장으로
   **한 번만** 구워 두고 보이는 만큼만 잘라 붙입니다 — 6400칸을 60번씩
   찍으면 노트북이 웁니다.
   ══════════════════════════════════════════════════════════ */
import * as I from './iso.js';
import { PROPS, C } from './props.js';

export const HALF = 40;          // 섬 반지름
export const ISLAND_R = HALF - 2.6;
export const PLAZA_R = 12;

/* 건물 여섯 — 자리 · 방향 · 크기. ry 는 정면(+z)이 도는 각도입니다.
   정면 방향 = (sin ry, cos ry). */
export const BUILDINGS = [
  { key: 'mainHall', zone: 'mainhall', name: '본관',        sub: '강의실 · 대중음악',
    x: -23, z: 0,   ry: Math.PI / 2,    s: 1, w: 12.0, d: 8.0, h: 7.0, col: '#F2C98A', roof: '#B0543A' },
  { key: 'library',  zone: 'library',  name: '도서관',      sub: '백색소음 · 오래 앉는 자리',
    x: 23,  z: 0,   ry: -Math.PI / 2,   s: 1, w: 12.6, d: 8.2, h: 7.4, col: '#C9E2F2', roof: '#5B84C4' },
  { key: 'dorm',     zone: 'dorm',     name: '기숙사',      sub: '내 방 · 1인실',
    x: 0,   z: -22, ry: 0,              s: 1, w: 9.4,  d: 6.4, h: 6.4, col: '#F2DE9A', roof: '#C97A22' },
  { key: 'union',    zone: 'union',    name: '학생회관',    sub: '볼일 보는 곳',
    x: 0,   z: 22,  ry: Math.PI,        s: 1, w: 10.4, d: 6.8, h: 6.4, col: '#F2A9A0', roof: '#B0543A' },
  { key: 'arcade',   zone: 'arcade',   name: '미니게임관',  sub: '3분만 놀고 가는 곳',
    x: 19,  z: -19, ry: -Math.PI / 4,   s: 1, w: 9.0,  d: 6.6, h: 6.2, col: '#C9B8E8', roof: '#6B4AA8' },
  { key: 'shop',     zone: 'clubshop', name: '동아리 상점', sub: '옷 · 가구 · 알',
    x: -19, z: 19,  ry: Math.PI * .75,  s: 1, w: 8.6,  d: 6.2, h: 6.0, col: '#B8E0A8', roof: '#3E8F4C' },
];

/* 대각선으로 놓인 두 채는 격자에 맞춰 세웁니다 — 픽셀아트에 45도는 없습니다.
   대신 문이 광장을 보도록 방향만 남깁니다. */
const AXIS = (ry) => Math.round(ry / (Math.PI / 2)) * (Math.PI / 2);

let _s = 20260821;
const rnd = () => (_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

/* ── 기물 굽기 ── 한 번 그려 두고 그 뒤로는 붙이기만 합니다 */
const BAKED = new Map();
export function bakeProp(kind, ry = 0, p = {}) {
  const key = kind + '|' + ry.toFixed(2) + '|' + JSON.stringify(p);
  let v = BAKED.get(key); if (v) return v;
  const D = PROPS[kind];
  const w = p.w || D.w, d = p.d || D.d, h = (p.h || D.h) + 1;
  const mx = Math.ceil((w + d) * I.UY) + 28;
  const top = Math.ceil((w + d) * I.UY / 2 + h * I.UH) + 30;
  const bot = Math.ceil((w + d) * I.UY / 2) + 16;
  const c = document.createElement('canvas');
  c.width = mx * 2; c.height = top + bot;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  D.draw(g, { x: mx, y: top }, 0, 0, ry, p);
  v = { img: c, ox: mx, oy: top };
  BAKED.set(key, v); return v;
}

/* ── 건물 굽기 ── 벽 · 지붕 · 창 · 문 · 간판 한 장 */
export function bakeBuilding(b, pixelText) {
  const w = b.w, d = b.d, h = b.h;
  const mx = Math.ceil((w + d) * I.UY) + 30;
  const top = Math.ceil((w + d) * I.UY / 2 + (h + 2.6) * I.UH) + 40;
  const bot = Math.ceil((w + d) * I.UY / 2) + 18;
  const c = document.createElement('canvas');
  c.width = mx * 2; c.height = top + bot;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const o = { x: mx, y: top };
  I.shadow(g, o, 0, 0, Math.max(w, d) * .52, .16);
  /* 벽 */
  I.box(g, o, 0, 0, 0, w, d, h, b.col, { top: I.sh(b.col, 10) });
  /* 창 — 앞쪽 두 면에만. 뒷면은 안 보입니다 */
  const rows = h > 6.6 ? 2 : 1;
  for (let r = 0; r < rows; r++) {
    const wy = 1.6 + r * 2.4;
    for (let i = 0; i < Math.floor(w / 2.4); i++) {
      const x = -w / 2 + 1.4 + i * 2.2;
      I.box(g, o, x, d / 2 + .02, wy, 1.2, .06, 1.4, '#3E5C82', { top: '#3E5C82', left: '#9FD8F2', right: '#7FBEE0' });
    }
    for (let i = 0; i < Math.floor(d / 2.4); i++) {
      const z = -d / 2 + 1.4 + i * 2.2;
      I.box(g, o, w / 2 + .02, z, wy, .06, 1.2, 1.4, '#3E5C82', { top: '#3E5C82', left: '#8FC8EC', right: '#6FAED4' });
    }
  }
  /* 문 — 광장 쪽. 앞면(+z) 또는 오른면(+x) */
  const fx = Math.sin(b.ry), fz = Math.cos(b.ry);
  if (Math.abs(fz) > Math.abs(fx)) {
    I.box(g, o, 0, (fz > 0 ? d / 2 : -d / 2) + .04 * Math.sign(fz), 0, 2.4, .08, 3.0, '#6B4728',
      { top: '#8A5F3C', left: '#8A5F3C', right: '#70492B' });
    I.plate(g, o, 0, (fz > 0 ? d / 2 + 1.2 : -d / 2 - 1.2), .02, 3.0, 2.0, C.stone);
  } else {
    I.box(g, o, (fx > 0 ? w / 2 : -w / 2) + .04 * Math.sign(fx), 0, 0, .08, 2.4, 3.0, '#6B4728',
      { top: '#8A5F3C', left: '#8A5F3C', right: '#70492B' });
    I.plate(g, o, (fx > 0 ? w / 2 + 1.2 : -w / 2 - 1.2), 0, .02, 2.0, 3.0, C.stone);
  }
  /* 지붕 — 낮은 모임지붕. 뾰족하게 올리면 서커스 천막이 됩니다 */
  for (let k = 0; k < 3; k++) {
    const s = 1 - k * .22;
    I.box(g, o, 0, 0, h + k * .34, w * s + (k ? 0 : .8), d * s + (k ? 0 : .8), .34,
      I.sh(b.roof, k * 10), { top: I.sh(b.roof, 14 + k * 10) });
  }
  /* 간판 — **보이는 두 면에 모두** 답니다.
     시점이 고정이라 +x 와 +z 면만 보입니다. 문이 광장 쪽(−x·−z)을 보는
     건물은 간판을 문 옆에만 달면 영영 안 보입니다. */
  const t = pixelText(b.name, 11, '#FFF6E2');
  const sy = h - 1.9, sw = (t.width + 12) / I.UX, sd = (t.width + 12) / I.UX;
  I.box(g, o, 0, d / 2 + .05, sy, Math.min(sw, w - .6), .1, 1.0, '#241E2B');
  g.drawImage(t, Math.round(o.x + I.px(0, d / 2) - t.width / 2),
    Math.round(o.y + I.py(0, d / 2, sy + .78) - 1));
  I.box(g, o, w / 2 + .05, 0, sy, .1, Math.min(sd, d - .6), 1.0, '#241E2B');
  g.drawImage(t, Math.round(o.x + I.px(w / 2, 0) - t.width / 2),
    Math.round(o.y + I.py(w / 2, 0, sy + .78) - 1));
  return { img: c, ox: mx, oy: top };
}

/* ── 섬 바닥 한 장 ── */
export function bakeGround() {
  const R = HALF + 6;
  const W = Math.ceil(R * 2 * I.UX * 2), H = Math.ceil(R * 2 * I.UY * 2) + 80;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const o = { x: W / 2, y: H / 2 };
  /* 바다 — 화면 전체를 채우지 않습니다. 섬 밖은 배경색이 맡습니다 */
  I.ellipse(g, o, 0, 0, -.9, HALF + 5.5, '#8FD8EE');
  I.ellipse(g, o, 0, 0, -.6, HALF + 3.0, '#F2E2B8');          // 모래톱
  /* 흙 벼랑 — 섬이 물에 잠긴 판때기가 아니라 **덩어리**로 보이게 */
  for (let k = 22; k >= 0; k--) I.ellipse(g, o, 0, 0, -k * .1, HALF + .6, k > 14 ? '#6E4A2C' : '#8A5F3C');
  I.ellipse(g, o, 0, 0, 0, HALF, C.grassD);
  I.ellipse(g, o, 0, 0, .02, HALF - .6, C.grass);
  /* 잔디 얼룩 — 한 색으로 두면 당구대입니다 */
  for (let i = 0; i < 220; i++) {
    const a = rnd() * Math.PI * 2, r = 6 + rnd() * (HALF - 12);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x, z) < PLAZA_R + 2) continue;
    I.plate(g, o, x, z, .03, 2 + rnd() * 4, 2 + rnd() * 4, rnd() < .5 ? C.grassD : C.grassL);
  }
  /* 길 — 광장에서 건물 여섯으로. 길은 잔디보다 위에 깝니다 */
  BUILDINGS.forEach((b) => {
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = b.x * t * .82, z = b.z * t * .82;
      I.plate(g, o, x, z, .05, 3.4, 3.4, C.path);
    }
  });
  /* 광장 */
  I.ellipse(g, o, 0, 0, .08, PLAZA_R + .7, C.stoneD);
  I.ellipse(g, o, 0, 0, .10, PLAZA_R, C.stone);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    for (let r = 2.2; r < PLAZA_R - 1; r += .5)
      I.plate(g, o, Math.cos(a) * r, Math.sin(a) * r, .12, .5, .5, C.stoneD);
  }
  /* 산책로 — 섬 둘레를 한 바퀴 */
  for (let i = 0; i < 220; i++) {
    const a = (i / 220) * Math.PI * 2, r = HALF - 5.5;
    I.plate(g, o, Math.cos(a) * r, Math.sin(a) * r, .05, 2.6, 2.6, C.pathD);
  }
  return { img: c, ox: W / 2, oy: H / 2 };
}

/* ── 기물 배치 ── */
export function layout() {
  const props = [];
  const add = (kind, x, z, ry = 0, p = {}) => props.push({ kind, x, z, ry, p });

  /* 광장 — 동상 · 분수 · 벤치 넷 · 가로등 여덟 */
  add('fountain', 0, 0);
  add('statue', 0, 0);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    add('bench', Math.cos(a) * 8.4, Math.sin(a) * 8.4, i % 2 ? Math.PI / 2 : 0);
  }
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    add('lamp', Math.cos(a) * 13.4, Math.sin(a) * 13.4);
  }
  add('bin', 9.6, 9.6); add('bin', -9.6, -9.6);
  /* 게시판 둘 · 이정표 — spots.js 의 자리와 맞춥니다 */
  add('board', -8.6, 14.2, 0, { roof: 1 });
  add('board', 8.6, 14.2, 0, { roof: 1 });
  add('sign', 5.0, 15.4, 0, { arms: 3 });
  add('gate', 20.5, 21.4, Math.PI / 2);
  add('busstop', 26.5, 16.4, 0);
  /* 화단 넷 */
  [[13, -6], [-13, 6], [6, 13], [-6, -13]].forEach(([x, z], i) => add('planter', x, z, 0, { seed: i }));

  /* 건물 앞 — 벤치와 화분 */
  BUILDINGS.forEach((b, i) => {
    const fx = Math.sin(b.ry), fz = Math.cos(b.ry);
    add('bench', b.x + fx * 5.6 - fz * 3.4, b.z + fz * 5.6 + fx * 3.4, Math.abs(fx) > Math.abs(fz) ? 0 : Math.PI / 2);
    add('plant', b.x + fx * 5.2 + fz * 3.0, b.z + fz * 5.2 - fx * 3.0, 0, { s: 1.4 });
    add('lamp', b.x + fx * 7.6, b.z + fz * 7.6);
  });

  /* 나무 이백 그루 — 건물과 길을 피해서 */
  const near = (x, z) => BUILDINGS.some((b) =>
    Math.abs(x - b.x) < b.w / 2 + 3 && Math.abs(z - b.z) < b.d / 2 + 3);
  const onPath = (x, z) => BUILDINGS.some((b) => {
    const L = Math.hypot(b.x, b.z), t = (x * b.x + z * b.z) / (L * L);
    if (t < 0 || t > .9) return false;
    return Math.hypot(x - b.x * t, z - b.z * t) < 3.4;
  });
  for (let i = 0; i < 260; i++) {
    const a = rnd() * Math.PI * 2, r = PLAZA_R + 2.5 + rnd() * (HALF - PLAZA_R - 7);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (near(x, z) || onPath(x, z)) continue;
    if (Math.hypot(x, z) > HALF - 4.4) continue;
    const k = rnd();
    if (k < .42) add('tree', x, z, 0, { col: ['#53B84E', '#3C9440', '#6FBE68'][(i % 3)], s: .85 + rnd() * .4 });
    else if (k < .66) add('pine', x, z);
    else if (k < .86) add('bush', x, z, 0, { col: rnd() < .5 ? '#4FA85A' : '#5FB863' });
    else add('flowers', x, z, 0, { seed: i });
  }
  return props;
}

/* ── 부딪히는 것 ── 건물은 네모, 나무는 작은 네모 */
export function colliders(props) {
  const out = BUILDINGS.map((b) => ({ x: b.x, z: b.z, w: b.w, d: b.d, big: 1 }));
  for (const p of props) {
    const D = PROPS[p.kind];
    if (!D || !D.solid) continue;
    const sw = Math.abs(Math.round(p.ry / (Math.PI / 2))) % 2;
    const w = p.p.w || D.w, d = p.p.d || D.d;
    out.push({ x: p.x, z: p.z, w: sw ? d : w, d: sw ? w : d });
  }
  return out;
}

/** 문 앞 — 들어가는 자리 */
export function portals() {
  return BUILDINGS.map((b) => {
    const fx = Math.sin(b.ry), fz = Math.cos(b.ry);
    const dd = (Math.abs(fz) > Math.abs(fx) ? b.d : b.w) / 2 + 1.9;
    return { zone: b.zone, name: b.name, key: b.key,
      x: b.x + fx * dd, z: b.z + fz * dd, r: 2.6, ry: b.ry };
  });
}

/* ══════════════════════════════════════════════════════════
   실내 여섯 — 아이소메트릭 잘라 낸 방(cutaway).
   바닥 + 뒤벽(-z) + 왼벽(-x) 셋만 세웁니다. 넷을 다 세우면 안이 안
   보이고, 하나만 세우면 방이 아니라 무대가 됩니다.

   **이 파일의 규칙 하나: 통로가 먼저다.**
   가구는 CORRIDORS 바깥에만 놓습니다. 3D 판에서 이 규칙을 안 지켰다가
   방마다 걸을 수 있는 바닥이 7~26% 뿐이었고, 문 앞 시작 자리가 여섯 중
   넷에서 가구 안에 박혀 **한 발짝도 못 움직였습니다.**
   ══════════════════════════════════════════════════════════ */
import * as I from './iso.js';
import { PROPS, C } from './props.js';

export const ROOM_SIZE = {
  library:  { w: 26, d: 18, h: 5.0 },
  mainhall: { w: 22, d: 16, h: 4.6 },
  dorm:     { w: 14, d: 11, h: 4.2 },
  union:    { w: 22, d: 15, h: 4.6 },
  arcade:   { w: 20, d: 14, h: 4.6 },
  shop:     { w: 20, d: 14, h: 4.6 },
};
export const ROOM_NAME = {
  library:  ['도서관', '백색소음 · 오래 앉는 자리'],
  mainhall: ['본관', '강의실 · 대중음악'],
  dorm:     ['기숙사', '내 방 · 1인실'],
  union:    ['학생회관', '볼일 보는 곳'],
  arcade:   ['미니게임관', '3분만 놀고 가는 곳'],
  shop:     ['동아리 상점', '옷 · 가구 · 알'],
};
export const CORRIDORS = {
  library:  [[-2.4, -8.0, 2.4, 8.6], [-12.6, 2.9, 9.0, 4.9], [-12.6, -6.4, 12.6, -5.2], [9.6, -7.4, 10.4, 2.4]],
  mainhall: [[-2.6, -7.5, 2.6, 8.0], [-11, 3.9, 11, 5.4], [-11, -5.8, 11, -4.4]],
  dorm:     [[-1.7, -4.6, 1.7, 5.4], [-7, 0.4, 7, 2.2]],
  union:    [[-2.6, -6.6, 2.6, 5.4], [-11, 1.0, 11, 3.0], [-11, -4.4, 11, -3.2]],
  arcade:   [[-2.4, -6.0, 2.4, 6.8], [-10, 0.6, 10, 2.6]],
  shop:     [[-2.4, -6.0, 2.4, 6.8], [-10, 0.4, 10, 2.4]],
};

const PAL = {
  library:  { fa: '#C9945C', fb: '#B8814A', wall: '#F2E8D4' },
  mainhall: { fa: '#D8CEB8', fb: '#C9BEA6', wall: '#F6EDDC' },
  dorm:     { fa: '#D8A86E', fb: '#C2925C', wall: '#F6E8D8' },
  union:    { fa: '#E2DAC8', fb: '#D2C8B2', wall: '#F6F0E2' },
  arcade:   { fa: '#4A4566', fb: '#3E3A56', wall: '#463F63' },
  shop:     { fa: '#E8DCC4', fb: '#D8CAAE', wall: '#FFF2DE' },
};

const R2 = Math.PI / 2;
/** 가구 한 줄 — [종류, x, z, 방향, 옵션] */
export const ROOMS = {
  library: [
    /* 뒤벽 서가 여덟 */
    ...[-12.0, -10.1, -8.2, -6.3, -4.4].map((x) => ['shelf', x, -8.2, 0, { w: 1.8, h: 2.6 }]),
    ['bookCart', -4.6, 6.6, 0],
    /* 뒤 오른쪽 1인 캐럴 */
    ...[3.8, 5.8, 7.8].map((x) => ['carrel', x, -8.0, Math.PI]),
    ...[3.8, 5.8, 7.8].map((x) => ['chair', x, -7.0, Math.PI, { col: '#E0B888', seat: 1 }]),
    /* 왼벽 캐럴 넷 */
    ...[-4.4, -2.2, 0, 2.2].map((z) => ['carrel', -12.2, z, R2]),
    ...[-4.4, -2.2, 0, 2.2].map((z) => ['chair', -10.9, z, -R2, { col: '#E0B888', seat: 1 }]),
    /* 열람 탁자 둘 */
    ['table', -7.6, -1.8, 0, { w: 4.6, d: 2.4 }],
    ...[-1.6, -.55, .55, 1.6].flatMap((t) => [
      ['chair', -7.6 + t * 1.1, -3.3, 0, { seat: 1 }], ['chair', -7.6 + t * 1.1, -.3, Math.PI, { seat: 1 }]]),
    ['deskLamp', -9.4, -1.8, 0], ['books', -8.5, -1.4, 0, { n: 3 }], ['laptop', -6.4, -2.3, Math.PI],
    ['table', 6.2, -1.8, 0, { w: 4.6, d: 2.4 }],
    ...[-1.6, -.55, .55, 1.6].flatMap((t) => [
      ['chair', 6.2 + t * 1.1, -3.3, 0, { seat: 1 }], ['chair', 6.2 + t * 1.1, -.3, Math.PI, { seat: 1 }]]),
    ['deskLamp', 4.4, -1.8, 0], ['laptop', 7.0, -2.3, Math.PI],
    /* 창가 높은 자리 */
    ...[-.6, 1.4, 3.4].map((z) => ['chair', 11.9, z, -R2, { col: '#C98E4E', seat: 1 }]),
    ['plant', 12.3, -3.2, 0, { s: 1.2 }],
    /* 앞쪽 — 대출대 · 쉬는 자리 */
    ['counter', -8.4, 6.6, 0, { w: 4.2 }],
    ['sofa', 6.6, 6.2, Math.PI, { w: 3.0, col: '#7FA8C4' }],
    ['lowTable', 6.6, 4.6, 0], ['plant', 10.6, 6.4, 0, { s: 1.3 }],
    ['doormat', 0, 8.2, 0, { col: '#4E8C9E' }],
  ],
  mainhall: [
    ['blackboard', 0, -7.6, 0, { w: 6.0 }],
    ['podium', -5.4, -5.6, 0], ['projScreen', 4.4, -7.4, 0, { w: 3.4 }],
    ['desk', 4.4, -5.6, 0, { w: 2.4, d: 1.0 }],
    /* 책상 넷 줄 × 셋 */
    ...[-2.4, .4, 3.2].flatMap((z) => [-7.4, -4.6, 4.6, 7.4].map((x) =>
      ['desk', x, z, 0, { w: 2.4, d: 1.1 }])),
    ...[-2.4, .4, 3.2].flatMap((z) => [-7.4, -4.6, 4.6, 7.4].map((x) =>
      ['chair', x, z + 1.15, Math.PI, { seat: 1 }])),
    ['locker', -9.6, -1.2, R2, { n: 4 }],
    ['stackChairs', 9.6, -1.4, 0, { n: 5 }],
    ['plant', 9.8, 5.8, 0, { s: 1.3 }], ['plant', -9.8, 5.8, 0, { s: 1.3 }],
    ['radiator', 0, -7.7, 0], ['guitar', -9.4, 3.0, 0],
    ['doormat', 0, 7.4, 0, { col: '#C98E4E' }],
  ],
  dorm: [
    ['bed', -3.4, -3.0, 0], ['rug', 0, 0, 0, { w: 3.4, d: 2.6 }],
    ['desk', 4.2, -2.2, 0, { w: 2.6, d: 1.2 }],
    ['chair', 4.6, -.7, 0, { seat: 1 }],
    ['laptop', 4.2, -2.4, Math.PI], ['deskLamp', 3.0, -2.4, 0], ['books', 5.2, -2.2, 0, { n: 4 }],
    ['wardrobe', 2.5, -4.6, 0], ['board', -3.0, -4.6, 0, {}],
    ['plant', 5.8, 3.4, 0, { s: 1.1 }], ['laundry', -5.4, 3.2, 0],
    ['lowTable', -3.6, 3.0, 0], ['cabinet', 5.8, .6, R2, { w: 1.2 }],
    ['doormat', 0, 4.9, 0, { col: '#63C47C' }],
  ],
  union: [
    ['counter', -6.6, -5.2, 0, { w: 6.4, col: '#8E6238' }],
    ['trayCounter', 6.4, -5.2, 0],
    ['vending', 8.9, -5.6, 0, { col: '#E8695A' }], ['vending', 10.3, -5.6, 0, { col: '#5B84C4' }],
    ['cooler', 3.4, -5.4, 0],
    ['board', -10.0, -3.0, R2, {}],
    /* 라운지 */
    ['sofa', -2.4, 5.0, Math.PI, { w: 3.0, col: '#9B7BD4' }],
    ['sofa', 2.4, 5.0, Math.PI, { w: 3.0, col: '#63C47C' }],
    ['lowTable', 0, 3.4, 0, { w: 2.0, d: 1.2 }],
    ...[-8.4, -5.6, 5.6, 8.4].flatMap((x) => [
      ['table', x, -.4, 0, { w: 2.2, d: 1.6 }],
      ['chair', x, .9, Math.PI, { seat: 1 }], ['chair', x, -1.7, 0, { seat: 1 }]]),
    ['plant', -10.2, 5.4, 0, { s: 1.4 }], ['plant', 10.2, 5.4, 0, { s: 1.4 }],
    ['coffee', -9.4, -5.2, 0], ['bin', 9.8, 4.6, 0],
    ['doormat', 0, 6.9, 0, { col: '#E8935A' }],
  ],
  arcade: [
    ...[[-8.4, '#5B84C4'], [-6.3, '#E8695A'], [6.3, '#63C47C'], [8.4, '#F2C14E']].map(
      ([x, col]) => ['arcade', x, -4.6, Math.PI, { col }]),
    ['claw', -6.9, -1.5, Math.PI], ['airHockey', 6.6, -.5, 0],
    ['photoBooth', 7.4, 3.4, Math.PI], ['dancePad', -6.4, 3.2, 0],
    ['prizeShelf', 0, -5.8, 0], ['bin', 9.4, 5.4, 0],
    ['stanchion', -3.4, -1.6, 0], ['stanchion', 3.4, -1.6, 0],
    ['bench', -1.0, 5.4, 0], ['bench', 1.6, 5.4, 0],
    ['doormat', 0, 6.4, 0, { col: '#9B7BD4' }],
  ],
  shop: [
    ['counter', -6.4, 6.0, Math.PI, { w: 3.4, col: '#8E6238' }],
    ['counter', 6.4, 6.0, Math.PI, { w: 3.4, col: '#8E6238' }],
    ['displayTable', 0, 3.6, 0], ['displayTable', 0, 1.2, 0],
    ['rack', -6.9, -3.6, 0], ['rack', -3.4, -3.6, 0],
    ['shoeShelf', -9.0, -.4, R2],
    ['mannequin', -8.4, 3.0, 0, { top: '#E8695A', bot: '#3E5C82' }],
    ['mannequin', -7.4, 4.4, 0, { top: '#2DD4BF', bot: '#4A4A58' }],
    ...[5.4, 6.8, 8.2].map((x, i) => ['eggStand', x, -1.6, 0,
      { col: ['#F2C14E', '#9EDCEB', '#F5A0B8'][i] }]),
    ['eggStand', 6.1, -3.4, 0, { col: '#63C47C' }], ['eggStand', 7.5, -3.4, 0, { col: '#E8935A' }],
    ['cabinet', 9.2, 3.2, R2, { w: 1.6 }],
    ['plant', 9.2, 5.8, 0, { s: 1.2 }],
    ['doormat', 0, 6.4, 0, { col: '#2DD4BF' }],
  ],
};

/** 방 껍데기 한 장 — 바닥 널 · 뒤벽 · 왼벽 · 걸레받이 · 창 */
export function bakeRoom(key) {
  const S = ROOM_SIZE[key], p = PAL[key];
  const W = Math.ceil((S.w + S.d) * I.UX) + 120;
  const H = Math.ceil((S.w + S.d) * I.UY) + Math.ceil(S.h * I.UH) + 140;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const o = { x: W / 2 + (S.d - S.w) * I.UY, y: 80 + Math.ceil(S.h * I.UH) };
  /* 바닥 — 판을 한 장으로 두면 장판입니다. 널을 깔아야 마루가 됩니다.
     널 사이에 틈을 두면 **그 틈으로 바깥 배경이 비칩니다** — 파란 점선이
     방을 가로지르던 것이 그것이었습니다. 밑판을 먼저 한 장 깝니다. */
  I.plate(g, o, 0, 0, 0, S.w, S.d, p.fb);
  const n = Math.max(6, Math.round(S.w / 1.1));
  for (let i = 0; i < n; i++) {
    const bw = S.w / n;
    I.plate(g, o, -S.w / 2 + bw * (i + .5), 0, .01, bw - .04, S.d, i % 2 ? p.fa : p.fb);
  }
  /* 벽 둘 — 우리가 보는 것은 **벽의 안쪽**입니다. 상자의 기본 음영은
     바깥면 기준이라, 그대로 두면 방 안쪽 벽이 제일 어두운 면이 됩니다
     (미니게임관 왼벽이 새까만 판이었던 이유). 안쪽 면만 밝게 지정합니다. */
  I.box(g, o, 0, -S.d / 2 - .17, 0, S.w + .34, .34, S.h, p.wall,
    { top: '#FFF8EC', left: p.wall, right: I.sh(p.wall, -18) });
  I.box(g, o, -S.w / 2 - .17, 0, 0, .34, S.d, S.h, p.wall,
    { top: '#FFF8EC', left: I.sh(p.wall, -18), right: I.sh(p.wall, -8) });
  /* 걸레받이 · 몰딩 */
  I.box(g, o, 0, -S.d / 2 + .12, 0, S.w, .2, .34, '#E2D6BE');
  I.box(g, o, -S.w / 2 + .12, 0, 0, .2, S.d, .34, '#D8CBB2');
  /* 창 — 밖이 밝아야 실내가 실내로 읽힙니다 */
  const nw = Math.max(2, Math.floor(S.w / 5));
  for (let i = 0; i < nw; i++) {
    const x = -S.w / 2 + (i + .5) * (S.w / nw);
    I.box(g, o, x, -S.d / 2 + .02, 1.6, 2.2, .1, 2.0, '#C8A87E', { top: '#E0C49A' });
    I.box(g, o, x, -S.d / 2 + .08, 1.75, 1.9, .06, 1.7, '#BFEAF5', { top: '#D8F2FA' });
  }
  /* 시계 하나 — 방이 방으로 읽히는 데 싸게 먹힙니다 */
  I.box(g, o, S.w / 2 - 3.0, -S.d / 2 + .06, 3.4, 1.0, .1, 1.0, '#FFF8EA', { top: '#FFFFFF' });
  return { img: c, ox: o.x, oy: o.y };
}

/** 방 하나의 기물과 부딪히는 네모 · 앉을 자리 */
export function roomProps(key, decor) {
  const list = [];
  const seats = [];
  for (const [kind, x, z, ry, p] of (ROOMS[key] || [])) {
    if (!PROPS[kind]) continue;
    list.push({ kind, x, z, ry: ry || 0, p: p || {} });
    if (p && p.seat) seats.push({ x, z, dir: ry || 0, kind: kind === 'chair' ? 'chair' : kind });
  }
  /* 기숙사에 놓은 가구 — 상점에서 산 것들 */
  if (key === 'dorm') for (const d of (decor || [])) {
    const kind = { plant: 'plant', lamp2: 'deskLamp', rug2: 'rug', books2: 'books',
      guitar2: 'guitar', bear: 'bush' }[d.id];
    if (kind) list.push({ kind, x: d.x, z: d.z, ry: d.ry || 0, p: kind === 'bush' ? { col: '#C9A06E' } : {} });
  }
  return { list, seats };
}

export function roomColliders(key, list) {
  const S = ROOM_SIZE[key];
  const out = [];
  for (const p of list) {
    const D = PROPS[p.kind];
    if (!D || !D.solid) continue;
    const sw = Math.abs(Math.round(p.ry / (Math.PI / 2))) % 2;
    const w = p.p.w || D.w, d = p.p.d || D.d;
    out.push({ x: p.x, z: p.z, w: sw ? d : w, d: sw ? w : d });
  }
  return out;
}

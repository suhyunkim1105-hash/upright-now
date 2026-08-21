/* ══════════════════════════════════════════════════════════
   기물 — 상자 몇 개로 만든 픽셀 소품들.

   규칙 셋.
     ① 그리는 함수는 자리(x, z)와 방향(ry)만 받습니다. 방향은 네 방향뿐이고,
        90도 돌면 가로세로를 맞바꿉니다 — 픽셀아트에 45도는 없습니다.
     ② 부딪히는 넓이는 그림과 **같은 표**에서 나옵니다. 따로 적으면 어긋납니다.
     ③ 그림자를 꼭 깝니다. 없으면 전부 공중에 뜹니다.
   ══════════════════════════════════════════════════════════ */
import * as I from './iso.js';

export const C = {
  wood: '#C08E58', woodD: '#8E6238', woodL: '#E0B888', ink: '#3A3F4A',
  metal: '#B8BEC6', metalD: '#8A9098', cloth: '#5B84C4', clothB: '#E8695A',
  glass: '#9EDCEB', paper: '#FFF8EA', green: '#53B84E', greenD: '#2E7D3E',
  gold: '#F2B33C', teal: '#2DD4BF', wall: '#F6EDDC', base: '#E2D6BE',
  stone: '#F2E6CC', stoneD: '#DCCBAA', soil: '#8E6238', grass: '#6FC85E',
  grassD: '#57B04A', grassL: '#86D46E', path: '#F0D49A', pathD: '#DCB87C',
  water: '#67C6E8', waterD: '#3FA7CE', bronze: '#C9A05E', bronzeD: '#A37E40',
};
const BOOKS = ['#E8695A', '#F2C14E', '#5B84C4', '#63C47C', '#9B7BD4', '#E8935A', '#3FB3A2', '#D96B8E'];

/** 90도 돌면 가로세로가 바뀝니다 */
const R = (ry, w, d) => (Math.abs(Math.round(ry / (Math.PI / 2))) % 2 ? [d, w] : [w, d]);
const B = I.box, P = I.plate, CY = I.cyl, SH = I.shadow, BL = I.ball;

/* ── 표 ──
   w · d 는 바닥 넓이, h 는 높이. solid 면 못 지나가고, tall 이면
   앉은 눈높이도 막습니다(카메라가 아니라 시야 정리를 위해). */
export const PROPS = {

  /* ══ 바깥 ══ */
  tree: { w: 1.6, d: 1.6, solid: 1, tall: 1, h: 4.2, draw(g, o, x, z, ry, p = {}) {
    SH(g, o, x, z, 1.5, .18);
    CY(g, o, x, z, 0, .22, 1.5, '#8E5A33');
    const c = p.col || '#53B84E', s = p.s || 1;
    BL(g, o, x, z, 1.2 * s, 1.15 * s, c);
    BL(g, o, x - .5 * s, z + .3 * s, .9 * s, .8 * s, I.sh(c, 12));
    BL(g, o, x + .55 * s, z - .2 * s, 1.0 * s, .78 * s, I.sh(c, -16));
  } },
  pine: { w: 1.4, d: 1.4, solid: 1, tall: 1, h: 4.6, draw(g, o, x, z) {
    SH(g, o, x, z, 1.2, .18);
    CY(g, o, x, z, 0, .2, 1.0, '#6B4728');
    const c = '#2F7A4A';
    [[.95, .9, 1.3], [.75, 1.9, 1.1], [.5, 2.8, .9]].forEach(([r, y, hh]) =>
      CY(g, o, x, z, y, r, .1, I.sh(c, y * 6), { left: I.sh(c, -6), right: I.sh(c, -24) }));
    [[1.15, .8], [.9, 1.75], [.62, 2.6], [.34, 3.4]].forEach(([r, y]) => {
      CY(g, o, x, z, y, r, .34, I.sh(c, (y * 6) | 0));
    });
  } },
  bush: { w: 1.2, d: 1.2, solid: 1, h: .9, draw(g, o, x, z, ry, p = {}) {
    SH(g, o, x, z, .8, .16);
    BL(g, o, x, z, 0, .62, p.col || '#4FA85A');
    BL(g, o, x - .3, z + .2, 0, .44, '#5FB863');
  } },
  flowers: { w: 1.0, d: 1.0, h: .3, draw(g, o, x, z, ry, p = {}) {
    const cols = ['#F2A0B4', '#F2E08A', '#B9A6F2', '#FF9E7A'];
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3 + (p.seed || 0), fx = x + Math.cos(a) * .34, fz = z + Math.sin(a) * .34;
      CY(g, o, fx, fz, 0, .04, .22, '#3E8F4C');
      BL(g, o, fx, fz, .22, .11, cols[(i + (p.seed | 0)) % 4]);
    }
  } },
  bench: { w: 2.6, d: .9, solid: 1, h: 1.0, draw(g, o, x, z, ry) {
    const [w, d] = R(ry, 2.6, .9);
    SH(g, o, x, z, Math.max(w, d) * .48, .18);
    /* 다리 넷 → 앉는 판 → 등받이. 순서를 바꾸면 다리가 판 위로 올라옵니다 */
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) =>
      B(g, o, x + a * (w / 2 - .18), z + b * (d / 2 - .16), 0, .14, .14, .42, C.metalD));
    B(g, o, x, z, .42, w, d, .12, C.wood, { top: C.woodL });
    if (w > d) {
      B(g, o, x, z - d / 2 + .1, .54, w, .12, .5, C.wood, { top: C.woodL });
      B(g, o, x, z - d / 2 + .1, 1.04, w, .14, .1, C.woodD);
    } else {
      B(g, o, x - w / 2 + .1, z, .54, .12, d, .5, C.wood, { top: C.woodL });
      B(g, o, x - w / 2 + .1, z, 1.04, .14, d, .1, C.woodD);
    }
  } },
  lamp: { w: .5, d: .5, solid: 1, tall: 1, h: 4.0, draw(g, o, x, z) {
    SH(g, o, x, z, .5, .18);
    CY(g, o, x, z, 0, .22, .2, '#3A4550');
    CY(g, o, x, z, .2, .11, 3.2, '#43505E');
    B(g, o, x, z, 3.4, .7, .7, .34, '#FFF1B8', { top: '#FFF8D8' });
    B(g, o, x, z, 3.74, .8, .8, .12, '#2F3A46');
  } },
  bin: { w: .8, d: .8, solid: 1, h: 1.0, draw(g, o, x, z) {
    SH(g, o, x, z, .5, .18);
    CY(g, o, x, z, 0, .38, .82, '#4E6A58');
    CY(g, o, x, z, .82, .42, .1, '#3A5244');
  } },
  planter: { w: 2.4, d: 2.4, solid: 1, h: .7, draw(g, o, x, z, ry, p = {}) {
    B(g, o, x, z, 0, 2.4, 2.4, .42, C.stoneD, { top: C.stone });
    P(g, o, x, z, .44, 2.0, 2.0, '#7A5A38');
    PROPS.flowers.draw(g, o, x - .5, z - .3, 0, { seed: p.seed || 0 });
    PROPS.flowers.draw(g, o, x + .5, z + .4, 0, { seed: (p.seed || 0) + 2 });
  } },
  board: { w: 2.6, d: .5, solid: 1, tall: 1, h: 2.6, draw(g, o, x, z, ry, p = {}) {
    const [w, d] = R(ry, 2.6, .4);
    SH(g, o, x, z, 1.1, .18);
    B(g, o, x - (w > d ? .9 : 0), z - (w > d ? 0 : .9), 0, .18, .18, 1.1, C.woodD);
    B(g, o, x + (w > d ? .9 : 0), z + (w > d ? 0 : .9), 0, .18, .18, 1.1, C.woodD);
    B(g, o, x, z, 1.1, w, d, 1.4, C.woodD, { top: C.woodD });
    /* 붙은 종이 — 게시판은 종이가 붙어 있어야 게시판입니다 */
    for (let i = 0; i < 4; i++) {
      const t = (i - 1.5) * .5;
      if (w > d) B(g, o, x + t, z - d / 2 - .02, 1.5 + (i % 2) * .35, .38, .04, .5, i % 2 ? '#FFF8EA' : '#FFE9C0');
      else B(g, o, x - d / 2 - .02, z + t, 1.5 + (i % 2) * .35, .04, .38, .5, i % 2 ? '#FFF8EA' : '#FFE9C0');
    }
    if (p.roof) B(g, o, x, z, 2.5, w + .5, d + .7, .16, C.clothB);
  } },
  sign: { w: .5, d: .5, solid: 1, h: 2.4, draw(g, o, x, z, ry, p = {}) {
    SH(g, o, x, z, .45, .18);
    CY(g, o, x, z, 0, .12, 2.0, C.woodD);
    const arms = p.arms || 3;
    for (let i = 0; i < arms; i++) {
      const y = 1.9 - i * .38, dir = i % 2 ? 1 : -1;
      B(g, o, x + dir * .5, z, y, 1.0, .1, .26, i % 2 ? '#F2C14E' : '#63C47C');
    }
  } },
  fountain: { w: 7.4, d: 7.4, solid: 1, h: 1.2, draw(g, o, x, z) {
    B(g, o, x, z, 0, 7.4, 7.4, .34, C.stoneD, { top: C.stone });
    I.ellipse(g, o, x, z, .36, 3.1, C.water);
    I.ellipse(g, o, x, z, .38, 2.6, I.sh(C.water, 14));
    B(g, o, x, z, .3, 1.6, 1.6, .5, C.stoneD, { top: C.stone });
  } },
  statue: { w: 1.8, d: 1.8, solid: 1, tall: 1, h: 4.0, draw(g, o, x, z) {
    SH(g, o, x, z, 1.2, .2);
    B(g, o, x, z, 0, 2.2, 2.2, .4, C.stoneD, { top: C.stone });
    B(g, o, x, z, .4, 1.6, 1.6, .3, C.stone, { top: '#FFF8EC' });
    B(g, o, x, z, .7, 1.1, 1.1, 1.1, C.bronzeD, { top: C.bronze });
    /* 거북이와 기린 — 실루엣만으로 읽혀야 합니다 */
    BL(g, o, x - .25, z, 1.8, .42, C.bronze);
    CY(g, o, x + .3, z, 1.8, .16, 1.3, C.bronze);
    BL(g, o, x + .3, z, 3.1, .34, C.bronze);
    B(g, o, x + .3, z - .3, 3.2, .16, .3, .16, C.bronzeD);
  } },
  gate: { w: 5.0, d: 1.0, solid: 1, tall: 1, h: 4.2, draw(g, o, x, z, ry) {
    const [w, d] = R(ry, 5.0, .9);
    SH(g, o, x, z, 2.0, .18);
    const ox = w > d ? 2.1 : 0, oz = w > d ? 0 : 2.1;
    B(g, o, x - ox, z - oz, 0, .8, .8, 3.4, C.stoneD, { top: C.stone });
    B(g, o, x + ox, z + oz, 0, .8, .8, 3.4, C.stoneD, { top: C.stone });
    B(g, o, x, z, 3.4, w, d, .5, '#B0543A', { top: '#C96A4E' });
  } },
  busstop: { w: 2.4, d: 1.6, solid: 1, tall: 1, h: 3.0, draw(g, o, x, z, ry) {
    const [w, d] = R(ry, 2.4, 1.4);
    SH(g, o, x, z, 1.2, .18);
    B(g, o, x - w / 2 + .16, z - d / 2 + .16, 0, .18, .18, 2.4, C.metalD);
    B(g, o, x + w / 2 - .16, z + d / 2 - .16, 0, .18, .18, 2.4, C.metalD);
    B(g, o, x, z, 2.4, w + .4, d + .4, .18, '#3FB3A2');
    B(g, o, x, z, .4, w * .8, .18, .5, C.wood);
  } },

  /* ══ 실내 ══ */
  shelf: { w: 2.0, d: .5, solid: 1, tall: 1, h: 2.4, draw(g, o, x, z, ry, p = {}) {
    const [w, d] = R(ry, p.w || 2.0, .5), h = p.h || 2.4;
    B(g, o, x, z, 0, w, d, h, C.woodD, { top: C.wood });
    for (let r = 0; r < 4; r++) {
      const y = .3 + r * ((h - .5) / 4);
      if (w > d) {
        B(g, o, x, z + d / 2 - .04, y, w - .18, .08, .06, C.woodD);
        for (let i = 0; i < 7; i++) B(g, o, x - w / 2 + .22 + i * (w - .4) / 7, z + d / 2 - .06, y + .06,
          .14, .1, .34 + (i % 3) * .08, BOOKS[(i + r * 3) % 8]);
      } else {
        for (let i = 0; i < 7; i++) B(g, o, x + d / 2 - .06, z - w / 2 + .22 + i * (w - .4) / 7, y + .06,
          .1, .14, .34 + (i % 3) * .08, BOOKS[(i + r * 3) % 8]);
      }
    }
  } },
  desk: { w: 2.2, d: 1.0, solid: 1, h: .8, draw(g, o, x, z, ry, p = {}) {
    const [w, d] = R(ry, p.w || 2.2, p.d || 1.0);
    SH(g, o, x, z, Math.max(w, d) * .45, .16);
    B(g, o, x, z, .68, w, d, .12, C.wood, { top: C.woodL });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) =>
      B(g, o, x + a * (w / 2 - .14), z + b * (d / 2 - .12), 0, .12, .12, .68, C.woodD));
  } },
  table: { w: 4.6, d: 2.4, solid: 1, h: .8, draw(g, o, x, z, ry, p = {}) {
    const [w, d] = R(ry, p.w || 4.6, p.d || 2.4);
    SH(g, o, x, z, Math.max(w, d) * .45, .16);
    B(g, o, x, z, .7, w, d, .14, C.wood, { top: C.woodL });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) =>
      B(g, o, x + a * (w / 2 - .22), z + b * (d / 2 - .18), 0, .14, .14, .7, C.woodD));
  } },
  chair: { w: .8, d: .8, solid: 1, seat: 1, h: 1.0, draw(g, o, x, z, ry, p = {}) {
    const c = p.col || C.wood;
    SH(g, o, x, z, .4, .16);
    B(g, o, x, z, .42, .72, .72, .1, c, { top: I.sh(c, 16) });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) =>
      B(g, o, x + a * .28, z + b * .28, 0, .09, .09, .42, I.sh(c, -30)));
    /* 등받이는 **뒤쪽**에 — ry 는 앉는 사람이 보는 쪽입니다 */
    const bx = x - Math.sin(ry) * .32, bz = z - Math.cos(ry) * .32;
    const [bw, bd] = R(ry, .72, .1);
    B(g, o, bx, bz, .52, bw, bd, .56, c, { top: I.sh(c, 16) });
  } },
  carrel: { w: 1.4, d: 1.2, solid: 1, h: 1.6, draw(g, o, x, z, ry) {
    const [w, d] = R(ry, 1.4, 1.2);
    PROPS.desk.draw(g, o, x, z, ry, { w: 1.4, d: 1.0 });
    const bx = x - Math.sin(ry) * .5, bz = z - Math.cos(ry) * .5;
    const [pw, pd] = R(ry, 1.4, .1);
    B(g, o, bx, bz, .8, pw, pd, .78, C.woodL, { top: '#F2E0C4' });
  } },
  laptop: { w: .5, d: .4, h: .3, draw(g, o, x, z, ry) {
    B(g, o, x, z, .8, .44, .32, .04, '#8A9098');
    const [w, d] = R(ry, .44, .06);
    B(g, o, x - Math.sin(ry) * .16, z - Math.cos(ry) * .16, .84, w, d, .3, '#6E7A88', { top: '#9EDCEB' });
  } },
  books: { w: .4, d: .3, h: .3, draw(g, o, x, z, ry, p = {}) {
    for (let i = 0; i < (p.n || 3); i++) B(g, o, x, z, .8 + i * .07, .4 - i * .04, .3, .07, BOOKS[(i + (p.seed | 0)) % 8]);
  } },
  deskLamp: { w: .3, d: .3, h: .7, draw(g, o, x, z) {
    CY(g, o, x, z, .8, .16, .05, '#4E5A66');
    CY(g, o, x, z, .85, .04, .42, '#6E7A88');
    B(g, o, x, z, 1.27, .3, .3, .16, '#FFE9A8', { top: '#FFF6D8' });
  } },
  plant: { w: 1.0, d: 1.0, solid: 1, h: 1.6, draw(g, o, x, z, ry, p = {}) {
    const s = p.s || 1;
    SH(g, o, x, z, .5 * s, .16);
    CY(g, o, x, z, 0, .34 * s, .46 * s, '#C87A52');
    CY(g, o, x, z, .46 * s, .3 * s, .06, '#6B4A2A');
    BL(g, o, x, z, .5 * s, .52 * s, C.green);
    BL(g, o, x - .25 * s, z + .15 * s, .8 * s, .38 * s, I.sh(C.green, 14));
    BL(g, o, x + .22 * s, z - .12 * s, .75 * s, .34 * s, C.greenD);
  } },
  counter: { w: 4.2, d: .9, solid: 1, tall: 1, h: 1.1, draw(g, o, x, z, ry, p = {}) {
    const [w, d] = R(ry, p.w || 4.2, .9);
    B(g, o, x, z, 0, w, d, 1.0, p.col || C.woodD, { top: I.sh(p.col || C.woodD, -10) });
    B(g, o, x, z, 1.0, w + .2, d + .2, .12, C.woodL, { top: '#F2E0C4' });
  } },
  sofa: { w: 2.6, d: 1.1, solid: 1, seat: 1, h: 1.0, draw(g, o, x, z, ry, p = {}) {
    const c = p.col || '#9B7BD4';
    const [w, d] = R(ry, p.w || 2.6, 1.1);
    SH(g, o, x, z, Math.max(w, d) * .5, .18);
    B(g, o, x, z, 0, w, d, .42, I.sh(c, -22));
    B(g, o, x, z, .42, w - .2, d - .2, .16, c, { top: I.sh(c, 18) });
    const bx = x - Math.sin(ry) * (d / 2 - .18), bz = z - Math.cos(ry) * (d / 2 - .18);
    const [bw, bd] = R(ry, w, .28);
    B(g, o, bx, bz, .42, bw, bd, .62, c, { top: I.sh(c, 18) });
  } },
  lowTable: { w: 1.4, d: .9, solid: 1, h: .5, draw(g, o, x, z, ry, p = {}) {
    const [w, d] = R(ry, p.w || 1.4, p.d || .9);
    SH(g, o, x, z, w * .45, .14);
    B(g, o, x, z, .38, w, d, .1, C.wood, { top: C.woodL });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) =>
      B(g, o, x + a * (w / 2 - .12), z + b * (d / 2 - .1), 0, .09, .09, .38, C.woodD));
  } },
  bed: { w: 2.0, d: 3.0, solid: 1, h: 1.0, draw(g, o, x, z, ry) {
    const [w, d] = R(ry, 2.0, 3.0);
    SH(g, o, x, z, Math.max(w, d) * .45, .18);
    B(g, o, x, z, 0, w, d, .42, C.woodD);
    B(g, o, x, z, .42, w - .06, d - .06, .26, '#F2F2F2', { top: '#FFFFFF' });
    const hx = x - Math.sin(ry) * (d / 2 - .2), hz = z - Math.cos(ry) * (d / 2 - .2);
    const [hw, hd] = R(ry, w, .4);
    B(g, o, hx, hz, .68, hw * .7, hd * .7, .18, '#FFFDF6', { top: '#FFFFFF' });
    const [cw, cd] = R(ry, w - .06, d * .58);
    B(g, o, x + Math.sin(ry) * d * .2, z + Math.cos(ry) * d * .2, .68, cw, cd, .12, '#7FB8E0', { top: '#93C9EC' });
    B(g, o, hx, hz, .42, hw, .2, .8, C.woodD, { top: C.wood });
  } },
  wardrobe: { w: 1.6, d: .8, solid: 1, tall: 1, h: 2.6, draw(g, o, x, z, ry) {
    const [w, d] = R(ry, 1.6, .8);
    B(g, o, x, z, 0, w, d, 2.5, C.woodD, { top: C.wood });
    if (w > d) { B(g, o, x - .02, z + d / 2 - .02, .2, .04, .06, 2.1, C.woodL);
      B(g, o, x - .38, z + d / 2 - .04, 1.2, .1, .06, .2, C.gold);
      B(g, o, x + .38, z + d / 2 - .04, 1.2, .1, .06, .2, C.gold); }
    else { B(g, o, x + d / 2 - .02, z, .2, .06, .04, 2.1, C.woodL);
      B(g, o, x + d / 2 - .04, z - .38, 1.2, .06, .1, .2, C.gold);
      B(g, o, x + d / 2 - .04, z + .38, 1.2, .06, .1, .2, C.gold); }
  } },
  rug: { w: 3.0, d: 2.2, h: 0, draw(g, o, x, z, ry, p = {}) {
    const [w, d] = R(ry, p.w || 3.0, p.d || 2.2);
    P(g, o, x, z, .03, w, d, p.col || '#E8935A');
    P(g, o, x, z, .04, w - .5, d - .5, p.inner || '#FFF0DC');
  } },
  locker: { w: 2.0, d: .6, solid: 1, tall: 1, h: 2.2, draw(g, o, x, z, ry, p = {}) {
    const n = p.n || 4, c = p.col || '#7FA8C4';
    const [w, d] = R(ry, n * .5, .6);
    B(g, o, x, z, 0, w, d, 2.1, I.sh(c, -20), { top: c });
    for (let i = 0; i < n; i++) {
      const t = (i - (n - 1) / 2) * .5;
      if (w > d) { B(g, o, x + t, z + d / 2 - .03, .1, .44, .05, 1.9, c);
        B(g, o, x + t + .14, z + d / 2 - .05, 1.0, .08, .05, .1, C.metal); }
      else { B(g, o, x + d / 2 - .03, z + t, .1, .05, .44, 1.9, c);
        B(g, o, x + d / 2 - .05, z + t + .14, 1.0, .05, .08, .1, C.metal); }
    }
  } },
  vending: { w: 1.2, d: .8, solid: 1, tall: 1, h: 2.2, draw(g, o, x, z, ry, p = {}) {
    const [w, d] = R(ry, 1.2, .8);
    SH(g, o, x, z, .7, .18);
    B(g, o, x, z, 0, w, d, 2.1, p.col || '#E8695A', { top: I.sh(p.col || '#E8695A', -16) });
    const fx = x + (w > d ? 0 : d / 2 - .04), fz = z + (w > d ? d / 2 - .04 : 0);
    const [fw, fd] = R(ry, .9, .06);
    B(g, o, fx, fz, .8, fw, fd, 1.1, '#2A3644', { top: '#3A4A5E' });
    for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) {
      const t = (i - 1) * .26;
      if (w > d) B(g, o, x + t, fz - .03, .95 + r * .33, .18, .04, .24, BOOKS[(i + r * 2) % 8]);
      else B(g, o, fx - .03, z + t, .95 + r * .33, .04, .18, .24, BOOKS[(i + r * 2) % 8]);
    }
  } },
  fridge: { w: 1.0, d: .8, solid: 1, tall: 1, h: 2.0, draw(g, o, x, z, ry, p = {}) {
    const [w, d] = R(ry, 1.0, .8);
    B(g, o, x, z, 0, w, d, 1.9, p.col || '#E6EAF0', { top: '#F4F7FA' });
    B(g, o, x + (w > d ? 0 : d / 2 - .02), z + (w > d ? d / 2 - .02 : 0), .9, ...R(ry, .8, .04), .04, C.metalD);
  } },
  cooler: { w: 1.6, d: .9, solid: 1, h: 1.2, draw(g, o, x, z, ry) {
    const [w, d] = R(ry, 1.6, .9);
    B(g, o, x, z, 0, w, d, 1.0, '#4E7EA8', { top: '#6A9AC4' });
    P(g, o, x, z, 1.02, w - .2, d - .2, '#BFEAF5');
  } },
  trayCounter: { w: 4.0, d: 1.2, solid: 1, tall: 1, h: 1.3, draw(g, o, x, z, ry) {
    const [w, d] = R(ry, 4.0, 1.2);
    B(g, o, x, z, 0, w, d, 1.0, '#8FA8B8', { top: '#A8C0CE' });
    B(g, o, x, z, 1.0, w + .1, d + .1, .1, C.metal, { top: '#D2D8DE' });
    for (let i = 0; i < 4; i++) {
      const t = (i - 1.5) * (w > d ? .9 : 0), u = (i - 1.5) * (w > d ? 0 : .9);
      B(g, o, x + t, z + u, 1.1, .6, .6, .14, ['#F2C14E', '#63C47C', '#E8695A', '#9EDCEB'][i]);
    }
  } },
  cabinet: { w: 1.6, d: .7, solid: 1, h: 1.2, draw(g, o, x, z, ry, p = {}) {
    const [w, d] = R(ry, p.w || 1.6, .7);
    B(g, o, x, z, 0, w, d, 1.1, p.col || C.woodD, { top: C.wood });
    B(g, o, x, z, 1.1, w + .1, d + .1, .08, C.woodL);
  } },
  rack: { w: 2.2, d: .8, solid: 1, tall: 1, h: 2.0, draw(g, o, x, z, ry) {
    const [w, d] = R(ry, 2.2, .8);
    SH(g, o, x, z, 1.0, .16);
    B(g, o, x - (w > d ? w / 2 - .1 : 0), z - (w > d ? 0 : w / 2 - .1), 0, .1, .1, 1.8, C.metalD);
    B(g, o, x + (w > d ? w / 2 - .1 : 0), z + (w > d ? 0 : w / 2 - .1), 0, .1, .1, 1.8, C.metalD);
    B(g, o, x, z, 1.8, ...R(ry, w, .08), .08, C.metal);
    for (let i = 0; i < 5; i++) {
      const t = (i - 2) * .42;
      const [cw, cd] = R(ry, .34, .16);
      B(g, o, x + (w > d ? t : 0), z + (w > d ? 0 : t), .9, cw, cd, .86, BOOKS[i % 8]);
    }
  } },
  mannequin: { w: .7, d: .7, solid: 1, h: 1.9, draw(g, o, x, z, ry, p = {}) {
    SH(g, o, x, z, .4, .16);
    CY(g, o, x, z, 0, .3, .1, '#8A9098');
    CY(g, o, x, z, .1, .06, .7, '#B8BEC6');
    B(g, o, x, z, .8, .6, .34, .6, p.top || '#E8695A');
    B(g, o, x, z, .4, .5, .3, .42, p.bot || '#3E5C82');
    BL(g, o, x, z, 1.42, .22, '#D8D2C8');
  } },
  eggStand: { w: 1.0, d: 1.0, solid: 1, h: 1.3, draw(g, o, x, z, ry, p = {}) {
    SH(g, o, x, z, .5, .16);
    CY(g, o, x, z, 0, .12, .7, C.woodD);
    CY(g, o, x, z, .7, .42, .12, C.woodL);
    BL(g, o, x, z, .82, .3, p.col || '#F2C14E');
    B(g, o, x, z, .82, .12, .12, .1, I.sh(p.col || '#F2C14E', -30));
  } },
  arcade: { w: 1.0, d: 1.0, solid: 1, tall: 1, h: 2.1, draw(g, o, x, z, ry, p = {}) {
    const c = p.col || '#5B84C4';
    SH(g, o, x, z, .6, .18);
    B(g, o, x, z, 0, 1.0, 1.0, 1.9, I.sh(c, -18), { top: c });
    const fx = x + Math.sin(ry) * .5, fz = z + Math.cos(ry) * .5;
    B(g, o, fx, fz, 1.05, ...R(ry, .8, .06), .6, '#1B2430', { top: '#2A3644' });
    B(g, o, fx, fz, 1.02, ...R(ry, .8, .06), .04, '#7FE0F2');
    B(g, o, x, z, 1.9, 1.1, 1.1, .3, I.sh(c, 20), { top: I.sh(c, 34) });
    B(g, o, x + Math.sin(ry) * .3, z + Math.cos(ry) * .3, .78, .4, .4, .1, '#E8695A');
  } },
  claw: { w: 1.6, d: 1.6, solid: 1, tall: 1, h: 2.4, draw(g, o, x, z, ry, p = {}) {
    const c = p.col || '#FF7FA8';
    SH(g, o, x, z, .9, .18);
    B(g, o, x, z, 0, 1.5, 1.5, .9, I.sh(c, -20), { top: c });
    B(g, o, x, z, .9, 1.4, 1.4, 1.2, '#BFEAF5', { top: '#D8F2FA', left: 'rgba(190,234,245,.7)', right: 'rgba(150,200,220,.7)' });
    for (let i = 0; i < 5; i++) BL(g, o, x - .4 + (i % 3) * .38, z - .3 + ((i / 3) | 0) * .4, .9, .22, BOOKS[i]);
    B(g, o, x, z, 2.1, 1.6, 1.6, .3, c, { top: I.sh(c, 20) });
  } },
  airHockey: { w: 2.6, d: 1.6, solid: 1, h: 1.0, draw(g, o, x, z, ry) {
    const [w, d] = R(ry, 2.6, 1.6);
    SH(g, o, x, z, 1.2, .18);
    B(g, o, x, z, 0, w, d, .8, '#2A3644');
    P(g, o, x, z, .82, w - .1, d - .1, '#EAF4FA');
    P(g, o, x, z, .84, w > d ? .06 : w - .1, w > d ? d - .1 : .06, '#5B84C4');
    BL(g, o, x, z, .84, .1, '#E8695A');
  } },
  photoBooth: { w: 2.0, d: 2.0, solid: 1, tall: 1, h: 2.6, draw(g, o, x, z, ry, p = {}) {
    const c = p.col || '#FF7FA8';
    SH(g, o, x, z, 1.1, .18);
    B(g, o, x, z, 0, 2.0, 2.0, 2.4, I.sh(c, -22), { top: c });
    const fx = x + Math.sin(ry) * 1.0, fz = z + Math.cos(ry) * 1.0;
    B(g, o, fx, fz, .1, ...R(ry, 1.4, .06), 2.0, '#3E2A38', { top: '#5A3E52' });
    B(g, o, x, z, 2.4, 2.2, 2.2, .2, '#FFF6E2');
  } },
  dancePad: { w: 2.0, d: 2.0, h: .2, draw(g, o, x, z) {
    B(g, o, x, z, 0, 2.0, 2.0, .12, '#2A3644', { top: '#3A4A5E' });
    [[-.5, -.5, '#E8695A'], [.5, -.5, '#F2C14E'], [-.5, .5, '#63C47C'], [.5, .5, '#5B84C4']]
      .forEach(([a, b, c]) => P(g, o, x + a, z + b, .13, .8, .8, c));
  } },
  prizeShelf: { w: 2.4, d: .7, solid: 1, tall: 1, h: 2.0, draw(g, o, x, z, ry) {
    const [w, d] = R(ry, 2.4, .7);
    B(g, o, x, z, 0, w, d, 1.9, '#6B4AA8', { top: '#8E6BB8' });
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) {
      const t = (i - 1.5) * .5;
      BL(g, o, x + (w > d ? t : 0), z + (w > d ? 0 : t), .5 + r * .5, .17, BOOKS[(i + r) % 8]);
    }
  } },
  blackboard: { w: 5.0, d: .3, tall: 1, h: 2.2, draw(g, o, x, z, ry, p = {}) {
    const [w, d] = R(ry, p.w || 5.0, .24);
    B(g, o, x, z, 1.0, w, d, 1.8, C.woodD, { top: C.wood });
    B(g, o, x + (w > d ? 0 : .08), z + (w > d ? .08 : 0), 1.1, ...R(ry, w - .3, .06), 1.6, '#2E4A3E', { top: '#3E5E50' });
  } },
  projScreen: { w: 3.4, d: .2, h: 2.0, draw(g, o, x, z, ry, p = {}) {
    const [w, d] = R(ry, p.w || 3.4, .16);
    B(g, o, x, z, 1.4, w, d, 2.0, '#F6F2E6', { top: '#FFFCF2' });
  } },
  podium: { w: .9, d: .7, solid: 1, h: 1.2, draw(g, o, x, z, ry) {
    const [w, d] = R(ry, .9, .7);
    B(g, o, x, z, 0, w, d, 1.1, C.woodD, { top: C.wood });
    B(g, o, x, z, 1.1, w + .2, d + .2, .08, C.woodL);
  } },
  bookCart: { w: 1.2, d: .8, solid: 1, h: 1.0, draw(g, o, x, z, ry) {
    const [w, d] = R(ry, 1.2, .8);
    SH(g, o, x, z, .6, .16);
    B(g, o, x, z, .15, w, d, .8, C.metalD, { top: C.metal });
    for (let i = 0; i < 5; i++) B(g, o, x - w / 2 + .2 + i * (w - .4) / 5, z, .95, .14, d - .2, .34, BOOKS[i]);
  } },
  stackChairs: { w: .9, d: .9, solid: 1, h: 1.4, draw(g, o, x, z, ry, p = {}) {
    SH(g, o, x, z, .45, .16);
    for (let i = 0; i < (p.n || 5); i++)
      B(g, o, x, z, i * .18, .74, .74, .16, p.col || '#9BB4D6', { top: I.sh(p.col || '#9BB4D6', 14) });
  } },
  displayTable: { w: 2.0, d: 1.2, solid: 1, h: 1.0, draw(g, o, x, z, ry, p = {}) {
    const [w, d] = R(ry, 2.0, 1.2);
    B(g, o, x, z, 0, w, d, .7, C.woodD, { top: C.wood });
    for (let i = 0; i < 3; i++)
      B(g, o, x - w / 4 + i * w / 4, z, .7, .5, d - .3, .16, BOOKS[(i + 2) % 8]);
  } },
  shoeShelf: { w: 1.8, d: .6, solid: 1, h: 1.4, draw(g, o, x, z, ry) {
    const [w, d] = R(ry, 1.8, .6);
    B(g, o, x, z, 0, w, d, 1.3, C.woodD, { top: C.wood });
    for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++)
      B(g, o, x - w / 3 + i * w / 3, z, .3 + r * .4, .34, d - .2, .16, BOOKS[(i + r) % 8]);
  } },
  laundry: { w: 1.0, d: .9, solid: 1, h: 1.1, draw(g, o, x, z) {
    B(g, o, x, z, 0, 1.0, .9, 1.0, '#E6EAF0', { top: '#F4F7FA' });
    I.ellipse(g, o, x, z + .44, 1.02, .3, '#3E5C82');
  } },
  guitar: { w: .5, d: .4, h: 1.2, draw(g, o, x, z) {
    BL(g, o, x, z, .3, .32, '#C97A22');
    B(g, o, x, z, .6, .12, .12, .8, '#8E6238');
  } },
  radiator: { w: 1.8, d: .3, h: .7, draw(g, o, x, z, ry) {
    const [w, d] = R(ry, 1.8, .3);
    B(g, o, x, z, .1, w, d, .6, C.metal, { top: '#D2D8DE' });
  } },
  doormat: { w: 2.0, d: 1.0, h: 0, draw(g, o, x, z, ry, p = {}) {
    const [w, d] = R(ry, 2.0, 1.0);
    P(g, o, x, z, .02, w, d, p.col || '#4E8C9E');
    P(g, o, x, z, .03, w - .3, d - .3, I.sh(p.col || '#4E8C9E', 22));
  } },
  stanchion: { w: .4, d: .4, h: 1.0, draw(g, o, x, z) {
    CY(g, o, x, z, 0, .18, .06, C.metalD);
    CY(g, o, x, z, .06, .05, .9, C.metal);
    BL(g, o, x, z, .95, .1, C.gold);
  } },
  coffee: { w: .8, d: .6, h: .6, draw(g, o, x, z) {
    B(g, o, x, z, .8, .6, .5, .5, '#3A3F4A', { top: '#5A606C' });
    B(g, o, x, z + .28, .9, .3, .06, .2, '#9EDCEB');
  } },
};

/** 부딪히는 네모 — 그림과 같은 표에서 뽑습니다 */
export function footprint(kind, x, z, ry, p = {}) {
  const P0 = PROPS[kind]; if (!P0 || !P0.solid) return null;
  const [w, d] = R(ry, p.w || P0.w, p.d || P0.d);
  return { x, z, w, d, tall: !!P0.tall };
}

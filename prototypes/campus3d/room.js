/* ══════════════════════════════════════════════════════════
   실내 — 아이소메트릭 잘라 낸 방(cutaway).
   바닥 + 뒤벽 + 왼벽 셋만 세웁니다. 넷을 다 세우면 안이 안 보이고,
   하나만 세우면 방이 아니라 무대가 됩니다.
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { M, box, cyl, prism, roundedBox } from './parts.js';

export const IN = {
  floorA: 0xC9945C, floorB: 0xB8814A,          // 마루
  tileA: 0xE8E2D2, tileB: 0xD6CFBC,            // 타일
  wall: 0xF6EDDC, wallTop: 0xFFF8EC, base: 0xE2D6BE,
  wood: 0xC08E58, woodDark: 0x8E6238, woodLight: 0xE0B888,
  metal: 0xB8BEC6, metalDark: 0x8A9098,
  cloth: 0x5B84C4, clothB: 0xE8695A,
  glass: 0x9EDCEB, ink: 0x3A3F4A, paper: 0xFFF8EA,
  green: 0x53B84E, greenDark: 0x2E7D3E,
  gold: 0xF2B33C, teal: 0x2DD4BF,
};
const BOOKS = [0xE8695A, 0xF2C14E, 0x5B84C4, 0x63C47C, 0x9B7BD4, 0xE8935A, 0x3FB3A2, 0xD96B8E];

/* 팔레트 — 같은 색·같은 거칠기는 재질 한 장을 나눠 씁니다.
   부품마다 M() 을 새로 부르면 방 하나에 재질이 수백 장 생깁니다.
   구우면 색으로 묶이니 방 안에서는 티가 안 나지만, **굽지 않는 것**
   — 방 꾸미기 유령 미리 보기와 바늘 — 은 그대로 드로우콜이 되고,
   방을 다시 지을 때마다 또 한 벌씩 쌓입니다. */
const PAL = new Map();
export function P(c, r = .55) {
  const k = c * 1000 + Math.round(r * 100);
  let m = PAL.get(k);
  if (!m) PAL.set(k, m = M(c, r));
  return m;
}

/* 형상도 같은 이유로 나눠 씁니다.
   의자 마흔 개를 놓으면서 똑같은 크기의 상자를 마흔 벌 새로 깎고
   있었습니다. 굽고 나면 그리는 값은 같지만, 깎는 일은 방을 세우는
   그 순간에 몰려서 — ExtrudeGeometry 가 방 하나에 천 번 넘게 돕니다 —
   문 앞에서 화면이 한 번 멎습니다. 웹캠 자세 추정과 같은 탭이라
   그 한 번이 그대로 렉으로 보입니다.

   크기가 같으면 한 벌이면 됩니다. 놓는 자리는 메시마다 행렬이 따로
   있으므로 겉보기는 하나도 안 달라집니다. 여러 벌 서는 가구
   — 의자 · 서가 · 캐럴 · 책상 · 사물함 — 에서만 씁니다. */
const GEOS = new Map();
function geoBox(w, h, d, r) {
  const k = 'b' + w + '|' + h + '|' + d + '|' + r;
  let q = GEOS.get(k);
  if (!q) GEOS.set(k, q = roundedBox(w, h, d, r));
  return q;
}
function geoCyl(rt, rb, h, seg) {
  const k = 'c' + rt + '|' + rb + '|' + h + '|' + seg;
  let q = GEOS.get(k);
  if (!q) GEOS.set(k, q = new THREE.CylinderGeometry(rt, rb, h, seg));
  return q;
}
/** box() · cyl() 와 같은 자리에 같은 것을 놓되 형상만 공유합니다.
    (bx 로 줄이면 서가 안에서 책 자리를 세는 bx 를 가립니다 — 한 번 가렸습니다.) */
function sbox(p, w, h, d, r, mat, x, y, z) {
  const m = new THREE.Mesh(geoBox(w, h, d, r), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  p.add(m); return m;
}
function scyl(p, rt, rb, h, seg, mat, x, y, z) {
  const m = new THREE.Mesh(geoCyl(rt, rb, h, seg), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  p.add(m); return m;
}

/** 방 껍데기 — 바닥 무늬 · 벽 둘 · 걸레받이 · 몰딩 */
export function shell(g, w, d, h, opt = {}) {
  const fa = opt.floorA || IN.floorA, fb = opt.floorB || IN.floorB;
  box(g, w, .5, d, .1, M(opt.under || 0x8E6238, .8), 0, -.3, 0).castShadow = false;
  /* 바닥 — 판을 한 장으로 두면 장판입니다. 널을 깔아야 마루가 됩니다. */
  const n = Math.round(w / 1.1);
  for (let i = 0; i < n; i++) {
    const bw = w / n;
    box(g, bw - .04, .14, d, .03, M(i % 2 ? fa : fb, .74),
        -w / 2 + bw * (i + .5), .02, 0).castShadow = false;
  }
  /* 벽 둘 */
  box(g, w, h, .34, .06, M(opt.wall || IN.wall, .8), 0, h / 2, -d / 2);
  box(g, .34, h, d, .06, M(opt.wall || IN.wall, .8), -w / 2, h / 2, 0);
  /* 걸레받이 · 몰딩 — 벽과 바닥이 그냥 만나면 종이 상자입니다 */
  box(g, w, .34, .18, .04, M(IN.base, .7), 0, .17, -d / 2 + .24);
  box(g, .18, .34, d, .04, M(IN.base, .7), -w / 2 + .24, .17, 0);
  box(g, w, .24, .2, .05, M(IN.wallTop, .6), 0, h - .12, -d / 2 + .25);
  box(g, .2, .24, d, .05, M(IN.wallTop, .6), -w / 2 + .25, h - .12, 0);

  /* ── 가까운 쪽 벽 둘과 천장 ──
     3인칭 실내 카메라는 +x/+z 모서리 **밖에서** 방을 들여다보므로 그쪽
     벽 두 장을 안 세웠습니다. index.html 의 clampRoomYaw 가 시점을
     ±60° 로 묶어 뒤를 못 보게 하고 있어서 여태 안 드러났습니다.

     그런데 **Tab 으로 1인칭이 되면 그 잠금이 풀립니다**(clampRoomYaw
     첫 줄이 first 면 바로 돌아갑니다). 돌아서면 벽 두 장이 없고 천장도
     없어서 방이 뚜껑 열린 상자가 되고, 천장등은 허공에 매달립니다.

     그래서 나머지 벽과 천장을 따로 만들어 두고 1인칭일 때만 켭니다.
     bake 가 합쳐 버리면 따로 못 끄므로 noBake, 부딪힘은 방 경계가
     이미 막고 있으므로 noCollide 입니다. */
  const near = new THREE.Group();
  near.name = 'nearShell';
  near.visible = false;
  near.userData.noBake = true;
  near.userData.noCollide = true;
  g.add(near);
  const wm = M(opt.wall || IN.wall, .8);
  box(near, w, h, .34, .06, wm, 0, h / 2, d / 2);
  box(near, .34, h, d, .06, wm, w / 2, h / 2, 0);
  box(near, w, .34, .18, .04, M(IN.base, .7), 0, .17, d / 2 - .24);
  box(near, .18, .34, d, .04, M(IN.base, .7), w / 2 - .24, .17, 0);
  box(near, w, .24, .2, .05, M(IN.wallTop, .6), 0, h - .12, d / 2 - .25);
  box(near, .2, .24, d, .05, M(IN.wallTop, .6), w / 2 - .25, h - .12, 0);
  /* 천장 — 아랫면이 정확히 h 에 오게 둡니다. 천장등의 고정쇠가
     매다는 높이 +0.72 라, 방마다 그 끝이 이 판 안에 묻힙니다. */
  box(near, w, .3, d, .06, M(opt.ceil || IN.wallTop, .92), 0, h + .15, 0);
  near.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
}
/* ════════════════════════════════════════════════════════
   창밖 — 하늘색 · 밤 · 날씨.

   유리 뒤가 늘 같아서, 자정에 기숙사에 들어가도 **창만 한낮**
   이었습니다. 밖은 sky.js 가 시각을 따라 바꾸는데 실내 창만 그대로라,
   창이 바깥으로 난 구멍이 아니라 벽에 붙인 파란 스티커로 보였습니다.

   창유리 재질은 **모든 창이 한 장을 나눠 씁니다.** 창마다 따로 뽑으면
   방을 다시 지을 때마다(기숙사는 가구를 놓을 때마다 다시 짓습니다)
   목록이 불어나고, 나중에 지은 창만 옛 하늘을 칠한 채로 남습니다.
   두 장이면 setOutside 한 번에 열세 개가 다 바뀝니다.
   ════════════════════════════════════════════════════════ */
const WINMATS = [];                        // [0] 유리(하늘) · [1] 유리에 비친 방
/* sky.js 의 collect 는 재질을 **색 값으로** 골라냅니다(밤에 건물 창을
   켜려고). 창밖 색이 우연히 그 목록과 같아지면 저쪽이 emissive 를
   덮어써서, 여기서 칠한 하늘이 밤마다 한 단계씩 튀게 됩니다.
   겹치면 명도만 아주 조금 밀어 둡니다 — 눈에는 안 보이고, 색으로
   고르는 쪽은 더 이상 못 알아봅니다. */
const SKY_PICKS = new Set([
  0x9EDCEB, 0xBFEAF5, 0xCFEFFA, 0xBFE4F2, 0xD8F2FA, 0xA9DDF2, 0x9FD8EE,
  0xFFF2CE, 0xFFF8EA, 0xFFE8C0, 0xE8F4FF,
]);
const unpick = (c) => { if (SKY_PICKS.has(c.getHex())) c.offsetHSL(0, 0, .004); return c; };
const _sky = new THREE.Color(), _mix = new THREE.Color();
const DUSK = new THREE.Color(0x1B2440);    // 밤 유리의 바탕 — 검정이 아니라 남색
const WARM = new THREE.Color(0xFFDCA8);    // 유리에 비친 방 불빛
const PALE = new THREE.Color(0xF2FAFF);
const GREY = new THREE.Color(0x9AA6B2);
function winMats() {
  if (!WINMATS.length) {
    WINMATS.push(M(0xBEE7F6, .2, { emissive: 0x9FD8EE, emissiveIntensity: .38 }));
    WINMATS.push(M(0xE2F2FC, .16, { emissive: 0xBFE0F0, emissiveIntensity: .18 }));
  }
  return WINMATS;
}
/** 창밖을 칠합니다 — 지금까지 세운 창 전부에 한 번에 걸립니다.
    sky.js 의 skyAt(h) 결과를 그대로 넣을 수 있게 칸 이름을 맞췄습니다.
      setOutside(Object.assign({}, skyAt(hour), { weather: weatherKind(wx) }))
    { sky, night, rain, snow } 만 넣어도 됩니다. */
export function setOutside(opt) {
  const o = opt || {};
  const kind = o.weather || (o.snow ? 'snow' : o.rain ? 'rain' : o.cloud ? 'cloud' : 'clear');
  const night = Math.max(0, Math.min(1, typeof o.night === 'number' ? o.night : 0));
  const pane = winMats()[0], refl = WINMATS[1];
  _sky.set(o.sky === undefined || o.sky === null ? 0xBEE7F6 : o.sky);
  /* 비·눈은 **채도를 먼저 깎고** 밝기를 조금 내립니다. 밝기만 내리면
     파란 하늘이 그냥 어두워져서 흐린 날이 아니라 초저녁으로 보입니다.
     눈은 흐리되 밝습니다 — 쌓인 눈이 빛을 되돌려 주기 때문입니다. */
  const dull = kind === 'clear' ? 0 : kind === 'cloud' ? .16 : kind === 'snow' ? .18 : .22;
  if (dull) _sky.lerp(kind === 'snow' ? PALE : GREY, dull);
  if (kind === 'rain') _sky.multiplyScalar(.9);
  /* 유리 — 밤에는 눌러서 짙은 남색 유리로. 0 까지 내리면 벽에 뚫린
     검은 구멍이 되어, 방보다 창이 더 눈에 띕니다. */
  _mix.copy(_sky).multiplyScalar(1 - night * .6).lerp(DUSK, night * .5);
  pane.color.copy(unpick(_mix));
  /* 실내는 실내등이 따로 있어서, 색만 칠하면 유리가 그냥 **파란 벽**
     입니다. 낮에는 유리가 스스로 밝아야 '밖' 으로 읽힙니다. */
  pane.emissive.copy(_sky);
  pane.emissiveIntensity = .04 + .5 * (1 - night) * (kind === 'clear' ? 1 : .8);
  pane.needsUpdate = true;
  /* 비친 방 — 낮에는 하늘의 밝은 쪽, 밤에는 등불 한 점.
     밤 창을 어둡기만 하고 끝내면 유리가 아니라 판자로 보입니다. */
  _mix.copy(_sky).lerp(PALE, .34 * (1 - night)).lerp(WARM, night * .72);
  refl.color.copy(unpick(_mix));
  refl.emissive.copy(_sky).lerp(WARM, night);
  refl.emissiveIntensity = .16 * (1 - night) + .34 * night;
  refl.needsUpdate = true;
}
/** 창 — 뒤벽에 붙입니다. 밖이 밝아야 실내가 실내로 읽힙니다. */
export function window3(g, x, y, d, w = 1.9, h = 1.9) {
  const p = new THREE.Group(); p.position.set(x, y, -d / 2 + .18); g.add(p);
  const pane = winMats()[0], refl = WINMATS[1];
  box(p, w + .3, h + .3, .16, .05, M(IN.woodLight, .6), 0, 0, 0);
  box(p, w, h, .12, .03, pane, 0, 0, .04);
  /* 유리에 비친 방 한 조각. 이 한 장이 없으면 밤 창이 색만 짙은
     평면이라, 유리가 아니라 벽에 덧댄 판자로 보입니다. */
  box(p, w * .46, h * .38, .13, .03, refl, -w * .2, h * .2, .05);
  box(p, .09, h, .16, .02, M(IN.woodLight, .6), 0, 0, .07);
  box(p, w, .09, .16, .02, M(IN.woodLight, .6), 0, 0, .07);
  box(p, w + .5, .16, .34, .05, M(IN.woodLight, .6), 0, -h / 2 - .18, .1);
  return p;
}
/** 책장 — 칸마다 책등을 세웁니다. 책이 없으면 그냥 상자입니다. */
export function shelf(g, x, z, ry, w = 2.0, h = 2.4) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  sbox(p, w, h, .48, .05, M(IN.woodDark, .78), 0, h / 2, 0);
  sbox(p, w - .16, h - .16, .4, .04, M(IN.wood, .74), 0, h / 2, .06);
  const rows = 4;
  for (let r = 0; r < rows; r++) {
    const sy = .34 + r * ((h - .5) / rows);
    sbox(p, w - .2, .07, .42, .02, M(IN.woodDark, .7), 0, sy, .08);
    let bx = -w / 2 + .18;
    while (bx < w / 2 - .22) {
      const bw = .09 + ((bx * 37 + r * 13) % 5) * .02;
      const bh = .3 + ((bx * 53 + r * 7) % 4) * .05;
      sbox(p, bw, bh, .3, .02, M(BOOKS[Math.abs(Math.round(bx * 17 + r * 3)) % BOOKS.length], .68),
          bx + bw / 2, sy + .04 + bh / 2, .12);
      bx += bw + .015;
    }
  }
  return p;
}
/** 책상 — 상판 · 앞막이 · 다리 넷 */
export function desk(g, x, z, ry, w = 2.2, d = 1.0, h = .78) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  sbox(p, w, .12, d, .04, M(IN.wood, .7), 0, h, 0);
  sbox(p, w - .1, .2, d - .1, .03, M(IN.woodDark, .75), 0, h - .14, 0);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) =>
    scyl(p, .05, .06, h - .1, 8, M(IN.metal, .5), sx * (w / 2 - .16), (h - .1) / 2, sz * (d / 2 - .16)));
  return p;
}
/** 의자 — 다리 넷 · 앉는 면 · 등받이 살 */

/* ── 앉는 자리 등록 ──
   "모든 의자에 앉을 수 있어야" 해서, 의자를 **놓는 순간 좌표를 적어 둡니다.**
   손으로 목록을 따로 적으면 의자를 옮길 때마다 어긋납니다. */
let SEATREG = null;
export function seatsBegin() { SEATREG = []; }
export function seatsTake() { const r = SEATREG || []; SEATREG = null; return r; }
function regSeat(x, z, ry, kind, extra) {
  if (SEATREG) SEATREG.push({ x, z, dir: ry, kind, ...(extra || {}) });
}
function regSeatLocal(px, pz, pry, lx, lz, kind) {
  if (!SEATREG) return;
  const c = Math.cos(pry), sn = Math.sin(pry);
  regSeat(px + lx * c + lz * sn, pz - lx * sn + lz * c, pry, kind);
}

export function chair(g, x, z, ry, col = IN.wood) {
  regSeat(x, z, ry, 'chair');
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) =>
    scyl(p, .042, .05, .44, 8, M(IN.metal, .5), sx * .19, .22, sz * .19));
  sbox(p, .52, .1, .52, .05, M(col, .68), 0, .48, 0);
  sbox(p, .5, .5, .09, .05, M(col, .68), 0, .76, -.22);
  sbox(p, .42, .1, .12, .04, M(IN.metalDark, .5), 0, .62, -.24);
  return p;
}
/** 긴 열람 탁자 — 가운데 칸막이가 서면 도서관 자리가 됩니다 */
export function readTable(g, x, z, ry, w = 5.0) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  sbox(p, w, .14, 1.9, .05, M(IN.wood, .7), 0, .8, 0);
  sbox(p, w - .1, .22, 1.8, .03, M(IN.woodDark, .75), 0, .64, 0);
  [-1, 1].forEach((s) => sbox(p, .22, .8, 1.6, .05, M(IN.woodDark, .74), s * (w / 2 - .3), .4, 0));
  sbox(p, w - .5, .6, .1, .04, M(0x4E7C52, .8), 0, 1.15, 0);        // 칸막이
  return p;
}
/** 침대 — 틀 · 매트리스 · 이불 · 베개 */
export function bed(g, x, z, ry) {
  /* 침대 발치에서 눕기를 시작합니다. 머리는 로컬 -z(베개 쪽)로 향하고,
     몸 중심은 매트리스 한가운데에 오도록 별도 자리로 등록합니다. */
  regSeatLocal(x, z, ry, 0, 1.18, 'bed');
  if (SEATREG?.length) Object.assign(SEATREG[SEATREG.length - 1], { y: .82 });
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, 1.9, .34, 3.4, .08, M(IN.woodDark, .78), 0, .2, 0);
  box(p, 1.9, .8, .14, .05, M(IN.wood, .74), 0, .6, -1.7);
  box(p, 1.74, .3, 3.2, .1, M(0xFFF6E8, .85), 0, .5, 0);
  box(p, 1.76, .28, 2.2, .12, M(IN.cloth, .8), 0, .68, .55);       // 이불
  box(p, 1.2, .24, .58, .14, M(0xFFFFFF, .85), 0, .74, -1.2);      // 베개
  return p;
}
/** 옷장 */
export function wardrobe(g, x, z, ry) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, 1.8, 2.6, .8, .07, M(IN.woodDark, .78), 0, 1.3, 0);
  [-1, 1].forEach((s) => {
    box(p, .82, 2.4, .74, .05, M(IN.wood, .72), s * .44, 1.3, .05);
    cyl(p, .05, .05, .16, 10, M(IN.gold, .35), s * .12, 1.3, .42).rotation.x = Math.PI / 2;
  });
  return p;
}
/** 창구 카운터 — 학생회관·상점이 같이 씁니다 */
export function counter(g, x, z, ry, w = 2.6, col = IN.wood) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, w, 1.0, .9, .06, M(col, .74), 0, .5, 0);
  box(p, w + .2, .16, 1.1, .05, M(IN.woodLight, .6), 0, 1.06, 0);
  box(p, w - .3, .12, .06, .03, M(IN.metalDark, .5), 0, .58, .46);
  return p;
}
/** 게시판 — 종이 몇 장 */
export function board(g, x, y, z, w = 2.2, h = 1.5, ry = 0) {
  const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.y = ry; g.add(p);
  box(p, w, h, .14, .05, M(IN.woodDark, .78), 0, 0, 0);
  box(p, w - .2, h - .2, .1, .03, M(0x4E7C52, .82), 0, 0, .05);
  [[-.5,.3,.5,.4],[.4,.32,.44,.36],[-.42,-.3,.42,.4],[.42,-.28,.5,.34]]
    .forEach(([dx,dy,pw,ph]) => box(p, pw, ph, .1, .02, M(IN.paper, .6), dx, dy, .1));
  return p;
}
/** 칠판 */
export function blackboard(g, x, y, z, w = 5.0, h = 1.9) {
  const p = new THREE.Group(); p.position.set(x, y, z); g.add(p);
  box(p, w, h, .16, .05, M(IN.woodDark, .76), 0, 0, 0);
  box(p, w - .22, h - .22, .1, .03, M(0x2E5C42, .85), 0, 0, .05);
  box(p, w - .1, .16, .28, .05, M(IN.wood, .7), 0, -h / 2 - .04, .1);
  [-.4, -.1, .2].forEach((dx, i) => box(p, .22, .07, .1, .02, M(0xFFFFFF, .5), dx, -h / 2 + .04, .18));
  return p;
}
/** 화분 */
export function plant(g, x, z, s = 1) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.scale.setScalar(s); g.add(p);
  cyl(p, .3, .24, .44, 14, M(0xC4694A, .75), 0, .22, 0);
  cyl(p, .32, .32, .1, 14, M(0xA8563C, .7), 0, .44, 0);
  [[0,.9,0,.42],[-.24,.74,.1,.3],[.26,.78,-.08,.32],[.05,1.16,-.05,.26]]
    .forEach(([dx,dy,dz,r]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), M(IN.green, .8));
      m.position.set(dx, dy, dz); m.castShadow = true; m.receiveShadow = true; p.add(m);
    });
  return p;
}
/** 깔개 — 전 판은 흰 판에 색 테두리만 둘러 **선택 표시**로 보였습니다.
    테 · 안감 · 가운데 무늬 · 술 넷으로 짭니다. */
export function rug(g, x, z, w, d, col = 0xE8935A, inner = 0xFFF0DC) {
  const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
  const flat = (m) => { m.castShadow = false; return m; };
  /* 테두리 폭은 **짧은 변에 비례** 시킵니다. 전에는 0.5/1.1/1.7 을 그대로
     빼서, 폭 9 · 깊이 2.4 짜리 깔개가 안쪽 띠 깊이 0.7 이 되어
     길게 늘어난 줄무늬 — **횡단보도** 처럼 보였습니다. */
  /* 띠를 네 겹 두르니 좁은 깔개가 **횡단보도** 로 보였습니다.
     깔개는 테두리 하나 · 바탕 하나 · 가운데 무늬 하나면 충분합니다. */
  const b = Math.min(.3, Math.min(w, d) * .1);
  flat(box(p, w, .08, d, .1, M(col, .92), 0, .10, 0));
  flat(box(p, w - b * 2, .08, d - b * 2, .09, M(inner, .92), 0, .125, 0));
  flat(box(p, w * .36, .08, d * .36, .3, M(col, .92), 0, .142, 0));
  /* 술 — 짧은 두 변에만. 이게 있어야 깔개로 읽힙니다. */
  const n = Math.max(4, Math.round(w / .34));
  for (let i = 0; i < n; i++) {
    const px = -w / 2 + (i + .5) * (w / n);
    [-1, 1].forEach((s) => flat(box(p, .09, .05, .2, .02, M(inner, .9), px, .1, s * (d / 2 + .08))));
  }
  return p;
}
/** 탁상등 */
export function lamp(g, x, y, z) {
  const p = new THREE.Group(); p.position.set(x, y, z); g.add(p);
  cyl(p, .16, .2, .06, 12, M(IN.metalDark, .5), 0, .03, 0);
  cyl(p, .03, .03, .5, 8, M(IN.metalDark, .5), 0, .28, 0);
  const sh = new THREE.Mesh(new THREE.ConeGeometry(.22, .26, 14, 1, true), M(IN.gold, .55));
  sh.position.y = .58; sh.rotation.x = Math.PI; sh.castShadow = true; p.add(sh);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 10),
    M(0xFFF0C4, .4, { emissive: 0xFFD98A, emissiveIntensity: .8 }));
  bulb.position.y = .5; p.add(bulb);
  return p;
}
/** 노트북 */
export function laptop(g, x, y, z, ry = 0) {
  const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.y = ry; g.add(p);
  box(p, .62, .04, .44, .02, M(IN.metal, .45), 0, .02, 0);
  const s = box(p, .6, .42, .04, .02, M(IN.metalDark, .4), 0, .24, -.2);
  s.rotation.x = -.28;
  box(p, .52, .34, .02, .01, M(0x6EC6E0, .25, { emissive: 0x4EA8C8, emissiveIntensity: .5 }), 0, .245, -.17)
    .rotation.x = -.28;
  return p;
}
/** 책 몇 권 쌓기 */
export function books(g, x, y, z, n = 3) {
  for (let i = 0; i < n; i++)
    box(g, .46 - i * .03, .09, .34, .02, M(BOOKS[(i * 3 + 1) % BOOKS.length], .68), x, y + .05 + i * .1, z);
}
/** 자판기 */
export function vending(g, x, z, ry) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, 1.2, 2.2, .8, .08, M(0xE8695A, .6), 0, 1.1, 0);
  box(p, .84, 1.4, .1, .04, M(0x2A3A48, .3), -.12, 1.36, .38);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
    box(p, .2, .3, .08, .03, M(BOOKS[(r * 3 + c) % BOOKS.length], .6), -.42 + c * .3, 1.0 + r * .38, .43);
  box(p, .3, .5, .1, .04, M(0xFFF0C4, .5), .42, 1.5, .4);
  box(p, .8, .3, .12, .04, M(0x2A3A48, .4), -.1, .5, .4);
  return p;
}
/** 오락기 — 미니게임관 */
export function cabinet(g, x, z, ry, col, theme = '') {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  /* 본체·받침·둥근 측면 장식까지 한 덩어리로 보여 종이 상자가 아니라
     실제 클레이 오락기처럼 읽히게 합니다. */
  box(p, 1.22, .16, 1.06, .08, M(0x33435A, .52), 0, .08, 0);
  box(p, 1.1, 2.0, .9, .13, M(col, .6), 0, 1.0, 0);
  [-1, 1].forEach((s) => box(p, .11, 1.74, .98, .05, M(0xF6FAFD, .52), s * .56, 1.05, 0));
  const scr = box(p, .82, .66, .1, .04, M(0x1E2630, .25, { emissive: 0x3E6E9E, emissiveIntensity: .55 }),
                  0, 1.42, .42);
  scr.rotation.x = .22;
  const zf = .485;
  if (theme === 'runner') {
    [-.20, 0, .20].forEach((yy) => box(p, .58, .025, .025, .01, M(0xD8EEF8, .45), 0, 1.40 + yy, zf));
    [0, 1, 2].forEach((i) => cyl(p, .045, .045, .025, 12, M(0xF3D564, .45), -.22 + i * .22, 1.43, zf).rotation.x = Math.PI / 2);
  } else if (theme === 'memory') {
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sy], i) =>
      box(p, .22, .21, .025, .055, M([0x65C8B2,0xE98D79,0x8CB9E8,0xB39AE1][i], .52), sx * .15, 1.42 + sy * .15, zf));
  } else if (theme === 'match3') {
    for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++)
      cyl(p, .052, .052, .025, 12, M([0x65C8B2,0xE98D79,0x8CB9E8][(xx + yy + 6) % 3], .5), xx * .18, 1.42 + yy * .17, zf).rotation.x = Math.PI / 2;
  } else if (theme === 'merge') {
    [[-.18,1.32,.12],[.14,1.34,.12],[-.05,1.57,.17]].forEach(([xx, yy, rr], i) => {
      const q = new THREE.Mesh(new THREE.SphereGeometry(rr, 14, 10), M([0xF19B86,0x7FCDBA,0xAFA0E3][i], .55));
      q.position.set(xx, yy, zf); p.add(q);
    });
  }
  box(p, .9, .34, .3, .06, M(0x2A2036, .5), 0, 1.02, .38);          // 조작판
  cyl(p, .05, .05, .22, 8, M(IN.metal, .4), -.2, 1.2, .44);
  const kn = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 10), M(0xE8483C, .4));
  kn.position.set(-.2, 1.32, .44); kn.castShadow = true; p.add(kn);
  [0, 1, 2].forEach((i) => cyl(p, .06, .06, .06, 10, M(BOOKS[i], .5), .06 + i * .18, 1.14, .46)
    .rotation.x = Math.PI / 2);
  box(p, 1.18, .25, .98, .08, M(0x2A2036, .5), 0, 2.07, 0);
  box(p, .72, .08, .08, .03, M(col, .45, { emissive: col, emissiveIntensity: .34 }), 0, 2.09, .49);
  [-.35, .35].forEach((dx) => cyl(p, .055, .055, .035, 12, M(0xF4D06F, .4, { emissive: 0xF4D06F, emissiveIntensity: .4 }), dx, .20, .49).rotation.x = Math.PI / 2);
  return p;
}
/** 옷걸이 — 상점 */
export function rack(g, x, z, ry) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  [-1, 1].forEach((s) => cyl(p, .05, .06, 1.7, 8, M(IN.metal, .45), s * .8, .85, 0));
  cyl(p, .04, .04, 1.7, 8, M(IN.metal, .45), 0, 1.66, 0).rotation.z = Math.PI / 2;
  [-.6, -.3, 0, .3, .6].forEach((dx, i) => {
    box(p, .34, .6, .18, .06, M(BOOKS[(i * 2) % BOOKS.length], .7), dx, 1.28, 0);
    cyl(p, .02, .02, .18, 6, M(IN.metal, .4), dx, 1.62, 0);
  });
  return p;
}
/** 알 받침 — 상점 */
export function eggStand(g, x, z, col) {
  const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
  /* 받침도 상품 무대처럼 보이게: 넓은 클레이 베이스 + 둥근 둥지 + 빛 테. */
  cyl(p, .38, .44, .18, 20, M(0xC9D9E4, .58), 0, .09, 0);
  cyl(p, .31, .36, .72, 18, M(IN.woodLight, .68), 0, .50, 0);
  cyl(p, .39, .34, .14, 20, M(0xF7EFE1, .72), 0, .90, 0);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(.34, .035, 8, 28),
    M(col, .28, { emissive: col, emissiveIntensity: .22 }));
  halo.rotation.x = Math.PI / 2; halo.position.y = .98; p.add(halo);
  const e = new THREE.Mesh(new THREE.SphereGeometry(.34, 28, 22), M(col, .66));
  e.position.y = 1.34; e.scale.set(.96, 1.30, .96);
  e.castShadow = true; e.receiveShadow = true; p.add(e);
  /* 앞면의 큰 하이라이트와 점무늬가 종별 색을 입체적으로 읽히게 합니다. */
  [[-.12,1.44,.30,.075],[.13,1.27,.29,.06],[.06,1.58,.23,.045]].forEach(([dx,dy,dz,r]) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), M(0xFFFFFF, .54));
    s.position.set(dx, dy, dz); s.scale.z = .26; p.add(s);
  });
  [[-.18,1.20,.24,.045],[.18,1.46,.24,.052],[-.02,1.62,.18,.038]].forEach(([dx,dy,dz,r]) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), M(0x526578, .22));
    s.position.set(dx, dy, dz); s.scale.z = .28; p.add(s);
  });
  return p;
}

/* ══════════════════════════════════════════════════════════
   빽빽하게 채우기 위한 가구들.
   방이 비어 보이는 이유는 방이 커서가 아니라 **놓인 것이 적어서**입니다.
   레퍼런스의 교실 한 칸에는 서른 개가 넘게 들어 있습니다.
   ══════════════════════════════════════════════════════════ */

/** 천장등 — 줄 · 갓 · 테 · 알.
    전 판은 얇은 원뿔을 뒤집어서 **공중에 뜬 접시** 로 보였습니다.
    갓을 깊게 하고 아래 테를 둘러 등으로 읽히게 합니다. */
export function pendant(g, x, z, y = 3.6, col = IN.gold) {
  const p = new THREE.Group(); p.position.set(x, y, z); g.add(p);
  cyl(p, .035, .035, .74, 8, M(0x3A3F4A, .5), 0, .37, 0);          // 줄
  cyl(p, .12, .12, .1, 10, M(0x3A3F4A, .5), 0, .72, 0);            // 천장 고정쇠
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(.15, .46, .44, 20, 1, true), M(col, .5));
  sh.position.y = -.06; sh.castShadow = true; p.add(sh);
  const inn = new THREE.Mesh(new THREE.CylinderGeometry(.14, .44, .42, 20, 1, true),
    M(0xFFF4D8, .4, { side: THREE.BackSide, emissive: 0xFFE0A0, emissiveIntensity: .5 }));
  inn.position.y = -.06; p.add(inn);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.46, .04, 8, 26), M(col, .45));
  rim.rotation.x = Math.PI / 2; rim.position.y = -.27; p.add(rim);
  const b = new THREE.Mesh(new THREE.SphereGeometry(.15, 14, 10),
    M(0xFFF0C4, .3, { emissive: 0xFFD070, emissiveIntensity: 1.2 }));
  b.position.y = -.16; p.add(b);
  return p;
}
/** 형광등 — 강의실·회관용 긴 등 */
export function striplight(g, x, z, y = 3.6, w = 3.0) {
  const p = new THREE.Group(); p.position.set(x, y, z); g.add(p);
  box(p, w, .16, .5, .05, M(0xE6EAF0, .5), 0, 0, 0);
  box(p, w - .3, .06, .34, .02, M(0xFFFCF0, .3, { emissive: 0xFFF4D0, emissiveIntensity: .9 }), 0, -.1, 0);
  [-1, 1].forEach((s) => cyl(p, .015, .015, .3, 6, M(IN.metalDark, .4), s * (w / 2 - .3), .15, 0));
  return p;
}
/* ════════════════════════════════════════════════════════
   벽시계 바늘 — 실제 시각.

   전 판은 바늘을 판에 그려 붙여서 여섯 방의 시계가 전부 3시였습니다.
   방마다 하나뿐이라 티가 안 날 것 같지만, 하늘은 시각을 따라가는데
   시계만 안 따라가면 그 자리가 **멈춘 그림**으로 읽힙니다.

   바늘은 초당 한 번만 돌립니다. 여기서 requestAnimationFrame 을 하나
   더 여는 것은 이 화면에서 제일 하면 안 되는 일입니다 — 걷는 프레임과
   웹캠 자세 추정이 같은 탭에서 예산을 나눠 씁니다. 초당 한 번이면
   시침·분침이 움직이는 폭보다 촘촘합니다.

   시계는 WeakRef 로 잡습니다. 기숙사는 가구를 놓을 때마다 방을 통째로
   다시 짓는데, 목록이 옛 방을 세게 잡고 있으면 버려진 방의 바늘을
   영원히 돌리게 됩니다(그리고 옛 방이 통째로 안 버려집니다).
   ════════════════════════════════════════════════════════ */
const CLOCKS = [];
const wref = typeof WeakRef === 'function' ? (o) => new WeakRef(o) : (o) => ({ deref: () => o });
let clockTimer = 0, clockHour = null;

/** 바늘을 지금 시각에 맞춥니다. date 를 주면 그 시각으로 한 번만 칠합니다.
    돌아오는 값은 아직 살아 있는 시계 수입니다. */
export function tickClocks(date) {
  let h;
  if (date) h = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  else if (clockHour !== null) h = clockHour;
  else { const d = new Date(); h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600; }
  /* 시침은 분을 따라 **조금씩** 갑니다. 정시에 딱 붙여 두면 12시 59분에
     12시를 가리켜서, 시각이 아니라 고장 난 시계로 읽힙니다. */
  const hd = -((h % 12) / 12) * Math.PI * 2;
  const md = -(h % 1) * Math.PI * 2;
  let live = 0;
  for (let i = 0; i < CLOCKS.length; i++) {
    const c = CLOCKS[i].deref();
    if (!c) continue;
    c.userData.hourHand.rotation.z = hd;
    c.userData.minHand.rotation.z = md;
    CLOCKS[live++] = CLOCKS[i];
  }
  CLOCKS.length = live;
  if (!live) stopClocks();
  return live;
}
/** sky.js 의 setHour 와 짝입니다 — 하늘만 밤으로 돌려 놓고 시계는 낮이면
    시연 화면에서 둘이 어긋나 보입니다. null 이면 실제 시각. */
export function setClockHour(h) {
  clockHour = (h === null || h === undefined) ? null : h;
  tickClocks();
}
/** 초당 한 번짜리 공용 타이머. 시계를 처음 세울 때 저절로 켜집니다. */
export function startClocks(ms = 1000) {
  if (clockTimer || typeof setInterval !== 'function') return;
  clockTimer = setInterval(() => tickClocks(), ms);
  tickClocks();
}
export function stopClocks() {
  if (clockTimer) { clearInterval(clockTimer); clockTimer = 0; }
}

/** 벽시계 — 바늘이 실제 시각을 가리킵니다.
    초침은 달지 않았습니다. r 이 0.42(기숙사는 0.34)라 초침 폭이 2cm 도
    안 되는데, 3/4 부감 카메라에서 그 굵기는 선이 아니라 **얼룩**입니다.
    게다가 1초마다 눈에 띄게 튀어서, 없는 편이 조용합니다. */
export function clock(g, x, y, z, ry = 0, r = .42) {
  const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.y = ry; g.add(p);
  cyl(p, r, r, .12, 26, M(IN.woodDark, .5), 0, 0, 0).rotation.x = Math.PI / 2;
  cyl(p, r - .07, r - .07, .14, 26, M(IN.paper, .45), 0, 0, .02).rotation.x = Math.PI / 2;
  /* 눈금 넷 — 바늘만 돌면 어디를 가리키는지 안 읽힙니다. 12·3·6·9 만
     찍어도 시각이 잡힙니다. 열두 개는 이 크기에서 그냥 톱니입니다. */
  [0, 1, 2, 3].forEach((i) => {
    const a = i * Math.PI / 2;
    /* 눈금은 바늘보다 **얕게** 둡니다. 같은 깊이면 12·3·6·9 를 지날 때
       바늘이 눈금 뒤로 사라져서, 그 네 곳에서만 시계가 끊겨 보입니다. */
    box(p, .05, r * .18, .13, .02, P(IN.ink, .4),
        Math.sin(a) * (r - .13), Math.cos(a) * (r - .13), .05).rotation.z = -a;
  });
  /* 바늘 묶음 — 굽기에서 뺍니다. 합쳐지면 형상이 방 좌표로 구워져서
     아무리 돌려도 안 움직입니다(바로 그래서 전 판이 3시였습니다). */
  const hands = new THREE.Group();
  hands.name = 'clockHands'; hands.position.z = .05; hands.userData.noBake = true; p.add(hands);
  const hand = (len, wid, back) => {
    const pv = new THREE.Group(); pv.userData.noBake = true; hands.add(pv);
    const m = box(pv, wid, len, .14, .015, P(IN.ink, .4), 0, len / 2 - back, 0);
    m.castShadow = false; m.userData.noBake = true;
    return pv;
  };
  /* 시침은 짧고 두껍게, 분침은 길고 얇게. 둘이 같은 굵기면 겹치는
     순간 어느 쪽이 시침인지 못 고릅니다. */
  const hourHand = hand(r * .52, r * .17, r * .09);
  const minHand = hand(r * .86, r * .095, r * .11);
  cyl(p, .05, .05, .18, 10, M(IN.ink, .4), 0, 0, .05).rotation.x = Math.PI / 2;
  p.userData.hands = hands;
  p.userData.hourHand = hourHand;
  p.userData.minHand = minHand;
  CLOCKS.push(wref(p));
  startClocks();                                  // 첫 시계가 타이머를 켭니다
  tickClocks();                                   // 세운 그 순간부터 맞습니다
  return p;
}
/** 벽 포스터 · 액자 — 벽이 비면 방이 창고입니다 */
export function poster(g, x, y, z, ry, w = .9, h = 1.2, col = 0x5B84C4, frame) {
  const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.y = ry; g.add(p);
  if (frame !== false) box(p, w + .12, h + .12, .08, .03, M(frame || IN.woodDark, .6), 0, 0, 0);
  box(p, w, h, .09, .02, M(IN.paper, .6), 0, 0, .03);
  box(p, w - .16, h * .55, .1, .03, M(col, .6), 0, h * .16, .05);
  [0, 1, 2].forEach((i) => box(p, (w - .3) * (1 - i * .18), .05, .1, .02, M(IN.ink, .5), 0, -h * .18 - i * .12, .05));
  return p;
}
/** 사물함 — 뒤벽을 채웁니다 */
export function lockers(g, x, z, ry, n = 4, col = 0x7FA8C4) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  sbox(p, n * .62 + .1, 1.9, .52, .05, M(IN.metalDark, .6), 0, .95, 0);
  for (let i = 0; i < n; i++) {
    const dx = -n * .31 + .31 + i * .62;
    [0, 1].forEach((r) => {
      sbox(p, .54, .86, .48, .04, M(col, .55), dx, .5 + r * .9, .04);
      sbox(p, .3, .05, .5, .02, M(0x2A3A48, .4), dx, .82 + r * .9, .06);   // 통풍구
      scyl(p, .04, .04, .12, 8, M(IN.metal, .35), dx + .18, .5 + r * .9, .28).rotation.x = Math.PI / 2;
    });
  }
  return p;
}
/** 쓰레기통 */
export function bin(g, x, z, col = 0x5E8C6A) {
  const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
  cyl(p, .26, .21, .62, 14, M(col, .6), 0, .31, 0);
  cyl(p, .29, .29, .08, 14, M(IN.metalDark, .5), 0, .64, 0);
  cyl(p, .2, .2, .04, 14, M(0x2A3A48, .5), 0, .69, 0);
  return p;
}
/** 정수기 */
export function cooler(g, x, z, ry = 0) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, .68, 1.1, .6, .07, M(0xE6EAF0, .5), 0, .55, 0);
  box(p, .5, .34, .1, .04, M(0x9FD8EE, .3), 0, .78, .3);
  [-1, 1].forEach((s) => cyl(p, .05, .05, .16, 8, M(0x3E6E82, .4), s * .16, .5, .3).rotation.x = Math.PI / 2);
  const b = new THREE.Mesh(new THREE.CylinderGeometry(.26, .18, .62, 16), M(0xBFEAF5, .25));
  b.position.y = 1.42; b.castShadow = true; p.add(b);
  cyl(p, .12, .12, .16, 12, M(0x5B84C4, .5), 0, 1.14, 0);
  [-.24, 0, .24].forEach((dx) => cyl(p, .1, .1, .24, 12, M(IN.paper, .4), dx, .18, .34));  // 종이컵
  return p;
}
/** 소파 — 앉는 자리. 좌판 · 등받이 · 팔걸이 둘 · 쿠션 둘 */
export function sofa(g, x, z, ry, w = 2.6, col = 0x9B7BD4) {
  [-w / 4, w / 4].forEach((off) => regSeatLocal(x, z, ry, off, .05, 'sofa'));
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  const dk = M(col, .8), lt = M(col, .62);
  box(p, w, .28, 1.1, .12, dk, 0, .34, 0);
  box(p, w - .4, .22, .95, .11, lt, 0, .55, .04);
  box(p, w, .78, .3, .12, dk, 0, .74, -.5);
  [-1, 1].forEach((s) => box(p, .3, .62, 1.1, .12, dk, s * (w / 2 - .15), .58, 0));
  [-1, 1].forEach((s) => box(p, w / 2 - .6, .16, .5, .08, M(0xFFF0DC, .8), s * w * .2, .78, -.34));
  [-1, 1].forEach((s) => cyl(p, .07, .06, .2, 8, M(IN.woodDark, .6), s * (w / 2 - .25), .1, .4));
  return p;
}

/** 문 매트 — 나가는 자리 표시. 방마다 문 앞에 깝니다.
    화살표가 문 쪽(+z)을 가리킵니다. */
export function doormat(g, x, z, col = 0x4E8C9E) {
  const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
  const flat = (m) => { m.castShadow = false; return m; };
  flat(box(p, 2.6, .05, 1.5, .1, M(col, .9), 0, .05, 0));
  flat(box(p, 2.2, .05, 1.1, .09, M(0xFFF6E6, .9), 0, .066, 0));
  /* 화살표 — 납작한 프리즘 */
  { const a = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .05, 3), M(col, .8));
    a.position.set(0, .095, .12); a.rotation.y = Math.PI;
    a.scale.set(1, 1, .72); a.castShadow = false; p.add(a); }
  flat(box(p, .2, .05, .5, .06, M(col, .8), 0, .09, -.3));
  p.traverse((o) => { o.userData.noCollide = true; });
  return p;
}

/** 출구 표지 — 방마다 색이 다른 문틀과 빛나는 화살표를 둡니다.
    매트만 있으면 낮은 시점에서는 가구에 가려져 출구를 놓치므로,
    시선 높이에서도 보이는 표식을 문 옆에 한 번 더 세웁니다. */
export function exitSign(g, x, z, col = 0x4E8C9E) {
  const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
  const frame = M(IN.ink, .48), glow = M(col, .28, { emissive: col, emissiveIntensity: .48 });
  box(p, 2.7, .16, .18, .04, frame, 0, 2.75, 0);
  box(p, .16, 2.7, .18, .04, frame, -1.28, 1.42, 0);
  box(p, .16, 2.7, .18, .04, frame, 1.28, 1.42, 0);
  box(p, 1.35, .48, .16, .12, glow, 0, 2.43, -.03);
  /* 문 방향(+z)을 가리키는 삼각 화살표와 짧은 몸통. */
  const arrow = new THREE.Mesh(new THREE.CylinderGeometry(.20, .20, .08, 3), glow);
  arrow.position.set(.34, 2.43, -.13); arrow.rotation.set(Math.PI / 2, Math.PI, 0); p.add(arrow);
  box(p, .50, .12, .10, .04, glow, -.10, 2.43, -.13);
  p.traverse((o) => { o.userData.noCollide = true; });
  return p;
}


/** 잡지꽂이 — 도서관 앞쪽 */
export function mag(g, x, z, ry) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry || 0; g.add(p);
  box(p, 1.2, 1.15, .32, .05, M(IN.woodDark, .72), 0, .58, 0);
  [0, 1, 2].forEach((r) => {
    box(p, 1.06, .05, .3, .02, M(IN.wood, .68), 0, .34 + r * .32, .02);
    let bx = -.42;
    while (bx < .42) {
      box(p, .2, .26, .03, .01,
        M([0x63C47C, 0xE8935A, 0x5B84C4, 0xF2C14E, 0x9B7BD4][Math.abs(Math.round(bx * 17 + r * 3)) % 5], .6),
        bx, .5 + r * .32, .15);
      bx += .24;
    }
  });
  return p;
}

/** 낮은 탁자 */
export function lowTable(g, x, z, ry, w = 1.4, d = .9) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, w, .12, d, .05, M(IN.wood, .68), 0, .5, 0);
  box(p, w - .3, .08, d - .3, .04, M(IN.woodDark, .74), 0, .26, 0);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) =>
    cyl(p, .05, .06, .48, 8, M(IN.woodDark, .7), sx * (w / 2 - .14), .24, sz * (d / 2 - .14)));
  return p;
}
/** 원탁 + 의자 넷 — 식당·회관 */
export function cafeSet(g, x, z, col = 0x63C47C) {
  const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
  cyl(p, .82, .82, .1, 24, M(IN.woodLight, .65), 0, .74, 0);
  cyl(p, .78, .78, .06, 24, M(IN.wood, .7), 0, .68, 0);
  cyl(p, .12, .12, .7, 12, M(IN.metalDark, .45), 0, .38, 0);
  cyl(p, .42, .46, .08, 18, M(IN.metalDark, .45), 0, .06, 0);
  [0, 1, 2, 3].forEach((i) => {
    const a = i * Math.PI / 2 + .4, r = 1.24;
    const inward = Math.atan2(-Math.cos(a), -Math.sin(a));
    regSeat(x + Math.cos(a) * r, z + Math.sin(a) * r, inward, 'chair');
    const c = new THREE.Group(); c.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    c.rotation.y = inward; p.add(c);
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) =>
      cyl(c, .05, .06, .46, 8, M(IN.metalDark, .45), sx * .21, .23, sz * .21));
    box(c, .58, .12, .58, .06, M(col, .68), 0, .52, 0);
    box(c, .56, .56, .11, .06, M(col, .68), 0, .84, -.24);
    box(c, .46, .1, .12, .04, M(IN.metalDark, .5), 0, .66, -.27);
  });
  return p;
}
/** 책 수레 — 도서관 */
export function bookCart(g, x, z, ry) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  [0, 1].forEach((r) => {
    box(p, 1.1, .07, .5, .03, M(IN.woodDark, .7), 0, .42 + r * .42, 0);
    let bx = -.46;
    while (bx < .4) {
      const bw = .08 + ((bx * 41 + r * 9) % 4) * .02;
      box(p, bw, .3, .28, .02, M(BOOKS[Math.abs(Math.round(bx * 23 + r * 5)) % BOOKS.length], .68),
          bx + bw / 2, .61 + r * .42, 0);
      bx += bw + .012;
    }
  });
  [-1, 1].forEach((s) => box(p, .09, .96, .5, .04, M(IN.wood, .7), s * .55, .5, 0));
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) =>
    cyl(p, .09, .09, .06, 12, M(0x3A3F4A, .4), sx * .46, .07, sz * .2).rotation.x = Math.PI / 2);
  return p;
}
/** 지구본 */
export function globe(g, x, y, z) {
  const p = new THREE.Group(); p.position.set(x, y, z); g.add(p);
  cyl(p, .2, .24, .06, 14, M(IN.woodDark, .6), 0, .03, 0);
  cyl(p, .03, .03, .3, 8, M(IN.gold, .35), 0, .18, 0);
  const b = new THREE.Mesh(new THREE.SphereGeometry(.26, 20, 14), M(0x5B9BD4, .5));
  b.position.y = .52; b.rotation.z = .38; b.castShadow = true; p.add(b);
  [[.1,.58,.2],[-.14,.46,.18],[.06,.36,-.22]].forEach(([dx,dy,dz]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(.11, 12, 8), M(0x63C47C, .6));
    m.position.set(dx, dy, dz); m.scale.z = .3; m.lookAt(dx * 5, (dy - .52) * 5 + .52, dz * 5); p.add(m);
  });
  const rg = new THREE.Mesh(new THREE.TorusGeometry(.3, .022, 8, 28), M(IN.gold, .35));
  rg.position.y = .52; rg.rotation.y = Math.PI / 2; p.add(rg);
  return p;
}
/** 열람 칸막이 자리(캐럴) — 도서관의 1인석 */
export function carrel(g, x, z, ry) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  sbox(p, 1.2, .12, 1.0, .04, M(IN.wood, .7), 0, .78, 0);
  sbox(p, 1.2, .74, .09, .04, M(IN.woodDark, .74), 0, 1.1, -.46);
  [-1, 1].forEach((s) => sbox(p, .09, .58, 1.0, .04, M(IN.woodDark, .74), s * .56, 1.02, 0));
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) =>
    scyl(p, .045, .055, .72, 8, M(IN.metal, .5), sx * .5, .36, sz * .4));
  sbox(p, .4, .06, .2, .02, M(IN.gold, .5), .3, 1.42, -.42);     // 작은 등
  return p;
}
/** 검색 단말 — 도서관. 서가가 열 줄이 되면 "그 책이 어디 있는지" 를
    물어볼 데가 있어야 합니다. 대출대까지 걸어가는 것 말고요. */
export function kiosk(g, x, z, ry = 0) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  sbox(p, .74, .07, .5, .02, P(IN.metalDark, .5), 0, .035, 0);
  sbox(p, .5, 1.0, .34, .05, P(IN.woodDark, .72), 0, .53, 0);
  sbox(p, .66, .1, .46, .04, P(IN.woodLight, .6), 0, 1.06, 0);
  /* 화면은 뒤로 눕힙니다. 똑바로 세우면 3/4 부감에서 테두리만 보입니다. */
  sbox(p, .58, .46, .07, .03, P(0x3A3F4A, .5), 0, 1.32, .02).rotation.x = -.3;
  sbox(p, .5, .38, .04, .02,
      M(0x6EC6E0, .25, { emissive: 0x4EA8C8, emissiveIntensity: .55 }), 0, 1.33, .06).rotation.x = -.3;
  scyl(p, .04, .04, .18, 10, P(IN.metal, .4), .22, 1.09, .16);        // 바코드 읽는 것
  return p;
}
/** 겹쳐 놓은 의자 */
export function stackChairs(g, x, z, ry, n = 5, col = 0x9BB4D6) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  for (let i = 0; i < n; i++) {
    sbox(p, .46, .08, .46, .04, M(col, .68), 0, .5 + i * .13, i * .04);
    sbox(p, .44, .42, .07, .04, M(col, .68), 0, .74 + i * .13, -.2 + i * .04);
  }
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) =>
    scyl(p, .035, .045, .48, 8, M(IN.metal, .45), sx * .17, .24, sz * .17));
  return p;
}
/** 거울 */
export function mirror(g, x, y, z, ry, w = .8, h = 1.8) {
  const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.y = ry; g.add(p);
  box(p, w + .16, h + .16, .12, .07, M(IN.woodDark, .55), 0, 0, 0);
  box(p, w, h, .1, .04, M(0xDCE8F0, .12, { metalness: .1 }), 0, 0, .05);
  box(p, w * .5, h * .4, .11, .03, M(0xF0F6FA, .1), -w * .18, h * .2, .07);
  return p;
}
/** 작은 냉장고 */
export function fridge(g, x, z, ry, col = 0xE6EAF0) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, .86, 1.24, .78, .08, M(col, .5), 0, .62, 0);
  box(p, .8, .34, .74, .06, M(0xF6F8FA, .45), 0, 1.06, .03);
  box(p, .06, .3, .06, .02, M(IN.metal, .35), .3, .68, .4);
  box(p, .06, .16, .06, .02, M(IN.metal, .35), .3, 1.06, .4);
  [[-.16,1.34,0x2DD4BF],[.1,1.34,0xE8695A]].forEach(([dx,dy,c]) =>
    cyl(p, .1, .1, .22, 12, M(c, .5), dx, dy, 0));                // 위에 올린 캔
  return p;
}
/** 커튼 — 탈의실 · 창가 */
export function curtain(g, x, y, z, ry, w = 1.2, h = 2.0, col = 0x3FB3A2) {
  const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.y = ry; g.add(p);
  cyl(p, .05, .05, w + .3, 10, M(IN.metal, .4), 0, h / 2 + .06, 0).rotation.z = Math.PI / 2;
  const n = Math.max(4, Math.round(w / .18));
  for (let i = 0; i < n; i++)
    cyl(p, w / n * .5, w / n * .5, h, 8, M(i % 2 ? col : 0x000000, .72, i % 2 ? {} : { color: col }),
        -w / 2 + (i + .5) * (w / n), 0, (i % 2 ? .06 : -.02));
  return p;
}
/** 마네킹 — 상점. 사람 몸에 머리는 공 하나 */
export function mannequin(g, x, z, ry, top = 0xE8695A, bot = 0x3E5C82) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  cyl(p, .34, .4, .1, 16, M(IN.woodDark, .6), 0, .05, 0);
  cyl(p, .05, .05, .5, 8, M(IN.metal, .4), 0, .3, 0);
  [-.13, .13].forEach((dx) => cyl(p, .1, .11, .5, 10, M(bot, .62), dx, .78, 0));
  box(p, .58, .62, .38, .2, M(top, .6), 0, 1.32, 0);
  [-1, 1].forEach((s) => {
    const a = new THREE.Group(); a.position.set(s * .33, 1.5, 0); a.rotation.z = s * .34; p.add(a);
    cyl(a, .08, .08, .42, 10, M(top, .6), 0, -.2, 0);
  });
  const h = new THREE.Mesh(new THREE.SphereGeometry(.2, 16, 12), M(0xEADCC8, .5));
  h.position.y = 1.82; h.castShadow = true; p.add(h);
  return p;
}
/** 신발 진열 선반 */
export function shoeShelf(g, x, z, ry) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, 1.8, 1.5, .5, .05, M(IN.woodDark, .74), 0, .75, 0);
  [0, 1, 2].forEach((r) => {
    box(p, 1.66, .07, .5, .02, M(IN.woodLight, .6), 0, .34 + r * .42, .14);
    [-.55, 0, .55].forEach((dx, i) => {
      const c = BOOKS[(r * 3 + i) % BOOKS.length];
      box(p, .4, .17, .32, .07, M(c, .6), dx, .47 + r * .42, .24);
      box(p, .34, .13, .2, .06, M(c, .45), dx, .59 + r * .42, .16);
      box(p, .42, .05, .34, .02, M(0x3A3F4A, .5), dx, .4 + r * .42, .24);
    });
  });
  return p;
}
/** 모자 벽 — 상점 */
export function hatWall(g, x, y, z, ry, n = 5) {
  const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.y = ry; g.add(p);
  box(p, n * .56, .1, .18, .04, M(IN.woodDark, .7), 0, .3, 0);
  for (let i = 0; i < n; i++) {
    const dx = -n * .28 + .28 + i * .56, c = BOOKS[(i * 3) % BOOKS.length];
    cyl(p, .04, .04, .2, 6, M(IN.metal, .4), dx, .2, .06);
    cyl(p, .24, .26, .06, 16, M(c, .6), dx, .04, .12);
    cyl(p, .15, .17, .18, 16, M(c, .6), dx, .14, .12);
  }
  return p;
}
/** 네온 간판 — 미니게임관 */
export function neon(g, text, x, y, z, ry, col = 0xFF5FA8, w = 2.6) {
  const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.y = ry; g.add(p);
  box(p, w, .7, .16, .1, M(0x2A2036, .5), 0, 0, 0);
  box(p, w - .24, .46, .1, .18, M(col, .3, { emissive: col, emissiveIntensity: 1.1 }), 0, 0, .08);
  box(p, w - .6, .12, .1, .06, M(0xFFFFFF, .3, { emissive: 0xFFFFFF, emissiveIntensity: .9 }), 0, .1, .11);
  return p;
}
/** 인형 뽑기 */
export function claw(g, x, z, ry, col = 0xFF7FA8) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, 1.2, .9, 1.0, .08, M(col, .55), 0, .45, 0);
  const glass = M(0xBFEAF5, .12, { transparent: true, opacity: .42 });
  box(p, 1.16, 1.5, .96, .06, glass, 0, 1.66, 0);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) =>
    box(p, .1, 1.5, .1, .03, M(col, .5), sx * .55, 1.66, sz * .45));
  box(p, 1.24, .28, 1.06, .1, M(col, .5), 0, 2.5, 0);
  /* 안에 인형 여섯 */
  [[-.3,-.24],[.1,-.3],[.32,.06],[-.26,.22],[.04,.1],[-.02,-.02]].forEach(([dx,dz], i) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(.18, 12, 10), M(BOOKS[i % BOOKS.length], .7));
    b.position.set(dx, 1.1 + (i % 2) * .18, dz); p.add(b);
    [-1, 1].forEach((s) => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), M(BOOKS[i % BOOKS.length], .7));
      e.position.set(dx + s * .13, 1.24 + (i % 2) * .18, dz); p.add(e);
    });
  });
  cyl(p, .05, .05, .34, 8, M(IN.metalDark, .4), 0, 2.2, 0);
  [0, 1, 2].forEach((i) => {
    const a = i * Math.PI * 2 / 3;
    box(p, .06, .22, .06, .02, M(IN.metal, .35), Math.cos(a) * .1, 2.0, Math.sin(a) * .1);
  });
  box(p, .5, .3, .1, .05, M(0x2A2036, .4), 0, .5, .52);
  return p;
}
/** 에어하키 대 */
export function airHockey(g, x, z, ry) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, 2.6, .6, 1.5, .08, M(0x2A2036, .5), 0, .4, 0);
  box(p, 2.5, .1, 1.4, .05, M(0xE8F4FF, .35), 0, .74, 0);
  box(p, 2.2, .12, .06, .02, M(0x5B84C4, .5), 0, .78, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.32, .04, 8, 24), M(0xE8695A, .5));
  ring.rotation.x = Math.PI / 2; ring.position.set(0, .78, 0); p.add(ring);
  [-1, 1].forEach((s) => {
    cyl(p, .18, .18, .1, 14, M(s > 0 ? 0x2DD4BF : 0xE8695A, .5), s * .8, .82, s * .3);
    box(p, .1, .3, .5, .04, M(0x9B7BD4, .5), s * 1.28, .82, 0);
  });
  cyl(p, .1, .1, .06, 12, M(0xF2C14E, .4), .3, .8, -.3);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) =>
    cyl(p, .07, .09, .38, 8, M(IN.metalDark, .45), sx * 1.1, .2, sz * .6));
  return p;
}
/** 경품 선반 */
export function prizeShelf(g, x, z, ry) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, 2.0, 1.9, .46, .06, M(0x9B7BD4, .6), 0, .95, 0);
  [0, 1, 2].forEach((r) => {
    box(p, 1.86, .07, .46, .02, M(0xF6E8DC, .5), 0, .5 + r * .5, .14);
    [-.6, -.2, .2, .6].forEach((dx, i) => {
      const c = BOOKS[(r * 4 + i) % BOOKS.length];
      const b = new THREE.Mesh(new THREE.SphereGeometry(.15, 12, 10), M(c, .7));
      b.position.set(dx, .68 + r * .5, .2); b.castShadow = true; p.add(b);
      [-1, 1].forEach((s) => {
        const e = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), M(c, .7));
        e.position.set(dx + s * .11, .8 + r * .5, .2); p.add(e);
      });
    });
  });
  return p;
}
/** 줄 세우는 기둥 */
export function stanchion(g, x, z, x2, z2) {
  [[x, z], [x2, z2]].forEach(([px, pz]) => {
    const p = new THREE.Group(); p.position.set(px, 0, pz); g.add(p);
    cyl(p, .22, .26, .08, 14, M(IN.metalDark, .4), 0, .04, 0);
    cyl(p, .05, .05, .9, 10, M(IN.metal, .35), 0, .48, 0);
    const k = new THREE.Mesh(new THREE.SphereGeometry(.09, 12, 10), M(IN.gold, .35));
    k.position.y = .96; p.add(k);
  });
  const dx = x2 - x, dz = z2 - z, L = Math.hypot(dx, dz);
  const c = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, L, 8), M(0xC4544A, .7));
  c.position.set((x + x2) / 2, .78, (z + z2) / 2);
  c.rotation.z = Math.PI / 2; c.rotation.y = -Math.atan2(dz, dx);
  g.add(c);
}
/** 천장 현수막 */
export function banner(g, x, y, z, ry, w = 3.4, h = 1.0, col = 0x2DD4BF) {
  const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.y = ry; g.add(p);
  cyl(p, .05, .05, w + .4, 10, M(IN.woodDark, .5), 0, h / 2, 0).rotation.z = Math.PI / 2;
  [-1, 1].forEach((s) => cyl(p, .07, .07, .1, 10, M(IN.gold, .4), s * (w / 2 + .2), h / 2, 0)
    .rotation.z = Math.PI / 2);
  box(p, w, h, .08, .04, M(col, .72), 0, 0, 0);
  box(p, w - .5, .12, .1, .04, M(0xFFFFFF, .5), 0, .18, .03);
  box(p, w - 1.3, .12, .1, .04, M(0xFFFFFF, .5), 0, -.06, .03);
  [-1, 1].forEach((s) => cyl(p, .02, .02, .34, 6, M(IN.metalDark, .4), s * (w / 2 - .1), h / 2 + .17, 0));
  return p;
}
/** 라디에이터 — 창 밑 */
export function radiator(g, x, z, ry, w = 1.8) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, w, .68, .24, .04, M(0xE6EAF0, .5), 0, .5, 0);
  const n = Math.round(w / .17);
  for (let i = 0; i < n; i++)
    box(p, .09, .58, .28, .03, M(0xF2F5F8, .45), -w / 2 + (i + .5) * (w / n), .5, .02);
  box(p, w + .06, .08, .3, .03, M(0xDCE2E8, .5), 0, .86, 0);
  return p;
}
/** 강의용 스크린 · 교탁 */
export function projScreen(g, x, y, z, w = 3.4, h = 2.0) {
  const p = new THREE.Group(); p.position.set(x, y, z); g.add(p);
  cyl(p, .16, .16, w + .3, 14, M(IN.metalDark, .45), 0, h / 2 + .16, 0).rotation.z = Math.PI / 2;
  box(p, w, h, .1, .02, M(0xF8FAFC, .5), 0, 0, .03);
  /* 띄운 화면 — 하얀 판만 있으면 벽 얼룩입니다 */
  box(p, w - .3, h - .34, .06, .02,
      M(0xBFD8EC, .3, { emissive: 0x6E9EC4, emissiveIntensity: .35 }), 0, .02, .08);
  box(p, w * .62, .12, .07, .03, M(0x3E5C82, .4), -w * .12, h * .22, .11);
  [0, 1, 2].forEach((i) => box(p, (w - .9) * (1 - i * .16), .09, .07, .02, M(0x5B84C4, .45),
      -w * .04, -i * .22, .11));
  box(p, w + .12, .12, .16, .05, M(IN.metalDark, .45), 0, -h / 2, .04);
  return p;
}
export function podium(g, x, z, ry) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, .9, 1.1, .66, .06, M(IN.woodDark, .74), 0, .55, 0);
  box(p, 1.02, .1, .78, .04, M(IN.wood, .66), 0, 1.14, 0).rotation.x = -.14;
  box(p, .74, .5, .08, .03, M(IN.woodLight, .6), 0, .74, .34);
  box(p, .3, .04, .22, .02, M(IN.paper, .5), 0, 1.2, .06);
  cyl(p, .03, .03, .3, 6, M(IN.metalDark, .4), .28, 1.34, 0);
  const mic = new THREE.Mesh(new THREE.SphereGeometry(.06, 10, 8), M(0x3A3F4A, .4));
  mic.position.set(.28, 1.5, .04); p.add(mic);
  return p;
}
/** 강단 스피커 — 본관. spots.js 는 이 자리를 부르는데 실물이 없어서,
    빈 바닥 위에 말풍선만 떠 있었습니다. 이 방이 왜 음악이 나오는
    방인지가 그 자리에서 안 보였습니다.
    기둥이 얇아서 키가 2 미터여도 뒤가 다 보입니다. */
export function speaker(g, x, z, ry = 0) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  scyl(p, .3, .36, .07, 14, P(IN.metalDark, .5), 0, .035, 0);
  scyl(p, .05, .05, 1.0, 8, P(IN.metal, .45), 0, .53, 0);
  sbox(p, .54, 1.05, .44, .05, P(0x3A3F4A, .6), 0, 1.5, 0);
  /* 우퍼 · 트위터 — 통 하나만 세워 두면 스피커가 아니라 검은 상자입니다 */
  scyl(p, .2, .2, .07, 18, P(0x2A2036, .5), 0, 1.26, .21).rotation.x = Math.PI / 2;
  scyl(p, .08, .08, .05, 14, P(IN.metal, .4), 0, 1.26, .25).rotation.x = Math.PI / 2;
  scyl(p, .11, .11, .07, 14, P(0x2A2036, .5), 0, 1.78, .21).rotation.x = Math.PI / 2;
  sbox(p, .38, .05, .12, .02, P(IN.metalDark, .5), 0, 1.94, .18);
  scyl(p, .015, .015, .5, 6, P(0x2A2036, .5), .2, .3, -.2);          // 늘어진 줄
  return p;
}
/** 배식대 — 학생회관 식당 */
export function trayCounter(g, x, z, ry, w = 4.0) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, w, 1.0, 1.0, .06, M(0xD8DEE6, .5), 0, .5, 0);
  box(p, w + .16, .12, 1.16, .05, M(IN.metal, .4), 0, 1.06, 0);
  box(p, w, .1, .24, .04, M(IN.metal, .35), 0, 1.24, .5);      // 쟁반 레일
  const n = Math.max(3, Math.round(w / 1.1));
  for (let i = 0; i < n; i++) {
    const dx = -w / 2 + (i + .5) * (w / n);
    box(p, w / n - .18, .2, .66, .05, M(IN.metalDark, .4), dx, 1.16, .04);
    box(p, w / n - .3, .16, .54, .05, M(BOOKS[i % BOOKS.length], .55), dx, 1.26, .04);
    box(p, w / n - .44, .08, .4, .04, M(BOOKS[(i + 3) % BOOKS.length], .5), dx, 1.34, .04);
    [-1, 1].forEach((s) => cyl(p, .028, .028, .62, 6, M(IN.metal, .3), dx + s * (w / n / 2 - .18), 1.6, -.24));
    box(p, w / n - .06, .06, .52, .02,
        M(0xEAF4FA, .2, { transparent: true, opacity: .5 }), dx, 1.9, -.16);
  }
  return p;
}
/** 커피 기계 */
export function coffee(g, x, y, z, ry = 0) {
  const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.y = ry; g.add(p);
  box(p, .7, .8, .5, .07, M(0x5A4636, .5), 0, .4, 0);
  box(p, .52, .3, .1, .04, M(0x2A3A48, .3), 0, .58, .24);
  [-1, 1].forEach((s) => cyl(p, .06, .06, .26, 10, M(IN.metal, .35), s * .16, .22, .2));
  [-1, 1].forEach((s) => cyl(p, .09, .07, .14, 12, M(IN.paper, .45), s * .16, .07, .2));
  box(p, .74, .1, .54, .04, M(0x3A2E28, .5), 0, .84, 0);
  return p;
}
/** A 형 안내판 — 전 판은 판을 놓고 나서 돌려서 **바닥에 널브러진 널빤지**
    가 됐습니다. 판을 축 그룹에 넣고 밑변을 축으로 세웁니다. */
export function aFrame(g, x, z, ry, col = 0x2DD4BF) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  [-1, 1].forEach((s) => {
    const leaf = new THREE.Group();
    leaf.position.set(0, 0, s * .1);
    leaf.rotation.x = -s * .17;
    p.add(leaf);
    box(leaf, 1.15, 1.6, .1, .05, M(IN.woodLight, .62), 0, .82, 0);
    box(leaf, .98, 1.3, .07, .04, M(IN.paper, .5), 0, .88, s * .07);
    box(leaf, .82, .34, .08, .04, M(col, .55), 0, 1.28, s * .1);
    [0, 1, 2].forEach((i) =>
      box(leaf, .76 - i * .14, .08, .08, .02, M(IN.ink, .5), 0, .78 - i * .18, s * .1));
  });
  box(p, .9, .07, .34, .03, M(IN.woodDark, .7), 0, .52, 0);       // 가로대
  return p;
}

/** 출입문용 안내 키오스크 — 책처럼 접힌 A형 판 대신 한눈에 읽히는 양면 표지판. */
export function infoKiosk(g, x, z, ry, col = 0x2DD4BF) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  cyl(p, .3, .34, .10, 16, M(IN.metalDark, .45), 0, .05, 0);
  cyl(p, .07, .07, 1.15, 10, M(IN.metal, .4), 0, .62, 0);
  const frame = M(IN.woodDark, .62), paper = M(0xEAF4FA, .42);
  box(p, 1.36, 1.48, .18, .08, frame, 0, 1.54, 0);
  [-1, 1].forEach((side) => {
    box(p, 1.16, 1.28, .10, .05, paper, 0, 1.54, side * .10);
    box(p, .94, .28, .11, .05, M(col, .56), 0, 1.96, side * .16);
    /* 사용법 · 카메라 두 카테고리를 두 장의 카드로 표현합니다. */
    [-.25, .25].forEach((dy, i) => {
      box(p, .92, .32, .11, .05, M(i ? 0xCCE1F8 : 0xB7EBE1, .5), 0, 1.54 + dy, side * .16);
      box(p, .16, .16, .12, .05, M(i ? 0x2A66A6 : 0x12867A, .48),
        side * -.32, 1.54 + dy, side * .18);
      box(p, .42, .06, .12, .02, M(IN.ink, .42), side * .12, 1.57 + dy, side * .18);
      box(p, .3, .05, .12, .02, M(IN.ink, .3), side * .18, 1.48 + dy, side * .18);
    });
  });
  return p;
}
/** 벽에 건 줄전구 — 기숙사 */
export function stringLights(g, x, y, z, w = 4.0, n = 9) {
  const p = new THREE.Group(); p.position.set(x, y, z); g.add(p);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), px = -w / 2 + t * w, sag = Math.sin(t * Math.PI) * .34;
    const b = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8),
      M(0xFFE6A8, .3, { emissive: 0xFFD070, emissiveIntensity: 1.0 }));
    b.position.set(px, -sag, 0); p.add(b);
    if (i < n - 1) {
      const t2 = (i + 1) / (n - 1), px2 = -w / 2 + t2 * w, sag2 = Math.sin(t2 * Math.PI) * .34;
      const dx = px2 - px, dy = -sag2 + sag, L = Math.hypot(dx, dy);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, L, 5), M(0x5A4636, .6));
      c.position.set((px + px2) / 2, (-sag - sag2) / 2 + .06, 0);
      c.rotation.z = Math.atan2(dx, -dy) * -1 + Math.PI; p.add(c);
    }
  }
  return p;
}
/** 기타 */
export function guitar(g, x, z, ry) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  p.rotation.z = .12;
  const b = new THREE.Mesh(new THREE.SphereGeometry(.42, 18, 14), M(0xC98E4E, .55));
  b.position.y = .5; b.scale.set(1, 1.18, .32); b.castShadow = true; p.add(b);
  const b2 = new THREE.Mesh(new THREE.SphereGeometry(.3, 16, 12), M(0xC98E4E, .55));
  b2.position.y = .98; b2.scale.set(1, 1.1, .32); p.add(b2);
  cyl(p, .16, .16, .16, 14, M(0x3A2E28, .5), 0, .58, .1).rotation.x = Math.PI / 2;
  box(p, .16, 1.2, .1, .03, M(0x5A4636, .55), 0, 1.7, 0);
  box(p, .24, .3, .09, .04, M(0x3A2E28, .5), 0, 2.36, 0);
  [-1, 1].forEach((s) => [0, 1, 2].forEach((i) =>
    cyl(p, .02, .02, .1, 6, M(IN.metal, .35), s * .16, 2.3 - i * .1, 0).rotation.z = Math.PI / 2));
  return p;
}
/** 빨래 바구니 */
export function laundry(g, x, z) {
  const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
  cyl(p, .38, .3, .56, 6, M(0xE8C08A, .7), 0, .28, 0);
  cyl(p, .4, .4, .07, 6, M(0xD6A96E, .7), 0, .58, 0);
  [[-.1,.62,.06],[.14,.66,-.04],[0,.72,.1]].forEach(([dx,dy,dz], i) => {
    const c = new THREE.Mesh(new THREE.SphereGeometry(.19, 10, 8), M(BOOKS[i * 2 % BOOKS.length], .8));
    c.position.set(dx, dy, dz); c.scale.y = .6; c.castShadow = true; p.add(c);
  });
  return p;
}
/** 미니 냉장고 위 전자레인지 같은 잡동사니 — 책상 위 소품 묶음 */
export function deskClutter(g, x, y, z) {
  const p = new THREE.Group(); p.position.set(x, y, z); g.add(p);
  cyl(p, .09, .08, .24, 12, M(0x3FB3A2, .5), -.3, .12, .1);      // 텀블러
  cyl(p, .1, .1, .14, 12, M(IN.paper, .5), .28, .07, .12);       // 연필꽂이
  [-.04, 0, .05].forEach((dx, i) =>
    cyl(p, .02, .02, .3, 6, M(BOOKS[i * 3 % BOOKS.length], .6), .28 + dx, .22, .12 + dx));
  box(p, .3, .02, .22, .01, M(IN.paper, .5), 0, .02, .16);       // 종이
  box(p, .26, .02, .2, .01, M(0xEFE6D6, .5), .03, .04, .14);
  return p;
}
/** 냄비·식판 같은 상판 잡동사니(카운터용) */
export function counterTop(g, x, y, z) {
  const p = new THREE.Group(); p.position.set(x, y, z); g.add(p);
  box(p, .42, .2, .3, .05, M(0x3A3F4A, .4), -.5, .1, 0);         // 단말기
  box(p, .34, .14, .24, .03, M(0x6EC6E0, .25, { emissive: 0x4EA8C8, emissiveIntensity: .5 }),
      -.5, .22, .02).rotation.x = -.4;
  cyl(p, .11, .09, .16, 12, M(IN.paper, .45), .3, .08, .06);
  cyl(p, .12, .12, .04, 12, M(0xE8695A, .5), .3, .17, .06);
  box(p, .3, .1, .22, .04, M(IN.wood, .6), -.02, .05, .04);
  return p;
}
/** 벽 선반 — 작은 것 몇 개 */
export function wallShelf(g, x, y, z, ry, w = 1.6) {
  const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.y = ry; g.add(p);
  box(p, w, .09, .34, .03, M(IN.wood, .7), 0, 0, 0);
  [-1, 1].forEach((s) => box(p, .07, .24, .3, .02, M(IN.woodDark, .7), s * (w / 2 - .1), -.16, -.02));
  let bx = -w / 2 + .16;
  for (let i = 0; bx < w / 2 - .3; i++) {
    const bw = .1 + (i % 3) * .02, bh = .26 + (i % 2) * .06;
    box(p, bw, bh, .24, .02, M(BOOKS[i % BOOKS.length], .68), bx + bw / 2, .05 + bh / 2, 0);
    bx += bw + .015;
  }
  return p;
}

/** 인생네컷 부스 — 미니게임관. 대학생이면 이게 있어야 합니다 */
export function photoBooth(g, x, z, ry, col = 0xFF7FA8) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, 2.2, 2.6, 2.0, .12, M(col, .55), 0, 1.3, 0);
  box(p, 2.34, .3, 2.14, .1, M(0x2A2036, .5), 0, 2.7, 0);
  box(p, 1.5, .4, .12, .08, M(0xFFFFFF, .3, { emissive: 0xFFF0C4, emissiveIntensity: .9 }), 0, 2.72, 1.0);
  box(p, 1.3, 1.9, .16, .06, M(0x2A2036, .5), -.4, 1.05, 1.0);     // 들어가는 구멍
  R_curtainStrips(p, -.4, 1.1, 1.06, 1.2, 1.9, 0x9B2E5C);
  box(p, .5, .7, .14, .05, M(0x2A3A48, .35), .72, 1.5, 1.0);       // 조작 화면
  box(p, .42, .56, .06, .03, M(0x6EC6E0, .25, { emissive: 0x4EA8C8, emissiveIntensity: .6 }), .72, 1.5, 1.08);
  box(p, .34, .1, .12, .04, M(0xF2C14E, .4), .72, 1.02, 1.06);     // 사진 나오는 구멍
  [-1, 1].forEach((s) => box(p, .1, 2.4, .1, .04, M(0x2A2036, .5), s * 1.05, 1.3, 1.0));
  return p;
}
function R_curtainStrips(p, x, y, z, w, h, col) {
  const n = Math.max(5, Math.round(w / .16));
  for (let i = 0; i < n; i++)
    cyl(p, w / n * .5, w / n * .5, h, 8, M(col, .74),
        x - w / 2 + (i + .5) * (w / n), y, z + (i % 2 ? .04 : 0));
}
/** 리듬 발판 — 미니게임관 */
export function dancePad(g, x, z, ry) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, 2.2, .3, 2.2, .08, M(0x2A2036, .5), 0, .16, 0);
  const arr = [[0, -.62], [-.62, 0], [.62, 0], [0, .62]];
  arr.forEach(([dx, dz], i) => {
    box(p, .56, .1, .56, .06, M([0xFF5FA8, 0x2DD4BF, 0xF2C14E, 0x9B7BD4][i], .4,
      { emissive: [0xFF5FA8, 0x2DD4BF, 0xF2C14E, 0x9B7BD4][i], emissiveIntensity: .35 }), dx, .34, dz);
    box(p, .2, .1, .2, .05, M(0xFFFFFF, .35), dx, .4, dz);
  });
  [-1, 1].forEach((s) => cyl(p, .05, .05, 1.9, 8, M(IN.metal, .4), s * 1.0, 1.1, -1.0));
  box(p, 2.1, .14, .12, .05, M(IN.metal, .4), 0, 2.0, -1.0);
  box(p, 1.9, 1.2, .16, .06, M(0x1E2630, .25, { emissive: 0x3E6E9E, emissiveIntensity: .5 }), 0, 1.5, -1.0);
  return p;
}
/** 진열 매대 — 상점. 상판에 물건이 쌓입니다 */
export function displayTable(g, x, z, ry, w = 2.0, kind = 'cloth') {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, w, .14, 1.2, .05, M(IN.woodLight, .62), 0, .82, 0);
  box(p, w - .2, .5, 1.0, .05, M(IN.woodDark, .74), 0, .5, 0);
  box(p, w - .3, .07, .9, .03, M(IN.wood, .7), 0, .32, 0);
  [-1, 1].forEach((s) => box(p, .12, .8, 1.1, .04, M(IN.woodDark, .74), s * (w / 2 - .06), .42, 0));
  if (kind === 'cloth') {
    [-1, 1].forEach((s) => [0, 1, 2].forEach((i) =>
      box(p, .5, .1, .42, .04, M(BOOKS[(i + (s > 0 ? 3 : 0)) % BOOKS.length], .75),
          s * (w / 4), .94 + i * .1, s * .2)));
  } else {
    [[-.5,-.2],[0,.2],[.5,-.15]].forEach(([dx, dz], i) => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(.2, 16, 12), M(BOOKS[i * 2 % BOOKS.length], .55));
      e.position.set(dx, 1.06, dz); e.scale.y = 1.26; e.castShadow = true; p.add(e);
      cyl(p, .22, .26, .08, 14, M(IN.woodDark, .6), dx, .9, dz);
    });
  }
  box(p, .44, .06, .3, .02, M(IN.paper, .5), 0, .9, .5).rotation.x = -.5;   // 가격표
  return p;
}

/** 가구 상점 전용 쇼룸.
    생활방 가구를 그대로 흩어 놓으면 실제 방처럼 보이고, sofa/chair가
    앉기 자리까지 등록해 가구 상점 E 구역과 경쟁합니다. 이 쇼룸은
    판매용 샘플만 직접 그려 좌석을 등록하지 않고, 가운데 1.8m 통로는
    비워 둡니다. 왼쪽은 소재 벽과 소파, 오른쪽은 수납·조명 코너입니다. */
export function furnitureShowroom(g, x, z, ry = 0) {
  const p = new THREE.Group(); p.name = 'furnitureShowroom';
  p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  const wood = P(0xB9784F, .68), woodDark = P(0x80513A, .76);
  const cream = P(0xFFF6EA, .76), mint = P(0x79CFC1, .62);
  const sky = P(0x82B8D8, .62), coral = P(0xE98D79, .64);
  const ink = P(0x526477, .58), gold = P(0xE7B94E, .52);

  /* 쇼룸 바닥 — 문길과 옷/알 구역까지 번지지 않는 독립된 섬입니다. */
  const base = box(p, 6.35, .10, 4.45, .14, P(0xEEF2F8, .84), 0, .055, 0);
  const inset = box(p, 5.92, .05, 4.02, .12, P(0xDCE8F2, .86), 0, .115, 0);
  base.userData.noCollide = true; inset.userData.noCollide = true;
  /* 바닥의 짧은 동선 띠가 기능 중심으로 안내합니다. */
  const aisle = box(p, 2.1, .025, 3.45, .12, P(0xFAFCFF, .9), .18, .15, -.25);
  aisle.userData.noCollide = true;

  /* 소재 라이브러리 벽. 방의 왼벽과 평행해 다른 구역을 가리지 않습니다. */
  box(p, .18, 2.34, 4.02, .07, cream, -3.02, 1.22, 0);
  box(p, .23, .16, 3.66, .05, wood, -2.88, 2.34, 0);
  [-1.25, -.42, .42, 1.25].forEach((dz, i) => {
    box(p, .12, .68, .68, .09, P([0xE98D79, 0x79CFC1, 0x82B8D8, 0xE7B94E][i], .6),
      -2.86, 1.55, dz);
    box(p, .13, .08, .46, .03, ink, -2.77, 1.10, dz);
  });
  /* 소파 모양 입체 픽토그램 — 글자를 억지로 붙이지 않아도 가구점으로 읽힙니다. */
  box(p, .13, .42, 1.42, .13, mint, -2.79, 2.02, 0);
  [-.58, .58].forEach((dz) => box(p, .16, .58, .22, .08, mint, -2.74, 1.94, dz));

  const sampleSofa = (lx, lz, a, w, col) => {
    const q = new THREE.Group(); q.position.set(lx, 0, lz); q.rotation.y = a; p.add(q);
    const c = P(col, .66), d = P(col, .78);
    box(q, w, .28, .92, .13, d, 0, .36, 0);
    box(q, w - .34, .24, .72, .12, c, 0, .57, .06);
    box(q, w, .70, .24, .11, d, 0, .72, -.39);
    [-1, 1].forEach((s) => box(q, .28, .56, .9, .11, d, s * (w / 2 - .14), .58, 0));
    [-.42, .42].forEach((dx) => box(q, .58, .16, .35, .08, cream, dx, .79, -.23));
    return q;
  };
  const sampleChair = (lx, lz, a, col) => {
    const q = new THREE.Group(); q.position.set(lx, 0, lz); q.rotation.y = a; p.add(q);
    box(q, .78, .25, .82, .16, P(col, .66), 0, .43, 0);
    box(q, .82, .78, .25, .14, P(col, .76), 0, .82, -.34);
    [-1, 1].forEach((s) => box(q, .16, .48, .78, .08, P(col, .76), s * .38, .60, 0));
    [-.27, .27].forEach((dx) => cyl(q, .055, .065, .22, 10, woodDark, dx, .13, .22));
    return q;
  };
  sampleSofa(-2.05, .22, Math.PI / 2, 2.12, 0x82B8D8);
  sampleChair(-.92, 1.53, -.42, 0xE98D79);

  /* 오른쪽 수납 코너. 가운데 E 트리거(.2,-.6)는 비워 둡니다. */
  { const q = new THREE.Group(); q.position.set(1.80, 0, 1.60); p.add(q);
    box(q, 2.18, .78, .58, .08, wood, 0, .43, 0);
    [-.72, 0, .72].forEach((dx, i) => {
      box(q, .58, .51, .08, .04, P(i === 1 ? 0xF2C9A8 : 0xD7A67D, .7), dx, .45, .34);
      cyl(q, .035, .035, .08, 10, gold, dx, .45, .41).rotation.x = Math.PI / 2;
    });
    box(q, 2.34, .12, .70, .05, cream, 0, .88, 0);
    box(q, .72, .46, .42, .09, mint, -.57, 1.17, 0);
    box(q, .72, .32, .42, .08, sky, .22, 1.10, 0);
    box(q, .72, .22, .42, .07, coral, .91, 1.05, 0);
  }
  { const q = new THREE.Group(); q.position.set(1.88, 0, -1.48); p.add(q);
    cyl(q, .70, .70, .12, 24, wood, 0, .55, 0);
    cyl(q, .10, .12, .52, 12, woodDark, 0, .28, 0);
    cyl(q, .38, .42, .08, 18, woodDark, 0, .05, 0);
    /* 작은 테이블 램프 */
    cyl(q, .05, .06, .44, 10, ink, 0, .84, 0);
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(.18, .28, .28, 18), gold);
    sh.position.y = 1.10; sh.castShadow = true; q.add(sh);
  }

  /* 가격표와 안내 토템은 통로 바깥쪽에 모아 둡니다. */
  [[-.76,-1.56,0xE98D79],[2.72,.22,0x79CFC1]].forEach(([lx,lz,col]) => {
    const q = new THREE.Group(); q.position.set(lx, 0, lz); p.add(q);
    box(q, .52, .08, .36, .05, woodDark, 0, .04, 0);
    box(q, .08, .70, .08, .03, ink, 0, .39, 0);
    const card = box(q, .74, .48, .10, .08, cream, 0, .78, 0); card.rotation.x = -.12;
    box(q, .42, .08, .11, .03, P(col, .6), 0, .82, .06).rotation.x = -.12;
  });
  return p;
}
/** 긴 벤치 — 회관 · 복도 */
export function bench(g, x, z, ry, w = 3.0, col = IN.wood) {
  [-w / 4, w / 4].forEach((off) => regSeatLocal(x, z, ry, off, 0, 'bench'));
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  sbox(p, w, .2, 1.0, .08, M(col, .7), 0, .58, 0);
  sbox(p, w, .74, .16, .06, M(col, .7), 0, .98, -.42);
  sbox(p, w - .3, .1, .12, .04, M(col, .6), 0, 1.24, -.44);
  [-1, 1].forEach((s) => {
    sbox(p, .18, .58, .9, .05, M(IN.woodDark, .74), s * (w / 2 - .2), .3, 0);
    sbox(p, .3, .12, 1.06, .05, M(IN.woodDark, .74), s * (w / 2 - .2), .06, 0);
  });
  return p;
}

/* ══════════════════════════════════════════════════════════
   놓는 가구 — 방 꾸미기.

   2D 판 기숙사에는 놓을 수 있는 것이 스물넷이었는데 3D 는 여섯이었습니다.
   방 꾸미기를 열면 살 것이 한 줄로 끝나서, 코인을 모을 이유가 없어집니다.
   상점이 비면 방도 빕니다.

   **id 는 2D 표에서 그대로 가져옵니다.** openworld/index.html 의 SHOP 에
   f-seat · f-floor · f-store · f-live · f-hobby · f-green 칸으로 적혀 있는
   것들이고, 서버 아이템 표도 같은 이름을 봅니다. 여기서 이름을 새로
   지으면 한쪽에서 산 물건이 다른 쪽에서 사라집니다. 2D 에 없는 것만
   같은 규칙(fur-…)으로 새로 답니다.

   높이는 대개 0.9 아래로 맞춥니다 — 3/4 부감이라 키 큰 것을 방 가운데
   놓으면 그 뒤가 통째로 안 보입니다. 스탠드·화분·캣타워처럼 원래 키가
   큰 것은 대신 **얇게** 만들어 시야를 덜 막습니다.
   ══════════════════════════════════════════════════════════ */

/* 여러 벌이 나눠 쓰는 재질 — 발광·투명은 P() 로 못 묶으니 여기 둡니다 */
const SHADE = M(0xF6E8C8, .55, { side: THREE.DoubleSide });
const BULB = M(0xFFF0C4, .4, { emissive: 0xFFD98A, emissiveIntensity: .85 });
const TVSCR = M(0x2A3A48, .25, { emissive: 0x4EA8C8, emissiveIntensity: .45 });
/* 어항 유리만 투명입니다. 굽기는 투명 재질을 안 합치므로(그리는 순서가
   깨집니다) 어항 하나가 드로우콜 하나입니다 — 그래서 물·모래·물고기는
   전부 불투명으로 두고, 정말 유리인 한 겹만 투명하게 씁니다. */
const TANKGLASS = M(0x8FD6E8, .1, { transparent: true, opacity: .4 });

/** 방석 — 밟고 다닙니다. 높이 0.2 라 통행 격자가 안 막습니다(0.34 부터 막습니다) */
export function cushion(g, x, z, ry = 0, col = 0xE8695A) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, .74, .14, .74, .07, P(col, .84), 0, .07, 0).castShadow = false;
  box(p, .58, .1, .58, .05, P(col, .7), 0, .15, 0).castShadow = false;
  cyl(p, .05, .05, .04, 10, P(0xFFF0DC, .8), 0, .19, 0);            // 가운데 단추
  return p;
}
/** 둥근 러그 — 네모 깔개(rug)와 무늬가 달라야 둘 다 놓을 맛이 납니다 */
export function roundRug(g, x, z, col = 0x63C47C, inner = 0xF2F8EE, r = 1.1) {
  const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
  const flat = (m) => { m.castShadow = false; return m; };
  flat(cyl(p, r, r, .06, 28, P(col, .92), 0, .05, 0));
  flat(cyl(p, r * .74, r * .74, .06, 26, P(inner, .92), 0, .075, 0));
  flat(cyl(p, r * .4, r * .4, .06, 24, P(col, .92), 0, .1, 0));
  return p;
}
/** 빈백 — 공을 그냥 놓으면 구슬입니다. 눌러서 앉은 자국을 냅니다 */
export function beanbag(g, x, z, ry = 0, col = 0x9B7BD4) {
  /* 빈백은 좌판 중앙보다 등받이 반대쪽으로 살짝 앉아야 몸이 등받이에
     파묻히지 않습니다. */
  regSeatLocal(x, z, ry, 0, .14, 'beanbag');
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  const lo = P(col, .86), hi = P(col, .7);
  const b = new THREE.Mesh(new THREE.SphereGeometry(.52, 16, 12), lo);
  b.position.y = .3; b.scale.set(1, .62, 1); b.castShadow = true; b.receiveShadow = true; p.add(b);
  const bk = new THREE.Mesh(new THREE.SphereGeometry(.38, 14, 10), hi);
  bk.position.set(0, .5, -.24); bk.scale.set(1, .92, .7); bk.castShadow = true; p.add(bk);
  box(p, .5, .09, .44, .04, hi, 0, .38, .12);                       // 앉은 자국
  return p;
}
/** 협탁 — 침대 옆 한 칸. 서랍 하나에 손잡이 하나면 협탁으로 읽힙니다 */
export function sideTable(g, x, z, ry = 0) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, .7, .1, .56, .04, P(IN.wood, .68), 0, .54, 0);
  box(p, .6, .26, .48, .04, P(IN.woodLight, .62), 0, .38, .02);
  cyl(p, .04, .04, .1, 8, P(IN.gold, .35), 0, .38, .27).rotation.x = Math.PI / 2;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) =>
    cyl(p, .035, .045, .5, 8, P(IN.woodDark, .72), sx * .27, .25, sz * .2));
  return p;
}
/** 낮은 책장 — 큰 서가(shelf)는 2.4 라 방 가운데 놓으면 벽이 됩니다 */
export function lowShelf(g, x, z, ry = 0, w = 1.5) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, w, .84, .38, .05, P(IN.woodDark, .76), 0, .42, 0);
  box(p, w - .14, .7, .3, .04, P(IN.wood, .72), 0, .42, .05);
  [0, 1].forEach((r) => {
    box(p, w - .2, .06, .32, .02, P(IN.woodDark, .7), 0, .16 + r * .34, .07);
    let bx = -w / 2 + .16;
    while (bx < w / 2 - .22) {
      const bw = .09 + ((bx * 31 + r * 11) % 4) * .02;
      const bh = .22 + ((bx * 47 + r * 5) % 3) * .04;
      box(p, bw, bh, .26, .02, P(BOOKS[Math.abs(Math.round(bx * 19 + r * 3)) % BOOKS.length], .68),
          bx + bw / 2, .19 + r * .34 + bh / 2, .1);
      bx += bw + .015;
    }
  });
  return p;
}
/** 서랍장 — 옷장(2.6)은 너무 큽니다. 서랍 셋짜리 낮은 것 */
export function drawers(g, x, z, ry = 0, col = IN.wood) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, 1.0, .86, .5, .06, P(IN.woodDark, .76), 0, .43, 0);
  [0, 1, 2].forEach((r) => {
    box(p, .88, .22, .46, .04, P(col, .7), 0, .17 + r * .26, .04);
    cyl(p, .045, .045, .1, 10, P(IN.gold, .35), 0, .17 + r * .26, .27).rotation.x = Math.PI / 2;
  });
  box(p, 1.06, .06, .56, .03, P(IN.woodLight, .62), 0, .89, 0);
  return p;
}
/** 캐리어 — 세워 둡니다. 눕히면 그냥 상자입니다 */
export function suitcase(g, x, z, ry = 0, col = 0x3FB3A2) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, .58, .7, .3, .07, P(col, .5), 0, .4, 0);
  box(p, .5, .04, .28, .02, P(0xF6F8FA, .4), 0, .4, .02);           // 지퍼
  [-1, 1].forEach((s) => box(p, .05, .3, .05, .02, P(0x3A3F4A, .5), s * .18, .82, -.06));
  box(p, .34, .06, .06, .02, P(0x3A3F4A, .45), 0, .95, -.06);       // 손잡이
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) =>
    cyl(p, .055, .055, .05, 10, P(0x2A3A48, .4), sx * .2, .05, sz * .1).rotation.z = Math.PI / 2);
  return p;
}
/** 선풍기 — 1 미터에 조금 못 미치지만 기둥이 얇아 뒤가 다 보입니다.
    날개는 돌리지 않습니다. 돌리려면 매 프레임이 필요한데, 방 구석의
    날개 한 장에 걷는 프레임을 나눠 줄 수는 없습니다. */
export function fan(g, x, z, ry = 0) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  cyl(p, .26, .3, .06, 14, P(IN.metalDark, .5), 0, .03, 0);
  cyl(p, .04, .05, .5, 8, P(IN.metal, .45), 0, .33, 0);
  const hd = new THREE.Group(); hd.position.set(0, .66, 0); hd.rotation.y = .3; p.add(hd);
  cyl(hd, .1, .1, .16, 12, P(IN.metalDark, .5), 0, 0, -.06).rotation.x = Math.PI / 2;
  [0, 1, 2].forEach((i) => {
    const a = i * Math.PI * 2 / 3;
    box(hd, .34, .16, .03, .06, P(0xEAF2F6, .4), Math.cos(a) * .15, Math.sin(a) * .15, .04)
      .rotation.z = a;
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.26, .022, 8, 22), P(IN.metal, .4));
  ring.position.z = .06; ring.castShadow = true; hd.add(ring);
  cyl(hd, .05, .05, .04, 10, P(0xE8695A, .4), 0, 0, .08).rotation.x = Math.PI / 2;
  return p;
}
/** 브라운관 TV — 뒤가 깊어야 브라운관입니다. 납작하면 요즘 TV 고,
    요즘 TV 는 이 방의 나머지와 시대가 안 맞습니다 */
export function crtTv(g, x, z, ry = 0) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, 1.0, .3, .5, .05, P(IN.woodDark, .74), 0, .15, 0);
  box(p, .86, .56, .6, .07, P(0xE8E0CE, .6), 0, .58, 0);
  box(p, .58, .42, .1, .05, TVSCR, -.08, .6, .3);
  [0, 1].forEach((i) => cyl(p, .05, .05, .05, 10, P(0x3A3F4A, .4), .3, .7 - i * .17, .3)
    .rotation.x = Math.PI / 2);
  [-1, 1].forEach((s) => cyl(p, .012, .012, .48, 6, P(IN.metal, .35), s * .14, 1.06, -.14)
    .rotation.z = s * .42);                                          // 안테나
  return p;
}
/** 아령 한 쌍 — 바닥에 굴러다니는 것 하나쯤 있어야 사람 사는 방입니다 */
export function dumbbell(g, x, z, ry = 0) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  [[0, 0], [.26, .3]].forEach(([dx, dz], i) => {
    cyl(p, .028, .028, .4, 8, P(IN.metal, .4), dx, .13, dz).rotation.z = Math.PI / 2;
    [-1, 1].forEach((s) => cyl(p, .13, .13, .1, 14, P(i ? 0x3A3F4A : 0x5B84C4, .45),
      dx + s * .16, .13, dz).rotation.z = Math.PI / 2);
  });
  return p;
}
/** 어항 — 물이 있어야 어항입니다. 빈 상자면 그냥 상자입니다 */
export function fishTank(g, x, z, ry = 0) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, .9, .4, .44, .05, P(IN.woodDark, .74), 0, .2, 0);
  /* 물은 **뒷판 한 장**입니다. 상자를 물로 꽉 채우면 불투명이라
     물고기와 수초가 그 안에 파묻혀 아예 안 보입니다. */
  box(p, .78, .32, .07, .02, P(0x8FD6E8, .3), 0, .6, -.15);         // 물
  box(p, .78, .07, .34, .02, P(0xE8D8B0, .8), 0, .45, 0);           // 모래
  [[-.24, .04], [.02, -.02], [.26, .06]].forEach(([dx, dz], i) =>
    box(p, .07, .24 + i * .05, .07, .03, P(IN.greenDark, .8), dx, .58, dz));   // 수초
  [[-.1, .66, .1, 0xE8935A], [.16, .54, .06, 0xF2C14E]].forEach(([dx, dy, dz, c]) => {
    const f = new THREE.Mesh(new THREE.SphereGeometry(.06, 10, 8), P(c, .6));
    f.position.set(dx, dy, dz); f.scale.set(1.5, 1, .4); p.add(f);
  });
  box(p, .8, .4, .38, .03, TANKGLASS, 0, .62, 0);
  box(p, .86, .06, .42, .03, P(IN.metalDark, .5), 0, .85, 0);       // 뚜껑
  return p;
}
/** 캣타워 — 기둥이 얇아 키가 커도 뒤가 보입니다 */
export function catTower(g, x, z, ry = 0) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, .9, .12, .9, .05, P(0xC9B49A, .8), 0, .06, 0);
  cyl(p, .11, .11, .6, 12, P(0xD8C4A0, .86), 0, .42, 0);            // 사이잘 기둥
  box(p, .62, .1, .62, .05, P(0xE8DCC8, .8), .1, .77, .1);
  cyl(p, .1, .1, .42, 12, P(0xD8C4A0, .86), .1, 1.03, .1);
  const bd = new THREE.Mesh(new THREE.CylinderGeometry(.34, .3, .2, 16), P(0xF2C8B8, .85));
  bd.position.set(.1, 1.34, .1); bd.castShadow = true; bd.receiveShadow = true; p.add(bd);
  cyl(p, .26, .26, .06, 16, P(0xE0A898, .85), .1, 1.42, .1);        // 안쪽 방석
  cyl(p, .012, .012, .3, 6, P(0x8E6238, .7), .48, 1.12, .1);        // 매단 공
  const bl = new THREE.Mesh(new THREE.SphereGeometry(.08, 10, 8), P(0xE8695A, .7));
  bl.position.set(.48, .95, .1); p.add(bl);
  return p;
}
/** 전신 거울 — 벽거울(mirror)과 달리 바닥에 세웁니다. 뒤로 살짝
    기울여야 세워 둔 것으로 보입니다. 똑바로 세우면 벽에 붙은 것 같습니다 */
export function standMirror(g, x, z, ry = 0) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, .96, .08, .44, .04, P(IN.woodDark, .72), 0, .04, 0);
  [-1, 1].forEach((s) => cyl(p, .04, .05, .3, 8, P(IN.woodDark, .72), s * .34, .18, 0));
  const fr = new THREE.Group(); fr.position.set(0, 1.0, 0); fr.rotation.x = -.1; p.add(fr);
  box(fr, .84, 1.6, .1, .05, P(IN.woodDark, .6), 0, 0, 0);
  box(fr, .7, 1.46, .09, .03, P(0xDCE8F0, .12), 0, 0, .04);
  box(fr, .32, .58, .1, .03, P(0xF0F6FA, .1), -.14, .3, .06);       // 비친 빛 한 줄
  return p;
}
/** 큰 화분 — 잎을 공으로 붙이면 관엽이 아니라 브로콜리입니다.
    넓적한 잎을 줄기에서 벌려 답니다 */
export function plantTall(g, x, z, s = 1) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.scale.setScalar(s); g.add(p);
  cyl(p, .3, .23, .52, 12, P(0xC4694A, .75), 0, .26, 0);
  cyl(p, .33, .33, .09, 12, P(0xA8563C, .7), 0, .52, 0);
  cyl(p, .05, .06, .9, 6, P(0x6E5A3C, .8), 0, .95, 0);
  [[0, .3], [1.2, .5], [2.4, .36], [3.6, .55], [4.8, .42], [5.7, .6]].forEach(([a, r], i) => {
    const lf = new THREE.Mesh(new THREE.SphereGeometry(.3, 12, 8),
      P(i % 2 ? IN.green : IN.greenDark, .8));
    lf.position.set(Math.cos(a) * r, 1.02 + (i % 3) * .22, Math.sin(a) * r);
    lf.scale.set(1.35, .28, .8); lf.rotation.y = -a; lf.rotation.z = .34;
    lf.castShadow = true; p.add(lf);
  });
  return p;
}
/** 플로어 스탠드 — 탁상등(lamp)은 책상 위 물건이라 바닥에 놓으면
    발치에서 혼자 빛납니다. 세우는 것은 따로 있어야 합니다 */
export function floorLamp(g, x, z) {
  const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
  cyl(p, .24, .28, .06, 14, P(IN.metalDark, .5), 0, .03, 0);
  cyl(p, .028, .028, 1.28, 8, P(IN.metalDark, .5), 0, .68, 0);
  /* 갓은 양면입니다 — 한 면만 그리면 부감 카메라에서 갓 **안쪽**이
     뚫려 보여, 등이 아니라 깨진 컵이 됩니다. */
  const sh = new THREE.Mesh(new THREE.CylinderGeometry(.2, .26, .34, 18, 1, true), SHADE);
  sh.position.y = 1.44; sh.castShadow = true; p.add(sh);
  const b = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 10), BULB);
  b.position.y = 1.4; p.add(b);
  return p;
}


/** 놓는 가구 한 점. rooms.js 의 decorItem 이 못 알아본 id 를 여기로
    넘기면 됩니다 — `else if (R.buildFurn(p, id)) { }`.
    그린 것이 있으면 true, 모르는 id 면 false 를 돌려줍니다. */
export function buildFurn(p, id) {
  /* 가구는 방 좌표가 아니라 **놓은 자리 그룹 안**(0,0)에서 그려집니다.
     여기서 chair 를 그냥 부르면 앉는 자리가 방 한가운데 (0,0) 에
     등록돼서, 전혀 엉뚱한 데서 '앉기' 가 뜹니다. 등록을 잠깐 꺼 두고,
     자리는 그룹의 좌표로 직접 적습니다. */
  const keep = SEATREG;
  SEATREG = null;
  let seat = 0;
  try {
    if (id === 'fur-cushion') cushion(p, 0, 0, 0);
    else if (id === 'fur-rug-round') roundRug(p, 0, 0);
    else if (id === 'fur-beanbag') { beanbag(p, 0, 0, 0); seat = 1; }
    else if (id === 'fur-chair') { chair(p, 0, 0, 0, IN.wood); seat = 1; }
    else if (id === 'fur-sidetable') sideTable(p, 0, 0, 0);
    else if (id === 'fur-shelf') lowShelf(p, 0, 0, 0);
    else if (id === 'fur-drawers') drawers(p, 0, 0, 0);
    else if (id === 'fur-laundry') laundry(p, 0, 0);
    else if (id === 'fur-suitcase') suitcase(p, 0, 0, 0);
    else if (id === 'fur-fridge') fridge(p, 0, 0, 0);
    else if (id === 'fur-fan') fan(p, 0, 0, 0);
    else if (id === 'fur-tv') crtTv(p, 0, 0, 0);
    else if (id === 'fur-mirror') standMirror(p, 0, 0, 0);
    else if (id === 'fur-fishtank') fishTank(p, 0, 0, 0);
    else if (id === 'fur-dumbbell') dumbbell(p, 0, 0, 0);
    else if (id === 'fur-cattower') catTower(p, 0, 0, 0);
    else if (id === 'fur-plant2') plantTall(p, 0, 0, 1);
    else if (id === 'fur-floorlamp') floorLamp(p, 0, 0);
    else return false;
  } finally { SEATREG = keep; }
  /* 앉는 자리는 전부 'sofa' 로 답니다. 'chair' 로 달면 기숙사에서는
     앉는 순간 자세 세션이 켜집니다 — 방 한가운데 의자를 놓고 잠깐
     앉으려던 사람에게 웹캠이 켜지는 것은 놀랄 일입니다.
     놓는 가구는 **쉬는 자리**까지만 합니다. */
  if (seat) regSeat(p.position.x, p.position.z, p.rotation.y, 'sofa');
  return true;
}

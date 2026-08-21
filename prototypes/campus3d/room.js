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
}
/** 창 — 뒤벽에 붙입니다. 밖이 밝아야 실내가 실내로 읽힙니다. */
export function window3(g, x, y, d, w = 1.9, h = 1.9) {
  const p = new THREE.Group(); p.position.set(x, y, -d / 2 + .18); g.add(p);
  box(p, w + .3, h + .3, .16, .05, M(IN.woodLight, .6), 0, 0, 0);
  box(p, w, h, .12, .03, M(0xBFEAF5, .2, { emissive: 0x9FD8EE, emissiveIntensity: .35 }), 0, 0, .04);
  box(p, .09, h, .16, .02, M(IN.woodLight, .6), 0, 0, .07);
  box(p, w, .09, .16, .02, M(IN.woodLight, .6), 0, 0, .07);
  box(p, w + .5, .16, .34, .05, M(IN.woodLight, .6), 0, -h / 2 - .18, .1);
  return p;
}
/** 책장 — 칸마다 책등을 세웁니다. 책이 없으면 그냥 상자입니다. */
export function shelf(g, x, z, ry, w = 2.0, h = 2.4) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, w, h, .48, .05, M(IN.woodDark, .78), 0, h / 2, 0);
  box(p, w - .16, h - .16, .4, .04, M(IN.wood, .74), 0, h / 2, .06);
  const rows = 4;
  for (let r = 0; r < rows; r++) {
    const sy = .34 + r * ((h - .5) / rows);
    box(p, w - .2, .07, .42, .02, M(IN.woodDark, .7), 0, sy, .08);
    let bx = -w / 2 + .18;
    while (bx < w / 2 - .22) {
      const bw = .09 + ((bx * 37 + r * 13) % 5) * .02;
      const bh = .3 + ((bx * 53 + r * 7) % 4) * .05;
      box(p, bw, bh, .3, .02, M(BOOKS[Math.abs(Math.round(bx * 17 + r * 3)) % BOOKS.length], .68),
          bx + bw / 2, sy + .04 + bh / 2, .12);
      bx += bw + .015;
    }
  }
  return p;
}
/** 책상 — 상판 · 앞막이 · 다리 넷 */
export function desk(g, x, z, ry, w = 2.2, d = 1.0, h = .78) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, w, .12, d, .04, M(IN.wood, .7), 0, h, 0);
  box(p, w - .1, .2, d - .1, .03, M(IN.woodDark, .75), 0, h - .14, 0);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) =>
    cyl(p, .05, .06, h - .1, 8, M(IN.metal, .5), sx * (w / 2 - .16), (h - .1) / 2, sz * (d / 2 - .16)));
  return p;
}
/** 의자 — 다리 넷 · 앉는 면 · 등받이 살 */
export function chair(g, x, z, ry, col = IN.wood) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) =>
    cyl(p, .042, .05, .44, 8, M(IN.metal, .5), sx * .19, .22, sz * .19));
  box(p, .52, .1, .52, .05, M(col, .68), 0, .48, 0);
  box(p, .5, .5, .09, .05, M(col, .68), 0, .76, -.22);
  box(p, .42, .1, .12, .04, M(IN.metalDark, .5), 0, .62, -.24);
  return p;
}
/** 긴 열람 탁자 — 가운데 칸막이가 서면 도서관 자리가 됩니다 */
export function readTable(g, x, z, ry, w = 5.0) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, w, .14, 1.9, .05, M(IN.wood, .7), 0, .8, 0);
  box(p, w - .1, .22, 1.8, .03, M(IN.woodDark, .75), 0, .64, 0);
  [-1, 1].forEach((s) => box(p, .22, .8, 1.6, .05, M(IN.woodDark, .74), s * (w / 2 - .3), .4, 0));
  box(p, w - .5, .6, .1, .04, M(0x4E7C52, .8), 0, 1.15, 0);        // 칸막이
  return p;
}
/** 침대 — 틀 · 매트리스 · 이불 · 베개 */
export function bed(g, x, z, ry) {
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
export function board(g, x, y, z, w = 2.2, h = 1.5) {
  const p = new THREE.Group(); p.position.set(x, y, z); g.add(p);
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
  flat(box(p, w, .08, d, .1, M(col, .92), 0, .10, 0));
  flat(box(p, w - .5, .08, d - .5, .09, M(inner, .92), 0, .125, 0));
  flat(box(p, w - 1.1, .08, d - 1.1, .3, M(col, .92), 0, .14, 0));
  flat(box(p, w - 1.7, .08, d - 1.7, .3, M(inner, .92), 0, .152, 0));
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
export function cabinet(g, x, z, ry, col) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, 1.1, 2.0, .9, .1, M(col, .6), 0, 1.0, 0);
  const scr = box(p, .82, .66, .1, .04, M(0x1E2630, .25, { emissive: 0x3E6E9E, emissiveIntensity: .55 }),
                  0, 1.42, .42);
  scr.rotation.x = .22;
  box(p, .9, .34, .3, .06, M(0x2A2036, .5), 0, 1.02, .38);          // 조작판
  cyl(p, .05, .05, .22, 8, M(IN.metal, .4), -.2, 1.2, .44);
  const kn = new THREE.Mesh(new THREE.SphereGeometry(.1, 12, 10), M(0xE8483C, .4));
  kn.position.set(-.2, 1.32, .44); kn.castShadow = true; p.add(kn);
  [0, 1, 2].forEach((i) => cyl(p, .06, .06, .06, 10, M(BOOKS[i], .5), .06 + i * .18, 1.14, .46)
    .rotation.x = Math.PI / 2);
  box(p, 1.16, .2, .96, .05, M(0x2A2036, .5), 0, 2.05, 0);
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
  cyl(p, .28, .34, .9, 14, M(IN.woodDark, .75), 0, .45, 0);
  cyl(p, .34, .3, .12, 14, M(IN.woodLight, .6), 0, .96, 0);
  const e = new THREE.Mesh(new THREE.SphereGeometry(.3, 20, 16), M(col, .55));
  e.position.y = 1.28; e.scale.set(1, 1.28, 1);
  e.castShadow = true; e.receiveShadow = true; p.add(e);
  [[-.1,1.34,.26],[.12,1.2,.24],[0,1.46,.2]].forEach(([dx,dy,dz]) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), M(0xFFFFFF, .5));
    s.position.set(dx, dy, dz); s.scale.z = .3; p.add(s);
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
/** 벽시계 */
export function clock(g, x, y, z, ry = 0, r = .42) {
  const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.y = ry; g.add(p);
  cyl(p, r, r, .12, 26, M(IN.woodDark, .5), 0, 0, 0).rotation.x = Math.PI / 2;
  cyl(p, r - .07, r - .07, .14, 26, M(IN.paper, .45), 0, 0, .02).rotation.x = Math.PI / 2;
  box(p, .05, r * .95, .16, .02, M(IN.ink, .4), 0, r * .18, .05);
  box(p, r * .62, .05, .16, .02, M(0xE8695A, .4), r * .2, 0, .05);
  cyl(p, .05, .05, .18, 10, M(IN.ink, .4), 0, 0, .05).rotation.x = Math.PI / 2;
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
  box(p, n * .62 + .1, 1.9, .52, .05, M(IN.metalDark, .6), 0, .95, 0);
  for (let i = 0; i < n; i++) {
    const dx = -n * .31 + .31 + i * .62;
    [0, 1].forEach((r) => {
      box(p, .54, .86, .48, .04, M(col, .55), dx, .5 + r * .9, .04);
      box(p, .3, .05, .5, .02, M(0x2A3A48, .4), dx, .82 + r * .9, .06);   // 통풍구
      cyl(p, .04, .04, .12, 8, M(IN.metal, .35), dx + .18, .5 + r * .9, .28).rotation.x = Math.PI / 2;
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
    const c = new THREE.Group(); c.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    c.rotation.y = -a + Math.PI / 2; p.add(c);
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
  box(p, 1.2, .12, 1.0, .04, M(IN.wood, .7), 0, .78, 0);
  box(p, 1.2, .74, .09, .04, M(IN.woodDark, .74), 0, 1.1, -.46);
  [-1, 1].forEach((s) => box(p, .09, .58, 1.0, .04, M(IN.woodDark, .74), s * .56, 1.02, 0));
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) =>
    cyl(p, .045, .055, .72, 8, M(IN.metal, .5), sx * .5, .36, sz * .4));
  box(p, .4, .06, .2, .02, M(IN.gold, .5), .3, 1.42, -.42);     // 작은 등
  return p;
}
/** 겹쳐 놓은 의자 */
export function stackChairs(g, x, z, ry, n = 5, col = 0x9BB4D6) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  for (let i = 0; i < n; i++) {
    box(p, .46, .08, .46, .04, M(col, .68), 0, .5 + i * .13, i * .04);
    box(p, .44, .42, .07, .04, M(col, .68), 0, .74 + i * .13, -.2 + i * .04);
  }
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) =>
    cyl(p, .035, .045, .48, 8, M(IN.metal, .45), sx * .17, .24, sz * .17));
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
/** 긴 벤치 — 회관 · 복도 */
export function bench(g, x, z, ry, w = 3.0, col = IN.wood) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, w, .2, 1.0, .08, M(col, .7), 0, .58, 0);
  box(p, w, .74, .16, .06, M(col, .7), 0, .98, -.42);
  box(p, w - .3, .1, .12, .04, M(col, .6), 0, 1.24, -.44);
  [-1, 1].forEach((s) => {
    box(p, .18, .58, .9, .05, M(IN.woodDark, .74), s * (w / 2 - .2), .3, 0);
    box(p, .3, .12, 1.06, .05, M(IN.woodDark, .74), s * (w / 2 - .2), .06, 0);
  });
  return p;
}

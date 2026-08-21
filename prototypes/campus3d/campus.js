/* ══════════════════════════════════════════════════════════
   기린캠퍼스 야외.
   교수님 지적을 그대로 반영한 배치입니다 —
     · 호수 · 운동장 삭제
     · 가운데 표지판 삭제, 그 자리에 **동상 + 분수**
     · 도서관 · 본관을 메인으로 키움(1.22배)
     · 광장에서 문까지 5~9칸. 걷는 시간을 줄입니다.
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { M, box, cyl, prism, tree, bush } from './parts.js';
import * as BLD from './bld.js';

export const PAL = {
  grass: 0x6FC85E, grassDark: 0x57B04A, grassLight: 0x86D46E,
  soil: 0x8E6238, stone: 0xF2E6CC, stoneDark: 0xDCCBAA, kerb: 0xFFF6E4,
  path: 0xF0D49A, pathDark: 0xDCB87C,
  water: 0x67C6E8, waterDeep: 0x3FA7CE,
  bronze: 0xC9A05E, bronzeDark: 0xA37E40,
  wood: 0xC08E58, woodDark: 0x8E6238, metal: 0x9BA6B2, metalDark: 0x6E7A88,
  leaf: 0x53B84E, leafDeep: 0x3C9440, trunk: 0x8E5A33,
  red: 0xE8695A, gold: 0xF2B33C, teal: 0x2DD4BF, blue: 0x5B84C4, pink: 0xF5A0B8,
};

/* 건물 여섯 — 자리 · 방향 · 크기 · 안으로 들어갈 곳.
   ry 는 정면(+z)이 도는 각도입니다. 정면 방향 = (sin ry, cos ry). */
export const BUILDINGS = [
  { key: 'mainHall', zone: 'mainhall', name: '본관',       sub: '강의실 · 대중음악',
    x: -23, z: 0,   ry:  Math.PI / 2,     s: 1.22, w: 9.6,  d: 6.2, front: 2.5 },
  { key: 'library',  zone: 'library',  name: '도서관',     sub: '백색소음 · 오래 앉는 자리',
    x:  23, z: 0,   ry: -Math.PI / 2,     s: 1.22, w: 10.0, d: 6.4, front: 2.4 },
  { key: 'dorm',     zone: 'dorm',     name: '기숙사',     sub: '내 방 · 1인실',
    x:   0, z: -22, ry:  0,               s: 1.06, w: 8.2,  d: 5.4, front: 1.9 },
  { key: 'union',    zone: 'union',    name: '학생회관',   sub: '볼일 보는 곳',
    x:   0, z:  22, ry:  Math.PI,         s: 1.06, w: 9.0,  d: 5.6, front: 1.9 },
  { key: 'arcade',   zone: 'arcade',   name: '미니게임관', sub: '3분만 놀고 가는 곳',
    x:  19, z: -19, ry: -Math.PI / 4,     s: 1.08, w: 8.4,  d: 5.6, front: 1.9 },
  { key: 'shop',     zone: 'clubshop', name: '동아리 상점', sub: '옷 · 가구 · 알',
    x: -19, z:  19, ry:  Math.PI * .75,   s: 1.08, w: 8.0,  d: 5.2, front: 1.8 },
];

const PLAZA_R = 12;
const HALF = 40;                       // 섬 반지름

/* 씨 고정 난수 — 나무 자리가 새로 고칠 때마다 바뀌면 안 됩니다 */
let _s = 20260821;
const rnd = () => (_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

/* ---------- 바닥 ----------
   전 판은 116×116 네모 잔디였습니다. 건물이 반지름 22 안에 모여 있으니
   나머지가 통째로 빈 들판이 됐습니다. **섬**으로 바꿉니다 — 둘레가
   둥글면 빈 구석이 안 생기고, 동물의 숲의 첫인상이 바로 섬 모양입니다. */
function ground(g) {
  const flat = (m) => { m.castShadow = false; return m; };
  /* 바다 — 아주 얕고 넓은 판 하나 */
  flat(cyl(g, HALF + 26, HALF + 26, .6, 72, M(0x8FD8EE, .3), 0, -1.5, 0)).receiveShadow = false;
  flat(cyl(g, HALF + 3.2, HALF + 3.2, .5, 72, M(0xF2E2B8, .82), 0, -.75, 0));   // 모래톱
  flat(cyl(g, HALF + 1.4, HALF + 1.4, 2.2, 72, M(PAL.soil, .88), 0, -1.1, 0));  // 흙 벼랑
  flat(cyl(g, HALF, HALF, 2.2, 72, M(PAL.grassDark, .86), 0, -1.06, 0));
  flat(cyl(g, HALF - .5, HALF - .5, 2.2, 72, M(PAL.grass, .86), 0, -1.0, 0));
  /* 잔디 얼룩 — 한 색으로 두면 당구대입니다 */
  for (let i = 0; i < 150; i++) {
    const a = rnd() * Math.PI * 2, r = 6 + rnd() * (HALF - 13);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x, z) < PLAZA_R + 2) continue;
    const w = 3 + rnd() * 6;
    flat(box(g, w, .14, w * (.6 + rnd() * .7), 1.4,
             M(rnd() < .5 ? PAL.grassDark : PAL.grassLight, .86), x, .04, z));
  }
}

/* ---------- 광장 ---------- */
function plaza(g) {
  const flat = (m) => { m.castShadow = false; return m; };
  flat(cyl(g, PLAZA_R + .7, PLAZA_R + .7, .34, 64, M(PAL.kerb, .7), 0, .14, 0));
  flat(cyl(g, PLAZA_R, PLAZA_R, .36, 64, M(PAL.stone, .74), 0, .2, 0));
  /* 방사 무늬 — 광장은 무늬가 있어야 광장입니다 */
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const m = flat(box(g, .5, .1, PLAZA_R - 1.4, .05, M(PAL.stoneDark, .78),
                       Math.cos(a) * (PLAZA_R / 2 + .5), .38, Math.sin(a) * (PLAZA_R / 2 + .5)));
    m.rotation.y = -a + Math.PI / 2;
  }
  [4.6, 8.2].forEach((r) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, .16, 6, 56), M(PAL.stoneDark, .78));
    t.rotation.x = Math.PI / 2; t.position.y = .39; g.add(t);
  });
}

/* ---------- 길 ---------- */
function pathTo(g, x, z, w = 5.4) {
  const L = Math.hypot(x, z) - PLAZA_R + 1.5;
  if (L <= 0) return;
  const a = Math.atan2(x, z);
  const mid = PLAZA_R - .7 + L / 2;
  const p = new THREE.Group(); p.rotation.y = a; g.add(p);
  const b = box(p, w, .3, L, .8, M(PAL.path, .8), 0, .16, mid); b.castShadow = false;
  const e = box(p, w - 1.1, .3, L - .3, .7, M(PAL.pathDark, .8), 0, .19, mid); e.castShadow = false;
  /* 디딤돌 — 길이 한 색이면 장판입니다 */
  const n = Math.max(2, Math.round(L / 2.2));
  for (let i = 0; i < n; i++) {
    const s = box(p, w - 2.2, .12, 1.1, .4, M(PAL.stone, .78), 0, .24,
                  PLAZA_R - .2 + (i + .5) * (L / n));
    s.castShadow = false;
  }
}

/* ---------- 둘레 산책로 ---------- */
function ringPath(g, r = 30, w = 4.0) {
  const seg = 72;
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const L = (Math.PI * 2 * r) / seg + .6;
    const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = -a; g.add(p);
    const b = box(p, L, .28, w, .5, M(PAL.path, .8), 0, .16, 0); b.castShadow = false;
    const e = box(p, L, .28, w - .9, .4, M(PAL.pathDark, .8), 0, .19, 0); e.castShadow = false;
  }
}

/* ---------- 분수 + 동상 ----------
   교수님 : "가운데 표지판 날리고 동상에 분수 같이 있는 걸로 작게". */
export function fountain(g, x = 0, z = 0) {
  const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
  cyl(p, 5.0, 5.3, .5, 48, M(PAL.kerb, .68), 0, .55, 0);          // 바깥 테
  cyl(p, 4.4, 4.4, .4, 48, M(PAL.stoneDark, .74), 0, .78, 0);
  cyl(p, 4.3, 4.3, .3, 48, M(PAL.water, .18, {
    transparent: true, opacity: .88, emissive: 0x2A7C9E, emissiveIntensity: .12 }), 0, .9, 0);
  cyl(p, 2.2, 2.5, 1.1, 32, M(PAL.stone, .72), 0, 1.35, 0);        // 가운데 기둥
  cyl(p, 2.9, 2.9, .22, 32, M(PAL.kerb, .68), 0, 1.98, 0);         // 윗 접시
  cyl(p, 2.6, 2.6, .16, 32, M(PAL.water, .2, { transparent: true, opacity: .85 }), 0, 2.06, 0);
  cyl(p, 1.0, 1.25, 1.4, 20, M(PAL.stone, .72), 0, 2.75, 0);       // 좌대
  cyl(p, 1.45, 1.45, .24, 20, M(PAL.kerb, .68), 0, 3.55, 0);
  box(p, 1.5, .5, .16, .06, M(0x3F6BA8, .5), 0, 3.0, 1.0);         // 명판
  statue(p, 0, 3.66, 0).scale.setScalar(1.28);
  /* 물줄기 — 여덟 갈래. 투명한 기둥 여덟이면 물로 읽힙니다 */
  const wat = M(0xCFEFFA, .12, { transparent: true, opacity: .5 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const j = new THREE.Mesh(new THREE.CylinderGeometry(.07, .13, 1.5, 8), wat);
    j.position.set(Math.cos(a) * 1.5, 2.6, Math.sin(a) * 1.5);
    j.rotation.z = Math.cos(a) * .34; j.rotation.x = -Math.sin(a) * .34;
    p.add(j);
  }
  for (let i = 0; i < 14; i++) {                                   // 물방울
    const a = rnd() * Math.PI * 2, r = 1.2 + rnd() * 2.6;
    const d = new THREE.Mesh(new THREE.SphereGeometry(.1 + rnd() * .1, 8, 6), wat);
    d.position.set(Math.cos(a) * r, 1.4 + rnd() * 1.4, Math.sin(a) * r); p.add(d);
  }
  /* 동전 — 바닥에 몇 개 */
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 3.6;
    cyl(p, .13, .13, .04, 10, M(PAL.gold, .3), Math.cos(a) * r, .92, Math.sin(a) * r);
  }
  return p;
}

/* 동상 — 기린이 서고 거북이가 발치에 앉습니다.
   전 판은 둘을 나란히 두고 색을 어둡게 해서 **갈색 덩어리 하나**로
   뭉쳤습니다. 키 차이를 크게 벌리고 청동을 밝게 올립니다. */
export function statue(g, x, y, z) {
  const p = new THREE.Group(); p.position.set(x, y, z); g.add(p);
  const br = M(0xD8B472, .34, { metalness: .3 });
  const bd = M(0xB08C4E, .38, { metalness: .3 });
  const ink = M(0x6B5228, .4, { metalness: .2 });

  /* ── 기린 ── 다리 넷 · 몸통 · 긴 목 · 머리. 목이 전부입니다 */
  const gi = new THREE.Group(); gi.position.set(-.1, 0, -.1); gi.rotation.y = .42; p.add(gi);
  [[-.26, -.24], [.26, -.24], [-.24, .26], [.24, .26]].forEach(([dx, dz], i) => {
    cyl(gi, .105, .13, 1.15, 10, br, dx, .58, dz);
    cyl(gi, .13, .13, .12, 10, ink, dx, .06, dz);                 // 발굽
  });
  box(gi, .58, .62, .92, .26, br, 0, 1.45, 0);                     // 몸통
  cyl(gi, .17, .24, .5, 12, br, 0, 1.72, -.3).rotation.x = -.5;    // 어깨
  const nk = new THREE.Group(); nk.position.set(0, 1.78, -.34); nk.rotation.x = -.30; gi.add(nk);
  cyl(nk, .13, .2, 1.7, 12, br, 0, .82, 0);
  const gh = new THREE.Group(); gh.position.set(0, 1.72, .02); gh.rotation.x = .62; nk.add(gh);
  box(gh, .3, .3, .58, .13, br, 0, .02, .16);                      // 머리 + 주둥이
  box(gh, .2, .16, .2, .07, ink, 0, -.04, .44);
  [-.09, .09].forEach((dx) => {
    cyl(gh, .035, .05, .22, 6, br, dx, .26, -.06);
    const k = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 6), bd);
    k.position.set(dx, .38, -.06); gh.add(k);
  });
  [-.2, .2].forEach((dx) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), br);
    e.position.set(dx, .14, -.1); e.scale.set(.42, 1, .8); gh.add(e);
  });
  [-.16, .16].forEach((dx) => {
    const ey = new THREE.Mesh(new THREE.SphereGeometry(.055, 8, 6), ink);
    ey.position.set(dx, .1, .2); gh.add(ey);
  });
  cyl(gi, .05, .07, .8, 6, br, 0, 1.5, .5).rotation.x = .55;       // 꼬리
  [[.2,1.6,.3],[-.18,1.34,.36],[.1,1.62,-.34],[-.22,1.7,-.1]].forEach(([dx,dy,dz]) => {
    const sp = new THREE.Mesh(new THREE.SphereGeometry(.14, 10, 8), bd);
    sp.position.set(dx, dy, dz); sp.scale.z = .35;
    sp.lookAt(dx * 5, (dy - 1.5) * 5 + 1.5, dz * 5); gi.add(sp);   // 반점
  });

  /* ── 거북이 ── 기린 발치. 낮고 넓게 앉아 위를 봅니다 */
  const tu = new THREE.Group(); tu.position.set(1.3, 0, .8); tu.rotation.y = .72; p.add(tu);
  const sh = new THREE.Mesh(new THREE.SphereGeometry(.62, 20, 14), bd);
  sh.position.y = .52; sh.scale.set(1, .62, .84); sh.castShadow = true; tu.add(sh);
  /* 등딱지 무늬 — 밋밋한 공이면 알로 보입니다 */
  [[0,.9,0],[.4,.72,.2],[-.4,.72,.2],[.28,.74,-.34],[-.28,.74,-.34]].forEach(([dx,dy,dz]) => {
    const c = new THREE.Mesh(new THREE.SphereGeometry(.17, 8, 6), ink);
    c.position.set(dx, dy, dz); c.scale.set(1, .3, 1); tu.add(c);
  });
  cyl(tu, .64, .68, .2, 20, br, 0, .2, 0);                          // 배딱지
  [[-.36, .28], [.36, .28], [-.34, -.3], [.34, -.3]].forEach(([dx, dz]) =>
    cyl(tu, .13, .16, .3, 8, br, dx, .15, dz));
  cyl(tu, .16, .19, .5, 10, br, 0, .66, .58).rotation.x = -.85;     // 목
  const th = new THREE.Mesh(new THREE.SphereGeometry(.36, 14, 10), br);
  th.position.set(0, 1.02, .9); th.castShadow = true; tu.add(th);
  box(tu, .26, .12, .2, .05, ink, 0, .92, 1.2);                     // 부리
  [-.14, .14].forEach((dx) => {
    const ey = new THREE.Mesh(new THREE.SphereGeometry(.055, 8, 6), ink);
    ey.position.set(dx, 1.12, 1.1); tu.add(ey);
  });
  cyl(tu, .05, .08, .34, 6, br, 0, .42, -.62).rotation.x = .7;      // 꼬리

  p.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
  return p;
}

/* ---------- 가로등 ---------- */
export function lampPost(g, x, z, h = 4.2) {
  const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
  const met = M(0x4A5A52, .5);
  cyl(p, .42, .52, .36, 14, met, 0, .18, 0);
  cyl(p, .34, .38, .22, 14, M(PAL.gold, .4), 0, .44, 0);
  cyl(p, .13, .18, h, 12, met, 0, h / 2 + .5, 0);
  /* 등 — 사각 초롱 둘. 전 판은 원뿔이 너무 작아 **기둥만** 보였습니다 */
  [-1, 1].forEach((s) => {
    const arm = new THREE.Mesh(new THREE.TorusGeometry(.62, .075, 6, 14, Math.PI / 2), met);
    arm.position.set(0, h + .18, 0);
    arm.rotation.z = s > 0 ? Math.PI / 2 : 0;
    arm.rotation.y = s > 0 ? Math.PI : 0;
    p.add(arm);
    const L = new THREE.Group(); L.position.set(s * .62, h + .1, 0); p.add(L);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(.34, .2, .52, 4),
      M(0xFFF2CE, .3, { emissive: 0xFFD98A, emissiveIntensity: .75 }));
    lamp.rotation.y = Math.PI / 4; lamp.position.y = -.3; L.add(lamp);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.1, .4, .2, 4), met);
    cap.rotation.y = Math.PI / 4; cap.position.y = -.02; cap.castShadow = true; L.add(cap);
    cyl(L, .06, .06, .1, 6, M(PAL.gold, .4), 0, -.6, 0);
  });
  cyl(p, .16, .24, .3, 8, M(PAL.gold, .4), 0, h + .62, 0);
  return p;
}
/* ---------- 야외 벤치 ---------- */
export function benchOut(g, x, z, ry) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  [-1, 1].forEach((s) => {
    box(p, .18, .5, .9, .06, M(PAL.metalDark, .5), s * 1.3, .3, .05);
    box(p, .22, .12, 1.1, .05, M(PAL.metalDark, .5), s * 1.3, .06, .05);
    box(p, .16, .74, .16, .05, M(PAL.metalDark, .5), s * 1.3, .9, -.34);
  });
  [0, 1, 2].forEach((i) => box(p, 3.0, .14, .28, .06, M(PAL.wood, .7), 0, .58, -.28 + i * .3));
  [0, 1, 2].forEach((i) => box(p, 3.0, .26, .13, .05, M(PAL.wood, .7), 0, .82 + i * .3, -.4));
  return p;
}

/* ---------- 화단 ---------- */
export function flowerBed(g, x, z, r = 2.0) {
  const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
  cyl(p, r + .25, r + .35, .42, 22, M(PAL.kerb, .7), 0, .21, 0);
  cyl(p, r, r, .34, 22, M(PAL.soil, .88), 0, .3, 0);
  const cols = [PAL.red, PAL.gold, PAL.pink, 0xFFFFFF, 0x9B7BD4];
  const n = Math.round(r * 7);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, rr = rnd() * (r - .3);
    const fx = Math.cos(a) * rr, fz = Math.sin(a) * rr;
    cyl(p, .04, .04, .34, 5, M(PAL.leafDeep, .8), fx, .58, fz);
    const c = cols[Math.floor(rnd() * cols.length)];
    const h = new THREE.Mesh(new THREE.SphereGeometry(.17, 8, 6), M(c, .68));
    h.position.set(fx, .78, fz); h.scale.y = .6; h.castShadow = true; p.add(h);
    const y = new THREE.Mesh(new THREE.SphereGeometry(.06, 6, 5), M(PAL.gold, .5));
    y.position.set(fx, .85, fz); p.add(y);
  }
  return p;
}

/* ---------- 산울타리 ---------- */
export function hedge(g, x, z, len, ry, h = 1.0) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, len, h, 1.1, .38, M(PAL.leafDeep, .84), 0, h / 2, 0);
  box(p, len - .3, h * .5, .95, .34, M(PAL.leaf, .82), 0, h * .74, .04);
  const n = Math.max(2, Math.round(len / 1.3));
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(.42, 10, 8), M(PAL.leaf, .82));
    m.position.set(-len / 2 + (i + .5) * (len / n), h * .92, 0);
    m.scale.set(1, .62, .9); m.castShadow = true; p.add(m);
  }
  return p;
}

/* ---------- 자전거 거치대 ---------- */
export function bikeRack(g, x, z, ry, n = 4) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, n * 1.1 + .4, .18, 1.6, .06, M(PAL.stoneDark, .78), 0, .1, 0);
  for (let i = 0; i < n + 1; i++) {
    const dx = -n * .55 + i * 1.1;
    const a = new THREE.Mesh(new THREE.TorusGeometry(.4, .06, 6, 14, Math.PI), M(PAL.metal, .4));
    a.position.set(dx, .6, 0); p.add(a);
    [-1, 1].forEach((s) => cyl(p, .06, .06, .5, 6, M(PAL.metal, .4), dx + s * .4, .35, 0));
  }
  /* 자전거 둘 */
  [[-n * .28, -.3, PAL.red], [n * .3, .25, PAL.teal]].forEach(([dx, rz, c]) => {
    const b = new THREE.Group(); b.position.set(dx, 0, 0); b.rotation.y = rz; p.add(b);
    [-.62, .62].forEach((wx) => {
      const w = new THREE.Mesh(new THREE.TorusGeometry(.44, .07, 6, 18), M(0x3A3F4A, .6));
      w.position.set(wx, .46, 0); w.rotation.y = Math.PI / 2; b.add(w);
      cyl(b, .06, .06, .1, 8, M(PAL.metal, .35), wx, .46, 0).rotation.z = Math.PI / 2;
    });
    box(b, 1.2, .1, .1, .04, M(c, .5), 0, .78, 0);
    box(b, .1, .5, .1, .04, M(c, .5), -.3, .62, 0);
    box(b, .1, .62, .1, .04, M(c, .5), .5, .74, 0);
    box(b, .34, .1, .18, .05, M(0x3A3F4A, .5), -.28, .94, 0);
    box(b, .5, .08, .08, .03, M(0x3A3F4A, .5), .56, 1.06, 0);
  });
  return p;
}

/* ---------- 캠퍼스 게시판(야외) ---------- */
export function boardOut(g, x, z, ry) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  [-1, 1].forEach((s) => cyl(p, .14, .17, 2.0, 10, M(PAL.woodDark, .74), s * 1.5, 1.0, 0));
  box(p, 3.6, 2.0, .24, .08, M(PAL.woodDark, .76), 0, 2.1, 0);
  box(p, 3.3, 1.72, .16, .06, M(0x4E7C52, .84), 0, 2.1, .08);
  const cols = [0xFFF8EA, 0xFFE8C0, 0xE8F4FF, 0xFFF0F0];
  [[-1.0,.42],[.1,.5],[1.05,.4],[-.9,-.44],[.25,-.4],[1.1,-.5]].forEach(([dx, dy], i) => {
    box(p, .68, .52, .1, .03, M(cols[i % cols.length], .6), dx, 2.1 + dy, .14);
    [0,1,2].forEach((k) => box(p, .5 - k * .08, .05, .1, .02, M(0x8A9098, .5), dx, 2.24 + dy - k * .12, .17));
  });
  prism(p, 3.9, .5, .5, M(PAL.red, .6), 0, 3.1, 0, .06);
  box(p, 1.9, .38, .18, .08, M(PAL.gold, .5), 0, 3.28, .12);
  return p;
}

/* ---------- 쓰레기통 · 정자 · 야외 탁자 ---------- */
export function binOut(g, x, z) {
  const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
  cyl(p, .38, .32, .9, 16, M(0x4E6E5A, .6), 0, .45, 0);
  for (let i = 0; i < 8; i++) box(p, .1, .7, .06, .02, M(0x3E5C4A, .6),
    Math.cos(i / 8 * Math.PI * 2) * .34, .45, Math.sin(i / 8 * Math.PI * 2) * .34);
  cyl(p, .44, .44, .12, 16, M(PAL.metalDark, .5), 0, .96, 0);
  cyl(p, .3, .3, .06, 16, M(0x2A3A48, .5), 0, 1.02, 0);
  return p;
}
export function picnicSet(g, x, z, ry) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, 2.6, .16, 1.3, .06, M(PAL.wood, .72), 0, .84, 0);
  [-1, 1].forEach((s) => {
    box(p, 2.6, .14, .5, .05, M(PAL.wood, .72), 0, .5, s * 1.05);
    [-1, 1].forEach((t) => box(p, .16, .5, .16, .05, M(PAL.woodDark, .74), t * 1.0, .25, s * 1.05));
    [-1, 1].forEach((t) => box(p, .18, .84, .18, .05, M(PAL.woodDark, .74), t * 1.0, .42, s * .3));
  });
  /* 파라솔 */
  cyl(p, .09, .09, 3.0, 10, M(PAL.woodDark, .6), 0, 1.5, 0);
  for (let i = 0; i < 8; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0, 1.9, .9, 4, 1, true),
      M(i % 2 ? PAL.red : 0xFFF6E8, .68));
    c.position.y = 2.9; c.rotation.y = (i / 8) * Math.PI * 2;
    c.castShadow = true; p.add(c);
  }
  cyl(p, .12, .12, .3, 8, M(PAL.gold, .4), 0, 3.5, 0);
  return p;
}
/* ---------- 정문 ---------- */
export function gate(g, x, z, ry) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  [-1, 1].forEach((s) => {
    box(p, 1.6, 5.0, 1.6, .18, M(PAL.stone, .74), s * 4.4, 2.5, 0);
    box(p, 2.0, .4, 2.0, .1, M(PAL.kerb, .68), s * 4.4, .2, 0);
    box(p, 1.9, .4, 1.9, .1, M(PAL.kerb, .68), s * 4.4, 5.1, 0);
    cyl(p, .34, .4, .5, 12, M(PAL.gold, .4), s * 4.4, 5.5, 0);
  });
  box(p, 10.6, .9, 1.2, .18, M(PAL.stone, .74), 0, 5.6, 0);
  box(p, 11.2, .34, 1.5, .1, M(PAL.kerb, .68), 0, 6.15, 0);
  box(p, 7.2, .8, .3, .14, M(0x3F6BA8, .5), 0, 5.6, .68);
  [0, 1, 2, 3].forEach((i) => box(p, .8, .4, .12, .06, M(0xFFFFFF, .5), -2.7 + i * 1.8, 5.6, .78));
  prism(p, 11.4, 1.0, 1.7, M(PAL.red, .6), 0, 6.3, 0, .1);
  return p;
}
export function busStop(g, x, z, ry) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  [-1, 1].forEach((s) => cyl(p, .1, .12, 2.8, 10, M(PAL.metal, .4), s * 2.0, 1.4, -.6));
  box(p, 4.6, .18, 1.8, .08, M(PAL.teal, .5), 0, 2.86, -.2);
  box(p, 4.4, 1.6, .12, .04, M(0xBFEAF5, .2, { transparent: true, opacity: .5 }), 0, 1.7, -1.1);
  box(p, 4.2, .2, .6, .06, M(PAL.wood, .7), 0, .58, -.7);
  [-1, 1].forEach((s) => box(p, .16, .5, .5, .05, M(PAL.metalDark, .5), s * 1.7, .3, -.7));
  box(p, 1.0, 1.4, .14, .06, M(0xFFF8EA, .5), 1.6, 1.9, -1.0);
  [0,1,2,3].forEach((i) => box(p, .7, .08, .1, .02, M(0x8A9098, .5), 1.6, 2.3 - i * .2, -1.06));
  return p;
}
/* ---------- 작은 이정표 ---------- */
export function signpost(g, x, z, ry, labels) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  cyl(p, .12, .16, 2.6, 10, M(PAL.woodDark, .7), 0, 1.3, 0);
  labels.forEach(([col, side], i) => {
    const a = new THREE.Group(); a.position.y = 2.2 - i * .46; a.rotation.y = side; p.add(a);
    box(a, 1.7, .34, .12, .05, M(col, .6), .85, 0, 0);
    const t = new THREE.Mesh(new THREE.ConeGeometry(.24, .34, 3), M(col, .6));
    t.position.set(1.78, 0, 0); t.rotation.z = -Math.PI / 2; t.rotation.y = Math.PI / 6;
    t.castShadow = true; a.add(t);
    box(a, 1.1, .1, .13, .03, M(0xFFFFFF, .5), .8, 0, .03);
  });
  const c = new THREE.Mesh(new THREE.SphereGeometry(.18, 10, 8), M(PAL.gold, .4));
  c.position.y = 2.62; c.castShadow = true; p.add(c);
  return p;
}
/* ---------- 깃대 ---------- */
export function flagPole(g, x, z, col = 0x3F6BA8) {
  const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
  cyl(p, .5, .6, .34, 14, M(PAL.stoneDark, .74), 0, .17, 0);
  cyl(p, .07, .1, 6.0, 10, M(0xE6EAF0, .35), 0, 3.2, 0);
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(1.9, -.28); s.lineTo(1.9, .82); s.lineTo(0, 1.1); s.closePath();
  const ge = new THREE.ExtrudeGeometry(s, { depth: .08, bevelEnabled: true, bevelSize: .03,
    bevelThickness: .03, bevelSegments: 2, steps: 1 });
  const m = new THREE.Mesh(ge, M(col, .62));
  m.position.set(.06, 4.6, 0); m.castShadow = true; p.add(m);
  const k = new THREE.Mesh(new THREE.SphereGeometry(.14, 10, 8), M(PAL.gold, .35));
  k.position.y = 6.24; p.add(k);
  return p;
}
/* ---------- 야외 자판기 ---------- */
export function vendOut(g, x, z, ry, col = 0xE8695A) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, 1.5, 2.6, 1.0, .1, M(col, .55), 0, 1.3, 0);
  box(p, 1.05, 1.7, .12, .05, M(0x2A3A48, .28), -.14, 1.62, .48);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++)
    box(p, .24, .34, .1, .04, M([PAL.gold, PAL.teal, PAL.blue, 0xFFFFFF][r], .55),
        -.52 + c * .38, 1.06 + r * .44, .54);
  box(p, .38, .62, .12, .05, M(0xFFF0C4, .45), .5, 1.8, .5);
  box(p, 1.0, .34, .14, .05, M(0x2A3A48, .4), -.1, .56, .5);
  box(p, 1.56, .2, 1.06, .06, M(0xFFFFFF, .5), 0, 2.66, 0);
  return p;
}
/* ---------- 잔디 위 소품 ---------- */
export function stumpSet(g, x, z) {
  const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
  cyl(p, .52, .58, .7, 14, M(PAL.trunk, .84), 0, .35, 0);
  cyl(p, .5, .5, .1, 14, M(0xC9A05E, .8), 0, .72, 0);
  [[1.5, .4], [-1.2, 1.3], [.3, -1.6]].forEach(([dx, dz]) => {
    cyl(p, .34, .4, .5, 12, M(PAL.trunk, .84), dx, .25, dz);
    cyl(p, .33, .33, .08, 12, M(0xC9A05E, .8), dx, .52, dz);
  });
  return p;
}

/* ══════════════════════════════════════════════════════════
   캠퍼스 조립
   ══════════════════════════════════════════════════════════ */
export function buildCampus(scene) {
  const g = new THREE.Group(); scene.add(g);
  const colliders = [];     // { x, z, w, d, ry }  ry 만큼 돌린 사각형
  const portals = [];       // { x, z, r, zone, name, sub }
  /* big=true 는 **카메라도 막는 것** 입니다. 나무 · 벤치 · 가로등까지
     카메라가 피하면 시점이 쉴 새 없이 튕겨 멀미가 납니다. 건물처럼
     실제로 뒤에 숨을 수 있는 것만 막습니다. */
  const solid = (x, z, w, d, ry = 0, big = false) => colliders.push({ x, z, w, d, ry, big });
  /* 카메라만 막는 것 — 사람은 지나가야 하지만 카메라가 뚫고 들어가면
     화면이 통째로 그 물건 속살이 되는 것들(정문 아치 같은). */
  const camOnly = (x, z, w, d, ry = 0) =>
    colliders.push({ x, z, w, d, ry, big: true, camOnly: true });

  ground(g);
  ringPath(g, 30, 4.2);
  plaza(g);

  /* --- 건물 여섯 --- */
  BUILDINGS.forEach((b) => {
    const bg = new THREE.Group();
    bg.position.set(b.x, 0, b.z);
    bg.rotation.y = b.ry;
    bg.scale.setScalar(b.s);
    g.add(bg);
    BLD[b.key](bg, { plate: false });
    /* 건물이 놓인 자리에 돌바닥을 깝니다 — 잔디 위에 뜬 것처럼 보이지 않게 */
    const pad = box(g, (b.w + 4) * b.s, .3, (b.d + b.front + 4.5) * b.s, 1.2,
                    M(PAL.stoneDark, .8), 0, .12, 0);
    pad.castShadow = false;
    pad.position.set(b.x + Math.sin(b.ry) * (b.front + 1.2) * b.s * .5, .12,
                     b.z + Math.cos(b.ry) * (b.front + 1.2) * b.s * .5);
    pad.rotation.y = b.ry;
    solid(b.x, b.z, b.w * b.s, b.d * b.s, b.ry, true);
    /* 들어가는 곳 — 문 앞 */
    const dd = (b.d / 2 + b.front) * b.s;
    portals.push({ x: b.x + Math.sin(b.ry) * dd, z: b.z + Math.cos(b.ry) * dd,
                   r: 2.6, zone: b.zone, name: b.name, sub: b.sub });
    pathTo(g, b.x, b.z, b.key === 'library' || b.key === 'mainHall' ? 6.2 : 5.0);
  });

  /* --- 광장 한가운데 --- */
  fountain(g, 0, 0);
  solid(0, 0, 10.6, 10.6, 0, true);

  /* 광장 둘레 — 벤치 여덟 · 가로등 여덟 · 화단 여덟 */
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const bx = Math.cos(a) * 9.2, bz = Math.sin(a) * 9.2;
    benchOut(g, bx, bz, -a + Math.PI / 2);
    solid(bx, bz, 3.4, 1.2, -a + Math.PI / 2);
    /* 길이 45° 마다 뻗어 나가므로 가로등은 그 사이(22.5°)에 세웁니다.
       전 판은 길 한복판에 서서 카메라를 가로막았습니다. */
    const la = (i / 8) * Math.PI * 2 + Math.PI / 8;
    lampPost(g, Math.cos(la) * 13.0, Math.sin(la) * 13.0);
    solid(Math.cos(la) * 13.0, Math.sin(la) * 13.0, .9, .9);
    const fa = (i / 8) * Math.PI * 2 + Math.PI / 8;
    flowerBed(g, Math.cos(fa) * 15.6, Math.sin(fa) * 15.6, 1.8);
    solid(Math.cos(fa) * 15.6, Math.sin(fa) * 15.6, 4.0, 4.0);
  }
  [[6.4, 5.4], [-6.4, 5.4], [6.4, -5.4], [-6.4, -5.4]].forEach(([x, z]) => binOut(g, x, z));

  /* --- 게시판 · 이정표 --- */
  boardOut(g, -8.6, 13.2, .5);  solid(-8.6, 13.2, 3.8, 1.0, .5, true);
  boardOut(g, 8.6, 13.2, -.5);  solid(8.6, 13.2, 3.8, 1.0, -.5, true);
  signpost(g, 5.0, 14.6, 0, [[PAL.blue, .4], [PAL.teal, 2.4], [PAL.gold, 4.2]]);
  signpost(g, -14.8, -5.2, 0, [[PAL.red, 1.2], [PAL.blue, 3.4]]);

  /* --- 정문 · 버스 정류장 : 남동쪽 --- */
  gate(g, 20.5, 20.5, Math.PI / 4);
  solid(20.5 + 3.1, 20.5 - 3.1, 1.9, 1.9, 0, true); solid(20.5 - 3.1, 20.5 + 3.1, 1.9, 1.9, 0, true);
  camOnly(20.5, 20.5, 12.5, 2.6, Math.PI / 4);      // 정문 아치 — 사람은 통과, 카메라는 못
  busStop(g, 26.5, 15.5, Math.PI * .75);  solid(26.5, 15.5, 4.8, 2.0, Math.PI * .75, true);
  bikeRack(g, 15.5, 20, -Math.PI / 4, 5); solid(15.5, 20, 6.0, 1.8, -Math.PI / 4);
  vendOut(g, 24.5, 14.5, -Math.PI * .75, 0xE8695A);  solid(24.5, 14.5, 1.6, 1.1, -Math.PI * .75, true);
  vendOut(g, 25.9, 15.9, -Math.PI * .75, 0x3F6BA8); solid(25.9, 15.9, 1.6, 1.1, -Math.PI * .75, true);
  /* 정문에서 광장까지 대각선 길 */
  pathTo(g, 24, 24, 6.0);

  /* --- 북서 잔디마당 — 소풍 자리 --- */
  [[-26, -22, .3], [-20, -28, -.5], [-30, -29, .9]].forEach(([x, z, r]) => {
    picnicSet(g, x, z, r); solid(x, z, 2.8, 2.8, r);
  });
  stumpSet(g, -24, -17);
  flagPole(g, -17, -13, 0x3F6BA8);  solid(-17, -13, 1.2, 1.2);
  flagPole(g, 17, -13, 0xE8735C);   solid(17, -13, 1.2, 1.2);
  hedge(g, -24, -13, 11, 0, 1.1);   solid(-24, -13, 11, 1.1, 0, true);
  hedge(g, -29.5, -18, 11, Math.PI / 2, 1.1); solid(-29.5, -18, 1.1, 11, 0, true);

  /* --- 남서 잔디마당 — 상점 앞 광장 --- */
  bikeRack(g, -25, 11, .4, 4); solid(-25, 11, 5.0, 1.8, .4);
  benchOut(g, -12, 22, .6); solid(-12, 22, 3.4, 1.2, .6);
  benchOut(g, -8, 26, .9);  solid(-8, 26, 3.4, 1.2, .9);
  flowerBed(g, -14, 27, 2.4); solid(-14, 27, 5.2, 5.2);
  picnicSet(g, -27, 27, .2); solid(-27, 27, 2.8, 2.8);

  /* --- 기숙사 앞 · 학생회관 앞 --- */
  bikeRack(g, -9, -20, 0, 4); solid(-9, -20, 5.0, 1.8);
  bikeRack(g, 9, -20, 0, 4);  solid(9, -20, 5.0, 1.8);
  benchOut(g, -7, -14, Math.PI); solid(-7, -14, 3.4, 1.2, Math.PI);
  benchOut(g, 7, -14, Math.PI);  solid(7, -14, 3.4, 1.2, Math.PI);
  vendOut(g, -7, 17, 0);  solid(-7, 17, 1.6, 1.1);
  benchOut(g, 8, 17, 0);  solid(8, 17, 3.4, 1.2);
  binOut(g, -5, 18); binOut(g, 5, -18); binOut(g, 20, 24);

  /* --- 도서관 · 본관 앞 --- */
  [[-1, -16.5], [1, 16.5]].forEach(([sx, px]) => {
    benchOut(g, px, -6.5, sx > 0 ? -Math.PI / 2 : Math.PI / 2);
    solid(px, -6.5, 1.2, 3.4);
    benchOut(g, px, 6.5, sx > 0 ? -Math.PI / 2 : Math.PI / 2);
    solid(px, 6.5, 1.2, 3.4);
    flowerBed(g, px + sx * 2.4, 0, 1.6); solid(px + sx * 2.4, 0, 3.6, 3.6);
    lampPost(g, px - sx * 1.5, -9, 3.6); solid(px - sx * 1.5, -9, .9, .9);
    lampPost(g, px - sx * 1.5, 9, 3.6);  solid(px - sx * 1.5, 9, .9, .9);
  });

  /* --- 길가 가로등 --- */
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    [21, 30].forEach((r) => {
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      lampPost(g, x, z, 3.8); solid(x, z, .9, .9);
    });
  }

  /* --- 나무 --- */
  /* 섬에 나무만 260 그루입니다. 야외는 면수를 낮춘 판을 씁니다 —
     lod/seg 를 주면 tree() 가 갈래를 줄입니다. */
  const TP = { trunk: PAL.trunk, leaf: PAL.leaf, lod: 11, seg: 13 };
  const spots = [];
  const far = (x, z, m) => spots.every((p) => Math.hypot(p[0] - x, p[1] - z) > m);
  for (let i = 0; i < 460 && spots.length < 86; i++) {
    const a = rnd() * Math.PI * 2, r = 17 + rnd() * (HALF - 19);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    /* 건물 · 길 · 광장 위에는 안 심습니다 */
    if (BUILDINGS.some((b) => Math.hypot(b.x - x, b.z - z) < 14.5)) continue;
    if (Math.hypot(x, z) < 17) continue;
    if (Math.abs(Math.hypot(x, z) - 30) < 3.8) continue;          // 산책로 위
    if (Math.hypot(x - 20.5, z - 20.5) < 12) continue;            // 정문 앞
    if (Math.abs(x - z) < 4.5 && x > 12 && z > 12) continue;      // 정문 길
    const ang = Math.atan2(z, x);
    const near = BUILDINGS.some((b) => Math.abs(
      ((Math.atan2(b.z, b.x) - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < .16);
    if (near && Math.hypot(x, z) < 30) continue;
    if (!far(x, z, 4.6)) continue;
    spots.push([x, z]);
  }
  spots.forEach(([x, z], i) => {
    const s = .85 + rnd() * .75;
    tree(g, { ...TP, leaf: i % 4 === 0 ? PAL.leafDeep : PAL.leaf }, x, z, s);
    solid(x, z, 1.0 * s, 1.0 * s);
    if (i % 3 === 0) bush(g, TP, x + 1.6, z + 1.1, .6 + rnd() * .5);
  });
  /* 바깥 테두리 숲 — 섬의 끝.
     한 줄로 고르게 심었더니 **울타리**로 보였습니다. 두 겹으로 어긋나게. */
  for (let i = 0; i < 150; i++) {
    const a = (i / 150) * Math.PI * 2 + (rnd() - .5) * .05;
    const r = HALF - 2.0 - rnd() * 5.0;
    const pink = i % 11 === 0;
    tree(g, { ...TP, leaf: pink ? 0xF7B8CE : PAL.leafDeep, trunk: PAL.trunk },
         Math.cos(a) * r, Math.sin(a) * r, 1.0 + rnd() * .8);
    if (i % 3 === 0) bush(g, TP, Math.cos(a) * (r - 3.4), Math.sin(a) * (r - 3.4), .6 + rnd() * .6);
  }
  /* 덤불 흩뿌리기 */
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2, r = 18 + rnd() * (HALF - 21);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (BUILDINGS.some((b) => Math.hypot(b.x - x, b.z - z) < 11)) continue;
    if (Math.abs(Math.hypot(x, z) - 30) < 3.2) continue;
    bush(g, TP, x, z, .55 + rnd() * .6);
  }

  /* 벚꽃 — 길 양옆에만. 캠퍼스에서 사진 찍는 자리입니다 */
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    [-1, 1].forEach((s2) => {
      const x = Math.cos(a) * 24 + Math.cos(a + Math.PI / 2) * s2 * 4.2;
      const z = Math.sin(a) * 24 + Math.sin(a + Math.PI / 2) * s2 * 4.2;
      tree(g, { trunk: 0x9E6A48, leaf: 0xF7B8CE, lod: 11, seg: 13 }, x, z, 1.05);
      solid(x, z, 1.0, 1.0);
    });
  }

  return { group: g, colliders, portals, HALF, PLAZA_R };
}

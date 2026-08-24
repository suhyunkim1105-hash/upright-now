/* ══════════════════════════════════════════════════════════
   캠퍼스 배치도

   왜 다시 쓰나
   -----------
   전 판은 **동심원 세 개**였습니다. 반지름 54 · 90 · 124 에 건물을 고르게
   돌려 놓는 방식이라, 간격은 계산으로 보장됐지만 결과가 캠퍼스처럼
   안 보였습니다 — 실제 대학은 건물이 고르게 흩어져 있지 않습니다.

   경희대 국제캠퍼스 배치도를 뜯어보면 성질이 이렇습니다.

     · 건물이 **덩어리로 뭉칩니다.** 대여섯 채가 붙어 서고, 덩어리와
       덩어리 사이는 통째로 비어 있습니다
     · 빈 곳이 잔디가 아니라 **큰 프로그램 면적**입니다 — 트랙과 축구장,
       테니스장, 야구장, 주차장, 못. 이것들이 캠퍼스 면적의 절반입니다
     · 한쪽이 통째로 **숲**입니다. 나무가 고르게 흩어진 게 아니라
       경계 한쪽에 덩어리로 있습니다
     · 길이 **굽습니다.** 방사형도 격자도 아니고 지형을 따라 휩니다
     · 윤곽이 원이 아닙니다

   그래서 좌표를 **극좌표에서 직교좌표로** 바꿉니다. 배치도는 각도와
   반지름으로 읽는 것이 아니라 지도로 읽는 것입니다. 여기 적힌 숫자는
   전부 세계 좌표(x, z)고, 배치도를 보듯이 읽으면 됩니다.

     x  서(-) ↔ 동(+)      z  북(-) ↔ 남(+)
     정문이 남쪽(z +110), 본관이 북쪽(z -46). 그 사이가 축입니다.
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { M } from './parts.js';
import * as KIT from './kit.js';

/* 부지 — 원이 아니라 네모입니다. 가로가 더 긴 것도 실제 캠퍼스의 성질입니다. */
export const SITE = { w: 320, d: 260, hx: 160, hz: 130 };

/* 정문과 축 */
export const GATE = { x: 0, z: 116 };
export const AXIS_X = 0;                 // 축이 x=0 을 따라 남북으로 뻗습니다

const TAU = Math.PI * 2;
let _s = 20260825;
const rnd = () => (_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

export const PAL = {
  lawn: 0x6FC85E, lawnDark: 0x63BC53, lawnLight: 0x7BD168,
  road: 0xD9D3C4, roadEdge: 0xF4EEDF, walk: 0xEDE3CC,
  track: 0xC9705A, turf: 0x5FB765, turfLine: 0xF2F7F0,
  court: 0x4E9E7A, courtLine: 0xF2F7F0, clay: 0xC08A62,
  water: 0x67C6E8, waterDeep: 0x3FA7CE, sand: 0xE8D8B0,
  lotDark: 0x8E9490, lotLine: 0xF0F0EA,
  stone: 0xEDE6D4, stoneDark: 0xD4CAB2,
  trunk: 0x8E5A33, leaf: 0x53B84E, leafDeep: 0x3C9440, leafWarm: 0x74C25C,
};

/* ══════════════════════════════════════════════════════════
   1. 건물 덩어리

   덩어리마다 이름과 성격이 있습니다. 같은 덩어리 안은 붙여 세우고,
   덩어리끼리는 넓게 띄웁니다 — 그 빈 곳이 프로그램 면적이 됩니다.

   `enter` 가 있는 것은 들어갈 수 있는 여섯 채입니다(포털·실내가 붙어
   있어 campus.js 가 세웁니다). 나머지는 faculty.js 가 겉모습만 세웁니다.
   ══════════════════════════════════════════════════════════ */
export const BUILDINGS = [
  /* ── 중앙 — 축의 머리. 정문에서 정면으로 보이는 자리 ── */
  { n: '본관',        enter: 'mainHall', x:   0, z: -46, face: 'S', s: 1.9,  w: 9.6, d: 6.2, front: 2.5 },
  { n: '도서관',      enter: 'library',  x: -46, z: -34, face: 'SE', s: 1.9, w: 10.0, d: 6.4, front: 2.4 },
  { n: '학생회관',    enter: 'union',    x:  46, z: -34, face: 'SW', s: 1.6, w: 9.0, d: 5.6, front: 1.9 },

  /* ── 서쪽 덩어리 — 공학 계열. 네 채가 붙어 섭니다 ── */
  { n: '공과대학',       kind: 'wing',      x: -108, z: -18, face: 'E',  w: 26, d: 12, h: 14 },
  { n: '전자정보대학',   kind: 'slab',      x: -108, z:  16, face: 'E',  w: 26, d: 11, h: 13 },
  { n: '응용과학대학',   kind: 'tower_lab', x:  -80, z: -30, face: 'SE', w: 22, d: 11, h: 13 },
  { n: '생명과학대학',   kind: 'slab',      x:  -80, z:  30, face: 'NE', w: 22, d: 11, h: 12 },

  /* ── 동쪽 덩어리 — 예술·체육 ── */
  { n: '예술디자인대학', kind: 'atrium',    x:  104, z: -14, face: 'W',  w: 24, d: 12, h: 13 },
  { n: '체육관',         kind: 'gym',       x:  104, z:  22, face: 'W',  w: 28, d: 17, h: 11 },
  { n: '미니게임관',  enter: 'arcade',      x:   74, z:  10, face: 'W',  s: 1.6, w: 8.4, d: 5.6, front: 1.9 },

  /* ── 북쪽 덩어리 — 인문·사회. 트랙 뒤로 물러나 섭니다 ── */
  { n: '인문대학',       kind: 'brick',     x: -44, z: -92, face: 'S',  w: 24, d: 11, h: 13 },
  { n: '사회과학대학',   kind: 'brick',     x: -14, z: -98, face: 'S',  w: 22, d: 11, h: 12 },
  { n: '대학원',         kind: 'admin',     x:  18, z: -94, face: 'S',  w: 22, d: 12, h: 15 },
  { n: '국제대학',       kind: 'slab',      x:  48, z: -88, face: 'SW', w: 22, d: 11, h: 12 },

  /* ── 북동 덩어리 — 기숙사. 실제 캠퍼스도 기숙사가 구석입니다 ── */
  { n: '기숙사',      enter: 'dorm',        x:  92, z: -74, face: 'SW', s: 1.6, w: 8.2, d: 5.4, front: 1.9 },
  { n: '제1기숙사',      kind: 'hall_res',  x: 122, z: -62, face: 'W',  w: 24, d: 10, h: 15 },
  { n: '제2기숙사',      kind: 'hall_res',  x: 122, z: -92, face: 'W',  w: 24, d: 10, h: 15 },

  /* ── 남서 — 정문 들어와 왼쪽 ── */
  { n: '평화의전당',     kind: 'hall',      x: -78, z:  74, face: 'NE', w: 28, d: 19, h: 16 },
  { n: '박물관',         kind: 'library',   x: -44, z:  46, face: 'E',  w: 20, d: 12, h: 12 },
  { n: '경영대학',       kind: 'slab',      x: -16, z:  56, face: 'E',  w: 22, d: 11, h: 13 },

  /* ── 남동 — 정문 들어와 오른쪽 ── */
  { n: '동아리 상점', enter: 'shop',        x:  44, z:  52, face: 'W',  s: 1.6, w: 8.0, d: 5.2, front: 1.8 },
  { n: '외국어대학',     kind: 'atrium',    x:  74, z:  64, face: 'NW', w: 24, d: 11, h: 13 },
  { n: '간호과학대학',   kind: 'tower_lab', x:  38, z:  88, face: 'N',  w: 22, d: 11, h: 14 },
  { n: '약학대학',       kind: 'brick',     x:  -8, z:  92, face: 'N',  w: 22, d: 11, h: 12 },
];

/* 바라보는 쪽 → ry. 정면 방향이 (sin ry, cos ry) 입니다. */
const FACE = {
  N: Math.PI, S: 0, E: -Math.PI / 2, W: Math.PI / 2,
  NE: Math.PI * -.75 + Math.PI, NW: Math.PI * .75,
  SE: -Math.PI / 4, SW: Math.PI / 4,
};
FACE.NE = -Math.PI * .75; FACE.NW = Math.PI * .75;
export const ryOf = (face) => FACE[face] !== undefined ? FACE[face] : 0;

/* ══════════════════════════════════════════════════════════
   2. 프로그램 면적

   캠퍼스 면적의 절반이 여기입니다. 건물 사이를 잔디로만 두면 공원이
   되고, 여기가 채워져야 대학이 됩니다.
   ══════════════════════════════════════════════════════════ */
export const FIELDS = [
  { t: 'track',  x: -34, z: -62, w: 76, d: 46, ry: 0 },      // 트랙 + 축구장
  { t: 'tennis', x: 118, z: -34, w: 40, d: 30, ry: 0 },      // 테니스 넷
  { t: 'ball',   x: -118, z: 96, w: 56, d: 50, ry: 0 },      // 야구장
  { t: 'rugby',  x: -34, z: 106, w: 62, d: 36, ry: 0 },      // 럭비 · 미식축구
  { t: 'lot',    x:  22, z:  22, w: 40, d: 34, ry: 0 },      // 주차장
  { t: 'lot',    x:  86, z: 100, w: 44, d: 30, ry: 0 },
  { t: 'pond',   x: -126, z: 34, w: 46, d: 34, ry: 0 },      // 못
  { t: 'amphi',  x: -126, z: -6, w: 30, d: 30, ry: 0 },      // 야외극장
  { t: 'court',  x:  72, z: -46, w: 26, d: 20, ry: 0 },      // 농구 코트
];

/* ══════════════════════════════════════════════════════════
   3. 길 — 굽습니다

   방사형도 격자도 아닙니다. 덩어리를 잇는 선 몇 개가 지형을 따라
   휘어 있고, 그 사이는 잔디를 밟고 질러갑니다.
   각 길은 지나갈 점의 목록이고, CatmullRom 으로 부드럽게 잇습니다.
   ══════════════════════════════════════════════════════════ */
export const ROADS = [
  /* 백양로 — 정문에서 본관까지. 유일하게 곧은 길입니다 */
  { w: 11, pts: [[0, 116], [0, 78], [0, 40], [0, 12]] },
  /* 서쪽 순환 — 광장 왼쪽을 돌아 공학 덩어리로 */
  { w: 7, pts: [[-14, 18], [-46, 8], [-72, 0], [-96, -6], [-106, -30], [-96, -54]] },
  /* 동쪽 순환 — 광장 오른쪽에서 예술·체육으로 */
  { w: 7, pts: [[14, 18], [46, 12], [72, 18], [94, 12], [104, -12], [96, -44]] },
  /* 북쪽 — 본관 뒤로 인문 덩어리와 트랙 사이 */
  { w: 6, pts: [[-96, -54], [-62, -40], [-24, -34], [16, -40], [56, -54], [92, -60]] },
  /* 남쪽 — 정문 안쪽을 가로지릅니다 */
  { w: 6, pts: [[-92, 66], [-52, 56], [-16, 66], [22, 58], [58, 66], [88, 82]] },
  /* 못·야외극장으로 빠지는 갈래 */
  { w: 5, pts: [[-96, -6], [-112, 6], [-120, 22]] },
];

/* ══════════════════════════════════════════════════════════
   4. 숲 — 덩어리로

   나무를 고르게 뿌리면 공원이 됩니다. 실제 캠퍼스는 한쪽이 통째로
   숲이고 나머지는 훤합니다. 여기 적은 원 안에만 심습니다.
   ══════════════════════════════════════════════════════════ */
export const WOODS = [
  { x: 138, z:  70, r: 46 },      // 남동 — 가장 큰 숲
  { x: 108, z: 116, r: 38 },
  { x: -144, z: -74, r: 40 },     // 북서 구석
  { x: -96, z: -108, r: 34 },
  { x:  10, z: -128, r: 40 },     // 북쪽 경계
  { x: 150, z: -10, r: 30 },
];

/* 가로수 — 길가에만. 숲과 달리 줄을 섭니다 */
export const ALLEE = [0, 1, 2];   // ROADS 인덱스

/* ══════════════════════════════════════════════════════════
   짓기
   ══════════════════════════════════════════════════════════ */
function slab(p, w, d, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.order = 'YXZ';
  m.rotation.y = ry;
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.castShadow = false; m.receiveShadow = true;
  p.add(m);
  return m;
}

/* ---- 바닥 ---- */
function ground(g) {
  const disc = new THREE.Mesh(
    new THREE.PlaneGeometry(SITE.w, SITE.d), M(PAL.lawn, .9));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = .09;
  disc.castShadow = false; disc.receiveShadow = true;
  g.add(disc);

  /* 잔디 얼룩 — 넓은 판을 한 색으로 두면 당구대입니다.
     대비는 아주 낮게. 세면 얼룩이 무늬가 됩니다. */
  const a = M(PAL.lawnDark, .9), b = M(PAL.lawnLight, .9);
  for (let i = 0; i < 120; i++) {
    const x = (rnd() - .5) * SITE.w, z = (rnd() - .5) * SITE.d;
    const w = 10 + rnd() * 26;
    const m = new THREE.Mesh(new THREE.CircleGeometry(w / 2, 20), rnd() < .5 ? a : b);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(1, .5 + rnd() * .9, 1);
    m.position.set(x, .095 + i * .0004, z);
    m.castShadow = false; m.receiveShadow = true;
    g.add(m);
  }
}

/* ---- 길 ----
   점 목록을 곡선으로 잇고, 곡선을 따라 판을 깝니다. 곡선 하나를
   조각 여럿으로 나눠 깔면 굽은 길이 됩니다. */
function roads(g) {
  const roadM = M(PAL.road, .92), edgeM = M(PAL.roadEdge, .86);
  const out = [];
  for (const r of ROADS) {
    const curve = new THREE.CatmullRomCurve3(
      r.pts.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const n = Math.max(8, Math.round(curve.getLength() / 6));
    const pts = curve.getPoints(n);
    for (let i = 0; i < pts.length - 1; i++) {
      const A = pts[i], B = pts[i + 1];
      const mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2;
      const len = Math.hypot(B.x - A.x, B.z - A.z) * 1.25;
      const dir = Math.atan2(B.z - A.z, B.x - A.x);
      slab(g, r.w + 1.4, len, edgeM, mx, .102, mz, -(dir + Math.PI / 2));
      slab(g, r.w, len, roadM, mx, .106, mz, -(dir + Math.PI / 2));
    }
    out.push({ curve, w: r.w });
  }
  return out;
}

/* ---- 프로그램 면적 ---- */
function fields(g, solid) {
  const put = (t, f) => {
    const { x, z, w, d, ry } = f;
    if (t === 'track') {
      /* 트랙 — 바깥 타원 붉은 우레탄, 안쪽 초록 축구장 */
      const outer = new THREE.Mesh(new THREE.CircleGeometry(.5, 48), M(PAL.track, .94));
      outer.rotation.x = -Math.PI / 2; outer.scale.set(w, d, 1);
      outer.position.set(x, .11, z); outer.receiveShadow = true; outer.castShadow = false;
      g.add(outer);
      const inner = new THREE.Mesh(new THREE.CircleGeometry(.5, 48), M(PAL.turf, .92));
      inner.rotation.x = -Math.PI / 2; inner.scale.set(w - 22, d - 18, 1);
      inner.position.set(x, .118, z); inner.receiveShadow = true; inner.castShadow = false;
      g.add(inner);
      slab(g, w - 34, d - 26, M(PAL.turf, .92), x, .124, z, ry);
      /* 흰 선 — 축구장이라는 표시 */
      slab(g, w - 34, .5, M(PAL.turfLine, .9), x, .13, z, ry);
      for (const sz of [-1, 1]) slab(g, .5, d - 26, M(PAL.turfLine, .9), x + sz * (w - 34) / 2, .13, z, ry);
    } else if (t === 'tennis') {
      slab(g, w, d, M(PAL.court, .92), x, .11, z, ry);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const cx = x + (i - .5) * w * .48, cz = z + (j - .5) * d * .48;
        slab(g, w * .42, d * .42, M(PAL.clay, .93), cx, .118, cz, ry);
        slab(g, w * .38, .3, M(PAL.courtLine, .9), cx, .124, cz, ry);
      }
    } else if (t === 'court') {
      slab(g, w, d, M(PAL.clay, .93), x, .11, z, ry);
      slab(g, w - 3, d - 3, M(PAL.court, .92), x, .116, z, ry);
      slab(g, .4, d - 3, M(PAL.courtLine, .9), x, .122, z, ry);
    } else if (t === 'ball') {
      /* 야구장 — 부채꼴 잔디에 흙 내야 */
      const fan = new THREE.Mesh(new THREE.CircleGeometry(w / 2, 28, Math.PI * .25, Math.PI * .5),
        M(PAL.turf, .92));
      fan.rotation.x = -Math.PI / 2; fan.position.set(x, .11, z);
      fan.receiveShadow = true; fan.castShadow = false; g.add(fan);
      const dirt = new THREE.Mesh(new THREE.CircleGeometry(w * .2, 20, Math.PI * .25, Math.PI * .5),
        M(PAL.clay, .93));
      dirt.rotation.x = -Math.PI / 2; dirt.position.set(x, .118, z);
      dirt.receiveShadow = true; dirt.castShadow = false; g.add(dirt);
    } else if (t === 'rugby') {
      slab(g, w, d, M(PAL.turf, .92), x, .11, z, ry);
      for (let i = 0; i <= 5; i++)
        slab(g, .4, d, M(PAL.turfLine, .9), x - w / 2 + (w / 5) * i, .118, z, ry);
    } else if (t === 'lot') {
      slab(g, w, d, M(PAL.lotDark, .94), x, .11, z, ry);
      /* 주차 칸 — 선만 그으면 주차장으로 읽힙니다 */
      const rows = Math.floor(d / 11);
      for (let r2 = 0; r2 < rows; r2++) {
        const cz = z - d / 2 + 5.5 + r2 * 11;
        const n = Math.floor(w / 3.2);
        for (let i = 0; i <= n; i++)
          slab(g, .28, 9, M(PAL.lotLine, .9), x - w / 2 + (w / n) * i, .118, cz, ry);
      }
    } else if (t === 'pond') {
      const e = new THREE.Mesh(new THREE.CircleGeometry(.5, 34), M(PAL.sand, .9));
      e.rotation.x = -Math.PI / 2; e.scale.set(w + 6, d + 6, 1);
      e.position.set(x, .108, z); e.receiveShadow = true; e.castShadow = false; g.add(e);
      const p2 = new THREE.Mesh(new THREE.CircleGeometry(.5, 34), M(PAL.water, .25));
      p2.rotation.x = -Math.PI / 2; p2.scale.set(w, d, 1);
      p2.position.set(x, .115, z); p2.receiveShadow = false; p2.castShadow = false; g.add(p2);
      solid(x, z, w * .8, d * .8, 0, false);
    } else if (t === 'amphi') {
      /* 야외극장 — 반원 계단 */
      const steps = 7;
      for (let i = 0; i < steps; i++) {
        const rr = w / 2 - i * (w / 2 / steps) * .9;
        const ring = new THREE.Mesh(
          new THREE.CylinderGeometry(rr, rr, .42, 30, 1, false, Math.PI * .15, Math.PI * 1.2),
          M(i % 2 ? PAL.stone : PAL.stoneDark, .86));
        ring.position.set(x, .12 + i * .38, z);
        ring.castShadow = true; ring.receiveShadow = true;
        g.add(ring);
      }
      slab(g, w * .4, d * .28, M(PAL.stone, .84), x, .14, z + d * .3, 0);
      solid(x, z, w * .7, d * .7, 0, false);
    }
  };
  for (const f of FIELDS) put(f.t, f);
}

/* ---- 숲 ----
   덩어리 안에만 심습니다. 인스턴싱이라 몇백 그루가 드로우콜 넷입니다. */
function woods(g, avoid) {
  const trees = [];
  for (const w of WOODS) {
    const n = Math.round(w.r * w.r * .022);
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, r = Math.sqrt(rnd()) * w.r;
      const x = w.x + Math.cos(a) * r, z = w.z + Math.sin(a) * r;
      if (Math.abs(x) > SITE.hx - 4 || Math.abs(z) > SITE.hz - 4) continue;
      if (avoid && avoid(x, z, 26)) continue;
      let close = false;
      for (let k = trees.length - 1; k >= 0 && k > trees.length - 30; k--)
        if (Math.hypot(trees[k].x - x, trees[k].z - z) < 5.5) { close = true; break; }
      if (close) continue;
      trees.push({ x, z, s: .9 + rnd() * .9, kind: i % 3, ry: rnd() * TAU });
    }
  }
  return trees;
}

/* ---- 가로수 — 길가에 줄 ---- */
function allee(built, avoid) {
  const trees = [];
  for (const i of ALLEE) {
    const r = built[i];
    if (!r) continue;
    const n = Math.round(r.curve.getLength() / 17);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const p = r.curve.getPointAt(t);
      const tan = r.curve.getTangentAt(t);
      const nx = -tan.z, nz = tan.x;
      for (const sd of [-1, 1]) {
        const off = r.w / 2 + 3.4;
        const x = p.x + nx * off * sd, z = p.z + nz * off * sd;
        if (Math.abs(x) > SITE.hx - 4 || Math.abs(z) > SITE.hz - 4) continue;
        if (avoid && avoid(x, z, 22)) continue;
        trees.push({ x, z, s: 1.0 + rnd() * .4, kind: (k + (sd > 0 ? 1 : 0)) % 3, ry: rnd() * TAU });
      }
    }
  }
  return trees;
}

/* ---- 나무를 인스턴스로 ---- */
function plantTrees(g, trees, solid) {
  if (!trees.length) return;
  const trunkG = new THREE.CylinderGeometry(.17, .27, 2.6, 6);
  trunkG.translate(0, 1.3, 0);
  const mk = (geo, mat, list, cast) => {
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    im.userData.noBake = true;
    im.castShadow = cast; im.receiveShadow = true;
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    const eul = new THREE.Euler();
    list.forEach((t, i) => {
      eul.set(0, t.ry, 0); q.setFromEuler(eul); sc.set(t.s, t.s, t.s);
      mtx.compose(new THREE.Vector3(t.x, 0, t.z), q, sc);
      im.setMatrixAt(i, mtx);
    });
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
  };
  mk(trunkG, M(PAL.trunk, .9), trees, true);

  /* 수관 — 구 셋을 한 지오메트리로 합쳐 인스턴스 하나가 나무 한 그루가 되게 */
  const parts = [
    new THREE.SphereGeometry(1.3, 7, 6), new THREE.SphereGeometry(1.0, 7, 6),
    new THREE.SphereGeometry(.82, 6, 5),
  ];
  parts[0].translate(0, 3.6, 0);
  parts[1].translate(.88, 3.0, .38);
  parts[2].translate(-.78, 3.1, -.52);
  let vc = 0, ic = 0;
  parts.forEach((p) => { vc += p.attributes.position.count; ic += p.index.count; });
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3);
  const idx = new Uint16Array(ic);
  let vo = 0, io = 0;
  parts.forEach((p) => {
    pos.set(p.attributes.position.array, vo * 3);
    nor.set(p.attributes.normal.array, vo * 3);
    for (let i = 0; i < p.index.count; i++) idx[io + i] = p.index.array[i] + vo;
    vo += p.attributes.position.count; io += p.index.count; p.dispose();
  });
  const leafG = new THREE.BufferGeometry();
  leafG.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  leafG.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  leafG.setIndex(new THREE.BufferAttribute(idx, 1));
  leafG.computeBoundingSphere();

  const byKind = [[], [], []];
  trees.forEach((t) => byKind[t.kind % 3].push(t));
  const cols = [M(PAL.leaf, .88), M(PAL.leafDeep, .88), M(PAL.leafWarm, .88)];
  byKind.forEach((list, i) => { if (list.length) mk(leafG, cols[i], list, true); });

  /* 줄기만 막습니다 — 수관까지 막으면 나무 밑을 못 지나가서 답답합니다 */
  for (const t of trees) solid(t.x, t.z, .6 * t.s, .6 * t.s);
}

/* ---- 경계 — 담과 정문 ----
   네모 부지라 담도 네 변입니다. 정문은 남쪽 가운데. */
function fence(g, solid) {
  const wallM = M(0xE8DFC8, .9), capM = M(0xC9BFA4, .86), brickM = M(0xC98A63, .82);
  const SEG = 5.6, GAP = 9;                      // 정문 폭
  const segs = [];
  const line = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.round(len / SEG);
    const dir = Math.atan2(z1 - z0, x1 - x0);
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      if (Math.abs(z - GATE.z) < 3 && Math.abs(x - GATE.x) < GAP) continue;   // 정문 자리
      segs.push({ x, z, ry: -(dir + Math.PI / 2) });
    }
  };
  const H = SITE.hz, W = SITE.hx;
  line(-W, -H, W, -H); line(W, -H, W, H); line(W, H, -W, H); line(-W, H, -W, -H);

  const bodyG = new THREE.BoxGeometry(SEG * 1.04, 2.2, .55);
  const capG = new THREE.BoxGeometry(SEG * 1.04, .22, .78);
  const mkI = (geo, mat, y) => {
    const im = new THREE.InstancedMesh(geo, mat, segs.length);
    im.userData.noBake = true; im.castShadow = true; im.receiveShadow = true;
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
    const eul = new THREE.Euler();
    segs.forEach((s2, i) => {
      eul.set(0, s2.ry, 0); q.setFromEuler(eul);
      mtx.compose(new THREE.Vector3(s2.x, y, s2.z), q, sc);
      im.setMatrixAt(i, mtx);
    });
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
  };
  mkI(bodyG, wallM, 1.1); mkI(capG, capM, 2.31);
  segs.forEach((s2) => solid(s2.x, s2.z, SEG * 1.06, .8, s2.ry));

  /* 정문 — 기둥 둘 + 상인방 */
  const gg = new THREE.Group();
  gg.position.set(GATE.x, 0, GATE.z);
  g.add(gg);
  for (const sx of [-1, 1]) {
    const px = sx * (GAP + 1.2);
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.2, 7.6, 2.2), brickM);
    p.position.set(px, 3.8, 0); p.castShadow = true; p.receiveShadow = true; gg.add(p);
    const c = new THREE.Mesh(new THREE.BoxGeometry(2.7, .5, 2.7), capM);
    c.position.set(px, 7.85, 0); c.castShadow = true; gg.add(c);
    solid(GATE.x + px, GATE.z, 2.5, 2.5, 0);
  }
  const lin = new THREE.Mesh(new THREE.BoxGeometry(GAP * 2 + 5, 1.2, 1.4), capM);
  lin.position.set(0, 8.3, 0); lin.castShadow = true; gg.add(lin);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(11, 1.6, .3), M(0x9BA6B2, .5));
  sign.position.set(0, 6.9, .85); sign.castShadow = true; gg.add(sign);
}

/* ---- 담 밖 — 도시와 산 ---- */
function beyond(g) {
  const far = M(0xA9BCCC, .96);

  /* ---- 가까운 띠 — 진짜 건물 ----
     담 바로 밖은 상자라는 게 티가 납니다. City Kit 을 씁니다.
     같은 파일끼리 인스턴스로 묶이므로, 서른 가지를 써도 드로우콜은
     파일 수 × 재질 수만큼입니다. */
  const kinds = [].concat(KIT.CITY.low, KIT.CITY.small, KIT.CITY.large, KIT.CITY.wide);
  const towers = KIT.CITY.tower;
  const spots = new Map();
  const put = (file, s) => { if (!spots.has(file)) spots.set(file, []); spots.get(file).push(s); };
  for (let i = 0; i < 64; i++) {
    const a = rnd() * TAU;
    const d = 34 + rnd() * 78;
    /* 탑은 멀리, 낮은 건물은 가까이 — 도시가 안쪽으로 낮아집니다 */
    const tall = d > 56 && rnd() < .45;
    const list = tall ? towers : kinds;
    put(list[(rnd() * list.length) | 0], {
      x: Math.cos(a) * (SITE.hx + d), z: Math.sin(a) * (SITE.hz + d),
      ry: Math.round(rnd() * 4) * (Math.PI / 2),
      tone: (i * 3) % 6,
    });
  }
  for (const [file, list] of spots) {
    KIT.place(g, file, list, { height: 14 + rnd() * 18, maxW: 26 }).then((r) => {
      if (r) r.group.traverse((o) => { o.castShadow = false; o.receiveShadow = false; });
    });
  }

  /* ---- 먼 띠 — 여기는 상자로 충분합니다. 안개가 다 먹습니다 ---- */
  const mk = (mat, count, minD, maxD, hMin, hMax) => {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, count);
    im.userData.noBake = true; im.castShadow = false; im.receiveShadow = false;
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    const eul = new THREE.Euler();
    for (let i = 0; i < count; i++) {
      const a = rnd() * TAU;
      const d = minD + rnd() * (maxD - minD);
      const x = Math.cos(a) * (SITE.hx + d), z = Math.sin(a) * (SITE.hz + d);
      const h = hMin + rnd() * (hMax - hMin);
      eul.set(0, rnd() * TAU, 0); q.setFromEuler(eul);
      sc.set(8 + rnd() * 18, h, 8 + rnd() * 18);
      mtx.compose(new THREE.Vector3(x, h / 2 - 1, z), q, sc);
      im.setMatrixAt(i, mtx);
    }
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
  };
  mk(far, 40, 96, 220, 16, 56);
  const hillM = M(0x86A98C, .98);
  for (let i = 0; i < 8; i++) {
    const a = rnd() * TAU, d = 260 + rnd() * 140;
    const h = new THREE.Mesh(new THREE.ConeGeometry(70 + rnd() * 80, 30 + rnd() * 34, 7), hillM);
    h.position.set(Math.cos(a) * (SITE.hx + d), 9, Math.sin(a) * (SITE.hz + d));
    h.castShadow = false; h.receiveShadow = false;
    g.add(h);
  }
}

/**
 * 부지 전체를 세웁니다 — 바닥 · 길 · 프로그램 면적 · 숲 · 담 · 담 밖.
 * 건물은 campus.js(들어갈 수 있는 여섯)와 faculty.js(나머지)가 세웁니다.
 */
/* ---- 부속동 ----
   실제 캠퍼스에는 이름 없는 작은 건물이 많습니다 — 기계실 · 창고 ·
   경비실 · 매점. 스물넷이 다 강의동이면 오히려 비현실적입니다.
   자리는 큰 건물 사이의 남는 틈이고, avoid 가 겹침을 막습니다. */
const ANNEX = [
  [-62, -6], [-30, 24], [12, -18], [58, -8], [86, 40], [-96, 42],
  [-52, -60], [30, -64], [66, -30], [-24, -8], [104, 62], [-108, 78],
  [56, 30], [-70, 106], [116, -8], [4, 68],
];
function annexes(g, solid, avoid) {
  const files = [].concat(KIT.CITY.small, KIT.CITY.wide);
  const spots = new Map();
  let i = 0;
  for (const [x, z] of ANNEX) {
    if (avoid && avoid(x, z, 20)) continue;
    const f = files[i % files.length];
    if (!spots.has(f)) spots.set(f, []);
    spots.get(f).push({ x, z, ry: Math.round(rnd() * 4) * (Math.PI / 2), tone: (i * 5) % 6 });
    solid(x, z, 11, 11, 0, true);
    i++;
  }
  for (const [f, list] of spots) KIT.place(g, f, list, { height: 7.5, maxW: 13 });
}

export function buildSite(parent, solid, avoid) {
  const g = new THREE.Group();
  g.name = 'site';
  parent.add(g);

  ground(g);
  const built = roads(g);
  fields(g, solid);
  fence(g, solid);
  beyond(g);
  annexes(g, solid, avoid);

  const trees = woods(g, avoid).concat(allee(built, avoid));
  plantTrees(g, trees, solid);

  return { group: g, trees: trees.length, roads: built.length, built, SITE, GATE };
}

/**
 * 건물 문 앞으로 들어가는 짧은 길.
 * 가장 가까운 도로 위의 점을 찾아 문까지 곧게 잇습니다 — 길이 덩어리
 * 사이만 잇고 문 앞까지 안 가면, 어디로 들어가는지가 안 보입니다.
 */
export function approaches(g, built, buildings) {
  const walkM = M(PAL.walk, .88), edgeM = M(PAL.roadEdge, .86);
  for (const b of buildings) {
    const ry = ryOf(b.face);
    /* 문 앞 — 정면 방향으로 건물 절반 + 조금 */
    const dep = ((b.d || 11) / 2) * (b.s || 1) + 3.4;
    const dx = b.x + Math.sin(ry) * dep, dz = b.z + Math.cos(ry) * dep;
    /* 모든 도로를 훑어 가장 가까운 점을 찾습니다 */
    let best = null, bd = 1e9;
    for (const r of built) {
      const n = 40;
      for (let i = 0; i <= n; i++) {
        const p = r.curve.getPointAt(i / n);
        const d2 = (p.x - dx) * (p.x - dx) + (p.z - dz) * (p.z - dz);
        if (d2 < bd) { bd = d2; best = p; }
      }
    }
    if (!best) continue;
    const len = Math.sqrt(bd);
    if (len < 3 || len > 64) continue;        // 붙어 있거나 너무 멀면 안 놓습니다
    const mx = (best.x + dx) / 2, mz = (best.z + dz) / 2;
    const dir = Math.atan2(dx - best.x, dz - best.z);
    slab(g, 5.4, len, edgeM, mx, .103, mz, -dir + Math.PI / 2 - Math.PI / 2);
    slab(g, 4.2, len, walkM, mx, .107, mz, -dir + Math.PI / 2 - Math.PI / 2);
    /* 문 앞 마당 — 길 끝이 그냥 잘리면 어색합니다 */
    slab(g, 8.5, 6.5, walkM, dx, .109, dz, -ry);
  }
}

/** 부지 안인가 — 원이 아니라 네모입니다 */
export const inSite = (x, z) =>
  Math.abs(x) < SITE.hx - 3 && Math.abs(z) < SITE.hz - 3;

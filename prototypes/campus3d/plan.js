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
/* 정문은 **담 위**에 섭니다. 전 판은 담(z 130) 안쪽 116 에 서 있어서,
   문을 지나고도 담이 또 나오는 이상한 순서였습니다. 문은 경계에
   있어야 문입니다. 그리고 문에서 첫 건물까지 38칸을 비워 두어야
   "들어왔다" 는 느낌이 납니다 — 실제 대학의 진입 마당이 그 자리입니다. */
export const GATE = { x: 0, z: 130 };
export const AXIS_X = 0;                 // 축이 x=0 을 따라 남북으로 뻗습니다

const TAU = Math.PI * 2;

/* 바닥 층 — **위로 갈수록 나중에 덮습니다.** 값을 직접 쓰지 말고
   반드시 여기서 가져다 씁니다. 0.004 씩 벌려 두어 z-fighting 도 없습니다.
   (잔디 얼룩이 도로를 덮어 백양로가 사라졌던 적이 있습니다.) */
export const LAYER = {
  lawn:      .080,   // 부지 전체 잔디
  blot:      .084,   // 잔디 얼룩 — 얼룩끼리만 미세하게 겹칩니다
  blotStep:  .00005, // 얼룩 한 장마다 올리는 값. 120장 × 이 값 = 0.006
  fieldBase: .092,   // 운동장 · 주차장 바탕
  field:     .100,   // 운동장 안쪽 면
  fieldLine: .106,   // 흰 선
  courtKerb: .112,   // 건물 앞마당 연석
  court:     .116,   // 건물 앞마당
  roadEdge:  .122,   // 길 가장자리
  road:      .126,   // 길
  walkEdge:  .132,   // 진입로 가장자리
  walk:      .136,   // 진입로
  doorYard:  .140,   // 문 앞 마당 — 가장 위
};
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
/* ══════════════════════════════════════════════════════════
   건물 — 왜 거기에 있는가

   전 판은 자리에 이유가 없었습니다. 각도와 반지름으로 흩어 놓기만 해서
   공과대학 옆에 미술대학이 있고 기숙사가 광장 옆에 있었습니다.
   실제 대학은 **계열끼리 붙고, 성격이 다른 것은 떨어집니다.**

   실제 캠퍼스가 지키는 규칙 넷을 그대로 씁니다.

     1. 축      정문 → 진입 마당 → 중앙 광장 → 본관. 가장 격식 있는 줄
     2. 계열    같은 단과대는 붙여 세웁니다. 학생이 하루에 오가는 거리
     3. 성격    조용한 것(도서관·연구동)과 시끄러운 것(체육·주차)을 뗍니다
     4. 외곽    기숙사·체육·주차는 가장자리. 강의동 사이에 안 끼웁니다

   그래서 지구가 여섯입니다.

     중앙        본관 · 도서관 · 학생회관 — 가장 많이 가는 곳
     인문사회    서쪽. 광장에서 가깝고 조용합니다
     자연공학    북쪽. 실험동이라 뒤로 물리고, 서비스 마당이 붙습니다
     예술·편의   동쪽
     체육 지구   남서 구석. 트랙 · 체육관 · 코트가 **한자리에** 모입니다
     기숙사 지구 북동 구석. 자기 진입로와 주차장을 따로 가집니다
   ══════════════════════════════════════════════════════════ */
export const BUILDINGS = [
  /* ── 중앙 — 축의 머리와 그 좌우. 가장 많이 가는 세 곳입니다 ── */
  { n: '본관',        enter: 'mainHall', x: 1, z: -55, face: 'S',  s: 1.9, w: 9.6, d: 6.2, front: 2.5 },
  { n: '도서관',      enter: 'library',  x: -46, z: -30, face: 'SE', s: 1.9, w: 10.0, d: 6.4, front: 2.4 },
  { n: '학생회관',    enter: 'union',    x: 46, z: -30, face: 'SW', s: 1.6, w: 9.0, d: 5.6, front: 1.9 },

  /* ── 인문사회 지구 — 서쪽. 광장에서 가깝고 조용한 쪽입니다 ── */
  { n: '인문대학',       kind: 'brick',     x: -84, z: -47, face: 'E', w: 24, d: 11, h: 13 },
  { n: '사회과학대학',   kind: 'brick',     x: -114, z: -30, face: 'E', w: 22, d: 11, h: 12 },
  { n: '경영대학',       kind: 'slab',      x: -114, z: 6, face: 'E', w: 22, d: 11, h: 13 },
  { n: '국제대학',       kind: 'atrium',    x: -84, z: 22, face: 'E', w: 22, d: 11, h: 12 },
  { n: '외국어대학',     kind: 'slab',      x: -84, z: -12, face: 'E', w: 24, d: 11, h: 12 },

  /* ── 자연공학 지구 — 북쪽. 실험동이라 축에서 물러나 섭니다 ── */
  { n: '공과대학',       kind: 'wing',      x: -52, z: -104, face: 'S', w: 26, d: 12, h: 14 },
  { n: '전자정보대학',   kind: 'slab',      x: -12, z: -116, face: 'S', w: 26, d: 11, h: 13 },
  { n: '응용과학대학',   kind: 'tower_lab', x: 26, z: -100, face: 'S', w: 22, d: 11, h: 14 },
  { n: '생명과학대학',   kind: 'tower_lab', x: 58, z: -94, face: 'SW', w: 22, d: 11, h: 13 },
  { n: '약학대학',       kind: 'slab',      x: 92, z: -78, face: 'SW', w: 22, d: 11, h: 12 },
  { n: '간호과학대학',   kind: 'brick',     x: 56, z: -61, face: 'W',  w: 22, d: 11, h: 12 },
  /* 대학원은 본관 뒤 — 실제로도 본부 뒤에 붙습니다 */
  { n: '대학원',         kind: 'admin',     x: -23, z: -73, face: 'S', w: 22, d: 12, h: 15 },

  /* ── 예술 · 편의 지구 — 동쪽 ── */
  { n: '예술디자인대학', kind: 'atrium',    x: 112, z: -30, face: 'W', w: 24, d: 12, h: 13 },
  { n: '박물관',         kind: 'library',   x: 112, z: 6, face: 'W', w: 20, d: 12, h: 12 },
  { n: '미니게임관',  enter: 'arcade',      x: 76, z: 14, face: 'W', s: 1.6, w: 8.4, d: 5.6, front: 1.9 },
  { n: '동아리 상점', enter: 'shop',        x: 40, z: 30, face: 'W', s: 1.6, w: 8.0, d: 5.2, front: 1.8 },

  /* ── 체육 지구 — 남서 구석. 트랙 · 코트와 **한자리에** 모입니다.
       전 판은 체육관이 동쪽, 트랙이 북쪽, 야구장이 남서라 흩어져 있었습니다 ── */
  { n: '체육관',         kind: 'gym',       x: -104, z: 60, face: 'E', w: 28, d: 17, h: 11 },

  /* ── 기숙사 지구 — 북동 구석. 자기 진입로와 주차장을 따로 가집니다 ── */
  { n: '기숙사',      enter: 'dorm',        x: 122, z: -60, face: 'SW', s: 1.6, w: 8.2, d: 5.4, front: 1.9 },
  { n: '제1기숙사',      kind: 'hall_res',  x: 142, z: -100, face: 'S', w: 24, d: 10, h: 15 },
  { n: '제2기숙사',      kind: 'hall_res',  x: 100, z: -118, face: 'S', w: 24, d: 10, h: 15 },

  /* ── 진입 마당 옆 — 외부 손님이 오는 건물. 정문 가까이가 제자리입니다 ── */
  { n: '평화의전당',     kind: 'hall',      x: 48, z: 84, face: 'W', w: 28, d: 19, h: 16 },
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
  /* 체육 지구 — 넷이 한자리에 붙습니다. 흩어 놓으면 캠퍼스가 아니라
     운동장 딸린 공원 여러 개가 됩니다. */
  { t: 'track',  x: -66, z:  96, w: 78, d: 46, ry: 0 },
  { t: 'ball',   x: -130, z: 108, w: 54, d: 48, ry: 0 },
  { t: 'tennis', x: -124, z:  20, w: 38, d: 28, ry: 0 },
  { t: 'court',  x:  -92, z:  30, w: 26, d: 20, ry: 0 },

  /* 못과 야외극장 — 동쪽 정원. 조용한 쪽이라 도서관 반대편에 둡니다 */
  { t: 'pond',   x: 134, z:  62, w: 44, d: 34, ry: 0 },
  { t: 'amphi',  x: 100, z:  56, w: 28, d: 28, ry: 0 },

  /* 주차장 — 전부 가장자리. 정문 옆 · 기숙사 · 서쪽 뒷길 */
  { t: 'lot',    x:  86, z: 112, w: 40, d: 28, ry: 0 },
  { t: 'lot',    x: 142, z: -44, w: 30, d: 42, ry: 0 },
  { t: 'lot',    x: -140, z: -70, w: 28, d: 40, ry: 0 },
];

/* ══════════════════════════════════════════════════════════
   3. 길 — 굽습니다

   방사형도 격자도 아닙니다. 덩어리를 잇는 선 몇 개가 지형을 따라
   휘어 있고, 그 사이는 잔디를 밟고 질러갑니다.
   각 길은 지나갈 점의 목록이고, CatmullRom 으로 부드럽게 잇습니다.
   ══════════════════════════════════════════════════════════ */
export const ROADS = [
  /* 축 — 정문에서 진입 마당을 지나 광장까지. 유일하게 곧습니다 */
  { w: 12, pts: [[0, 130], [0, 104], [0, 70], [0, 34], [0, 14]] },
  /* 서쪽 — 광장에서 인문사회 지구를 지나 체육 지구로 */
  { w: 7, pts: [[-16, 16], [-48, 6], [-76, 0], [-100, 8], [-108, 36], [-96, 62]] },
  /* 동쪽 — 광장에서 예술 지구를 지나 못으로 */
  { w: 7, pts: [[16, 16], [48, 20], [78, 26], [102, 34], [116, 50]] },
  /* 북쪽 — 본관 뒤로 자연공학 지구를 잇습니다 */
  { w: 7, pts: [[-96, -40], [-60, -66], [-24, -76], [16, -76], [52, -70], [86, -66]] },
  /* 기숙사 진입로 — 지구 하나에 길 하나. 실제로도 기숙사는 따로 듭니다 */
  { w: 6, pts: [[86, -66], [110, -60], [128, -66], [136, -86]] },
  /* 남쪽 — 진입 마당에서 좌우로 갈라집니다 */
  { w: 6, pts: [[-84, 62], [-40, 78], [0, 84], [44, 80], [82, 96]] },
];

/* ══════════════════════════════════════════════════════════
   4. 숲 — 덩어리로

   나무를 고르게 뿌리면 공원이 됩니다. 실제 캠퍼스는 한쪽이 통째로
   숲이고 나머지는 훤합니다. 여기 적은 원 안에만 심습니다.
   ══════════════════════════════════════════════════════════ */
export const WOODS = [
  /* 숲은 **경계 완충**입니다. 실제 캠퍼스도 담 안쪽을 나무로 두르고
     건물 사이는 비웁니다 — 사이에 심으면 건물이 안 보입니다. */
  { x: 138, z: 112, r: 34 },      // 남동 구석
  { x: -142, z: -108, r: 32 },    // 북서 구석
  { x:  118, z: -124, r: 30 },    // 북동 구석
  { x: -146, z:  62, r: 26 },     // 서쪽 띠
  { x:   -6, z: -128, r: 34 },    // 북쪽 띠
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
  disc.position.y = LAYER.lawn;
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
    m.position.set(x, LAYER.blot + i * LAYER.blotStep, z);
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
      slab(g, r.w + 1.4, len, edgeM, mx, LAYER.roadEdge, mz, -(dir + Math.PI / 2));
      slab(g, r.w, len, roadM, mx, LAYER.road, mz, -(dir + Math.PI / 2));
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
      outer.position.set(x, LAYER.fieldBase, z); outer.receiveShadow = true; outer.castShadow = false;
      g.add(outer);
      const inner = new THREE.Mesh(new THREE.CircleGeometry(.5, 48), M(PAL.turf, .92));
      inner.rotation.x = -Math.PI / 2; inner.scale.set(w - 22, d - 18, 1);
      inner.position.set(x, LAYER.field, z); inner.receiveShadow = true; inner.castShadow = false;
      g.add(inner);
      slab(g, w - 34, d - 26, M(PAL.turf, .92), x, LAYER.fieldLine, z, ry);
      /* 흰 선 — 축구장이라는 표시 */
      slab(g, w - 34, .5, M(PAL.turfLine, .9), x, LAYER.fieldLine, z, ry);
      for (const sz of [-1, 1]) slab(g, .5, d - 26, M(PAL.turfLine, .9), x + sz * (w - 34) / 2, LAYER.fieldLine, z, ry);
    } else if (t === 'tennis') {
      slab(g, w, d, M(PAL.court, .92), x, LAYER.fieldBase, z, ry);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const cx = x + (i - .5) * w * .48, cz = z + (j - .5) * d * .48;
        slab(g, w * .42, d * .42, M(PAL.clay, .93), cx, .118, cz, ry);
        slab(g, w * .38, .3, M(PAL.courtLine, .9), cx, .124, cz, ry);
      }
    } else if (t === 'court') {
      slab(g, w, d, M(PAL.clay, .93), x, LAYER.fieldBase, z, ry);
      slab(g, w - 3, d - 3, M(PAL.court, .92), x, LAYER.field, z, ry);
      slab(g, .4, d - 3, M(PAL.courtLine, .9), x, LAYER.fieldLine, z, ry);
    } else if (t === 'ball') {
      /* 야구장 — 부채꼴 잔디에 흙 내야 */
      const fan = new THREE.Mesh(new THREE.CircleGeometry(w / 2, 28, Math.PI * .25, Math.PI * .5),
        M(PAL.turf, .92));
      fan.rotation.x = -Math.PI / 2; fan.position.set(x, LAYER.fieldBase, z);
      fan.receiveShadow = true; fan.castShadow = false; g.add(fan);
      const dirt = new THREE.Mesh(new THREE.CircleGeometry(w * .2, 20, Math.PI * .25, Math.PI * .5),
        M(PAL.clay, .93));
      dirt.rotation.x = -Math.PI / 2; dirt.position.set(x, LAYER.field, z);
      dirt.receiveShadow = true; dirt.castShadow = false; g.add(dirt);
    } else if (t === 'rugby') {
      slab(g, w, d, M(PAL.turf, .92), x, LAYER.fieldBase, z, ry);
      for (let i = 0; i <= 5; i++)
        slab(g, .4, d, M(PAL.turfLine, .9), x - w / 2 + (w / 5) * i, LAYER.field, z, ry);
    } else if (t === 'lot') {
      slab(g, w, d, M(PAL.lotDark, .94), x, LAYER.fieldBase, z, ry);
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
      e.position.set(x, LAYER.fieldBase, z); e.receiveShadow = true; e.castShadow = false; g.add(e);
      const p2 = new THREE.Mesh(new THREE.CircleGeometry(.5, 34), M(PAL.water, .25));
      p2.rotation.x = -Math.PI / 2; p2.scale.set(w, d, 1);
      p2.position.set(x, LAYER.field, z); p2.receiveShadow = false; p2.castShadow = false; g.add(p2);
      solid(x, z, w * .8, d * .8, 0, false);
    } else if (t === 'amphi') {
      /* 야외극장 — 반원 계단 */
      const steps = 7;
      for (let i = 0; i < steps; i++) {
        const rr = w / 2 - i * (w / 2 / steps) * .9;
        const ring = new THREE.Mesh(
          new THREE.CylinderGeometry(rr, rr, .42, 30, 1, false, Math.PI * .15, Math.PI * 1.2),
          M(i % 2 ? PAL.stone : PAL.stoneDark, .86));
        ring.position.set(x, LAYER.field + i * .38, z);
        ring.castShadow = true; ring.receiveShadow = true;
        g.add(ring);
      }
      slab(g, w * .4, d * .28, M(PAL.stone, .84), x, LAYER.field, z + d * .3, 0);
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
    const n = Math.round(r.curve.getLength() / 11);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const p = r.curve.getPointAt(t);
      const tan = r.curve.getTangentAt(t);
      const nx = -tan.z, nz = tan.x;
      for (const sd of [-1, 1]) {
        const off = r.w / 2 + 3.4;
        const x = p.x + nx * off * sd, z = p.z + nz * off * sd;
        if (Math.abs(x) > SITE.hx - 4 || Math.abs(z) > SITE.hz - 4) continue;
        if (avoid && avoid(x, z, 14)) continue;
        trees.push({ x, z, s: 1.0 + rnd() * .4, kind: (k + (sd > 0 ? 1 : 0)) % 3, ry: rnd() * TAU });
      }
    }
  }
  return trees;
}

/* ---- 나무 ----
   구 세 개로 만든 우리 나무를 **전부** 킷 나무로 갈아 끼웁니다.
   섞지 않는 것이 중요합니다 — 정교한 것 옆에 서면 단순한 쪽이
   미완성으로 보이지, 둘이 사이좋게 보이지 않습니다.

   활엽 · 침엽 · 굽은나무 세 갈래를 섞어 심습니다. 한 종만 쓰면
   조림지처럼 보이고, 캠퍼스 나무는 종이 섞여 있습니다. */
function plantKitTrees(g, trees, solid) {
  const kinds = [KIT.NATURE.broad, KIT.NATURE.pine, KIT.NATURE.twist];
  const byFile = new Map();
  trees.forEach((t, i) => {
    const fam = kinds[t.kind % 3];
    const f = fam[i % fam.length];
    if (!byFile.has(f)) byFile.set(f, []);
    byFile.get(f).push({ x: t.x, z: t.z, ry: t.ry, s: 1, tone: 0 });
    /* 줄기만 막습니다 — 수관까지 막으면 나무 밑을 못 지나가서 답답합니다 */
    solid(t.x, t.z, .7 * t.s, .7 * t.s);
  });
  for (const [f, list] of byFile) {
    /* 나무 높이는 종마다 다릅니다. 활엽 8, 침엽 11, 굽은나무 7 —
       다 같으면 심어 놓은 티가 납니다. */
    const h = f.includes('pine') ? 10 + rnd() * 3
            : f.includes('twisted') ? 6.5 + rnd() * 2 : 7.5 + rnd() * 3;
    KIT.place(g, f, list, { height: h });
  }
}

/* ---- 옛 나무 — 지금은 안 씁니다 ----
   구 세 개를 합쳐 만든 인스턴스 나무입니다. 킷으로 갈아 끼웠지만,
   킷을 못 읽는 상황(오프라인 등)에서 되돌릴 수 있게 남겨 둡니다. */
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
  /* **네모 둘레에서 바깥으로** 밉니다. 타원으로 잡으면 45° 근처에서
     점이 네모 안으로 들어와 캠퍼스 한복판에 건물이 섭니다. */
  for (let i = 0; i < 68; i++) {
    const d = 30 + rnd() * 86;
    const side = i % 4;
    let x, z;
    if (side === 0)      { x = (rnd() - .5) * 2 * (SITE.hx + d); z = -(SITE.hz + d); }
    else if (side === 1) { x = (rnd() - .5) * 2 * (SITE.hx + d); z =  (SITE.hz + d); }
    else if (side === 2) { x = -(SITE.hx + d); z = (rnd() - .5) * 2 * (SITE.hz + d); }
    else                 { x =  (SITE.hx + d); z = (rnd() - .5) * 2 * (SITE.hz + d); }
    /* 확실히 부지 밖인지 한 번 더 봅니다 — 여기서 새면 캠퍼스가 깨집니다 */
    if (Math.abs(x) < SITE.hx + 12 && Math.abs(z) < SITE.hz + 12) continue;
    const tall = d > 60 && rnd() < .5;
    const list = tall ? towers : kinds;
    put(list[(rnd() * list.length) | 0], {
      x, z, ry: Math.round(rnd() * 4) * (Math.PI / 2), tone: (i * 3) % 6,
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
      if (Math.abs(x) < SITE.hx + 20 && Math.abs(z) < SITE.hz + 20) continue;
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
/* 부속동 — **서비스 마당 한 곳에 모읍니다.**
   전 판은 열여섯 채를 캠퍼스 전체에 흩뿌렸습니다. 강의동 사이에
   작은 창고가 끼어 있으니 "불필요할 정도로 작고 귀여운 건물" 이 되죠.
   실제 대학은 기계실 · 창고 · 관리동을 **뒤쪽 한 구역에** 몰아 둡니다.
   자연공학 지구 뒤(북동)와 체육 지구 뒤(남서) 두 곳입니다. */
const ANNEX = [
  /* 북동 서비스 마당 — 실험동 뒤 */
  [128, -128], [144, -126], [128, -114], [144, -112],
  /* 남서 관리 구역 — 체육 지구 뒤 */
  [-136, 92], [-136, 74], [-122, 88],
  /* 정문 옆 수위실·매점 — 문 옆은 실제로도 작은 건물이 섭니다 */
  [-20, 118], [20, 118],
];
/* ---- 건물 앞 포석 ----
   "대학인데 바닥이 초원" 의 나머지 절반입니다. 잔디가 벽까지 오면
   들판에 선 집이고, 건물 발치에 돌이 깔려야 캠퍼스가 됩니다.
   길과 별개로, 건물마다 제 발치를 갖습니다. */
function forecourts(g, buildings) {
  const stone = M(PAL.stone, .82), kerb = M(PAL.stoneDark, .84);
  for (const b of buildings) {
    const ry = ryOf(b.face);
    const bw = (b.w || 20) * (b.s || 1), bd = (b.d || 11) * (b.s || 1);
    slab(g, bw + 9, bd + 11, kerb, b.x, LAYER.courtKerb, b.z, -ry);
    slab(g, bw + 7, bd + 9, stone, b.x, LAYER.court, b.z, -ry);
  }
}

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
  /* 포석을 길보다 **먼저** 깝니다 — 나중에 깔면 길 위를 덮습니다 */
  forecourts(g, BUILDINGS);
  const built = roads(g);
  fields(g, solid);
  fence(g, solid);
  beyond(g);
  annexes(g, solid, avoid);

  /* 가로수(allee)를 뺐습니다 — 길마다 줄지어 심으니 어느 길이 중심
     축인지가 나무에 묻혔습니다. 부지 밖 숲(woods)은 남깁니다: 담 너머
     지평선을 채우는 것이라 광장 소품과는 다른 몫입니다. */
  const trees = woods(g, avoid);
  plantKitTrees(g, trees, solid);
  props(g, built, solid, avoid);

  return { group: g, trees: trees.length, roads: built.length, built, SITE, GATE };
}

/* ══════════════════════════════════════════════════════════
   소품 — 자동차 · 벤치 · 가로등 · 쓰레기통 · 이름표

   전부 킷입니다. 우리가 그리던 벤치·가로등보다 낫고, 같은 톤으로
   재도색되므로 갈라지지 않습니다.
   ══════════════════════════════════════════════════════════ */
function props(g, built, solid, avoid) {
  const push = (map, f, s) => { if (!map.has(f)) map.set(f, []); map.get(f).push(s); };

  /* ---- 자동차 ----
     주차장 셋이 텅 비어 있었습니다. 칸을 그려 놓고 차가 없으면
     주차장이 아니라 흰 줄 그은 회색 판입니다. */
  const cars = new Map();
  let ci = 0;
  for (const f of FIELDS) {
    if (f.t !== 'lot') continue;
    const rows = Math.floor(f.d / 11);
    for (let r2 = 0; r2 < rows; r2++) {
      const cz = f.z - f.d / 2 + 5.5 + r2 * 11;
      const n = Math.floor(f.w / 3.2);
      for (let i = 0; i < n; i++) {
        if (rnd() < .42) continue;                  // 빈 칸이 있어야 주차장입니다
        const cx = f.x - f.w / 2 + (f.w / n) * (i + .5);
        push(cars, KIT.PROPS.car[ci++ % KIT.PROPS.car.length],
             { x: cx, z: cz, ry: rnd() < .5 ? 0 : Math.PI, s: 1, tone: ci % 6 });
        solid(cx, cz, 2.2, 4.4);
      }
    }
  }
  for (const [f, list] of cars) KIT.place(g, f, list, { height: 1.9 });

  /* ---- 길가 벤치 · 가로등 · 쓰레기통 ----
     길을 따라 놓습니다. 잔디에 흩뿌리면 물건이 떠 있고, 길가에
     서 있어야 "누가 쓰는 것" 으로 보입니다. */
  const bench = new Map(), lamp = new Map(), bin = new Map();
  let k = 0;
  /* 길이 26 칸마다 벤치 · 가로등 · 쓰레기통을 번갈아 놓던 것을 껐습니다.
     규칙이 "길을 따라 등간격" 하나뿐이라, 사람이 앉을 이유가 없는
     곳에도 벤치가 서 있었습니다. 다시 놓을 때는 목적지(문 앞 · 정류장 ·
     그늘) 를 먼저 정하고 그 옆에 붙입니다. */
  for (const r of []) {
    const len = r.curve.getLength();
    const n = Math.max(2, Math.round(len / 26));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const p = r.curve.getPointAt(t);
      const tan = r.curve.getTangentAt(t);
      const nx = -tan.z, nz = tan.x;
      const off = r.w / 2 + 2.1;
      const side = i % 2 ? 1 : -1;
      const x = p.x + nx * off * side, z = p.z + nz * off * side;
      if (!inSite(x, z) || (avoid && avoid(x, z, 13))) continue;
      const face = Math.atan2(-nx * side, -nz * side);
      k++;
      if (k % 3 === 0) {
        push(bench, KIT.PROPS.bench[k % KIT.PROPS.bench.length], { x, z, ry: face, s: 1, tone: 0 });
        solid(x, z, 2.4, 1.1, face);
      } else if (k % 3 === 1) {
        push(lamp, KIT.PROPS.lamp[k % KIT.PROPS.lamp.length], { x, z, ry: face, s: 1, tone: 0 });
        solid(x, z, .7, .7);
      } else {
        push(bin, KIT.PROPS.bin[0], { x, z, ry: face, s: 1, tone: 0 });
        solid(x, z, .8, .8);
      }
    }
  }
  for (const [f, l] of bench) KIT.place(g, f, l, { height: 1.3 });
  for (const [f, l] of lamp) KIT.place(g, f, l, { height: 4.8 });
  for (const [f, l] of bin) KIT.place(g, f, l, { height: 1.1 });

  /* ---- 건물 이름표 ----
     문 앞에 표지판 하나. 건물이 스물넷인데 이름이 없으면 어디가
     어디인지 지도를 열어야만 압니다. */
  const signs = new Map();
  /* 건물 이름표(이정표) 스물넷도 뺐습니다 */
  [].forEach((b, i) => {
    const ry = ryOf(b.face);
    const dep = ((b.d || 11) * (b.s || 1)) / 2 + 6.5;
    const sx = b.x + Math.sin(ry) * dep + Math.cos(ry) * 5.5;
    const sz = b.z + Math.cos(ry) * dep - Math.sin(ry) * 5.5;
    push(signs, KIT.PROPS.sign[i % KIT.PROPS.sign.length],
         { x: sx, z: sz, ry, s: 1, tone: 0 });
    solid(sx, sz, .8, .8);
  });
  for (const [f, l] of signs) KIT.place(g, f, l, { height: 2.6 });
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
    slab(g, 5.4, len, edgeM, mx, LAYER.walkEdge, mz, -dir + Math.PI / 2 - Math.PI / 2);
    slab(g, 4.2, len, walkM, mx, LAYER.walk, mz, -dir + Math.PI / 2 - Math.PI / 2);
    /* 문 앞 마당 — 길 끝이 그냥 잘리면 어색합니다 */
    slab(g, 8.5, 6.5, walkM, dx, LAYER.doorYard, dz, -ry);
  }
}

/** 부지 안인가 — 원이 아니라 네모입니다 */
export const inSite = (x, z) =>
  Math.abs(x) < SITE.hx - 3 && Math.abs(z) < SITE.hz - 3;

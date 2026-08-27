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
import { M, sign } from './parts.js';
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
  /* 잔디는 세 파일이 각자 들고 있습니다(plan·campus·grounds). 셋이
     같은 값이어야 합니다 — 부지 잔디·중심 원판·바깥 잔디가 서로
     맞닿아 있어서, 하나만 고치면 경계에 띠가 보입니다. */
  lawn: 0x80BC62, lawnDark: 0x75B356, lawnLight: 0x8BC36F,
  /* campus.js PAL 과 **같은 가족**(38° 따뜻한 중성)이어야 합니다.
     한쪽만 고치면 광장과 길이 맞닿는 자리에 색 띠가 생깁니다. */
  road: 0xCFC7BA, roadEdge: 0xE6E1D6, walk: 0xD8D1C5,
  track: 0xC9705A, turf: 0x5FB765, turfLine: 0xF2F7F0,
  court: 0x4E9E7A, courtLine: 0xF2F7F0, clay: 0xC08A62,
  water: 0x73B9D3, waterDeep: 0x4F9ABA, sand: 0xE8D8B0,
  lotDark: 0x8E9490, lotLine: 0xF0F0EA,
  stone: 0xE0D9CC, stoneDark: 0xC9BFB0,
  /* 잎을 잔디와 같은 계열(100~108°)로 당깁니다. 115° 에 있으면 잔디만
     따뜻하고 나무만 차가워서, 심은 것이 한 정원으로 안 보입니다. */
  trunk: 0x8E5A33, leaf: 0x63B855, leafDeep: 0x4A9440, leafWarm: 0x86C566,
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
  /* ══ 중앙 지구 — 세 채가 광장 가운데를 마주 봅니다 ══

     본관이 북, 도서관이 서, 학생회관이 동. 셋이 서로를 향해 서고 남쪽
     한 면만 대로로 트입니다. ㄷ자 날개를 더 두지 않은 이유는 크기입니다:
     본관 84 × 28, 도서관 45 × 30, 학생회관 42 × 28 이라 세 채만으로
     광장 세 변이 채워집니다. 여기에 작은 건물을 더 끼우면 그것이
     **잘려 보이는** 것이 됩니다 — 거인 옆의 소품이 되니까요.

     면 사이 83칸 · 높이 28칸이라 위요비 1:3.0. 대학 중앙 광장이
     사는 자리입니다. */
  /* 배율 3.0 은 픽셀맵의 체감보다 컸습니다. 픽셀맵 본관은 폭 14칸 ·
     깊이 9칸이고 캐릭터가 한 칸이니, 월드로 옮기면 50 남짓입니다 —
     84 는 그 1.7 배라 광장 한 변이 통째로 벽이 됐습니다.
     본관 2.0(56×19) · 도서관 2.2(33×22) · 학생회관 2.2(31×21). */
  { n: '본관',     enter: 'mainHall', x: 0, z: -42, face: 'S', s: 1.85, w: 28, d: 9.4, front: 2.2 },
  { n: '도서관',   enter: 'library',  x: -40, z: -6, face: 'E', s: 2.2, w: 15, d: 10, front: 1.9 },
  { n: '학생회관', enter: 'union',    x:  40, z: -6, face: 'W', s: 2.2, w: 14, d: 9.4, front: 1.9 },

  /* ══ 인문사회 지구 — 서쪽 안뜰 44×44, 동쪽으로 엽니다 ══
     ㄷ자 날개끼리 **물지 않습니다**. 전 판은 모서리에서 상자 둘이 서로를
     파고들어 한쪽 벽이 잘린 것처럼 보였습니다. 이제 정확히 맞닿기만
     하도록 날개 길이를 부지에 맞춰 잘라 놓았습니다. */
  { n: '인문대학',     kind: 'brick', x: -98, z: -34, face: 'S', w: 44, d: 12, h: 13 },
  { n: '사회과학대학', kind: 'slab',  x: -126, z: -4, face: 'E', w: 44, d: 12, h: 13 },
  { n: '경영대학',     kind: 'brick', x: -98, z:  22, face: 'N', w: 44, d: 12, h: 12 },
  { n: '외국어대학',   kind: 'slab',  x: -128, z: -60, face: 'E', w: 30, d: 12, h: 12 },
  { n: '대학원',       kind: 'admin', x: -62, z: -66, face: 'E', w: 28, d: 13, h: 15 },

  /* ══ 자연공학 지구 — 북쪽 안뜰 44×25, 남쪽으로 엽니다 ══ */
  { n: '공과대학',     kind: 'wing',      x: -2, z: -106, face: 'S', w: 62, d: 12, h: 14 },
  { n: '전자정보대학', kind: 'slab',      x: -30, z: -87, face: 'E', w: 24, d: 12, h: 13 },
  { n: '응용과학대학', kind: 'tower_lab', x:  26, z: -87, face: 'W', w: 24, d: 12, h: 14 },
  { n: '생명과학대학', kind: 'tower_lab', x:  52, z: -84, face: 'SW', w: 24, d: 12, h: 13 },
  { n: '간호과학대학', kind: 'brick',     x:  60, z: -58, face: 'W', w: 24, d: 12, h: 12 },

  /* ══ 예술 · 생활 지구 — 동쪽 안뜰 43×46, 서쪽으로 엽니다 ══ */
  { n: '예술디자인대학', kind: 'atrium',  x: 104, z: -34, face: 'S', w: 46, d: 12, h: 13 },
  { n: '박물관',         kind: 'library', x: 130, z:  -4, face: 'W', w: 44, d: 12, h: 12 },
  { n: '미니게임관',  enter: 'arcade', x:  88, z: 30, face: 'N', s: 3.0, w: 8.4, d: 5.6, front: 2.2 },
  { n: '동아리 상점', enter: 'shop',   x: 118, z: 30, face: 'N', s: 3.0, w: 8.0, d: 5.2, front: 2.2 },

  /* ══ 대로변 — 광장에서 밀려난 둘이 여기로 ══
     대로가 정문에서 광장까지 96칸입니다. 그 중간을 잡아 주는 것이
     없으면 걷는 동안 아무 일도 안 일어납니다. */
  { n: '국제대학',   kind: 'atrium', x: -42, z: 48, face: 'E', w: 26, d: 12, h: 13 },
  { n: '학생문화관', kind: 'hall',   x:  42, z: 48, face: 'W', w: 26, d: 12, h: 13 },

  /* ══ 가장자리 — 체육 · 기숙사 · 진입 마당 ══ */
  { n: '체육관',    kind: 'gym', x: -131, z: 70, face: 'E', w: 30, d: 18, h: 11 },
  /* 기숙사 단지 — 트윈 슬래브가 마당을 사이에 두고 나란히,
     들어가는 기숙사(공용동)가 마당 입구를 지킵니다 */
  { n: '제1기숙사', kind: 'hall_res', x: 112, z: -104, face: 'S', w: 44, d: 12, h: 21 },
  { n: '제2기숙사', kind: 'hall_res', x: 112, z: -74, face: 'S', w: 44, d: 12, h: 21 },
  { n: '기숙사',    enter: 'dorm', x: 36, z: -62, face: 'S', s: 2.7, w: 8.2, d: 5.4, front: 2.2 },
  { n: '평화의전당', kind: 'hall',  x:  52, z: 96, face: 'W', w: 30, d: 20, h: 16 },
  { n: '입학처',     kind: 'admin', x: -46, z: 100, face: 'E', w: 24, d: 14, h: 11 },
];

/* 바라보는 쪽 → ry. 정면 방향이 (sin ry, cos ry) 입니다. */
/* +z 가 남쪽(정문이 z=+130), +x 가 동쪽입니다.

   전 판은 x 쪽 이름이 통째로 뒤집혀 있었습니다 — 'E' 가 -x 를 가리켜서,
   x=112 의 예술디자인대학에 face:'W' 를 주면 정면이 +x, 즉 **담 쪽**을
   봤습니다. 동쪽 건물들이 전부 등을 돌리고 서 있던 이유입니다. */
const FACE = {
  S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2,
  SE: Math.PI / 4, SW: -Math.PI / 4, NE: Math.PI * .75, NW: -Math.PI * .75,
};
export const ryOf = (face) => FACE[face] !== undefined ? FACE[face] : 0;

/* ══════════════════════════════════════════════════════════
   2. 프로그램 면적

   캠퍼스 면적의 절반이 여기입니다. 건물 사이를 잔디로만 두면 공원이
   되고, 여기가 채워져야 대학이 됩니다.
   ══════════════════════════════════════════════════════════ */
export const FIELDS = [
  { t: 'track',  x: -84, z:  66, w: 60, d: 34, ry: 0 },
  { t: 'tennis', x: -92, z:  96, w: 38, d: 22, ry: 0 },
  { t: 'pond',   x: 118, z:  70, w: 40, d: 30, ry: 0 },
  { t: 'amphi',  x:  80, z:  56, w: 26, d: 26, ry: 0 },
  { t: 'lot',    x:  94, z:  98, w: 34, d: 22, ry: 0 },
  { t: 'lot',    x: 143, z: -50, w: 22, d: 26, ry: 0 },
];

/* ══════════════════════════════════════════════════════════
   3. 길 — 굽습니다

   방사형도 격자도 아닙니다. 덩어리를 잇는 선 몇 개가 지형을 따라
   휘어 있고, 그 사이는 잔디를 밟고 질러갑니다.
   각 길은 지나갈 점의 목록이고, CatmullRom 으로 부드럽게 잇습니다.
   ══════════════════════════════════════════════════════════ */
export const ROADS = [
  /* ① 축 — 폭 22. 정문에서 광장 남단까지 곧게 */
  { w: 22, pts: [[0, 130], [0, 104], [0, 74], [0, 52], [0, 34]] },

  /* ② 순환로 — 폭 11. 정문 안에서 좌우로 갈라져 담을 따라 돕니다 */
  { w: 11, pts: [[0, 120], [-56, 120], [-112, 118], [-146, 104], [-150, 50],
                 [-150, -20], [-148, -72], [-138, -114], [-70, -120], [-20, -120]] },
  { w: 11, pts: [[0, 120], [56, 120], [112, 118], [146, 104], [150, 50],
                 [150, -20], [148, -72], [138, -114], [70, -120], [-20, -120]] },

  /* ③ 보행로 — 폭 6. **모든 지구가 걸어서 이어져야** 합니다.
     전 판은 다섯 가닥이라 기숙사 · 운동장 · 호수가 길 없이 잔디 위에
     떠 있었습니다. 지구마다 최소 한 가닥씩. */
  { w: 6, pts: [[-44, 32], [-60, 30], [-70, 24]] },          // 광장 → 인문사회
  { w: 6, pts: [[44, 32], [60, 30], [70, 24]] },             // 광장 → 예술생활
  { w: 6, pts: [[0, -76], [0, -84], [0, -92]] },             // 본관 뒤 → 자연공학
  /* 운동장 진입은 관중석(트랙 북면 x -104~-64 · z 40~45) **동쪽 옆**으로
     돕니다. 곧장 남진시켰더니 두 가닥이 관중석을 뚫고 트랙 위로
     올라탔습니다 — 흰 쐐기가 트랙을 가로지르던 정체입니다. */
  { w: 6, pts: [[-56, 34], [-58, 44], [-60, 50]] },          // 인문사회 → 운동장(동측)
  { w: 6, pts: [[52, 32], [64, 42], [74, 50]] },             // 학생회관 → 야외극장
  { w: 6, pts: [[46, -60], [64, -72], [78, -84], [88, -89]] },  // 자연공학 → 기숙사 마당
  { w: 6, pts: [[96, 34], [104, 48], [106, 58]] },           // 예술 → 호수
  { w: 6, pts: [[0, 108], [-24, 102], [-42, 98]] },          // 정문 마당 → 입학처
  { w: 6, pts: [[0, 108], [26, 102], [44, 98]] },            // 정문 마당 → 평화의전당

];

/* ══════════════════════════════════════════════════════════
   4. 숲 — 덩어리로

   나무를 고르게 뿌리면 공원이 됩니다. 실제 캠퍼스는 한쪽이 통째로
   숲이고 나머지는 훤합니다. 여기 적은 원 안에만 심습니다.
   ══════════════════════════════════════════════════════════ */
export const WOODS = [
  /* 숲이 **가장자리**로 물러납니다. 담이 맨 울타리로 서 있으면 그것은
     캠퍼스 경계가 아니라 게임 경계선으로 읽힙니다. 순환로 바깥과 담
     사이에 나무를 두면 담이 나무 너머로 물러납니다.
     심는 자리는 나무마다 길과 건물을 피해 골라집니다(아래 woods). */
  { x: -146, z: -100, r: 24 },   { x:  146, z: -100, r: 24 },
  { x: -148, z:  -40, r: 20 },   { x:  148, z:  -40, r: 20 },
  { x: -148, z:   10, r: 20 },   { x:  148, z:   10, r: 20 },
  { x: -146, z:   70, r: 20 },   { x:  146, z:   70, r: 20 },
  { x:  -58, z: -122, r: 18 },   { x:   38, z: -122, r: 18 },
  { x: -128, z:  118, r: 18 },   { x:  128, z:  118, r: 18 },
  { x:  -96, z:  122, r: 16 },   { x:   96, z:  122, r: 16 },
  { x:  -18, z:  122, r: 14 },   { x:   18, z:  122, r: 14 },
];

/* ══════════════════════════════════════════════════════════
   6. 중정 바닥

   안뜰이 안뜰로 읽히려면 **바닥이 달라야** 합니다. 건물로 세 면을
   둘러도 바닥이 바깥과 같은 잔디면, 눈에는 그냥 잔디가 이어지다가
   건물이 서 있는 것으로 보입니다. 실제 캠퍼스 안뜰은 예외 없이
   가장자리에 포장 산책로가 돌고 가운데가 잔디 판입니다 — 그 테두리
   한 줄이 "여기부터 방" 이라고 말합니다.
   ══════════════════════════════════════════════════════════ */
export const COURTS = [
  { x: -98, z:  -6, w: 44, d: 44 },   // 인문사회
  { x:  -2, z: -87, w: 44, d: 25 },   // 자연공학
  { x: 102, z:  -5, w: 43, d: 46 },   // 예술 · 생활
];

function courts(g, solid) {
  const walkM = M(PAL.walk, .88), edgeM = M(PAL.roadEdge, .86);
  /* 팔레트 키는 lawnLight 입니다. grassLight 로 적었더니 undefined 가
     그대로 재질로 들어가 **흰 판**이 깔렸습니다 — 중정 한복판이 백지였던
     정체입니다. M() 이 색을 검사하지 않으니 조용히 흰색이 됩니다. */
  const lawnM = M(PAL.lawnLight, .88);
  for (const c of COURTS) {
    slab(g, c.w + 1.6, c.d + 1.6, edgeM, c.x, LAYER.walkEdge, c.z);
    slab(g, c.w, c.d, walkM, c.x, LAYER.walk, c.z);
    /* 가운데 잔디 판 — 포장을 테두리 4칸만 남기고 되돌립니다 */
    /* 가장자리 산책로를 4칸만 남기고 나머지는 잔디로 되돌립니다 */
    slab(g, c.w - 9, c.d - 9, lawnM, c.x, LAYER.doorYard, c.z);
  }
}

/* ── 축 가로수 ──
   대로가 폭 22 인데 아무것도 없으면 활주로입니다. 두 줄로 곧게 세워
   축을 눈으로 붙잡아 줍니다. 굽은 길의 가로수와 달리 여기는 등간격
   직선이어야 합니다 — 그 규칙성이 곧 "이 길이 중심" 이라는 표시입니다. */
function axisAllee(g, solid) {
  const list = [];
  for (let z = 42; z <= 116; z += 11.5)
    for (const x of [-15.5, 15.5]) list.push({ x, z, s: 1.05, ry: 0, tone: 0 });
  const f = KIT.NATURE.broad[0];
  if (f) KIT.place(g, f, list, { height: 9.5 });
  for (const t of list) solid(t.x, t.z, 1.1, 1.1);
  return list.length;
}

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
  /* 부지 밖 땅 — 담을 걷었으니 여기서 끊기면 허공이 보입니다.
     한 단 어둡게 깝니다: 멀리 있는 땅은 대기를 더 통과해 채도가
     떨어져 보입니다(공기 원근). 부지 잔디보다 아주 조금 낮게. */
  /* 부지 잔디와 **같은 색**입니다. 한 단 어둡게 깔았더니 부지의 네모가
     잔디 위에 선으로 드러나 담을 걷어낸 자리에 다시 경계가 생겼습니다.
     멀어질수록 흐려지는 일은 안개가 이미 합니다 — 색으로 또 하면
     두 번 합니다. */
  const out = new THREE.Mesh(new THREE.CircleGeometry(340, 72), M(PAL.lawn, .92));
  out.rotation.x = -Math.PI / 2;
  out.position.y = LAYER.lawn - .012;
  out.castShadow = false; out.receiveShadow = true;
  g.add(out);

  const disc = new THREE.Mesh(
    new THREE.PlaneGeometry(SITE.w, SITE.d), M(PAL.lawn, .9));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = LAYER.lawn;
  disc.castShadow = false; disc.receiveShadow = true;
  g.add(disc);

  /* 잔디 얼룩 — 넓은 판을 한 색으로 두면 당구대입니다.
     대비는 아주 낮게. 세면 얼룩이 무늬가 됩니다. */
  const a = M(PAL.lawnDark, .9), b = M(PAL.lawnLight, .9);
  /* 얼룩을 부지 밖까지 뿌립니다 — 경계선 위에 걸쳐야 선이 지워집니다 */
  for (let i = 0; i < 190; i++) {
    const x = (rnd() - .5) * SITE.w * 1.7, z = (rnd() - .5) * SITE.d * 1.9;
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
  /* 줄눈은 길보다 살짝 어둡게, 가운데 선은 살짝 밝게 */
  const jointM = M(0xC7C0AF, .9), centerM = M(0xEDE8DA, .88);
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
      const ry2 = -(dir + Math.PI / 2);
      /* 연석 — 길보다 넓게 한 겹. 길이 잔디 위에 얹힌 판이 아니라
         **파인 자리**로 보이게 합니다. */
      slab(g, r.w + 1.6, len, edgeM, mx, LAYER.roadEdge, mz, ry2);
      slab(g, r.w, len, roadM, mx, LAYER.road, mz, ry2);
      /* 줄눈 — 길 방향에 **직각**으로. 광장 포장의 격자와 같은 어휘라
         길과 광장이 한 재료로 읽힙니다. 조각마다 한 줄이면 간격이
         저절로 일정합니다(조각 길이가 곡률과 무관하게 같으므로). */
      slab(g, r.w - .5, .34, jointM, mx, LAYER.road + .002, mz, ry2);
      /* 가운데 선 — 축과 순환로에만. 보행로에 그으면 찻길이 됩니다 */
      if (r.w >= 11) slab(g, .42, len, centerM, mx, LAYER.road + .002, mz, ry2);
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
      /* ---- 운동장 ----
         운동장이 운동장으로 읽히는 것은 셋입니다: 레인 선, 골대,
         관중석. 전 판은 붉은 타원에 초록 판 하나라 "붉은 도넛" 이었습니다.

         레인은 흰 타원 **링 여섯**으로 긋습니다. RingGeometry 를 눌러
         타원으로 만들면 곡선 선을 공짜로 얻습니다. */
      const outer = new THREE.Mesh(new THREE.CircleGeometry(.5, 56), M(PAL.track, .94));
      outer.rotation.x = -Math.PI / 2; outer.scale.set(w, d, 1);
      outer.position.set(x, LAYER.fieldBase, z); outer.receiveShadow = true; outer.castShadow = false;
      g.add(outer);
      /* 레인 선 — 반지름 .5 링을 낮춰 가며 다섯 */
      const lineM = new THREE.MeshBasicMaterial({ color: PAL.turfLine, transparent: true, opacity: .5 });
      for (let i = 1; i <= 5; i++) {
        const f2 = 1 - i * .035;
        const ring = new THREE.Mesh(new THREE.RingGeometry(.492, .5, 64), lineM);
        ring.rotation.x = -Math.PI / 2;
        ring.scale.set(w * f2, d * f2, 1);
        ring.position.set(x, LAYER.field + .002 + i * .0004, z);
        ring.castShadow = false; ring.receiveShadow = false;
        g.add(ring);
      }
      /* 안쪽 축구장 */
      const inner = new THREE.Mesh(new THREE.CircleGeometry(.5, 48), M(PAL.turf, .92));
      inner.rotation.x = -Math.PI / 2; inner.scale.set(w - 20, d - 15, 1);
      inner.position.set(x, LAYER.field, z); inner.receiveShadow = true; inner.castShadow = false;
      g.add(inner);
      /* 축구장 선 — 테두리 · 중앙선 · 센터서클 */
      const FW = w - 30, FD = d - 20;
      slab(g, FW, .4, M(PAL.turfLine, .9), x, LAYER.fieldLine, z - FD / 2, ry);
      slab(g, FW, .4, M(PAL.turfLine, .9), x, LAYER.fieldLine, z + FD / 2, ry);
      for (const sz of [-1, 1]) slab(g, .4, FD, M(PAL.turfLine, .9), x + sz * FW / 2, LAYER.fieldLine, z, ry);
      slab(g, .4, FD, M(PAL.turfLine, .9), x, LAYER.fieldLine, z, ry);
      const cc = new THREE.Mesh(new THREE.RingGeometry(.46, .5, 40), lineM);
      cc.rotation.x = -Math.PI / 2; cc.scale.set(9, 9, 1);
      cc.position.set(x, LAYER.fieldLine + .002, z);
      cc.castShadow = false; g.add(cc);
      /* 골대 둘 — 흰 기둥과 크로스바 */
      const postM = M(0xF4F6F2, .5);
      for (const sx of [-1, 1]) {
        const gx = x + sx * (FW / 2 - .6);
        for (const gz of [-3.2, 3.2]) {
          const p1 = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 2.2, 8), postM);
          p1.position.set(gx, LAYER.field + 1.1, z + gz); p1.castShadow = true; g.add(p1);
        }
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 6.6, 8), postM);
        bar.rotation.x = Math.PI / 2;
        bar.position.set(gx, LAYER.field + 2.2, z); bar.castShadow = true; g.add(bar);
        solid(gx, z, 1.0, 7.0);
      }
      /* 관중석 — 긴 쪽 한 면에 세 단 */
      const standM = M(PAL.stone, .84), seatM = M(0x7FA0B8, .8);
      const SL = w * .58;
      /* 단마다 **땅에서부터** 올립니다. 전 판은 두께 0.35 짜리 판을
         0.45 · 0.80 높이에 띄워 놓았는데, 각 단의 z 가 서로 달라서
         밑을 받쳐 주는 것이 없었습니다 — 관중석 두 장이 잔디 위에
         떠 있는 것으로 보이던 정체입니다. */
      for (let i = 0; i < 3; i++) {
        const sh = .35 * (i + 1), sd = 1.15;
        const st = new THREE.Mesh(new THREE.BoxGeometry(SL, sh, sd), i % 2 ? seatM : standM);
        st.position.set(x, sh / 2 + LAYER.field, z - d / 2 - 2.2 - i * sd);
        st.castShadow = true; st.receiveShadow = true;
        g.add(st);
      }
      solid(x, z - d / 2 - 3.4, SL, 3.6);
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
      /* ---- 호수 ----
         호수가 호수로 읽히는 것: 물가의 **띠**(모래 → 얕은 물 → 깊은 물),
         물 위의 사물(수련 · 바위), 그리고 가장자리가 원이 아닌 것.
         전 판은 모래 타원 위 물 타원 — 접시에 담긴 물이었습니다.

         가장자리를 우툴두툴하게: 원 정점을 사인으로 흔들어 만듭니다. */
      const wob = (r, seg, amp, seed) => {
        const sh = new THREE.Shape();
        for (let i = 0; i <= seg; i++) {
          const a = (i / seg) * Math.PI * 2;
          const rr = r * (1 + Math.sin(a * 3 + seed) * amp + Math.sin(a * 7 + seed * 2) * amp * .5);
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr * (d / w);
          if (i === 0) sh.moveTo(px, py); else sh.lineTo(px, py);
        }
        sh.closePath();
        return new THREE.ShapeGeometry(sh, 2);
      };
      const mk = (geo, mat, y) => {
        const m = new THREE.Mesh(geo, mat);
        m.rotation.x = -Math.PI / 2; m.position.set(x, y, z);
        m.castShadow = false; m.receiveShadow = true; g.add(m); return m;
      };
      mk(wob(w / 2 + 3.4, 44, .05, 1.7), M(PAL.sand, .9), LAYER.fieldBase);          // 모래톱

      /* ── 물 ──
         전 판은 얕은 물 한 겹 · 깊은 물 한 겹, 그 위에 **흰 윤곽선 링 둘**
         이었습니다. 얇은 링은 물결이 아니라 그냥 선으로 보였고(과녁),
         두 겹 사이 경계도 칼로 자른 자국이었습니다. 물이 아니라 색종이.

         물로 읽히게 하는 것 넷을 넣습니다.
           ① 깊이 — 겹을 다섯으로 늘리고 색을 사이사이 섞습니다
           ② 비침 — 물가 두 겹은 반투명. 모래가 비쳐야 얕아 보입니다
           ③ 반짝임 — 거칠기를 0.14 까지 내려 해가 한 번 물낯에 맺힙니다
              (평평한 면 + 방향광이면 스페큘러가 실제로 생깁니다)
           ④ 물결 — 윤곽선이 아니라 **넓고 흐린 띠**. 폭도 중심도 제각각 */
      const WCOL = [0x9FE0EE, 0x7ECDE5, 0x62B9DA, 0x4CA6CB, 0x3E93BB];
      WCOL.forEach((c, i) => {
        const m = mk(wob(w / 2 + .8 - i * (w * .052), 44 - i * 3, .05 + i * .004, 1.7),
          M(c, .14 + i * .03, i < 2
            ? { transparent: true, opacity: i ? .92 : .72, metalness: .12 }
            : { metalness: .10 }),
          LAYER.field + i * .004);
        m.receiveShadow = i > 2;
      });
      /* 물가 거품선 — 물 겹보다 살짝 넓은 밝은 판을 **밑에** 깔면
         가장자리 0.35 만 테로 남습니다. 젖은 자리는 늘 밝습니다. */
      { const foam = new THREE.Mesh(wob(w / 2 + 1.15, 44, .05, 1.7),
          new THREE.MeshBasicMaterial({ color: 0xF0FBFD, transparent: true,
            opacity: .55, depthWrite: false }));
        foam.rotation.x = -Math.PI / 2;
        foam.position.set(x, LAYER.field - .002, z);
        foam.castShadow = false; foam.receiveShadow = false; g.add(foam); }
      /* 물결 — 넓고 흐린 띠 넷. index.html 의 시계가 천천히 돌립니다 */
      const rip = new THREE.MeshBasicMaterial({ color: 0xE8F7FC, transparent: true,
        opacity: .17, depthWrite: false });
      [[.30, .10, 0, 0], [.45, .07, 3.5, -2], [.19, .08, -4, 3], [.37, .05, -1, 5]]
        .forEach(([rr, wd, ox, oz], i) => {
          const ring = new THREE.Mesh(new THREE.RingGeometry(1 - wd, 1, 48), rip);
          ring.rotation.x = -Math.PI / 2;
          ring.scale.set(w * rr, d * rr, 1);
          ring.position.set(x + ox, LAYER.field + .026 + i * .002, z + oz);
          ring.castShadow = false; g.add(ring);
        });
      /* 바위 — 물가에 셋 */
      const rockM = M(0xB9B4A6, .9);
      [[-.42, .38, 1.2], [.46, .3, .9], [.1, -.5, 1.4]].forEach(([fx, fz, s2]) => {
        const r2 = new THREE.Mesh(new THREE.IcosahedronGeometry(s2, 0), rockM);
        r2.position.set(x + fx * w / 2, LAYER.field + s2 * .3, z + fz * d / 2);
        r2.scale.y = .6; r2.rotation.y = fx * 5;
        r2.castShadow = true; r2.receiveShadow = true; g.add(r2);
      });
      /* 수련 잎 — 진초록 원판 몇 */
      const lil = M(0x3E8C4A, .85);
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4, rr2 = .25 + (i % 3) * .11;
        const leaf = new THREE.Mesh(new THREE.CircleGeometry(.55 + (i % 2) * .25, 12), lil);
        leaf.rotation.x = -Math.PI / 2;
        leaf.position.set(x + Math.cos(a) * w * rr2, LAYER.field + .025, z + Math.sin(a) * d * rr2);
        leaf.castShadow = false; g.add(leaf);
      }
      /* ── 물가에 앉을 자리 ──
         캠퍼스에서 제일 예쁜 자리인데 벤치 하나 없었습니다. 걸어가면
         물을 보고 돌아 나오는 것이 전부라, 사람이 머물 이유가 없습니다.
         길이 닿는 북쪽 물가(모래톱 바깥 잔디)에 벤치 둘을 물을 보게
         놓습니다. 사이는 비워 둡니다 — 낚시터 자리가 거기입니다. */
      { const woodM = M(0xB07A4E, .82), woodD = M(0x8A5C36, .84);
        const bz = z - d / 2 - 4;
        for (const bx of [-7, 7]) {
          const px = x + bx;
          const seat = new THREE.Mesh(new THREE.BoxGeometry(3.4, .22, .9), woodM);
          seat.position.set(px, LAYER.field + .74, bz); seat.castShadow = true;
          seat.receiveShadow = true; g.add(seat);
          const back = new THREE.Mesh(new THREE.BoxGeometry(3.4, .86, .18), woodM);
          back.position.set(px, LAYER.field + 1.20, bz - .46); back.castShadow = true; g.add(back);
          for (const lx of [-1.35, 1.35]) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(.22, .62, .8), woodD);
            leg.position.set(px + lx, LAYER.field + .43, bz); leg.castShadow = true; g.add(leg);
          }
          solid(px, bz, 3.6, 1.5, 0);
        }
      }
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
/* ---- 부지 밖 숲 ----
   담이 있던 자리부터 바깥으로 나무를 채웁니다. 걸어서 못 가는 곳이라
   충돌도 길 검사도 필요 없습니다 — 자리만 고르면 됩니다.

   안쪽은 촘촘하고 바깥으로 갈수록 성기게 둡니다. 균일하게 채우면
   벽이 되고, 그러면 담을 나무로 바꾼 것에 지나지 않습니다. */
function outerWoods() {
  const trees = [];
  const inSiteBox = (x, z) => Math.abs(x) < SITE.hx + 4 && Math.abs(z) < SITE.hz + 4;
  for (let i = 0; i < 900; i++) {
    const a = rnd() * TAU;
    const r = 150 + Math.pow(rnd(), .65) * 165;        // 안쪽에 몰립니다
    const x = Math.cos(a) * r * 1.12, z = Math.sin(a) * r * .92;
    if (inSiteBox(x, z)) continue;
    if (Math.hypot(x / 1.12, z / .92) > 320) continue;
    /* 정문 앞은 비웁니다 — 문 밖이 바로 숲이면 문이 벽이 됩니다 */
    if (Math.abs(x) < 26 && z > SITE.hz) continue;
    trees.push({ x, z, s: 1.0 + rnd() * 1.1, kind: i % 3, ry: rnd() * TAU });
  }
  return trees;
}

function woods(g, avoid, built) {
  /* 길에서 얼마나 떨어져야 하는지 — 폭 절반에 여유 3.
     띠가 순환로를 물고 있어서, 안 보면 나무가 찻길 한복판에 섭니다. */
  const onRoad = (x, z) => {
    if (!built) return false;
    for (const r of built) {
      const n = 60, lim = r.w / 2 + 3;
      for (let i = 0; i <= n; i++) {
        const p = r.curve.getPointAt(i / n);
        if (Math.abs(p.x - x) < lim && Math.abs(p.z - z) < lim) return true;
      }
    }
    return false;
  };
  const trees = [];
  for (const w of WOODS) {
    /* 후보를 두 배 반으로 늘립니다. 띠가 순환로와 겹쳐 있어서 절반이
       길 위라고 걸러지는데, 전 계수(.022)로는 걸러지고 남는 것이
       열아홉 그루뿐이었습니다. 걸러내기는 그대로 두고 뿌리는 양을
       올리는 쪽이 맞습니다 — 자리를 손으로 고르면 다시 배치 문제가 됩니다. */
    const n = Math.round(w.r * w.r * .055);
    for (let i = 0; i < n; i++) {
      const a = rnd() * TAU, r = Math.sqrt(rnd()) * w.r;
      const x = w.x + Math.cos(a) * r, z = w.z + Math.sin(a) * r;
      if (Math.abs(x) > SITE.hx - 4 || Math.abs(z) > SITE.hz - 4) continue;
      if (avoid && avoid(x, z, 26)) continue;
      if (onRoad(x, z)) continue;
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
/* 담과 정문 구조물을 세우지 않습니다.

   담은 "여기까지가 캠퍼스" 를 말하려고 세웠는데, 실제로 읽히는 것은
   **게임 경계선**이었습니다. 어디를 봐도 같은 높이의 띠가 화면을
   가로지르고, 그 너머에 상자 도시가 서 있으니 세계가 거기서 끝난다는
   사실만 계속 말합니다.

   대신 숲으로 닫습니다. 나무는 경계를 **부드럽게** 만듭니다 — 시선이
   나무 사이로 계속 들어가다가 안개에 잠기므로 어디가 끝인지 눈이
   묻지 않습니다. 못 나가는 것은 그대로입니다(index.html 의 SITE_HX ·
   SITE_HZ 가 막습니다). 보이지 않을 뿐입니다.

   함수는 남깁니다 — 부르는 곳이 여럿이고, 되살릴 일이 생기면
   이 한 줄만 지우면 됩니다. */
function fence(g, solid) {
  /* 첫 줄이 `return;` 이라 담도 정문도 **하나도 안 서 있었습니다.**
     그래서 섬 가장자리가 잔디에서 그냥 잘렸고, 빠른 이동의 "정문" 은
     빈 포장길로 데려갔습니다. 왜 껐는지 적혀 있지 않아 되살립니다 —
     담 조각은 인스턴스 둘이고 충돌 상자는 반경 20 밖이면 건너뛰므로
     비용이 문제였을 자리는 아닙니다. */
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
  /* 학교 이름 — 회색 판만 걸어 두면 "아직 안 만든 간판" 입니다.
     parts.js 의 sign 은 캔버스에 글자를 굽고 웹폰트가 온 뒤 한 번 더
     굽습니다. 안팎 두 장 — 나갈 때도 문은 문이어야 합니다. */
  sign(gg, 'Deskfit', 0, 6.9, 1.0, 9.6, 1.7, '#3F6BA8', '#FFFFFF');
  sign(gg, 'Deskfit', 0, 6.9, -1.0, 9.6, 1.7, '#3F6BA8', '#FFFFFF').rotation.y = Math.PI;
}

/* ---- 담 밖 — 도시와 산 ---- */
/* 담 너머 도시를 세우지 않습니다.

   담 밖에 City Kit 건물 예순여덟 채와 실루엣 타워를 세워 두었습니다.
   지평선을 채우려던 것인데, 대학 캠퍼스 담 너머에 고층 도시가 붙어
   있으면 캠퍼스가 도심 한 블록으로 축소돼 보입니다. 게다가 안개를
   .0040 으로 낮춘 뒤로는 그것들이 **또렷하게** 보입니다.

   지평선은 숲과 안개가 맡습니다. */
function beyond(g) {
  return;
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
    /* 앞마당을 줄였습니다(+9/+11 → +4/+7). 건물이 스물여덟이 되면서
       판끼리 맞닿아 안뜰이 통째로 돌바닥이 됐습니다 — 잔디가 보여야
       안뜰이 방으로 읽힙니다. 문 앞에만 남기면 충분합니다. */
    slab(g, bw + 4, bd + 7, kerb, b.x, LAYER.courtKerb, b.z, -ry);
    slab(g, bw + 2.6, bd + 5.4, stone, b.x, LAYER.court, b.z, -ry);
  }
}

function annexes(g, solid, avoid) {
  const files = [].concat(KIT.CITY.small, KIT.CITY.wide);
  const spots = new Map();
  let i = 0;
  /* 부속동을 세우지 않습니다.

     City Kit 의 작은 상자들이었습니다. 대학 건물 사이에 3~4층짜리
     시내 건물이 끼어 있으면 그것만 다른 세계에서 온 것으로 보이고,
     크기가 작아 "미니미니한 장식" 이 됩니다. 대학에는 저런 크기의
     독립 건물이 거의 없습니다 — 있으면 부속 시설이라 본동에 붙습니다. */
  for (const [x, z] of []) {
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
  courts(g, solid);
  const trees = woods(g, avoid, built).concat(outerWoods());
  plantKitTrees(g, trees, solid);
  const allee = axisAllee(g, solid);
  props(g, built, solid, avoid);

  return { group: g, trees: trees.length + allee, roads: built.length, built, SITE, GATE };
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

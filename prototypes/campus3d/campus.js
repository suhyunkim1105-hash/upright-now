/* ══════════════════════════════════════════════════════════
   기린캠퍼스 야외.
   교수님 지적을 그대로 반영한 배치입니다 —
     · 호수 · 운동장 삭제
     · 가운데 표지판 삭제, 그 자리에 **동상 + 분수**
     · 도서관 · 본관을 메인으로 키움(1.22배)
     · 광장에서 문까지 5~9칸. 걷는 시간을 줄입니다.
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { M, roundedBox, cyl, prism, tree, bush } from './parts.js';
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

/* ══════════════════════════════════════════════════════════
   야외 구역 셋 — 운동장 · 호수 · 동아리 거리
   2D 판(prototypes/openworld)에는 있는데 여기만 없던 것들입니다.

   자리를 고르는 데 시간을 거의 다 썼습니다. 섬은 이미 꽉 차 있습니다 —
   광장 반지름 12, 건물 여섯이 19~27, 건물마다 16칸짜리 앞마당 돌판,
   광장에서 문까지 뻗은 대로 일곱, 그리고 반지름 30 을 도는 산책로.
   재어 보니 셋이 들어갈 만한 땅은 세 군데뿐이었습니다.

     · 북서 안쪽(φ225°, r21.7) — 대로가 안 지나가는 **유일한** 사분면입니다.
       가장 넓으니 가장 큰 것(트랙)이 갑니다.
     · 남서 바깥(φ135°, r35.4) — 산책로와 바다 사이 띠. 좁고 길어서
       못을 옆으로 눕히면 딱 맞고, 산책로가 그대로 물가 길이 됩니다.
     · 남동 바깥(φ67°,  r34.8) — 정문에서 나오면 오른쪽. 장은 원래 문
       옆에 섭니다. 남동 **안쪽**은 도서관 앞마당과 정문 대로가 다 먹었습니다.

   셋 다 **섬 둘레에 맞춰** 세웁니다 — 로컬 +x 는 접선, +z 는 섬 안쪽.
   섬이 원판이라 세계축으로 놓으면 구역마다 바다를 등지는 각도가 달라지는데,
   접선/안쪽으로 적으면 어느 각도로 옮겨도 앞뒤가 그대로고 충돌 상자도
   ry 하나로 끝납니다.
   ══════════════════════════════════════════════════════════ */

/* 구역이 차지하는 땅. 나무 · 잔디 얼룩 · 벚나무는 무작위로 뿌리는 것이라
   여기 적어 두지 않으면 트랙 한복판에 나무가 서고 못 위에 잔디가 뜹니다.
   실제 넓이보다 넉넉하게 잡습니다 — 가장자리에 나무가 반쯤 걸치는 것도
   구역 밖에서 보면 구역이 찌그러진 것으로 보입니다. */
export const ZONES = [
  { deg: 225, r: 21.7, a:  9.6, b: 8.2 },   // 운동장
  { deg: 135, r: 35.4, a: 11.5, b: 5.4 },   // 호수
  { deg:  67, r: 34.8, a: 10.5, b: 5.2 },   // 동아리 거리
];
export function inZone(x, z, pad = 0) {
  for (const Z of ZONES) {
    const A = Z.deg * Math.PI / 180, ca = Math.cos(A), sa = Math.sin(A);
    const dx = x - ca * Z.r, dz = z - sa * Z.r;
    const lx = -sa * dx + ca * dz, lz = -ca * dx - sa * dz;
    if ((lx / (Z.a + pad)) ** 2 + (lz / (Z.b + pad)) ** 2 < 1) return true;
  }
  return false;
}
/* 구역 그룹 — 로컬 +x 접선, +z 섬 안쪽 */
function zoneAt(g, deg, r) {
  const a = deg * Math.PI / 180;
  const p = new THREE.Group();
  p.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  p.rotation.y = -(a + Math.PI / 2);
  g.add(p);
  return p;
}
/* 로컬 좌표를 섬 좌표로. 충돌 상자는 buildCampus 가 섬 좌표로 들고 있어서
   넣기 전에 한 번 옮겨 줘야 합니다. */
function zoneXZ(deg, r, lx, lz) {
  const a = deg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  return [ca * r - sa * lx - ca * lz, sa * r + ca * lx - sa * lz];
}
const zoneRY = (deg) => -(deg * Math.PI / 180 + Math.PI / 2);

/* ---------- 야외용 둥근 상자 ----------
   parts.js 의 box 는 모서리를 늘 4마디로 깎습니다. 건물 여섯 채는 그래야
   합니다 — 벽 모서리가 0.12~0.18 이고 현관에서 코앞에 붙어 섭니다.
   야외는 사정이 다릅니다. 여기서 세우는 상자는 천 개가 넘는데 거의 다
   벤치 살 · 길 판 · 잔디 얼룩이고 모서리 반지름이 **2~7cm** 입니다.
   그 2cm 를 평면 여덟 마디 · 베벨 네 단으로 깎으면 조각 하나가 716면인데,
   화면에서 그 모서리는 픽셀 한둘입니다. 재어 보니 야외 삼각형 89만 중
   77만이 여기서 나왔습니다 — 한 군데 몰린 것이 아니라 전부가 이것입니다.

   그래서 마디를 **반지름에 맞춥니다**. 산울타리(0.38)처럼 실제로 둥근
   것만 전처럼 네 마디로 깎고, 손톱만 한 모서리는 한 마디로 끝냅니다.
   가로세로 높이는 그대로입니다(베벨이 늘 반지름만큼 밖으로 나가므로
   마디 수는 치수에 영향을 주지 않습니다). 실루엣은 그대로, 면수는 8분의 1. */
const boxGeos = new Map();
function box(p, w, h, d, r, mat, x, y, z) {
  /* 치수가 같으면 형상을 다시 만들지 않고 나눠 씁니다. 산책로 판이 일흔둘,
     벤치가 여덟 벌, 쓰레기통 살이 예순넷 — 똑같은 조각이 수십 개씩입니다.
     bake 가 어차피 복사해서 옮겨 붙이므로 나눠 써도 손해가 없고, 대신
     ExtrudeGeometry 를 천 번 삼각분할하던 시간이 없어집니다. */
  const key = w + ',' + h + ',' + d + ',' + r;
  let g = boxGeos.get(key);
  if (!g) {
    const rr = Math.min(r, w / 2, h / 2, d / 2);       // parts.js 가 자르는 값과 같습니다
    boxGeos.set(key, g = roundedBox(w, h, d, r, rr < .09 ? 1 : rr < .25 ? 2 : 4));
  }
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  p.add(m); return m;
}

/* 소품 한 벌에 이름표를 답니다.
   벤치 한 벌은 살 · 다리 · 등받이 열두 조각입니다. 배치를 눈으로 보고
   고치다가 화단 위에 선 벤치와 길 연석을 물고 있는 거치대를 놓쳤습니다 —
   조각 단위로는 아무것도 안 보이고, 소품 단위로 상자를 씌워 재야
   겹친 것 · 뜬 것 · 잠긴 것이 숫자로 나옵니다. 그리는 데는 안 쓰입니다. */
const prop = (p, kind) => { p.userData.prop = kind; return p; };

/* 바닥에 까는 판 — 타원 하나, 네모 하나.
   섬 잔디 윗면이 y=0.1 이라 그 위부터 씁니다. **겹치는 판은 반드시 높이를
   어긋나게** 받습니다. 같은 높이로 겹치면 카메라가 조금만 움직여도 어느
   면을 그릴지 뒤집혀 바닥이 껌뻑입니다 — 잔디 얼룩과 산책로에서 이미 한 번
   잡은 버그입니다. 여기서는 한 겹당 0.01 씩. */
function layEll(p, rx, rz, y, mat, seg = 56) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .1, seg), mat);
  m.position.y = y; m.scale.set(rx, 1, rz);
  m.castShadow = false; m.receiveShadow = true; p.add(m); return m;
}
function layBox(p, w, d, y, mat, x, z, ry = 0) {
  const m = box(p, w, .1, d, .04, mat, x, y, z);
  m.rotation.y = ry; m.castShadow = false; return m;
}

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
  /* 잔디 얼룩 — 한 색으로 두면 당구대입니다.

     **높이를 한 장씩 어긋나게 깝니다.** 전 판은 150장을 전부 y=0.04 에
     깔았는데, 자리가 무작위라 서로 겹치는 곳이 수십 군데였습니다. 겹친
     두 면의 깊이가 완전히 같으면 어느 쪽을 그릴지 카메라가 조금만 움직여도
     뒤집힙니다 — 걸을 때마다 잔디가 번쩍이던 것이 이것입니다. */
  for (let i = 0; i < 150; i++) {
    const a = rnd() * Math.PI * 2, r = 6 + rnd() * (HALF - 13);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x, z) < PLAZA_R + 2) continue;
    /* 구역 바닥은 구역이 직접 깝니다. 얼룩이 그 밑에 깔리면 판 가장자리
       마다 초록이 삐져나와 판이 잘려 보입니다. */
    if (inZone(x, z, 1.2)) continue;
    const w = 3 + rnd() * 6;
    flat(box(g, w, .14, w * (.6 + rnd() * .7), 1.4,
             M(rnd() < .5 ? PAL.grassDark : PAL.grassLight, .86), x, .04 + i * .0005, z));
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

/* ---------- 길 ----------
   깐 길을 **되돌려 줍니다**. 잔디에 무작위로 뿌리는 나무와 덤불이 길을
   피하려면 길이 어디 있는지 알아야 하는데, 각도와 폭을 뿌리는 쪽에 다시
   적어 두면 한쪽만 고쳐집니다. 실제로 덤불 아홉이 대로 한복판에 앉아
   있었습니다 — 흙길 위에 풀숲 하나가 있으면 심은 것이 아니라 떨어뜨린
   것으로 보입니다. */
function pathTo(g, x, z, w = 5.4) {
  const L = Math.hypot(x, z) - PLAZA_R + 1.5;
  if (L <= 0) return null;
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
  return { a, w, from: PLAZA_R - .7, to: PLAZA_R - .7 + L };
}

/* ---------- 둘레 산책로 ---------- */
function ringPath(g, r = 30, w = 4.0) {
  const seg = 72;
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const L = (Math.PI * 2 * r) / seg + .6;
    const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = -a; g.add(p);
    /* 칸끼리 0.6 씩 **겹치게** 놓습니다(안 그러면 다각형이라 틈이 벌어집니다).
       겹치는 두 면이 같은 높이면 그 자리가 통째로 떱니다 — 산책로 일흔두
       군데가 전부 그랬습니다. 한 칸씩 번갈아 아주 조금 올립니다. */
    const lift = (i % 2) * .0016;
    const b = box(p, L, .28, w, .5, M(PAL.path, .8), 0, .16 + lift, 0); b.castShadow = false;
    const e = box(p, L, .28, w - .9, .4, M(PAL.pathDark, .8), 0, .19 + lift, 0); e.castShadow = false;
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
  return prop(p, 'fountain');
}

/* 동상 — 기린이 서고 거북이가 발치에 앉습니다.
   전 판은 둘을 나란히 두고 색을 어둡게 해서 **갈색 덩어리 하나**로
   뭉쳤습니다. 키 차이를 크게 벌리고 청동을 밝게 올립니다. */
export function statue(g, x, y, z) {
  /* 동상 — 전 판은 다리·반점·발굽을 부품별로 붙인 "모형" 이라 멀리서
     지저분했고, 납작한 반점 구가 몸통과 같은 면에서 떨려 껌뻑거렸습니다.
     동상은 조각이므로 **면을 적게, 흐름을 하나로**: 목은 곡선 튜브 하나,
     몸은 캡슐 하나, 무늬는 붙이지 않습니다. 이야기는 자세가 말합니다 —
     거북이가 기린을 올려다봅니다. 느려도 끝까지 가는 쪽이 우리 편입니다. */
  const p = new THREE.Group(); p.position.set(x, y, z); g.add(p);
  const br = M(0xC9A45E, .3, { metalness: .45 });
  const brD = M(0xA9863F, .34, { metalness: .45 });

  /* 기린 — 몸통 캡슐 + 굽은 목 튜브 + 작은 머리 */
  const gi = new THREE.Group(); gi.position.set(-.14, 0, -.12); gi.rotation.y = .5; p.add(gi);
  [[-.24, -.2], [.24, -.2], [-.22, .24], [.22, .24]].forEach(([dx, dz]) =>
    cyl(gi, .09, .12, 1.1, 10, br, dx, .55, dz));
  { const body = new THREE.Mesh(new THREE.CapsuleGeometry(.34, .5, 6, 14), br);
    body.position.set(0, 1.32, .04); body.rotation.x = Math.PI / 2;
    body.castShadow = true; gi.add(body); }
  { const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.45, -.3), new THREE.Vector3(0, 2.0, -.52),
      new THREE.Vector3(0, 2.7, -.5), new THREE.Vector3(0, 3.15, -.3)]);
    const nk = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, .13, 10), br);
    nk.castShadow = true; gi.add(nk); }
  { const hd = new THREE.Mesh(new THREE.CapsuleGeometry(.15, .2, 6, 12), br);
    hd.position.set(0, 3.24, -.16); hd.rotation.x = 1.25; hd.castShadow = true; gi.add(hd);
    [-.08, .08].forEach((dx) => {
      cyl(gi, .022, .03, .16, 6, brD, dx, 3.44, -.26);
      const k = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), brD);
      k.position.set(dx, 3.52, -.26); gi.add(k);
    });
    [-.14, .14].forEach((dx) => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), br);
      e.position.set(dx, 3.3, -.3); e.scale.set(.4, .8, .6); gi.add(e);
    }); }
  { const tail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.42, .5), new THREE.Vector3(.06, 1.1, .72), new THREE.Vector3(.1, .84, .8)]),
      8, .035, 6), brD); gi.add(tail); }

  /* 거북이 — 매끈한 돔 + 위를 보는 머리 */
  const tu = new THREE.Group(); tu.position.set(1.15, 0, .72); tu.rotation.y = -.55; p.add(tu);
  { const sh = new THREE.Mesh(new THREE.SphereGeometry(.5, 22, 16, 0, Math.PI * 2, 0, Math.PI / 2), brD);
    sh.position.y = .3; sh.scale.set(1.06, .78, .9); sh.castShadow = true; tu.add(sh); }
  cyl(tu, .53, .56, .16, 22, br, 0, .24, 0);
  { const hd = new THREE.Mesh(new THREE.CapsuleGeometry(.13, .14, 6, 12), br);
    hd.position.set(0, .58, .56); hd.rotation.x = .7; hd.castShadow = true; tu.add(hd); }
  [[-.3, .34], [.3, .34], [-.3, -.32], [.3, -.32]].forEach(([dx, dz]) =>
    cyl(tu, .09, .11, .18, 8, br, dx, .1, dz));

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
    /* 팔은 90° 만 도는 토막입니다. 열넷이면 6.4° 마다 한 마디인데 팔 굵기가
       7.5cm 라 그 차이가 화면에 안 나옵니다. 여덟이면 11°, 그래도 곡선입니다.
       가로등이 스물여덟 개, 팔이 쉰여섯이라 마디 하나가 값이 셉니다. */
    const arm = new THREE.Mesh(new THREE.TorusGeometry(.62, .075, 6, 8, Math.PI / 2), met);
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
  return prop(p, 'lamp');
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
  return prop(p, 'bench');
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
    const h = new THREE.Mesh(new THREE.SphereGeometry(.17, 7, 5), M(c, .68));
    h.position.set(fx, .78, fz); h.scale.y = .6; h.castShadow = true; p.add(h);
    /* 꽃술은 반지름 6cm 이고 그나마 아래쪽 절반이 꽃잎 안에 들어가 있습니다 */
    const y = new THREE.Mesh(new THREE.SphereGeometry(.06, 5, 4), M(PAL.gold, .5));
    y.position.set(fx, .85, fz); p.add(y);
  }
  return prop(p, 'flowerBed');
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
  return prop(p, 'hedge');
}

/* ---------- 자전거 거치대 ---------- */
export function bikeRack(g, x, z, ry, n = 4) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
  box(p, n * 1.1 + .4, .18, 1.6, .06, M(PAL.stoneDark, .78), 0, .1, 0);
  for (let i = 0; i < n + 1; i++) {
    const dx = -n * .55 + i * 1.1;
    const a = new THREE.Mesh(new THREE.TorusGeometry(.4, .06, 6, 9, Math.PI), M(PAL.metal, .4));
    a.position.set(dx, .6, 0); p.add(a);
    [-1, 1].forEach((s) => cyl(p, .06, .06, .5, 6, M(PAL.metal, .4), dx + s * .4, .35, 0));
  }
  /* 자전거 둘 */
  [[-n * .28, -.3, PAL.red], [n * .3, .25, PAL.teal]].forEach(([dx, rz, c]) => {
    const b = new THREE.Group(); b.position.set(dx, 0, 0); b.rotation.y = rz; p.add(b);
    [-.62, .62].forEach((wx) => {
      const w = new THREE.Mesh(new THREE.TorusGeometry(.44, .07, 6, 14), M(0x3A3F4A, .6));
      w.position.set(wx, .46, 0); w.rotation.y = Math.PI / 2; b.add(w);
      cyl(b, .06, .06, .1, 8, M(PAL.metal, .35), wx, .46, 0).rotation.z = Math.PI / 2;
    });
    box(b, 1.2, .1, .1, .04, M(c, .5), 0, .78, 0);
    box(b, .1, .5, .1, .04, M(c, .5), -.3, .62, 0);
    box(b, .1, .62, .1, .04, M(c, .5), .5, .74, 0);
    box(b, .34, .1, .18, .05, M(0x3A3F4A, .5), -.28, .94, 0);
    box(b, .5, .08, .08, .03, M(0x3A3F4A, .5), .56, 1.06, 0);
  });
  return prop(p, 'bikeRack');
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
  return prop(p, 'board');
}

/* ---------- 쓰레기통 · 정자 · 야외 탁자 ---------- */
export function binOut(g, x, z) {
  const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
  cyl(p, .38, .32, .9, 16, M(0x4E6E5A, .6), 0, .45, 0);
  for (let i = 0; i < 8; i++) box(p, .1, .7, .06, .02, M(0x3E5C4A, .6),
    Math.cos(i / 8 * Math.PI * 2) * .34, .45, Math.sin(i / 8 * Math.PI * 2) * .34);
  cyl(p, .44, .44, .12, 16, M(PAL.metalDark, .5), 0, .96, 0);
  cyl(p, .3, .3, .06, 16, M(0x2A3A48, .5), 0, 1.02, 0);
  return prop(p, 'bin');
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
  return prop(p, 'picnic');
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
  return prop(p, 'gate');
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
  return prop(p, 'busStop');
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
  return prop(p, 'signpost');
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
  /* 천은 굽지 않고 밖으로 꺼내 둡니다 — 깃발이 안 움직이면 그건 깃발이
     아니라 장대에 붙인 판입니다. 움직이는 일은 index.html 이 합니다. */
  m.userData.noBake = true; p.userData.flag = m;
  const k = new THREE.Mesh(new THREE.SphereGeometry(.14, 10, 8), M(PAL.gold, .35));
  k.position.y = 6.24; p.add(k);
  return prop(p, 'flagPole');
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
  return prop(p, 'vend');
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
  return prop(p, 'stump');
}

/* ---------- 천막 ----------
   2D 는 뼈대와 천을 따로 구워 **천만** 바람에 눕혔습니다. 3D 도 같습니다 —
   천 그룹의 회전축을 용마루에 두면 회전 한 번으로 자락이 들리고, 기둥과
   판매대는 제자리에 있습니다. 파는 자리가 같이 흔들리면 장이 아니라
   천막이 무너지는 것으로 보입니다. */
function tentStall(p, x, z, ry, cloth, clothDark) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; p.add(g);
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) =>
    cyl(g, .085, .105, 2.5, 8, M(PAL.woodDark, .74), sx * 1.55, 1.25, sz * .72)));
  box(g, 3.3, .52, 1.15, .08, M(PAL.wood, .72), 0, 1.02, .4);          // 판매대
  box(g, 3.42, .12, 1.28, .05, M(0xC99A64, .68), 0, 1.32, .4);
  box(g, 3.3, .84, .12, .05, M(PAL.woodDark, .74), 0, .44, .95);
  /* 판 위에 물건이 없으면 장이 아니라 빈 천막입니다 */
  [[-1.05, PAL.teal], [-.35, PAL.gold], [.4, PAL.blue], [1.1, PAL.pink]].forEach(([gx, gc], i) =>
    box(g, .4, .32, .32, .06, M(gc, .6), gx, 1.54, .4 - (i % 2) * .28));
  /* 천 — 용마루가 그룹 원점에 오도록 지붕을 아래로 내려 답니다 */
  const cl = new THREE.Group(); cl.position.set(0, 3.25, 0); g.add(cl);
  cl.userData.noBake = true;
  prism(cl, 2.9, .95, 4.2, M(cloth, .78), 0, -.95, 0, .07).rotation.y = Math.PI / 2;
  box(cl, 4.4, .17, .19, .06, M(0x6B4423, .74), 0, -.02, 0);           // 용마루
  /* 자락 — 아래 가장자리가 물결이어야 천으로 읽힙니다.
     굽지 않는 그룹이라 조각 하나가 드로우콜 하나입니다. 다섯이면 물결로
     읽히고 여덟은 그냥 비쌉니다. */
  [-1, 1].forEach((sz) => {
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(.23, 8, 6), M(i % 2 ? cloth : clothDark, .78));
      b.position.set(-1.72 + i * .86, -.97, sz * 1.43); b.scale.set(1, .7, .6); cl.add(b);
    }
  });
  g.userData.cloth = cl;
  return prop(g, 'tent');
}

/* ---------- 운동장 ----------
   2D 의 paintTrack 을 그대로 옮깁니다 — 바깥 연석 · 우레탄 · 레인 선 ·
   인필드 · 잔디깎이 자국 · 출발선. 레인 선이 없으면 붉은 도넛입니다.
   트랙은 **밟고 다니는 것**이라 충돌 상자에 안 넣습니다. 넣는 것은
   깃대와 벤치뿐입니다. */
function trackField(g, ctx, deg, r, A, B) {
  const p = zoneAt(g, deg, r), ry = zoneRY(deg);
  const put = (lx, lz, w, d) => { const [x, z] = zoneXZ(deg, r, lx, lz); ctx.solid(x, z, w, d, ry); };
  const ure = M(0xBF563C, .88), ureAlt = M(0xB44F36, .88), lane = M(0xF0E7D8, .82);
  layEll(p, A + .55, B + .55, .10, M(0x7E8C6A, .86));          // 바깥 연석
  layEll(p, A, B, .11, ure);                                   // 우레탄
  /* 레인 — 흰 타원을 깔고 한 겹 안을 다시 우레탄으로 덮어 선만 남깁니다.
     2D 가 쓴 방법 그대로입니다. 선을 따로 그리면 타원 곡률이 안 맞습니다. */
  for (let k = 0; k < 4; k++) {
    const ax = A - .3 - k * .72, bz = B - .26 - k * .62;
    layEll(p, ax, bz, .12 + k * .02, lane);
    layEll(p, ax - .14, bz - .12, .13 + k * .02, k % 2 ? ureAlt : ure);
  }
  const IX = A - 3.1, IZ = B - 2.7;
  layEll(p, IX + .28, IZ + .28, .20, M(0xE8DFCB, .84));        // 안쪽 연석
  layEll(p, IX, IZ, .21, M(0x57A053, .84));                    // 인필드
  /* 잔디깎이 자국 — 이게 있어야 운동장이지, 없으면 초록 타원입니다 */
  for (let i = -3; i <= 3; i++) {
    const t = i / 3.6, w = Math.sqrt(Math.max(0, 1 - t * t));
    layBox(p, .46, IZ * 2 * w - .3, .22, M(0x8FD08A, .84), IX * t, 0);
  }
  layBox(p, .26, B - IZ - .5, .23, M(0xFFF6E8, .82), 0, (B + IZ) / 2);   // 출발선

  /* 깃대 둘 — 트랙 양 끝. 2D 도 트랙 목에 깃대를 세워 멀리서 "여기가
     운동장" 을 알렸습니다. 천은 바람에 눕습니다(ctx.flutter). */
  [[-(A + 1.3), 0x3F6BA8, 0], [A + 1.3, 0xE8735C, 1.7]].forEach(([lx, col, ph]) => {
    const fp = flagPole(p, lx, 0, col);
    ctx.flutter.push({ mesh: fp.userData.flag, phase: ph, amp: .17, axis: 'y' });
    put(lx, 0, 1.2, 1.2);
  });
  /* 벤치 넷 — 안쪽 둘 · 바깥 둘.
     안쪽 벤치를 트랙 모서리(로컬 x ±5)에 놓으면 광장 화단과 겹칩니다.
     가운데로 모으되 본관 앞마당 돌판 모서리에서도 떨어뜨립니다 —
     (-2.2, 7.1) 은 벤치 끝이 그 판에 25cm 올라타 있었습니다.
     바깥 둘은 연석 위에 얹혀 있었습니다(우레탄 타원은 로컬 x 가 커질수록
     빨리 좁아지므로, 트랙 목 쪽으로 옮기면 연석에서 떨어지면서도 산책로
     안쪽 잔디에 그대로 남습니다). */
  [[-1.8, B + 2.0, Math.PI], [1.8, B + 2.0, Math.PI],
   [-6.5, -(B - 1.3), 0], [6.5, -(B - 1.3), 0]].forEach(([lx, lz, br]) => {
    benchOut(p, lx, lz, br); put(lx, lz, 3.4, 1.2);
  });
  return p;
}

/* ---------- 호수 ----------
   2D 의 paintPond + LAKE + drawLakeLotus/Fish/Swan 을 옮깁니다.
   2D 가 못을 **곧은 네모**로 판 이유는 오토타일이 대각선에서 조각을 못
   물려서였습니다. 3D 에는 그 제약이 없으니 타원으로 팝니다 — 산책로와
   바다 사이 띠가 좁고 길어서 옆으로 누운 타원이 그 땅에 딱 맞고,
   덕분에 반지름 30 산책로가 그대로 물가 길이 됩니다.

   물은 못 건너야 합니다. 타원을 네모 여럿으로 근사해 충돌 상자에 넣되
   **낚시터 밑은 비웁니다** — 데크 위에 못 서면 그냥 물가에 놓인 그림입니다
   (2D 도 같은 이유로 데크를 anchor 0 으로 뒀습니다). */
function lakePond(g, ctx, deg, r, WA, WB) {
  const p = zoneAt(g, deg, r), ry = zoneRY(deg);
  const put = (lx, lz, w, d, rr = ry) => { const [x, z] = zoneXZ(deg, r, lx, lz); ctx.solid(x, z, w, d, rr); };
  const RA = WA + .85, RB = WB + .7;
  layEll(p, RA, RB, .10, M(PAL.stoneDark, .82));               // 돌 테
  layEll(p, RA - .38, RB - .32, .11, M(0x8E93A6, .8));
  layEll(p, WA, WB, .12, M(PAL.waterDeep, .3));                // 깊은 쪽 — 테두리 그늘
  layEll(p, WA - .3, WB - .24, .13, M(PAL.water, .22,
    { transparent: true, opacity: .84, emissive: 0x2A7C9E, emissiveIntensity: .1 }));

  /* 물 충돌 — 타원을 세로 슬래브 열넷으로 **내접**시킵니다. 바깥 모서리
     높이로 자르면 상자가 물 밖 잔디로 안 삐져나가고, 대신 양 끝에 얇게
     남는 틈은 사람 반지름(0.46)이 덮습니다. 가운데 가로 띠 하나를 더 얹어
     뾰족한 끝까지 막습니다. */
  const NS = 14, DECK_X = 1.3, DECK_Z = 1.15;
  for (let k = 0; k < NS; k++) {
    const u0 = -WA + (k * 2 * WA) / NS, u1 = u0 + (2 * WA) / NS;
    const uo = Math.max(Math.abs(u0), Math.abs(u1));
    const hz = WB * Math.sqrt(Math.max(0, 1 - (uo / WA) ** 2));
    if (hz < .25) continue;
    const uc = (u0 + u1) / 2;
    const zTop = Math.abs(uc) < DECK_X ? Math.min(hz, DECK_Z) : hz;   // 낚시터 밑은 비웁니다
    put(uc, (zTop - hz) / 2, u1 - u0, zTop + hz);
  }
  put(0, 0, WA * 1.96, 1.1);

  /* 연잎 · 물고기 · 백조 — 자리를 여기서 안 정합니다.
     2D 의 LAKE.at 과 같은 생각입니다: 상태를 안 들고 시각에서 바로 세면
     탭이 가려져 프레임을 건너뛰어도 돌아왔을 때 자리가 안 튑니다(그건 물
     위를 순간이동하는 것으로 보입니다). 여기서는 **떠 있는 것만 만들어
     내보내고** 매 프레임 옮기는 일은 index.html 이 합니다. */
  /* 도는 **중심**을 같이 내보냅니다. 중심이 없으면 모두가 못 한가운데를
     돌아서 백조 셋이 한 점에 겹칩니다. 그리고 처음 자리를 t=0 값으로
     미리 놓아 둡니다 — 배선 전에도, 첫 프레임에도 제자리에서 시작합니다. */
  const drift = (mesh, y0, arr, sp, rx, rz, ph, heading) => {
    mesh.userData.noBake = true;
    const cx = mesh.position.x, cz = mesh.position.z;
    mesh.position.set(cx + Math.cos(ph) * rx, y0, cz + Math.sin(ph * 1.61) * rz);
    arr.push({ mesh, y0, cx, cz, phase: ph, sp, rx, rz, heading: !!heading });
  };
  /* 연잎 넷 */
  [[-3.6, -.4, 0], [1.9, .55, 1.9], [-1.1, -.9, 3.4], [4.4, .25, 5.0]].forEach(([lx, lz, ph], i) => {
    const l = new THREE.Group(); l.position.set(lx, .21, lz); p.add(l);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(.52, .52, .06, 14),
      M(i % 2 ? 0x31994B : 0x2B8A45, .8));
    pad.castShadow = false; l.add(pad);
    const nt = new THREE.Mesh(new THREE.BoxGeometry(.5, .09, .17), M(0x176334, .8));
    nt.position.set(.3, .02, 0); l.add(nt);
    if (i % 2 === 0) {                                          // 꽃은 한 잎 걸러
      cyl(l, .045, .045, .22, 6, M(0x2B8A45, .8), -.1, .13, .08);
      const f = new THREE.Mesh(new THREE.SphereGeometry(.19, 10, 8), M(i % 4 ? 0xF49BC5 : 0xFFD36A, .66));
      f.position.set(-.1, .27, .08); f.scale.y = .8; l.add(f);
    }
    drift(l, .21, ctx.lotus, .10 + i * .013, .55, .3, ph, false);
  });
  /* 물고기 셋 — 물낯 바로 위에 납작하게. 2D 도 물 위에 그립니다 */
  [[-2.4, .8, .8], [3.2, -.7, 2.6], [.4, .9, 4.4]].forEach(([lx, lz, ph], i) => {
    const f = new THREE.Group(); f.position.set(lx, .20, lz); p.add(f);
    const bd = new THREE.Mesh(new THREE.SphereGeometry(.26, 10, 8), M(i ? 0xE8834A : 0xE8C24A, .6));
    bd.scale.set(1.5, .42, .8); f.add(bd);
    const tl = new THREE.Mesh(new THREE.ConeGeometry(.2, .34, 6), M(i ? 0xD06A34 : 0xD0A234, .6));
    tl.position.set(-.46, 0, 0); tl.rotation.z = Math.PI / 2; tl.scale.set(1, 1, .5); f.add(tl);
    drift(f, .20, ctx.fish, .19 + i * .04, 1.6, .7, ph, true);
  });
  /* 백조 셋 — 주기가 서로 안 맞아떨어져야(28초 · 37초 · 22초) 셋이 대형을
     짜고 도는 것으로 안 보입니다. 2D 가 고른 값을 그대로 씁니다. */
  [[.224, 3.4, 1.0, 0.0, -1.2, .1], [.170, 2.6, .85, 2.3, 1.6, -.3],
   [.286, 2.0, .6, 4.1, -3.0, .4]].forEach(([sp, rx, rz, ph, cx, cz]) => {
    const s = new THREE.Group(); s.position.set(cx, .30, cz); p.add(s);
    const wht = M(0xFFFFFF, .66);
    const bd = new THREE.Mesh(new THREE.CapsuleGeometry(.3, .34, 6, 12), wht);
    bd.rotation.z = Math.PI / 2; bd.castShadow = true; s.add(bd);
    const wg = new THREE.Mesh(new THREE.SphereGeometry(.34, 12, 9), wht);
    wg.position.set(-.06, .14, 0); wg.scale.set(1.1, .7, 1.15); wg.castShadow = true; s.add(wg);
    const nk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(.22, .16, 0), new THREE.Vector3(.5, .58, 0),
      new THREE.Vector3(.44, .86, 0), new THREE.Vector3(.66, .92, 0)]), 12, .085, 8), wht);
    nk.castShadow = true; s.add(nk);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), wht);
    hd.position.set(.7, .93, 0); s.add(hd);
    const bk = new THREE.Mesh(new THREE.ConeGeometry(.09, .3, 6), M(0xF0913A, .5));
    bk.position.set(.92, .9, 0); bk.rotation.z = -Math.PI / 2; s.add(bk);
    [-1, 1].forEach((sz) => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(.035, 6, 5), M(0x2A2320, .5));
      e.position.set(.79, .99, sz * .09); s.add(e);
    });
    drift(s, .30, ctx.swans, sp, rx, rz, ph, true);
  });

  /* ---- 물가 ----
     부들은 **물 밖**입니다(2D 의 판단 그대로). 물 안에 풀이 서 있으면
     사람이 쌓은 못이 아니라 내버려 둔 웅덩이가 됩니다. 밟고 지나갈 수
     있으니 충돌 상자에 안 넣습니다. */
  [[-6.2, WB + .45], [-4.4, WB + .95], [4.9, WB + .5], [6.6, WB + .9],
   [-5.6, -(WB + .55)], [5.9, -(WB + .45)]].forEach(([lx, lz], i) => {
    const rd = new THREE.Group(); rd.position.set(lx, 0, lz); p.add(rd);
    for (let k = 0; k < 5; k++) {
      const t = k / 5 * Math.PI * 2 + i, h = .95 + (k % 3) * .25;
      cyl(rd, .045, .06, h, 6, M(0x4E8F63, .8), Math.cos(t) * .28, h / 2 + .1, Math.sin(t) * .28);
      if (k % 2 === 0) {
        /* 이삭은 굵기가 7.5cm 입니다. 캡슐 마디를 반으로 줄여도 물가에서
           보이는 것은 갈색 막대기 하나로 똑같습니다. */
        const cat = new THREE.Mesh(new THREE.CapsuleGeometry(.075, .26, 3, 6), M(0x8A5A32, .78));
        cat.position.set(Math.cos(t) * .28, h + .28, Math.sin(t) * .28); rd.add(cat);
      }
    }
  });
  /* 벤치 둘 — 못 **양 끝** 잔디. 안쪽 물가는 산책로가 바로 붙어 있어서
     한 뼘도 안 남습니다. 돌 테 위에도 못 놓습니다: 테가 좁아 좌면이 그
     폭을 먹으면 못을 한 바퀴 도는 길이 거기서 끊깁니다. */
  [[-(RA + 1.2), Math.PI / 2], [RA + 1.2, -Math.PI / 2]].forEach(([lx, br]) => {
    benchOut(p, lx, 1.1, br); put(lx, 1.1, 1.2, 3.4);
  });
  /* 낚시터 — 안쪽 테에서 물 쪽으로 내민 널판. 서서 찌를 보는 자리이므로
     막지 않습니다(위 슬래브에서 이 폭만큼 비워 뒀습니다). */
  const dk = new THREE.Group(); dk.position.set(0, 0, (DECK_Z + RB) / 2); p.add(dk);
  for (let i = 0; i < 5; i++)
    layBox(dk, 2.3, .38, .14 + i * .008, M(i % 2 ? 0xA97A4C : 0xB98756, .76), 0, -.85 + i * .42);
  [-1, 1].forEach((s) => layBox(dk, 2.5, .13, .19, M(0x6B4A2E, .76), 0, s * 1.06));
  [-1, 1].forEach((s) => cyl(dk, .09, .09, .5, 8, M(0x5E5449, .8), s * 1.05, -.1, -.9));
  cyl(dk, .26, .21, .34, 12, M(0x8C99A6, .5), -.75, .35, .55);
  cyl(dk, .27, .27, .05, 12, M(0x465260, .5), -.75, .53, .55);
  { const rod = cyl(dk, .025, .035, 2.1, 6, M(0x6B4A2E, .7), .6, .8, -.5);
    rod.rotation.x = .95; rod.rotation.z = -.12; }
  return p;
}

/* ---------- 동아리 거리 ----------
   2D 는 천막 셋을 세워 놓고 여는 것이 하나도 없었고, 그래서 가게를 건물
   안으로 들여보내고 천막은 **가게 앞에 장이 선 표시**로 남겼습니다.
   여기도 같습니다 — 여는 것은 없고, 정문에서 걸어 들어오는 길 옆에
   천막 둘 · 게시판 둘 · 벤치 둘 · 파라솔이 한 줄로 섭니다.
   가운데 통로는 반드시 두 칸 넘게 비웁니다. 장터에서 못 지나가면
   그건 장이 아니라 바리케이드입니다. */
function clubStreet(g, ctx, deg, r) {
  const p = zoneAt(g, deg, r), ry = zoneRY(deg);
  const put = (lx, lz, w, d, rr = ry) => { const [x, z] = zoneXZ(deg, r, lx, lz); ctx.solid(x, z, w, d, rr); };
  /* 바닥 — 포석. 조각끼리 **안 겹치게** 틈을 두고 깔면 높이를 어긋낼 일이
     아예 없습니다. 밑판 둘과는 0.01 씩 띄웁니다. */
  layBox(p, 15.4, 6.8, .10, M(0x8E8471, .84), 0, 0);
  layBox(p, 14.8, 6.2, .11, M(0xC6BCA6, .84), 0, 0);
  for (let j = 0; j < 5; j++) for (let i = 0; i < 14; i++) {
    const x = -7.15 + i * 1.1 + (j % 2 ? .55 : 0), z = -2.4 + j * 1.2;
    if (Math.abs(x) > 7.2) continue;
    layBox(p, 1.0, 1.1, .12, M((i + j) % 3 ? 0xCBC2AC : 0xD3CAB5, .84), x, z);
  }
  /* 천막 둘 — 빨강은 옷, 노랑은 안내(2D 의 tentA · tentC 색 그대로).
     바다 쪽에 세워 산책로에서 오는 쪽을 마주 보게 합니다. */
  /* 포석은 잔디보다 7cm 높습니다. 그 위에 세우는 것은 다 그만큼 올려
     주지 않으면 기둥 밑동과 벤치 다리가 포석에 잠깁니다. */
  const up = (o) => { o.position.y = .07; return o; };
  [[-5.0, 0xE8695A, 0xB3392E, 0], [-.2, 0xE0AE3C, 0xA87A20, 2.1]].forEach(([lx, cl, cd, ph]) => {
    const t = up(tentStall(p, lx, -2.0, 0, cl, cd));
    ctx.flutter.push({ mesh: t.userData.cloth, phase: ph, amp: .075, axis: 'x' });
    put(lx, -2.0, 3.4, 1.3);
  });
  /* 게시판 둘 + 그 앞 벤치 둘 — 붙여서 "판 읽고 앉는 자리" 한 덩어리로
     만듭니다. 따로 세우면 거리 한복판에 벤치 둘이 떠 있습니다. */
  /* 오른쪽 짝은 2.4 에서 1.4 로 당깁니다 — 파라솔(반지름 1.9)이 게시판
     판을 뚫고 있었습니다. 천막 간격도 4.2 에서 4.8 로 벌렸습니다. */
  [-5.6, 1.4].forEach((lx) => {
    up(boardOut(p, lx, 2.5, Math.PI)); put(lx, 2.5, 3.8, 1.0);
    up(benchOut(p, lx, 1.3, Math.PI));  put(lx, 1.3, 3.4, 1.2);
  });
  /* 파라솔 탁자 — 거리 끝. 벤치가 등지고 앉는 자리라면 여기는 마주 앉는
     자리입니다. 장터에 있어야 하는 것은 앉는 자리가 아니라 같이 앉는
     자리입니다. 상자 깊이는 탁자까지만 재서 통로를 안 먹게 합니다. */
  up(picnicSet(p, 5.6, 1.8, .22)); put(5.6, 1.8, 2.8, 2.2);
  /* 나무 상자 — 판 옆이 비면 장이 아니라 천막 둘입니다 */
  [[3.2, -2.2, .3], [4.1, -1.9, -.5], [6.4, -2.1, .8]].forEach(([lx, lz, rr]) => {
    box(p, .8, .62, .8, .07, M(PAL.wood, .74), lx, .49, lz).rotation.y = rr;
    box(p, .84, .1, .84, .05, M(PAL.woodDark, .74), lx, .83, lz).rotation.y = rr;
    put(lx, lz, .95, .95);
  });
  /* 쓰레기통은 파라솔 탁자 의자에 붙어 있었습니다. 통로 쪽으로 내놓습니다. */
  up(binOut(p, 7.0, -.6));
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
  /* 움직이는 것 — 여기서는 **만들어 놓기만** 합니다. 매 프레임 옮기는 일은
     index.html 이 합니다(그쪽에 이미 시계와 프레임 루프가 있습니다).
     campus.js 가 자기 시계를 하나 더 들면 탭이 가려졌다 돌아왔을 때
     두 시계가 어긋나고, 그러면 백조가 물 위를 순간이동합니다. */
  const swans = [], lotus = [], fish = [], flutter = [];
  const ctx = { solid, swans, lotus, fish, flutter };

  /* 판 위에 세울 때 들어 올리는 높이.
     소품은 하나같이 바닥을 y=0 으로 잡고 만듭니다. 섬 잔디 윗면이 0.1 이라
     잔디에서는 발이 10cm 묻혀 자리를 잡는데, 돌판은 잔디보다 높아서 같은
     자리에 그냥 놓으면 그 차이만큼 통째로 박힙니다. 광장 벤치 여덟은
     다리가 다 잠겨 좌면이 바닥에 붙어 있었고(다리 없는 의자로 보입니다),
     건물 앞마당 벤치도 17cm 잠겨 있었습니다. 깐 판 높이만큼 올립니다. */
  const LIFT = { plaza: .28, pad: .17, street: .07 };
  /* 앞마당 돌판 위인가. 가장자리에서 0.7 안쪽까지만 "위" 로 봅니다 —
     연석에 걸친 채로 올리면 반대쪽이 뜨기 때문에, 걸친 것은 올릴 것이
     아니라 옮길 것입니다. */
  const onPad = (x, z) => BUILDINGS.some((b) => {
    const cx = b.x + Math.sin(b.ry) * (b.front + 1.2) * b.s * .5;
    const cz = b.z + Math.cos(b.ry) * (b.front + 1.2) * b.s * .5;
    const co = Math.cos(b.ry), si = Math.sin(b.ry), dx = x - cx, dz = z - cz;
    return Math.abs(co * dx - si * dz) < (b.w + 4) * b.s / 2 - .7
        && Math.abs(si * dx + co * dz) < (b.d + b.front + 4.5) * b.s / 2 - .7;
  });
  /* 이미 무언가 서 있는 자리인가.
     나무와 덤불은 무작위로 뿌리는데, 뿌릴 때 보는 것이 건물 · 길 · 구역뿐이라
     소풍 탁자 한가운데에서 나무가 자라고 파라솔 밑으로 덤불이 밀고 들어와
     있었습니다. 세운 것은 전부 충돌 상자를 남기므로 그 표를 그대로 봅니다 —
     소품 목록을 따로 만들면 하나 추가할 때마다 한쪽만 고쳐집니다.
     n 은 어디까지 볼지입니다 — 나무끼리 · 나무와 덤불은 서로 파고들어야
     수풀로 보이므로, 심기 시작하기 전까지의 상자만 봅니다.
     나무에 주는 여유가 2.6 인 것은 수관이 반지름 1.9 까지 퍼지기 때문입니다.
     밑동만 피하면 파라솔과 지붕 속으로 잎이 들어옵니다(덤불도 같은 이유로
     제 반지름에 0.6 을 더해 봅니다 — 소풍 파라솔이 상자보다 넓습니다). */
  const clearOfProps = (x, z, r, n = colliders.length) => !colliders.slice(0, n).some((c) => {
    const dx = x - c.x, dz = z - c.z;
    if (dx * dx + dz * dz > 400) return false;
    const co = Math.cos(c.ry || 0), si = Math.sin(c.ry || 0);
    return Math.abs(co * dx - si * dz) < c.w / 2 + r
        && Math.abs(si * dx + co * dz) < c.d / 2 + r;
  });
  /* 길 위인가 — 대로 일곱과 둘레 산책로. pathTo 가 깔면서 돌려준 표를 봅니다. */
  const paths = [];
  const layPath = (x, z, w) => { const q = pathTo(g, x, z, w); if (q) paths.push(q); };
  const onPath = (x, z, pad = 0) => {
    if (Math.abs(Math.hypot(x, z) - 30) < 2.1 + pad) return true;
    return paths.some((p) => {
      const t = x * Math.sin(p.a) + z * Math.cos(p.a);
      return t > p.from - pad && t < p.to + pad
          && Math.abs(x * Math.cos(p.a) - z * Math.sin(p.a)) < p.w / 2 + pad;
    });
  };

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
    /* 계단·현관 — 건물 몸통만 막으면 계단과 문을 **몸으로 뚫고** 들어갑니다.
       문 앞 한 칸(참여 반경)만 남기고 현관 폭을 막습니다. */
    { const sd = 1.55 * b.s;                        // 계단 깊이
      const scx = b.x + Math.sin(b.ry) * (b.d / 2 * b.s + sd / 2);
      const scz = b.z + Math.cos(b.ry) * (b.d / 2 * b.s + sd / 2);
      solid(scx, scz, 5.4 * b.s, sd, b.ry, false); }
    /* 들어가는 곳 — 문 앞 */
    const dd = (b.d / 2 + b.front) * b.s;
    portals.push({ x: b.x + Math.sin(b.ry) * dd, z: b.z + Math.cos(b.ry) * dd,
                   r: 2.6, zone: b.zone, name: b.name, sub: b.sub });
    layPath(b.x, b.z, b.key === 'library' || b.key === 'mainHall' ? 6.2 : 5.0);
  });

  /* --- 광장 한가운데 --- */
  /* ── 분수 충돌 ──
     여기에 10.6 x 10.6 **정사각형** 하나가 있었습니다. 분수는 둥근데
     막는 것은 네모라, 광장 네 귀퉁이가 통째로 막혔습니다. 그 결과
     ① 분수 앞에 설 수가 없어서 "거북이와 기린 상" 자리가 영영 안 열리고
     ② 시작 자리(5,5)가 그 네모 **안**이라 들어오자마자 끼어 있었습니다
        (unstick 이 매번 밀어내 주고 있었을 뿐입니다).

     여덟 조각으로 둥글게 두릅니다. 실제 물받이 반지름이 4.4 라 4.6 을
     안쪽 반지름으로 잡으면, 광장(반지름 12)에는 사람 다닐 폭이 7m
     넘게 남습니다. */
  fountain(g, 0, 0);
  {
    const RF = 4.6, SEG = 8;
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      const w = 2 * RF * Math.tan(Math.PI / SEG);
      /* big 을 안 줍니다 — big 은 **카메라도 막는** 표시입니다. 분수는
         허리 높이라 카메라가 그 위를 지나가야 합니다. */
      solid(Math.cos(a) * RF * .78, Math.sin(a) * RF * .78, w, RF * .62, -a, false);
    }
  }

  /* 광장 둘레 — 벤치 여덟 · 가로등 여덟 */
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const bx = Math.cos(a) * 9.2, bz = Math.sin(a) * 9.2;
    benchOut(g, bx, bz, -a + Math.PI / 2).position.y = LIFT.plaza;
    solid(bx, bz, 3.4, 1.2, -a + Math.PI / 2);
    /* 길이 45° 마다 뻗어 나가므로 가로등은 그 사이(22.5°)에 세웁니다.
       전 판은 길 한복판에 서서 카메라를 가로막았습니다.
       반지름은 13 에서 11.9 로 당겼습니다 — 13 은 돌판(12) 과 연석(12.7)
       걸침이라 밑동 한쪽이 7cm 짜리 턱에 얹혀 있었고, 그 자리는 화단
       가장자리이기도 했습니다. 판 안으로 들어오면 둘 다 없어집니다. */
    const la = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const lx = Math.cos(la) * 11.9, lz = Math.sin(la) * 11.9;
    lampPost(g, lx, lz).position.y = LIFT.plaza;
    solid(lx, lz, .9, .9);
  }
  /* 화단 여덟 — 전에는 광장에서 15.6 되는 띠에 고르게 돌려 놓았습니다.
     그 띠는 이미 가로등 · 게시판 · 이정표 · 건물 앞 벤치가 다 쓰고 있어서
     여덟 중 일곱이 무언가와 겹쳐 있었습니다. 벤치가 흙에 발을 담그고 있고,
     이정표가 꽃 사이에서 자라고, 가로등이 연석을 밟고 서 있었습니다.
     재어 보니 그 띠에 지름 4.3m 짜리 여덟이 들어갈 자리가 없습니다.
     그래서 지름을 줄이고 **건물 앞마당 돌판 위**로 옮깁니다 — 돌판 위
     화분은 그 자체로 제자리이고, 도서관 · 본관 · 학생회관 · 기숙사 넷의
     문 양옆에 둘씩 서니 띠에 흩어져 있을 때보다 오히려 누가 가꾸는 곳으로
     보입니다. */
  [[14.4, 6.0], [14.4, -6.0], [-14.4, 6.0], [-14.4, -6.0],
   [4.8, 17.0], [-4.8, 17.0], [4.8, -16.6], [-4.8, -16.6]].forEach(([x, z]) => {
    flowerBed(g, x, z, 1.2).position.y = LIFT.pad;
    solid(x, z, 2.9, 2.9);
  });
  /* 쓰레기통 — 광장 한가운데(반지름 8.4)에 있어서 시작하자마자 **내 몸을 가렸습니다**.
     길과 길 사이(22.5°)로 밀어내 가장자리에 둡니다. */
  [22.5, 112.5, 202.5, 292.5].forEach((deg) => {
    const a = deg * Math.PI / 180;
    binOut(g, Math.cos(a) * 10.4, Math.sin(a) * 10.4).position.y = LIFT.plaza;
  });

  /* --- 게시판 · 이정표 --- */
  boardOut(g, -8.6, 13.2, .5);  solid(-8.6, 13.2, 3.8, 1.0, .5, true);
  boardOut(g, 8.6, 13.2, -.5);  solid(8.6, 13.2, 3.8, 1.0, -.5, true);
  signpost(g, 5.0, 14.6, 0, [[PAL.blue, .4], [PAL.teal, 2.4], [PAL.gold, 4.2]]).position.y = LIFT.pad;
  /* 서쪽 이정표는 본관 앞마당 화단 **한가운데**에 서 있었습니다 — 기둥이
     흙을 뚫고 나오고 팔이 꽃 위를 지났습니다. 남쪽은 트랙이 반지름 27 까지
     차 있어 빈 잔디가 없으므로, 길이 갈라지는 북쪽으로 옮깁니다. */
  signpost(g, -16.0, 10.0, 0, [[PAL.red, 1.2], [PAL.blue, 3.4]]);

  /* --- 정문 · 버스 정류장 : 남동쪽 --- */
  gate(g, 20.5, 20.5, Math.PI / 4);
  solid(20.5 + 3.1, 20.5 - 3.1, 1.9, 1.9, 0, true); solid(20.5 - 3.1, 20.5 + 3.1, 1.9, 1.9, 0, true);
  camOnly(20.5, 20.5, 12.5, 2.6, Math.PI / 4);      // 정문 아치 — 사람은 통과, 카메라는 못
  /* 정류장은 둘레 산책로를 **가로질러** 서 있었습니다. 4.2m 폭 길에 4.8m
     짜리 상자가 놓여 길이 거기서 끊겼고, 기둥은 포석에 23cm 잠겼습니다.
     길 바깥으로 내놓고 길과 나란히 돌립니다 — 정류장은 원래 길가에 서고,
     말 거는 자리(26.5,15.5 · 반지름 3.4) 안에 그대로 들어옵니다. */
  busStop(g, 28.5, 16.7, 1.04);  solid(28.5, 16.7, 4.8, 2.0, 1.04, true);
  /* 거치대는 대로를 **가로질러** 서 있었습니다. 길과 직각이라 절반이 포장
     위, 절반이 잔디였고 그 턱만큼 자전거가 바닥에 잠겼습니다. 길과 나란히
     돌려 길 밖으로 뺍니다 — 자전거는 원래 길가에 나란히 세웁니다. */
  bikeRack(g, 14.4, 20.2, -Math.PI / 4, 5); solid(14.4, 20.2, 6.0, 1.8, -Math.PI / 4);
  /* 자판기 둘은 정류장 **안**에 박혀 있었습니다(파란 것은 유리벽을 뚫고
     의자에 걸쳐 있었습니다). 정류장 옆으로 나란히 내놓습니다. */
  vendOut(g, 22.7, 13.0, -Math.PI * .75, 0xE8695A);  solid(22.7, 13.0, 1.6, 1.1, -Math.PI * .75, true);
  vendOut(g, 23.9, 11.8, -Math.PI * .75, 0x3F6BA8); solid(23.9, 11.8, 1.6, 1.1, -Math.PI * .75, true);
  /* 정문에서 광장까지 대각선 길 */
  layPath(24, 24, 6.0);

  /* --- 야외 구역 셋 --- */
  /* 북서 — 운동장. 대로가 안 지나가는 유일한 사분면이라 가장 넓습니다. */
  trackField(g, ctx, 225, 21.7, 7.2, 5.5);
  /* 남서 — 호수. 산책로(r30)와 바다 사이 띠. 산책로가 곧 물가 길입니다. */
  lakePond(g, ctx, 135, 35.4, 7.2, 2.6);
  /* 남동 — 동아리 거리. 정문에서 나오면 오른쪽. */
  clubStreet(g, ctx, 67, 34.8);

  /* --- 북서 잔디마당 — 소풍 자리 --- */
  /* 소풍 자리는 트랙 **바깥**(산책로 너머)으로 밀립니다. 안쪽 셋 중
     (-26,-22) 만 남기고 나머지는 트랙 연석과 겹쳤습니다. */
  [[-26, -22, .3], [-20, -28, -.5], [-30, -29, .9]].forEach(([x, z, r]) => {
    picnicSet(g, x, z, r); solid(x, z, 2.8, 2.8, r);
  });
  /* 그루터기 의자는 (-24,-17) 에 있었는데 그 자리는 둘레 산책로 한복판이라
     길바닥에 통나무가 놓인 꼴이었고, 트랙 바깥 벤치와도 겹쳤습니다.
     트랙과 산책로 사이는 잔디가 한 뼘밖에 안 남아 옮길 데가 없어서
     북쪽 잔디마당으로 보냅니다 — 앉는 것이니 사람이 지나는 쪽이 낫습니다. */
  stumpSet(g, 8.5, 22.5);
  /* 깃대는 트랙이 자기 것으로 둘 세웁니다(trackField). 여기 있던 (-17,-13)
     은 트랙 인필드 한복판이라 뺍니다. 동쪽 짝은 그대로 둡니다. */
  flagPole(g, 17.7, -12.3, 0xE8735C).position.y = LIFT.pad;
  solid(17.7, -12.3, 1.2, 1.2);
  /* 산울타리도 (-24,-13) 짜리는 트랙을 가로질러 뺐습니다. 북쪽 것만 남깁니다. */
  hedge(g, -29.5, -18, 11, Math.PI / 2, 1.1); solid(-29.5, -18, 1.1, 11, 0, true);

  /* --- 남서 잔디마당 — 상점 앞 광장 ---
     거치대 · 벤치 하나 · 화단이 둘레 산책로(반지름 30, 폭 4.2)를 물고
     있었습니다. 거치대는 길에 반쯤 얹혀 자전거가 포석에 잠겼고 화단은
     아예 길 한가운데였습니다. 산책로는 섬을 한 바퀴 도는 길이라 여기서
     끊기면 바로 보입니다. 셋 다 길 안쪽(반지름 26 이내) 잔디로 당기고,
     나머지 벤치는 상점 앞마당 돌판 모서리에서 떼어 놓습니다. */
  bikeRack(g, -22.5, 12.5, .4, 4); solid(-22.5, 12.5, 5.0, 1.8, .4);
  benchOut(g, -10.2, 20.6, .6); solid(-10.2, 20.6, 3.4, 1.2, .6);
  benchOut(g, -8.6, 23.2, .9);  solid(-8.6, 23.2, 3.4, 1.2, .9);
  /* 화단 (-14,27) 은 뺐습니다. 산책로 한복판이었는데, 옮길 만한 잔디를
     재어 보니 상점 앞마당 돌판 · 학생회관 앞마당 돌판 · 산책로 셋이
     이 사분면을 다 나눠 가져서 지름 4.3m 가 온전히 들어가는 자리가
     남아 있지 않습니다. 광장 둘레 화단 여덟은 그대로 있습니다. */
  /* (-27,27) 소풍 자리는 호수 물 위였습니다. 못가에는 벤치를 놓았으니
     여기서는 뺍니다 — 어차피 걸어갈 수 있는 반지름(37.4) 밖이었습니다. */

  /* --- 기숙사 앞 · 학생회관 앞 --- */
  /* 서쪽 거치대는 트랙 동쪽 끝(깃대 자리)을 5칸이나 물고 있었습니다.
     기숙사 앞마당 돌판 안으로 당겨 붙입니다 — 세우는 곳이 포장 위라
     오히려 제자리를 찾은 셈이고, 북 대로(|x|<2.5)는 그대로 비어 있습니다. */
  /* 앞마당 물건은 **돌판 안으로 온전히** 들어가거나 아예 잔디로 나가야
     합니다. 걸쳐 있으면 판 두께(17cm)만큼 한쪽 발이 잠깁니다 — 벤치 넷과
     자판기가 전부 판 모서리에 걸려 있었습니다. 서쪽 거치대는 돌판 안으로
     더 들여 세로로 돌리고(가로로는 기숙사 대로를 물었습니다), 동쪽 거치대는
     잔디로 내보내 길가 가로등에서 떼어 놓습니다. */
  bikeRack(g, -5.5, -21, Math.PI / 2, 4).position.y = LIFT.pad;
  solid(-5.5, -21, 5.0, 1.8, Math.PI / 2);
  bikeRack(g, 10.4, -21.4, 0, 4);  solid(10.4, -21.4, 5.0, 1.8);
  benchOut(g, -8.6, -14.6, Math.PI); solid(-8.6, -14.6, 3.4, 1.2, Math.PI);
  benchOut(g, 8.6, -14.6, Math.PI);  solid(8.6, -14.6, 3.4, 1.2, Math.PI);
  vendOut(g, -7.8, 17, 0);  solid(-7.8, 17, 1.6, 1.1);
  benchOut(g, 8.6, 17, 0);  solid(8.6, 17, 3.4, 1.2);
  binOut(g, -5.6, 19.5).position.y = LIFT.pad;
  binOut(g, 5.6, -19.5).position.y = LIFT.pad;
  binOut(g, 21.5, 16.0);

  /* --- 도서관 · 본관 앞 --- */
  /* 여기 있던 화단 둘은 문 앞 대로 **한가운데**(z=0)에 앉아 있었습니다 —
     길에 심은 화단입니다. 앞마당에는 이제 광장 둘레 화단 둘이 대로 양옆에
     들어와 있으므로(위 표의 ±14.4, ±6.0) 겹쳐 놓지 않고 뺍니다.
     벤치는 (±16.5, ±6.5) 에서 (±17.6, ±5.6) 으로 옮깁니다: 앞의 자리는
     화단과 좌면이 맞닿고 길가 가로등과도 한 뼘이었습니다.
     가로등은 (±15.0, ±9.0) 에서 문 쪽(±3.9)으로 내립니다 — 본관 쪽
     (-15,-9) 은 트랙 우레탄 위였고(운동장 안에 가로등이 서 있었습니다),
     바깥쪽에 두면 길가 등 고리와 1.6 밖에 안 떨어져 등불끼리 파고듭니다. */
  [[-1, -17.6], [1, 17.6]].forEach(([sx, px]) => {
    benchOut(g, px, -5.6, sx > 0 ? -Math.PI / 2 : Math.PI / 2).position.y = LIFT.pad;
    solid(px, -5.6, 1.2, 3.4);
    benchOut(g, px, 5.6, sx > 0 ? -Math.PI / 2 : Math.PI / 2).position.y = LIFT.pad;
    solid(px, 5.6, 1.2, 3.4);
    lampPost(g, px - sx * 1.6, -3.9, 3.6).position.y = LIFT.pad;
    solid(px - sx * 1.6, -3.9, .9, .9);
    lampPost(g, px - sx * 1.6, 3.9, 3.6).position.y = LIFT.pad;
    solid(px - sx * 1.6, 3.9, .9, .9);
  });

  /* --- 길가 가로등 ---
     바깥 고리가 반지름 30 이었는데 그게 곧 산책로 **한복판**입니다.
     4.2m 폭 길 가운데 기둥이 여덟 개 서 있었고 충돌 상자까지 붙어 있어서
     걷다가 비켜 가야 했습니다. 길가 등은 길 옆에 섭니다 — 안쪽 가장자리
     밖(27.1)으로 내놓습니다. 안 고리도 21 에서 19.7 로 당겨 앞마당 돌판
     모서리 걸침을 없앱니다 — 21 은 도서관 · 본관 판 가장자리에서 밑동이
     1cm 삐져나가 그 턱에 얹혀 있었습니다. */
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    [19.7, 27.1].forEach((r) => {
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      lampPost(g, x, z, 3.8).position.y = onPad(x, z) ? LIFT.pad : 0;
      solid(x, z, .9, .9);
    });
  }

  /* --- 나무 --- */
  /* 섬에 나무만 260 그루입니다. 야외는 면수를 낮춘 판을 씁니다 —
     lod/seg 를 주면 tree() 가 갈래를 줄입니다. */
  /* 수관 마디는 건드리지 않았습니다. lod 9 · seg 11 로 낮춰 재 봤더니
     그루당 88면이 빠지는 대신 큰 나무(배율 1.8)의 윗선이 눈에 띄게
     각졌습니다. 나무는 이 섬에서 가장 여러 번 되풀이되는 윤곽이라
     여기서 각이 지면 섬 전체가 각져 보입니다. 9천 면을 포기합니다. */
  const TP = { trunk: PAL.trunk, leaf: PAL.leaf, lod: 11, seg: 13 };
  const nHard = colliders.length;      // 여기까지가 사람이 세운 것입니다
  /* 자리를 고르는 눈이 까다로워졌으므로(길 · 소품) 뽑는 횟수를 460 에서
     620 으로 올립니다. 심는 그루 수 상한(86)은 그대로라 면수는 안 늘고,
     빼기만 하면 섬이 휑해집니다. */
  const spots = [];
  const far = (x, z, m) => spots.every((p) => Math.hypot(p[0] - x, p[1] - z) > m);
  for (let i = 0; i < 620 && spots.length < 86; i++) {
    const a = rnd() * Math.PI * 2, r = 17 + rnd() * (HALF - 19);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    /* 건물 · 길 · 광장 위에는 안 심습니다 */
    if (BUILDINGS.some((b) => Math.hypot(b.x - x, b.z - z) < 14.5)) continue;
    if (Math.hypot(x, z) < 17) continue;
    if (Math.abs(Math.hypot(x, z) - 30) < 3.8) continue;          // 산책로 위
    if (inZone(x, z, 1.0)) continue;                              // 운동장 · 호수 · 동아리 거리
    if (Math.hypot(x - 20.5, z - 20.5) < 12) continue;            // 정문 앞
    if (onPath(x, z, 1.2)) continue;                              // 대로 일곱 · 산책로
    const ang = Math.atan2(z, x);
    const near = BUILDINGS.some((b) => Math.abs(
      ((Math.atan2(b.z, b.x) - ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < .16);
    if (near && Math.hypot(x, z) < 30) continue;
    if (!clearOfProps(x, z, 2.6, nHard)) continue;                 // 세워 둔 소품 위
    if (!far(x, z, 4.6)) continue;
    spots.push([x, z]);
  }
  /* 나무는 밑동이 로컬 y=0.125 에서 시작합니다(parts.js). 배율을 곱하면
     큰 나무는 그 값이 0.22 가 되는데 잔디 윗면은 0.1 이라, 그냥 놓으면
     지름 40cm 짜리 기둥이 땅에서 12cm 떠 있습니다 — 백 그루가 전부
     그랬습니다. 배율만큼 내려서 밑동을 잔디 속에 묻습니다. */
  const root = (s) => .04 - .125 * s;
  spots.forEach(([x, z], i) => {
    const s = .85 + rnd() * .75;
    tree(g, { ...TP, leaf: i % 4 === 0 ? PAL.leafDeep : PAL.leaf }, x, z, s).position.y = root(s);
    solid(x, z, 1.0 * s, 1.0 * s);
    /* 나무 옆 덤불도 길을 밟으면 안 됩니다. 크기는 먼저 뽑아 둡니다 —
       난수를 건너뛰면 그 뒤 자리가 통째로 밀립니다. */
    const bs = .6 + rnd() * .5;
    if (i % 3 === 0 && !onPath(x + 1.6, z + 1.1, .8) && clearOfProps(x + 1.6, z + 1.1, bs + .6, nHard))
      bush(g, TP, x + 1.6, z + 1.1, bs);
  });
  /* 바깥 테두리 숲 — 섬의 끝.
     한 줄로 고르게 심었더니 **울타리**로 보였습니다. 두 겹으로 어긋나게. */
  const GATE_A = Math.atan2(20.5, 20.5);
  for (let i = 0; i < 168; i++) {
    const a = (i / 168) * Math.PI * 2 + (rnd() - .5) * .05;
    /* 정문 부채꼴은 비웁니다 — 문 바로 뒤에 숲이 서 있으면 문이 아니라 벽입니다 */
    if (Math.abs(((a - GATE_A + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < .34) continue;
    const r = HALF - 2.0 - rnd() * 5.0;
    const tx = Math.cos(a) * r, tz = Math.sin(a) * r;
    /* 건물 등 뒤도 비웁니다 — 지붕에 수관이 겹치면 벽에 나무가 박힌 것처럼 보입니다 */
    if (BUILDINGS.some((b) => Math.hypot(b.x - tx, b.z - tz) < 11.5)) continue;
    /* 바깥 숲은 반지름 33~38 인데 호수와 동아리 거리가 바로 그 띠에
       있습니다. 안 비우면 못 한가운데에서 나무가 자랍니다. */
    if (inZone(tx, tz, 1.4)) continue;
    if (onPath(tx, tz, 1.0)) continue;
    if (!clearOfProps(tx, tz, 2.6, nHard)) continue;
    const pink = i % 11 === 0;
    const ts = 1.0 + rnd() * .8;
    tree(g, { ...TP, leaf: pink ? 0xF7B8CE : PAL.leafDeep, trunk: PAL.trunk }, tx, tz, ts)
      .position.y = root(ts);
    const bx = Math.cos(a) * (r - 3.4), bz = Math.sin(a) * (r - 3.4), bs = .6 + rnd() * .6;
    if (i % 3 === 0 && !onPath(bx, bz, .8) && clearOfProps(bx, bz, bs + .6, nHard)) bush(g, TP, bx, bz, bs);
  }
  /* 덤불 흩뿌리기 — 길과 소품을 피하게 했더니 아흔 번 뿌려 서른 개만
     남았습니다(전에는 쉰여덟). 자리 고르는 눈이 까다로워진 만큼 뿌리는
     횟수를 늘려 잔디 밀도를 전 판만큼 되돌립니다. */
  for (let i = 0; i < 180; i++) {
    const a = rnd() * Math.PI * 2, r = 18 + rnd() * (HALF - 21);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (BUILDINGS.some((b) => Math.hypot(b.x - x, b.z - z) < 11)) continue;
    if (inZone(x, z, 1.0)) continue;
    const bs = .55 + rnd() * .6;
    /* 대로와 산책로는 비웁니다. 흙길 한복판에 덤불 하나가 앉아 있으면
       심은 것이 아니라 떨어뜨린 것으로 보입니다 — 아홉 개가 그랬습니다. */
    if (onPath(x, z, .9)) continue;
    if (!clearOfProps(x, z, bs + .6, nHard)) continue;
    bush(g, TP, x, z, bs);
  }

  /* 벚꽃 — 길 양옆에만. 캠퍼스에서 사진 찍는 자리입니다 */
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    [-1, 1].forEach((s2) => {
      const x = Math.cos(a) * 24 + Math.cos(a + Math.PI / 2) * s2 * 4.2;
      const z = Math.sin(a) * 24 + Math.sin(a + Math.PI / 2) * s2 * 4.2;
      if (BUILDINGS.some((b) => Math.hypot(b.x - x, b.z - z) < 12.5)) return;
      if (Math.hypot(x - 20.5, z - 20.5) < 11) return;
      if (inZone(x, z, .8)) return;                 // 트랙 인필드에 벚나무가 섰었습니다
      if (onPath(x, z, 1.0)) return;
      if (!clearOfProps(x, z, 2.0, nHard)) return;
      tree(g, { trunk: 0x9E6A48, leaf: 0xF7B8CE, lod: 11, seg: 13 }, x, z, 1.05)
        .position.y = root(1.05);
      solid(x, z, 1.0, 1.0);
    });
  }

  /* 움직이는 것들을 밖으로 내보냅니다 — 배열만 주고 끝냅니다.
     항목 하나가 들고 있는 것:
       swans / lotus / fish  { mesh, y0, cx, cz, phase, sp, rx, rz, heading }
         mesh 는 **호수 그룹의 자식**이라 자리는 전부 못 로컬 좌표입니다.
         한 프레임에 이렇게 옮기면 2D 판(LAKE.at)과 같은 궤적이 나옵니다 —
           const a = t * sp + phase;
           mesh.position.x = cx + Math.cos(a) * rx;
           mesh.position.z = cz + Math.sin(a * 0.61 + phase) * rz;
           mesh.position.y = y0 + Math.sin(t * 1.3 + phase) * 0.03;
           if (heading) mesh.rotation.y = Math.sin(a) < 0 ? 0 : Math.PI;
             (모형이 +x 를 보고 서 있습니다. x 의 도함수는 -sin a 이니
              sin a < 0 이면 +x 쪽으로 갑니다. 젓는 쪽과 보는 쪽이 다르면
              그건 헤엄이 아니라 미끄러짐입니다.)
         x 는 코사인, z 는 주기를 0.61 배로 어긋낸 사인입니다. 둘의 주기가
         같으면 타원 한 바퀴라 시계 바늘처럼 읽혀서, 정처 없이 떠다니는
         것으로 안 보입니다. 처음 자리는 여기서 t=0 값으로 이미 놓았습니다.
       flutter               { mesh, phase, amp, axis }
         천막 천(axis 'x' — 축이 용마루라 자락이 들립니다)과 깃발
         (axis 'y' — 축이 장대입니다). mesh.rotation[axis] =
         Math.sin(t * 1.7 + phase) * amp 면 충분합니다. */
  return { group: g, colliders, portals, HALF, PLAZA_R, swans, lotus, fish, flutter };
}

/* ══════════════════════════════════════════════════════════
   바깥 캠퍼스 — 섬을 대학으로

   왜 이 파일이 생겼나
   ------------------
   전 판은 **반지름 40 짜리 섬**이었습니다. 둘레가 바다라서 눈이 끝을
   바로 찾고, 끝이 보이면 세계가 작아집니다. 그리고 대학은 섬이 아닙니다 —
   대학은 **담이 있고, 정문이 있고, 담 너머에 도시가 있는 곳**입니다.

   그래서 안쪽(반지름 40)은 **한 칸도 안 건드리고** 그 바깥을 채웁니다.
   광장·건물 여섯·앞마당·대로는 이미 "광장에서 문까지 5~9칸" 으로
   맞춰 둔 것이라, 그걸 흔들면 걷는 시간이 다시 길어집니다.

     안쪽  r ≤ 40    campus.js — 손대지 않음
     바깥  r 40~132  이 파일
     너머  r > 132   안개에 잠긴 실루엣

   커 보이게 만드는 세 가지 (A Short Hike 에서 배운 순서)
   ------------------------------------------------
   1. **끝을 숨긴다** — 바다 대신 담과 안개. 눈이 끝을 못 찾습니다
   2. **축을 만든다** — 정문에서 광장까지 뻗은 대로 하나. 멀리 보이는
      소실점이 거리를 만듭니다. 실제 대학이 다 이렇게 생겼습니다
   3. **너머를 보여 준다** — 담 밖에 도시 실루엣. 상자 몇 개인데
      세계가 이어져 보입니다

   비용을 어떻게 감당하나
   -------------------
   바깥은 안쪽보다 열 배 넓습니다. 여기 나무를 하나씩 Mesh 로 심으면
   드로우콜이 그대로 열 배가 됩니다. 그래서 바깥의 반복물(나무·가로등·
   덤불)은 전부 **InstancedMesh** 입니다 — 나무 420 그루가 드로우콜
   두 개입니다(줄기 하나, 잎 하나).
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { M } from './parts.js';

/* 씨 고정 난수 — 새로 고칠 때마다 나무 자리가 바뀌면 안 됩니다.
   campus.js 와 다른 씨를 씁니다(같은 씨를 나눠 쓰면 한쪽 개수를 바꿀 때
   다른 쪽 배치가 통째로 흔들립니다). */
let _s = 20260824;
const rnd = () => (_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const TAU = Math.PI * 2;

/* 정문 방향 — campus.js 의 기존 정문 각도(45°)를 그대로 잇습니다.
   여기서 축이 어긋나면 안쪽 대로와 바깥 대로가 따로 놉니다. */
export const GATE_A = Math.atan2(20.5, 20.5);
const GX = Math.cos(GATE_A), GZ = Math.sin(GATE_A);

export const OUTER = {
  core: 40,        // campus.js 가 쓰던 반지름. 이 안은 안 건드립니다
  wall: 128,       // 담
  gate: 118,       // 정문
  far: 132,        // 걸어갈 수 있는 끝
};

const PAL2 = {
  lawn:      0x6FC85E,
  lawnDark:  0x57B04A,
  lawnLight: 0x86D46E,
  walk:      0xF0D49A,
  walkDark:  0xDCB87C,
  road:      0xD9D3C4,
  roadEdge:  0xF7F1E2,
  wall:      0xE8DFC8,
  wallCap:   0xC9BFA4,
  brick:     0xC98A63,
  trunk:     0x8E5A33,
  leaf:      0x53B84E,
  leafDeep:  0x3C9440,
  leafWarm:  0x7FC85A,
  metal:     0x9BA6B2,
  lampPost:  0x5E6A70,
  lampHead:  0xFFF3D0,
  city:      0x93A8BC,
  cityFar:   0xA9BCCC,
};

/* 평평한 판 하나. 바닥에 눕히고 그림자는 받기만 합니다. */
function slab(p, w, d, mat, x, y, z, dir = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  /* dir = 판의 **세로(d) 축이 향할 방향**, XZ 평면에서 atan2(z, x) 기준.
     눕힌 판의 로컬 +Y 는 세계 -Z 로 가므로 yaw 는 -(dir + 90°) 입니다. */
  m.rotation.order = 'YXZ';
  m.rotation.y = -(dir + Math.PI / 2);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.castShadow = false;
  m.receiveShadow = true;
  p.add(m);
  return m;
}

/* ══════════════════════════════════════════════════════════
   1. 바닥 — 잔디, 대로, 사각 잔디밭

   안쪽 잔디(campus.js)가 y=0.1 에 있으므로 그 아래에 깝니다. 겹치는
   판은 반드시 높이를 어긋나게 둡니다 — 깊이가 완전히 같으면 카메라가
   조금만 움직여도 어느 쪽을 그릴지 뒤집혀서 바닥이 번쩍입니다.
   (campus.js 가 잔디 얼룩에서 이미 겪은 문제입니다.)
   ══════════════════════════════════════════════════════════ */
function groundRing(g) {
  const flat = (m) => { m.castShadow = false; return m; };

  /* 바깥 잔디 — 원판 하나. 안쪽 잔디보다 3mm 낮게 깔아 z-fighting 을 피합니다. */
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(OUTER.far, 96),
    M(PAL2.lawn, .88));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = .097;
  disc.castShadow = false;
  disc.receiveShadow = true;
  g.add(disc);

  /* 잔디 얼룩 — 넓은 원판을 한 색으로 두면 당구대입니다.
     안쪽(campus.js)이 이미 채운 r<40 은 건너뜁니다. */
  /* 색 차이를 크게 두면 얼룩이 **무늬**가 되어 눈에 걸립니다.
     잔디는 "한 색이 아니다" 정도만 말하면 됩니다. 두 색을 원본 잔디
     쪽으로 당겨 대비를 낮췄습니다. */
  /* 대비를 더 낮춥니다. 12각형 원판은 가까이서 각이 보였고, 색이
     세면 얼룩이 무늬가 됩니다. 24각 + 바탕(0x6FC85E)에 바짝 붙인 두 색. */
  const blotA = M(0x6AC259, .9), blotB = M(0x74CB61, .9);
  for (let i = 0; i < 150; i++) {
    const a = rnd() * TAU;
    const r = OUTER.core + 4 + rnd() * (OUTER.wall - OUTER.core - 12);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const w = 6 + rnd() * 18;
    const m = new THREE.Mesh(new THREE.CircleGeometry(w / 2, 24), rnd() < .5 ? blotA : blotB);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(1, .55 + rnd() * .8, 1);
    m.position.set(x, .1 + i * .0006, z);
    m.castShadow = false; m.receiveShadow = true;
    g.add(m);
  }
  return disc;
}

/* ---- 대로 ----
   정문에서 광장까지 뻗은 축 하나가 이 캠퍼스의 척추입니다.
   길 자체보다 **길이 만드는 소실점**이 거리를 만듭니다. */
function boulevards(g, solid) {
  const roadM = M(PAL2.road, .92);
  const edgeM = M(PAL2.roadEdge, .86);

  /* 축 위에 길게 눕힌 판 하나. 회전은 판을 눕힌 뒤 z 축으로 겁니다. */
  const lane = (ang, from, to, w) => {
    const mid = (from + to) / 2, len = to - from;
    const x = Math.cos(ang) * mid, z = Math.sin(ang) * mid;
    /* 눕힌 판의 로컬 y 가 세계의 -z 이므로, 각도를 그대로 z 회전에 넣으면
       길이 축과 90° 어긋납니다. -ang 을 넣어야 길이가 반지름 방향입니다. */
    slab(g, w + 1.5, len, edgeM, x, .104, z, ang);
    slab(g, w, len, roadM, x, .108, z, ang);
  };

  /* 정문 대로 — 가장 길고 넓습니다 */
  lane(GATE_A, OUTER.core - 6, OUTER.gate, 9);
  /* 나머지 세 방향 — 십자로. 실제 캠퍼스의 격자를 흉내 냅니다 */
  lane(GATE_A + Math.PI / 2, OUTER.core - 4, OUTER.wall - 14, 6);
  lane(GATE_A + Math.PI,     OUTER.core - 4, OUTER.wall - 14, 6);
  lane(GATE_A - Math.PI / 2, OUTER.core - 4, OUTER.wall - 14, 6);

  /* 둘레 순환로 — 대로 넷을 잇습니다. 얇은 판을 각도로 쪼개 깝니다 */
  const RR = 92, SEG = 64;
  for (let i = 0; i < SEG; i++) {
    const a = (i / SEG) * TAU;
    const x = Math.cos(a) * RR, z = Math.sin(a) * RR;
    const arc = (TAU / SEG) * RR * 1.08;
    /* 순환로 조각은 길이가 **접선** 방향입니다 */
    slab(g, 5, arc, roadM, x, .106, z, a + Math.PI / 2);
  }
}

/* ---- 사각 잔디밭(quad) ----
   대학이 섬과 갈리는 지점입니다. 섬은 둥글고, 대학은 **네모난 잔디밭을
   건물이 둘러싼 모양**입니다. 여기서는 건물을 더 세우지 않고 낮은
   울타리와 나무로 네모를 만듭니다 — 기하가 거의 안 듭니다. */
/* 건물 사이에 눕히는 사각 잔디밭.
   전 판은 반지름 66~74 에 나무로 둘러싼 마당을 뒀는데, 이제 그 자리가
   건물 자리입니다. 건물이 없는 각도에만, 그리고 **건물보다 안쪽**에
   깝니다 — 실제 대학의 앞마당이 그 자리에 있습니다. */
function quads(g, solid, pushTree) {
  const QUADS = [
    { r: 40, a: GATE_A + Math.PI * .50, w: 26, d: 18 },
    { r: 40, a: GATE_A + Math.PI * 1.50, w: 26, d: 18 },
    { r: 66, a: GATE_A + Math.PI * .511, w: 24, d: 18 },
    { r: 66, a: GATE_A + Math.PI * 1.489, w: 24, d: 18 },
  ];
  const kerb = M(PAL2.roadEdge, .84);
  const lawn = M(PAL2.lawnLight, .9);

  for (const q of QUADS) {
    const cx = Math.cos(q.a) * q.r, cz = Math.sin(q.a) * q.r;
    const ry = q.a;
    slab(g, q.w + 2.4, q.d + 2.4, kerb, cx, .112, cz, ry);
    slab(g, q.w, q.d, lawn, cx, .116, cz, ry);
    /* 마당 세로(d)가 반지름 방향을 보게 둡니다 — 대로에서 보면
       네모의 짧은 변이 정면으로 옵니다. */

    /* 네 변에 나무를 줄 세웁니다. 줄이 곧 "이 안은 마당" 이라는 표시입니다 */
    const co = Math.cos(q.a), si = Math.sin(q.a);
    const put = (lx, lz) => pushTree(cx + co * lx - si * lz, cz + si * lx + co * lz,
                                     .95 + rnd() * .35, 0);
    /* 네 변을 다 두르면 울타리가 됩니다. **긴 두 변에만** 세웁니다 —
       마당이 열려 있어야 가로질러 걸을 수 있고, 그게 대학 잔디밭입니다. */
    const nx = Math.max(3, Math.round(q.w / 9));
    for (let i = 0; i <= nx; i++) {
      const lx = -q.w / 2 + (q.w / nx) * i;
      put(lx, -q.d / 2 - 2.4);
      put(lx,  q.d / 2 + 2.4);
    }
  }
}

/* ══════════════════════════════════════════════════════════
   2. 담과 정문 — 끝을 숨기는 것

   바다는 "여기가 끝" 이라고 말합니다. 담은 "여기부터 남의 땅" 이라고
   말합니다. 같은 경계인데 뒤쪽이 훨씬 넓게 느껴집니다.
   ══════════════════════════════════════════════════════════ */
function wallAndGate(g, solid) {
  const wallM = M(PAL2.wall, .9);
  const capM = M(PAL2.wallCap, .86);
  const brickM = M(PAL2.brick, .82);

  const R = OUTER.wall;
  const SEG = 96;
  const gapHalf = .085;                 // 정문 부채꼴은 비웁니다

  /* 담은 한 덩어리로 만들 수 없습니다(원호라서). 조각 96개인데 전부
     같은 재질이라 인스턴스로 묶습니다 — 드로우콜 하나입니다. */
  const segLen = (TAU / SEG) * R * 1.06;
  const bodyG = new THREE.BoxGeometry(segLen, 2.1, .55);
  const capG = new THREE.BoxGeometry(segLen, .22, .78);
  const keep = [];
  for (let i = 0; i < SEG; i++) {
    const a = (i / SEG) * TAU;
    const d = Math.abs(((a - GATE_A + Math.PI * 3) % TAU) - Math.PI);
    if (d < gapHalf) continue;          // 정문 자리
    keep.push(a);
  }
  const body = new THREE.InstancedMesh(bodyG, wallM, keep.length);
  body.userData.noBake = true;
  const cap = new THREE.InstancedMesh(capG, capM, keep.length);
  cap.userData.noBake = true;
  body.castShadow = true; body.receiveShadow = true;
  cap.castShadow = true; cap.receiveShadow = true;
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
  const eul = new THREE.Euler();
  keep.forEach((a, i) => {
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    eul.set(0, -a + Math.PI / 2, 0); q.setFromEuler(eul);
    mtx.compose(new THREE.Vector3(x, 1.05, z), q, sc); body.setMatrixAt(i, mtx);
    mtx.compose(new THREE.Vector3(x, 2.21, z), q, sc); cap.setMatrixAt(i, mtx);
    solid(x, z, segLen, .8, -a + Math.PI / 2);
  });
  body.instanceMatrix.needsUpdate = true;
  cap.instanceMatrix.needsUpdate = true;
  g.add(body, cap);

  /* ---- 정문 ----
     기둥 둘 + 상인방. 대학 정문은 대개 이 형태고, 멀리서도 실루엣으로
     읽히는 것이 중요합니다 — 대로 끝의 소실점이 이것입니다. */
  const gg = new THREE.Group();
  gg.position.set(Math.cos(GATE_A) * OUTER.gate, 0, Math.sin(GATE_A) * OUTER.gate);
  gg.rotation.y = -GATE_A + Math.PI / 2;
  g.add(gg);

  const pillar = (lx) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.0, 7.2, 2.0), brickM);
    p.position.set(lx, 3.6, 0); p.castShadow = true; p.receiveShadow = true; gg.add(p);
    const cp = new THREE.Mesh(new THREE.BoxGeometry(2.5, .5, 2.5), capM);
    cp.position.set(lx, 7.45, 0); cp.castShadow = true; gg.add(cp);
    const wx = Math.cos(GATE_A) * OUTER.gate - Math.sin(GATE_A) * lx;
    const wz = Math.sin(GATE_A) * OUTER.gate + Math.cos(GATE_A) * lx;
    solid(wx, wz, 2.3, 2.3, -GATE_A + Math.PI / 2);
  };
  pillar(-7.2); pillar(7.2);

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(16.4, 1.1, 1.3), capM);
  lintel.position.set(0, 7.9, 0); lintel.castShadow = true; gg.add(lintel);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(9.0, 1.5, .3), M(PAL2.metal, .5));
  sign.position.set(0, 6.5, .8); sign.castShadow = true; gg.add(sign);
}

/* ══════════════════════════════════════════════════════════
   3. 너머 — 담 밖 도시

   상자 몇 십 개입니다. 안개에 잠기면 상자라는 게 안 보이고, 대신
   **세계가 담에서 끝나지 않는다**는 것만 남습니다. 이게 스케일감의
   절반입니다.

   그림자를 끕니다 — 그림자 상자(SPAN 22)는 사람 주위만 덮으므로
   여기까지 오지도 않고, 켜 두면 그림자 카메라 계산에만 들어갑니다.
   ══════════════════════════════════════════════════════════ */
function skyline(g) {
  const near = M(PAL2.city, .95);
  const far = M(PAL2.cityFar, .96);
  near.fog = true; far.fog = true;

  const mk = (mat, count, rMin, rMax, hMin, hMax) => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const im = new THREE.InstancedMesh(geo, mat, count);
    im.userData.noBake = true;
    im.castShadow = false; im.receiveShadow = false;
    im.frustumCulled = true;
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    const eul = new THREE.Euler();
    for (let i = 0; i < count; i++) {
      const a = rnd() * TAU;
      const r = rMin + rnd() * (rMax - rMin);
      const h = hMin + rnd() * (hMax - hMin);
      const w = 7 + rnd() * 16;
      const d = 7 + rnd() * 16;
      eul.set(0, rnd() * TAU, 0); q.setFromEuler(eul);
      sc.set(w, h, d);
      mtx.compose(new THREE.Vector3(Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r), q, sc);
      im.setMatrixAt(i, mtx);
    }
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
    return im;
  };

  mk(near, 46, OUTER.wall + 26, OUTER.wall + 70, 8, 30);
  mk(far, 38, OUTER.wall + 80, OUTER.wall + 190, 14, 52);

  /* 먼 언덕 — 도시 뒤. 아주 낮고 아주 넓은 원뿔 몇 개면 지평선이 생깁니다 */
  const hillM = M(0x86A98C, .98); hillM.fog = true;
  for (let i = 0; i < 7; i++) {
    const a = rnd() * TAU, r = OUTER.wall + 230 + rnd() * 120;
    const h = new THREE.Mesh(new THREE.ConeGeometry(60 + rnd() * 70, 26 + rnd() * 30, 7), hillM);
    h.position.set(Math.cos(a) * r, 8, Math.sin(a) * r);
    h.castShadow = false; h.receiveShadow = false;
    g.add(h);
  }
}

/* ══════════════════════════════════════════════════════════
   4. 반복물 — 인스턴스

   나무 · 덤불 · 가로등. 바깥 캠퍼스에서 가장 개수가 많은 것들이고,
   개별 Mesh 로 심으면 드로우콜이 수백 개가 됩니다.
   ══════════════════════════════════════════════════════════ */
function instancedProps(g, trees, lamps, solid) {
  const put = (list, geo, mat, cast) => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    im.userData.noBake = true;
    im.castShadow = cast; im.receiveShadow = true;
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    const eul = new THREE.Euler();
    list.forEach((t, i) => {
      eul.set(0, t.ry || 0, 0); q.setFromEuler(eul);
      sc.set(t.s, t.s, t.s);
      mtx.compose(new THREE.Vector3(t.x, t.y || 0, t.z), q, sc);
      im.setMatrixAt(i, mtx);
    });
    im.instanceMatrix.needsUpdate = true;
    g.add(im);
    return im;
  };

  /* ---- 나무 ----
     줄기와 잎을 따로 묶습니다. 색이 둘이니 재질도 둘이고, 하나로 합치려면
     정점 색이 필요한데 그 값이 이 개수에서는 안 나옵니다.
     잎은 종류를 셋으로 나눠 단조로움을 피합니다 — 그래도 드로우콜 넷입니다. */
  const trunkG = new THREE.CylinderGeometry(.17, .26, 2.5, 6);
  trunkG.translate(0, 1.25, 0);
  put(trees, trunkG, M(PAL2.trunk, .9), true);

  /* 잎은 구 셋을 하나의 지오메트리로 합쳐 둡니다 — 인스턴스 하나가
     수관 전체입니다. 합치지 않으면 나무 한 그루에 인스턴스 셋이 됩니다. */
  const leafGeo = () => {
    const parts = [
      new THREE.SphereGeometry(1.25, 7, 6),
      new THREE.SphereGeometry(.95, 7, 6),
      new THREE.SphereGeometry(.8, 6, 5),
    ];
    parts[0].translate(0, 3.5, 0);
    parts[1].translate(.85, 2.95, .35);
    parts[2].translate(-.75, 3.05, -.5);
    /* BufferGeometryUtils 없이 합칩니다 — 속성이 position·normal 뿐이라
       손으로 이어 붙이는 편이 의존성을 안 늘립니다. */
    let vc = 0, ic = 0;
    parts.forEach((p) => { vc += p.attributes.position.count; ic += p.index.count; });
    const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3);
    const idx = new Uint16Array(ic);
    let vo = 0, io = 0;
    parts.forEach((p) => {
      pos.set(p.attributes.position.array, vo * 3);
      nor.set(p.attributes.normal.array, vo * 3);
      for (let i = 0; i < p.index.count; i++) idx[io + i] = p.index.array[i] + vo;
      vo += p.attributes.position.count; io += p.index.count;
      p.dispose();
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    return geo;
  };
  const lg = leafGeo();
  const byKind = [[], [], []];
  trees.forEach((t) => byKind[t.kind % 3].push(t));
  const leafMats = [M(PAL2.leaf, .88), M(PAL2.leafDeep, .88), M(PAL2.leafWarm, .88)];
  byKind.forEach((list, i) => put(list, lg, leafMats[i], true));

  /* ---- 가로등 ---- */
  if (lamps.length) {
    const postG = new THREE.CylinderGeometry(.075, .1, 4.2, 6);
    postG.translate(0, 2.1, 0);
    put(lamps, postG, M(PAL2.lampPost, .55), true);
    const headG = new THREE.SphereGeometry(.3, 8, 6);
    headG.translate(0, 4.35, 0);
    const hm = M(PAL2.lampHead, .4, { emissive: 0xFFE9A8, emissiveIntensity: .55 });
    const im = put(lamps, headG, hm, false);
    if (im) im.userData.lampHeads = true;
  }
}

/* ══════════════════════════════════════════════════════════
   짓기
   ══════════════════════════════════════════════════════════ */
/** @param avoid (x, z, m) => 건물 등 비켜야 할 것에 m 칸 안으로 붙었는가 */
export function buildGrounds(parent, solid, inCore, avoid) {
  const g = new THREE.Group();
  g.name = 'grounds';
  parent.add(g);

  groundRing(g);

  const trees = [];
  const lamps = [];
  let kind = 0;
  const pushTree = (x, z, s, k) => {
    trees.push({ x, z, s, kind: k === undefined ? (kind++) : k, ry: rnd() * TAU });
    /* 줄기만 막습니다. 수관까지 막으면 나무 밑을 못 지나가서 답답합니다 */
    solid(x, z, .55 * s, .55 * s);
  };

  boulevards(g, solid);
  quads(g, solid, pushTree);
  wallAndGate(g, solid);
  skyline(g);

  /* ---- 흩뿌리는 나무 ----
     길·대로·마당 위는 비웁니다. 안쪽(r<40)은 campus.js 가 이미 채웠습니다. */
  const onLane = (x, z) => {
    const r = Math.hypot(x, z), a = Math.atan2(z, x);
    for (let k = 0; k < 4; k++) {
      const la = GATE_A + k * Math.PI / 2;
      const d = Math.abs(((a - la + Math.PI * 3) % TAU) - Math.PI);
      if (d * r < (k === 0 ? 7.5 : 5.5)) return true;
    }
    return Math.abs(r - 92) < 4.5;                 // 순환로
  };
  /* 420 → 210. 캠퍼스는 숲이 아닙니다 — 나무가 빽빽하면 건물 사이가
     산길로 보입니다. 길가와 잔디 가장자리에만 남깁니다. */
  let tries = 0;
  while (trees.length < 210 && tries < 6000) {
    tries++;
    const a = rnd() * TAU;
    const r = OUTER.core + 3 + rnd() * (OUTER.wall - OUTER.core - 6);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (inCore && inCore(x, z)) continue;
    if (onLane(x, z)) continue;
    /* 건물과 그 앞마당은 비웁니다 — 건물 앞에 나무가 서면 정면이 가립니다 */
    if (avoid && avoid(x, z, 26)) continue;
    /* 마당 안에는 안 심습니다 — 마당은 비어 있어야 마당입니다 */
    let inQuad = false;
    for (const q of [[40, .5, 26, 18], [40, 1.5, 26, 18],
                     [66, .511, 24, 18], [66, 1.489, 24, 18]]) {
      const qa = GATE_A + Math.PI * q[1];
      const dx = x - Math.cos(qa) * q[0], dz = z - Math.sin(qa) * q[0];
      const co = Math.cos(-qa), si = Math.sin(-qa);
      if (Math.abs(co * dx - si * dz) < q[2] / 2 + 3 &&
          Math.abs(si * dx + co * dz) < q[3] / 2 + 3) { inQuad = true; break; }
    }
    if (inQuad) continue;
    /* 너무 붙으면 덤불처럼 뭉칩니다 */
    let tooClose = false;
    for (let i = trees.length - 1; i >= 0 && i > trees.length - 40; i--) {
      if (Math.hypot(trees[i].x - x, trees[i].z - z) < 5.2) { tooClose = true; break; }
    }
    if (tooClose) continue;
    pushTree(x, z, .9 + rnd() * .8);
  }

  /* ---- 가로등 — 대로 양옆 ---- */
  for (let k = 0; k < 4; k++) {
    const la = GATE_A + k * Math.PI / 2;
    const co = Math.cos(la), si = Math.sin(la);
    const off = k === 0 ? 6.2 : 4.4;
    const end = k === 0 ? OUTER.gate - 6 : OUTER.wall - 18;
    for (let r = OUTER.core + 6; r < end; r += 13) {
      for (const s of [-1, 1]) {
        const x = co * r - si * off * s, z = si * r + co * off * s;
        lamps.push({ x, z, s: 1, ry: -la });
        solid(x, z, .5, .5);
      }
    }
  }

  instancedProps(g, trees, lamps, solid);

  return { group: g, trees: trees.length, lamps: lamps.length, OUTER, GATE_A };
}

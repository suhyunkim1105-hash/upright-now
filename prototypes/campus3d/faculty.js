/* ══════════════════════════════════════════════════════════
   단과대학 — 캠퍼스를 캠퍼스로 만드는 건물들

   왜 이 파일이 생겼나
   ------------------
   바깥을 넓히고 건물 여섯을 흩어 놨더니 **작은 마을**이 됐습니다.
   당연합니다 — 대학에 건물이 여섯 채일 리가 없습니다. 경희대 국제캠퍼스만
   해도 정문에서 안쪽까지 스무 채가 넘게 이어집니다.

   그런데 여섯 채를 스무 채로 늘리면 실내도 스무 개를 만들어야 할까요.
   아닙니다. **캠퍼스 건물은 대부분 들어갈 일이 없습니다.** 지나가면서
   보는 것이고, 보이는 것만으로 "여기가 대학이다" 를 말합니다.

   그래서 이 파일은 **들어갈 수 없는 건물**만 만듭니다. 포털도 실내도
   없습니다. 있는 것은 겉모습과 이름표뿐이고, 그게 이 건물들의 일입니다.
   들어가는 여섯 채는 bld.js 가 그대로 맡습니다.

   레퍼런스 — 경희대학교 국제캠퍼스
   ---------------------------
   국제캠퍼스는 **네오르네상스 정문에서 체육대학 · 중앙도서관 ·
   예술디자인대학으로 이어지는 고전적 건축 언어**로 지어졌습니다.
   서울캠퍼스 평화의전당은 화강암과 스테인드글라스의 네오고딕입니다 —
   첨두아치, 장미창, 중앙 첨탑 양옆의 높은 탑.

   여기서 뽑아 쓸 어휘는 다섯입니다.

     기단   건물이 잔디에 바로 꽂히지 않고 돌 단 위에 섭니다
     열주   정면에 기둥을 줄 세웁니다. 대학 건물의 첫인상이 이것입니다
     페디먼트  열주 위 삼각 박공
     아치창  네모 창이 아니라 위가 둥근 창. 고전 양식의 핵심 신호
     탑     시계탑 · 첨탑 · 돔. 멀리서 캠퍼스를 알아보게 하는 실루엣

   이 다섯을 조합해 여섯 가지 유형을 만듭니다. 재질은 우리 월드와 같은
   단색 저폴리라, 남의 3D 모델을 가져올 때 생기는 재질 갈라짐이 없습니다.
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { M } from './parts.js';

/* 화강암 캠퍼스의 색. 경희대 국제캠퍼스가 화강암과 밝은 석재를 씁니다 —
   우리 파스텔 월드에 그대로 넣으면 탁하므로 한 단계 밝게 당겼습니다. */
export const STONE = {
  wall:      0xF0E6D2,
  wallWarm:  0xE6D8BE,
  base:      0xD5C7AC,   // 기단
  trim:      0xFBF5E9,   // 코니스 · 창틀 — 몸통보다 밝아야 선이 보입니다
  column:    0xF7EFE0,
  roofSlate: 0x5A6B7A,
  roofCopper: 0x6FBFA8,
  roofTile:  0x9C5F4E,
  glass:     0x8FC4DE,
  glassWarm: 0xFFE9A8,
  door:      0x8E6238,
  gold:      0xE0B44E,
};

/* 몸통 색 — 랜딩 에셋 네 채에서 그대로 뽑았습니다.
   한 채마다 [몸통, 한 단 어두운 몸통, 지붕] 입니다. 테두리는 늘 크림이라
   여기 없습니다 — 그게 이 캠퍼스를 한 세트로 묶는 것이니까요. */
export const BODY = [
  [0xB0685A, 0x9A5749, 0x8E4A3E],   // 벽돌
  [0xC79465, 0xB07E52, 0xA9704A],   // 목재
  [0xBFC7C2, 0xA6B0AA, 0x3E7274],   // 회백 + 청록 지붕
  [0xB2D19E, 0x9CBF88, 0x7FA96C],   // 연두
  [0xC9BBA4, 0xB3A48C, 0x7C8A93],   // 밝은 석재 + 슬레이트
  [0xA8BCD0, 0x91A6BB, 0x5C6E80],   // 청회색
];

const TAU = Math.PI * 2;

/* 재질은 한 벌만 만들어 돌려 씁니다 — 건물마다 새로 만들면 머티리얼이
   수백 개가 되고 bake 가 묶을 수 있는 덩이도 그만큼 잘게 쪼개집니다. */
/* 몸통 색별 재질 캐시. 건물마다 새로 만들면 머티리얼이 수백 개가 되고,
   bake 가 묶을 수 있는 덩이도 그만큼 잘게 쪼개집니다. */
const BODYMAT = new Map();
export function bodyMats(i) {
  const k = i % BODY.length;
  if (BODYMAT.has(k)) return BODYMAT.get(k);
  const [a, b, r] = BODY[k];
  const v = { wall: M(a, .88), wallWarm: M(b, .88), roof: M(r, .8) };
  BODYMAT.set(k, v);
  return v;
}

let MAT = null;
function mats() {
  if (MAT) return MAT;
  MAT = {
    wall: M(STONE.wall, .88),
    wallWarm: M(STONE.wallWarm, .88),
    base: M(STONE.base, .9),
    trim: M(STONE.trim, .82),
    column: M(STONE.column, .84),
    slate: M(STONE.roofSlate, .8),
    copper: M(STONE.roofCopper, .62),
    tile: M(STONE.roofTile, .82),
    glass: M(STONE.glass, .28, { metalness: .1 }),
    door: M(STONE.door, .7),
    gold: M(STONE.gold, .4, { metalness: .5 }),
  };
  return MAT;
}

function box(p, w, h, d, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  p.add(m);
  return m;
}

function cyl(p, rt, rb, h, seg, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  p.add(m);
  return m;
}

/* ---- 아치창 ----
   고전 양식이라는 신호가 여기서 나옵니다. 네모 창을 달면 아무리 기둥을
   세워도 사무실 건물로 보입니다.

   창을 하나씩 Mesh 로 만들면 건물 한 채에 창이 60개씩 붙습니다. 벽면
   하나의 창을 **한 지오메트리로 합쳐** 붙입니다. */
function windowWall(p, w, h, cols, rows, mat, frameMat, x, y, z, ry, arched = true) {
  const gw = w / cols, gh = h / rows;
  const winW = Math.min(gw * .56, 1.5);
  const winH = Math.min(gh * .62, 2.4);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  p.add(g);

  const shape = new THREE.Shape();
  const hw = winW / 2;
  const bodyH = arched ? winH - hw : winH;
  shape.moveTo(-hw, 0);
  shape.lineTo(-hw, bodyH);
  if (arched) shape.absarc(0, bodyH, hw, Math.PI, 0, true);
  else shape.lineTo(hw, bodyH);
  shape.lineTo(hw, 0);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: .18, bevelEnabled: false });
  geo.translate(0, 0, -.09);

  const frameShape = new THREE.Shape();
  const fw = hw + .16, fb = bodyH + .04;
  frameShape.moveTo(-fw, -.16);
  frameShape.lineTo(-fw, fb);
  if (arched) frameShape.absarc(0, fb, fw, Math.PI, 0, true);
  else frameShape.lineTo(fw, fb);
  frameShape.lineTo(fw, -.16);
  frameShape.closePath();
  const fgeo = new THREE.ExtrudeGeometry(frameShape, { depth: .1, bevelEnabled: false });
  fgeo.translate(0, 0, -.05);

  const n = cols * rows;
  const gi = new THREE.InstancedMesh(geo, mat, n);
  const fi = new THREE.InstancedMesh(fgeo, frameMat, n);
  gi.userData.noBake = true; fi.userData.noBake = true;
  gi.castShadow = false; gi.receiveShadow = true;
  fi.castShadow = false; fi.receiveShadow = true;
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
  let k = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = -w / 2 + gw * (c + .5);
      const py = gh * r + (gh - winH) * .5;
      mtx.compose(new THREE.Vector3(px, py, .02), q, sc); gi.setMatrixAt(k, mtx);
      mtx.compose(new THREE.Vector3(px, py, .0), q, sc); fi.setMatrixAt(k, mtx);
      k++;
    }
  }
  gi.instanceMatrix.needsUpdate = true;
  fi.instanceMatrix.needsUpdate = true;
  g.add(fi, gi);
  return g;
}

/* ---- 열주 ----
   기둥 · 주두 · 엔타블러처. 대학 정면의 첫인상입니다. */
function colonnade(p, n, span, h, x, y, z, ry) {
  const C = mats();
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = ry;
  p.add(g);

  const shaftG = new THREE.CylinderGeometry(.34, .40, h, 10);
  shaftG.translate(0, h / 2, 0);
  const capG = new THREE.BoxGeometry(1.05, .26, 1.05);
  capG.translate(0, h + .13, 0);
  const baseG = new THREE.BoxGeometry(1.0, .22, 1.0);
  baseG.translate(0, .11, 0);

  const shafts = new THREE.InstancedMesh(shaftG, C.column, n);
  const caps = new THREE.InstancedMesh(capG, C.trim, n);
  const bases = new THREE.InstancedMesh(baseG, C.trim, n);
  [shafts, caps, bases].forEach((m) => {
    m.userData.noBake = true; m.castShadow = true; m.receiveShadow = true;
  });
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
  const step = n > 1 ? span / (n - 1) : 0;
  for (let i = 0; i < n; i++) {
    const px = -span / 2 + step * i;
    mtx.compose(new THREE.Vector3(px, 0, 0), q, sc);
    shafts.setMatrixAt(i, mtx); caps.setMatrixAt(i, mtx); bases.setMatrixAt(i, mtx);
  }
  shafts.instanceMatrix.needsUpdate = true;
  caps.instanceMatrix.needsUpdate = true;
  bases.instanceMatrix.needsUpdate = true;
  g.add(shafts, caps, bases);

  /* 엔타블러처 — 기둥 위를 잇는 수평 띠. 이게 없으면 기둥이 그냥 막대입니다 */
  box(g, span + 1.8, .55, 1.35, C.trim, 0, h + .55, 0);
  box(g, span + 2.1, .22, 1.5, C.wall, 0, h + .93, 0);
  return g;
}

/* ---- 페디먼트 — 열주 위 삼각 박공 ---- */
function pediment(p, w, h, d, mat, trimMat, x, y, z, ry) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  geo.translate(0, 0, -d / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  p.add(m);
  /* 박공 아래 코니스 — 삼각형이 벽에서 그냥 튀어나오면 종이로 보입니다 */
  const c = box(p, w + .5, .3, d + .35, trimMat, x, y - .05, z, ry);
  c.castShadow = true;
  return m;
}

/* ---- 지붕 ---- */
function hipRoof(p, w, d, h, mat, x, y, z, ry) {
  const geo = new THREE.CylinderGeometry(.001, Math.SQRT2 / 2, h, 4);
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(w / Math.SQRT2 * 1.02, 1, d / Math.SQRT2 * 1.02);
  m.rotation.y = Math.PI / 4;
  const wrap = new THREE.Group();
  wrap.position.set(x, y + h / 2, z); wrap.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  wrap.add(m); p.add(wrap);
  return wrap;
}

/* ---- 돔 ---- */
function dome(p, r, mat, drumMat, x, y, z) {
  const C = mats();
  cyl(p, r * 1.06, r * 1.12, r * .5, 16, drumMat, x, y + r * .25, z);      // 드럼
  box(p, r * 2.4, .22, r * 2.4, C.trim, x, y + r * .52, z);
  const d = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12, 0, TAU, 0, Math.PI / 2), mat);
  d.position.set(x, y + r * .52, z);
  d.castShadow = true; d.receiveShadow = true;
  p.add(d);
  cyl(p, .1, .14, r * .5, 8, C.gold, x, y + r * 1.2, z);                    // 첨탑 끝
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r * .13, 10, 8), C.gold);
  ball.position.set(x, y + r * 1.42, z); ball.castShadow = true;
  p.add(ball);
}

/* ---- 탑 — 시계탑 · 첨탑 ---- */
function tower(p, w, h, x, z, opt = {}) {
  const C = mats();
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  p.add(g);
  box(g, w * 1.18, .5, w * 1.18, C.base, 0, .25, 0);
  box(g, w, h, w, C.wall, 0, h / 2 + .4, 0);
  /* 층을 나누는 띠 — 없으면 그냥 기둥입니다 */
  for (let i = 1; i * 4 < h; i++) box(g, w * 1.06, .18, w * 1.06, C.trim, 0, i * 4 + .4, 0);
  box(g, w * 1.2, .45, w * 1.2, C.trim, 0, h + .55, 0);

  if (opt.clock) {
    /* 시계 — 네 면에. 대학 시계탑의 정체입니다 */
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      const cx = Math.sin(a) * (w / 2 + .06), cz = Math.cos(a) * (w / 2 + .06);
      const f = new THREE.Mesh(new THREE.CylinderGeometry(w * .3, w * .3, .12, 16), C.trim);
      f.rotation.set(Math.PI / 2, 0, 0); f.rotation.y = 0;
      f.position.set(cx, h - 1.6, cz);
      f.lookAt(cx * 4, h - 1.6, cz * 4);
      f.rotateX(Math.PI / 2);
      f.castShadow = false;
      g.add(f);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(w * .04, w * .34, .06), C.door);
      hand.position.set(cx * 1.04, h - 1.6 + w * .1, cz * 1.04);
      hand.lookAt(cx * 4, h - 1.6, cz * 4);
      g.add(hand);
    }
  }
  if (opt.spire) {
    /* 첨탑 — 평화의전당의 그 실루엣. 멀리서 캠퍼스를 알아보게 합니다 */
    const sp = new THREE.Mesh(new THREE.ConeGeometry(w * .72, opt.spire, 8), C.copper);
    sp.position.set(0, h + .78 + opt.spire / 2, 0);
    sp.castShadow = true;
    g.add(sp);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(w * .12, 8, 6), C.gold);
    ball.position.set(0, h + .78 + opt.spire + w * .1, 0);
    g.add(ball);
  } else {
    hipRoof(g, w * 1.25, w * 1.25, w * .7, C.slate, 0, h + .78, 0, 0);
  }
  return g;
}

/* ---- 장미창 — 네오고딕의 중앙 표식 ---- */
function roseWindow(p, r, x, y, z, ry) {
  const C = mats();
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = ry;
  p.add(g);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * .12, 8, 20), C.trim);
  ring.position.z = .06; g.add(ring);
  const pane = new THREE.Mesh(new THREE.CircleGeometry(r * .95, 20),
    M(0x7FB2D8, .3, { emissive: 0x2A5A86, emissiveIntensity: .35 }));
  pane.position.z = .02; g.add(pane);
  /* 창살 여덟 — 장미창은 살이 있어야 장미창입니다 */
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(r * 1.9, r * .09, .1), C.trim);
    bar.rotation.z = a; bar.position.z = .07;
    g.add(bar);
  }
  return g;
}

/* ══════════════════════════════════════════════════════════
   유형 여섯
   ══════════════════════════════════════════════════════════ */
const KIND = {};

/* 단과대학 — 캠퍼스에 가장 많은 유형. 긴 몸통에 아치창, 가운데 현관.
   특별할 게 없어야 합니다 — 이게 배경을 만듭니다. */
KIND.faculty = (g, o) => {
  const C = Object.assign({}, mats(), o.body
    ? { wall: o.body.wall, wallWarm: o.body.wallWarm, slate: o.body.roof } : {});
  const w = o.w, d = o.d, h = o.h;
  box(g, w + 1.2, .7, d + 1.2, C.base, 0, .35, 0);
  box(g, w, h, d, C.wall, 0, h / 2 + .6, 0);
  box(g, w + .5, .3, d + .5, C.trim, 0, h + .6, 0);          // 코니스
  /* 모서리 기둥 — 랜딩 에셋의 크림 테두리. 네 귀퉁이에 세로로 세우면
     밋밋한 상자가 건물로 읽힙니다. */
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    box(g, .55, h, .55, C.trim, sx * (w / 2 - .1), h / 2 + .6, sz * (d / 2 - .1));
  hipRoof(g, w + 1.0, d + 1.0, 1.7, C.slate, 0, h + .78, 0, 0);
  windowWall(g, w - 2.4, h - 1.6, Math.max(4, Math.round(w / 3.2)), Math.max(2, Math.round(h / 4)),
    C.glass, C.trim, 0, 1.6, d / 2 + .06, 0);
  windowWall(g, w - 2.4, h - 1.6, Math.max(4, Math.round(w / 3.2)), Math.max(2, Math.round(h / 4)),
    C.glass, C.trim, 0, 1.6, -d / 2 - .06, Math.PI);
  /* 현관 — 작은 열주와 박공 */
  box(g, 6.4, 3.4, 1.6, C.wall, 0, 2.3, d / 2 + .8);
  colonnade(g, 4, 4.6, 3.2, 0, .6, d / 2 + 1.5, 0);
  pediment(g, 7.0, 1.7, 1.9, C.wall, C.trim, 0, 4.7, d / 2 + 1.5, 0);
  box(g, 2.2, 2.6, .3, C.door, 0, 1.9, d / 2 + 1.66);
};

/* 본관 — 열주와 페디먼트, 그리고 시계탑. 정문 축의 머리에 섭니다 */
KIND.admin = (g, o) => {
  const C = Object.assign({}, mats(), o.body
    ? { wall: o.body.wall, wallWarm: o.body.wallWarm, slate: o.body.roof } : {});
  const w = o.w, d = o.d, h = o.h;
  box(g, w + 1.6, 1.0, d + 1.6, C.base, 0, .5, 0);
  box(g, w, h, d, C.wall, 0, h / 2 + .9, 0);
  box(g, w + .6, .34, d + .6, C.trim, 0, h + .9, 0);
  hipRoof(g, w + 1.2, d + 1.2, 2.1, C.slate, 0, h + 1.06, 0, 0);
  windowWall(g, w - 3.4, h - 2.2, Math.max(5, Math.round(w / 3.4)), Math.max(2, Math.round(h / 4.2)),
    C.glass, C.trim, 0, 2.2, d / 2 + .06, 0);
  /* 정면 대열주 */
  const pw = Math.min(w * .62, 15);
  box(g, pw + 2.6, 1.0, 4.2, C.base, 0, .5, d / 2 + 2.1);
  colonnade(g, 6, pw, h * .74, 0, 1.0, d / 2 + 2.6, 0);
  pediment(g, pw + 3.0, 3.0, 3.0, C.wall, C.trim, 0, h * .74 + 2.0, d / 2 + 2.6, 0);
  box(g, 3.2, 3.6, .4, C.door, 0, 2.7, d / 2 + .22);
  tower(g, 3.6, h + 6, 0, -d / 2 + 1.4, { clock: true });
};

/* 도서관 — 긴 열주와 돔. 경희대 중앙도서관의 인상 */
KIND.library = (g, o) => {
  const C = Object.assign({}, mats(), o.body
    ? { wall: o.body.wall, wallWarm: o.body.wallWarm } : {});
  const w = o.w, d = o.d, h = o.h;
  box(g, w + 1.6, .9, d + 1.6, C.base, 0, .45, 0);
  box(g, w, h, d, C.wall, 0, h / 2 + .8, 0);
  box(g, w + .6, .32, d + .6, C.trim, 0, h + .8, 0);
  /* 옆 날개를 낮게 — 가운데가 높아야 돔이 앉습니다 */
  box(g, w * .3, h * .78, d * .96, C.wallWarm, -w * .36, h * .39 + .8, 0);
  box(g, w * .3, h * .78, d * .96, C.wallWarm, w * .36, h * .39 + .8, 0);
  windowWall(g, w - 3.0, h - 2.0, Math.max(6, Math.round(w / 3)), Math.max(2, Math.round(h / 4)),
    C.glass, C.trim, 0, 2.0, d / 2 + .06, 0);
  colonnade(g, 8, Math.min(w * .78, 20), h * .66, 0, .9, d / 2 + 2.2, 0);
  box(g, 3.0, 3.4, .4, C.door, 0, 2.6, d / 2 + .22);
  dome(g, Math.min(w * .17, 4.2), C.copper, C.wall, 0, h + 1.1, 0);
};

/* 대강당 — 평화의전당의 어휘. 첨탑 둘과 장미창 */
KIND.hall = (g, o) => {
  const C = Object.assign({}, mats(), o.body ? { wall: o.body.wall } : {});
  const w = o.w, d = o.d, h = o.h;
  box(g, w + 1.4, .9, d + 1.4, C.base, 0, .45, 0);
  box(g, w, h, d, C.wall, 0, h / 2 + .8, 0);
  box(g, w + .5, .3, d + .5, C.trim, 0, h + .8, 0);
  /* 가파른 지붕 — 고딕은 지붕이 섭니다 */
  const s = new THREE.Shape();
  s.moveTo(-w / 2 - .6, 0); s.lineTo(w / 2 + .6, 0); s.lineTo(0, h * .5); s.closePath();
  const rg = new THREE.ExtrudeGeometry(s, { depth: d + 1.2, bevelEnabled: false });
  rg.translate(0, 0, -(d + 1.2) / 2);
  const rm = new THREE.Mesh(rg, C.copper);
  rm.position.set(0, h + .95, 0); rm.castShadow = true; rm.receiveShadow = true;
  g.add(rm);
  /* 첨두아치 창 — 세로로 길게 */
  windowWall(g, w - 5.0, h - 1.6, Math.max(3, Math.round(w / 5)), 1,
    C.glass, C.trim, 0, 1.8, d / 2 + .06, 0);
  roseWindow(g, Math.min(w * .12, 2.6), 0, h * .72, d / 2 + .12, 0);
  tower(g, 2.8, h + 7, -w / 2 - .4, d / 2 - 1.2, { spire: 6.5 });
  tower(g, 2.8, h + 7, w / 2 + .4, d / 2 - 1.2, { spire: 6.5 });
  /* 정문 — 큰 첨두아치 하나 */
  const a = new THREE.Shape();
  a.moveTo(-2.2, 0); a.lineTo(-2.2, 3.0);
  a.quadraticCurveTo(0, 6.4, 2.2, 3.0);
  a.lineTo(2.2, 0); a.closePath();
  const ag = new THREE.ExtrudeGeometry(a, { depth: .5, bevelEnabled: false });
  const am = new THREE.Mesh(ag, C.door);
  am.position.set(0, .9, d / 2 + .1); am.castShadow = false;
  g.add(am);
};

/* 체육관 — 넓고 낮고, 큰 아치 개구부 */
KIND.gym = (g, o) => {
  const C = Object.assign({}, mats(), o.body
    ? { wallWarm: o.body.wall, slate: o.body.roof } : {});
  const w = o.w, d = o.d, h = o.h;
  box(g, w + 1.2, .7, d + 1.2, C.base, 0, .35, 0);
  box(g, w, h, d, C.wallWarm, 0, h / 2 + .6, 0);
  box(g, w + .5, .28, d + .5, C.trim, 0, h + .6, 0);
  /* 배럴 지붕 */
  const rm = new THREE.Mesh(
    new THREE.CylinderGeometry(w / 2, w / 2, d, 14, 1, false, 0, Math.PI), C.slate);
  rm.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  rm.position.set(0, h + .75, 0);
  rm.scale.set(1, 1, .42);
  rm.castShadow = true; rm.receiveShadow = true;
  g.add(rm);
  windowWall(g, w - 3.0, h - 2.2, Math.max(3, Math.round(w / 5)), 1,
    C.glass, C.trim, 0, 2.0, d / 2 + .06, 0);
  box(g, 5.0, 3.2, .5, C.door, 0, 2.2, d / 2 + .2);
};

/* 기숙사 — 같은 칸이 길게 반복됩니다. 실제 기숙사가 그렇게 생겼습니다 */
KIND.hall_res = (g, o) => {
  const C = Object.assign({}, mats(), o.body
    ? { wall: o.body.wall, wallWarm: o.body.wallWarm, tile: o.body.roof } : {});
  const w = o.w, d = o.d, h = o.h;
  box(g, w + 1.0, .6, d + 1.0, C.base, 0, .3, 0);
  box(g, w, h, d, C.wall, 0, h / 2 + .5, 0);
  box(g, w + .4, .26, d + .4, C.trim, 0, h + .5, 0);
  hipRoof(g, w + .8, d + .8, 1.5, C.tile, 0, h + .64, 0, 0);
  const cols = Math.max(6, Math.round(w / 2.6));
  const rows = Math.max(3, Math.round(h / 3.4));
  windowWall(g, w - 1.8, h - 1.4, cols, rows, C.glass, C.trim, 0, 1.3, d / 2 + .06, 0, false);
  windowWall(g, w - 1.8, h - 1.4, cols, rows, C.glass, C.trim, 0, 1.3, -d / 2 - .06, Math.PI, false);
  /* 층을 가르는 띠 */
  for (let i = 1; i < rows; i++) box(g, w + .16, .16, d + .16, C.trim, 0, .5 + (h / rows) * i, 0);
  box(g, 3.6, 3.0, 1.2, C.wallWarm, 0, 2.0, d / 2 + .6);
  box(g, 2.0, 2.4, .3, C.door, 0, 1.7, d / 2 + 1.22);
};

/* ══════════════════════════════════════════════════════════
   배치

   경희대 국제캠퍼스의 축 구성을 따릅니다 — 정문에서 안쪽으로 들어가며
   양옆에 단과대학이 늘어서고, 축의 머리에 본관, 그 뒤가 기숙사입니다.

   좌표는 **정문 축 기준 상대각(도)** 과 반지름입니다. campus.js 의
   들어갈 수 있는 여섯 채와 같은 방식이라, 축을 옮기면 같이 따라옵니다.
   ══════════════════════════════════════════════════════════ */
export const FACULTIES = [
  /* 각도와 반지름을 손으로 고르지 않았습니다 — 고리 세 개에 슬롯을
     나누고 배정한 결과입니다. 반지름 r 의 고리에 N 채를 고르게 놓으면
     이웃 사이가 2·r·sin(π/N) 이라, N 만 맞추면 겹칠 수가 없습니다.

       고리 A  r 54   45°마다 — 자주 가는 건물
       고리 B  r 90   30°마다 — 강의동
       고리 C  r 124  45°마다 — 기숙사 · 부속

     정문 축 좌우 14°는 비워 둡니다. 배치를 바꾸려면 값을 여기서
     고치지 말고 scratchpad/p7-rings.mjs 를 고쳐 다시 돌립니다 —
     campus.js 의 여섯 채와 함께 계산돼야 간격이 맞습니다. */
  { name: '인문대학', kind: 'faculty', deg: 45, r: 54, w: 22, d: 11, h: 12 },
  { name: '사회과학대학', kind: 'faculty', deg: 90, r: 54, w: 22, d: 11, h: 12 },
  { name: '생명과학대학', kind: 'faculty', deg: 270, r: 54, w: 22, d: 11, h: 12 },
  { name: '경영대학', kind: 'faculty', deg: 315, r: 54, w: 22, d: 11, h: 12 },
  { name: '공과대학', kind: 'faculty', deg: 15, r: 90, w: 24, d: 11, h: 13 },
  { name: '전자정보대학', kind: 'faculty', deg: 45, r: 90, w: 24, d: 11, h: 13 },
  { name: '응용과학대학', kind: 'faculty', deg: 105, r: 90, w: 22, d: 11, h: 12 },
  { name: '외국어대학', kind: 'faculty', deg: 135, r: 90, w: 24, d: 11, h: 12 },
  { name: '국제대학', kind: 'faculty', deg: 165, r: 90, w: 22, d: 11, h: 11 },
  { name: '예술디자인대학', kind: 'faculty', deg: 195, r: 90, w: 22, d: 11, h: 12 },
  { name: '평화의전당', kind: 'hall', deg: 225, r: 90, w: 26, d: 18, h: 15 },
  { name: '체육관', kind: 'gym', deg: 255, r: 90, w: 26, d: 16, h: 10 },
  { name: '대학원', kind: 'admin', deg: 22.5, r: 124, w: 20, d: 12, h: 14 },
  { name: '간호과학대학', kind: 'faculty', deg: 67.5, r: 124, w: 22, d: 11, h: 11 },
  { name: '약학대학', kind: 'faculty', deg: 112.5, r: 124, w: 22, d: 11, h: 12 },
  { name: '박물관', kind: 'library', deg: 202.5, r: 124, w: 20, d: 12, h: 11 },
  { name: '제1기숙사', kind: 'hall_res', deg: 247.5, r: 124, w: 24, d: 10, h: 14 },
  { name: '제2기숙사', kind: 'hall_res', deg: 292.5, r: 124, w: 24, d: 10, h: 14 },
];

/**
 * 단과대학들을 세웁니다.
 * @param parent  캠퍼스 그룹
 * @param axis    정문 축(라디안)
 * @param solid   충돌 상자 등록 함수 (x, z, w, d, ry, big)
 * @param label   이름표를 달 콜백 (x, z, name) — 없으면 생략
 */
export function buildFaculties(parent, axis, solid, label) {
  const out = [];
  let ci = 0;
  for (const f of FACULTIES) {
    const th = axis + f.deg * Math.PI / 180;
    const x = Math.cos(th) * f.r, z = Math.sin(th) * f.r;
    /* 정면이 캠퍼스 안쪽(광장)을 봅니다 */
    const ry = Math.atan2(-Math.cos(th), -Math.sin(th));

    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    parent.add(g);
    /* 몸통 색을 한 채씩 돌립니다. 같은 색이 이웃하면 한 건물로 보이므로
       고리 안에서 순서대로 바뀌게 두었습니다. */
    (KIND[f.kind] || KIND.faculty)(g, Object.assign({ body: bodyMats(ci++) }, f));

    /* 건물 몸통 + 현관 계단까지 막습니다 */
    solid(x, z, f.w + 1.2, f.d + 1.2, ry, true);
    const dd = (f.d / 2 + 2.4);
    solid(x + Math.sin(ry) * dd, z + Math.cos(ry) * dd, 7.0, 3.0, ry, false);

    if (label) label(x, z, f.name);
    out.push({ name: f.name, x, z, ry, kind: f.kind, w: f.w, d: f.d, h: f.h });
  }
  return out;
}

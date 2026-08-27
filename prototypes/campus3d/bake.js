/* ══════════════════════════════════════════════════════════
   굽기(bake) — 같은 재질끼리 형상을 하나로 합칩니다.
   캠퍼스를 그냥 세우면 드로우콜이 3,000 번이 넘습니다. 이 서비스는
   웹캠 자세 추정과 **같은 탭에서** 돌기 때문에, 그림 그리는 데 쓰는
   시간을 줄이지 않으면 민철이가 잡은 렉이 그대로 되살아납니다.
   색이 같은 조각들을 한 덩이로 묶으면 드로우콜이 수십 번으로 떨어집니다.
   (움직이는 것 — 사람 · 물 — 은 굽지 않습니다.)
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

/** 합칠 수 있게 속성을 맞춥니다 — position · normal · uv 셋만 남깁니다. */
function normalize(src) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', src.getAttribute('position').clone());
  if (src.getAttribute('normal')) g.setAttribute('normal', src.getAttribute('normal').clone());
  else { g.computeVertexNormals(); }
  const uv = src.getAttribute('uv');
  g.setAttribute('uv', uv ? uv.clone()
    : new THREE.BufferAttribute(new Float32Array(src.getAttribute('position').count * 2), 2));
  if (src.index) g.setIndex(src.index.clone());
  else {
    const n = g.getAttribute('position').count;
    g.setIndex(Array.from({ length: n }, (_, i) => i));
  }
  return g;
}

export function bake(root, opt = {}) {
  root.updateMatrixWorld(true);
  /* opt.tile 을 주면 **구역마다 따로** 굽습니다.
     섬 전체를 한 덩이로 합치면 드로우콜은 줄지만 시야 밖 절두체 컬링이
     통째로 죽어서 뒤통수 쪽 나무 백 그루까지 매 프레임 그립니다.
     구역으로 쪼개면 둘 다 얻습니다. */
  const TILE = opt.tile || 0;
  const _c = new THREE.Vector3();
  const bins = new Map();
  const keep = [];
  const doomed = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material;
    /* 투명 · 발광 · 지정 제외는 그대로 둡니다 — 합치면 그리는 순서가 깨집니다 */
    /* 그림 텍스처가 붙은 것(간판)은 절대 합치면 안 됩니다 — 색·거칠기가
       같아서 한 덩이가 되면 **남의 간판 글씨**가 내 판에 그려집니다.
       실제로 기숙사 간판이 옆 건물 텍스처를 잘라 써서 '기수' 로 보였습니다. */
    if (m.transparent || m.map || o.userData.noBake || (o.parent && o.parent.userData.noBake)) { keep.push(o); return; }
    const key = [m.color.getHex(), Math.round(m.roughness * 100), Math.round((m.metalness || 0) * 100),
      m.emissive ? m.emissive.getHex() : 0, Math.round((m.emissiveIntensity || 0) * 100),
      m.side, o.castShadow ? 1 : 0, o.receiveShadow ? 1 : 0].join('|');
    let tk = '';
    if (TILE) {
      o.geometry.computeBoundingSphere();
      _c.copy(o.geometry.boundingSphere.center).applyMatrix4(o.matrixWorld);
      tk = Math.floor(_c.x / TILE) + ',' + Math.floor(_c.z / TILE) + '|';
    }
    const fullKey = tk + key;
    let bin = bins.get(fullKey);
    if (!bin) bins.set(fullKey, bin = { mat: m, cast: o.castShadow, recv: o.receiveShadow, geos: [] });
    const g = normalize(o.geometry);
    g.applyMatrix4(o.matrixWorld);
    bin.geos.push(g);
    doomed.push(o);
  });
  const out = new THREE.Group();
  out.name = 'baked';
  let merged = 0;
  bins.forEach((bin) => {
    const g = bin.geos.length === 1 ? bin.geos[0] : mergeGeometries(bin.geos, false);
    if (!g) { bin.geos.forEach((x) => x.dispose()); return; }
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, bin.mat);
    m.castShadow = bin.cast; m.receiveShadow = bin.recv;
    m.matrixAutoUpdate = false;
    out.add(m); merged++;
  });
  /* 원본은 버립니다. 안 버리면 두 벌이 겹쳐 그려집니다. */
  doomed.forEach((o) => { o.geometry.dispose(); o.parent && o.parent.remove(o); });
  return { group: out, before: doomed.length + keep.length, after: merged + keep.length };
}

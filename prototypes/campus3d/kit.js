/* ══════════════════════════════════════════════════════════
   외부 킷 — Kenney CC0 모델을 우리 월드에 앉히기

   왜 이게 갈라지지 않나
   -------------------
   앞서 외부 에셋을 기각했던 근거는 "재질이 갈라진다" 였고, 그건 비교용
   모델을 잘못 골라서 나온 결론이었습니다(사진 기반 PBR 디오라마).

   Kenney 킷을 열어 보면 다릅니다 — **텍스처가 한 장도 없습니다.**

     메시 1 · 재질 5 · 텍스처 0 · 이미지 0
     { baseColorFactor: [0.55,0.55,0.55,1], metallicFactor: 0, roughnessFactor: 1 }

   색 하나와 거칠기뿐이고, 우리 M(color, roughness) 와 구조가 같습니다.
   147개 전부 확인했고 텍스처를 가진 것은 0개였습니다.

   게다가 재질에 **이름이 붙어 있습니다** — `_defaultMat` · `border` ·
   `window` · `door` · `roof` · `trim`. 색을 맞추는 게 아니라 **이름으로**
   갈아 끼울 수 있다는 뜻이라, 원본 회색·파랑을 우리 팔레트로 정확히
   옮길 수 있습니다. 이러면 남이 만든 티가 안 납니다.

   지키는 것
     · 원본 색을 그대로 쓰지 않습니다. 채도가 우리보다 높아 튑니다
     · 같은 모델은 인스턴싱합니다 — 서른 채를 서른 번 붙이면 드로우콜 서른
     · userData.noBake — bake 가 합치면 인스턴스 행렬이 사라집니다
     · 코드로 그린 것(캐릭터 · 들어가는 건물 여섯)은 안 건드립니다
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { GLTFLoader } from './vendor/ext/GLTFLoader.js';
import { M } from './parts.js';
import { retintMaterial } from './retint.js';

const BASE = './assets/kit/';

/* 우리 팔레트. faculty.js 의 STONE·BODY 와 같은 값을 씁니다 —
   여기서 따로 정하면 킷 건물만 다른 학교가 됩니다. */
const SKIN = {
  trim:  0xFBF5E9,
  glass: 0x8FC4DE,
  door:  0x8E6238,
  roofs: [0x8E4A3E, 0xA9704A, 0x3E7274, 0x7FA96C, 0x7C8A93, 0x5C6E80],
  walls: [0xB0685A, 0xC79465, 0xBFC7C2, 0xB2D19E, 0xC9BBA4, 0xA8BCD0],
};

/* 재질 이름 → 우리 색. 이름이 없거나 모르는 것은 벽으로 봅니다. */
function skinFor(name, tone) {
  const n = (name || '').toLowerCase();
  if (n.includes('window') || n.includes('glass')) return { c: SKIN.glass, r: .3, m: .1 };
  if (n.includes('door')) return { c: SKIN.door, r: .72 };
  if (n.includes('roof')) return { c: SKIN.roofs[tone % SKIN.roofs.length], r: .82 };
  if (n.includes('border') || n.includes('trim')) return { c: SKIN.trim, r: .84 };
  return { c: SKIN.walls[tone % SKIN.walls.length], r: .88 };
}

/* 재질 캐시 — 톤 × 역할 조합만큼만 만듭니다. 모델마다 새로 만들면
   머티리얼이 수백 개가 되고 bake 가 묶을 덩이도 그만큼 잘게 쪼개집니다. */
const matCache = new Map();
function skinned(name, tone) {
  const key = (name || '?') + '|' + tone;
  if (matCache.has(key)) return matCache.get(key);
  const s = skinFor(name, tone);
  const mat = M(s.c, s.r, s.m ? { metalness: s.m } : undefined);
  matCache.set(key, mat);
  return mat;
}

const loader = new GLTFLoader();
const cache = new Map();

/** GLB 하나를 읽어 **지오메트리 목록**으로 바꿉니다.
    Object3D 를 그대로 복제하지 않는 이유 — 인스턴싱을 하려면 지오메트리와
    재질이 낱개로 있어야 합니다. 트리째 복제하면 드로우콜이 그대로 늘어납니다. */
export function load(file) {
  if (cache.has(file)) return cache.get(file);
  const p = new Promise((res, rej) => {
    loader.load(BASE + file, (gltf) => {
      const parts = [];
      gltf.scene.updateMatrixWorld(true);
      gltf.scene.traverse((o) => {
        if (!o.isMesh || !o.geometry) return;
        const g = o.geometry.clone();
        g.applyMatrix4(o.matrixWorld);          // 모델 안 계층을 펴 둡니다
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const m0 = mats[0];
        /* 텍스처가 있으면 **원본 재질을 살려** 씁니다. 색이 텍스처에
           있어서 우리 재질로 갈아 끼우면 모델이 통째로 단색이 됩니다.
           대신 retint 가 그 텍스처의 색을 우리 톤으로 옮깁니다. */
        const textured = !!(m0 && m0.map);
        if (textured) retintMaterial(m0);
        parts.push({ geo: g, name: (m0 && m0.name) || o.name || '',
                     keep: textured ? m0 : null });
      });
      /* 바닥에 앉히고 원점을 가운데로 옮깁니다 — 모델마다 원점 규칙이
         달라서, 안 맞추면 어떤 건물은 땅에 묻히고 어떤 건물은 뜹니다. */
      const bb = new THREE.Box3();
      for (const p2 of parts) { p2.geo.computeBoundingBox(); bb.union(p2.geo.boundingBox); }
      const cx = (bb.min.x + bb.max.x) / 2, cz = (bb.min.z + bb.max.z) / 2;
      for (const p2 of parts) p2.geo.translate(-cx, -bb.min.y, -cz);
      const size = new THREE.Vector3(); bb.getSize(size);
      res({ parts, size });
    }, undefined, rej);
  });
  cache.set(file, p);
  return p;
}

/**
 * 같은 모델을 여러 자리에 인스턴스로 세웁니다.
 * @param parent  붙일 그룹
 * @param file    assets/kit 안의 파일 이름
 * @param spots   [{x, z, ry, s, tone}] — tone 은 색 조합 번호
 * @param opt     { height } 이 높이에 맞춰 크기를 맞춥니다
 */
export async function place(parent, file, spots, opt = {}) {
  if (!spots.length) return null;
  let kit;
  try { kit = await load(file); }
  catch (e) { console.warn('킷을 못 읽었습니다: ' + file, e); return null; }

  /* 높이를 지정하면 모델마다 다른 원본 크기를 우리 눈금에 맞춥니다.
     안 맞추면 어떤 건물은 3칸, 어떤 건물은 30칸이 됩니다. */
  /* 높이만 맞추면 납작하고 넓은 모델이 폭으로 터집니다. 두 제한 중
     **작은 쪽**을 씁니다 — 안 그러면 저층 와이드 건물이 벽이 됩니다. */
  let fit = opt.height ? opt.height / Math.max(kit.size.y, .001) : 1;
  if (opt.maxW) fit = Math.min(fit, opt.maxW / Math.max(kit.size.x, kit.size.z, .001));

  const group = new THREE.Group();
  group.name = 'kit:' + file;
  parent.add(group);

  /* 톤별로 나눕니다 — 인스턴스 하나에는 재질이 하나뿐이라,
     색이 다른 것끼리는 따로 묶여야 합니다. */
  const byTone = new Map();
  spots.forEach((s) => {
    const t = s.tone || 0;
    if (!byTone.has(t)) byTone.set(t, []);
    byTone.get(t).push(s);
  });

  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const eul = new THREE.Euler();
  for (const [tone, list] of byTone) {
    for (const part of kit.parts) {
      const im = new THREE.InstancedMesh(part.geo, part.keep || skinned(part.name, tone), list.length);
      im.userData.noBake = true;
      im.castShadow = true; im.receiveShadow = true;
      list.forEach((s, i) => {
        const k = (s.s || 1) * fit;
        eul.set(0, s.ry || 0, 0); q.setFromEuler(eul); sc.set(k, k, k);
        mtx.compose(new THREE.Vector3(s.x, s.y || 0, s.z), q, sc);
        im.setMatrixAt(i, mtx);
      });
      im.instanceMatrix.needsUpdate = true;
      group.add(im);
    }
  }
  return { group, size: kit.size, fit };
}

/** 실내용 — 한 점에 하나만. 가구는 자리마다 달라서 인스턴싱 이득이 적습니다. */
export async function one(parent, file, x, y, z, ry = 0, height, tone = 0) {
  let kit;
  try { kit = await load(file); } catch (e) { return null; }
  const fit = height ? height / Math.max(kit.size.y, .001) : 1;
  const g = new THREE.Group();
  g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(fit);
  for (const part of kit.parts) {
    const m = new THREE.Mesh(part.geo, part.keep || skinned(part.name, tone));
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  g.userData.noBake = true;
  parent.add(g);
  return g;
}

/* ---- 자연 · 소품 ----
   나무는 **전부 갈아 끼웁니다.** 구 세 개짜리 우리 나무와 나란히 세우면
   한쪽이 미완성으로 보입니다 — 섞는 것이 가장 나쁜 선택입니다. */
export const NATURE = {
  broad: ['nat-tree.glb', 'nat-tree-2.glb', 'nat-tree-3.glb', 'nat-tree-4.glb', 'nat-tree-5.glb'],
  pine:  ['nat-pine.glb', 'nat-pine-2.glb', 'nat-pine-3.glb', 'nat-pine-4.glb', 'nat-pine-5.glb'],
  /* 굽은나무(twisted)는 뺐습니다 — 가지가 앙상해 죽은 나무로 보이고,
     죽은 나무가 선 캠퍼스는 관리가 안 된 곳으로 읽힙니다.
     대신 활엽을 한 갈래 더 늘려 종류 수를 지킵니다. */
  twist: ['nat-tree-3.glb', 'nat-tree-4.glb', 'nat-tree-5.glb',
          'park-tree.glb', 'park-tree-large.glb'],
  bush:  ['nat-bush.glb', 'park-bush.glb', 'park-bush-large.glb'],
  rock:  ['nat-rock-medium.glb', 'nat-rock-medium-2.glb', 'nat-rock-medium-3.glb'],
};
export const PROPS = {
  bench: ['park-bench.glb', 'bit-bench.glb'],
  lamp:  ['park-street-lantern.glb', 'bit-streetlight.glb'],
  bin:   ['park-trashcan.glb'],
  sign:  ['sign-wooden-sign.glb', 'sign-wooden-sign-2.glb', 'sign-wooden-sign-3.glb',
          'sign-wooden-sign-4.glb', 'sign-wooden-sign-5.glb'],
  car:   ['car-car.glb', 'car-car-2.glb', 'car-sports-car.glb', 'car-sports-car-2.glb'],
};

/* 킷에 있는 건물 파일 이름들. 배치 쪽에서 골라 씁니다. */
export const CITY = {
  low: ['city-low-building.glb', 'city-low-building-2.glb', 'city-low-building-3.glb',
        'city-low-building-4.glb', 'city-low-building-5.glb', 'city-low-building-6.glb',
        'city-low-building-7.glb', 'city-low-building-8.glb', 'city-low-building-9.glb'],
  small: ['city-small-building.glb', 'city-small-building-2.glb', 'city-small-building-3.glb',
          'city-small-building-4.glb', 'city-small-building-5.glb', 'city-small-building-6.glb'],
  large: ['city-large-building.glb', 'city-large-building-2.glb', 'city-large-building-3.glb',
          'city-large-building-4.glb', 'city-large-building-5.glb', 'city-large-building-6.glb'],
  tower: ['city-skyscraper.glb', 'city-skyscraper-2.glb', 'city-skyscraper-3.glb',
          'city-skyscraper-4.glb', 'city-skyscraper-5.glb', 'city-skyscraper-6.glb'],
  wide: ['city-low-wide.glb', 'city-low-wide-2.glb'],
};

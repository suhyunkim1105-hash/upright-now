/* ══════════════════════════════════════════════════════════
   건물 부품 공용 라이브러리.
   여섯 채가 같은 부품을 쓰되 조합과 색만 달라야, 나란히 놨을 때
   "한 캠퍼스" 로 읽힙니다. 부품마다 따로 그리면 여섯 개의 다른 게임이 됩니다.
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';

export const M = (c, r = .55, extra) => new THREE.MeshStandardMaterial(
  Object.assign({ color: c, roughness: r, metalness: 0 }, extra || {}));

/** 둥근 상자.
    반지름이 두께의 절반보다 크면 베벨이 위아래로 따로 붙어 실제 높이가
    부풀어 오릅니다(0.6 짜리가 1.81 로 나왔던 적이 있습니다). 여기서 자릅니다. */
export function roundedBox(w, h, d, r, seg = 4) {
  const eps = 1e-5;
  r = Math.max(.004, Math.min(r, w / 2 - .004, h / 2 - .004, d / 2 - .004));
  const rr = r - eps;
  const s = new THREE.Shape();
  s.absarc(eps, eps, eps, -Math.PI / 2, -Math.PI, true);
  s.absarc(eps, h - rr * 2, eps, Math.PI, Math.PI / 2, true);
  s.absarc(w - rr * 2, h - rr * 2, eps, Math.PI / 2, 0, true);
  s.absarc(w - rr * 2, eps, eps, 0, -Math.PI / 2, true);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - rr * 2, bevelEnabled: true,
    bevelSegments: seg, steps: 1, bevelSize: rr, bevelThickness: rr, curveSegments: seg });
  g.center(); return g;
}
export function box(p, w, h, d, r, mat, x, y, z) {
  const m = new THREE.Mesh(roundedBox(w, h, d, r), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  p.add(m); return m;
}
export function cyl(p, rt, rb, h, seg, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  p.add(m); return m;
}
/** 삼각 기둥(박공·물매). 압출 방향을 **가운데로 옮겨** 둡니다 —
    안 옮기면 한쪽으로만 뻗어서 지붕이 건물 밖으로 흘러내립니다.
    (실제로 그 이유로 지붕이 오른쪽으로 3칸 튀어나왔습니다.) */
export function prism(p, w, h, d, mat, x, y, z, bevel = .12) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: bevel,
    bevelThickness: bevel, bevelSegments: 3, steps: 1 });
  g.translate(0, 0, -d / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  p.add(m); return m;
}

/* ---- 창 — 틀 · 유리 · 반사 · 문설주 둘 · 창턱 여섯 조각 ---- */
export function win(p, C, x, y, z, ry, w, h, style) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; p.add(g);
  box(g, w + .26, h + .26, .16, .06, M(C.frame, .5), 0, 0, 0);
  box(g, w, h, .2, .04, M(C.glass, .18), 0, 0, .04);
  box(g, w * .5, h * .42, .22, .03, M(C.glassLit, .16), -w * .22, h * .22, .05);
  if (style !== 'round') {
    box(g, .07, h, .26, .02, M(C.frame, .5), 0, 0, .06);
    box(g, w, .07, .26, .02, M(C.frame, .5), 0, 0, .06);
  } else {
    cyl(g, w * .52, w * .52, .16, 22, M(C.frame, .5), 0, 0, .01).rotation.x = Math.PI / 2;
    cyl(g, w * .42, w * .42, .2, 22, M(C.glass, .18), 0, 0, .05).rotation.x = Math.PI / 2;
    cyl(g, w * .2, w * .2, .22, 18, M(C.glassLit, .16), -w * .1, w * .1, .07).rotation.x = Math.PI / 2;
  }
  if (style === 'arch') {
    cyl(g, (w + .26) / 2, (w + .26) / 2, .16, 22, M(C.frame, .5), 0, h / 2, 0).rotation.x = Math.PI / 2;
    cyl(g, w / 2, w / 2, .2, 22, M(C.glass, .18), 0, h / 2, .04).rotation.x = Math.PI / 2;
  }
  box(g, w + .42, .13, .3, .05, M(C.trim, .55), 0, -h / 2 - .16, .05);
  return g;
}
/* ---- 문 — 문틀 · 두 짝 · 패널 넷 · 손잡이 둘 ---- */
export function door(p, C, x, y, z, w, h) {
  const g = new THREE.Group(); g.position.set(x, y, z); p.add(g);
  box(g, w + .22, h + .2, .18, .06, M(C.doorDark, .6), 0, 0, 0);
  [-1, 1].forEach((s) => {
    box(g, w / 2 - .04, h, .2, .05, M(C.door, .55), s * (w / 4 + .02), 0, .06);
    box(g, w / 2 - .3, h * .34, .22, .04, M(C.doorLight, .5), s * (w / 4 + .02), h * .22, .09);
    box(g, w / 2 - .3, h * .3, .22, .04, M(C.doorLight, .5), s * (w / 4 + .02), -h * .2, .09);
    cyl(g, .07, .07, .12, 12, M(C.gold, .35), s * .16, 0, .16).rotation.x = Math.PI / 2;
  });
  return g;
}
/* ---- 계단 — 아래로 갈수록 넓어집니다 ---- */
export function steps(p, C, x, y, z, w, n = 3) {
  for (let i = 0; i < n; i++)
    box(p, w + i * .5, .26, .5 + i * .12, .05, M(i % 2 ? C.stoneDark : C.stone, .7),
        x, y - i * .24, z + i * .38);
}
/* ---- 기둥 — 주초 · 몸통 · 주두 ---- */
export function column(p, C, x, y, z, h, r = .2) {
  box(p, r * 2.9, .22, r * 2.9, .05, M(C.trim, .45), x, y + .11, z);
  cyl(p, r, r * 1.05, h, 16, M(C.trim, .5), x, y + .11 + h / 2, z);
  box(p, r * 2.7, .2, r * 2.7, .05, M(C.trim, .45), x, y + .11 + h, z);
}
/* ---- 나무 — 물방울. 꼭대기가 뾰족하게 닫혀야 합니다 ----
   전 판은 반지름이 0 이 아닌 채로 끝나서 **위가 잘려** 보였습니다. */
export function tree(p, C, x, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); p.add(g);
  cyl(g, .16, .22, .85, C.seg ? 7 : 10, M(C.trunk, .8), 0, .55, 0);
  const pts = [];
  const N = C.lod || 16;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const r = Math.sin(Math.pow(t, .8) * Math.PI) * 1.05 * (1 - t * .08);
    pts.push(new THREE.Vector2(Math.max(.012, r), t * 2.8));
  }
  const l = new THREE.Mesh(new THREE.LatheGeometry(pts, C.seg || 22), M(C.leaf, .72));
  l.position.y = .95; l.castShadow = true; l.receiveShadow = true; g.add(l);
  return g;
}
export function bush(p, C, x, z, s = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(.62 * s, C.seg ? 11 : 18, C.seg ? 8 : 12), M(C.leaf, .78));
  m.position.set(x, .5 * s, z); m.scale.y = .82;
  m.castShadow = true; m.receiveShadow = true; p.add(m);
}
/* ---- 받침판 — 흙테 · 바닥 · 잔디 조각 · 진입로 ---- */
export function plate(p, C, S = 15) {
  box(p, S + .4, 1.3, S + .4, .5, M(C.baseDark, .75), 0, -.85, 0).castShadow = false;
  box(p, S, 1.0, S, .42, M(C.base, .62), 0, -.55, 0).castShadow = false;
  /* 조각 넷이 가운데에서 만나야 합니다 — 벌어져 있으면 마당이 아니라
     따로 놓인 매트 넉 장으로 보였습니다. */
  const q = S * .39, o = S * .245;
  [[-o, -o], [o, -o], [-o, o], [o, o]].forEach(([x, z]) => {
    box(p, q * 1.6, .3, q * 1.6, .34, M(C.grassDark, .8), x, .01, z).castShadow = false;
    box(p, q * 1.6 - .3, .3, q * 1.6 - .3, .3, M(C.grass, .78), x, .06, z).castShadow = false;
  });
  /* 길은 잔디보다 **위**에 깔아야 보입니다. 전에는 밑에 깔려 사라졌습니다. */
  box(p, 3.0, .3, S * .5, .2, M(C.path, .7), 0, .14, S * .31).castShadow = false;
}
/* ---- 간판 — 판 하나에 글자 면 한 장 ----
   ExtrudeGeometry 는 면 묶음이 둘뿐이라 여섯 재질을 못 받습니다.
   판을 먼저 만들고 글자는 **앞면에 얇은 판 한 장**으로 붙입니다. */
export function sign(p, text, x, y, z, w, h, bg, fg) {
  const g = new THREE.Group(); g.position.set(x, y, z); p.add(g);
  box(g, w, h, .26, .07, M(bg, .5), 0, 0, 0);
  const c = document.createElement('canvas');
  c.width = 640; c.height = 200;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 640, 200);
  ctx.font = '800 96px "Pretendard","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = fg; ctx.fillText(text, 320, 108);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(w - .16, h - .16),
    new THREE.MeshStandardMaterial({ map: tex, roughness: .5 }));
  pl.position.z = .15; g.add(pl);
  return g;
}

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
/* seg 은 모서리를 몇 조각으로 깎을지입니다. 예전에는 크기와 상관없이
   늘 4 였습니다 — 그래서 2cm 짜리 벤치 널빤지 하나가 716 삼각형이었고,
   섬 전체의 삼각형 절반이 **눈에 안 보이는 모서리**였습니다.
   재 봤습니다: 반지름이 9cm 아래면 1 조각과 4 조각이 화면에서
   구분이 안 됩니다(1~3px 띠). 25cm 아래는 2 조각이면 충분합니다.
   그 위(울타리·기둥)는 깎은 자리가 실제로 보이므로 4 를 그대로 둡니다.
   seg 을 직접 넘기면 그 값이 이깁니다 — 부르는 쪽이 더 잘 압니다. */
export function roundedBox(w, h, d, r, seg) {
  const eps = 1e-5;
  r = Math.max(.004, Math.min(r, w / 2 - .004, h / 2 - .004, d / 2 - .004));
  if (seg === undefined) seg = r < .09 ? 1 : r < .25 ? 2 : 4;
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
/* ---- 현관 — 계단이 아니라 아치 ----
   전 판은 문 앞에 계단 서너 단을 깔았습니다. 그런데 그 계단은
   **바닥보다 아래로** 내려가서 잔디에 반쯤 묻혔고, 문과도 떨어져
   회색 판때기가 따로 놓인 것처럼 보였습니다.

   대학 건물의 현관은 계단이 아니라 **아치**가 만듭니다. 문을 감싸는
   반원 테두리 하나면 같은 벽이 현관이 됩니다 — 그리고 아치는 우리
   월드의 다른 아치창과 같은 어휘라 재질이 안 갈라집니다.

     아치 링   문 위를 감싸는 반원. 벽보다 앞으로 나옵니다
     필라스터  아치를 받치는 납작한 기둥 둘
     키스톤    아치 꼭대기의 쐐기돌
     포석      문 앞 바닥. 잔디가 벽까지 오는 것을 막습니다

   높이 차를 없앴으므로 계단이 필요 없습니다 — 문턱만 한 단. */
export function archPortal(p, C, x, y, z, w, h) {
  const g = new THREE.Group(); g.position.set(x, y, z); p.add(g);
  const hw = w / 2 + .42;             // 아치 안쪽 반지름
  const t = .34;                      // 테두리 두께

  /* 아치 링 — 바깥 반원에서 안쪽 반원을 뺍니다 */
  const sh = new THREE.Shape();
  sh.absarc(0, 0, hw + t, 0, Math.PI, false);
  sh.lineTo(-hw, 0);
  sh.absarc(0, 0, hw, Math.PI, 0, true);
  sh.closePath();
  const ring = new THREE.Mesh(
    new THREE.ExtrudeGeometry(sh, { depth: .42, bevelEnabled: true,
      bevelSize: .05, bevelThickness: .05, bevelSegments: 2, curveSegments: 14 }),
    M(C.trim, .62));
  ring.position.set(0, h * .52, .06);
  ring.castShadow = true; ring.receiveShadow = true;
  g.add(ring);

  /* 필라스터 둘 — 아치를 받칩니다. 없으면 아치가 벽에 떠 있습니다 */
  [-1, 1].forEach((s) => {
    box(g, t, h * .52, .44, .05, M(C.trim, .6), s * (hw + t / 2), h * .26, .06);
    box(g, t + .22, .2, .58, .05, M(C.trim, .5), s * (hw + t / 2), h * .52, .06);
    box(g, t + .26, .18, .6, .05, M(C.trim, .5), s * (hw + t / 2), .09, .06);
  });
  /* 키스톤 */
  box(g, .38, .54, .5, .05, M(C.stone, .6), 0, h * .52 + hw + t * .5, .1);

  /* 아치 안쪽 벽 — 문이 조금 들어가 앉게 만듭니다 */
  box(g, hw * 2, h * .52 + hw, .16, .04, M(C.stoneDark, .8), 0, (h * .52 + hw) / 2, -.02);
  return g;
}

/* ---- 문 앞 포석 ----
   계단을 대신합니다. 문턱 한 단과 바닥 판만 — 잔디가 벽까지 오면
   대학이 아니라 들판에 선 집이 됩니다. */
export function apron(p, C, x, y, z, w) {
  /* 얇게. 두껍게 깔았더니 **흰 욕조**가 문 앞에 놓인 것처럼 보였습니다 —
     포석은 바닥이지 물건이 아닙니다. 높이를 6cm 로 낮추고, 색도 밝은
     흰돌에서 캠퍼스 포석과 같은 따뜻한 값으로 내립니다. */
  box(p, w + 3.0, .06, 3.8, .04, M(0xE6DCC4, .84), x, .126, z + 1.2);
  box(p, w + 1.8, .05, 2.6, .03, M(0xD8CCB0, .86), x, .152, z + 1.0);
  /* 문턱 한 단 — 계단 대신 이것 하나뿐입니다 */
  box(p, w + .5, .12, .55, .04, M(C.stone, .72), x, .17, z - .05);
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
  /* 간판 —
     · 캔버스를 판의 **가로세로비 그대로** 만듭니다. 전에는 640×200 고정이라
       판마다 글자가 늘어나거나 짜부라졌습니다.
     · 웹폰트가 로드된 **뒤에 한 번 더** 그립니다. 로드 전에 그리면
       기본 글꼴로 구워져 끝까지 그대로 남습니다.
     · 이 재질에는 map 이 있으므로 bake 가 절대 합치지 않습니다. */
  const g = new THREE.Group(); g.position.set(x, y, z); p.add(g);
  box(g, w, h, .26, .07, M(bg, .5), 0, 0, 0);
  const PX = 150;
  const cw = Math.round((w - .16) * PX), ch = Math.round((h - .16) * PX);
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const ctx = c.getContext('2d');
  const draw = () => {
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
    /* 안쪽 테두리 선 하나 — 판이 "만든 간판" 으로 읽힙니다 */
    ctx.strokeStyle = fg; ctx.globalAlpha = .38; ctx.lineWidth = Math.max(2, ch * .028);
    const inset = ch * .09;
    ctx.strokeRect(inset, inset, cw - inset * 2, ch - inset * 2);
    ctx.globalAlpha = 1;
    let fs = Math.round(ch * .5);
    const fam = '"Wanted Sans Variable","Wanted Sans","Pretendard","Malgun Gothic","Apple SD Gothic Neo",sans-serif';
    ctx.font = `800 ${fs}px ${fam}`;
    /* 글자가 판보다 길면 **줄입니다** — 자르지 않습니다 */
    const maxW = cw - inset * 2 - ch * .3;
    const tw = ctx.measureText(text).width;
    if (tw > maxW) { fs = Math.floor(fs * maxW / tw); ctx.font = `800 ${fs}px ${fam}`; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = fg;
    ctx.fillText(text, cw / 2, ch * .54);
    tex.needsUpdate = true;
  };
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(w - .16, h - .16),
    new THREE.MeshStandardMaterial({ map: tex, roughness: .5 }));
  pl.position.z = .15; g.add(pl);
  draw();
  if (document.fonts?.ready) document.fonts.ready.then(draw).catch(() => {});
  return g;
}

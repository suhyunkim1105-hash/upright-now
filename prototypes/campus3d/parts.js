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
  /* y 는 **문 바닥**입니다. 여기서 아래로 조금 더 내려 바닥에 닿게 합니다 —
     건물 바닥(Y=.12)과 포석 사이의 턱을 받침이 넘어야 뜬 것처럼 안 보입니다. */
  const g = new THREE.Group(); g.position.set(x, y, z); p.add(g);
  const hw = w / 2 + .40;             // 아치 안쪽 반지름
  const t = .32;                      // 테두리 두께
  const spring = h + .12;             // **문 위에서** 솟습니다
  const drop = .34;                   // 받침이 바닥 아래로 내려가는 깊이

  /* 아치 링 — 바깥 반원에서 안쪽 반원을 뺍니다 */
  const sh = new THREE.Shape();
  sh.absarc(0, 0, hw + t, 0, Math.PI, false);
  sh.lineTo(-hw, 0);
  sh.absarc(0, 0, hw, Math.PI, 0, true);
  sh.closePath();
  const ring = new THREE.Mesh(
    new THREE.ExtrudeGeometry(sh, { depth: .40, bevelEnabled: true,
      bevelSize: .05, bevelThickness: .05, bevelSegments: 2, curveSegments: 16 }),
    M(C.trim, .62));
  ring.position.set(0, spring, .05);
  ring.castShadow = true; ring.receiveShadow = true;
  g.add(ring);

  /* 필라스터 둘 — **바닥부터 아치까지** 한 줄로 섭니다.
     전 판은 문 높이의 절반에서 끊겨, 아치가 공중에 뜬 것처럼 보였습니다. */
  [-1, 1].forEach((s) => {
    const px = s * (hw + t / 2);
    box(g, t, spring + drop, .42, .05, M(C.trim, .6), px, (spring - drop) / 2, .05);
    box(g, t + .2, .18, .54, .05, M(C.trim, .5), px, spring, .05);      // 주두
    box(g, t + .26, .22, .58, .05, M(C.trim, .5), px, -drop + .11, .05); // 주초 — 바닥에 닿는 단
  });
  /* 키스톤 */
  box(g, .36, .5, .48, .05, M(C.stone, .6), 0, spring + hw + t * .5, .09);

  /* 아치 안쪽 벽 — 문이 조금 들어가 앉게 만듭니다 */
  box(g, hw * 2, spring + hw, .16, .04, M(C.stoneDark, .8), 0, (spring + hw) / 2 - drop / 2, -.03);
  return g;
}

/* ---- 문 앞 포석 ----
   계단을 대신합니다. 문턱 한 단과 바닥 판만 — 잔디가 벽까지 오면
   대학이 아니라 들판에 선 집이 됩니다. */
export function apron(p, C, x, y, z, w) {
  /* 얇게. 두껍게 깔았더니 **흰 욕조**가 문 앞에 놓인 것처럼 보였습니다 —
     포석은 바닥이지 물건이 아닙니다. 6cm 로 낮추고 캠퍼스 석재 톤으로.

     아치 받침이 이 위에 앉으므로 **문 앞이 가장 높고** 바깥으로 한 단씩
     내려갑니다 — 계단이 아니라 물매입니다. */
  box(p, w + 3.4, .05, 4.2, .04, M(0xE6DCC4, .84), x, .10, z + 1.5);
  box(p, w + 2.2, .06, 3.0, .03, M(0xDCD0B6, .86), x, .135, z + 1.1);
  box(p, w + 1.2, .07, 1.9, .03, M(C.stone, .78), x, .165, z + .7);
}
/* ---- 현관 계단 ----
   apron() 을 대신합니다.

   apron 은 바닥 판입니다. 아이콘 크기(폭 4~6)에서는 문 앞 포석으로
   맞았는데, 배율 3.0 으로 세운 큰 건물에서는 폭 30칸짜리 **흰 종이 한
   장**이 벽 밑에 깔린 꼴이 됐습니다. 게다가 큰 건물은 기단 위에 올라서
   있어서 1.1칸쯤 높이차가 생기는데, 판만 깔면 아무도 그 턱을 넘지
   않습니다 — 벽이 땅에서 그냥 시작해 버립니다.

   계단이 지켜야 하는 것 둘.

     **문 앞이 아니라 폭 전체에 답니다.** 문 앞에만 좁게 놓으면 그것이
     전에 지적받은 "따로 놓인 회색 판때기" 가 됩니다. 낮고 넓으면
     계단이 아니라 기단의 일부로 읽힙니다.

     **양끝을 막습니다.** 옆 난간(cheek)이 없으면 단이 허공에서 끝나
     잘린 것처럼 보입니다. 실제 계단이 늘 볼을 세우는 이유입니다.

   단은 아래로 갈수록 앞으로 더 나옵니다. 상자를 겹쳐 쌓아 만들므로
   틈이 안 생깁니다 — 판을 따로 놓으면 모서리마다 실틈이 보입니다.
*/
export function steps(p, C, x, z, w, rise, depth = 1.5, n = 3) {
  const g = new THREE.Group(); g.position.set(x, 0, z); p.add(g);
  for (let i = 0; i < n; i++) {
    const h = rise * (i + 1) / n;                 // 이 단 윗면 높이
    const d = depth * (n - i) / n;                // 앞으로 나온 길이
    /* 전부 같은 석재로 둡니다. 윗단만 밝은 돌로 했더니 넓은 **흰 선반**이
       문 앞에 놓여, 걷어냈던 apron 이 그대로 돌아왔습니다. */
    const b = box(g, w + (n - i) * .34, h, d * 2, .05, M(C.stoneDark, .82), 0, h / 2, d);
    b.castShadow = false;                          // 낮고 넓어 그림자가 지저분해집니다
    /* 코 — 단마다 앞선을 한 줄 얹어야 계단으로 보입니다.
       면만 쌓으면 위에서 볼 때 단이 몇인지 안 읽힙니다. */
    box(g, w + (n - i) * .34 + .1, .07, .2, .03, M(C.trim, .62), 0, h, d * 2 - .06)
      .castShadow = false;
  }
  /* 옆 볼 — 계단 양끝을 막는 낮은 벽 */
  [-1, 1].forEach((s) => box(g, .44, rise + .3, depth * 2.05, .06,
    M(C.trim, .62), s * (w / 2 + .42), (rise + .3) / 2, depth * .96));
  /* 문턱 — 계단 맨 위와 벽 사이 한 뼘 */
  box(g, w + .34, rise + .06, .7, .04, M(C.stoneDark, .8), 0, (rise + .06) / 2, -.3);
  return g;
}

/* ---- 문설주 ----
   문을 벽면과 같은 높이에 붙이면 스티커가 됩니다. 벽을 조금 파고
   그 안에 문을 앉히면 그림자가 한 줄 생기고, 그 그림자가 "여기가
   들어가는 곳" 을 말합니다. 불리언 없이 하려면 어두운 판을 뒤에 대고
   좌우와 위를 두꺼운 테로 감싸면 같은 인상이 납니다. */
export function reveal(p, C, x, y, z, w, h, dep = .34) {
  const g = new THREE.Group(); g.position.set(x, y, z); p.add(g);
  box(g, w + .5, h + .4, dep, .04, M(C.stoneDark, .86), 0, (h + .4) / 2 - .2, -dep / 2);
  [-1, 1].forEach((s) => box(g, .34, h + .5, dep + .2, .05, M(C.trim, .6),
                             s * (w / 2 + .42), (h + .5) / 2 - .2, dep * .1));
  box(g, w + 1.2, .34, dep + .26, .05, M(C.trim, .55), 0, h + .22, dep * .1);
  return g;
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

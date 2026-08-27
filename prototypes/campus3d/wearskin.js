/* ══════════════════════════════════════════════════════════
   옷 — **몸 표면을 떼어 내서** 만듭니다.

   앞 판은 옷을 따로 빚어 몸 위에 얹었습니다. 사람 몸에 맞춘 한 벌을
   네 종에 그대로 씌우는 것이라 어디에서도 안 맞았습니다 — 기린에서는
   옷이 몸 안으로 들어가 민트 조각만 옆구리로 삐져나왔고, 거북이에서는
   등딱지를 뚫었고, 넷 다 뼈를 안 따라가서 뛸 때 몸에서 떨어졌습니다.

   여기서는 옷을 안 빚습니다. **원본 메시에서 옷이 덮을 띠만 떼어 내
   법선 방향으로 밀고 색을 칠합니다.**

     · 핏이 정의상 완벽합니다 — 옷이 몸 표면 그 자체라 뚫고 나올 수도,
       안으로 들어갈 수도 없습니다
     · 뼈를 다시 안 붙입니다 — skinIndex · skinWeight 를 그대로 물려받아
       같은 skeleton 에 bind 하므로 뛰든 앉든 몸과 같이 접힙니다
     · 소매가 공짜입니다 — 팔이 상의 띠 높이 안에 있으니 팔 표면이
       그대로 소매가 됩니다

   ── 띠를 어디서 끊는가 ──
   손으로 적지 않습니다. 앞 판이 그러다 네 종에 다 틀렸습니다. 몸을
   **재서** 냅니다(bodyBands). 네 종이 같은 뼈대로 만들어져서 실루엣의
   마디가 거의 같은 자리에 있습니다.

     허리   몸통에서 가장 굵은 칸을 찾고, 거기서 **내려가며** 굵기가
            72% 아래로 떨어지는 첫 자리. 팔이 벌어지기 시작하는 곳입니다
     가슴   같은 데서 **올라가며** 65% 아래로 떨어지는 첫 자리. 목이
            잘록해지는 곳이라, 기린은 목 밑에서 끊기고 목이 없는
            개구리·거북이는 턱까지 올라갑니다
     발목   허리의 42%. 발은 종마다 벌어진 모양이 달라 굵기로는 안
            잡히고, 다리 길이에 비례하는 쪽이 넷 다 맞았습니다

   ── 축 ──
   **형상 좌표와 화면 좌표가 다릅니다.** 원본은 +X 를 보고 서 있고
   chars.js 가 노드를 -90도 돌려 세웁니다. 그래서 형상 안에서는

       화면 x = **형상 -z**          화면 z = 형상 +x

   입니다. 띠를 떼는 일은 높이만 보므로 상관없지만, 모자·안경처럼
   **자리를 잡아야 하는 것**은 여기서 한 번 틀리면 얼굴 대신 옆통수에
   안경이 걸립니다. 그래서 재는 곳(measure)에서 화면 축으로 바꿔
   내보내고, 아래쪽은 전부 키 1.9 기준 화면 좌표만 씁니다.

   ── 값 ──
   띠 형상은 (종 · 높이 · 두께) 마다 **한 번만** 만들어 곳간에 둡니다.
   형상은 여럿이 같이 볼 수 있고 skeleton 만 메시마다 따로 묶습니다.
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { M } from './parts.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

/* 옷 두께 — 키 1.9 기준. 이보다 얇으면 몸과 z 싸움이 나고, 두꺼우면
   겨드랑이·목처럼 오목한 데서 반대편 몸을 뚫습니다. */
const THICK = 0.012;
/* 상의는 하의보다 조금 더 밀어 둡니다 — 허리에서 두 띠가 겹치는데
   같은 높이면 그 자리에서 두 색이 서로를 뚫고 깜빡입니다. */
const THICK_TOP = 0.016;
/* 옷깃 · 줄무늬는 옷보다 한 겹 더 */
const THICK_TRIM = 0.021;
const NORM_H = 1.9;

/* ── 몸 재기 ────────────────────────────────────────────── */
const BANDS = new Map();   // 종 → 마디

/** 세로로 잘라 가며 굵기와 앞쪽 끝을 잽니다.
    나오는 값은 전부 **키 1.9 기준 화면 좌표**입니다. */
function measure(geo) {
  const pos = geo.getAttribute('position');
  if (!geo.boundingBox) geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const y0 = bb.min.y, h = (bb.max.y - bb.min.y) || 1;
  const k = NORM_H / h;
  const B = 48;
  const xLo = new Float32Array(B).fill(1e9), xHi = new Float32Array(B).fill(-1e9);
  const zLo = new Float32Array(B).fill(1e9), zHi = new Float32Array(B).fill(-1e9);
  for (let i = 0; i < pos.count; i++) {
    const b = Math.min(B - 1, Math.max(0, (((pos.getY(i) - y0) / h) * B) | 0));
    const x = -pos.getZ(i) * k;                     // 형상 z = 화면 -x
    const z = pos.getX(i) * k;                      // 형상 +x = 화면 앞
    if (x < xLo[b]) xLo[b] = x; if (x > xHi[b]) xHi[b] = x;
    if (z < zLo[b]) zLo[b] = z; if (z > zHi[b]) zHi[b] = z;
  }
  /* **가운데를 따로 잽니다.** 거북이·펭귄은 형상이 좌우로 0.1 밀려
     있어서, 0 을 가운데로 치면 모자가 옆통수에 걸립니다. */
  const hw = new Float32Array(B), cx = new Float32Array(B);
  const front = new Float32Array(B).fill(-1e9), cz = new Float32Array(B);
  for (let b = 0; b < B; b++) {
    if (xHi[b] < xLo[b]) continue;
    hw[b] = (xHi[b] - xLo[b]) / 2; cx[b] = (xHi[b] + xLo[b]) / 2;
    front[b] = zHi[b];             cz[b] = (zHi[b] + zLo[b]) / 2;
  }
  return { hw, front, cx, cz, B };
}

const bin = (t, B) => Math.min(B - 1, Math.max(0, (t * B) | 0));

/** 재서 나온 마디. 종마다 한 번만 부릅니다. */
export function bodyBands(species, geo) {
  const hit = BANDS.get(species);
  if (hit) return hit;
  const { hw, front, cx, cz, B } = measure(geo);

  /* 몸통에서 가장 굵은 칸. 머리가 더 굵은 종(거북이·개구리)이 있어서
     아래 절반에서만 찾습니다 — 머리는 옷이 안 닿는 데입니다. */
  let peak = 0, peakI = 0;
  for (let i = (B * .12) | 0; i < B * .5; i++) if (hw[i] > peak) { peak = hw[i]; peakI = i; }

  /* 허리 — 굵기가 몸통 최대의 72% 아래로 떨어지는 첫 자리. 팔이 벌어지기
     시작하는 데입니다. 아래로는 다리가 계속 가늘어지기만 해서 잘록한
     데가 없으므로, 여기는 문턱값이 맞습니다. */
  let wi = peakI;
  while (wi > 1 && hw[wi] >= peak * .72) wi--;

  /* 가슴 — **잘록한 데를 찾습니다.** 문턱값으로 잡던 앞 판은 펭귄에서
     너무 일찍 끊겨 반팔티가 튜브톱이 됐습니다. 날개가 벌어진 자리가
     최대라 65% 선이 배 한가운데였습니다.

     목은 굵기가 줄다가 **다시 늘기 시작하는** 자리입니다(그 위는 머리).
     넷 다 이 규칙이 목에 정확히 떨어집니다 — 기린 t.54 · 펭귄 t.51 ·
     거북이 t.54 · 개구리 t.57. 한 칸 튀는 것에 안 속게 두 칸 이상
     이어서 늘 때만 멈춥니다. */
  let ci = peakI, rise = 0;
  for (let i = peakI + 1; i < B - 1; i++) {
    if (hw[i] > hw[i - 1] * 1.02) { if (++rise >= 2) break; } else { rise = 0; ci = i; }
  }

  const waist = (wi + 1) / B;
  const chest = (ci + 1) / B;

  /* 얼굴 — 가슴 위쪽에서 가장 앞으로 나온 칸(펭귄은 부리, 기린은 주둥이) */
  let fi = ci, fz = -1e9;
  for (let i = ci; i < B; i++) if (front[i] > fz) { fz = front[i]; fi = i; }

  /* 모자선 — 머리에서 가장 굵은 데를 찾고, **정수리에서 내려오며** 굵기가
     88% 로 돌아오는 첫 자리. 거기가 모자가 걸리는 데입니다.
     높이를 못 박으면(앞 판은 .93 이었습니다) 눈이 머리 위에 붙은 개구리는
     모자가 눈을 덮고, 뿔이 솟은 기린은 뿔에 걸려 뜹니다. */
  let hp = 0;
  for (let i = ci; i < B; i++) if (hw[i] > hp) hp = hw[i];
  let hi2 = B - 1;
  while (hi2 > ci && hw[hi2] < hp * .88) hi2--;
  const hatT = (hi2 + .5) / B;

  /* 어깨 — 굵기가 몸통 최대의 70% 로 줄어드는 첫 자리. **가슴선과 다릅니다.**
     가슴은 목이 잘록해지는 데라 기린에서는 목 꼭대기(y 1.03)까지 올라가
     옷에는 맞아도(터틀넥으로 읽힙니다) 가방에는 안 맞습니다 — 가방을
     거기까지 올리면 윗절반이 목 뒤에 떠 있게 됩니다. */
  let si2 = peakI;
  while (si2 < B - 1 && hw[si2] >= peak * .70) si2++;
  const shoulder = si2 / B;

  const out = {
    ankle: waist * .42, waist, chest, shoulder,
    faceT: (fi + .5) / B, faceZ: fz, hatT,
    /* 눈은 주둥이와 모자선 사이입니다. 넷 다 이 셈이 눈에 떨어집니다 */
    eyeT: ((fi + .5) / B + hatT) / 2,
    hw, front, cx, cz, B, peak,
    /* t 높이의 값. 띠 밖을 물으면 가장 가까운 칸을 줍니다. */
    widthAt: (t) => hw[bin(t, B)],
    frontAt: (t) => front[bin(t, B)],
    cxAt: (t) => cx[bin(t, B)],
    czAt: (t) => cz[bin(t, B)],
    /* 구간으로 묻는 길 — 물건은 한 점이 아니라 높이를 차지합니다.
       한 칸만 재서 붙이면 그 위아래가 몸에서 떠 버립니다. */
    backOver: (t0, t1) => {
      let v = 1e9;
      for (let i = bin(t0, B); i <= bin(t1, B); i++) {
        const b = 2 * cz[i] - front[i];
        if (front[i] > -1e8 && b < v) v = b;
      }
      return v > 1e8 ? cz[bin(t0, B)] : v;
    },
    widthOver: (t0, t1) => {
      let v = 0;
      for (let i = bin(t0, B); i <= bin(t1, B); i++) if (hw[i] > v) v = hw[i];
      return v;
    },
  };
  BANDS.set(species, out);
  return out;
}

/* ── 띠 떼어 내기 ──────────────────────────────────────── */
const SHELL = new Map();   // '종|t0|t1|두께' → BufferGeometry

/**
 * 몸 표면에서 t0~t1 높이의 띠만 떼어 낸 형상.
 * 경계에 걸친 삼각형은 **버리지 않고 잘라 씁니다**. 삼각형째 넣거나 빼면
 * 밑단이 톱니가 되는데, 이 메시의 삼각형 한 변이 3cm 라 눈에 그대로
 * 보입니다. 잘라 쓰면 밑단이 정확히 그 높이에서 한 줄로 끝납니다.
 */
function shellGeo(species, src, t0, t1, thick) {
  const key = species + '|' + t0.toFixed(3) + '|' + t1.toFixed(3) + '|' + thick;
  const hit = SHELL.get(key);
  if (hit !== undefined) return hit;

  const geo = src.geometry;
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const si = geo.getAttribute('skinIndex');
  const sw = geo.getAttribute('skinWeight');
  const idx = geo.getIndex();
  if (!pos || !nor || !si || !sw || !idx) { SHELL.set(key, null); return null; }
  if (!geo.boundingBox) geo.computeBoundingBox();
  const y0 = geo.boundingBox.min.y;
  const h = (geo.boundingBox.max.y - geo.boundingBox.min.y) || 1;
  /* 두께는 화면에서 늘 같아야 하므로, 이 몸이 키 1.9 로 줄어드는 배율만큼
     미리 키워 둡니다 */
  const push = thick * h / NORM_H;

  const tOf = (i) => (pos.getY(i) - y0) / h;
  const P = [], N = [], J = [], W = [], I = [];

  /* 꼭짓점 하나. 두 개를 섞을 때는 **뼈를 안 섞습니다** — 가까운 쪽 것을
     통째로 씁니다. 섞으면 팔 정점이 다리 뼈를 물고 늘어집니다. 자르는
     자리가 거의 수평이라 양 끝의 뼈가 어차피 같습니다. */
  const put = (v) => {
    const n = P.length / 3;
    P.push(v.px + v.nx * push, v.py + v.ny * push, v.pz + v.nz * push);
    N.push(v.nx, v.ny, v.nz);
    J.push(v.j0, v.j1, v.j2, v.j3);
    W.push(v.w0, v.w1, v.w2, v.w3);
    return n;
  };
  const vert = (i) => ({
    t: tOf(i),
    px: pos.getX(i), py: pos.getY(i), pz: pos.getZ(i),
    nx: nor.getX(i), ny: nor.getY(i), nz: nor.getZ(i),
    j0: si.getX(i), j1: si.getY(i), j2: si.getZ(i), j3: si.getW(i),
    w0: sw.getX(i), w1: sw.getY(i), w2: sw.getZ(i), w3: sw.getW(i),
  });
  const lerp = (a, b, s) => {
    const near = s < .5 ? a : b;
    const L2 = Math.hypot(
      a.nx + (b.nx - a.nx) * s, a.ny + (b.ny - a.ny) * s, a.nz + (b.nz - a.nz) * s) || 1;
    return {
      t: a.t + (b.t - a.t) * s,
      px: a.px + (b.px - a.px) * s, py: a.py + (b.py - a.py) * s, pz: a.pz + (b.pz - a.pz) * s,
      nx: (a.nx + (b.nx - a.nx) * s) / L2,
      ny: (a.ny + (b.ny - a.ny) * s) / L2,
      nz: (a.nz + (b.nz - a.nz) * s) / L2,
      j0: near.j0, j1: near.j1, j2: near.j2, j3: near.j3,
      w0: near.w0, w1: near.w1, w2: near.w2, w3: near.w3,
    };
  };
  /* 반평면 하나로 다각형을 자릅니다(서덜랜드–호지먼). 위/아래 두 번
     돌리면 띠가 남습니다. 삼각형째 버리던 앞 판은 밑단이 톱니였습니다 —
     삼각형 한 변이 3cm 라 눈에 그대로 보입니다. */
  const clip = (poly, keepAbove, lim) => {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ina = keepAbove ? a.t >= lim : a.t <= lim;
      const inb = keepAbove ? b.t >= lim : b.t <= lim;
      if (ina) out.push(a);
      if (ina !== inb) {
        const d = b.t - a.t;
        out.push(lerp(a, b, d === 0 ? 0 : (lim - a.t) / d));
      }
    }
    return out;
  };
  for (let k = 0; k < idx.count; k += 3) {
    const tri = [vert(idx.getX(k)), vert(idx.getX(k + 1)), vert(idx.getX(k + 2))];
    /* 셋 다 밖이면 자를 것도 없습니다 — 대부분이 여기서 걸러집니다 */
    if (tri.every((v) => v.t < t0) || tri.every((v) => v.t > t1)) continue;
    let poly = tri;
    if (tri.some((v) => v.t < t0)) poly = clip(poly, true, t0);
    if (poly.length > 2 && poly.some((v) => v.t > t1)) poly = clip(poly, false, t1);
    if (poly.length < 3) continue;
    const n0 = put(poly[0]);
    let prev = put(poly[1]);
    for (let m = 2; m < poly.length; m++) {
      const cur = put(poly[m]);
      I.push(n0, prev, cur);
      prev = cur;
    }
  }
  if (!I.length) { SHELL.set(key, null); return null; }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(J, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(W, 4));
  g.setIndex(I);
  SHELL.set(key, g);
  return g;
}

/** 띠 하나를 옷으로 세웁니다. 원본과 **같은 skeleton** 에 묶습니다 —
    이 한 줄이 "뛸 때 옷이 몸에서 떨어지는" 문제를 통째로 없앱니다. */
function wearMesh(species, src, t0, t1, mat, thick, name) {
  const g = shellGeo(species, src, Math.max(0, t0), Math.min(1, t1), thick);
  if (!g) return null;
  const m = new THREE.SkinnedMesh(g, mat);
  m.name = name;
  m.bindMode = src.bindMode;
  m.bind(src.skeleton, src.bindMatrix);
  m.castShadow = true; m.receiveShadow = true;
  m.frustumCulled = false;
  src.parent.add(m);
  return m;
}

/* ── 무엇을 어디까지 덮는가 ───────────────────────────── */
/* 절대 높이를 적으면 종마다 다시 틀립니다. 허리·가슴을 **잣대로 쓴
   비율**만 적습니다 — lo·hi 는 0 이면 허리, 1 이면 가슴입니다. */
const TOP_CUT = {
  tee:     { lo: -.08, hi: .86, trim: null },
  shirt:   { lo: -.13, hi: .97, trim: 0xF7FBFF },   // 깃이 높고 흰 깃
  hoodie:  { lo: -.17, hi: 1.0, trim: 'dark' },     // 가장 길고 목까지, 깃이 진함
  varsity: { lo: -.13, hi: .92, trim: 0xF7F0E2 },   // 과잠 — 밑단에 크림 줄
};
/* 하의는 발목~허리 사이를 얼마나 덮는지. 1 이면 발목까지 온전히. */
const BOT_CUT = { jeans: 1, slacks: 1, trainers: .96, shorts: .42 };
/* 신발은 발목 위로 조금 더 올라오는 것이 있습니다 */
const SHOE_CUT = { sneakers: 1.06, slippers: .80, dress: 1.0 };

function mixHex(a, b, k) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (((ar + (br - ar) * k) | 0) << 16) | (((ag + (bg - ag) * k) | 0) << 8) | ((ab + (bb - ab) * k) | 0);
}

/* ── 몸 밖 물건 ───────────────────────────────────────── */
/* 모자 · 안경 · 가방은 몸 표면이 아니라 **몸에 없는 물건**이라 도형으로
   빚습니다. 대신 자리와 크기는 재서 낸 값에서 옵니다.

   다 만든 다음 뼈에 **붙입니다**(Object3D.attach). 자리를 그대로 두고
   부모만 바꾸는 것이라, 모자가 머리를 따라가면서도 처음 놓은 자리에
   그대로 있습니다. 안 붙이면 고개를 돌릴 때 모자만 제자리에 남습니다. */
function prop(bands, look, colorOf) {
  const out = [];   // { slot, id, group, mats }
  const yOf = (t) => t * NORM_H;
  /* 가운데는 0 이 아닙니다 — 거북이·펭귄 형상이 좌우로 밀려 있어서,
     0 에 놓으면 모자가 옆통수에 걸립니다. 그 높이의 실제 가운데를 씁니다. */
  const put = (o, t, dx, dy, dz) => {
    o.position.set(bands.cxAt(t) + (dx || 0), yOf(t) + (dy || 0), bands.czAt(t) + (dz || 0));
    return o;
  };

  if (look.hatId && look.hatId !== 'none') {
    const hm = M(colorOf(look.hatId, look.hat), .58);
    const g = new THREE.Group(); g.name = 'wear-hat';
    const t = bands.hatT;
    const r = bands.widthAt(t) * .99;
    if (look.hatId === 'grad_cap') {
      const dark = M(0x263548, .5);
      const crown = put(new THREE.Mesh(new THREE.CylinderGeometry(r * .58, r * .70, r * .50, 20), dark), t, 0, r * .24, 0);
      const board = put(new THREE.Mesh(new THREE.BoxGeometry(r * 2.3, .034, r * 2.3), dark), t, 0, r * .50, 0);
      board.rotation.y = Math.PI / 4;
      const tassel = put(new THREE.Mesh(new THREE.CylinderGeometry(.012, .020, r * .55, 8), M(0xF4D06F, .48)), t, r * .78, r * .24, 0);
      g.add(crown, board, tassel);
      out.push({ slot: 'hat', id: look.hatId, group: g, mats: [dark] });
    } else {
      /* 반구를 조금 넘겨 깎아야 머리에 **걸린** 것으로 보입니다. 딱 반이면
         얹어 둔 그릇이 됩니다. */
      const dome = put(new THREE.Mesh(
        new THREE.SphereGeometry(r, 24, 14, 0, Math.PI * 2, 0, Math.PI * .58), hm), t, 0, -r * .16, 0);
      dome.scale.y = .82;
      g.add(dome);
      if (look.hatId === 'cap') {
        const brim = put(new THREE.Mesh(new THREE.CylinderGeometry(
          r * 1.02, r * 1.02, .028, 24, 1, false, -Math.PI * .38, Math.PI * .76), hm), t, 0, -r * .14, r * .42);
        g.add(brim);
      } else {                 /* 비니 — 접은 단이 있어야 비니로 읽힙니다 */
        const cuff = put(new THREE.Mesh(new THREE.TorusGeometry(r * .99, r * .12, 8, 26), hm), t, 0, -r * .12, 0);
        cuff.rotation.x = Math.PI / 2;
        g.add(cuff);
      }
      out.push({ slot: 'hat', id: look.hatId, group: g, mats: [hm] });
    }
  }

  if (look.glassesId && look.glassesId !== 'none') {
    const gm = M(0x263548, .42);
    const g = new THREE.Group(); g.name = 'wear-glasses';
    const t = bands.eyeT;
    /* 그 높이의 앞쪽 끝 살짝 앞. 얼굴이 제일 튀어나온 칸(주둥이·부리)을
       그대로 쓰면 안경이 코끝에 걸립니다. */
    const z = bands.frontAt(t) + .012;
    const r = bands.widthAt(t) * .30;
    const sun = look.glassesId === 'sunglasses';
    const seg = look.glassesId === 'horn' ? 4 : 22;
    [-1, 1].forEach((sd) => {
      const lens = put(new THREE.Mesh(new THREE.TorusGeometry(r, r * (sun ? .20 : .15), 8, seg), gm),
        t, sd * r * 1.14, 0, 0);
      lens.position.z = z;
      lens.rotation.x = Math.PI / 2;
      lens.scale.y = sun ? .70 : (look.glassesId === 'horn' ? .84 : 1);
      g.add(lens);
      if (sun) {
        const dark = put(new THREE.Mesh(new THREE.CircleGeometry(r * .86, 20), M(0x374151, .25)),
          t, sd * r * 1.14, 0, 0);
        dark.position.z = z + .005; dark.scale.y = .70;
        g.add(dark);
      }
    });
    const bridge = put(new THREE.Mesh(new THREE.BoxGeometry(r * .72, r * .17, r * .17), gm), t, 0, 0, 0);
    bridge.position.z = z;
    g.add(bridge);
    out.push({ slot: 'glasses', id: look.glassesId, group: g, mats: [gm] });
  }

  if (look.bagId && look.bagId !== 'none') {
    const bm = M(colorOf(look.bagId, look.bagC), .58);
    const g = new THREE.Group(); g.name = 'wear-bag';
    /* 등판이 차지할 높이를 **먼저** 정하고, 그 구간에서 몸을 잽니다.
       한 칸만 재서 붙이면 윗변이나 아랫변이 몸에서 떠 버립니다. */
    const t0 = bands.waist + (bands.shoulder - bands.waist) * .18;
    const t1 = bands.waist + (bands.shoulder - bands.waist) * .92;
    const r = bands.widthOver(t0, t1);
    const back = bands.backOver(t0, t1);
    const y0b = t0 * NORM_H, y1b = t1 * NORM_H;
    const bh = y1b - y0b, bw = Math.min(r * 1.55, bh * 1.15), bd = bh * .46;
    const cxm = bands.cxAt((t0 + t1) / 2);
    if (look.bagId === 'tote') {
      /* 에코백은 **옆구리에 걸립니다.** 두 가지를 조심합니다.

         굵기는 가방 높이의 최대(r)가 아니라 **가방이 놓인 그 높이**를
         씁니다. 최대를 쓰면 팔이 벌어진 자리 바깥에 놓여서, 몸이 아니라
         팔 옆에 떠 있게 됩니다.

         끈은 몸을 가로지르지 않고 **옆구리를 따라 곧게** 올라갑니다.
         어깨 반대쪽으로 이으면 끈이 몸 속을 지나가다 가슴 한가운데로
         빠져나와, 어깨에 멘 것이 아니라 가슴에 붙인 막대가 됩니다. */
      const ty = bands.waist + (bands.shoulder - bands.waist) * .34;
      const rt = bands.widthAt(ty);
      const tz = bands.czAt(ty);
      const tw2 = bw * .66, th2 = bh * .80;
      /* 안쪽 면을 몸에 **깊이 파묻습니다**(가방 너비의 3분의 1). 겹친 것은
         안 보이지만 벌어진 것은 보입니다 — 값이 한쪽으로만 틀리는 자리라
         일부러 안쪽으로 넘깁니다. 이 높이의 굵기는 팔이 벌어진 자리라
         종마다 크게 달라서, 딱 맞춰 두면 어느 종에서는 반드시 뜹니다. */
      const sx = bands.cxAt(ty) + rt + tw2 * .5 - tw2 * .34;
      const bag = new THREE.Mesh(new THREE.BoxGeometry(tw2, th2, bd * .78), bm);
      bag.position.set(sx, ty * NORM_H, tz);
      g.add(bag);
      const topY = bands.shoulder * NORM_H;
      const from = new THREE.Vector3(sx - tw2 * .22, ty * NORM_H + th2 * .42, tz);
      const to = new THREE.Vector3(bands.cxAt(bands.shoulder) + bands.widthAt(bands.shoulder) * .52,
        topY, bands.czAt(bands.shoulder));
      const strap = new THREE.Mesh(new THREE.BoxGeometry(tw2 * .16, from.distanceTo(to), bd * .30), bm);
      strap.position.copy(from).lerp(to, .5);
      strap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
      g.add(strap);
    } else {
      /* 등판은 몸 뒷면에 **살짝 파묻습니다**. 딱 붙이면 걷는 동안 살이
         조금만 움직여도 틈이 생겼다 없어졌다 합니다. */
      const pack = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), bm);
      pack.position.set(cxm, (y0b + y1b) / 2, back - bd * .34);
      g.add(pack);
      /* 어깨끈 두 줄 — 이게 없으면 등에 붙인 판 하나입니다 */
      const topY = bands.shoulder * NORM_H;
      const topR = bands.widthAt(bands.shoulder);
      [-1, 1].forEach((sd) => {
        const from = new THREE.Vector3(cxm + sd * bw * .30, y1b - bh * .12, back);
        const to = new THREE.Vector3(cxm + sd * topR * .58, topY, bands.czAt(bands.shoulder));
        const strap = new THREE.Mesh(new THREE.BoxGeometry(bw * .16, from.distanceTo(to), bd * .34), bm);
        strap.position.copy(from).lerp(to, .5);
        strap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
        g.add(strap);
      });
    }
    out.push({ slot: 'bag', id: look.bagId, group: g, mats: [bm] });
  }
  out.forEach((o) => o.group.traverse((c) => { c.castShadow = true; c.receiveShadow = true; }));
  return out;
}
/* ── 바깥에서 부르는 것 ───────────────────────────────── */
/**
 * 옷을 입힙니다.
 *   g        캐릭터 그룹 — 키 1.9 로 맞춰진 화면 좌표계입니다
 *   body     그 안의 복제된 몸(스킨드 메시가 들어 있습니다)
 *   species  '기린' 처럼
 *   look     normalizeLook 을 거친 차림
 *   colorOf  (id, 기본색) → 숫자. 염색을 아는 쪽이 넘겨 줍니다
 * 돌려주는 것은 chars.js 의 parts.wear 에 그대로 들어갈 표입니다.
 */
export function dressSkin(g, body, species, look, colorOf) {
  let src = null;
  body.traverse((o) => { if (!src && o.isSkinnedMesh) src = o; });
  if (!src) return {};
  const bands = bodyBands(species, src.geometry);
  const wear = {};
  const reg = (slot, id, mats) => (wear[slot] = {
    id, base: mats[0]?.color?.getHex?.() ?? 0, mats: mats.map((m) => [m, null]),
  });

  /* 허리에서 가슴까지를 0~1 로 보고 옷마다 다르게 끊습니다 */
  const span = Math.max(.02, bands.chest - bands.waist);
  const at = (k) => bands.waist + span * k;

  if (look.topId && look.topId !== 'none') {
    const cut = TOP_CUT[look.topId] || TOP_CUT.tee;
    const c = colorOf(look.topId, look.top);
    const mat = M(c, .62);
    const mats = [mat];
    if (wearMesh(species, src, at(cut.lo), at(cut.hi), mat, THICK_TOP, 'wear-top')) {
      /* 옷깃 · 줄무늬 — 이것도 **띠**입니다. 도형으로 얹으면 다시 뼈를
         안 따라가므로, 옷보다 한 겹 더 민 얇은 띠로 만듭니다. */
      if (cut.trim != null) {
        const tc = cut.trim === 'dark' ? mixHex(c, 0x000000, .16) : cut.trim;
        const tm = M(tc, .54);
        const isVarsity = look.topId === 'varsity';
        /* 과잠은 밑단 줄, 나머지는 목깃. 밑단을 바닥에 딱 붙이면 팔에
           가려서 기린·거북이에서는 안 보입니다 — 한 뼘 올립니다. */
        const lo = isVarsity ? cut.lo + .05 : cut.hi - .13;
        const hi = isVarsity ? cut.lo + .16 : cut.hi;
        if (wearMesh(species, src, at(lo), at(hi), tm, THICK_TRIM, 'wear-trim')) mats.push(tm);
      }
      reg('top', look.topId, mats);
    }
  }

  if (look.bottomId && look.bottomId !== 'none') {
    const k = BOT_CUT[look.bottomId] ?? 1;
    const lo = bands.waist - (bands.waist - bands.ankle) * k;
    const mat = M(colorOf(look.bottomId, look.bottom), .58);
    if (wearMesh(species, src, lo, bands.waist + .006, mat, THICK, 'wear-bottom')) reg('bottom', look.bottomId, [mat]);
  }

  if (look.shoesId && look.shoesId !== 'none') {
    const mat = M(colorOf(look.shoesId, look.shoes), .5);
    if (wearMesh(species, src, 0, bands.ankle * (SHOE_CUT[look.shoesId] ?? 1), mat, THICK, 'wear-shoes')) {
      reg('shoes', look.shoesId, [mat]);
    }
  }

  /* 몸 밖 물건도 **살에 심습니다.**

     처음에는 뼈에 붙였는데(Object3D.attach) 가방이 등에서 떠 있었습니다.
     뼈는 통째로 움직이고 살은 뼈 여럿의 가중치로 움직여서, 같은 동작에도
     둘이 가는 거리가 다릅니다. 모자도 같은 이유로 머리에서 미끄러집니다.

     그래서 붙이지 않고, 물건의 꼭짓점마다 **가장 가까운 몸 꼭짓점의**
     뼈 가중치를 그대로 물려 줍니다. 그러면 물건이 자기가 앉은 살과
     똑같이 움직입니다 — 떠 있을 수가 없습니다. 옷 띠가 안 떠 있는
     것과 같은 이유입니다. */
  for (const p of prop(bands, look, colorOf)) {
    const meshes = skinProp(species, src, p.group);
    if (!meshes.length) continue;
    meshes.forEach((m) => src.parent.add(m));
    reg(p.slot, p.id, p.mats);
  }
  return wear;
}

/* ── 물건을 살에 심기 ─────────────────────────────────── */
/* 몸 꼭짓점을 성긴 격자에 담아 둡니다. 가장 가까운 것을 찾을 때 전부
   훑으면 물건 하나에 수백만 번이 되어, 종마다 한 번이라도 눈에 띕니다. */
const GRID = new Map();   // 종 → { cell, box, at }

function bodyGrid(species, src) {
  const hit = GRID.get(species);
  if (hit) return hit;
  const pos = src.geometry.getAttribute('position');
  const si = src.geometry.getAttribute('skinIndex');
  const sw = src.geometry.getAttribute('skinWeight');
  const bb = src.geometry.boundingBox;
  const span = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) || 1;
  const cell = span / 16;
  const at = new Map();
  const key = (a, b, c) => a + ',' + b + ',' + c;
  for (let i = 0; i < pos.count; i++) {
    const k2 = key(Math.floor(pos.getX(i) / cell), Math.floor(pos.getY(i) / cell), Math.floor(pos.getZ(i) / cell));
    let arr = at.get(k2); if (!arr) at.set(k2, arr = []);
    arr.push(i);
  }
  const out = { cell, at, key, pos, si, sw };
  GRID.set(species, out);
  return out;
}

/** 형상 좌표 한 점에서 가장 가까운 몸 꼭짓점. 없으면 반경을 넓힙니다. */
function nearest(G, x, y, z) {
  const cx = Math.floor(x / G.cell), cy = Math.floor(y / G.cell), cz = Math.floor(z / G.cell);
  for (let r = 0; r <= 6; r++) {
    let best = -1, bd = Infinity;
    for (let a = cx - r; a <= cx + r; a++) {
      for (let b = cy - r; b <= cy + r; b++) {
        for (let c = cz - r; c <= cz + r; c++) {
          /* 껍질만 봅니다 — 안쪽은 지난 바퀴에 이미 봤습니다 */
          if (r > 0 && Math.abs(a - cx) < r && Math.abs(b - cy) < r && Math.abs(c - cz) < r) continue;
          const arr = G.at.get(G.key(a, b, c));
          if (!arr) continue;
          for (const i of arr) {
            const dx = G.pos.getX(i) - x, dy = G.pos.getY(i) - y, dz = G.pos.getZ(i) - z;
            const d = dx * dx + dy * dy + dz * dz;
            if (d < bd) { bd = d; best = i; }
          }
        }
      }
    }
    if (best >= 0) return best;
  }
  return 0;
}

/** 화면 좌표계에 놓인 물건 하나를 원본과 같은 skeleton 에 묶인
    스킨드 메시들로 바꿉니다. */
function skinProp(species, src, group) {
  const geo = src.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const y0 = geo.boundingBox.min.y;
  const h = (geo.boundingBox.max.y - geo.boundingBox.min.y) || 1;
  const k = NORM_H / h;
  const G = bodyGrid(species, src);
  const out = [], byMat = new Map();
  group.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  const nv = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const g2 = o.geometry.index ? o.geometry.toNonIndexed().clone() : o.geometry.clone();
    const p2 = g2.getAttribute('position');
    const n2 = g2.getAttribute('normal');
    nm.getNormalMatrix(o.matrixWorld);
    const J = new Uint16Array(p2.count * 4), W = new Float32Array(p2.count * 4);
    for (let i = 0; i < p2.count; i++) {
      /* 물건의 자리를 꼭짓점에 굳히고(화면 좌표), 형상 좌표로 되돌립니다.
         화면 x = -형상 z · 화면 z = 형상 x · 화면 y = (형상 y - y0) * k */
      v.fromBufferAttribute(p2, i).applyMatrix4(o.matrixWorld);
      const gx = v.z / k, gy = v.y / k + y0, gz = -v.x / k;
      p2.setXYZ(i, gx, gy, gz);
      if (n2) {
        nv.fromBufferAttribute(n2, i).applyMatrix3(nm).normalize();
        n2.setXYZ(i, nv.z, nv.y, -nv.x);
      }
      const j = nearest(G, gx, gy, gz);
      J[i * 4] = G.si.getX(j); J[i * 4 + 1] = G.si.getY(j);
      J[i * 4 + 2] = G.si.getZ(j); J[i * 4 + 3] = G.si.getW(j);
      W[i * 4] = G.sw.getX(j); W[i * 4 + 1] = G.sw.getY(j);
      W[i * 4 + 2] = G.sw.getZ(j); W[i * 4 + 3] = G.sw.getW(j);
    }
    p2.needsUpdate = true; if (n2) n2.needsUpdate = true;
    g2.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(J, 4));
    g2.setAttribute('skinWeight', new THREE.Float32BufferAttribute(W, 4));
    /* **재질별로 모아 둡니다.** 조각마다 메시를 하나씩 세우면 가방 하나가
       등판·어깨끈 둘로 셋이 되고, 광장에 아홉이 서면 그것만 스물일곱
       번을 그립니다. 조각은 서로에 대해 안 움직이니 나눌 이유가 없습니다. */
    let slot2 = byMat.get(o.material);
    if (!slot2) byMat.set(o.material, slot2 = []);
    slot2.push(g2);
  });
  for (const [mat, geos] of byMat) {
    const g2 = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!g2) continue;
    const m = new THREE.SkinnedMesh(g2, mat);
    m.name = group.name;
    m.position.copy(src.position); m.quaternion.copy(src.quaternion); m.scale.copy(src.scale);
    m.bindMode = src.bindMode;
    m.bind(src.skeleton, src.bindMatrix);
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    out.push(m);
  }
  return out;
}

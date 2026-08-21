/* ══════════════════════════════════════════════════════════
   아이소메트릭 그리기 — **2D 픽셀입니다.** 3D 를 비스듬히 찍은 게
   아니라, 다이아 한 칸을 코드로 찍어 쌓습니다.

   한 칸은 가로 32 · 세로 16(2:1). 높이 한 칸도 16 입니다.
     화면가로 = (x − z) × 16
     화면세로 = (x + z) × 8 − y × 16
   세계 좌표(x, z, y)는 3D 판과 **같은 단위**입니다. 그래야 자리
   목록(spots.js)과 사람 경로(npcs.js)를 한 줄도 안 고치고 씁니다.

   면을 다각형으로 칠하지 않고 **줄 단위 fillRect** 로 칠합니다.
   캔버스의 다각형 채우기는 가장자리를 부드럽게 뭉개는데, 그러면
   확대했을 때 픽셀아트가 아니라 흐린 그림이 됩니다.
   ══════════════════════════════════════════════════════════ */

export const UX = 16, UY = 8, UH = 16;

export const px = (x, z) => (x - z) * UX;
export const py = (x, z, y = 0) => (x + z) * UY - y * UH;
/** 깊이 — 클수록 앞. 그리는 차례를 정합니다 */
export const depth = (x, z) => x + z;

/* 색을 밝게 · 어둡게. 면마다 색을 따로 적지 않으려고 씁니다 */
const CACHE = new Map();
export function sh(hex, d) {
  const k = hex + '|' + d;
  let v = CACHE.get(k); if (v) return v;
  const n = parseInt(hex.slice(1), 16);
  const c = (x) => Math.max(0, Math.min(255, x + d));
  v = '#' + [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)]
    .map((x) => x.toString(16).padStart(2, '0')).join('');
  CACHE.set(k, v); return v;
}

const lerpX = (A, B, y) => (B[1] === A[1] ? B[0] : A[0] + (B[0] - A[0]) * (y - A[1]) / (B[1] - A[1]));

/** 다이아 꼭짓점 넷 — 중심(cx,cy)에서 w(동서) · d(남북) 만큼 */
function verts(cx, cy, w, d) {
  return {
    n: [cx + (d - w) * UY, cy - (w + d) * UY / 2],
    e: [cx + (w + d) * UY, cy + (w - d) * UY / 2],
    s: [cx + (w - d) * UY, cy + (w + d) * UY / 2],
    w: [cx - (w + d) * UY, cy + (d - w) * UY / 2],
  };
}

/** 윗면 — 줄마다 좌우 끝을 재서 한 줄씩 칠합니다 */
function topFace(g, v, col) {
  g.fillStyle = col;
  const y0 = Math.round(v.n[1]), y1 = Math.round(v.s[1]);
  for (let y = y0; y < y1; y++) {
    const l = y < v.w[1] ? lerpX(v.n, v.w, y) : lerpX(v.w, v.s, y);
    const r = y < v.e[1] ? lerpX(v.n, v.e, y) : lerpX(v.e, v.s, y);
    const a = Math.round(l), b = Math.round(r);
    if (b > a) g.fillRect(a, y, b - a, 1);
  }
}

/** 옆면 — 세로줄마다 위 끝을 재서 h 픽셀만큼 내려 칠합니다 */
function sideFace(g, A, B, hpx, col) {
  if (hpx <= 0) return;
  g.fillStyle = col;
  const x0 = Math.round(A[0]), x1 = Math.round(B[0]);
  if (x0 === x1) return;
  const st = x0 < x1 ? 1 : -1;
  for (let x = x0; x !== x1; x += st) {
    const t = (x - A[0]) / (B[0] - A[0]);
    g.fillRect(x, Math.round(A[1] + (B[1] - A[1]) * t), 1, hpx);
  }
}

/**
 * 상자 하나. (x, z) 는 바닥 **중심**, y 는 바닥 높이.
 * w(동서) · d(남북) · h(높이) 전부 세계 단위입니다.
 */
export function box(g, o, x, z, y, w, d, h, col, opt = {}) {
  const cx = o.x + px(x, z), cy = o.y + py(x, z, y + h);
  const v = verts(cx, cy, w, d);
  const hpx = Math.max(0, Math.round(h * UH));
  if (hpx > 0) {
    sideFace(g, v.w, v.s, hpx, opt.left || sh(col, -24));
    sideFace(g, v.s, v.e, hpx, opt.right || sh(col, -50));
  }
  topFace(g, v, opt.top || col);
  return v;
}

/** 바닥판 — 윗면만. 깔개 · 마루 · 길 */
export function plate(g, o, x, z, y, w, d, col) {
  topFace(g, verts(o.x + px(x, z), o.y + py(x, z, y), w, d), col);
}

/** 위에서 본 원(타원) */
export function ellipse(g, o, x, z, y, r, col) {
  const cx = Math.round(o.x + px(x, z)), cy = Math.round(o.y + py(x, z, y));
  g.fillStyle = col;
  const RX = Math.max(1, Math.round(r * UX)), RY = Math.max(1, Math.round(r * UY));
  for (let dy = -RY; dy <= RY; dy++) {
    const w = Math.round(RX * Math.sqrt(Math.max(0, 1 - (dy / RY) ** 2)));
    if (w > 0) g.fillRect(cx - w, cy + dy, w * 2, 1);
  }
}

/** 원기둥 — 몸통은 왼쪽이 밝습니다. 해는 늘 왼쪽 위입니다 */
export function cyl(g, o, x, z, y, r, h, col, opt = {}) {
  const cx = Math.round(o.x + px(x, z)), ct = Math.round(o.y + py(x, z, y + h));
  const hpx = Math.max(1, Math.round(h * UH));
  const RX = Math.max(1, Math.round(r * UX)), RY = Math.max(1, Math.round(r * UY));
  const lef = opt.left || sh(col, -20), rig = opt.right || sh(col, -44);
  for (let dx = -RX; dx <= RX; dx++) {
    const t = Math.round(RY * Math.sqrt(Math.max(0, 1 - (dx / RX) ** 2)));
    g.fillStyle = dx < 0 ? lef : rig;
    g.fillRect(cx + dx, ct + t, 1, hpx);
  }
  ellipse(g, { x: ct * 0 + cx, y: ct }, 0, 0, 0, r, opt.top || col);
}

/** 공 */
export function ball(g, o, x, z, y, r, col) {
  const cx = Math.round(o.x + px(x, z)), cy = Math.round(o.y + py(x, z, y + r));
  const R = Math.max(1, Math.round(r * UH));
  g.fillStyle = col;
  for (let dy = -R; dy <= R; dy++) {
    const w = Math.round(R * Math.sqrt(Math.max(0, 1 - (dy / R) ** 2)));
    if (w > 0) g.fillRect(cx - w, cy + dy, w * 2, 1);
  }
  g.fillStyle = sh(col, -30);
  for (let dy = 0; dy <= R; dy++) {
    const w = Math.round(R * Math.sqrt(Math.max(0, 1 - (dy / R) ** 2)));
    const l = Math.round(R * Math.sqrt(Math.max(0, 1 - ((dy + R * .3) / R) ** 2)));
    if (w > l) g.fillRect(cx + l, cy + dy, w - l, 1);
  }
}

/** 바닥 그림자 — 이게 없으면 모든 것이 공중에 뜹니다 */
export function shadow(g, o, x, z, r, a = .20) {
  const cx = Math.round(o.x + px(x, z)), cy = Math.round(o.y + py(x, z, 0));
  g.fillStyle = `rgba(28,22,40,${a})`;
  const RX = Math.max(1, Math.round(r * UX)), RY = Math.max(1, Math.round(r * UY));
  for (let dy = -RY; dy <= RY; dy++) {
    const w = Math.round(RX * Math.sqrt(Math.max(0, 1 - (dy / RY) ** 2)));
    if (w > 0) g.fillRect(cx - w, cy + dy, w * 2, 1);
  }
}

/** 이미 그려 둔 그림(스프라이트)을 세계 좌표에 세웁니다 — 발밑이 (x,z) */
export function sprite(g, o, x, z, y, img, ax = .5, ay = 1) {
  g.drawImage(img,
    Math.round(o.x + px(x, z) - img.width * ax),
    Math.round(o.y + py(x, z, y) - img.height * ay));
}

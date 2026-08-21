/* ══════════════════════════════════════════════════════════
   랜딩의 그림 — 전부 캔버스에 **1픽셀 단위로** 찍습니다.

   요령 하나: 작은 캔버스에 그린 뒤 정수배로 늘립니다. 큰 캔버스에
   작은 사각형을 찍으면 화면 배율에 따라 픽셀이 어긋나 흐릿해집니다.
   ══════════════════════════════════════════════════════════ */

export function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return { c, x, P: (a, b, w2, h2, col) => { x.fillStyle = col; x.fillRect(a | 0, b | 0, w2 | 0, h2 | 0); } };
}

/* 글자를 픽셀로 — 작게 그려서 크게 늘리면 한글도 픽셀 글꼴이 됩니다.
   한글 픽셀 웹폰트로 마땅한 것이 없어 이 방법을 씁니다. */
export function pixelText(text, { px = 12, color = '#fff', font = '800',
  family = '"Gothic A1", "Malgun Gothic", sans-serif', outline = null, shadow = null, letter = 0 } = {}) {
  const probe = mk(8, 8);
  probe.x.font = `${font} ${px}px ${family}`;
  const chars = [...text];
  let w = 0;
  const adv = chars.map((ch) => { const a = Math.ceil(probe.x.measureText(ch).width) + letter; w += a; return a; });
  const pad = (outline ? 1 : 0) + (shadow ? 1 : 0);
  const h = Math.ceil(px * 1.34);
  const b = mk(w + pad * 2 + 3, h + pad * 2 + 3);
  b.x.font = `${font} ${px}px ${family}`;
  b.x.textBaseline = 'top';
  const draw = (dx, dy, col) => {
    b.x.fillStyle = col;
    let cx = dx;
    chars.forEach((ch, i) => { b.x.fillText(ch, cx, dy); cx += adv[i]; });
  };
  if (outline) for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++)
    if (ox || oy) draw(1 + pad + ox, 1 + pad + oy, outline);
  if (shadow) draw(1 + pad, 2 + pad, shadow);
  draw(1 + pad, 1 + pad, color);
  return b.c;
}

/** 픽셀 글자를 <img> 로 — 정수배 확대해서 붙입니다 */
export function pixelTextEl(text, opt = {}, scale = 4) {
  const c = pixelText(text, opt);
  const img = new Image();
  img.src = c.toDataURL();
  img.style.imageRendering = 'pixelated';
  img.style.width = (c.width * scale) + 'px';
  img.style.height = (c.height * scale) + 'px';
  img.alt = text;
  return img;
}

/* ── 하늘 ── 스크롤을 따라 새벽에서 밤으로 넘어갑니다 */
export const SKY = [
  /* 0 새벽 */  { top: '#2B3A63', mid: '#5E6E9E', low: '#C89A9E', sun: '#FFD9A0', hill: '#3A4570', far: '#4A557E', star: .70 },
  /* 1 아침 */  { top: '#7FC3EE', mid: '#B9E4F6', low: '#F6E7C8', sun: '#FFF3C4', hill: '#5E8F6E', far: '#7FA980', star: 0 },
  /* 2 한낮 */  { top: '#54B6E6', mid: '#96D8F2', low: '#DFF2F6', sun: '#FFFBE2', hill: '#4F9A5F', far: '#6FB574', star: 0 },
  /* 3 오후 */  { top: '#68C0E2', mid: '#A8DCEC', low: '#F2E6C4', sun: '#FFF0B8', hill: '#578C58', far: '#7CA86A', star: 0 },
  /* 4 노을 */  { top: '#48538F', mid: '#C0708C', low: '#F2A868', sun: '#FFD08A', hill: '#4A3C63', far: '#6B4E70', star: .22 },
  /* 5 밤 */    { top: '#101830', mid: '#1E2B49', low: '#33436A', sun: '#FFF6D0', hill: '#151E38', far: '#1E2A46', star: 1 },
];
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lerp = (a, b, t) => a + (b - a) * t;
const rgb = (a, b, f) => { const [r1, g1, b1] = hex(a), [r2, g2, b2] = hex(b);
  return `rgb(${lerp(r1, r2, f) | 0},${lerp(g1, g2, f) | 0},${lerp(b1, b2, f) | 0})`; };

export function skyAt(t) {
  const n = SKY.length - 1;
  const u = Math.max(0, Math.min(1, t));
  const i = Math.max(0, Math.min(n - 1, Math.floor(u * n)));
  const f = Math.max(0, Math.min(1, u * n - i));
  const A = SKY[i], B = SKY[i + 1];
  return { top: rgb(A.top, B.top, f), mid: rgb(A.mid, B.mid, f), low: rgb(A.low, B.low, f),
    sun: rgb(A.sun, B.sun, f), hill: rgb(A.hill, B.hill, f), far: rgb(A.far, B.far, f),
    star: lerp(A.star, B.star, f), night: u };
}

/* ── 구름 ── 픽셀 뭉게구름 하나 */
export function cloud(seed = 0, w = 34, h = 12) {
  const b = mk(w, h);
  const rnd = (() => { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); })();
  const lumps = 4 + (seed % 3);
  const cells = [];
  for (let i = 0; i < lumps; i++) {
    const cw = 8 + ((rnd() * 8) | 0), ch = 4 + ((rnd() * 4) | 0);
    const cx = ((i / lumps) * (w - cw)) | 0, cy = (h - ch - (rnd() * 3)) | 0;
    cells.push([cx, cy, cw, ch]);
  }
  cells.forEach(([a, c, d, e]) => b.P(a, c, d, e, '#FFFFFF'));
  cells.forEach(([a, c, d, e]) => b.P(a, c + e - 1, d, 1, '#DCE9F5'));
  b.P(0, h - 1, w, 1, '#CFE0F0');
  return b.c;
}

/* ── 나무 · 덤불 · 꽃 ── */
export function tree(kind = 0) {
  const b = mk(22, 30);
  const leaf = ['#4FA85A', '#3E8F4C', '#6FBE68'][kind % 3];
  const leafD = ['#367F43', '#2B6C39', '#4E9A4C'][kind % 3];
  b.P(9, 20, 4, 10, '#7A5230'); b.P(9, 20, 1, 10, '#5E3D22');
  const rows = [[7, 2, 8, 3], [3, 4, 16, 4], [1, 8, 20, 6], [2, 14, 18, 4], [5, 18, 12, 3]];
  rows.forEach(([a, c, d, e]) => b.P(a, c, d, e, leaf));
  rows.forEach(([a, c, d, e]) => b.P(a, c + e - 1, d, 1, leafD));
  b.P(4, 5, 5, 2, '#7CCB74');
  return b.c;
}
export function pine(kind = 0) {
  const b = mk(20, 32);
  const leaf = ['#2F7A4A', '#276740', '#3B8F55'][kind % 3];
  const leafD = ['#1E5C36', '#17492C', '#2A6E41'][kind % 3];
  b.P(8, 24, 4, 8, '#6B4728');
  const tiers = [[6, 2, 8], [4, 8, 12], [2, 15, 16], [0, 21, 20]];
  tiers.forEach(([x, y, w]) => { b.P(x, y, w, 5, leaf); b.P(x, y + 4, w, 1, leafD); });
  b.P(9, 0, 2, 3, leaf);
  return b.c;
}
export function bush() {
  const b = mk(16, 10);
  b.P(2, 3, 12, 6, '#4FA85A'); b.P(0, 5, 16, 4, '#4FA85A');
  b.P(4, 1, 8, 3, '#5FB863');
  b.P(0, 8, 16, 1, '#367F43'); b.P(2, 2, 3, 1, '#7CCB74');
  return b.c;
}
export function flower(col = '#F2A0B4') {
  const b = mk(6, 8);
  b.P(2, 4, 1, 4, '#3E8F4C'); b.P(1, 6, 3, 1, '#3E8F4C');
  b.P(1, 1, 3, 3, col); b.P(2, 0, 1, 1, col); b.P(0, 2, 1, 1, col); b.P(4, 2, 1, 1, col);
  b.P(2, 2, 1, 1, '#FFF3B0');
  return b.c;
}

/* ── 땅 ── 잔디 띠. 위 두 줄이 밝고 아래가 흙입니다 */
export function ground(w, h, pal = {}) {
  const g = pal.grass || '#5FBE5C', gD = pal.grassD || '#48A049', gDD = pal.grassDD || '#3A8540';
  const soil = pal.soil || '#8A5F3C', soilD = pal.soilD || '#6E4A2C';
  const b = mk(w, h);
  b.P(0, 0, w, 2, pal.grassTop || '#78D06E');
  b.P(0, 2, w, 4, g);
  b.P(0, 6, w, 3, gD);
  b.P(0, 9, w, 2, gDD);
  b.P(0, 11, w, h - 11, soil);
  for (let i = 0; i < w; i += 2) if ((i * 7919) % 11 < 3) b.P(i, 1, 1, 1, '#8EE07E');
  for (let i = 0; i < w; i += 3) if ((i * 104729) % 13 < 4) b.P(i, 13 + ((i * 31) % 5), 2, 1, soilD);
  return b.c;
}

/* ══════════════ 아이소메트릭 조각 ══════════════
   다이아 한 칸은 가로 32 · 세로 16 — 2:1 입니다.
   윗면은 한 줄에 4픽셀씩 넓어지고, 옆면은 그 아래 모서리를 따라 내려갑니다. */
export const TW = 32, TH = 16;

/** 세로 H(가로는 2H)짜리 다이아를 hgt만큼 눌러 세운 덩어리 */
export function isoBlock(H, hgt, top, left, right) {
  const W = H * 2;
  const b = mk(W, H + Math.max(0, hgt));
  for (let i = 0; i < H; i++) {
    const half = i < H / 2 ? i : H - 1 - i;
    const w = (half + 1) * 4, x0 = (W - w) / 2;
    b.P(x0, i, w, 1, top);
  }
  if (hgt > 0) {
    for (let x = 0; x < W / 2; x++) b.P(x, ((x + H) >> 1) + 1, 1, hgt, left);
    for (let x = W / 2; x < W; x++) b.P(x, ((3 * H - 1 - x) >> 1) + 1, 1, hgt, right);
    /* 아래 모서리 한 줄만 어둡게 — 덩어리가 땅에 닿은 자리 */
    for (let x = 0; x < W; x++) {
      const s = x < W / 2 ? ((x + H) >> 1) + 1 : ((3 * H - 1 - x) >> 1) + 1;
      b.P(x, s + hgt - 1, 1, 1, 'rgba(20,26,40,.30)');
    }
  }
  return b.c;
}

/** 바닥 타일 한 칸 */
export function isoTile(top, left, right, hgt = 0) { return isoBlock(TH, hgt, top, left, right); }

/** 아이소 화면 좌표 — 타일 (gx, gy) 의 윗면 왼쪽 꼭짓점 */
export function isoXY(gx, gy) { return { x: (gx - gy) * (TW / 2), y: (gx + gy) * (TH / 2) }; }

/** 다이아 하나를 (cx, cy) 에 — cy 는 맨 윗줄 */
export function diamond(b, cx, cy, H, col, colD) {
  for (let i = 0; i < H; i++) {
    const half = i < H / 2 ? i : H - 1 - i;
    const w = (half + 1) * 4;
    b.P(cx - w / 2, cy + i, w, 1, (colD && i >= H - 2) ? colD : col);
  }
}

/** 지붕 얹은 건물 하나 — 밑면 다이아 세로 H, 벽 높이 wallH, 지붕 단수 roofH
    지붕은 **낮은 모임지붕**입니다. 뾰족하게 올리면 서커스 천막이 됩니다. */
export function isoBuilding(H, wallH, roofH, wall, wallD, roof, roofD) {
  const W = H * 2;
  const b = mk(W, H + wallH + roofH + 2);
  const oy = roofH;
  b.x.drawImage(isoBlock(H, wallH, wall, wallD, shade(wall, -18)), 0, oy);
  const steps = 3;
  for (let k = 0; k < steps; k++) {
    const Hk = H - Math.round(H * k / (steps + 1) / 1.25);
    if (Hk < 6) break;
    diamond(b, W / 2, oy - k * Math.max(2, Math.round(roofH / 3)), Hk & ~1,
      shade(roof, k * 9), roofD);
  }
  return b.c;
}

export function shade(hexc, d) {
  const [r, g, bl] = hex(hexc);
  const c = (v) => Math.max(0, Math.min(255, v + d));
  return `rgb(${c(r)},${c(g)},${c(bl)})`;
}

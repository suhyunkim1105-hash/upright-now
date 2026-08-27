/* ══════════════════════════════════════════════════════════
   메시 줄이기 — 714,279 정점을 5천 언저리로.

   생성기에 `face_limit` 을 안 걸어서 38MB 짜리가 나왔습니다. 월드의
   나머지 셋은 4~6천 정점, 330~440KB 입니다. 리메시를 사면 6크레딧인데
   4밖에 없으니 여기서 줄입니다.

   방법은 **격자 뭉치기**입니다. 공간을 칸으로 나누고 한 칸에 든 정점을
   하나로 합칩니다. 대표는 칸 한가운데에 가장 가까운 **실제 정점**을
   씁니다 — 평균을 내면 표면에서 떠오르고 UV 도 뭉개집니다.

   UV 를 키에 같이 넣는 것이 중요합니다. 자리만 보고 합치면 텍스처
   이음새(같은 자리인데 UV 가 뚝 끊기는 곳)의 양쪽이 한 점이 되면서,
   등껍질 무늬가 얼굴로 늘어붙습니다.

   실행: node decimate.mjs <입력.glb> <출력.glb> [목표정점수]
   ══════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from 'node:fs';

function readGLB(p) {
  const b = readFileSync(p);
  const jl = b.readUInt32LE(12);
  const json = JSON.parse(b.slice(20, 20 + jl).toString('utf8'));
  const h = 20 + jl;
  return { json, bin: b.slice(h + 8, h + 8 + b.readUInt32LE(h)) };
}
function writeGLB(p, json, bin) {
  const pad = (n) => (4 - (n % 4)) % 4;
  let js = Buffer.from(JSON.stringify(json), 'utf8');
  js = Buffer.concat([js, Buffer.alloc(pad(js.length), 0x20)]);
  const bn = Buffer.concat([bin, Buffer.alloc(pad(bin.length), 0)]);
  const total = 12 + 8 + js.length + 8 + bn.length;
  const out = Buffer.alloc(total);
  out.write('glTF', 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(total, 8);
  out.writeUInt32LE(js.length, 12); out.write('JSON', 16); js.copy(out, 20);
  const o = 20 + js.length;
  out.writeUInt32LE(bn.length, o); out.write('BIN\0', o + 4); bn.copy(out, o + 8);
  writeFileSync(p, out);
  return total;
}
const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
function readAcc(g, i) {
  const a = g.json.accessors[i], bv = g.json.bufferViews[a.bufferView];
  const T = COMP[a.componentType], n = NUM[a.type];
  const s = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const stride = bv.byteStride;
  if (!stride || stride === T.BYTES_PER_ELEMENT * n)
    return new T(g.bin.buffer, g.bin.byteOffset + s, a.count * n).slice();
  const out = new T(a.count * n);
  for (let k = 0; k < a.count; k++)
    out.set(new T(g.bin.buffer, g.bin.byteOffset + s + k * stride, n), k * n);
  return out;
}

const [inPath, outPath, targetArg] = process.argv.slice(2);
const TARGET = Number(targetArg || 5200);
const G = readGLB(inPath);
const prim = G.json.meshes[0].primitives[0];
const pos = readAcc(G, prim.attributes.POSITION);
const nrm = prim.attributes.NORMAL != null ? readAcc(G, prim.attributes.NORMAL) : null;
const uv = prim.attributes.TEXCOORD_0 != null ? readAcc(G, prim.attributes.TEXCOORD_0) : null;
const idx = readAcc(G, prim.indices);
const N = pos.length / 3;
console.log('들어온 것 정점', N, '삼각형', idx.length / 3);

let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) {
  if (pos[i + k] < mn[k]) mn[k] = pos[i + k];
  if (pos[i + k] > mx[k]) mx[k] = pos[i + k];
}
const span = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);

/* ── 색을 **줄이기 전에** 굽습니다 ──
   처음에는 뭉친 뒤에 대표의 UV 로 색을 떴는데, 그 전에 UV 를 뭉치는 키에
   넣은 것이 화근이었습니다. 같은 자리인데 UV 가 다른 정점이 **다른
   덩어리**가 되면서, 한자리에 덩어리가 여럿 생겨 틈이 벌어지고 색이
   엉켰습니다.

   원본 정점은 저마다 옳은 UV 를 갖고 있습니다. 그러니 **줄이기 전에**
   전부 색을 떠 두고, 그 다음에는 자리로만 뭉칩니다. UV 가 사라지므로
   찢어질 이음새도 없습니다. */
let RAWCOL = null;
if (process.env.VCOL && uv) {
  const { execFileSync } = await import('node:child_process');
  const imgIdx0 = G.json.textures?.[G.json.materials?.[prim.material]?.pbrMetallicRoughness?.baseColorTexture?.index]?.source;
  if (imgIdx0 != null) {
    const im0 = G.json.images[imgIdx0], bv0 = G.json.bufferViews[im0.bufferView];
    const here = process.cwd().split('\\').join('/');
    writeFileSync('__tex.bin', G.bin.slice(bv0.byteOffset || 0, (bv0.byteOffset || 0) + bv0.byteLength));
    /* 모듈은 스크립트 자리 기준으로 찾으므로 절대경로로 부릅니다 */
    writeFileSync('__decode.cjs',
      "const sharp=require('C:/Users/user/Desktop/girin_mvp/.worktree-latest/node_modules/sharp');\n" +
      "sharp('" + here + "/__tex.bin').raw().toBuffer({resolveWithObject:true})\n" +
      "  .then(({data,info})=>{ require('fs').writeFileSync('" + here + "/__tex.raw', data);\n" +
      "    console.log(info.width+' '+info.height+' '+info.channels); });\n");
    const [TW, TH, CH] = execFileSync(process.execPath, [here + '/__decode.cjs'])
      .toString().trim().split(' ').map(Number);
    const raw = readFileSync('__tex.raw');
    console.log('텍스처 디코드', TW + 'x' + TH, CH + '채널');
    /* sRGB → 선형. COLOR_0 은 선형으로 읽힙니다 */
    const LUT = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const v = i / 255; LUT[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
    RAWCOL = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      let u0 = uv[i * 2], v0 = uv[i * 2 + 1];
      u0 -= Math.floor(u0); v0 -= Math.floor(v0);
      /* **뒤집지 않습니다.** glTF 의 UV 원점은 좌상단이라 v=0 이 그림의
         첫 줄입니다. 여기서 (1-v) 로 뒤집었더니 등껍질 색이 머리로,
         눈이 배로 올라갔습니다 — 위아래가 통째로 뒤바뀐 것이었습니다.
         (three.js 가 texture.flipY 로 뒤집는 것은 GL 쪽 사정이고,
         원본 자료를 직접 읽는 여기서는 규격 그대로 봅니다.) */
      const px = Math.min(TW - 1, Math.max(0, Math.round(u0 * (TW - 1))));
      const py = Math.min(TH - 1, Math.max(0, Math.round(v0 * (TH - 1))));
      const o = (py * TW + px) * CH;
      RAWCOL[i * 3] = LUT[raw[o]]; RAWCOL[i * 3 + 1] = LUT[raw[o + 1]]; RAWCOL[i * 3 + 2] = LUT[raw[o + 2]];
    }
    console.log('정점 색 구움(줄이기 전)', N, '개');
  }
}

function cluster(cellCount) {
  const cell = span / cellCount;
  const map = new Map();
  for (let i = 0; i < N; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    /* **자리만** 봅니다. UV 를 넣으면 같은 자리에 덩어리가 여럿 생깁니다. */
    const key = `${Math.floor((x - mn[0]) / cell)},${Math.floor((y - mn[1]) / cell)},${Math.floor((z - mn[2]) / cell)}`;
    let e = map.get(key);
    if (!e) map.set(key, (e = { best: i, bd: Infinity, cx: 0, cy: 0, cz: 0, n: 0, r: 0, g: 0, b: 0 }));
    e.cx += x; e.cy += y; e.cz += z; e.n++;
    if (RAWCOL) { e.r += RAWCOL[i * 3]; e.g += RAWCOL[i * 3 + 1]; e.b += RAWCOL[i * 3 + 2]; }
  }
  return { map, cell };
}
/* 목표 정점 수에 닿을 때까지 칸 수를 이분법으로 찾습니다 */
let lo = 8, hi = 220, picked = null;
for (let step = 0; step < 14; step++) {
  const midC = Math.round((lo + hi) / 2);
  const r = cluster(midC);
  const got = r.map.size;
  if (Math.abs(got - TARGET) < TARGET * 0.06 || hi - lo <= 1) { picked = { ...r, cells: midC, got }; break; }
  if (got > TARGET) hi = midC; else lo = midC;
  picked = { ...r, cells: midC, got };
}
const { map, cell } = picked;
console.log('칸', picked.cells, '→ 뭉친 정점', map.size);

/* 대표는 칸 한가운데에 가장 가까운 **실제 정점** */
for (const e of map.values()) { e.cx /= e.n; e.cy /= e.n; e.cz /= e.n; }
const of = new Int32Array(N);
{
  const keys = [];
  for (let i = 0; i < N; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const key = `${Math.floor((x - mn[0]) / cell)},${Math.floor((y - mn[1]) / cell)},${Math.floor((z - mn[2]) / cell)}`;
    keys.push(key);
    const e = map.get(key);
    const d = (x - e.cx) ** 2 + (y - e.cy) ** 2 + (z - e.cz) ** 2;
    if (d < e.bd) { e.bd = d; e.best = i; }
  }
  const order = new Map();
  let n = 0;
  for (const k of map.keys()) order.set(k, n++);
  for (let i = 0; i < N; i++) of[i] = order.get(keys[i]);
}
const reps = [...map.values()].map((e) => e.best);
const M = reps.length;
const nPos = new Float32Array(M * 3), nNrm = nrm ? new Float32Array(M * 3) : null, nUV = uv ? new Float32Array(M * 2) : null;
reps.forEach((src, i) => {
  for (let k = 0; k < 3; k++) nPos[i * 3 + k] = pos[src * 3 + k];
  if (nNrm) for (let k = 0; k < 3; k++) nNrm[i * 3 + k] = nrm[src * 3 + k];
  if (nUV) for (let k = 0; k < 2; k++) nUV[i * 2 + k] = uv[src * 2 + k];
});

/* 덩어리 색은 **평균**을 씁니다. 대표 하나의 색을 쓰면 눈 가장자리의
   점 하나가 그 덩어리 전체를 검게 만듭니다. */
let VCOL = null;
if (RAWCOL) {
  VCOL = new Float32Array(M * 3);
  const vals = [...map.values()];
  vals.forEach((e, i) => { VCOL[i * 3] = e.r / e.n; VCOL[i * 3 + 1] = e.g / e.n; VCOL[i * 3 + 2] = e.b / e.n; });
  console.log('덩어리 색 평균', M, '개');
}

/* 삼각형 다시 엮기 — 한 점으로 접힌 것은 버립니다 */
const tri = [];
for (let t = 0; t < idx.length; t += 3) {
  const a = of[idx[t]], b = of[idx[t + 1]], c = of[idx[t + 2]];
  if (a === b || b === c || a === c) continue;
  tri.push(a, b, c);
}
console.log('삼각형', idx.length / 3, '→', tri.length / 3);

const json = JSON.parse(JSON.stringify(G.json));
const chunks = []; let off = 0;
const put = (typed, target) => {
  const buf = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
  const pad = (4 - (off % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad, 0)); off += pad; }
  const i = json.bufferViews.length;
  json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: buf.length, ...(target ? { target } : {}) });
  chunks.push(buf); off += buf.length;
  return i;
};
json.bufferViews = []; json.accessors = [];
const acc = (bv, ct, type, cnt, extra = {}) => {
  const i = json.accessors.length;
  json.accessors.push({ bufferView: bv, componentType: ct, count: cnt, type, ...extra });
  return i;
};
let bmn = [Infinity, Infinity, Infinity], bmx = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < nPos.length; i += 3) for (let k = 0; k < 3; k++) {
  if (nPos[i + k] < bmn[k]) bmn[k] = nPos[i + k];
  if (nPos[i + k] > bmx[k]) bmx[k] = nPos[i + k];
}
const aPos = acc(put(nPos, 34962), 5126, 'VEC3', M, { min: bmn, max: bmx });
const aNrm = nNrm ? acc(put(nNrm, 34962), 5126, 'VEC3', M) : null;
const aUV = (nUV && !VCOL) ? acc(put(nUV, 34962), 5126, 'VEC2', M) : null;
const aCol = VCOL ? acc(put(VCOL, 34962), 5126, 'VEC3', M) : null;
const iarr = M > 65535 ? Uint32Array.from(tri) : Uint16Array.from(tri);
const aIdx = acc(put(iarr, 34963), M > 65535 ? 5125 : 5123, 'SCALAR', iarr.length);

const imgIdx = json.textures?.[json.materials?.[prim.material]?.pbrMetallicRoughness?.baseColorTexture?.index]?.source;
if (VCOL) {
  /* 색을 정점에 구웠으니 텍스처·UV·샘플러를 통째로 버립니다 */
  const mat = json.materials[prim.material];
  if (mat?.pbrMetallicRoughness) {
    delete mat.pbrMetallicRoughness.baseColorTexture;
    mat.pbrMetallicRoughness.baseColorFactor = [1, 1, 1, 1];
    mat.pbrMetallicRoughness.metallicFactor = 0;
    mat.pbrMetallicRoughness.roughnessFactor = 0.92;   /* 점토는 매트합니다 */
  }
  delete json.textures; delete json.images; delete json.samplers;
} else if (imgIdx != null) {
  const im = G.json.images[imgIdx], obv = G.json.bufferViews[im.bufferView];
  const bytes = G.bin.slice(obv.byteOffset || 0, (obv.byteOffset || 0) + obv.byteLength);
  const pad = (4 - (off % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad, 0)); off += pad; }
  const bv = json.bufferViews.length;
  json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: bytes.length });
  chunks.push(bytes); off += bytes.length;
  json.images[imgIdx] = { bufferView: bv, mimeType: im.mimeType || 'image/png' };
}
const np = json.meshes[0].primitives[0];
np.attributes = { POSITION: aPos, ...(aNrm != null ? { NORMAL: aNrm } : {}),
  ...(aUV != null ? { TEXCOORD_0: aUV } : {}), ...(aCol != null ? { COLOR_0: aCol } : {}) };
np.indices = aIdx;
json.buffers = [{ byteLength: off }];
const size = writeGLB(outPath, json, Buffer.concat(chunks));
console.log('저장', outPath, (size / 1024 | 0) + 'KB · 정점', M);

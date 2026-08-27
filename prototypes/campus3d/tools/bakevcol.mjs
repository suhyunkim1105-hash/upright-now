/* ══════════════════════════════════════════════════════════
   텍스처를 정점 색으로 굽습니다 — **뼈와 동작은 그대로 둡니다.**

   `decimate.mjs` 는 새로 뽑은 민짜 메시를 줄이는 데 쓰고, 이쪽은 이미
   뼈가 붙어 있는 GLB 를 손볼 때 씁니다.

   왜 굽는가 — 이 생성기의 UV 아틀라스는 섬이 잘게 조각나 있고, 섬과 섬이
   맞닿는 자리에서 색이 새어 **껍질에 금이 간 것 같은 자국**이 납니다.
   펭귄 뒤통수의 균열이 그것입니다. UV 를 없애면 새어 나올 경계도 없어집니다.

   잃는 것은 텍스처의 세밀함인데, 이 캐릭터들은 매끈한 점토에 색이 면
   단위로 넓게 발려 있어 정점 색으로 옮겨도 거의 그대로입니다. 다만
   **정점이 촘촘해야** 눈·부리 같은 작은 것이 뭉개지지 않습니다 —
   모자라면 `--subdiv` 로 한 번 쪼개고 굽습니다.

   실행: node bakevcol.mjs <입력.glb> <출력.glb> [--subdiv]
   ══════════════════════════════════════════════════════════ */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const SHARP = 'C:/Users/user/Desktop/girin_mvp/.worktree-latest/node_modules/sharp';

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

const [inPath, outPath, ...flags] = process.argv.slice(2);
const SUBDIV = flags.includes('--subdiv');
const G = readGLB(inPath);
const prim = G.json.meshes[0].primitives[0];
let pos = readAcc(G, prim.attributes.POSITION);
let nrm = prim.attributes.NORMAL != null ? readAcc(G, prim.attributes.NORMAL) : null;
let uv = readAcc(G, prim.attributes.TEXCOORD_0);
let jnt = prim.attributes.JOINTS_0 != null ? readAcc(G, prim.attributes.JOINTS_0) : null;
let wgt = prim.attributes.WEIGHTS_0 != null ? readAcc(G, prim.attributes.WEIGHTS_0) : null;
let idx = Array.from(readAcc(G, prim.indices));
const JT = jnt ? jnt.constructor : null;
console.log('들어온 것 정점', pos.length / 3, '삼각형', idx.length / 3);

/* ── 한 번 쪼개기 ──
   삼각형마다 세 변의 중점을 새 정점으로 두고 넷으로 나눕니다. 정점이
   네 배가 되면서 눈·부리의 색 경계가 훨씬 또렷해집니다. 중점의 UV·법선·
   가중치는 양 끝의 평균입니다 — 가중치는 다시 1로 맞춥니다. */
if (SUBDIV) {
  const P = Array.from(pos), Nr = nrm ? Array.from(nrm) : null, U = Array.from(uv);
  const J = jnt ? Array.from(jnt) : null, W = wgt ? Array.from(wgt) : null;
  const mid = new Map();
  const midpoint = (a, b) => {
    const key = a < b ? a + ',' + b : b + ',' + a;
    let m = mid.get(key);
    if (m != null) return m;
    m = P.length / 3;
    for (let k = 0; k < 3; k++) P.push((P[a * 3 + k] + P[b * 3 + k]) / 2);
    if (Nr) {
      const nx = (Nr[a * 3] + Nr[b * 3]) / 2, ny = (Nr[a * 3 + 1] + Nr[b * 3 + 1]) / 2, nz = (Nr[a * 3 + 2] + Nr[b * 3 + 2]) / 2;
      const L = Math.hypot(nx, ny, nz) || 1;
      Nr.push(nx / L, ny / L, nz / L);
    }
    for (let k = 0; k < 2; k++) U.push((U[a * 2 + k] + U[b * 2 + k]) / 2);
    if (J) {
      /* 뼈는 섞을 수 없으니 **더 무겁게 매달린 쪽**을 그대로 씁니다.
         섞으면 팔 정점이 다리 뼈를 조금씩 물고 늘어집니다. */
      const wa = W[a * 4], wb = W[b * 4];
      const src = wa >= wb ? a : b;
      for (let k = 0; k < 4; k++) { J.push(J[src * 4 + k]); W.push(W[src * 4 + k]); }
    }
    mid.set(key, m);
    return m;
  };
  const tri2 = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
    tri2.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
  }
  pos = Float32Array.from(P); if (Nr) nrm = Float32Array.from(Nr);
  uv = Float32Array.from(U);
  if (J) { jnt = JT.from(J); wgt = Float32Array.from(W); }
  idx = tri2;
  console.log('쪼갠 뒤 정점', pos.length / 3, '삼각형', idx.length / 3);
}

/* ── 텍스처 읽어 색 뜨기 ── */
/* WebP 텍스처는 `EXT_texture_webp` 확장 안에 source 가 들어 있습니다 —
   `textures[i].source` 만 보면 undefined 입니다. */
const texNode = G.json.textures[G.json.materials[prim.material].pbrMetallicRoughness.baseColorTexture.index];
const imgIdx = texNode.source ?? texNode.extensions?.EXT_texture_webp?.source;
const im = G.json.images[imgIdx], ibv = G.json.bufferViews[im.bufferView];
const here = process.cwd().split('\\').join('/');
writeFileSync('__tex.bin', G.bin.slice(ibv.byteOffset || 0, (ibv.byteOffset || 0) + ibv.byteLength));
writeFileSync('__decode.cjs',
  "const sharp=require('" + SHARP + "');\n" +
  "sharp('" + here + "/__tex.bin').raw().toBuffer({resolveWithObject:true})\n" +
  "  .then(({data,info})=>{ require('fs').writeFileSync('" + here + "/__tex.raw', data);\n" +
  "    console.log(info.width+' '+info.height+' '+info.channels); });\n");
const [TW, TH, CH] = execFileSync(process.execPath, [here + '/__decode.cjs']).toString().trim().split(' ').map(Number);
const raw = readFileSync('__tex.raw');
console.log('텍스처', TW + 'x' + TH, CH + '채널', im.mimeType);

const LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) { const v = i / 255; LUT[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
const M = pos.length / 3;
const col = new Float32Array(M * 3);
/* **V 를 뒤집지 않습니다.** glTF 의 UV 원점은 좌상단입니다. */
for (let i = 0; i < M; i++) {
  let u0 = uv[i * 2], v0 = uv[i * 2 + 1];
  u0 -= Math.floor(u0); v0 -= Math.floor(v0);
  const px = Math.min(TW - 1, Math.max(0, Math.round(u0 * (TW - 1))));
  const py = Math.min(TH - 1, Math.max(0, Math.round(v0 * (TH - 1))));
  const o = (py * TW + px) * CH;
  col[i * 3] = LUT[raw[o]]; col[i * 3 + 1] = LUT[raw[o + 1]]; col[i * 3 + 2] = LUT[raw[o + 2]];
}
console.log('정점 색', M, '개');

/* ── 다시 싸기. 옛 BIN 을 앞에 두어 동작·역바인드행렬을 지킵니다 ── */
const json = JSON.parse(JSON.stringify(G.json));
const chunks = [G.bin]; let off = G.bin.length;
const put = (typed, target) => {
  const buf = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
  const pad = (4 - (off % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad, 0)); off += pad; }
  const i = json.bufferViews.length;
  json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: buf.length, ...(target ? { target } : {}) });
  chunks.push(buf); off += buf.length;
  return i;
};
const acc = (bv, ct, type, cnt, extra = {}) => {
  const i = json.accessors.length;
  json.accessors.push({ bufferView: bv, componentType: ct, count: cnt, type, ...extra });
  return i;
};
let bmn = [Infinity, Infinity, Infinity], bmx = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) {
  if (pos[i + k] < bmn[k]) bmn[k] = pos[i + k];
  if (pos[i + k] > bmx[k]) bmx[k] = pos[i + k];
}
const aPos = acc(put(pos, 34962), 5126, 'VEC3', M, { min: bmn, max: bmx });
const aNrm = nrm ? acc(put(nrm, 34962), 5126, 'VEC3', M) : null;
const aCol = acc(put(col, 34962), 5126, 'VEC3', M);
const aJnt = jnt ? acc(put(jnt, 34962), JT === Uint8Array ? 5121 : 5123, 'VEC4', M) : null;
const aWgt = wgt ? acc(put(wgt, 34962), 5126, 'VEC4', M) : null;
const iarr = M > 65535 ? Uint32Array.from(idx) : Uint16Array.from(idx);
const aIdx = acc(put(iarr, 34963), M > 65535 ? 5125 : 5123, 'SCALAR', iarr.length);

const np = json.meshes[0].primitives[0];
np.attributes = { POSITION: aPos, ...(aNrm != null ? { NORMAL: aNrm } : {}), COLOR_0: aCol,
  ...(aJnt != null ? { JOINTS_0: aJnt, WEIGHTS_0: aWgt } : {}) };
np.indices = aIdx;

const mat = json.materials[np.material];
delete mat.pbrMetallicRoughness.baseColorTexture;
mat.pbrMetallicRoughness.baseColorFactor = [1, 1, 1, 1];
mat.pbrMetallicRoughness.metallicFactor = 0;
mat.pbrMetallicRoughness.roughnessFactor = 0.92;    /* 점토는 매트합니다 */
delete json.textures; delete json.images; delete json.samplers;
/* 텍스처를 떼면 WebP 확장도 같이 지웁니다 — 안 지우면 로더가 없는
   텍스처를 찾다가 파일을 통째로 거절합니다. */
const dropExt = (list) => (list || []).filter((n) => n !== 'EXT_texture_webp');
if (json.extensionsUsed) json.extensionsUsed = dropExt(json.extensionsUsed);
if (json.extensionsRequired) json.extensionsRequired = dropExt(json.extensionsRequired);
if (!json.extensionsUsed?.length) delete json.extensionsUsed;
if (!json.extensionsRequired?.length) delete json.extensionsRequired;

json.buffers = [{ byteLength: off }];
const size = writeGLB(outPath, json, Buffer.concat(chunks));
console.log('저장', outPath, (size / 1024 | 0) + 'KB · 정점', M);
console.log('동작', (json.animations || []).map((a) => a.name).join(', '));

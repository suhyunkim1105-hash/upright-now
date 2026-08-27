/* ══════════════════════════════════════════════════════════
   새로 뽑은 메시에 **기존 GLB 의 뼈와 동작을 옮겨 붙입니다.**

   리깅을 사면 크레딧이 더 드는데, 기존 turtle.glb 에는 이미
   `root/spine/head/arm.L/arm.R/leg.L/leg.R` 뼈와 `idle·walk·run·sit`
   동작 넷이 들어 있습니다. 캐릭터가 같은 종이고 서 있는 자세도 비슷하니,
   **살가죽만 갈아 끼우면** 됩니다.

   방법은 가장 가까운 정점의 가중치를 그대로 가져오는 것입니다. 두 메시가
   같은 자세·같은 비율일 때 잘 듭니다 — 새 메시의 손 정점 옆에는 옛 메시의
   손 정점이 있고, 그 정점은 `arm.L` 에 매달려 있습니다.

   바꾸는 것: 정점·법선·UV·인덱스·텍스처.
   그대로 두는 것: 뼈, 스킨, 역바인드행렬, 동작 네 개, 노드 구조.

   실행: node reskin.mjs <새메시.glb> <옛것.glb> <나올것.glb>
   ══════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from 'node:fs';

/* ── GLB 열고 닫기 ── */
function readGLB(p) {
  const b = readFileSync(p);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.slice(20, 20 + jsonLen).toString('utf8'));
  /* BIN 청크는 JSON 청크 뒤에 헤더 8바이트를 두고 붙습니다 */
  const binHeader = 20 + jsonLen;
  const binLen = b.readUInt32LE(binHeader);
  const bin = b.slice(binHeader + 8, binHeader + 8 + binLen);
  return { json, bin };
}
function writeGLB(p, json, bin) {
  const pad4 = (n) => (4 - (n % 4)) % 4;
  let js = Buffer.from(JSON.stringify(json), 'utf8');
  js = Buffer.concat([js, Buffer.alloc(pad4(js.length), 0x20)]);
  const bn = Buffer.concat([bin, Buffer.alloc(pad4(bin.length), 0)]);
  const total = 12 + 8 + js.length + 8 + bn.length;
  const out = Buffer.alloc(total);
  out.write('glTF', 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(total, 8);
  out.writeUInt32LE(js.length, 12); out.write('JSON', 16);
  js.copy(out, 20);
  let o = 20 + js.length;
  out.writeUInt32LE(bn.length, o); out.write('BIN\0', o + 4);
  bn.copy(out, o + 8);
  writeFileSync(p, out);
  return total;
}

const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readAcc(g, i) {
  const a = g.json.accessors[i];
  const bv = g.json.bufferViews[a.bufferView];
  const T = COMP[a.componentType], n = NUM[a.type];
  const start = (bv.byteOffset || 0) + (a.byteOffset || 0);
  /* 인터리브(byteStride)면 한 칸씩 건너뛰며 읽습니다 */
  const stride = bv.byteStride;
  if (!stride || stride === T.BYTES_PER_ELEMENT * n) {
    return new T(g.bin.buffer, g.bin.byteOffset + start, a.count * n).slice();
  }
  const out = new T(a.count * n);
  for (let k = 0; k < a.count; k++) {
    const src = new T(g.bin.buffer, g.bin.byteOffset + start + k * stride, n);
    out.set(src, k * n);
  }
  return out;
}

/* ── 들어오는 것 ── */
const [newPath, oldPath, outPath] = process.argv.slice(2);
const NEW = readGLB(newPath);
const OLD = readGLB(oldPath);

/* 새 메시에서 가장 정점이 많은 프리미티브를 씁니다 — 생성기가 몸과
   눈을 따로 내보내는 경우가 있는데, 몸이 곧 가장 큰 덩어리입니다. */
function biggestPrim(g) {
  let best = null;
  (g.json.meshes || []).forEach((m, mi) => m.primitives.forEach((p, pi) => {
    const c = g.json.accessors[p.attributes.POSITION].count;
    if (!best || c > best.count) best = { mi, pi, prim: p, count: c };
  }));
  return best;
}
const nb = biggestPrim(NEW), ob = biggestPrim(OLD);
console.log('새 메시 정점', nb.count, '| 옛 메시 정점', ob.count);

const nPos = readAcc(NEW, nb.prim.attributes.POSITION);
const nNrm = nb.prim.attributes.NORMAL != null ? readAcc(NEW, nb.prim.attributes.NORMAL) : null;
const nUV = nb.prim.attributes.TEXCOORD_0 != null ? readAcc(NEW, nb.prim.attributes.TEXCOORD_0) : null;
/* 색을 정점에 구워 온 경우 — UV 도 텍스처도 없고 COLOR_0 만 있습니다 */
const nCol = nb.prim.attributes.COLOR_0 != null ? readAcc(NEW, nb.prim.attributes.COLOR_0) : null;
const nIdx = nb.prim.indices != null ? readAcc(NEW, nb.prim.indices) : null;
const oPos = readAcc(OLD, ob.prim.attributes.POSITION);
const oJnt = readAcc(OLD, ob.prim.attributes.JOINTS_0);
const oWgt = readAcc(OLD, ob.prim.attributes.WEIGHTS_0);

/* ── 자리 맞추기 ──
   두 메시는 크기도 원점도 다릅니다. 옛 메시의 상자에 새 메시를 넣습니다.
   높이로 배율을 잡고, 가로·세로 가운데와 발바닥을 맞춥니다. */
function box(arr) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < arr.length; i += 3)
    for (let k = 0; k < 3; k++) { if (arr[i + k] < mn[k]) mn[k] = arr[i + k]; if (arr[i + k] > mx[k]) mx[k] = arr[i + k]; }
  return { mn, mx };
}
const YAW = Number(process.env.YAW || 0);                 /* 필요하면 Y축으로 돌립니다 */
if (YAW) {
  const c = Math.cos(YAW), s = Math.sin(YAW);
  for (let i = 0; i < nPos.length; i += 3) {
    const x = nPos[i], z = nPos[i + 2];
    nPos[i] = x * c + z * s; nPos[i + 2] = -x * s + z * c;
  }
  if (nNrm) for (let i = 0; i < nNrm.length; i += 3) {
    const x = nNrm[i], z = nNrm[i + 2];
    nNrm[i] = x * c + z * s; nNrm[i + 2] = -x * s + z * c;
  }
}
const NB = box(nPos), OB = box(oPos);
const k = (OB.mx[1] - OB.mn[1]) / ((NB.mx[1] - NB.mn[1]) || 1);
const cx = (NB.mn[0] + NB.mx[0]) / 2, cz = (NB.mn[2] + NB.mx[2]) / 2;
const tx = (OB.mn[0] + OB.mx[0]) / 2, tz = (OB.mn[2] + OB.mx[2]) / 2;
for (let i = 0; i < nPos.length; i += 3) {
  nPos[i] = (nPos[i] - cx) * k + tx;
  nPos[i + 1] = (nPos[i + 1] - NB.mn[1]) * k + OB.mn[1];
  nPos[i + 2] = (nPos[i + 2] - cz) * k + tz;
}
console.log('배율', k.toFixed(4), '| 맞춘 상자', box(nPos).mn.map((v) => v.toFixed(2)).join(','), '~', box(nPos).mx.map((v) => v.toFixed(2)).join(','));

/* ── 가중치 옮기기 ──
   격자에 옛 정점을 담아 두고, 새 정점마다 가까운 칸만 뒤집니다.
   전부 대 전부로 재면 4500×4500 = 2천만 번이라 굳이 그럴 필요가 없습니다. */
const cell = (OB.mx[1] - OB.mn[1]) / 24;
const key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
const grid = new Map();
for (let i = 0; i < oPos.length / 3; i++) {
  const kk = key(oPos[i * 3], oPos[i * 3 + 1], oPos[i * 3 + 2]);
  if (!grid.has(kk)) grid.set(kk, []);
  grid.get(kk).push(i);
}
const count = nPos.length / 3;
const JT = oJnt.constructor, WT = oWgt.constructor;
const jOut = new JT(count * 4), wOut = new WT(count * 4);
let far = 0;
for (let i = 0; i < count; i++) {
  const x = nPos[i * 3], y = nPos[i * 3 + 1], z = nPos[i * 3 + 2];
  const gx = Math.floor(x / cell), gy = Math.floor(y / cell), gz = Math.floor(z / cell);
  let best = -1, bd = Infinity;
  for (let r = 1; r <= 6 && best < 0; r++) {            /* 찾을 때까지 칸을 넓힙니다 */
    for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let c = -r; c <= r; c++) {
      if (r > 1 && Math.max(Math.abs(a), Math.abs(b), Math.abs(c)) < r) continue;
      const lst = grid.get(`${gx + a},${gy + b},${gz + c}`);
      if (!lst) continue;
      for (const j of lst) {
        const dx = oPos[j * 3] - x, dy = oPos[j * 3 + 1] - y, dz = oPos[j * 3 + 2] - z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bd) { bd = d; best = j; }
      }
    }
    if (r === 6 && best < 0) far++;
  }
  if (best < 0) best = 0;
  for (let c = 0; c < 4; c++) { jOut[i * 4 + c] = oJnt[best * 4 + c]; wOut[i * 4 + c] = oWgt[best * 4 + c]; }
}
console.log('가중치 옮김', count, '개 · 못 찾은 것', far);

/* ── 새 GLB 짜기 ──
   옛 파일을 뼈대로 삼고 메시 관련 조각만 갈아 끼웁니다. */
const json = JSON.parse(JSON.stringify(OLD.json));
const chunks = [];
let off = 0;
const put = (typed, target) => {
  const buf = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
  const pad = (4 - (off % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad, 0)); off += pad; }
  const bvIdx = json.bufferViews.length;
  json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: buf.length, ...(target ? { target } : {}) });
  chunks.push(buf); off += buf.length;
  return bvIdx;
};
/* 옛 BIN 을 통째로 앞에 둡니다 — 동작·역바인드행렬이 그 안에 있습니다 */
chunks.push(OLD.bin); off = OLD.bin.length;

const acc = (bv, componentType, type, cnt, extra = {}) => {
  const i = json.accessors.length;
  json.accessors.push({ bufferView: bv, componentType, count: cnt, type, ...extra });
  return i;
};
const bounds = box(nPos);
const aPos = acc(put(nPos, 34962), 5126, 'VEC3', count, { min: bounds.mn, max: bounds.mx });
const aNrm = nNrm ? acc(put(nNrm, 34962), 5126, 'VEC3', count) : null;
const aUV = nUV ? acc(put(nUV, 34962), 5126, 'VEC2', count) : null;
const aCol = nCol ? acc(put(nCol, 34962), 5126, 'VEC3', count) : null;
const aJnt = acc(put(jOut, 34962), JT === Uint8Array ? 5121 : 5123, 'VEC4', count);
const aWgt = acc(put(wOut, 34962), 5126, 'VEC4', count);
let aIdx = null;
if (nIdx) {
  const idx = count > 65535 ? Uint32Array.from(nIdx) : Uint16Array.from(nIdx);
  aIdx = acc(put(idx, 34963), count > 65535 ? 5125 : 5123, 'SCALAR', idx.length);
}

const prim = json.meshes[ob.mi].primitives[ob.pi];
prim.attributes = { POSITION: aPos, ...(aNrm != null ? { NORMAL: aNrm } : {}),
  ...(aUV != null ? { TEXCOORD_0: aUV } : {}), ...(aCol != null ? { COLOR_0: aCol } : {}),
  JOINTS_0: aJnt, WEIGHTS_0: aWgt };
if (aIdx != null) prim.indices = aIdx; else delete prim.indices;

/* 정점 색으로 왔으면 옛 텍스처를 떼어냅니다 — UV 가 없는데 텍스처가
   붙어 있으면 화면이 통째로 한 색으로 칠해집니다. */
if (aCol != null) {
  const mat = json.materials[prim.material];
  if (mat?.pbrMetallicRoughness) {
    delete mat.pbrMetallicRoughness.baseColorTexture;
    mat.pbrMetallicRoughness.baseColorFactor = [1, 1, 1, 1];
    mat.pbrMetallicRoughness.metallicFactor = 0;
    mat.pbrMetallicRoughness.roughnessFactor = 0.92;
  }
  delete json.textures; delete json.images; delete json.samplers;
  console.log('정점 색으로 왔습니다 — 텍스처 뗐습니다');
}

/* ── 텍스처 갈아 끼우기 (UV 로 온 경우만) ── */
const nImgIdx = aCol != null ? null : (() => {
  const mat = NEW.json.materials?.[nb.prim.material];
  const t = mat?.pbrMetallicRoughness?.baseColorTexture?.index;
  if (t == null) return null;
  return NEW.json.textures[t].source;
})();
if (nImgIdx != null) {
  const img = NEW.json.images[nImgIdx];
  const bv = NEW.json.bufferViews[img.bufferView];
  const bytes = NEW.bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
  const pad = (4 - (off % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad, 0)); off += pad; }
  const newBv = json.bufferViews.length;
  json.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: bytes.length });
  chunks.push(bytes); off += bytes.length;
  const oldMat = json.materials[prim.material];
  const oldTex = oldMat?.pbrMetallicRoughness?.baseColorTexture?.index;
  if (oldTex != null) {
    json.images[json.textures[oldTex].source] = { bufferView: newBv, mimeType: img.mimeType || 'image/png' };
    console.log('텍스처 교체', (bytes.length / 1024 | 0) + 'KB', img.mimeType);
  }
}

json.buffers = [{ byteLength: off }];
const bin = Buffer.concat(chunks);
const size = writeGLB(outPath, json, bin);
console.log('저장', outPath, (size / 1024 | 0) + 'KB');
console.log('동작', (json.animations || []).map((a) => a.name).join(', '));
console.log('노드', (json.nodes || []).map((n) => n.name).join(', '));

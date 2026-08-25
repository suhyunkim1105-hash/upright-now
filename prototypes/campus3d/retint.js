/* ══════════════════════════════════════════════════════════
   아틀라스 재도색 — 남의 팔레트를 우리 팔레트로

   왜 필요한가
   ----------
   Kenney City Kit 은 재질에 이름(`window` · `roof` · `door`)이 붙어 있어
   이름으로 색을 갈아 끼웠습니다. 그런데 스타일라이즈드 킷 대부분은
   **재질이 하나**입니다 — 색을 텍스처(팔레트 아틀라스)로 찍기 때문입니다.

     공원 세트    256×256   10KB
     건물 킷      512×512    9KB
     도시 조각   1024×1024  19KB
     자연 메가킷 1024×1024  69KB

   1024×1024 가 19KB 면 거의 단색 면이라는 뜻입니다(사진이면 200KB 이상).
   즉 색이 수십 개뿐인 **팔레트**고, 그 색들을 옮기면 됩니다.

   어떻게 옮기나
   ------------
   "가장 가까운 우리 색으로 바꾸기" 는 안 씁니다 — 서로 다른 색 여럿이
   한 색으로 뭉개져 모델이 납작해집니다. 대신 **HSL 로 옮깁니다.**

     채도를 우리 상한까지만    남의 킷은 대개 우리보다 쨍합니다
     명도를 조금 올리고 좁힘   우리 월드는 밝고 대비가 낮습니다
     색상은 그대로            초록은 초록, 나무는 나무여야 합니다

   색상을 안 건드리는 게 핵심입니다. 색상까지 옮기면 나뭇잎이 청록이
   되고, 그건 우리 팔레트가 아니라 그냥 망가진 모델입니다.
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';

/* 우리 월드의 범위. prototypes/DESIGN.md 의 값과 faculty.js 팔레트를
   재서 잡은 상한입니다. */
export const TONE = {
  satMax: .52,      // 이보다 쨍한 색은 없습니다
  satMul: .82,      // 전체적으로 한 단 낮춥니다
  litMin: .30,      // 순검정에 가까운 값을 안 씁니다 — 그늘은 청록을 섞은 어두운 값
  litMax: .93,
  litLift: .06,     // 전체를 조금 밝게
  warm: .012,       // 아주 살짝 따뜻한 쪽으로 (노랑 방향)
};

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (mx === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}
function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
function hsl2rgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < .5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

/** 색 하나를 우리 톤으로 옮깁니다. 색상은 유지합니다. */
export function toneColor(r, g, b) {
  let [h, s, l] = rgb2hsl(r, g, b);
  s = Math.min(s * TONE.satMul, TONE.satMax);
  l = l + TONE.litLift * (1 - l);
  l = Math.max(TONE.litMin, Math.min(TONE.litMax, l));
  /* 아주 살짝 따뜻한 쪽으로. 회색(채도 0)은 안 건드립니다 —
     건드리면 흰 벽이 노래집니다. */
  if (s > .04) {
    const d = ((0.11 - h + 1.5) % 1) - .5;      // 0.11 ≈ 따뜻한 노랑
    h = (h + d * TONE.warm + 1) % 1;
  }
  return hsl2rgb(h, s, l);
}

/* 같은 이미지를 여러 모델이 공유하므로 결과를 캐시합니다 —
   1024×1024 를 모델마다 다시 칠하면 로드가 눈에 띄게 느려집니다. */
const cache = new WeakMap();

/**
 * 텍스처의 팔레트를 우리 톤으로 옮긴 새 텍스처를 돌려줍니다.
 * 원본은 그대로 둡니다 — 비교(?retint=0)를 할 수 있어야 하니까요.
 */
export function retintTexture(tex) {
  if (!tex || !tex.image) return tex;
  if (cache.has(tex.image)) return cache.get(tex.image);

  const img = tex.image;
  const w = img.width || img.videoWidth, h = img.height || img.videoHeight;
  if (!w || !h) return tex;
  /* 아주 큰 것은 사진일 가능성이 큽니다 — 팔레트가 아니면 옮기면 안 됩니다 */
  if (w * h > 2048 * 2048) return tex;

  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  let data;
  try { data = ctx.getImageData(0, 0, w, h); }
  catch (e) { return tex; }              // 다른 출처면 못 읽습니다

  /* 같은 색이 수천 픽셀씩 반복되므로, 색마다 한 번만 계산합니다 */
  const memo = new Map();
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const key = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
    let out = memo.get(key);
    if (out === undefined) { out = toneColor(px[i], px[i + 1], px[i + 2]); memo.set(key, out); }
    px[i] = out[0]; px[i + 1] = out[1]; px[i + 2] = out[2];
  }
  ctx.putImageData(data, 0, 0);

  const nt = new THREE.CanvasTexture(cv);
  /* glTF 텍스처는 flipY 가 false 입니다. 새로 만든 것에도 맞춰 주지 않으면
     모델의 색이 위아래로 뒤집혀 엉뚱한 면에 칠해집니다. */
  nt.flipY = false;
  nt.colorSpace = tex.colorSpace;
  nt.wrapS = tex.wrapS; nt.wrapT = tex.wrapT;
  nt.magFilter = tex.magFilter; nt.minFilter = tex.minFilter;
  nt.needsUpdate = true;
  nt.userData.colors = memo.size;
  cache.set(img, nt);
  return nt;
}

/** 재질 하나를 우리 톤으로. 텍스처가 있으면 아틀라스를, 없으면 색을 옮깁니다. */
/* ── 양 끝 자르기 ──────────────────────────────────────────
   자연에는 순백도 순검정도 없습니다. 흰 벽은 하늘빛을 옅게 머금고,
   그늘은 주변 색을 머금습니다. 재질 868 개를 재 보니 순백에 가까운 것이
   64 개, 아주 어두운 것이 76 개였습니다 — 그만큼이 플라스틱처럼
   보이던 몫입니다.

   실험실(colorlab) 에서 판단이 끝나 상시로 겁니다. 굽기(bake) 전에
   한 번만 돌면 됩니다 — 재질은 병합돼도 같은 객체를 공유합니다. */
const WHITE = new THREE.Color(0xF2F0E9);   // 하늘빛 머금은 회백
const DARK = new THREE.Color(0x1E332E);    // 청록 섞은 그늘

export function trimExtremes(root) {
  const seen = new Set();
  let n = 0;
  root.traverse((o) => {
    if (!o.material) return;
    [].concat(o.material).forEach((m) => {
      if (!m || !m.color || seen.has(m.uuid)) return;
      seen.add(m.uuid);
      /* 텍스처가 있으면 건드리지 않습니다. 그 재질의 color 는 **색이 아니라
         텍스처에 곱하는 배수**라 흰색이 정상값입니다 — 여기서 회백으로
         낮추면 킷 모델의 그림 전체가 탁해집니다. */
      if (m.map) return;
      /* rgb2hsl 은 0~255 를 받습니다(위 정의에서 /255 합니다).
         Color 의 r/g/b 는 0~1 이라 그대로 넘기면 **모든 재질이 근흑으로
         읽혀** 세계 전체가 어두운 청록으로 끌려갑니다. 실제로 그렇게 됐고,
         근흑 재질이 76 에서 263 으로 늘어난 것으로 잡았습니다. */
      const [, s, l] = rgb2hsl(m.color.r * 255, m.color.g * 255, m.color.b * 255);
      if (l > .93 && s < .10) { m.color.lerp(WHITE, .85); n++; }
      else if (l < .14) { m.color.lerp(DARK, .75); n++; }
    });
  });
  return n;
}

export function retintMaterial(mat) {
  if (!mat || mat.userData.retinted) return mat;
  if (mat.map) {
    mat.map = retintTexture(mat.map);
  } else if (mat.color) {
    const c = mat.color;
    const [r, g, b] = toneColor(
      Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255));
    c.setRGB(r / 255, g / 255, b / 255);
  }
  /* 남의 킷은 금속·거칠기가 우리와 다릅니다. 우리 월드는 전부 무광입니다 */
  if (mat.metalness !== undefined) mat.metalness = 0;
  if (mat.roughness !== undefined) mat.roughness = Math.max(.72, mat.roughness);
  mat.userData.retinted = true;
  return mat;
}

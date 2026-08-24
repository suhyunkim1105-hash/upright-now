/* ══════════════════════════════════════════════════════════
   색 실험실 — 세 가지를 켜고 끄며 비교합니다

   `?lab=1` 일 때만 붙습니다. 별도 씬을 만들지 않고 **실제 월드에서**
   토글하는 이유는, 조명이 조금만 달라도 색 판단이 통째로 틀어지기
   때문입니다. 재도색 시험 때는 나란히 놓는 게 맞았지만(모델 하나씩),
   전역 색은 실제 화면에서 봐야 합니다.

   무엇을 재고 왜 후보인지
   --------------------
   재질 868개를 재 보니 이랬습니다.

     채도 중앙값 0.631 · 채도 0.62 이상이 441개(53%)
     순백에 가까운 재질 64개 · 아주 어두운 재질 76개
     색상의 60%가 빨강~주황(크림 · 석재 · 목재)

   스타일라이즈드 자연광 세계는 보통 채도 중앙값이 0.35~0.55 입니다.
   그리고 자연에는 순백도 순검정도 없습니다 — 흰 벽은 하늘빛을 받아
   아주 옅게 파랗고, 그늘은 주변 색을 머금습니다.

     2 채도    우리 재질에도 retint 의 톤 변환을 겁니다. 지금은 외부
              킷에만 걸려 있어 **남의 에셋이 우리 것보다 차분한** 역전
     3 양끝    순백 → 따뜻한 회백, 근흑 → 청록 섞은 어두운 값
     4 톤매핑  ACES 는 색을 눈에 띄게 변조하고 채도를 떨어뜨립니다.
              AgX 는 더 중립적이라 Blender 4.0 의 기본값이 됐고,
              Neutral(Khronos)은 원색을 가장 그대로 냅니다.
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { toneColor } from './retint.js';

export function createColorLab(ctx) {
  const { scene, renderer } = ctx;
  const state = { sat: false, ends: false, tone: 0 };

  /* 원래 색을 기억해 둡니다 — 안 하면 토글을 두 번 누를 때마다
     색이 점점 빠져 되돌릴 수 없습니다. */
  const orig = new Map();
  function eachMat(fn) {
    const seen = new Set();
    scene.traverse((o) => {
      if (!o.material) return;
      [].concat(o.material).forEach((m) => {
        if (!m || !m.color || seen.has(m.uuid)) return;
        seen.add(m.uuid);
        if (!orig.has(m.uuid)) orig.set(m.uuid, m.color.clone());
        fn(m, orig.get(m.uuid));
      });
    });
  }

  const rgb2hsl = (r, g, b) => {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn, s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h;
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (mx === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return [h, s, l];
  };

  /* 양 끝을 자릅니다.
       순백    자연에 순백은 없습니다. 하늘빛을 아주 옅게 머금은 회백으로
       근흑    순검정 그늘은 플라스틱이 됩니다. 청록을 섞은 어두운 값으로
                (로비 · 마이페이지의 클레이 토큰이 쓰는 규칙과 같습니다) */
  const WHITE = new THREE.Color(0xF2F0E9);
  const DARK = new THREE.Color(0x1E332E);
  function trimEnds(m, base) {
    const [, s2, l] = rgb2hsl(base.r, base.g, base.b);
    if (l > .93 && s2 < .10) { m.color.copy(base).lerp(WHITE, .85); return true; }
    if (l < .14) { m.color.copy(base).lerp(DARK, .75); return true; }
    return false;
  }

  function apply() {
    eachMat((m, base) => {
      m.color.copy(base);
      if (state.ends && trimEnds(m, base)) { /* 끝을 잘랐으면 채도는 건너뜁니다 */ }
      else if (state.sat) {
        const [r, g, b] = toneColor(
          Math.round(base.r * 255), Math.round(base.g * 255), Math.round(base.b * 255));
        m.color.setRGB(r / 255, g / 255, b / 255);
      }
    });
  }

  /* 톤매핑 — r169 에 들어 있는 것들 */
  const TONES = [
    ['ACES Filmic', THREE.ACESFilmicToneMapping, 1.06],
    ['AgX', THREE.AgXToneMapping, 1.18],          // AgX 는 어둡게 나와 노출을 올립니다
    ['Neutral', THREE.NeutralToneMapping, 1.02],
    ['없음', THREE.NoToneMapping, .92],
  ].filter((t) => t[1] !== undefined);

  function setTone(i) {
    state.tone = i % TONES.length;
    const [, mode, exp] = TONES[state.tone];
    renderer.toneMapping = mode;
    renderer.toneMappingExposure = exp;
    /* 톤매핑을 바꾸면 모든 재질의 셰이더를 다시 컴파일해야 합니다 */
    scene.traverse((o) => {
      if (!o.material) return;
      [].concat(o.material).forEach((m) => { if (m) m.needsUpdate = true; });
    });
    return TONES[state.tone][0];
  }

  /* ---------------- 화면 ---------------- */
  const bar = document.createElement('div');
  bar.id = 'lab';
  bar.innerHTML = `
    <style>
      #lab{position:fixed;left:14px;bottom:14px;z-index:130;display:flex;gap:6px;
        padding:7px;border-radius:14px;background:rgba(18,26,24,.86);
        backdrop-filter:blur(10px);font:600 12px/1 system-ui,sans-serif;
        box-shadow:0 8px 26px -10px rgba(0,0,0,.6)}
      #lab button{padding:8px 12px;border:0;border-radius:9px;cursor:pointer;
        background:rgba(255,255,255,.10);color:rgba(255,255,255,.82);font:inherit;
        transition:background .14s,color .14s;white-space:nowrap}
      #lab button:hover{background:rgba(255,255,255,.18);color:#fff}
      #lab button.on{background:#2DD4BF;color:#06332B}
      #lab button:focus-visible{outline:2px solid #2DD4BF;outline-offset:2px}
      #lab .t{align-self:center;padding:0 8px 0 4px;color:rgba(255,255,255,.42);
        font-size:11px;letter-spacing:.06em}
      #lab .m{align-self:center;padding:0 10px;color:rgba(255,255,255,.62);
        font-family:ui-monospace,monospace;font-size:11px}
    </style>
    <span class="t">색</span>
    <button data-k="sat">2 · 채도 낮춤</button>
    <button data-k="tone">4 · 톤매핑</button>
    <span class="m" id="lab-m">ACES Filmic</span>`;
  document.body.appendChild(bar);

  const label = bar.querySelector('#lab-m');
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const k = b.dataset.k;
    if (k === 'tone') {
      const name = setTone(state.tone + 1);
      label.textContent = name;
      b.classList.toggle('on', state.tone !== 0);
      return;
    }
    state[k] = !state[k];
    b.classList.toggle('on', state[k]);
    apply();
  });

  return { state, apply };
}

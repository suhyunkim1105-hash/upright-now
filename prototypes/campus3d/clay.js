/* ══════════════════════════════════════════════════════════
   점토 — 렌더한 그림을 **빚어서 찍은 사진**으로.

   Hylics 2 와 Don't open the doors! 는 둘 다 실제 점토를 만들어 사진으로
   찍은 게임입니다. 로우폴리도 픽셀아트도 아니고 클레이메이션이에요.
   그 둘과 우리 화면의 차이를 하나씩 적어 보면 기하가 아닙니다:

     ① 손자국 — 빚은 표면은 매끈하지 않습니다. 눌린 자국, 밀린 결,
        엄지 지문. 우리 것은 수학적으로 완벽한 면이라 플라스틱입니다.
     ② 흔들린 실루엣 — 손으로 만든 모서리는 반듯하지 않습니다.
        Hylics 평은 "undulating claymation" 이지 "blocky polygons" 이
        아니라고 콕 집어 말합니다.
     ③ 얼룩진 색 — 점토 덩이는 한 색이 아닙니다. 반죽이 덜 섞인 자리,
        손에서 묻은 자리가 있습니다.

   셋 다 **셰이더 하나**로 붙입니다. 텍스처도 UV 도 안 씁니다 —
   월드 좌표로 잡음을 자르므로 크기가 물체마다 안 어긋나고, 로딩도
   메모리도 0 입니다. 786개 재질에 같은 코드를 붙이지만
   customProgramCacheKey 를 못 박아 **프로그램은 하나**만 컴파일됩니다.

   ⚠ CSM 도 onBeforeCompile 을 씁니다(setupMaterial). 덮어쓰면 그림자가
   죽으므로 **먼저 있던 것을 부르고 나서** 우리 것을 붙입니다. 그리고
   CSM 을 껐다 켜면 저쪽이 다시 덮어쓰므로, 그때마다 이 파일의
   applyClay 를 다시 불러야 합니다(index.html 이 그렇게 합니다).

   ?clay=0 으로 끕니다. 값은 window.__clay(bump, scale, mottle, wobble).
   ══════════════════════════════════════════════════════════ */

/* 값 하나로 묶어 둡니다 — 재질마다 유니폼을 따로 들면 786벌이 되고,
   눈으로 맞출 때 한 번에 못 움직입니다. */
export const CLAY = {
  /* 손자국 깊이. 0.55 는 눈높이에서 "면이 살짝 울퉁불퉁하다" 가 보이고
     실루엣은 안 무너지는 선입니다. 1.4 를 넘기면 벽이 자갈이 됩니다.
     0.55 는 티가 안 났고 1.0 은 캐릭터가 구겨진 은박지가 됐습니다.
     0.72 가 건물에서는 손자국으로, 캐릭터에서는 결로 읽히는 자리입니다. */
  uClayBump:   { value: .72 },
  /* 잡음 한 칸의 크기. 8.0 이면 큰 결이 12cm, 잔결이 5cm 입니다.
     30m 짜리 건물에서는 손바닥 자국, 1m 짜리 캐릭터에서는 엄지 자국.
     4.0 → 5.5 → 8.0 으로 올렸습니다. 낮은 값은 건물에서만 보이고
     캐릭터에서는 결이 한 칸도 안 들어가 매끈했습니다. */
  uClayScale:  { value: 8.0 },
  /* 색 얼룩. **캐릭터가 상한선을 정합니다.** 0.10 으로 두면 건물 벽은
     좋은데 크림색 기린 몸이 회색으로 얼룩져서 점토가 아니라 때가 탄
     것으로 보였습니다. 0.045 면 벽의 반죽 자국은 남고 몸은 깨끗합니다. */
  uClayMottle: { value: .045 },
  /* 실루엣 흔들기(월드 단위). 2cm — 걷는 충돌은 원래 상자로 재므로
     이보다 크면 눈에 보이는 벽과 부딪히는 벽이 갈라집니다. */
  uClayWobble: { value: .015 },
};

/* iq 의 값잡음 — sin 을 안 씁니다. 화소마다 부르는 자리라 sin 열여섯 번은
   그대로 프레임입니다. 두 옥타브면 손자국으로 충분합니다. */
const NOISE = `
uniform float uClayBump, uClayScale, uClayMottle, uClayWobble;
varying vec3 vClayPos;
float clayHash(vec3 p){
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float clayVal(vec3 x){
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(clayHash(i + vec3(0,0,0)), clayHash(i + vec3(1,0,0)), f.x),
                 mix(clayHash(i + vec3(0,1,0)), clayHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(clayHash(i + vec3(0,0,1)), clayHash(i + vec3(1,0,1)), f.x),
                 mix(clayHash(i + vec3(0,1,1)), clayHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float clayFbm(vec3 p){ return clayVal(p) * 0.66 + clayVal(p * 2.7) * 0.34; }
`;

const VERT_HEAD = NOISE;

/* 실루엣 흔들기는 **정점**에서 합니다. 아주 낮은 주파수만 씁니다 —
   높은 주파수를 넣으면 면이 찢어지고, 그건 점토가 아니라 고장입니다. */
const VERT_BODY = `
  vec4 clayW = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    clayW = instanceMatrix * clayW;
  #endif
  vClayPos = (modelMatrix * clayW).xyz;
  transformed += normalize(objectNormal) *
    ((clayFbm(vClayPos * 0.55) - 0.5) * 2.0 * uClayWobble);
`;

const FRAG_HEAD = NOISE + `
float gClayH = 0.5;
`;

/* 손자국은 **화면 미분**으로 법선을 밀어서 만듭니다.
   잡음을 세 번 더 떠서 기울기를 내는 방법(= 표본 넷)도 되지만 화소마다
   네 번이면 값이 네 배입니다. dFdx/dFdy 는 하드웨어가 공짜로 주는 것이라
   **표본 한 번**으로 끝납니다(Mikkelsen 의 surface gradient). */
const FRAG_NORMAL = `
  {
    vec3 dpdx = dFdx(vClayPos), dpdy = dFdy(vClayPos);
    vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
    float det = dot(dpdx, r1);
    float dhdx = dFdx(gClayH), dhdy = dFdy(gClayH);
    vec3 grad = sign(det) * (dhdx * r1 + dhdy * r2) / max(abs(det), 1e-7);
    normal = normalize(normal - uClayBump * grad);
  }
`;

export function applyClay(mat) {
  if (!mat || !mat.isMeshStandardMaterial || mat.userData.clayed) return mat;
  mat.userData.clayed = true;
  /* 먼저 있던 것(CSM 등)을 잃지 않습니다 */
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    if (typeof prev === 'function') prev.call(mat, shader, renderer);
    Object.assign(shader.uniforms, CLAY);

    shader.vertexShader = shader.vertexShader
      .replace('void main() {', VERT_HEAD + '\nvoid main() {')
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>' + VERT_BODY);

    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', FRAG_HEAD + '\nvoid main() {')
      /* 잡음은 한 번만 떠서 얼룩과 법선이 나눠 씁니다. map_fragment 앞이
         diffuseColor 가 아직 재질 색인 자리라 여기서 곱합니다. */
      .replace('#include <map_fragment>', `
        gClayH = clayFbm(vClayPos * uClayScale);
        diffuseColor.rgb *= 1.0 + (gClayH - 0.5) * 2.0 * uClayMottle;
      ` + '\n#include <map_fragment>')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + FRAG_NORMAL);
  };
  /* 786개 재질이 **같은 프로그램 하나**를 쓰게 합니다. 이 줄이 없으면
     three 가 onBeforeCompile 의 함수 본문까지 열쇠에 넣는데, 화살표
     함수가 재질마다 새로 생기므로 프로그램도 786개가 됩니다. */
  mat.customProgramCacheKey = () => 'clay1';
  mat.needsUpdate = true;
  return mat;
}

/** 나무 하나에 붙은 재질을 전부 훑어 붙입니다. 이미 붙은 것은 건너뜁니다. */
export function clayAll(root) {
  if (!root) return 0;
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    /* 하늘 돔·비·이름표처럼 점토가 아닌 것은 건너뜁니다 */
    if (o.userData.noClay) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) if (applyClay(m) && !m.userData.clayCounted) {
      m.userData.clayCounted = true; n++;
    }
  });
  return n;
}

/** CSM 을 껐다 켜면 저쪽이 onBeforeCompile 을 덮어씁니다. 그때 다시
    붙이려면 표시를 지워야 하므로, 지우는 길을 같이 냅니다. */
export function unclay(root) {
  if (!root) return;
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of list) {
      delete m.userData.clayed;
      delete m.userData.clayCounted;
    }
  });
}

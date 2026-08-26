/* ══════════════════════════════════════════════════════════
   하늘 — 시각과 날씨.

   2D 판에는 `SKY` 12구간과 `LAMPS`·`WEATHER` 가 있었는데 3D 로 오면서
   통째로 빠졌습니다. 배경색이 하나로 고정이라, 새벽에 들어가도 한낮이고
   비가 와도 맑았습니다. 창밖 날씨 창은 기상청 값을 보여 주는데 정작
   **창밖은 늘 같은 하늘**이었습니다 — 그 어긋남이 제일 티가 납니다.

   여기서는 셋을 답니다.
     ① 시각 — 실제 시각으로 하늘·해·주변광이 12구간을 넘어갑니다
     ② 불 — 해가 지면 건물 창과 가로등 유리가 스스로 빛납니다
     ③ 날씨 — 비·눈은 카메라를 따라다니는 점 구름 하나로 그립니다

   비를 파티클 시스템으로 만들지 않고 **점 하나짜리 Points** 로 그리는
   이유: 이 화면은 웹캠 자세 추정과 같은 탭에서 돕니다. 프레임이 곧
   걷는 속도라, 눈에 안 띄는 곳에 쓸 예산이 없습니다.
   ══════════════════════════════════════════════════════════ */

/* 시각별 하늘 — 2D 판의 SKY 12구간과 같은 자리에 같은 색을 둡니다 */
const STOPS = [
  /* h,  하늘,      해빛,      해세기, 주변광, 반구광 */
  [0,  0x344A72, 0x91A9DF, .30, .38, .32],
  [4,  0x50658D, 0xA6B9E5, .34, .42, .36],
  [5.5,0xA9C9E2, 0xFFE4D2, .78, .62, .58],
  [6.5,0xC5E3F2, 0xFFF3E8, 1.28, .72, .72],
  [8,  0xD0ECF7, 0xFFFDF5, 1.78, .78, .86],
  [11, 0xCDEAF6, 0xFFFFFF, 2.08, .80, .92],
  [14, 0xC9E8F5, 0xFFFDF8, 2.02, .80, .90],
  [16.5,0xD1E7F2, 0xFFF4E7, 1.68, .75, .82],
  [18, 0xCCDDEA, 0xFFE8D2, 1.16, .66, .66],
  [19, 0x91A8C8, 0xD7DDF2, .72, .52, .48],
  [20.5,0x50658A, 0xA1B4E2, .38, .42, .36],
  [24, 0x344A72, 0x91A9DF, .30, .38, .32],
];
const lerp = (a, b, t) => a + (b - a) * t;
function mixHex(a, b, t) {
  const r = lerp((a >> 16) & 255, (b >> 16) & 255, t) | 0;
  const g = lerp((a >> 8) & 255, (b >> 8) & 255, t) | 0;
  const c = lerp(a & 255, b & 255, t) | 0;
  return (r << 16) | (g << 8) | c;
}
export function skyAt(h) {
  const t = ((h % 24) + 24) % 24;
  let i = 0;
  while (i < STOPS.length - 2 && STOPS[i + 1][0] <= t) i++;
  const A = STOPS[i], B = STOPS[i + 1];
  const f = B[0] === A[0] ? 0 : (t - A[0]) / (B[0] - A[0]);
  return {
    sky: mixHex(A[1], B[1], f), sun: mixHex(A[2], B[2], f),
    sunI: lerp(A[3], B[3], f), amb: lerp(A[4], B[4], f), hemi: lerp(A[5], B[5], f),
    /* 밤의 정도 0~1 — 불을 켜는 기준입니다 */
    night: Math.max(0, Math.min(1, (0.92 - lerp(A[3], B[3], f)) / 0.72)),
  };
}

/** 하늘 · 불 · 날씨를 한 벌로 묶습니다 */
export function createSky(THREE, ctx) {
  const { scene, sun, hemi, amb, campusRoot, roomRoot } = ctx;
  let hour = null;            // null 이면 실제 시각
  let weather = 'clear';      // clear · rain · snow · cloud
  let lastIndoor = false;
  let lit = -1;               // 지금 불이 켜져 있는 정도(중복 적용 방지)
  const glass = [];           // 창·가로등 유리 재질
  const rainG = { pts: null, vel: null, n: 0 };

  /* ══ 하늘 돔 ══
     배경이 **색 하나**였습니다. 캠퍼스가 320칸인데 위를 올려다보면
     끝까지 같은 하늘색이라, 화면 위쪽 절반이 색지 한 장이었습니다.
     하늘은 위가 짙고 지평선이 옅습니다 — 그 하나만 있어도 깊이가 생기고,
     해와 구름이 있으면 시각이 몇 시인지 화면만 보고 압니다.

     한 덩어리(드로우콜 1)이고 카메라를 따라다닙니다. 깊이를 안 쓰므로
     무엇도 가리지 않고, 안개도 안 받습니다 — 대신 **지평선 색을 안개
     색과 같게** 잡아 경계가 안 보이게 합니다(다르면 띠가 생깁니다). */
  const skyU = {
    uTop:   { value: new THREE.Color(0x8FC4E8) },
    uHaze:  { value: new THREE.Color(0xCDEAF6) },
    uSun:   { value: new THREE.Color(0xFFF6E4) },
    uSunDir: { value: new THREE.Vector3(-.4, .6, .5).normalize() },
    uNight: { value: 0 },
    uCloud: { value: .35 },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1, 40, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      uniforms: skyU,
      vertexShader: `varying vec3 vD;
        void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      /* 구름은 방향 벡터로 자른 값잡음 셋을 겹칩니다. 텍스처가 없으므로
         메모리도 로딩도 0 이고, 시각에 따라 색만 갈아 끼우면 됩니다. */
      fragmentShader: `
        varying vec3 vD;
        uniform vec3 uTop, uHaze, uSun; uniform vec3 uSunDir;
        uniform float uNight, uCloud;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(41.7, 289.1))) * 43758.5453); }
        float vn(vec2 p){
          vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h21(i), h21(i+vec2(1,0)), f.x),
                     mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y);
        }
        float fbm(vec2 p){ return vn(p)*.55 + vn(p*2.1)*.28 + vn(p*4.3)*.17; }
        void main(){
          vec3 d = normalize(vD);
          float up = clamp(d.y, 0.0, 1.0);
          /* 지평선에서 천정까지 — 제곱근을 쓰면 아래쪽이 더 넓게 옅습니다.
             선형으로 섞으면 하늘 한복판에 띠가 보입니다. */
          vec3 col = mix(uHaze, uTop, sqrt(up));
          /* 해 — 낮에만. 원반 하나와 그 둘레의 넓은 무리 */
          float sd = max(dot(d, normalize(uSunDir)), 0.0);
          float day = 1.0 - uNight;
          col += uSun * pow(sd, 900.0) * 1.6 * day;
          col += uSun * pow(sd, 12.0) * .22 * day;
          /* 구름 — 지평선 가까이는 눌러서 띠가 안 지게 */
          float band = smoothstep(0.02, 0.26, up);
          vec2 uv = d.xz / max(d.y, 0.12) * 0.5;
          float c = fbm(uv * 1.35 + vec2(0.0, 0.0));
          c = smoothstep(0.44, 0.82, c) * band * uCloud;
          col = mix(col, mix(vec3(1.0), uTop, 0.18 + uNight * .55), c);
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  dome.name = 'skyDome';
  dome.frustumCulled = false;
  dome.renderOrder = -1000;
  /* **카메라 far 안쪽**이어야 합니다. 처음에 600 으로 뒀는데 이 화면의
     카메라는 far 400 이라 돔이 통째로 잘려 나갔고, 하늘은 그대로 배경색
     한 장이었습니다(깊이 검사를 꺼도 near/far 클리핑은 그대로 걸립니다).
     깊이를 안 쓰고 맨 먼저 그리므로 크기는 아무 값이나 괜찮습니다 —
     40 이면 near 0.25 보다 넉넉히 멀고 far 400 보다 넉넉히 가깝습니다. */
  dome.scale.setScalar(40);
  dome.userData.noBake = true;
  /* 카메라를 따라다닙니다. 원점에 두면 캠퍼스 반대편(300칸)까지 걸어갔을
     때 지평선이 기울어 보입니다. onBeforeRender 는 그리기 직전에 카메라를
     넘겨주므로 여기서 옮기는 것이 한 프레임도 안 밀립니다. */
  dome.onBeforeRender = (r, sc, camera) => { dome.position.copy(camera.position); };
  scene.add(dome);
  const _sd = new THREE.Vector3();
  /* 하늘색 하나에서 천정·지평선 두 색을 만듭니다. 시각표(STOPS)를 두 벌로
     늘리지 않으려는 것입니다 — 늘리면 둘이 갈라집니다. 천정은 그 색을
     진하게, 지평선은 옅게. 밤에는 차이를 줄입니다(밤하늘은 평평합니다). */
  const _top = new THREE.Color(), _haze = new THREE.Color();
  function paintDome(s, indoor) {
    dome.visible = !indoor;
    if (indoor) return;
    _haze.setHex(s.sky);
    _top.copy(_haze);
    const k = 1 - s.night * .55;
    _top.offsetHSL(.02 * k, .26 * k, -.21 * k);
    skyU.uTop.value.copy(_top);
    skyU.uHaze.value.copy(_haze);
    skyU.uSun.value.setHex(s.sun);
    skyU.uNight.value = s.night;
    skyU.uCloud.value = weather === 'clear' ? .46 : weather === 'cloud' ? .88 : .96;
    if (sun) skyU.uSunDir.value.copy(_sd.copy(sun.position).normalize());
  }

  /* ── 빛나는 재질 모으기 ──
     굽기(bake)가 지오메트리는 합쳐도 **재질은 그대로 둡니다.** 그래서
     재질만 붙잡아 두면 밤에 창 전체가 한 번에 켜집니다. 색으로 고릅니다 —
     bld.js 의 유리색과 실내 창의 하늘색이 그것입니다. */
  /* ⚠ 이 목록은 **색으로** 창을 찾습니다. 창 색을 바꾸면 여기도 같이
     고쳐야 하고, 안 고치면 아무 에러 없이 밤에 불만 안 켜집니다.
     실제로 그렇게 되어 있었습니다 — 아래 0xFFF8EA·0xFFE8C0·0xE8F4FF 에
     "건물 창(bld.js)" 이라고 적혀 있는데, bld.js 의 BASE 는 언제부턴가
     glass 0x4E8CA8 · glassLit 0x74B5CE 입니다. 그래서 캠퍼스 여섯 채의
     창이 **한 장도 안 켜졌고**, 밤 캠퍼스가 폐교로 보였습니다. */
  const GLASS_HEX = new Set([
    0x9EDCEB, 0xBFEAF5, 0xCFEFFA, 0xBFE4F2, 0xD8F2FA, 0xA9DDF2, 0x9FD8EE,
    0xFFF2CE,                                     // 가로등 유리(campus.js lampPost)
    0xFFF8EA, 0xFFE8C0, 0xE8F4FF,                 // 옛 건물 창 — 남겨 둡니다
    0x4E8CA8, 0x74B5CE,                           // 건물 창(bld.js BASE.glass · glassLit)
  ]);
  function collect(root) {
    if (!root) return;
    root.traverse((o) => {
      if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
      const m = o.material;
      if (!m.color || glass.includes(m)) return;
      const hex = m.color.getHex();
      if (GLASS_HEX.has(hex)) { m.emissive = m.emissive || new THREE.Color(0); glass.push(m); }
    });
  }

  /* ── 비 · 눈 ── 카메라를 따라다니는 상자 하나 안에서만 떨어집니다 */
  function makeRain(kind) {
    dropRain();
    const n = kind === 'snow' ? 900 : 1500;
    const pos = new Float32Array(n * 3), vel = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - .5) * 46;
      pos[i * 3 + 1] = Math.random() * 22;
      pos[i * 3 + 2] = (Math.random() - .5) * 46;
      vel[i] = kind === 'snow' ? .9 + Math.random() * .7 : 13 + Math.random() * 7;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      color: kind === 'snow' ? 0xFFFFFF : 0xBFD8EE,
      size: kind === 'snow' ? .17 : .09, transparent: true,
      opacity: kind === 'snow' ? .92 : .58, depthWrite: false, sizeAttenuation: true,
    });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false; p.renderOrder = 3;
    scene.add(p);
    rainG.pts = p; rainG.vel = vel; rainG.n = n; rainG.kind = kind;
  }
  function dropRain() {
    if (!rainG.pts) return;
    scene.remove(rainG.pts);
    rainG.pts.geometry.dispose(); rainG.pts.material.dispose();
    rainG.pts = null; rainG.n = 0;
  }

  function setWeather(k) {
    if (k === weather) return;
    weather = k;
    if (k === 'rain' || k === 'snow') { makeRain(k); if (rainG.pts) rainG.pts.visible = !lastIndoor; }
    else dropRain();
  }

  function nowHour() {
    if (hour !== null) return hour;
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }

  /* 기준 색 — 처음 한 번만 기억합니다. 매 프레임 읽으면 이미 곱해진
     값을 또 곱해서 빛이 점점 어두워집니다. */
  let base = null;
  function apply(indoor) {
    const s = skyAt(nowHour());
    /* 비·눈은 **밖에만** 옵니다. 알갱이는 씬에 바로 달려 있어서
       방에 들어가도 그대로 떠 있었습니다 — 기숙사 안에 눈이 내렸습니다.
       tick 을 멈추는 것만으로는 멈춘 알갱이가 남습니다. */
    lastIndoor = !!indoor;
    if (rainG.pts) rainG.pts.visible = !indoor;
    /* 흐리거나 비가 오면 한 단계 눌러 줍니다 — 맑은 날과 같으면 날씨가 안 보입니다 */
    const dull = weather === 'clear' ? 1 : weather === 'cloud' ? .82 : .68;
    if (!indoor) {
      scene.background.setHex(s.sky);
      if (weather !== 'clear') scene.background.multiplyScalar(dull * 1.02);
    }
    /* 돔은 배경 **위에** 그려집니다. 배경색은 돔이 못 덮는 자리(실내)와
       안개 색의 기준으로 계속 씁니다 — 지평선 색을 돔과 맞추는 근거가
       그 값이라, 둘을 따로 두면 지평선에 띠가 생깁니다. */
    paintDome(s, indoor);
    /* 안개 색 = 하늘 색. 다르면 지평선에 띠가 생겨 안개가 아니라
       벽으로 보입니다. 실내에서는 밀도를 거의 0 으로 내립니다 —
       방은 20칸도 안 되는데 밖과 같은 밀도를 쓰면 벽이 뿌예집니다. */
    if (scene.fog) {
      scene.fog.color.copy(scene.background);
      /* 비·눈은 실제로 시야를 줄입니다 — 날씨가 안개로도 보여야 합니다 */
      const wx = weather === 'clear' ? 1 : weather === 'cloud' ? 1.35 : 1.9;
      /* 밀도 .0075 는 200칸에서 90% 불투명입니다 — 부지가 320칸인데
         반대편이 안 보였습니다. 넓은 화면이 통째로 분홍 안개가 되던
         정체입니다. .0040 이면 200칸에서 47% — 깊이는 남고 담과 건물은
         보입니다. 흐림 · 비는 배수로 그대로 짙어집니다. */
      scene.fog.density = indoor ? .0006 : .0040 * wx;
    }
    /* 밤에는 **빛의 색까지** 파랗게 기울입니다. 세기만 낮추면 파스텔 재질이
       그대로 밝게 남아서 "어두운 낮" 이 됩니다 — 밤으로 안 읽힙니다. */
    const n = s.night;
    if (!base) base = {
      amb: amb.color.clone(),
      hemi: hemi.color.clone(),
      gnd: hemi.groundColor ? hemi.groundColor.clone() : null,
    };
    /* 채널마다 다르게 낮춥니다 — 빨강을 가장 많이 깎으면 남는 것이
       파랑이라 밤빛이 됩니다. 기준 색에 **곱하므로** 낮에는 하늘빛과
       잔디빛이 그대로 남습니다. */
    amb.color.setRGB(base.amb.r * (1 - n * .46), base.amb.g * (1 - n * .36), base.amb.b * (1 - n * .04));
    hemi.color.setRGB(base.hemi.r * (1 - n * .40), base.hemi.g * (1 - n * .30), base.hemi.b * (1 - n * .02));
    if (hemi.groundColor && base.gnd) {
      hemi.groundColor.setRGB(base.gnd.r * (1 - n * .52), base.gnd.g * (1 - n * .44), base.gnd.b * (1 - n * .14));
    }
    /* ── 대비 ──
       시각표(STOPS)의 값 그대로면 주변광이 세서 화면이 평평합니다.
       점토는 **음영으로** 형태를 말하는 재질이라, 그늘이 얕으면 모든
       것이 스티커처럼 보입니다. 표는 그대로 두고 여기서 비율만 밉니다 —
       해를 올리고 주변광을 내립니다. 실내는 창 하나로 버티므로 안 건드립니다.

       KEY 1.16 · AMB 0.80 은 눈으로 맞춘 값입니다. 더 밀면 그늘이
       까맣게 막히고, 덜 밀면 지금과 같습니다. */
    const KEY = indoor ? 1 : 1.16, AMB = indoor ? 1 : .80;
    sun.color.setHex(s.sun);
    sun.intensity = (indoor ? s.sunI * .7 : s.sunI * KEY) * dull;
    amb.intensity = s.amb * (indoor ? 1.28 : AMB) * (weather === 'clear' ? 1 : 1.08);
    hemi.intensity = s.hemi * dull * (indoor ? 1 : .92);
    /* 불 — 밤일수록 창이 밝아집니다. 값이 안 바뀌면 재질을 안 건드립니다 */
    const want = Math.round(s.night * 20) / 20;
    if (want !== lit) {
      lit = want;
      for (const m of glass) {
        m.emissive.setHex(0xFFE6A8);
        m.emissiveIntensity = want * .95;
        m.needsUpdate = true;
      }
    }
    return s;
  }

  return {
    collect,
    setWeather,
    get weather() { return weather; },
    /** null 이면 실제 시각. 시연 때 밤을 보여 주려면 숫자를 넣습니다 */
    setHour(h) { hour = h; lit = -1; },
    get hour() { return nowHour(); },
    apply,
    /** 매 프레임 — 비·눈을 카메라 아래로 흘립니다 */
    tick(dt, cx, cz) {
      if (!rainG.pts) return;
      const a = rainG.pts.geometry.attributes.position, arr = a.array;
      const slant = rainG.kind === 'snow' ? .6 : 1.6;
      for (let i = 0; i < rainG.n; i++) {
        arr[i * 3 + 1] -= rainG.vel[i] * dt;
        arr[i * 3] += slant * dt * (rainG.kind === 'snow' ? Math.sin(i + arr[i * 3 + 1] * .4) : 1);
        if (arr[i * 3 + 1] < 0) {
          arr[i * 3 + 1] = 20 + Math.random() * 4;
          arr[i * 3] = (Math.random() - .5) * 46;
          arr[i * 3 + 2] = (Math.random() - .5) * 46;
        }
      }
      a.needsUpdate = true;
      rainG.pts.position.set(cx, 0, cz);
    },
  };
}

/** 기상청 값 → 우리가 그릴 날씨 한 낱말 */
export function weatherKind(j) {
  if (!j) return 'clear';
  const t = `${j.label || ''} ${j.sky || ''} ${j.desc || ''}`;
  if (/눈|snow/i.test(t)) return 'snow';
  if (/비|소나기|rain/i.test(t)) return 'rain';
  if (/흐림|구름|cloud/i.test(t)) return 'cloud';
  return 'clear';
}

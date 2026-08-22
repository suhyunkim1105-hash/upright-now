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
  [0,  0x0C1226, 0x6E86C8, .10, .17, .12],
  [4,  0x141E3C, 0x7E94D0, .12, .19, .14],
  [5.5,0x44548A, 0xE8A87C, .48, .38, .30],
  [6.5,0x8FB6D8, 0xFFD9A8, 1.05, .58, .54],
  [8,  0xA9D8EE, 0xFFF0D4, 1.60, .68, .76],
  [11, 0xBFE4F2, 0xFFF6E4, 1.95, .70, .85],
  [14, 0xBCE2F0, 0xFFF4DE, 1.90, .70, .84],
  [16.5,0xCFE2EA, 0xFFE6BC, 1.50, .68, .74],
  [18, 0xE8B892, 0xFFB877, .92, .58, .54],
  [19, 0x7E6B98, 0xC97E60, .48, .38, .30],
  [20.5,0x1E2646, 0x6E86C8, .14, .21, .16],
  [24, 0x0C1226, 0x6E86C8, .10, .17, .12],
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
  let lit = -1;               // 지금 불이 켜져 있는 정도(중복 적용 방지)
  const glass = [];           // 창·가로등 유리 재질
  const rainG = { pts: null, vel: null, n: 0 };

  /* ── 빛나는 재질 모으기 ──
     굽기(bake)가 지오메트리는 합쳐도 **재질은 그대로 둡니다.** 그래서
     재질만 붙잡아 두면 밤에 창 전체가 한 번에 켜집니다. 색으로 고릅니다 —
     bld.js 의 유리색과 실내 창의 하늘색이 그것입니다. */
  const GLASS_HEX = new Set([
    0x9EDCEB, 0xBFEAF5, 0xCFEFFA, 0xBFE4F2, 0xD8F2FA, 0xA9DDF2, 0x9FD8EE,
    0xFFF2CE,                                     // 가로등 유리(campus.js lampPost)
    0xFFF8EA, 0xFFE8C0, 0xE8F4FF,                 // 건물 창(bld.js)
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
    if (k === 'rain' || k === 'snow') makeRain(k); else dropRain();
  }

  function nowHour() {
    if (hour !== null) return hour;
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }

  function apply(indoor) {
    const s = skyAt(nowHour());
    /* 흐리거나 비가 오면 한 단계 눌러 줍니다 — 맑은 날과 같으면 날씨가 안 보입니다 */
    const dull = weather === 'clear' ? 1 : weather === 'cloud' ? .82 : .68;
    if (!indoor) {
      scene.background.setHex(s.sky);
      if (weather !== 'clear') scene.background.multiplyScalar(dull * 1.02);
    }
    /* 밤에는 **빛의 색까지** 파랗게 기울입니다. 세기만 낮추면 파스텔 재질이
       그대로 밝게 남아서 "어두운 낮" 이 됩니다 — 밤으로 안 읽힙니다. */
    const n = s.night;
    amb.color.setRGB(1 - n * .46, 1 - n * .36, 1 - n * .04);
    hemi.color.setRGB(1 - n * .40, 1 - n * .30, 1 - n * .02);
    if (hemi.groundColor) hemi.groundColor.setRGB(1 - n * .52, 1 - n * .44, 1 - n * .14);
    sun.color.setHex(s.sun);
    sun.intensity = (indoor ? s.sunI * .7 : s.sunI) * dull;
    amb.intensity = s.amb * (indoor ? 1.28 : 1) * (weather === 'clear' ? 1 : 1.08);
    hemi.intensity = s.hemi * dull;
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

/* ══════════════════════════════════════════════════════════
   3D 월드의 자세 판정 — **웹캠을 실제로 씁니다.**

   전 판은 sin 곡선으로 굽었다 폈다 했습니다. 시연에서는 굴러가지만
   그건 이 서비스가 파는 것이 아닙니다. 판정 자체는 `../shared/posture.js`
   한 곳에만 있고(월드·온보딩·메인이 같은 것을 씁니다), 이 파일은 그
   엔진에 카메라를 물리고 결과를 월드로 넘기는 배선만 합니다.

   기준(baseline)은 온보딩이 잡아 `girin.baseline` 에 넣어 둡니다.
   그게 없으면 여기서 10초짜리 기준 잡기를 한 번 돌리고 **같은 열쇠·같은
   형식**으로 저장합니다 — 형식이 다르면 온보딩과 월드가 서로의 기준을
   못 알아봅니다.

   못 하면 조용히 물러납니다. 카메라를 거부해도, 모델을 못 받아도
   캠퍼스는 그대로 걸어 다닙니다 — 자세 판정과 그에 딸린 코인만 멈춥니다.
   ══════════════════════════════════════════════════════════ */

const KEY = 'girin.baseline';
const CAL_MS = 10000;                 // 온보딩과 같은 10초
const CAL_MIN_SAMPLES = 40;
const CAL_MIN_PER_FEATURE = 20;
/* 상태를 굽은 정도(0~1)로 옮깁니다. 캐릭터가 굽는 정도이자 막대의 값입니다 */
const K_OF = { good: .10, warning: .48, bad: .88 };

export function createPosture(opt = {}) {
  const say = opt.onStatus || (() => {});
  let video = null, stream = null, raf = 0;
  let smoother = null, arb = null, profile = null;
  let mode = 'off';            // off · asking · loading · calibrating · live · denied · failed
  let k = 0, state = 'good';
  let cal = null;              // { t0, samples[], widths[] }
  let lastT = 0, badReason = '';

  const POSE = () => window.POSE;

  function loadSaved() {
    try {
      const j = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (j && j.version === 3 && j.features && Object.keys(j.features).length >= 3) return j;
    } catch (_) {}
    return null;
  }

  async function start() {
    if (mode === 'live' || mode === 'loading' || mode === 'calibrating') return mode;
    mode = 'asking'; say('카메라를 켜는 중');
    try {
      stream = await navigator.mediaDevices.getUserMedia(window.CAM_CONSTRAINTS
        || { video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
    } catch (e) {
      mode = 'denied'; say('카메라 없이 진행합니다');
      opt.onMode?.(mode); return mode;
    }
    video = opt.video || document.createElement('video');
    video.playsInline = true; video.muted = true; video.autoplay = true;
    video.srcObject = stream;
    try { await video.play(); } catch (_) {}

    mode = 'loading'; say('자세 판정 준비 중'); opt.onMode?.(mode);
    try {
      if (!POSE()) throw new Error('posture.js 가 아직 안 왔습니다');
      await POSE().load();
    } catch (e) {
      mode = 'failed'; say('판정 모델을 못 받았어요'); opt.onMode?.(mode);
      return mode;
    }
    smoother = new (POSE().Smoother)();
    arb = POSE().arbiter();
    profile = loadSaved();
    if (profile) { mode = 'live'; say(''); }
    else { cal = { t0: performance.now(), samples: [], widths: [] }; mode = 'calibrating';
      say('10초 동안 지금 앉은 자세를 기준으로 잡습니다'); }
    opt.onMode?.(mode);
    loop();
    return mode;
  }

  function stop() {
    cancelAnimationFrame(raf); raf = 0;
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    if (video) { video.srcObject = null; }
    mode = 'off'; k = 0; state = 'good'; cal = null;
    opt.onMode?.(mode);
  }

  function finishCal() {
    const P = POSE();
    if (cal.samples.length < CAL_MIN_SAMPLES) {
      say('앉은 모습이 충분히 안 잡혔어요 — 다시 잡습니다');
      cal = { t0: performance.now(), samples: [], widths: [] };
      return;
    }
    const feats = {};
    P.PRIMARY.concat(P.AUX).forEach((key) => {
      const vals = cal.samples.map((s) => s.f[key]).filter((x) => x !== undefined);
      if (vals.length < CAL_MIN_PER_FEATURE) return;
      const m = P.median(vals);
      feats[key] = { median: m, mad: P.mad(vals, m), n: vals.length };
    });
    if (Object.keys(feats).length < 3) {
      say('기준으로 쓸 값이 부족해요 — 밝은 곳에서 다시 잡습니다');
      cal = { t0: performance.now(), samples: [], widths: [] };
      return;
    }
    profile = { version: 3, features: feats,
      shoulderWidthMedian: P.median(cal.widths), sampleCount: cal.samples.length, createdAt: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (_) {}
    cal = null; mode = 'live';
    say(Object.keys(feats).length + '개 축으로 기준을 맞췄어요');
    opt.onMode?.(mode);
    setTimeout(() => { if (mode === 'live') say(''); }, 2600);
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    const P = POSE();
    if (!P || !video || video.readyState < 2) return;
    const now = performance.now();
    /* 15Hz 면 충분합니다. 3D 와 같은 탭에서 도는 판이라 더 자주 돌면
       프레임을 통째로 잡아먹습니다 — 그러면 걷는 것부터 느려집니다. */
    if (now - lastT < 66) return;
    lastT = now;

    const out = P.detect(video, now, smoother);
    if (!out) return;

    if (out.multi) { badReason = '두 명 이상 보여요'; quality(false); return; }
    const a = out.analysis;
    if (!a) { badReason = '화면에서 벗어났어요'; quality(false); return; }
    if (!a.inFrame) { badReason = '화면에서 벗어났어요'; quality(false); return; }
    if (a.shoulderWidth < (P.MIN_SHOULDER_WIDTH || .06)) {
      badReason = '조금 더 가까이 앉아 주세요'; quality(false); return;
    }
    if (a.severeRotation) { badReason = '정면을 봐 주세요'; quality(false); return; }
    badReason = '';

    if (mode === 'calibrating') {
      cal.samples.push({ f: a.features });
      cal.widths.push(a.shoulderWidth);
      const p = Math.min(1, (now - cal.t0) / CAL_MS);
      opt.onCalib?.(p, cal.samples.length);
      if (p >= 1) finishCal();
      return;
    }
    if (mode !== 'live' || !profile) return;

    const v = P.votes(a.features, profile, 'default', a.meanVisibility > .6);
    arb = P.step(arb, v, now);
    state = arb.current;
    /* 막대는 상태만 따라가면 계단이 됩니다. 제일 크게 벗어난 축의 값을
       섞어 부드럽게 흐르게 합니다 — 사람은 이 미세한 변화를 보고 고쳐 앉습니다. */
    const lead = Math.min(1.6, v.maxPrimary) / 1.6;
    const want = Math.max(K_OF[state], Math.min(.95, lead * .9));
    k += (want - k) * .18;
    opt.onState?.(state, k, v);
  }

  function quality(ok) {
    if (!ok) {
      /* 몸이 안 보이는 동안은 **어느 쪽으로도 세지 않습니다.**
         코인도 리포트도 이 구간을 안 씁니다. */
      opt.onState?.('idle', k, null);
      say(badReason);
    }
  }

  return {
    start, stop,
    get mode() { return mode; },
    get k() { return k; },
    get state() { return state; },
    get video() { return video; },
    get hasBaseline() { return !!loadSaved(); },
    clearBaseline() { try { localStorage.removeItem(KEY); } catch (_) {} profile = null; },
  };
}

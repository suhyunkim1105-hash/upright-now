/* calibrate.js — 앉은 자세의 **기준**을 10초 동안 잽니다.
 *
 *   <script src="../shared/posture.js"></script>
 *   <script src="../shared/calibrate.js"></script>
 *
 *   Calibrate.start({ video, onSay, onGuide, onTick, onDone, onFail })
 *   Calibrate.stop()
 *
 * 왜 따로 뺐나. 이 계산이 온보딩 안에만 있었습니다. 로비에서도 기준을
 * 맞출 수 있게 되면서 두 곳이 필요해졌고, 복사해 두면 한쪽만 고쳤을 때
 * 조용히 갈라집니다 — `posture.js` 가 월드와 온보딩에 각각 328줄로
 * 들어 있던 것과 같은 상황입니다. 화면에는 아무 증상이 없고 숫자만
 * 틀립니다.
 *
 * 이 파일은 **계산만** 합니다. 화면에 무엇을 그릴지는 부르는 쪽이
 * 정합니다(onSay·onGuide·onTick). 그래서 온보딩의 큰 고리와 로비의
 * 작은 판이 같은 판정을 쓰면서 생김새는 각자 다를 수 있습니다.
 *
 * 임계값은 **월드(openworld 의 CAL_*)와 같은 값**입니다. 기준을 맞추는
 * 순간에는 "기준 대비" 가 아직 없으므로 절대값으로만 거릅니다 —
 * 각도(도), 거리(cm), 어깨폭으로 나눈 비율. 체형처럼 사람마다 다른
 * 값은 쓰지 않습니다.
 */
(function (global) {
  'use strict';

  /* posture.js 가 `var POSE` 로 전역에 답니다. 이 파일보다 먼저 실려야 합니다. */
  const POSE = global.POSE;

  const SEC = 10;                    /* 채워야 하는 시간 */
  const READY = 3;                   /* 자세를 잡을 시간 */

  /* 월드와 짝을 이루는 임계값 */
  const PITCH_DOWN = 14, PITCH_UP = 14, ROLL = 10;
  const NEAR_CM = 38, TILT = 0.075;
  /* 표본 하한 — 10초 · 4구간 · 최소 70프레임 */
  const BUCKETS = 4, MIN_SAMPLES = 70, MIN_PER_FEATURE = 28;
  const MOVE_LIMIT = 0.2;

  const noop = function () {};
  let raf = 0, timer = 0, running = false;
  let smoother = null;
  const S = { held: 0, last: null, samples: [], widths: [] };

  /** 지금 프레임이 기준으로 쓸 만한가. 아니면 왜 아닌가.
      월드의 calBadPosture 와 같은 순서·같은 문구입니다. */
  function verdict(out) {
    if (!out) return { ok: false, msg: '카메라를 읽는 중이에요' };
    const a = out.analysis;
    if (!a) return { ok: false, msg: '사람이 안 보여요. 화면 앞에 앉아 주세요' };
    if (out.multi) return { ok: false, msg: '두 명 이상 보여요. 혼자 있을 때 맞춰 주세요' };
    if (!a.inFrame || !a.faceCoreOk || !a.bothShouldersOk)
      return { ok: false, msg: '얼굴과 어깨가 함께 보이게 앉아 주세요' };
    if (a.shoulderWidth < POSE.MIN_SHOULDER_WIDTH)
      return { ok: false, msg: '조금 더 가까이 앉아 주세요' };
    if (a.severeRotation)
      return { ok: false, msg: '고개를 돌리고 있어요. 정면을 봐 주세요' };

    const h = out.head;
    if (h) {
      if (h.headPitchDeg > PITCH_DOWN)
        return { ok: false, msg: '고개가 숙여져 있어요. 턱을 살짝 당기고 정면을 봐 주세요' };
      if (h.headPitchDeg < -PITCH_UP)
        return { ok: false, msg: '턱이 들려 있어요. 시선을 화면 높이로 맞춰 주세요' };
      if (Math.abs(h.headRollDeg) > ROLL)
        return { ok: false, msg: '고개가 한쪽으로 기울었어요. 수평으로 세워 주세요' };
      if (h.headDistanceCm < NEAR_CM)
        return { ok: false, msg: '화면에 너무 가까워요. 등을 붙이고 한 뼘만 물러나 주세요' };
    }
    const tilt = a.features.shoulderTiltRatio;
    if (tilt !== undefined && tilt > TILT)
      return { ok: false, msg: '어깨가 한쪽으로 기울었어요. 양쪽 높이를 맞춰 주세요' };

    return { ok: true, msg: '좋아요. 그대로 계세요', a: a };
  }

  /** 크게 움직였으면 그 프레임은 표본에서 뺍니다 — 움직이는 중의 값은
      평소가 아닙니다. 월드의 calMoved 와 같습니다. */
  function moved(next, prev) {
    if (!prev) return false;
    return ['faceScaleRatio', 'headHeightRatio', 'lateralOffsetRatio'].some((k) => {
      const x = next[k], y = prev[k];
      return x !== undefined && y !== undefined && Math.abs(x - y) > MOVE_LIMIT;
    });
  }

  function stop() {
    clearInterval(timer); timer = 0;
    cancelAnimationFrame(raf); raf = 0;
    running = false;
  }

  /** 3·2·1 을 센 뒤 10초를 잽니다.
   *
   *  cb.onReady(left)   — 준비 카운트다운. 0 이면 계측 시작
   *  cb.onSay(msg,warn) — 안내 한 줄. warn 이면 멈춘 이유
   *  cb.onGuide(ok)     — 지금 프레임이 쓸 만한가 (기준선 색)
   *  cb.onTick(left,r)  — 남은 초와 0~1 비율
   *  cb.onDone(base)    — 기준을 저장했습니다
   *  cb.onFail(msg)     — 못 채웠습니다. 부르는 쪽이 다시 걸지 결정합니다
   */
  function start(cb) {
    const video = cb.video;
    const onReady = cb.onReady || noop;
    const onSay = cb.onSay || noop;
    const onGuide = cb.onGuide || noop;
    const onTick = cb.onTick || noop;
    const onDone = cb.onDone || noop;
    const onFail = cb.onFail || noop;

    stop();
    onSay('잠시 후 시작할게요. 자세를 잡아 주세요', false);
    onReady(READY);

    const end = Date.now() + READY * 1000;
    timer = setInterval(function () {
      const left = Math.ceil((end - Date.now()) / 1000);
      if (left > 0) { onReady(left); return; }
      clearInterval(timer); timer = 0;
      onReady(0);
      run();
    }, 100);

    /** 10초 계측.
        **시계는 쓸 만한 프레임에서만 갑니다.** 자세가 무너지면 그 자리에
        멈추고, 왜 멈췄는지 말합니다. 사람이 고치면 다시 갑니다 — 벌이
        아니라 안내라서, 쌓아 둔 시간은 안 버립니다. */
    function run() {
      running = true;
      S.held = 0; S.last = null; S.samples = []; S.widths = [];
      smoother = new POSE.Smoother();
      let prevTs = 0;

      const frame = function (ts) {
        if (!running) return;
        raf = requestAnimationFrame(frame);
        if (!video || video.readyState < 2 || !POSE.ready()) return;

        /* 월드와 같은 이유로 ~15fps 로 자릅니다 — 동기 추론 둘(pose+face)이
           렌더와 같은 rAF 를 나눠 쓰므로, 안 자르면 메인스레드가 마릅니다. */
        if (ts - prevTs < 66) return;
        const dt = prevTs ? Math.min(0.25, (ts - prevTs) / 1000) : 0;
        prevTs = ts;

        const out = POSE.detect(video, ts, smoother);
        const v = verdict(out);
        onGuide(v.ok);

        if (v.ok) {
          onSay(S.held / SEC > 0.76 ? '거의 다 됐어요' : v.msg, false);
          /* 움직이는 중의 값은 표본에서만 빼고, 시계는 계속 갑니다 —
             잠깐 자세를 고치는 것까지 벌하면 10초가 안 끝납니다. */
          if (!moved(v.a.features, S.last)) {
            S.samples.push({
              f: v.a.features,
              bucket: Math.min(BUCKETS - 1, Math.floor(S.held / (SEC / BUCKETS))),
            });
            S.widths.push(v.a.shoulderWidth);
            S.last = v.a.features;
          }
          S.held = Math.min(SEC, S.held + dt);
        } else {
          onSay(v.msg, true);              /* 멈춥니다. held 는 그대로 둡니다 */
        }

        const left = Math.max(0, SEC - S.held);
        onTick(Math.ceil(left), left / SEC);
        if (left <= 0) finish();
      };
      raf = requestAnimationFrame(frame);
    }

    /** 10초를 채웠습니다. 축마다 중앙값과 MAD 를 내어 기준으로 저장합니다.
        월드의 calFinish 와 **같은 계산**이라, 여기서 잡은 기준을 월드가
        그대로 씁니다. */
    function finish() {
      stop();
      const covered = new Set(S.samples.map(function (s) { return s.bucket; })).size;

      if (S.samples.length < MIN_SAMPLES)
        return onFail('앉아 있는 모습이 충분히 안 잡혔어요. 얼굴과 어깨가 보이는 자리에서 다시 해 볼게요.');
      if (covered < BUCKETS)
        return onFail('중간에 자리를 비운 구간이 있어요. 10초 내내 같은 자세로 앉아 주세요.');

      /* 축마다 중앙값과 MAD. 표본이 모자란 축은 기준에서 뺍니다 — 책상에
         가려 엉덩이가 안 보이면 그 축이 빠지고, 빠진 축은 세션에서도
         안 쓰이므로 없는 편이 정확합니다. */
      const feats = {};
      POSE.PRIMARY.concat(POSE.AUX).forEach(function (k) {
        const vals = S.samples.map(function (s) { return s.f[k]; })
          .filter(function (x) { return x !== undefined; });
        if (vals.length < MIN_PER_FEATURE) return;
        const m = POSE.median(vals);
        feats[k] = { median: m, mad: POSE.mad(vals, m), n: vals.length };
      });
      if (Object.keys(feats).length < 3)
        return onFail('기준으로 쓸 만한 값이 부족해요. 조명이 밝은 곳에서 다시 해 볼게요.');

      /* 월드가 읽는 것과 **같은 형식·같은 열쇠**로 저장합니다. 다르면
         월드가 여기서 잡은 기준을 못 알아봅니다. */
      const base = {
        version: 3,
        features: feats,
        shoulderWidthMedian: POSE.median(S.widths),
        sampleCount: S.samples.length,
        createdAt: Date.now(),
      };
      try {
        global.localStorage.setItem('girin.baseline', JSON.stringify(base));
      } catch { /* 저장이 막혀 있어도 끝은 냅니다 */ }

      onSay(Object.keys(feats).length + '개 축으로 기준을 맞췄어요', false);
      onDone(base);
    }
  }

  /** 이 기기에 쓸 만한 기준이 있는가. 게이트가 이걸로 막을지 정합니다. */
  function has() {
    try {
      const b = JSON.parse(global.localStorage.getItem('girin.baseline') || 'null');
      return Boolean(b && b.features && Object.keys(b.features).length >= 3);
    } catch { return false; }
  }

  global.Calibrate = {
    SEC: SEC, READY: READY,
    verdict: verdict, moved: moved,
    start: start, stop: stop, has: has,
    get running() { return running; },
  };
})(window);

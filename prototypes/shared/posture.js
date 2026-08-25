/* 자세 판정 엔진 — Deskfit 의 유일한 정본
   ==================================================================
   **웹캠으로 자세를 보는 코드는 이 파일 하나입니다.** 월드·온보딩·메인이
   같은 것을 부릅니다.

   왜 한 곳인가
     한동안 월드와 온보딩에 같은 328줄이 각각 들어 있었습니다. 글자
     하나까지 같았지만 그건 우연이고, 한쪽만 고치면 조용히 갈라집니다.
     온보딩에서 잡은 기준을 월드가 그대로 읽으므로, 두 곳의 계산이 조금
     이라도 다르면 **기준이 어긋난 채로 판정이 돕니다** — 화면에는 아무
     증상이 없고 숫자만 틀립니다.

   모델을 full 로 두는 이유 (2026-08-20 실측, Intel Iris Xe)
     같은 사진·같은 GPU·IMAGE 모드·60회 중앙값으로 쟀습니다.

       lite    73.9ms
       full    88.8ms   ← 이것
       heavy  144.8ms   프레임 예산(66ms)의 두 배를 넘음
       tasks-vision 1.0.1 은 퇴보 — 같은 full 이 88.8 → 115.4ms (+30%)

     heavy 는 정밀하지만 못 씁니다. **예산 안에서 가장 정밀한 것이 full**
     입니다. 라이브러리도 0.10.35 에 묶어 둡니다.

     주의: VIDEO 모드로 재면 안 됩니다. 추적을 놓친 프레임에서만 탐지기가
     다시 도는데, 모델마다 추적 유지가 달라 heavy 가 full 보다 빨라 보이는
     역전이 납니다. IMAGE 모드가 매 호출 전체 파이프라인을 강제합니다.

   무엇을 안 하는가
     점수·등급을 매기지 않습니다. 의료 판정을 하지 않습니다. 영상·프레임·
     좌표는 어떤 서버로도 나가지 않습니다 — 전부 이 브라우저 안에서
     끝납니다.
   ================================================================== */

/* 카메라 제약 — **모든 화면이 같은 값을 씁니다.**

   640×480 은 판정에 충분하고 그 위로는 추론만 비싸집니다. 소리는 여기서
   안 받습니다: 자세를 보는 데 필요 없고, 같이 요구하면 권한창이 "카메라와
   마이크" 가 되어 허용률이 떨어집니다. 마이크가 필요한 화면(초대 세션)은
   따로 한 번 더 물어봅니다.

   전역 변수로만 두고 아무 데도 안 내보내고 있었습니다. 그래서 초대
   세션이 이 파일을 안 부르고 자기 값(480×360)을 따로 적어 뒀습니다 —
   공개방과 비공개방이 서로 다른 해상도로 카메라를 열고 있었습니다.
   POSE 에 얹어 내보냅니다. */
var CAM_CONSTRAINTS = {
  video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
  audio: false,
};

var POSE = (function () {
  var WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
  /* lite 가 아니라 full 입니다.
     두 모델의 차이는 어깨·귀처럼 옷과 머리카락에 가리는 점에서 가장 크게
     납니다. 하필 우리 판정축 중 earEyeRatio 와 shoulderSpan 이 그 점들을
     씁니다 — lite 로는 그 두 축이 계속 흔들립니다.
     받는 양은 늘지만 한 번만 받고, 세션을 시작할 때만 씁니다. */
  var POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/'
                 + 'pose_landmarker_full/float16/1/pose_landmarker_full.task';
  var FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/'
                 + 'face_landmarker/float16/1/face_landmarker.task';

  var vision = null, poser = null, facer = null, loading = null;

  /* GPU 로 먼저 시도하고 실패하면 CPU. 노트북 내장 그래픽에서 GPU 위임이
     조용히 실패하는 일이 있어, 제품과 같은 폴백을 답니다. */
  function build(delegate) {
    return vision.FilesetResolver.forVisionTasks(WASM).then(function (fs) {
      return Promise.all([
        vision.PoseLandmarker.createFromOptions(fs, {
          baseOptions: { modelAssetPath: POSE_MODEL, delegate: delegate },
          runningMode: 'VIDEO',
          numPoses: 2   /* 2 로 두어 "두 명 이상" 을 감지합니다. 판정은 첫 사람만. */
        }),
        /* 얼굴 메시는 있으면 좋은 것입니다. 정면에서 거북목을 잡는 핵심
           축(머리 거리·숙임)이 여기서 나오지만, 실패해도 나머지 축으로
           판정이 계속돼야 합니다. */
        vision.FaceLandmarker.createFromOptions(fs, {
          baseOptions: { modelAssetPath: FACE_MODEL, delegate: delegate },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFacialTransformationMatrixes: true,
          outputFaceBlendshapes: false
        }).catch(function () { return null; })
      ]);
    });
  }

  function load() {
    if (loading) return loading;
    loading = import(WASM.replace('/wasm', '/vision_bundle.mjs'))
      .then(function (mod) {
        vision = mod;
        return build('GPU').catch(function () { return build('CPU'); });
      })
      .then(function (pair) { poser = pair[0]; facer = pair[1]; return true; })
      .catch(function (err) { loading = null; throw err; });
    return loading;
  }

  /* ---------------- One Euro Filter ----------------
     판정 축 중 거리에 가장 민감한 faceScaleRatio 의 분자(눈 사이 거리)는
     화면 폭의 4% 밖에 안 됩니다. 프레임당 몇 px 흔들림이 그대로 10%대
     잡음이 되어, 머리가 8cm 앞으로 나온 신호를 덮습니다.
     문턱을 낮춰 풀면 오탐이 같이 올라오므로 잡음을 먼저 줄입니다. */
  function LowPass() { this.y = null; }
  LowPass.prototype.filter = function (x, a) {
    this.y = this.y === null ? x : a * x + (1 - a) * this.y;
    return this.y;
  };
  function alphaOf(cut, rate) {
    var tau = 1 / (2 * Math.PI * cut), te = 1 / rate;
    return 1 / (1 + tau / te);
  }
  function OneEuro(minCut, beta, dCut) {
    this.minCut = minCut; this.beta = beta; this.dCut = dCut;
    this.x = new LowPass(); this.dx = new LowPass(); this.last = null;
  }
  OneEuro.prototype.filter = function (v, t) {
    var prev = this.x.y;
    var dt = this.last === null ? 0 : (t - this.last) / 1000;
    var rate = (dt > 0.001 && dt < 1) ? 1 / dt : 12;
    this.last = t;
    var speed = prev === null ? 0 : (v - prev) * rate;
    var sHat = this.dx.filter(speed, alphaOf(this.dCut, rate));
    return this.x.filter(v, alphaOf(this.minCut + this.beta * Math.abs(sHat), rate));
  };
  function Smoother() { this.ch = {}; }
  Smoother.prototype.reset = function () { this.ch = {}; };
  Smoother.prototype.smooth = function (lms, t) {
    if (!lms) return lms;
    var self = this;
    return lms.map(function (lm, i) {
      function c(k) {
        if (!self.ch[k]) self.ch[k] = new OneEuro(0.8, 0.01, 1);
        return self.ch[k];
      }
      return {
        x: c(i + 'x').filter(lm.x, t),
        y: c(i + 'y').filter(lm.y, t),
        z: c(i + 'z').filter(lm.z, t),
        visibility: lm.visibility
      };
    });
  };

  /* ---------------- 머리 6DoF ----------------
     478점을 표준 얼굴 모형에 맞춘 4x4 행렬입니다. 열 우선이라
     R[row][col] = data[col*4 + row].
     Pose 의 성긴 랜드마크로는 머리가 8cm 나온 것을 못 잡습니다 —
     1.6m 에서 8cm 는 배율 5% 변화라 지터에 묻힙니다. 여기서는 cm 로
     직접 나옵니다. */
  var HEAD_YAW_LIMIT = 25, HEAD_ROLL_LIMIT = 25;
  function headPose(data) {
    if (!data || data.length < 16) return null;
    var d = data, dist = Math.abs(d[14]);
    if (!isFinite(dist) || dist < 20 || dist > 150) return null;
    var deg = 180 / Math.PI;
    return {
      headDistanceCm: dist,
      /* 모형은 y 가 위입니다. 턱을 내리면 + 가 되도록 부호를 뒤집습니다. */
      headPitchDeg: -Math.atan2(d[6], d[10]) * deg,
      headYawDeg: Math.atan2(-d[2], Math.hypot(d[6], d[10])) * deg,
      headRollDeg: Math.atan2(d[1], d[0]) * deg
    };
  }
  function headUsable(h) {
    return Math.abs(h.headYawDeg) <= HEAD_YAW_LIMIT
        && Math.abs(h.headRollDeg) <= HEAD_ROLL_LIMIT;
  }

  /* ---------------- 랜드마크 분석 ---------------- */
  var IDX = { nose: 0, leftEyeOuter: 3, rightEyeOuter: 6, leftEar: 7, rightEar: 8,
              leftShoulder: 11, rightShoulder: 12, leftHip: 23, rightHip: 24 };
  var PRESENCE_MIN = 0.5, MIN_SHOULDER_WIDTH = 0.09;
  var YAW_SEVERE = 0.9, YAW_MODERATE = 0.5, FRAME_MARGIN = 0.06;

  var PRIMARY = ['faceScaleRatio', 'headHeightRatio', 'facePitchRatio', 'earEyeRatio',
                 'shoulderSpan', 'lateralOffsetRatio', 'shoulderTiltRatio', 'torsoLean',
                 'headDistanceCm', 'headPitchDeg'];
  var AUX = ['forwardDepthRatio'];

  function pt(lm) {
    if (!lm) return { x: 0, y: 0, z: 0, visibility: 0, present: false };
    var v = lm.visibility == null ? 0 : lm.visibility;
    return { x: lm.x, y: lm.y, z: lm.z, visibility: v, present: v >= PRESENCE_MIN };
  }
  function inFrame(p) {
    return p.x >= -FRAME_MARGIN && p.x <= 1 + FRAME_MARGIN
        && p.y >= -FRAME_MARGIN && p.y <= 1 + FRAME_MARGIN;
  }

  function analyze(lms, hp) {
    if (!lms || lms.length < 25) return null;
    var P = {};
    Object.keys(IDX).forEach(function (k) { P[k] = pt(lms[IDX[k]]); });

    var eyesOk = P.leftEyeOuter.present && P.rightEyeOuter.present;
    var shouldersOk = P.leftShoulder.present && P.rightShoulder.present;
    var earsOk = P.leftEar.present && P.rightEar.present;
    var hipsOk = P.leftHip.present && P.rightHip.present;

    var sw = Math.hypot(P.leftShoulder.x - P.rightShoulder.x,
                        P.leftShoulder.y - P.rightShoulder.y);
    var smx = (P.leftShoulder.x + P.rightShoulder.x) / 2;
    var smy = (P.leftShoulder.y + P.rightShoulder.y) / 2;
    var smz = (P.leftShoulder.z + P.rightShoulder.z) / 2;

    var eyeDist = eyesOk
      ? Math.hypot(P.leftEyeOuter.x - P.rightEyeOuter.x, P.leftEyeOuter.y - P.rightEyeOuter.y) : 0;
    var emx = (P.leftEyeOuter.x + P.rightEyeOuter.x) / 2;
    var emy = (P.leftEyeOuter.y + P.rightEyeOuter.y) / 2;

    /* 정면이면 코가 두 눈 중앙 근처에 있습니다. */
    var yaw = (eyesOk && P.nose.present && eyeDist > 0)
      ? Math.abs(P.nose.x - emx) / (eyeDist / 2) : 0;
    var severe = yaw > YAW_SEVERE, moderate = !severe && yaw > YAW_MODERATE;

    var core = [P.leftShoulder, P.rightShoulder]
      .concat(eyesOk ? [P.leftEyeOuter, P.rightEyeOuter] : [P.nose]);
    var vis = core.reduce(function (s, p) { return s + p.visibility; }, 0) / core.length;

    var f = {}, d = sw || 1;

    if (eyesOk && shouldersOk) {
      f.faceScaleRatio = eyeDist / d;
      f.headHeightRatio = (smy - emy) / d;
    }
    /* ---- 시상면(앞뒤) 축 ----
       faceScale·headHeight 는 shoulderWidth 로 정규화하는데, 거북목은 대개
       상체가 같이 앞으로 나와 어깨도 함께 커집니다 — 분자·분모가 같이
       커져 신호가 상쇄됩니다. 아래 두 축은 eyeDist 로만 정규화해 카메라
       거리와 무관하고, 고개 각도 자체를 잽니다. */
    if (eyesOk && P.nose.present && eyeDist > 0 && !moderate) {
      /* 코는 얼굴 평면보다 앞으로 나와 있어, 고개를 숙이면 눈-코 세로
         간격이 오히려 벌어집니다. 증가가 이탈 방향입니다. */
      f.facePitchRatio = (P.nose.y - emy) / eyeDist;
    }
    if (eyesOk && earsOk && eyeDist > 0 && !moderate) {
      /* 귀는 눈보다 뒤에 있어, 고개를 숙이면 눈보다 덜 내려갑니다. */
      f.earEyeRatio = ((P.leftEar.y + P.rightEar.y) / 2 - emy) / eyeDist;
    }
    if (P.nose.present && shouldersOk && !moderate) {
      f.lateralOffsetRatio = Math.abs(P.nose.x - smx) / d;
      f.forwardDepthRatio = smz - P.nose.z;
    }
    if (shouldersOk) {
      f.shoulderTiltRatio = Math.abs(P.leftShoulder.y - P.rightShoulder.y) / d;
      /* 유일하게 정규화하지 않는 축입니다. 어깨폭은 카메라까지의 거리에
         그대로 반비례하므로, 몸 전체가 화면으로 다가온 것을 잡아냅니다. */
      f.shoulderSpan = sw;
    }
    if (hipsOk && shouldersOk) {
      f.torsoLean = Math.abs(smx - (P.leftHip.x + P.rightHip.x) / 2) / d;
    }
    if (hp && headUsable(hp)) {
      f.headDistanceCm = hp.headDistanceCm;
      f.headPitchDeg = hp.headPitchDeg;
    }

    return {
      features: f, shoulderWidth: sw, yawRatio: yaw,
      severeRotation: severe, moderateRotation: moderate,
      inFrame: core.every(inFrame), meanVisibility: vis,
      bothShouldersOk: shouldersOk, faceCoreOk: P.nose.present || eyesOk
    };
  }

  /* ---------------- 투표 ---------------- */
  var DIRECTION = {
    faceScaleRatio: 1,      /* 얼굴이 커짐 = 카메라 쪽으로 접근 */
    headHeightRatio: -1,    /* 눈-어깨 거리 감소 = 고개 숙임·움츠림 */
    facePitchRatio: 1,      /* 눈-코 세로 간격 벌어짐 = 고개 숙임 */
    earEyeRatio: -1,        /* 귀가 눈보다 올라감 = 고개 숙임 */
    shoulderSpan: 1,        /* 어깨폭 넓어짐 = 몸 전체 접근 */
    lateralOffsetRatio: 1, shoulderTiltRatio: 1, torsoLean: 1,
    headDistanceCm: -1,     /* 얼굴이 가까워짐 = 머리 전방 이동 */
    headPitchDeg: 1,        /* 턱을 내림 */
    forwardDepthRatio: 1
  };
  var FLOOR = {
    faceScaleRatio: 0.03, headHeightRatio: 0.08,
    facePitchRatio: 0.06, earEyeRatio: 0.06, shoulderSpan: 0.012,
    lateralOffsetRatio: 0.1, shoulderTiltRatio: 0.08, torsoLean: 0.1,
    headDistanceCm: 4, headPitchDeg: 8,   /* cm·도 단위 */
    forwardDepthRatio: 0.35
  };
  var MAD_K = 8;
  var SENS = { gentle: 1.4, 'default': 1.0, sensitive: 0.75 };
  var WARNING_ENTER = 1.0, BAD_STRONG = 1.8, GOOD_EXIT = 0.8;

  function votes(f, profile, sens, qualityGood) {
    var mult = SENS[sens] || 1, details = [];
    PRIMARY.concat(AUX).forEach(function (k) {
      var v = f[k], st = profile.features[k];
      if (v === undefined || !st) return;
      var tol = mult * Math.max(FLOOR[k], st.mad * MAD_K);
      var dev = Math.max(0, (v - st.median) * DIRECTION[k]) / tol;
      details.push({ key: k, deviation: dev, primary: PRIMARY.indexOf(k) >= 0,
                     exceeded: dev > WARNING_ENTER });
    });
    var pri = details.filter(function (d) { return d.primary; });
    var over = pri.filter(function (d) { return d.exceeded; }).length;
    var max = pri.reduce(function (m, d) { return Math.max(m, d.deviation); }, 0);
    return {
      details: details, primaryExceedCount: over, maxPrimary: max,
      usedFeatureCount: details.length,
      /* z 는 표가 아닙니다: bad 의 두 번째 표도, good 복귀의 거부권도
         갖지 않습니다. 실카메라에서 z 는 조명·거리에 따라 흘러다닙니다. */
      voteWarning: over >= 1,
      voteBad: over >= 2 || (max > BAD_STRONG && qualityGood),
      voteGood: pri.every(function (d) { return d.deviation < GOOD_EXIT; })
    };
  }

  /* ---------------- 지속 시간으로 확정 ----------------
     한 프레임 튀었다고 상태를 바꾸지 않습니다. */
  var HOLD = { warning: 1500, bad: 5000, good: 2000 };
  function arbiter() { return { current: 'good', candidate: null, since: 0 }; }
  function step(s, v, now) {
    var target = v.voteBad ? 'bad' : v.voteWarning ? 'warning' : v.voteGood ? 'good' : null;
    if (target === null || target === s.current) {
      return { current: s.current, candidate: null, since: now };
    }
    if (s.candidate !== target) return { current: s.current, candidate: target, since: now };
    if (now - s.since >= HOLD[target]) return { current: target, candidate: null, since: now };
    return s;
  }

  /* ---------------- 통계 ---------------- */
  function median(a) {
    var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function mad(a, c) {
    if (c === undefined) c = median(a);
    return median(a.map(function (n) { return Math.abs(n - c); }));
  }

  /* ---------------- 프레임 루프 ----------------
     한 비디오에 대해 Pose 와 Face 를 같은 타임스탬프로 한 번씩 돌립니다. */
  function detect(video, t, smoother) {
    if (!poser) return null;
    var res;
    try { res = poser.detectForVideo(video, t); } catch (e) { return null; }
    var people = res.landmarks || [];
    var raw = people[0];
    if (!raw) { smoother.reset(); return { analysis: null, multi: false, landmarks: null }; }

    var hp = null;
    if (facer) {
      try {
        var fr = facer.detectForVideo(video, t);
        var m = fr.facialTransformationMatrixes && fr.facialTransformationMatrixes[0];
        hp = headPose(m && m.data);
      } catch (e) { hp = null; }
    }
    return {
      analysis: analyze(smoother.smooth(raw, t), hp),
      /* 기준을 맞출 때는 "기준 대비" 가 아직 없으므로 **절대값**이 필요합니다.
         머리 6DoF 는 도·cm 단위라 그대로 쓸 수 있어 밖으로 넘깁니다. */
      head: hp,
      /* 뼈대 그리기용 원본 좌표. 이 키가 빠져 있어 drawSkeleton 이
         한 번도 그려지지 않았습니다 — 호출부 아홉 곳 전부 out.landmarks. */
      landmarks: raw,
      multi: people.length > 1
    };
  }

  return {
    load: load, detect: detect, analyze: analyze, votes: votes,
    arbiter: arbiter, step: step, median: median, mad: mad,
    Smoother: Smoother,
    PRIMARY: PRIMARY, AUX: AUX,
    MIN_SHOULDER_WIDTH: MIN_SHOULDER_WIDTH,
    /* 카메라를 여는 화면은 전부 이 값을 씁니다 — 해상도가 갈리면
       같은 사람이 방마다 다른 그림으로 보입니다. */
    CAM_CONSTRAINTS: CAM_CONSTRAINTS,
    ready: function () { return !!poser; }
  };
})();

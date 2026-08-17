/* ==================================================================
   Deskfit — 접근성 · 저사양 모드

   둘을 한 파일에 둔 이유는 붙는 자리가 같기 때문입니다. 둘 다 마이페이지
   설정 탭에 줄을 하나씩 넣고, 둘 다 index.html 을 안 건드리려고 스타일을
   코드에서 주입합니다. 파일을 나누면 그 붙이는 코드만 두 벌이 됩니다.

   여기서 하는 일:
     · 포커스 — 창 안에 가두고, 닫으면 원래 자리로 돌려놓습니다
     · 스크린리더 — 월드가 무엇이고 어떻게 움직이는지 글로 둡니다
     · 대비 — 작은 회색 글자가 AA 를 못 넘겨서 한 단계 어둡게 합니다
     · 모션 블러 — 기기 설정을 따르고, 손으로도 끌 수 있게 합니다
     · 저사양 모드 — 장식을 끄고 월드를 30fps 로 그립니다
   ================================================================== */
(function () {
  'use strict';

  const LS_PERF = 'girin.perf';
  const LS_MOTION = 'girin.motion';
  const LS_NAG = 'girin.perfNagOff';

  /* ================== 스타일 ================== */
  const css = document.createElement('style');
  css.textContent = `
  /* ---- 대비 ----
     --ink-3 (#9A8E88) 은 흰 바탕에서 2.99:1 입니다. 11~12px 글자에
     쓰이고 있어서 WCAG AA(4.5:1) 를 못 넘깁니다. 한 단계 어둡게 잡으면
     4.7:1 이 되고, 색감은 거의 그대로입니다. 쓰이는 곳이 전부 작은
     보조 글자라 변수 하나만 바꾸면 됩니다. */
  :root { --ink-3: #7A6C66; }

  /* --warn (#D98324) 도 흰 바탕에서 2.91:1 입니다. fps 경고 글자에만
     쓰이는데 그게 11px 이라 제일 안 보이면 안 되는 자리입니다.
     같은 호박색을 어둡게 잡아 5.47:1 로 올립니다. */
  :root { --warn: #9A5A00; }

  /* ---- 포커스 ----
     index.html 이 버튼마다 :focus-visible 을 붙여 뒀지만 빠진 것들이
     있습니다. 안 걸린 것들을 여기서 받습니다. */
  :focus-visible { outline: 2px solid var(--coral-600); outline-offset: 2px; }

  /* ---- 모션 블러 ----
     OS 설정과 손 토글, 둘 중 하나만 켜져도 멈춥니다. */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .001ms !important; animation-iteration-count: 1 !important;
      transition-duration: .001ms !important; scroll-behavior: auto !important;
    }
  }
  body.calm *, body.calm *::before, body.calm *::after {
    animation-duration: .001ms !important; animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
  }
  /* 배너는 애니메이션이 곧 등장입니다. 멈추면 안 보이므로 그냥 띄웁니다. */
  body.calm #banner.play { opacity: 1; animation: none; }

  /* ---- 저사양 모드 ----
     그림자는 GPU 에서 매 프레임 다시 흐립니다. 큰 것 하나(캔버스
     56px 블러)가 작은 것 열보다 비쌉니다. 내장 그래픽에서 제일 먼저
     티가 나는 자리라 여기부터 끕니다. */
  body.perf #stage { background: var(--surface-2); }
  body.perf canvas#world { box-shadow: none; border-radius: 0; }
  body.perf .hud, body.perf #coin, body.perf #gear, body.perf #session,
  body.perf #dialog, body.perf #panel .box, body.perf #chat-bar,
  body.perf #hud-session, body.perf #prompt, body.perf #headTimer {
    box-shadow: none;
  }
  body.perf * { transition: none !important; }
  body.perf #hud-session .dot { animation: none; box-shadow: none; }

  /* ---- 성능 권유 ---- */
  #perf-nag {
    position: fixed; right: 20px; top: 132px; z-index: 12; max-width: 268px;
    background: var(--surface); border: 1px solid var(--coral-200);
    border-radius: var(--r); padding: 12px 14px; box-shadow: var(--sh);
    font-size: 12.5px; line-height: 1.6; color: var(--ink-2);
  }
  #perf-nag b { display: block; color: var(--ink); font-size: 13px; margin-bottom: 3px; }
  #perf-nag .btns { display: flex; gap: 6px; margin-top: 10px; }
  #perf-nag button {
    border: 1px solid var(--line-2); border-radius: 999px; cursor: pointer;
    font: inherit; font-size: 12px; font-weight: 700; padding: 5px 12px;
    background: var(--surface-3); color: var(--ink-2);
  }
  #perf-nag button.go { background: var(--coral); border-color: var(--coral); color: var(--on-coral); }

  /* 설정 줄은 index.html 의 칩을 그대로 씁니다 — 스타일을 여기서
     또 만들면 옆줄과 미묘하게 달라집니다. */
  `;
  document.head.append(css);

  /* ================== 월드 설명 ==================
     캔버스는 스크린리더에게 빈 사각형입니다. 무엇이 있는지, 어떻게
     움직이는지를 글로 한 번은 둬야 합니다. 조작키는 화면에도 있지만
     그건 이미지가 아니라 텍스트라 읽히긴 합니다 — 여기서는 "여기가
     무엇인가" 를 답합니다. */
  const cvEl = document.getElementById('world');
  cvEl.setAttribute('role', 'application');
  cvEl.setAttribute('tabindex', '0');
  cvEl.setAttribute('aria-label',
    'Deskfit 월드. W A S D 또는 방향키로 걷고, Space 로 상호작용합니다. ' +
    'Shift 로 뜁니다. Enter 로 채팅을 엽니다. 현재 위치와 같은 공간에 있는 사람은 ' +
    '화면 안내로 읽어 드립니다.');

  /* 지금 어디인지 — 존이 바뀔 때마다 한 줄 읽어 줍니다.
     enterZone 을 감싸는 대신 **존 배너**의 글자를 봅니다. 배너는 존이
     바뀔 때만 바뀌므로 결과가 같고, index.html 함수를 하나 덜 건드립니다.

     전에는 좌측 상단 배지(#hud-zone)를 봤는데 그 배지가 없어졌습니다.
     없는 노드를 observe 하면 그 자리에서 예외가 나고 **이 파일의 나머지가
     통째로 안 돌았습니다** — 설정 항목도 저사양 모드도 함께 죽습니다.
     그래서 없으면 조용히 건너뜁니다. */
  const zoneSay = document.createElement('div');
  zoneSay.className = 'sr-only';
  zoneSay.setAttribute('aria-live', 'polite');
  document.body.append(zoneSay);
  {
    const banner = document.getElementById('banner');
    const nameEl = banner && banner.querySelector('b');
    const subEl = banner && banner.querySelector('span');
    if (nameEl && subEl) {
      new MutationObserver(() => {
        zoneSay.textContent = nameEl.textContent + ' — ' + subEl.textContent + ' 에 들어왔습니다';
      }).observe(banner, { childList: true, characterData: true, subtree: true });
    }
  }

  /* ================== 창 안 포커스 ==================
     index.html 은 창을 열 때 닫기 버튼에 포커스를 줍니다. 거기까지는
     맞는데, Tab 을 계속 누르면 창 밖 HUD 로 새어 나가고 — 창은 떠
     있는데 조작은 뒤에 있는 것을 건드리게 됩니다. 그리고 닫은 뒤
     포커스가 <body> 로 떨어져서, 키보드만 쓰면 처음부터 Tab 해야 합니다. */
  const panelEl2 = document.getElementById('panel');
  const boxEl = panelEl2.querySelector('.box');
  let opener = null;

  /* 창 제목을 dialog 이름으로 묶습니다 */
  panelEl2.querySelector('header b').id = 'panel-title';
  panelEl2.setAttribute('aria-labelledby', 'panel-title');

  const origOpen = window.openPanel;
  window.openPanel = function () {
    /* 창 안에서 다시 여는 경우(값 저장 후 새로 그리기)에는 안 덮어씁니다 */
    if (!panelOpen) opener = document.activeElement;
    return origOpen.apply(this, arguments);
  };
  const origClose = window.closePanel;
  window.closePanel = function () {
    const r = origClose.apply(this, arguments);
    if (opener && document.contains(opener)) opener.focus();
    opener = null;
    return r;
  };

  const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  window.addEventListener('keydown', (e) => {
    if (!panelOpen || e.key !== 'Tab') return;
    const list = [...boxEl.querySelectorAll(FOCUSABLE)]
      .filter((n) => !n.disabled && n.offsetParent !== null);
    if (!list.length) return;
    const first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!boxEl.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }, true);

  /* ================== 모션 ================== */
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const MOTION = {
    /* 저장된 값이 없으면 OS 를 따릅니다. 손으로 한 번 건드리면
       그때부터는 사람 말을 따릅니다. */
    get calm() {
      const v = localStorage.getItem(LS_MOTION);
      return v === null ? mq.matches : v === '1';
    },
    set calm(v) { localStorage.setItem(LS_MOTION, v ? '1' : '0'); apply(); },
  };
  mq.addEventListener('change', () => { if (localStorage.getItem(LS_MOTION) === null) apply(); });

  /* ================== 저사양 모드 ================== */
  const PERF = {
    on: localStorage.getItem(LS_PERF) === '1',
    /* 월드를 30fps 로 그립니다. 4 를 빼는 것은 vsync 흔들림 때문입니다 —
       33.3ms 를 정확히 재면 한 프레임이 32.9 로 들어올 때 통째로
       건너뛰어 20fps 가 됩니다. */
    budget: 1000 / 30 - 4,
    samples: [],
    set(v) {
      PERF.on = !!v;
      localStorage.setItem(LS_PERF, v ? '1' : '0');
      PERF.samples.length = 0;
      apply();
    },
    /** 브라우저 콘솔에서 숫자를 보려고 열어 둡니다 */
    stats() {
      const s = PERF.samples;
      if (!s.length) return null;
      const sorted = s.toSorted((a, b) => a - b);
      const sum = s.reduce((a, b) => a + b, 0);
      return {
        n: s.length,
        meanMs: +(sum / s.length).toFixed(2),
        medianMs: +sorted[sorted.length >> 1].toFixed(2),
        p95Ms: +sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))].toFixed(2),
      };
    },
  };
  window.PERF = PERF;

  function apply() {
    document.body.classList.toggle('perf', PERF.on);
    document.body.classList.toggle('calm', MOTION.calm);
  }
  apply();

  /* ---- 프레임 가로채기 ----
     index.html 의 frame() 은 자기 꼬리에서 requestAnimationFrame(frame)
     을 부릅니다. frame 은 전역 함수 선언이라 그 이름이 매번 새로 풀리고,
     여기서 바꿔 끼우면 다음 프레임부터 우리 것이 돕니다. index.html 은
     한 줄도 안 바뀝니다.

     update() 를 같이 건너뛰는 것이 중요합니다. draw() 만 건너뛰면
     캔버스는 30fps 인데 머리 위 이름표·타이머는 60fps 로 움직여서
     글자가 캐릭터보다 앞서 갑니다. */
  const origFrame = window.frame;
  let lastRender = 0;
  window.frame = function (now) {
    if (PERF.on && now - lastRender < PERF.budget) {
      requestAnimationFrame(window.frame);
      return;
    }
    lastRender = now;
    const t0 = performance.now();
    origFrame(now);
    const cost = performance.now() - t0;
    PERF.samples.push(cost);
    if (PERF.samples.length > 120) PERF.samples.shift();
  };

  /* ---- 프레임 비용 표시 ----
     fps 는 vsync 에 걸려 60 에서 멈춥니다. 저사양 모드가 실제로 일을
     덜 하는지는 fps 로는 안 보이고 **한 프레임에 쓴 ms** 로 보입니다.
     그래서 기존 fps 줄 옆에 한 줄 더 답니다. */
  const msLine = document.createElement('div');
  msLine.innerHTML = '프레임 <b id="fps-ms">–</b> ms';
  document.getElementById('hud-perf').append(msLine);
  const msEl = msLine.querySelector('b');

  /* ---- 자동 감지 ----
     느린 것은 한 프레임이 아니라 몇 초입니다. 4초를 모아서 중앙값이
     30fps 어치(33ms)를 못 지키면 한 번만 물어봅니다. 껐다고 하면
     다시 안 묻습니다 — 느린 기계에서 계속 뜨면 그게 더 방해입니다. */
  let nagged = localStorage.getItem(LS_NAG) === '1';
  setInterval(() => {
    const s = PERF.stats();
    if (!s) return;
    msEl.textContent = s.medianMs.toFixed(1);
    msEl.className = s.medianMs > 12 ? 'warn' : '';
    if (nagged || PERF.on || s.n < 100) return;
    /* 프레임 간격이 아니라 우리가 쓴 시간으로 봅니다. 브라우저가 다른
       탭 때문에 늦은 것까지 사용자 탓으로 돌리지 않으려고요. */
    if (s.medianMs < 20) return;
    nagged = true;
    showNag();
  }, 4000);

  function showNag() {
    if (document.getElementById('perf-nag')) return;
    const n = document.createElement('div');
    n.id = 'perf-nag';
    n.setAttribute('role', 'status');
    n.innerHTML =
      '<b>화면이 무거워 보여요</b>' +
      '저사양 모드를 켜면 그림자와 장식을 끄고 월드를 30fps 로 그립니다. ' +
      '자세 판정에 쓸 몫이 그만큼 남아요.' +
      '<div class="btns"><button type="button" class="go">저사양 모드 켜기</button>' +
      '<button type="button" class="no">괜찮아요</button></div>';
    document.body.append(n);
    n.querySelector('.go').addEventListener('click', () => { PERF.set(true); n.remove(); });
    n.querySelector('.no').addEventListener('click', () => {
      localStorage.setItem(LS_NAG, '1'); n.remove();
    });
    n.querySelector('.go').focus();
  }
  /* 콘솔에서 직접 불러 볼 수 있게 열어 둡니다 */
  PERF.showNag = showNag;

  /* ================== 설정 탭에 줄 넣기 ==================
     PANELS.settings 는 문자열 템플릿이고 탭을 누를 때마다 통째로 다시
     그려집니다. openPanel 만 감싸면 탭을 바꾼 뒤에 사라집니다. 그려진
     결과를 지켜보다 끼우는 편이 확실하고, index.html 을 안 건드립니다. */
  const bodyEl = panelEl2.querySelector('.body');
  const MARK = 'data-comfort';

  function injectSettings() {
    if (!panelOpen || bodyEl.querySelector('[' + MARK + ']')) return;
    /* 설정 탭인지 알아보는 표시. 여기 글자가 바뀌면 같이 고쳐야 합니다. */
    const rows = [...bodyEl.querySelectorAll('.rows')]
      .find((r) => r.textContent.includes('배경 음악'));
    if (!rows) return;

    rows.append(
      chipRow('저사양 모드', '그림자와 장식을 끄고 월드를 30fps 로 그립니다', PERF.on,
            (v) => PERF.set(v)),
      chipRow('모션 블러', '화면이 움직이는 연출을 멈춥니다. 기기 설정도 따라요', MOTION.calm,
            (v) => { MOTION.calm = v; }),
    );

    const note = document.createElement('div');
    note.className = 'note';
    note.setAttribute(MARK, '');
    note.textContent = '저사양 모드는 fps 를 올리는 것이 아니라 한 프레임에 쓰는 '
      + '시간을 줄입니다. 남는 시간은 자세 판정(MediaPipe)이 가져갑니다.';
    rows.after(note);
  }

  /** 설정 한 줄 — 옆에 있는 다른 설정들과 **같은 칩**입니다.
      전에는 이 두 줄만 스위치였습니다. 한 목록에서 조작 방식이 둘이면
      어느 쪽이 지금 켜진 것인지 매번 다시 읽어야 합니다.

      값이 ROOM 이 아니라 girin.perf · girin.motion 에 있으므로 index.html
      의 칩 위임 처리기를 쓸 수 없습니다. 그쪽은 `ROOM[group] = v` 를
      하는데 여기 group 은 ROOM 에 없는 이름이라 쓰레기 키가 생깁니다.
      그래서 칩마다 직접 듣고 **stopPropagation** 으로 위임까지 못 가게
      막습니다 — 버튼에 걸린 처리기가 먼저 돌기 때문에 이게 됩니다. */
  function chipRow(label, sub, on, onChange) {
    const el = document.createElement('div');
    el.className = 'row';
    el.setAttribute(MARK, '');
    el.innerHTML = '<span><em></em></span>'
      + '<div class="chips">'
      + '<button type="button" class="chip" data-v="on">켬</button>'
      + '<button type="button" class="chip" data-v="off">끔</button>'
      + '</div>';
    const name = el.firstChild;
    name.insertBefore(document.createTextNode(label), name.firstChild);
    name.querySelector('em').textContent = sub;

    const chips = [...el.querySelectorAll('.chip')];
    const paint = (v) => chips.forEach((c) =>
      c.setAttribute('aria-pressed', String(c.dataset.v === v)));
    paint(on ? 'on' : 'off');

    for (const c of chips) {
      c.addEventListener('click', (e) => {
        e.stopPropagation();
        paint(c.dataset.v);
        onChange(c.dataset.v === 'on');
      });
    }
    return el;
  }

  new MutationObserver(injectSettings).observe(bodyEl, { childList: true });
})();

// 화면을 감싸는 최소한의 껍데기와, 예전 메인페이지의 **손맛**입니다.
//
// 옮겨 온 것은 화면 구조가 아니라 반응 문법 하나입니다 —
//
//   올리면 뜬다 (translateY -2 ~ -3px, 그림자가 같이 커짐)
//   판 안의 그림은 더 뜨고 살짝 기운다 (-6px, -2deg)
//   누르면 내려앉는다
//
// 값은 예전 화면의 --clay-sm-lift / --clay-hero-lift / --clay-night-lift 를
// 그대로 옮겨 적은 것입니다.

export const CSS = `
:root {
  color-scheme: light;
  --ease: cubic-bezier(.16, 1, .3, 1);
  --t-hover: 180ms;

  --lift-sm:
    inset 0 2px 5px rgba(255,255,255,.76),
    inset 0 -4px 8px rgba(13,60,52,.16),
    0 11px 22px rgba(16,74,66,.15);
  --lift-hero:
    inset 0 6px 10px rgba(255,255,255,.66),
    inset 0 -10px 16px rgba(11,86,76,.30),
    inset 0 -1px 0 rgba(11,86,76,.20),
    0 8px 12px rgba(13,119,105,.18),
    0 30px 44px -8px rgba(13,119,105,.40),
    0 54px 74px -24px rgba(23,32,30,.28);
  --lift-night:
    inset 0 3px 7px rgba(173,235,226,.17),
    inset 0 -7px 13px rgba(0,0,0,.34),
    0 22px 40px rgba(9,20,18,.30),
    0 4px 10px rgba(9,20,18,.18);
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body { margin: 0; overflow: hidden; background: #DDE7F2; color: #333D4B; word-break: keep-all;
       -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
       font-family: "Pretendard Deskfit", "Pretendard", system-ui, sans-serif; }

.scr { position: absolute; inset: 0; animation: in .22s var(--ease); }
.scr[hidden] { display: none; }
.scr[data-dir="fwd"] { animation-name: inFwd; }
.scr[data-dir="back"] { animation-name: inBack; }
@keyframes in { from { opacity: 0; transform: translateY(8px); } }
@keyframes inFwd { from { opacity: 0; transform: translateX(20px); } }
@keyframes inBack { from { opacity: 0; transform: translateX(-20px); } }

/* ── 손맛 ────────────────────────────────────────────────────────
   ① 반응은 누르는 순간입니다, 떼는 순간이 아닙니다.
   ② 올리면 뜨고, 누르면 내려앉습니다. 색은 안 건드립니다 —
      점토는 눌러도 재질이 바뀌지 않습니다. */
button, [data-hot], [data-switch], [data-seg-item], [data-pick] { cursor: pointer; }
button, [data-hot] {
  transition: transform var(--t-hover) var(--ease), box-shadow var(--t-hover) var(--ease);
}
button:hover, [data-hot]:hover { transform: translateY(-2px); box-shadow: var(--lift-sm); }
button:active, [data-hot]:active { transform: translateY(1px); }
:focus-visible { outline: 3px solid #21C4AE; outline-offset: 3px; border-radius: 6px; }

/* 큰 판은 더 크게 뜹니다. 판 안의 그림은 판보다 한 뼘 더 떠서 살짝 기웁니다
   — 이게 "마우스를 올리면 월드가 살아나는" 그 반응입니다. */
[data-pick] { transition: transform var(--t-hover) var(--ease), box-shadow var(--t-hover) var(--ease); }
[data-pick] img, [data-pick] > span:not([style*="position: absolute; left: 0"]) {
  transition: transform 260ms var(--ease);
}
[data-pick]:hover { transform: translateY(-3px); }
[data-pick][data-skin="night"]:hover { box-shadow: var(--lift-night); }
[data-pick][data-skin="light"]:hover { box-shadow: var(--lift-hero); }
[data-pick] img[data-dolly] { transition: transform 2400ms cubic-bezier(.22, .61, .36, 1); }
[data-pick]:hover img[data-dolly] { transform: scale(1.22); }
[data-pick]:hover img:not([data-dolly]) { transform: translateY(-6px) rotate(-2deg) scale(1.04); }
[data-pick][data-pick="on"]:not(:hover) { transform: translateY(-2px); }
[data-pick]:active { transform: translateY(2px); }

/* 그림을 품은 다른 판(캐릭터 자리·학생증)도 같은 문법으로 */
[data-lift] { transition: transform var(--t-hover) var(--ease), box-shadow var(--t-hover) var(--ease); }
[data-lift]:hover { transform: translateY(-3px); box-shadow: var(--lift-sm); }
[data-lift] img { transition: transform 260ms var(--ease); }
[data-lift]:hover img { transform: translateY(-5px) rotate(-2deg); }

[data-switch] > span { transition: left 160ms var(--ease); }
[data-slider] > span:first-child { transition: width 90ms linear; }
[data-slider] > span:last-child { transition: left 90ms linear; }

@media (prefers-reduced-motion: reduce) {
  .scr { animation: none; }
  button, [data-hot], [data-pick], [data-lift], [data-switch] > span, [data-slider] > span,
  [data-pick] img, [data-lift] img { transition: none; }
  button:hover, [data-hot]:hover, [data-pick]:hover, [data-lift]:hover,
  button:active, [data-hot]:active, [data-pick]:active,
  [data-pick]:hover img, [data-lift]:hover img { transform: none; }
}

/* ── 알림 ── */
#toast { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%) translateY(10px);
  padding: 13px 20px; border-radius: 99px; background: rgba(25,31,40,.88); color: #F4F8FC;
  font-size: 13px; font-weight: 750; opacity: 0; pointer-events: none; z-index: 30;
  transition: opacity 160ms ease-out, transform 160ms var(--ease); }
#toast.on { opacity: 1; transform: translateX(-50%) translateY(0); }

/* ── 상태 열기 ── */
.dev { position: fixed; right: 16px; bottom: 16px; z-index: 20; }
.dev > button { width: 40px; height: 40px; border: 0; border-radius: 50%; cursor: pointer;
  display: grid; place-items: center; background: #F6FAFE; color: #4E5968;
  box-shadow: 0 12px 22px -8px rgba(25,31,40,.45), inset 0 4px 8px rgba(255,255,255,.95),
              inset 0 -5px 10px rgba(86,110,146,.2); }
.dev-menu { position: absolute; right: 0; bottom: 50px; width: 214px; max-height: 70dvh; overflow: auto;
  padding: 12px; border-radius: 20px; background: #F6FAFE;
  box-shadow: 0 26px 46px -18px rgba(25,31,40,.5), inset 0 4px 8px rgba(255,255,255,.95),
              inset 0 -6px 12px rgba(86,110,146,.18); }
.dev-menu[hidden] { display: none; }
.sg { margin-bottom: 10px; }
.sg > span { display: block; padding: 0 8px 6px; font-size: 10px; letter-spacing: .08em; color: #4E5968; }
.dev-menu button { display: block; width: 100%; text-align: left; padding: 7px 9px; margin-bottom: 2px;
  border: 0; border-radius: 9px; background: transparent; color: #333D4B; font: inherit; font-size: 12px;
  cursor: pointer; }
.dev-menu button:hover { background: #E4EDF7; transform: none; box-shadow: none; }
.dev-menu button[aria-current="true"] { background: #E4F5F0; color: #0B6156; }
`;

export function shell({ sections, stateMenu }) {
  return `${sections}

<div class="dev">
  <button type="button" id="devBtn" aria-label="화면 목록" aria-expanded="false">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
  </button>
  <div class="dev-menu" id="devMenu" hidden>${stateMenu}</div>
</div>

<div id="toast" role="status" aria-live="polite"></div>`;
}

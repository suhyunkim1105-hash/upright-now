/*
 * 링크 하나로 넘길 단독본을 만듭니다.
 *
 * 아티팩트는 외부 호스트로 나가는 요청을 전부 막습니다 — 타일시트도
 * 서체도 파일 안에 박아 넣어야 합니다. MediaPipe 는 CDN 에서 받으므로
 * 여기서는 아예 안 됩니다. 되는 것과 안 되는 것을 첫 화면에서 말하고
 * 시작하는 편이, 앉아 보고 나서 아무 일도 안 일어나는 것보다 낫습니다.
 *
 *   node build-artifact.mjs
 *   → artifact.html
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, 'index.html');
const out = resolve(here, 'artifact.html');

let html = readFileSync(src, 'utf8');
const b64 = (rel, mime) =>
  'data:' + mime + ';base64,' + readFileSync(resolve(here, rel)).toString('base64');

/* ---- 서체 ---- */
const before = html.length;
html = html.replace(
  "url('assets/fonts/PretendardVariable.woff2') format('woff2-variations')",
  "url(" + b64('assets/fonts/PretendardVariable.woff2', 'font/woff2') + ") format('woff2-variations')"
);
if (html.length === before) throw new Error('서체 경로를 못 찾았습니다');

/* ---- 타일시트 셋 ----
   school 은 빌드 타임에 구운 school16.png 을 씁니다 (다수결 축소가
   런타임에서 빠진 것과 같은 커밋). 변수명과 파일명이 달라 짝으로 적습니다. */
for (const [name, file] of [['urban', 'urban.png'], ['city', 'city.png'], ['school', 'school16.png']]) {
  const n0 = html.length;
  html = html.replace(
    name + ".src = 'assets/" + file + "';",
    name + ".src = '" + b64('assets/' + file, 'image/png') + "';"
  );
  if (html.length === n0) throw new Error(name + ' 경로를 못 찾았습니다');
}

/* ---- 카메라가 막힌 곳이라는 것을 정확히 말합니다 ---- */
html = html.replace(
  ": '카메라를 열지 못했어요. 미리보기 창에서는 항상 막힙니다 — 크롬에서 직접 열어 주세요.';",
  ": '이 링크에서는 카메라를 쓸 수 없어요. 자세 판정은 프로토타입 원본을 크롬에서 열어야 돕니다.';"
);
html = html.replace(
  "camMsg.textContent = '판정 모델을 받지 못했어요 (오프라인이거나 CDN 차단).';",
  "camMsg.textContent = '이 링크는 외부 요청이 막혀 있어 판정 모델을 못 받습니다.';"
);

/* ---- 첫 화면 ----
   아티팩트를 여는 사람은 이게 무엇이고 어디까지 도는지 모릅니다.
   월드 위에 카드를 한 장 얹고, 닫으면 다시 안 나옵니다. */
const card = `
<div id="gate" role="dialog" aria-modal="true" aria-labelledby="gate-h">
  <div class="gate-card">
    <p class="gate-eyebrow"><i></i>프로토타입 · 화면과 흐름</p>
    <h1 id="gate-h">기린캠퍼스</h1>
    <p class="gate-lead">자세를 봐 주는 온라인 자습실. 캠퍼스를 걸어 다니고,
      자리에 앉으면 세션이 시작됩니다.</p>

    <div class="gate-cols">
      <section>
        <h2>여기서 도는 것</h2>
        <ul>
          <li>캠퍼스 · 건물 넷 · 실내 넷</li>
          <li>세션 타이머와 회고</li>
          <li>마이페이지 · 안내 · 코인</li>
          <li>운동장 · 호수 · 동아리 거리 · 미니게임존</li>
        </ul>
      </section>
      <section>
        <h2>여기서 안 되는 것</h2>
        <ul>
          <li>웹캠 자세 판정 — 링크에서는 카메라가 막힙니다</li>
          <li>AI 리포트 · 멀티플레이 · 상점</li>
          <li>미니게임 — 관문만 서 있습니다</li>
        </ul>
      </section>
    </div>

    <dl class="gate-keys">
      <div><dt><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></dt><dd>이동</dd></div>
      <div><dt><kbd>Space</kbd></dt><dd>상호작용 · 앉기</dd></div>
      <div><dt><kbd>Shift</kbd></dt><dd>뛰기</dd></div>
    </dl>

    <button id="gate-go" type="button">캠퍼스 들어가기</button>
    <p class="gate-note">기숙사에서 시작합니다. 우측 상단 톱니가 마이페이지입니다.</p>
  </div>
</div>
`;

const style = `
  /* ---- 첫 화면 ----
     월드와 같은 색 체계를 씁니다. 코랄은 채움으로만 쓰고 글자는 잉크를
     얹습니다 — 코랄 위 흰 글자는 대비가 2.81 이라 AA 에 못 미칩니다. */
  #gate {
    position: fixed; inset: 0; z-index: 200;
    display: grid; place-items: center;
    padding: 24px;
    background:
      radial-gradient(120% 90% at 50% 38%, rgba(255,255,255,.94) 0%,
                      rgba(251,247,245,.96) 55%, rgba(244,236,232,.97) 100%);
    -webkit-backdrop-filter: blur(2px); backdrop-filter: blur(2px);
    overflow: auto;
  }
  #gate.off { display: none; }
  .gate-card {
    width: min(640px, 100%);
    background: var(--surface);
    border: 1px solid var(--line-2);
    border-radius: var(--r-lg);
    box-shadow: var(--sh-lg);
    padding: 28px 30px 24px;
    display: flex; flex-direction: column; gap: 16px;
  }
  .gate-eyebrow {
    margin: 0; display: flex; align-items: center; gap: 7px;
    font-size: 11.5px; font-weight: 700; letter-spacing: .09em;
    text-transform: uppercase; color: var(--ink-3);
  }
  .gate-eyebrow i {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--coral); flex: none;
  }
  .gate-card h1 {
    margin: 0; font-size: 34px; font-weight: 800;
    letter-spacing: -.02em; line-height: 1.1; text-wrap: balance;
  }
  .gate-lead {
    margin: 0; max-width: 46ch; color: var(--ink-2); font-size: 14.5px;
  }
  .gate-cols {
    display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px;
    padding: 16px 0; border-block: 1px solid var(--line);
  }
  .gate-cols h2 {
    margin: 0 0 7px; font-size: 11.5px; font-weight: 700;
    letter-spacing: .07em; text-transform: uppercase; color: var(--ink-3);
  }
  .gate-cols ul { margin: 0; padding: 0; list-style: none;
    display: flex; flex-direction: column; gap: 5px; }
  .gate-cols li {
    position: relative; padding-left: 14px; font-size: 13.5px; color: var(--ink-2);
  }
  .gate-cols li::before {
    content: ''; position: absolute; left: 0; top: .62em;
    width: 5px; height: 5px; border-radius: 1px; background: var(--line-2);
  }
  .gate-cols section:first-child li::before { background: var(--coral-300); }
  .gate-keys {
    margin: 0; display: flex; flex-wrap: wrap; gap: 8px 20px;
  }
  .gate-keys > div { display: flex; align-items: center; gap: 8px; }
  .gate-keys dt { display: flex; gap: 3px; margin: 0; }
  .gate-keys dd { margin: 0; font-size: 12.5px; color: var(--ink-3); }
  .gate-keys kbd {
    min-width: 21px; padding: 3px 6px; text-align: center;
    background: var(--surface-3); border: 1px solid var(--line-2);
    border-bottom-width: 2px; border-radius: 5px;
    font: 600 11px/1 'Pretendard Variable', ui-monospace, monospace;
    color: var(--ink-2);
  }
  #gate-go {
    align-self: flex-start; margin-top: 2px;
    padding: 11px 22px; border: 0; border-radius: 999px;
    background: var(--coral); color: var(--on-coral);
    font: 700 14px/1 'Pretendard Variable', sans-serif;
    cursor: pointer; transition: transform .12s ease, box-shadow .12s ease;
    box-shadow: 0 4px 14px rgba(255, 107, 82, .34);
  }
  #gate-go:hover { transform: translateY(-1px); box-shadow: 0 7px 20px rgba(255, 107, 82, .40); }
  #gate-go:active { transform: translateY(0); }
  #gate-go:focus-visible { outline: 3px solid var(--coral-700); outline-offset: 3px; }
  .gate-note { margin: 0; font-size: 12px; color: var(--ink-3); }
  @media (max-width: 560px) {
    .gate-card { padding: 22px 20px 20px; }
    .gate-card h1 { font-size: 27px; }
    .gate-cols { grid-template-columns: 1fr; }
  }
  @media (prefers-reduced-motion: reduce) {
    #gate-go { transition: none; }
    #gate-go:hover { transform: none; }
  }
`;

/* 스타일은 기존 :root 토큰 뒤에 붙입니다 — 토큰을 그대로 씁니다 */
html = html.replace('  * { box-sizing: border-box; }', style + '\n  * { box-sizing: border-box; }');
/* 카드는 stage 앞에 둡니다 */
html = html.replace('<div id="stage">', card + '<div id="stage">');

/* 닫기 — 키보드로도 닫히고, 닫은 뒤 초점이 월드로 갑니다 */
html = html.replace('</script>', `
/* ---- 첫 화면 닫기 ----
   포커스를 버튼에 두고 시작합니다. 엔터/스페이스로 바로 들어갈 수 있어야
   키보드만 쓰는 사람이 마우스를 찾지 않습니다. */
(function () {
  var gate = document.getElementById('gate');
  var go = document.getElementById('gate-go');
  if (!gate || !go) return;
  function close() {
    gate.classList.add('off');
    var cv = document.getElementById('world');
    if (cv) cv.focus && cv.focus();
    window.focus();
  }
  go.addEventListener('click', close);
  gate.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  requestAnimationFrame(function () { go.focus(); });
})();
</script>`);

writeFileSync(out, html, 'utf8');
const mb = (Buffer.byteLength(html, 'utf8') / 1048576).toFixed(2);
console.log('artifact.html', mb, 'MB');

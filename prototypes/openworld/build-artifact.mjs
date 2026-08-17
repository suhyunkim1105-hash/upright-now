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

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, 'index.html');
const out = resolve(here, 'artifact.html');

let html = readFileSync(src, 'utf8');
const b64 = (rel, mime) =>
  'data:' + mime + ';base64,' + readFileSync(resolve(here, rel)).toString('base64');

/* ---- 서체 ----
   Pretendard 는 @font-face 의 url(), Wanted Sans 는 <link> 로 들어옵니다.
   후자는 CSS 파일 안에서 다시 woff2 를 부르므로 두 겹을 다 박아야 합니다. */
const before = html.length;
html = html.replace(
  "url('assets/fonts/PretendardVariable.woff2') format('woff2-variations')",
  "url(" + b64('assets/fonts/PretendardVariable.woff2', 'font/woff2') + ") format('woff2-variations')"
);
if (html.length === before) throw new Error('서체 경로를 못 찾았습니다');

/* Wanted Sans — CSS 안의 상대경로를 CSS 가 있던 폴더 기준으로 풀어 박습니다.
   92개 subset 을 전부 넣으면 8MB 가 넘으므로, 한글·라틴 구간만 남기고
   나머지 unicode-range 블록은 버립니다. */
{
  const m = html.match(/<link rel="stylesheet" href="([^"]*WantedSansVariable\.css)">/);
  if (!m) throw new Error('Wanted Sans 링크를 못 찾았습니다');
  const cssPath = resolve(here, m[1]);
  const cssDir = dirname(cssPath);
  let css = readFileSync(cssPath, 'utf8');
  const faces = css.match(/@font-face\s*\{[^}]*\}/g) || [];
  const kept = faces.filter((f) => {
    const r = f.match(/unicode-range:\s*([^;]+);/);
    if (!r) return true;
    /* 한글 음절(AC00-D7A3)·자모(1100-11FF)·기본 라틴만 */
    return /U\+AC00|U\+1100|U\+0000|U\+002[0-9A-F]|U\+00[0-9A-F]{2}-/i.test(r[1]);
  }).map((f) => f.replace(/url\(([^)]+)\)/g, (whole, u) => {
    const file = u.replace(/['"]/g, '').trim();
    if (/^data:/.test(file)) return whole;
    try {
      return 'url(' + 'data:font/woff2;base64,'
        + readFileSync(resolve(cssDir, file)).toString('base64') + ')';
    } catch { return 'url()'; }
  }));
  html = html.replace(m[0], '<style>\n' + kept.join('\n') + '\n</style>');
  console.log('Wanted Sans subset ' + kept.length + '/' + faces.length + '개 박음');
}

/* ---- 그림 전부 ----
   예전에는 타일시트 셋만 이름으로 찾아 박았습니다. 캐릭터 시트 여덟 장과
   아이템 89장이 들어오면서 그 방식이 못 따라갑니다. `assets/…png` 을
   **문자열 그대로** 훑어 한 번에 바꿉니다 — 새 그림이 늘어도 안 빠집니다. */
{
  const seen = new Map();
  const paths = [...new Set([...html.matchAll(/'(assets\/[\w./-]+\.png)'/g)].map((m) => m[1]))];
  for (const rel of paths) {
    try { seen.set(rel, b64(rel, 'image/png')); }
    catch { console.log('  없음(건너뜀) ' + rel); }
  }
  /* 큰따옴표 안(미니게임 <img src="assets/…">)도 같이 훑습니다 */
  for (const m of html.matchAll(/"(assets\/[\w./-]+\.png)"/g))
    if (!seen.has(m[1])) { try { seen.set(m[1], b64(m[1], 'image/png')); } catch { /* 없음 */ } }
  for (const [rel, uri] of seen) html = html.split(rel).join(uri);
  console.log('그림 ' + seen.size + '장 박음');
}

/* ---- 캐릭터 시트 여덟 장 ----
   경로를 `CHAR_BASE_PATH + slug + '.png'` 로 조립하므로 문자열로는 안 잡힙니다.
   아이템과 같은 수법 — 표를 심고 로더가 먼저 봅니다. */
{
  const table = {};
  for (const e of readdirSync(resolve(here, 'assets/characters')))
    if (e.endsWith('.png')) table[e.replace(/\.png$/, '')] = b64('assets/characters/' + e, 'image/png');
  html = html.replace("const CHAR_BASE_PATH = 'assets/characters/';",
    "const CHAR_BASE_PATH = 'assets/characters/';\nconst CHAR_INLINE = " + JSON.stringify(table) + ';');
  const n0 = html.length;
  html = html.replace(/(\w+)\.src = CHAR_BASE_PATH \+ ([\w.]+) \+ '\.png';/g,
    "$1.src = (typeof CHAR_INLINE !== 'undefined' && CHAR_INLINE[$2]) || (CHAR_BASE_PATH + $2 + '.png');");
  if (html.length === n0) throw new Error('캐릭터 시트 로더를 못 찾았습니다');
  console.log('캐릭터 시트 ' + Object.keys(table).length + '장 박음');
}

/* ---- 아이템 그림 ----
   경로를 코드가 조립합니다(`ITEM_BASE + 'tops/tee.png'`). 문자열로 못 찾으므로
   폴더를 통째로 읽어 이름→data URI 표를 만들어 심고, 로더가 그 표를 먼저
   봅니다. 표에 없으면 원래대로 네트워크를 탑니다(원본에서는 그게 맞습니다). */
{
  const table = {};
  const walk = (dir, prefix) => {
    for (const e of readdirSync(resolve(here, dir), { withFileTypes: true })) {
      if (e.isDirectory()) walk(dir + '/' + e.name, prefix + e.name + '/');
      else if (e.name.endsWith('.png')) table[prefix + e.name] = b64(dir + '/' + e.name, 'image/png');
    }
  };
  walk('assets/items', '');
  html = html.replace("const ITEM_BASE = 'assets/items/';",
    "const ITEM_BASE = 'assets/items/';\nconst ITEM_INLINE = " + JSON.stringify(table) + ';');
  html = html.replace("img.src = ITEM_BASE + path;",
    "img.src = (typeof ITEM_INLINE !== 'undefined' && ITEM_INLINE[path]) || (ITEM_BASE + path);");
  console.log('아이템 ' + Object.keys(table).length + '장 박음');
}

/* ---- 옆에 붙은 스크립트 ----
   multiplayer · chat · comfort · save · korcen · config. 링크에서는 파일을
   못 받으므로 안 박으면 조용히 빠집니다 — 특히 korcen 이 빠지면 비속어
   필터가 꺼진 줄도 모르고 돕니다. config 는 비밀값이라 **안 넣습니다.** */
{
  let n = 0;
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (whole, rel) => {
    if (rel.includes('config.js')) return '<!-- config.js 는 배포판에 넣지 않습니다 -->';
    try {
      const code = readFileSync(resolve(here, rel), 'utf8');
      n++;
      return '<script>\n/* ' + rel + ' */\n' + code + '\n</script>';
    } catch { return '<!-- ' + rel + ' 없음 -->'; }
  });
  console.log('스크립트 ' + n + '개 박음');
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
    <h1 id="gate-h">Deskfit</h1>
    <p class="gate-lead">자세를 봐 주는 온라인 자습실. 캠퍼스를 걸어 다니고,
      도서관·본관에 앉으면 웹캠 화면이 작게 뜹니다.</p>

    <div class="gate-cols">
      <section>
        <h2>여기서 도는 것</h2>
        <ul>
          <li>캠퍼스 · 건물 넷 · 실내 넷</li>
          <li>세션 타이머 · 회고 · 지난 세션</li>
          <li>상점 — 캐릭터 8종에 옷 입히기</li>
          <li>명예의 전당 · 코인 · 미니게임 넷</li>
        </ul>
      </section>
      <section>
        <h2>여기서 안 되는 것</h2>
        <ul>
          <li>웹캠 자세 판정 — 링크에서는 카메라가 막힙니다</li>
          <li>코인 서버 저장 — 이 링크에서는 기기 안에만 남습니다</li>
          <li>AI 리포트</li>
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

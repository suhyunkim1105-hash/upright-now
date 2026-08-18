/* 빌드 뒤에 돕니다 — prototypes 를 dist 로 복사하고, `/` 를 랜딩으로 바꿉니다.
   public/ 에 사본을 커밋하면 원본과 어긋나서, 빌드 때마다 원본을 복사합니다.

   출시 형태는 랜딩 → 온보딩 → 앱 셸(월드 탭 포함) 하나입니다. `src/` 의
   React 본서비스는 지우지 않고 `/app.html` 로 비켜 둡니다 — 지우면 테스트
   649개와 lint·build 가 같이 무너집니다.

   `/` 를 랜딩으로 바꾸는 방법은 둘이었습니다.
     (가) vercel.json 에서 `/` 를 랜딩 파일로 rewrite
     (나) 여기서 dist/index.html 자체를 랜딩으로 쓰기  ← 이걸 골랐습니다
   (가)는 Vercel 에서만 참입니다. `npm run build` 한 dist 를 정적 서버로
   열면 `/` 가 여전히 React 앱이라, 배포 전에 확인한 것과 배포된 것이
   다릅니다. (나)는 어디서 열어도 같은 화면이라 빌드 산출물만 보고
   확인할 수 있습니다. 대신 랜딩의 상대경로를 여기서 고쳐야 합니다 —
   아래 REWRITE 가 그 전부이고, 안 맞으면 마지막 검사에서 빌드가 멈춥니다. */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

/* ponytail: cpSync({recursive}) 가 이 윈도우+node 22.19 조합에서 세그폴트라 직접 걷습니다 */
function copyDir(src, dst, onHtml) {
  mkdirSync(dst, { recursive: true });
  for (const e of readdirSync(src, { withFileTypes: true })) {
    if (e.isDirectory()) copyDir(`${src}/${e.name}`, `${dst}/${e.name}`, onHtml);
    else if (onHtml && e.name.endsWith('.html')) {
      writeFileSync(`${dst}/${e.name}`, onHtml(readFileSync(`${src}/${e.name}`, 'utf8')));
    } else copyFileSync(`${src}/${e.name}`, `${dst}/${e.name}`);
  }
}

/* 프로토타입은 소스 트리에서 `../../public/fonts/…` 로 서체를 찾습니다.
   Vite 는 public/ 의 내용물을 dist 바로 밑에 펼치므로 dist 에는 public/
   폴더가 없습니다 — 고치지 않으면 배포본에서만 서체가 없는 화면이 됩니다. */
const fixFonts = (html) => html.replaceAll('../../public/fonts/', '/fonts/');

for (const name of ['landing', 'onboarding', 'openworld', 'room-flow']) {
  copyDir(`prototypes/${name}`, `dist/prototypes/${name}`, fixFonts);
}

/* React 본서비스는 자리만 비켜 줍니다. 안에서 쓰는 주소가 전부 `/assets/…`
   처럼 절대경로라 파일 위치를 옮겨도 그대로 뜹니다. 라우터는 basename 이
   없어서 `/app.html` 로 들어가면 `*` 규칙이 `/` 로 보냅니다 — 화면은 옛
   홈이 맞고 주소만 `/` 로 바뀝니다. `/growth` 같은 안쪽 주소는 vercel.json
   의 rewrite 가 그대로 app.html 로 보내므로 예전과 똑같이 동작합니다.

   두 번째 실행에서는 dist/index.html 이 이미 랜딩입니다. 그걸 app.html
   로 덮으면 React 앱이 사라지므로, 옮기는 건 Vite 가 막 만든 것일 때만
   입니다(빌드 없이 이 스크립트만 다시 도는 경우). */
if (!existsSync('dist/app.html') || readFileSync('dist/index.html', 'utf8').includes('<div id="root">')) {
  renameSync('dist/index.html', 'dist/app.html');
}

/* 랜딩을 `/` 로 옮기면서 고쳐야 하는 상대경로. 이게 전부입니다. */
const REWRITE = [
  ['../../public/fonts/', '/fonts/'],
  /* 문자열 그대로 바꿉니다 — 랜딩의 언어 전환표가 이 주소를 CSS 선택자로
     들고 있어서, href 와 선택자가 같이 바뀌어야 짝이 유지됩니다. */
  ['../onboarding/index.html', '/prototypes/onboarding/index.html'],
];
let landing = readFileSync('prototypes/landing/index.html', 'utf8');
for (const [from, to] of REWRITE) landing = landing.replaceAll(from, to);
/* assets/ · vendor/ 는 따옴표 뒤에 오는 것만 바꿉니다. @keyframes 이름처럼
   같은 글자가 다른 뜻으로 쓰인 자리를 건드리지 않기 위해서입니다. */
landing = landing.replace(/(["'])(assets|vendor)\//g, '$1/prototypes/landing/$2/');

/* 남은 상대경로가 있으면 배포본에서 조용히 404 가 됩니다. 여기서 멈춥니다. */
const leftover = landing.match(/["']\.{0,2}\/?(assets|vendor)\/|\.\.\//g);
if (leftover) {
  throw new Error(`dist/index.html 에 고쳐지지 않은 상대경로: ${[...new Set(leftover)].join(' ')}`);
}
writeFileSync('dist/index.html', landing);

writeFileSync('dist/demo.html', `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Deskfit — 팀 데모</title>
<style>
  body { font-family: 'Pretendard Variable', Pretendard, sans-serif; max-width: 40rem;
         margin: 4rem auto; padding: 0 1.5rem; line-height: 1.7; color: #3B2F2A; }
  h1 { font-size: 1.4rem; }
  h2 { font-size: 1rem; margin: 2rem 0 .5rem; color: #7A6C66; }
  li { margin: .8rem 0; }
  a { color: #C4573B; font-weight: 600; }
  small { color: #7A6C66; }
</style>
<h1>Deskfit — 팀 데모</h1>

<h2>출시 흐름</h2>
<ul>
  <li><a href="/">랜딩</a><br><small>여기서 시작합니다 — CTA 가 온보딩으로 이어집니다</small></li>
  <li><a href="/prototypes/onboarding/index.html">온보딩</a><br><small>알 고르기 · 학교 인증 · 기준 잡기 → 끝나면 앱 셸</small></li>
  <li><a href="/prototypes/room-flow/index.html">앱 셸</a><br><small>방 만들기 · 성장 · 캠퍼스 · <b>월드</b> · 마이페이지</small></li>
</ul>

<h2>따로 열어 보기</h2>
<ul>
  <li><a href="/prototypes/openworld/index.html">기린캠퍼스 오픈월드</a><br><small>앱 셸의 월드 탭이 이 파일을 iframe 으로 답니다</small></li>
  <li><a href="/prototypes/landing/index.html">랜딩 (원본 경로)</a><br><small>\`/\` 와 같은 화면. 이쪽은 상대경로 그대로입니다</small></li>
  <li><a href="/app.html">옛 React 본서비스</a><br><small>지금 흐름에서는 안 씁니다. 열면 주소가 \`/\` 로 바뀝니다(라우터의 * 규칙) — 안쪽 주소는 /growth · /shop 처럼 그대로 씁니다</small></li>
</ul>
`);
console.log('dist/prototypes(4) + dist/index.html(랜딩) + dist/app.html + dist/demo.html 완료');

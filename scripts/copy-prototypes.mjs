/* 배포본을 만듭니다 — prototypes 를 dist 로 옮기고 `/` 를 랜딩으로 둡니다.

   **이 저장소의 제품은 prototypes 입니다.** 한동안 React 본서비스(`src/`)가
   같이 있었고 이 스크립트가 그것을 `/app.html` 로 비켜 세웠습니다. React 는
   폐기했으므로(2026-08-21) 이제 여기서 나오는 것이 전부입니다.

   Vite 가 하던 일 둘을 여기서 대신합니다.
     · public/ 을 dist 밑에 펼치기 — 서체가 `/fonts/…` 로 잡혀야 합니다
     · dist 를 비우고 시작하기 — 안 하면 지운 파일이 배포본에 남습니다

   `/` 를 랜딩으로 만드는 방법은 둘이었습니다.
     (가) vercel.json 에서 rewrite
     (나) dist/index.html 자체를 랜딩으로 쓰기  ← 이걸 골랐습니다
   (가)는 Vercel 에서만 참입니다. 빌드한 dist 를 정적 서버로 열면 `/` 가
   달라져서, 배포 전에 확인한 것과 배포된 것이 다릅니다. (나)는 어디서
   열어도 같은 화면이라 산출물만 보고 확인할 수 있습니다. 대신 랜딩의
   상대경로를 여기서 고쳐야 하고, 안 맞으면 마지막 검사가 빌드를 멈춥니다. */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

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

/* Vite 가 없으므로 dist 를 직접 비우고 시작합니다. 안 비우면 지운 파일이
   배포본에 남아, 로컬에는 없는 화면이 배포에서만 살아 있게 됩니다. */
rmSync('dist', { recursive: true, force: true });

/* public/ 은 dist 바로 밑에 펼칩니다(Vite 가 하던 것). 프로토타입이
   `/fonts/…` 로 서체를 찾으므로 이 배치여야 합니다. */
copyDir('public', 'dist');

/* 프로토타입은 소스 트리에서 `../../public/fonts/…` 로 서체를 찾습니다.
   Vite 는 public/ 의 내용물을 dist 바로 밑에 펼치므로 dist 에는 public/
   폴더가 없습니다 — 고치지 않으면 배포본에서만 서체가 없는 화면이 됩니다. */
const fixFonts = (html) => html.replaceAll('../../public/fonts/', '/fonts/');

/* shared 도 함께 옮깁니다. 온보딩과 월드가 `../shared/…` 로 부르는데
   목록에 없어서 배포본에서만 404 였고, 그러면 SPA 리라이트가 대신
   app.html 을 돌려줘 브라우저가 HTML 을 스크립트로 읽습니다
   ("Unexpected token '<'"). 로컬에서는 파일이 옆에 있어 안 드러납니다. */
/* deskfit 이 지금의 메인입니다. 온보딩 끝에서 `../deskfit/index.html` 로
   보내는데 이 목록에 없어서, 배포본에서만 마지막 한 걸음이 404 였습니다 —
   바로 위 주석이 shared 로 한 번 겪은 것과 같은 자리입니다. 화면을 새로
   만들면 여기에 한 줄을 같이 더해야 합니다. */
const FOLDERS = ['landing', 'onboarding', 'deskfit', 'campus3d', 'lobby', 'mypage', 'league', 'room', 'home', 'openworld', 'room-flow', 'shared'];

for (const name of FOLDERS) {
  copyDir(`prototypes/${name}`, `dist/prototypes/${name}`, fixFonts);
}

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
landing = landing.replace(/(["'`])(assets|vendor|legal)\//g, '$1/prototypes/landing/$2/');

/* 남은 상대경로가 있으면 배포본에서 조용히 404 가 됩니다. 여기서 멈춥니다. */
const leftover = landing.match(/["'`]\.{0,2}\/?(assets|vendor|legal)\/|\.\.\//g);
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
  <li><a href="/prototypes/deskfit/index.html">메인</a><br><small>세션 · <b>월드 입장</b> · 비공개 세션 · AI 리포트 · 랭킹전 · 마이페이지</small></li>
  <li><a href="/prototypes/campus3d/index.html">3D 월드맵</a><br><small>메인의 월드 입장 단추가 여는 최신 클레이 캠퍼스</small></li>
  <li><a href="/prototypes/home/index.html">메인 (옛 판본)</a><br><small>deskfit 이 이것을 대신합니다. 비교용으로만 둡니다</small></li>
  <li><a href="/prototypes/room-flow/index.html">앱 셸 (옛 판본)</a><br><small>라임 시절. 방 만들기 마법사를 메인으로 옮길 때 참고합니다</small></li>
</ul>

<h2>따로 열어 보기</h2>
<ul>
  <li><a href="/prototypes/openworld/index.html">기린캠퍼스 오픈월드</a><br><small>앱 셸의 월드 탭이 이 파일을 iframe 으로 답니다</small></li>
  <li><a href="/prototypes/landing/index.html">랜딩 (원본 경로)</a><br><small>\`/\` 와 같은 화면. 이쪽은 상대경로 그대로입니다</small></li>
</ul>
`);
console.log('dist/ — public + prototypes(' + FOLDERS.length + ') + index.html(랜딩) + demo.html 완료');

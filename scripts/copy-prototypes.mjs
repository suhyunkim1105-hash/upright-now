/* 빌드 뒤에 돕니다 — prototypes 를 dist 로 복사하고 demo.html 을 만듭니다.
   public/ 에 사본을 커밋하면 원본과 어긋나서, 빌드 때마다 원본을 복사합니다. */
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';

/* ponytail: cpSync({recursive}) 가 이 윈도우+node 22.19 조합에서 세그폴트라 직접 걷습니다 */
function copyDir(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const e of readdirSync(src, { withFileTypes: true })) {
    if (e.isDirectory()) copyDir(`${src}/${e.name}`, `${dst}/${e.name}`);
    else copyFileSync(`${src}/${e.name}`, `${dst}/${e.name}`);
  }
}
for (const name of ['openworld', 'room-flow']) {
  copyDir(`prototypes/${name}`, `dist/prototypes/${name}`);
}

writeFileSync('dist/demo.html', `<!doctype html>
<html lang="ko">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>UpRight Now — 팀 데모</title>
<style>
  body { font-family: 'Pretendard Variable', Pretendard, sans-serif; max-width: 40rem;
         margin: 4rem auto; padding: 0 1.5rem; line-height: 1.7; color: #3B2F2A; }
  h1 { font-size: 1.4rem; }
  li { margin: .8rem 0; }
  a { color: #C4573B; font-weight: 600; }
  small { color: #7A6C66; }
</style>
<h1>UpRight Now — 팀 데모</h1>
<ul>
  <li><a href="/">본 서비스</a><br><small>2인 친구 방 · 자세 세션 — 프로덕트 본체</small></li>
  <li><a href="/campus">캠퍼스 영토전</a><br><small>학교 테마 영토전 (기능 플래그가 켜져 있어야 보입니다)</small></li>
  <li><a href="/prototypes/openworld/">기린캠퍼스 오픈월드</a><br><small>픽셀 캠퍼스 — 상점 · 명예의전당 · 멀티플레이(가짜 서버) · 채팅 · 미니게임</small></li>
  <li><a href="/prototypes/room-flow/">방 흐름 프로토타입</a><br><small>친구 방 진입부터 세션까지의 화면 흐름</small></li>
</ul>
`);
console.log('dist/prototypes + dist/demo.html 완료');

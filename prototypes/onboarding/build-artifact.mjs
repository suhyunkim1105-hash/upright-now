/*
 * 단독본을 클로드 아티팩트에 올릴 수 있는 형태로 바꿉니다.
 *
 *   node prototypes/onboarding/build-standalone.mjs   (먼저)
 *   node prototypes/onboarding/build-artifact.mjs
 *   → prototypes/onboarding/artifact.html
 *
 * 아티팩트는 게시할 때 <!doctype>·<head>·<body> 를 스스로 씌웁니다.
 * 그래서 우리 문서의 그 껍데기를 벗겨야 합니다. 안 벗기면 문서 안에
 * 문서가 들어가고, 그때 어느 <style> 이 이기는지 알 수 없습니다.
 *
 * 남기는 것 — <title>(탭 이름과 목록 이름이 여기서 나옵니다)과 <style>,
 * 그리고 본문 전부. 버리는 것 — doctype, <html>, charset·viewport meta.
 * 껍데기가 주는 것을 두 번 쓰면 충돌합니다.
 *
 * 서체는 build-standalone 이 이미 data: URI 로 박아 넣었습니다. 아티팩트는
 * CSP 로 외부 호스트를 전부 막으므로 그게 유일한 방법입니다.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, 'standalone.html');
const out = resolve(here, 'artifact.html');

if (!existsSync(src)) {
  console.error('standalone.html 이 없습니다. 먼저 build-standalone.mjs 를 돌리세요.');
  process.exit(1);
}

let html = readFileSync(src, 'utf8');

/* ---- 1. 껍데기 벗기기 ---- */
const strip = [
  /^<!doctype html>\s*/i,
  /<html[^>]*>\s*/i,
  /<meta charset="[^"]*">\s*/i,
  /<meta name="viewport"[^>]*>\s*/i,
  /<\/html>\s*$/i,
  /<\/body>\s*/i,
  /<body[^>]*>\s*/i,
  /<\/?head>\s*/gi,
];
for (const re of strip) html = html.replace(re, '');

/* ---- 2. 남았는지 확인 ---- */
const banned = [/<!doctype/i, /<html[\s>]/i, /<\/html>/i, /<body[\s>]/i, /<\/body>/i, /<head[\s>]/i];
for (const re of banned) {
  if (re.test(html)) { console.error('껍데기가 남았습니다: ' + re); process.exit(1); }
}
if (!/<title>/i.test(html)) { console.error('title 이 사라졌습니다.'); process.exit(1); }

/* title 은 앞 8KB 안에 있어야 아티팩트가 읽습니다 */
const at = html.search(/<title>/i);
if (at > 8000) { console.error('title 이 ' + at + '바이트 뒤에 있습니다 (8KB 안이어야 함).'); process.exit(1); }

/* ---- 3. 밖을 보는 참조가 없는지 ---- */
const leftover = [...html.matchAll(/(?:src|href)="((?!data:|#)[^"]+)"/g)].map((m) => m[1]);
if (leftover.length) {
  console.error('CSP 가 막을 외부 참조: ' + leftover.join(', '));
  process.exit(1);
}

writeFileSync(out, html, 'utf8');
console.log(`artifact.html  ${Math.round(Buffer.byteLength(html) / 1024)} KB  ·  title 위치 ${at}B  ·  외부 참조 0`);

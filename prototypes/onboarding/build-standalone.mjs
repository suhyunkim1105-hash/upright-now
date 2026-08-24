/*
 * 온보딩 단독본을 만듭니다. 파일 하나로 어디서든 열립니다.
 *
 *   node prototypes/onboarding/build-standalone.mjs
 *   → prototypes/onboarding/standalone.html
 *
 * index.html 은 세 가지를 상대경로로 부릅니다 — 저장소 안의 Wanted Sans,
 * shared/config.js, shared/school-auth.js. 파일 하나만 넘기면 그 경로가
 * 없으므로 전부 안에 박아 넣습니다. 외부로 나가는 요청이 0 이 됩니다.
 *
 * 단독본에서는 로그인이 흉내로 돕니다. config.js 가 비어 있고(키는 커밋
 * 하지 않습니다) file:// 은 어차피 Supabase 가 CORS 로 막습니다. 화면과
 * 흐름을 보는 용도이므로 그게 맞습니다.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, 'index.html');
const out = resolve(here, 'standalone.html');

/* 저장소의 유니코드 구간별 92 subset 중, **이 문서가 실제로 쓰는 글자**가
   든 것만 넣습니다. 자르지 않은 한 벌을 넣으면 1.6MB 가 되고, 그 크기면
   미리보기가 열리지 않습니다. 한글 상용 구간 몇 개만 필요합니다. */
const fontDir = resolve(here, '../../public/fonts/wanted-sans');
const fontCss = resolve(fontDir, 'WantedSansVariable.css');

for (const p of [src, fontCss]) {
  if (!existsSync(p)) { console.error('없는 파일: ' + p); process.exit(1); }
}

let html = readFileSync(src, 'utf8');

/* ---- 1. 서체 — 쓰는 글자가 든 subset 만 ---- */
/* 워크스페이스(루트 prototypes)와 저장소(upright-now/prototypes)는 서체
   상대경로가 한 단계 다릅니다. 어느 쪽에서 돌려도 찾도록 둘 다 받습니다. */
const linkPattern = /(?:<!--[\s\S]*?-->\s*)?<link rel="stylesheet" href="\.\.\/\.\.\/(?:upright-now\/)?public[^>]*>/;
if (!linkPattern.test(html)) {
  console.error('폰트 link 태그를 못 찾았습니다. index.html 이 바뀌었는지 확인하세요.');
  process.exit(1);
}

/* 화면에 나올 수 있는 글자를 모읍니다. 마크업의 글자와, 스크립트 안의
   따옴표 문자열(버튼 문구·오류 문구·캐릭터 대사)까지 봅니다. */
const used = new Set();
for (const ch of html.replace(/<[^>]+>/g, ' ')) used.add(ch.codePointAt(0));
for (const m of html.matchAll(/'([^'\n]*)'|"([^"\n]*)"/g)) {
  for (const ch of (m[1] || m[2] || '')) used.add(ch.codePointAt(0));
}

/* CSS 를 subset 단위로 갈라, unicode-range 가 위 글자와 겹치는 것만 남깁니다. */
const css = readFileSync(fontCss, 'utf8');
const faces = [...css.matchAll(/@font-face\s*\{[^}]*?src:\s*url\("\.\/woff2\/([^"]+)"\)[^}]*?unicode-range:\s*([^;]+);[^}]*\}/g)];
if (!faces.length) { console.error('subset 을 못 읽었습니다.'); process.exit(1); }

let kept = 0, bytes = 0;
const blocks = [];
for (const f of faces) {
  const ranges = f[2].split(',').map((r) => {
    const m = /U\+([0-9a-f]+)(?:-([0-9a-f]+))?/i.exec(r.trim());
    return m ? [parseInt(m[1], 16), parseInt(m[2] || m[1], 16)] : null;
  }).filter(Boolean);
  let hit = false;
  for (const cp of used) { if (ranges.some(([a, b]) => cp >= a && cp <= b)) { hit = true; break; } }
  if (!hit) continue;
  const file = resolve(fontDir, 'woff2', f[1]);
  if (!existsSync(file)) { console.error('없는 subset: ' + file); process.exit(1); }
  const data = readFileSync(file);
  bytes += data.length; kept++;
  blocks.push(`  @font-face {
    font-family: "Wanted Sans Variable";
    font-style: normal; font-display: swap; font-weight: 400 1000;
    src: url(data:font/woff2;base64,${data.toString('base64')}) format("woff2-variations");
    unicode-range: ${f[2].trim()};
  }`);
}

html = html.replace(linkPattern, `<style>
  /* Wanted Sans Variable — SIL Open Font License 1.1
     https://github.com/wanteddev/wanted-sans
     92 subset 중 이 문서가 쓰는 글자가 든 ${kept}개만 넣었습니다. */
${blocks.join('\n')}
</style>`);

/* ---- 2. 스크립트 둘 ---- */
let inlined = 0;
html = html.replace(/<script src="\.\.\/shared\/([\w.-]+)"><\/script>\n?/g, (m, name) => {
  const p = resolve(here, '../shared/' + name);
  if (!existsSync(p)) { console.error('없는 스크립트: ' + p); process.exit(1); }
  inlined++;
  /* 본문 속 </script> (calibrate.js 머리 주석의 사용 예시)가 스크립트
     블록을 조기 종료시키지 않도록 이스케이프합니다. */
  const body = readFileSync(p, 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script>\n/* ---- ${name} (단독본용 인라인) ---- */\n${body}</script>\n`;
});
/* korcen.js · config.js · school-auth.js */
if (inlined < 3) { console.error('스크립트를 다 못 넣었습니다 (' + inlined + '개).'); process.exit(1); }

/* ---- 3. 그림·아이콘 — 파비콘 둘, 로고, 캐릭터 판 넉 장 ---- */
const assetDir = resolve(here, '../landing/assets');
const mime = { svg: 'image/svg+xml', ico: 'image/x-icon', webp: 'image/webp' };
let assetBytes = 0;
const dataUri = (name) => {
  const p = resolve(assetDir, name);
  if (!existsSync(p)) { console.error('없는 에셋: ' + p); process.exit(1); }
  const data = readFileSync(p);
  assetBytes += data.length;
  return `data:${mime[name.split('.').pop()]};base64,${data.toString('base64')}`;
};

/* 로고와 파비콘은 제품에서 뺐습니다. 예전에는 여기서 data URI 로
   박아 넣었는데, 자산 자체가 없으므로 이 단계도 없습니다. */

/* loadPets() 가 JS 로 부르는 넉 장. src 속성이 아니라 아래 leftover 검사에
   안 걸리고, 단독본에서 조용히 빈 캔버스가 됩니다. PET_DIR 결합식을
   data URI 표로 바꿔 넣습니다. */
const petSrc = {};
for (const id of ['turtle', 'giraffe', 'penguin', 'frog']) petSrc[id] = dataUri(`char-${id}-cut.webp`);
const petDirLine = "const PET_DIR = '../landing/assets/';";
const petSrcLine = "img.src = PET_DIR + 'char-' + sp.id + '-cut.webp';";
if (!html.includes(petDirLine) || !html.includes(petSrcLine)) {
  console.error('loadPets 의 경로 코드를 못 찾았습니다. index.html 이 바뀌었는지 확인하세요.');
  process.exit(1);
}
html = html
  .replace(petDirLine, '/* 단독본 — 캐릭터 판 넉 장을 data URI 로 인라인 */\nconst PET_SRC = ' + JSON.stringify(petSrc) + ';')
  .replace(petSrcLine, 'img.src = PET_SRC[sp.id];');

/* ---- 4. 남은 외부 참조가 있는지 확인 ----
   인라인된 스크립트 본문은 빼고 봅니다 — calibrate.js 머리 주석의 사용
   예시(<script src="...">)가 진짜 참조처럼 걸립니다. 태그 자체는 남겨
   두므로, 안 넣은 <script src>·<link href> 는 여전히 잡힙니다. */
const scanned = html.replace(/(<script[^>]*>)[\s\S]*?(<\/script>)/g, '$1$2');
const leftover = [...scanned.matchAll(/(?:src|href)="((?!data:|#)[^"]+)"/g)].map((m) => m[1]);
if (leftover.length) {
  console.error('아직 밖을 보는 참조가 남았습니다: ' + leftover.join(', '));
  process.exit(1);
}

writeFileSync(out, html, 'utf8');
const kb = (n) => Math.round(n / 1024) + ' KB';
console.log(`standalone.html  ${kb(Buffer.byteLength(html))}`);
console.log(`  서체 ${kept}/${faces.length} subset · ${kb(bytes)}  ·  스크립트 ${inlined}개  ·  그림 7장 ${kb(assetBytes)}`);
console.log('  외부 요청 0 — 파일 하나로 열립니다.');

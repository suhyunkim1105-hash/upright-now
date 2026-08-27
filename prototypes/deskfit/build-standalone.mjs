// 공유용 한 파일을 만듭니다. index.html 은 읽고 고치기 좋게 서체·그림을
// 밖에 두는데, 링크로 넘길 때는 그것들이 파일 안에 있어야 합니다.
//
//   node build-standalone.mjs   →  standalone.html (외부 요청 0)
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIME = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

let s = readFileSync(join(HERE, 'index.html'), 'utf8');

const inline = (rel) => {
  const bytes = readFileSync(join(HERE, rel));
  return 'data:' + MIME[extname(rel).toLowerCase()] + ';base64,' + bytes.toString('base64');
};

// 공용 엔진도 파일 안으로 들입니다 — 밖에 두면 링크로 넘긴 한 파일이 죽습니다.
// 넣은 코드의 주석 안에도 같은 모양의 문자열이 있어서, 실제 태그 넷만 바꿉니다.
let inlined = 0;
s = s.replace(/<script src="(\.\.\/shared\/[^"]+)"><\/script>/g, (m, rel) => {
  if (inlined++ >= 4) return m;
  const code = readFileSync(join(HERE, rel), 'utf8');
  return '<script>\n/* ' + rel + ' */\n' + code + '\n</script>';
});

// 심벌은 랜딩 폴더에 있습니다. 한 파일로 넘기면 그 폴더가 따라가지 않으므로
// svg 를 그대로 품고, .ico 줄은 지웁니다 — 못 읽을 주소를 남겨 둘 이유가 없습니다.
const mark = readFileSync(join(HERE, '../landing/assets/favicon.svg'), 'utf8');
s = s.replace(/href="\.\.\/landing\/assets\/favicon\.svg"/g,
  'href="data:image/svg+xml;base64,' + Buffer.from(mark, 'utf8').toString('base64') + '"');
s = s.replace(/\n?<link rel="alternate icon"[^>]*>/g, '');

s = s.replace(/url\(\.\/(fonts\/[^)]+)\)/g, (m, rel) => 'url(' + inline(rel) + ')');
s = s.replace(/\.\/(assets\/[^"')\s]+)/g, (m, rel) => inline(rel));
s = s.replace(/<!-- 이 파일이 원본입니다[\s\S]*?-->\n/, '');

writeFileSync(join(HERE, 'standalone.html'), s, 'utf8');
const left = (s.match(/\.\/(assets|fonts)\/|\.\.\/landing\//g) || []).length;
console.log('standalone.html ' + Math.round(s.length / 1024) + ' KB · 남은 외부 참조 ' + left);

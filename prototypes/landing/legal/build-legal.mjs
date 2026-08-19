/* 법적 문서 마크다운 → 랜딩 톤 HTML.
   의존성 없이 우리가 쓰는 문법만 처리합니다 — 표·제목·인용·목록·강조·링크·수평선.
   실행: node prototypes/landing/legal/build-legal.mjs */
import fs from 'node:fs';
import path from 'node:path';

/* 이 파일이 있는 곳. 절대경로로 박아 두면 다른 기계에서 안 돕니다. */
const DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

/* ---- 연락처는 한 곳에서만 ----
   전에는 일곱 문서에 같은 주소를 손으로 적어 뒀습니다. 바꿀 일이 생기면
   일곱 군데를 찾아야 하고, 하나를 놓치면 **개인정보처리방침이 죽은
   주소를 가리킵니다.**

   마크다운에는 `{{CONTACT}}` 만 씁니다. 실제 값은 여기 한 줄입니다. */
const CONTACT = process.env.DESKFIT_CONTACT || 'ikmc554@mju.ac.kr';
const DOCS = [
  ['privacy', '개인정보처리방침'],
  ['terms', '서비스 이용약관'],
  ['camera', '카메라 사용 고지'],
  ['security', '보안 정책 및 취약점 신고'],
  ['accessibility', '접근성 고지'],
  ['licenses', '오픈소스 라이선스 고지'],
  ['support', '서비스 상태 및 문의'],
];

const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* 인라인: 코드 → 링크 → 굵게 (코드 안은 건드리지 않게 순서가 중요합니다) */
function inline(t) {
  const code = [];
  t = esc(t).replace(/`([^`]+)`/g, (_, c) => `\u0000${code.push(c) - 1}\u0000`);
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt, href) =>
    `<a href="${href.replace(/\.md$/, '.html')}">${txt}</a>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${code[+i]}</code>`);
}

function render(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0, list = null;

  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };

  while (i < lines.length) {
    const ln = lines[i];

    /* 표 — 헤더 + 구분선 + 본문 */
    if (ln.startsWith('|') && (lines[i + 1] || '').match(/^\|[\s:|-]+\|$/)) {
      closeList();
      const cells = r => r.split('|').slice(1, -1).map(c => c.trim());
      const head = cells(ln);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(cells(lines[i++]));
      const hasHead = head.some(Boolean);
      out.push('<div class="tw"><table>');
      if (hasHead) out.push('<thead><tr>' + head.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead>');
      out.push('<tbody>' + rows.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody>');
      out.push('</table></div>');
      continue;
    }

    /* 인용 — 연속된 > 를 한 덩이로 */
    if (ln.startsWith('>')) {
      closeList();
      const buf = [];
      while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${buf.filter(Boolean).map(b => `<p>${inline(b)}</p>`).join('')}</blockquote>`);
      continue;
    }

    /* 목록 — 번호·글머리 */
    const ul = ln.match(/^[-*]\s+(.*)$/);
    const ol = ln.match(/^\d+\.\s+(.*)$/);
    if (ul || ol) {
      const want = ul ? 'ul' : 'ol';
      if (list !== want) { closeList(); out.push(`<${want}>`); list = want; }
      out.push(`<li>${inline((ul || ol)[1])}</li>`);
      i++;
      continue;
    }

    if (/^---+$/.test(ln)) { closeList(); out.push('<hr>'); i++; continue; }

    const h = ln.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      closeList();
      const lv = h[1].length;
      /* 문서 제목(h1)은 헤더에서 따로 그리므로 본문에서는 뺍니다 */
      if (lv > 1) out.push(`<h${lv}>${inline(h[2])}</h${lv}>`);
      i++;
      continue;
    }

    if (!ln.trim()) { closeList(); i++; continue; }

    closeList();
    out.push(`<p>${inline(ln.trim())}</p>`);
    i++;
  }
  closeList();
  return out.join('\n');
}

const NAV = DOCS.map(([slug, title]) => ({ slug, title }));

function page(slug, title, body) {
  const links = NAV.map(n =>
    `<a href="${n.slug}.html"${n.slug === slug ? ' aria-current="page"' : ''}>${n.title}</a>`).join('');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Deskfit</title>
<meta name="robots" content="index, follow">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🦒</text></svg>">
<link rel="stylesheet" href="../../../upright-now/public/fonts/wanted-sans/WantedSansVariable.css">
<link rel="stylesheet" href="legal.css">
</head>
<body>
<a class="skip" href="#doc">본문으로 건너뛰기</a>

<header class="lg-head">
  <a class="brand" href="../index.html">Deskfit</a>
  <a class="back" href="../index.html">← 랜딩으로</a>
</header>

<div class="lg-wrap">
  <nav class="lg-side" aria-label="문서 목록">
    <span class="lbl">정책과 고지</span>
    ${links}
  </nav>

  <main class="lg-doc" id="doc">
    <h1>${title}</h1>
${body}
    <footer class="lg-foot">
      <p>이 문서에 대해 궁금한 점이 있으면 <a href="mailto:ikmc554@mju.ac.kr">ikmc554@mju.ac.kr</a> 로 알려 주세요.</p>
      <p class="copy">© Monkeyz. All rights reserved.</p>
    </footer>
  </main>
</div>
</body>
</html>`;
}

let n = 0;
for (const [slug, title] of DOCS) {
  const md = fs.readFileSync(path.join(DIR, slug + '.md'), 'utf8');
  const filled = md.replaceAll('{{CONTACT}}', CONTACT);
  fs.writeFileSync(path.join(DIR, slug + '.html'), page(slug, title, render(filled)), 'utf8');
  n++;
}
console.log('HTML 생성', n, '개');

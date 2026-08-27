// 캔버스에 그린 화면을 **제품 화면 한 벌**로 굳힙니다.
//
// 결과는 랜딩·온보딩과 같은 모양입니다 — 파일 하나, 빌드 없이 열림, 밖으로
// 나가는 요청 0. 서체도 그림도 파일 안에 있습니다.
import { CSS, shell } from './shell.mjs';
//
// 아트보드는 1040×760 같은 고정 판이라 그대로 두면 창 가운데 떠 있는 그림이
// 됩니다. 그래서 뿌리 상자만 화면 크기로 바꿔 답니다 — 안쪽은 이미 flex 라
// 알아서 늘어납니다.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', '..', 'design-canvas');
const canvas = JSON.parse(readFileSync(join(SRC, 'canvas.json'), 'utf8'));

// 제품 화면만. 서체 시안·공유 카드 견본·온보딩은 문서라 빼놓습니다.
const SKIP_FILE = new Set(['Card.dc.html', 'Font.dc.html']);
const SKIP_PAGE = new Set(['onboarding']);

class DCLogic {
  constructor(props) { this.props = props || {}; }
  renderVals() { return {}; }
}
const dig = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const fill = (html, scope) => html.replace(/\{\{([^}]+)\}\}/g, (m, k) => {
  const v = dig(scope, k.trim());
  return v == null ? '' : String(v);
});

function expand(root, doc, scope) {
  let guard = 0;
  while (guard++ < 20) {
    const leaf = [...root.querySelectorAll('sc-for')].filter((n) => !n.querySelector('sc-for'));
    if (!leaf.length) break;
    for (const node of leaf) {
      const list = dig(scope, node.getAttribute('list').replace(/[{}]/g, '').trim()) || [];
      const as = node.getAttribute('as');
      const tpl = node.innerHTML;
      /* 펼친 것을 감싸는 상자를 남기지 않습니다. display:contents 로 감싸도
         DOM 에는 한 겹이 남아, "칸이 열 개인 줄" 같은 것을 셀 때 하나로
         보입니다. */
      const holder = doc.createElement('div');
      holder.innerHTML = list.map((i) => fill(tpl, { ...scope, [as]: i })).join('');
      while (holder.firstChild) node.parentNode.insertBefore(holder.firstChild, node);
      node.remove();
    }
  }
}

const MIME = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const dataURI = new Map();
function inlineAsset(name) {
  if (!dataURI.has(name)) {
    const p = join(SRC, name);
    const mime = MIME[extname(name).toLowerCase()];
    dataURI.set(name, existsSync(p) && mime
      ? 'data:' + mime + ';base64,' + readFileSync(p).toString('base64') : name);
  }
  return dataURI.get(name);
}

function render(file) {
  const { document } = parseHTML(readFileSync(join(SRC, file), 'utf8'));
  const script = document.querySelector('script[data-dc-script]');
  const props = JSON.parse(script.getAttribute('data-props') || '{}');
  const defaults = {};
  for (const [k, v] of Object.entries(props)) if (v && 'default' in v) defaults[k] = v.default;
  const Component = new Function('DCLogic', script.textContent + '; return Component;')(DCLogic);
  const vals = new Component(defaults).renderVals();

  const style = document.querySelector('helmet style');
  const css = style ? style.textContent : '';
  const x = document.querySelector('x-dc');
  x.querySelectorAll('helmet').forEach((h) => h.remove());

  const holder = document.createElement('div');
  holder.innerHTML = x.innerHTML;
  expand(holder, document, vals);
  holder.innerHTML = fill(holder.innerHTML, vals);
  annotate(holder);
  let html = holder.innerHTML;

  // 인라인 폭이 스타일시트를 이기므로 상한도 여기에 적습니다.
  html = html.replace(/width:\s*\d+px;\s*height:\s*\d+px;/,
    'width: 100%; height: 100%;');
  html = html.replace(/(src=")\.\/([^"]+)(")/g, (m, a, name, b) => a + inlineAsset(name) + b);
  return { html, css };
}

/* 만질 수 있는 것에 표를 답니다.
   그림에 id 를 심으면 캔버스를 고칠 때마다 여기도 같이 고쳐야 하니,
   생김새(스위치는 알약에 손잡이가 하나, 세그먼트는 파인 판에 버튼 둘 이상)
   로 알아봅니다. */
function annotate(root) {
  // 스위치 — 알약 안에 동그란 손잡이 하나
  root.querySelectorAll('span[style*="border-radius: 99px"]').forEach((el) => {
    const st = el.getAttribute('style') || '';
    if (!/width:\s*(4[89]|5[0-4])px/.test(st) || !/height:\s*(2[6-9]|3[0-2])px/.test(st)) return;
    const knob = el.firstElementChild;
    if (!knob || !/border-radius:\s*50%/.test(knob.getAttribute('style') || '')) return;
    el.setAttribute('data-switch', /3FE0C9/.test(st) ? 'on' : 'off');
  });

  // 세그먼트 — 파인 판(#E1EBF7) 안에 고르는 버튼들
  root.querySelectorAll('[style*="#E1EBF7"]').forEach((el) => {
    const btns = [...el.children].filter((c) => c.tagName === 'BUTTON');
    if (btns.length < 2) return;
    el.setAttribute('data-seg', '');
    btns.forEach((b) => {
      const on = /box-shadow: 0 10px 18px/.test(b.getAttribute('style') || '');
      b.setAttribute('data-seg-item', on ? 'on' : 'off');
    });
  });

  // 드래그바 — 높이 14px 짜리 홈. 세션 진행바(11px)는 읽기 전용이라 뺍니다.
  root.querySelectorAll('span[style*="height: 14px"][style*="border-radius: 99px"]').forEach((el) => {
    if (!el.querySelector('span')) return;
    el.setAttribute('data-slider', '');
  });

  // 자리 수 — 열 칸짜리 줄
  root.querySelectorAll('[style*="repeat(10, 1fr)"]').forEach((el) => {
    if (el.children.length < 10) return;
    el.setAttribute('data-dots', '');
  });

  // 어디에 앉을까 — 두 판 중 하나 고르기
  const picks = [...root.querySelectorAll('button')].filter((b) => {
    const t = (b.textContent || '').trim();
    return (t === '온라인' || t === '비공개') && b.querySelector('img');
  });
  if (picks.length === 2) picks.forEach((b) => {
    const st = b.getAttribute('style') || '';
    b.setAttribute('data-pick', /outline: 4px/.test(st) ? 'on' : 'off');
    b.setAttribute('data-skin', /#1B2C3A|#2F4A5E/.test(st) ? 'night' : 'light');
  });

  // 그림을 품은 다른 판도 같은 문법으로 뜹니다
  root.querySelectorAll('div, span').forEach((el) => {
    if (el.hasAttribute('data-pick')) return;
    const st = el.getAttribute('style') || '';
    if (!/border-radius: 2[0-9]px/.test(st)) return;
    if (!/box-shadow: 0 1[0-9]px|box-shadow: 0 2[0-9]px/.test(st)) return;
    const img = el.querySelector(':scope > img, :scope > span > img');
    if (!img) return;
    el.setAttribute('data-lift', '');
  });

  // 자세 세 색 — 사람 판과 상태 칩
  root.querySelectorAll('span').forEach((el) => {
    const t = (el.textContent || '').trim();
    if (!['좋음', '주의', '무너짐'].includes(t)) return;
    if (el.children.length) return;
    el.setAttribute('data-state-chip', t);
    const tile = el.parentElement;
    if (tile && /box-shadow: inset 0 0 0 3px/.test(tile.getAttribute('style') || ''))
      tile.setAttribute('data-posture', t);
  });

  // 세션 시계와 목표
  root.querySelectorAll('b').forEach((el) => {
    const t = (el.textContent || '').trim();
    if (/^[0-9]+분 집중$/.test(t)) el.setAttribute('data-timer', '');
  });
  root.querySelectorAll('span, b').forEach((el) => {
    if (el.children.length) return;
    if (/^[0-9]+ [/] [0-9]+$/.test((el.textContent || '').trim()))
      el.setAttribute('data-seat-count', '');
  });
  root.querySelectorAll('span').forEach((el) => {
    if (el.children.length || (el.textContent || '').trim() !== '오늘 목표까지') return;
    const box = el.parentElement && el.parentElement.parentElement;
    if (!box) return;
    const out = el.parentElement.querySelector('b');
    if (out) out.setAttribute('data-remain', '');
    const bar = box.querySelector('span[style*="height: 11px"] > span');
    if (bar) bar.setAttribute('data-progress', '');
  });

  // 내 자세 판 · 회복 횟수
  root.querySelectorAll('b').forEach((el) => {
    const t = (el.textContent || '').trim();
    if (t === '자세 좋아요' && el.parentElement && el.parentElement.parentElement)
      el.parentElement.parentElement.setAttribute('data-my-posture', '');
  });
  root.querySelectorAll('span').forEach((el) => {
    if (el.children.length || (el.textContent || '').trim() !== '자세 회복') return;
    const b = el.parentElement && el.parentElement.querySelector('b');
    if (b) b.setAttribute('data-recover', '');
  });

  // 눌러서 복사되는 것
  root.querySelectorAll('button').forEach((b) => {
    const t = (b.textContent || '').trim();
    if (t === '코드 복사') b.setAttribute('data-copy', '4F2K9A');
    if (b.getAttribute('aria-label') === '초대 링크 복사') b.setAttribute('data-copy', 'deskfit.app/r/4F2K9A');
    if (t === '링크 복사') b.setAttribute('data-copy', 'deskfit.app/c/8-26');
  });
}

// ── 화면끼리 잇는 길 ─────────────────────────────────────────────
// 눌리는 글자 자체를 열쇠로 씁니다. 아트보드에 id 를 심으면 그림이 바뀔
// 때마다 같이 고쳐야 합니다.
const LINKS = {
  Main: { '세션 시작': 'Choose', 마이페이지: 'My1', 랭킹전: 'Lg1' },
  Choose: { '캠퍼스로 들어가기': 'Room', 돌아가기: 'Main' },
  Room: { '세션 시작': 'Session', 나가기: 'Main' },
  Session: { 나가기: 'Done' },
  Done: { 'AI 리포트 확인': 'My8', 재시작: 'Room', 메인으로: 'Main' },
  My1: { '자세 기준': 'My6', 'AI 회고': 'My8', '집중 세션 시작': 'Choose', 마이페이지: 'Main' },
  My2: { '자세 기준': 'My7', 'AI 회고': 'My9', '학교 인증하기': 'My3', '집중 세션 시작': 'Choose' },
  My3: { '인증 메일 받기': 'My4', 그만두기: 'My2' },
  My4: { 인증하기: 'My1', '주소 다시 입력': 'My3' },
  My5: { '공개 설정': 'My1' },
  My6: { '내 정보': 'My1', 'AI 회고': 'My8', '기준 다시 잡기': 'My7', 마이페이지: 'Main' },
  My7: { '내 정보': 'My2', 'AI 회고': 'My9', '기준 잡기': 'My6', 마이페이지: 'Main' },
  My8: { '내 정보': 'My1', '자세 기준': 'My6', '회고 만들기': 'My10', '회고 보기': 'My10', 마이페이지: 'Main' },
  My9: { '내 정보': 'My2', '자세 기준': 'My7', '집중 세션 시작': 'Choose' },
  My10: { '이미지로 저장': 'My8', '링크 복사': 'My8' },
  Lg1: { 누적: 'Lg2', '집중해서 순위 올리기': 'Choose', '학교 랭킹전': 'Main' },
  Lg2: { 주간: 'Lg1', '집중해서 순위 올리기': 'Choose', '학교 랭킹전': 'Main' },
  Lg3: { 누적: 'Lg2', '집중해서 순위 올리기': 'Choose', '학교 랭킹전': 'Main' },
  Lg5: { '첫 줄에 이름 올리기': 'Choose', '학교 랭킹전': 'Main' },
  Lg6: { '다시 불러오기': 'Lg1', '학교 랭킹전': 'Main' },
  Lg7: { '겨울 시즌 미리 보기': 'Lg5' }
};

// 흐름으로는 못 닿지만 실제로 있는 상태들. 오른쪽 아래 작은 단추로 엽니다.
const STATES = [
  { g: '메인 계열', items: [['Main', '메인'], ['Choose', '어디에 앉을까'], ['Room', '대기실'],
    ['Session', '집중 중'], ['Done', '세션 끝']] },
  { g: '마이페이지', items: [['My1', '내 정보 · 인증 완료'], ['My2', '내 정보 · 미인증'],
    ['My3', '학교 인증 · 메일'], ['My4', '학교 인증 · 번호'], ['My5', '공개 설정'],
    ['My6', '자세 기준 · 잡음'], ['My7', '자세 기준 · 없음'], ['My8', 'AI 회고 · 기록 있음'],
    ['My9', 'AI 회고 · 없음'], ['My10', '공유 카드']] },
  { g: '랭킹전', items: [['Lg1', '주간'], ['Lg2', '누적'], ['Lg3', '순위 밖'], ['Lg4', '불러오는 중'],
    ['Lg5', '시즌 시작'], ['Lg6', '불러오지 못함'], ['Lg7', '시즌 종료']] }
];

const boards = canvas.artboards
  .filter((a) => !SKIP_FILE.has(a.file) && !SKIP_PAGE.has(a.page || ''))
  .map((a) => ({ id: a.file.replace('.dc.html', ''), file: a.file }));

let faces = '';
const screens = boards.map((b) => {
  const { html, css } = render(b.file);
  if (!faces) {
    faces = (css.match(/@font-face\{[^}]*\}/g) || []).join('\n') + '\n'
      + (css.match(/\[style\*="font-weight: 820"\]\{[^}]*\}/) || [''])[0];
  }
  return { ...b, html };
});

const jua = '';   // Jua 는 안 씁니다 — 전면 Pretendard

const sections = screens.map((s) => `
<section class="scr" id="s-${s.id}" data-links='${JSON.stringify(LINKS[s.id] || {}).replace(/'/g, '&#39;')}' hidden>${s.html}</section>`).join('');

const stateMenu = STATES.map((g) => `
    <div class="sg"><span>${g.g}</span>
      ${g.items.map(([id, t]) => `<button type="button" data-go="${id}">${t}</button>`).join('')}
    </div>`).join('');

const out = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Deskfit</title>
<meta name="description" content="자세교정과 공부를 한 번에">
<style>
${jua}
${faces}
${CSS}
</style>
</head>
<body>
${shell({ sections, stateMenu })}

<script>
const first = ${JSON.stringify(screens[0]?.id || 'Main')};
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── 대답 ────────────────────────────────────────────────────────
   누른 것이 먹혔는지 알려 주는 통로 하나. 색으로만 말하면 색을 못 보는
   사람에게는 아무 일도 안 일어난 것과 같습니다. */
let toastT = 0;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), 2000);
}

const TEAL = 'linear-gradient(180deg, #3FE0C9, #21C4AE)';
const TEAL_IN = 'inset 0 4px 8px rgba(6,84,74,.24), inset 0 -1px 0 rgba(255,255,255,.4)';
const OFF_BG = '#E4EDF7';
const OFF_IN = 'inset 0 4px 9px rgba(62,84,118,.24), inset 0 -1px 0 rgba(255,255,255,.9)';
const PICKED = '0 10px 18px -10px rgba(25,31,40,.45), inset 0 5px 10px rgba(255,255,255,.95),'
             + ' inset 0 -6px 11px rgba(86,110,146,.18)';

/* ── 스위치 ── */
function setSwitch(el, on) {
  el.dataset.switch = on ? 'on' : 'off';
  el.style.background = on ? TEAL : OFF_BG;
  el.style.boxShadow = on ? TEAL_IN : OFF_IN;
  const knob = el.firstElementChild;
  if (knob) knob.style.left = on ? (el.offsetWidth - knob.offsetWidth - 3) + 'px' : '3px';
  el.setAttribute('role', 'switch');
  el.setAttribute('aria-checked', String(on));
  el.setAttribute('tabindex', '0');
}
document.querySelectorAll('[data-switch]').forEach((el) => setSwitch(el, el.dataset.switch === 'on'));

/* ── 세그먼트 ── */
function pickSeg(box, btn) {
  [...box.children].forEach((b) => {
    if (b.tagName !== 'BUTTON') return;
    const on = b === btn;
    b.dataset.segItem = on ? 'on' : 'off';
    b.style.background = on ? '#F6FAFE' : 'transparent';
    b.style.color = on ? '#191F28' : '#4E5968';
    b.style.boxShadow = on ? PICKED : 'none';
    b.setAttribute('aria-pressed', String(on));
  });
}

/* ── 드래그바 ── */
function sliderParts(bar) {
  const fill = bar.children[0], knob = bar.children[1];
  const wrap = bar.parentElement;
  const out = wrap ? wrap.querySelector('b') : null;
  const ends = wrap ? [...wrap.children].find((c) => c !== bar && /\\d/.test(c.textContent) && c !== out?.parentElement) : null;
  let min = 10, max = 120, unit = '분';
  if (ends) {
    const nums = (ends.textContent.match(/\\d+/g) || []).map(Number);
    if (nums.length >= 2) { min = nums[0]; max = nums[1]; }
    unit = (ends.textContent.match(/[가-힣]+/) || ['분'])[0];
  }
  return { fill, knob, out, min, max, unit };
}
function setSlider(bar, ratio) {
  const { fill, knob, out, min, max, unit } = sliderParts(bar);
  const r = Math.max(0, Math.min(1, ratio));
  const step = unit === '분' ? 5 : 1;
  const value = Math.round((min + (max - min) * r) / step) * step;
  const at = (value - min) / (max - min);
  if (fill) fill.style.width = (at * 100) + '%';
  if (knob) knob.style.left = (at * 100) + '%';
  if (out) out.textContent = value + unit;
  bar.setAttribute('role', 'slider');
  bar.setAttribute('aria-valuemin', min); bar.setAttribute('aria-valuemax', max);
  bar.setAttribute('aria-valuenow', value);
  bar.setAttribute('tabindex', '0');
  return value;
}
document.querySelectorAll('[data-slider]').forEach((bar) => {
  const drag = (e) => {
    const r = bar.getBoundingClientRect();
    setSlider(bar, (e.clientX - r.left) / r.width);
  };
  bar.addEventListener('pointerdown', (e) => {
    bar.setPointerCapture(e.pointerId); drag(e);
    const move = (ev) => drag(ev);
    const up = () => { bar.removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    bar.addEventListener('pointermove', move); addEventListener('pointerup', up);
  });
  bar.addEventListener('keydown', (e) => {
    const now = +bar.getAttribute('aria-valuenow');
    const { min, max } = sliderParts(bar);
    if (e.key === 'ArrowRight') setSlider(bar, (now + 5 - min) / (max - min));
    else if (e.key === 'ArrowLeft') setSlider(bar, (now - 5 - min) / (max - min));
    else return;
    e.preventDefault();
  });
  const { fill } = sliderParts(bar);
  setSlider(bar, parseFloat(fill && fill.style.width) / 100 || .58);
});

/* ── 자리 수 ── */
document.querySelectorAll('[data-dots]').forEach((row) => {
  const cells = [...row.children];
  const out = row.parentElement ? row.parentElement.querySelector('b') : null;
  const paint = (n) => {
    cells.forEach((c, i) => {
      const on = i < n;
      c.style.background = on ? TEAL : OFF_BG;
      c.style.boxShadow = on
        ? 'inset 0 3px 6px rgba(255,255,255,.5), inset 0 -4px 8px rgba(6,84,74,.26)'
        : 'inset 0 4px 8px rgba(62,84,118,.2)';
    });
    if (out) out.textContent = n + '명';
  };
  cells.forEach((c, i) => {
    c.style.cursor = 'pointer';
    c.addEventListener('click', () => paint(i + 1));
  });
});

/* ── 어디에 앉을까: 두 판 중 하나 ── */
document.querySelectorAll('.scr').forEach((sec) => {
  const picks = [...sec.querySelectorAll('[data-pick]')];
  if (picks.length !== 2) return;
  const paint = (chosen) => picks.forEach((p) => {
    const on = p === chosen;
    p.dataset.pick = on ? 'on' : 'off';
    p.setAttribute('aria-pressed', String(on));
    p.style.outline = on ? '5px solid #21C4AE' : 'none';
  });
  paint(picks.find((p) => p.dataset.pick === 'on') || picks[0]);
  picks.forEach((p) => p.addEventListener('click', () => paint(p), true));
});
/* ── 화면 바꾸기 ────────────────────────────────────────────────
   앞으로 갈 때와 되돌아올 때가 같은 방향으로 들어오면, 사용자는 자기가
   어디로 움직였는지 모릅니다. 되돌아오는 길은 왼쪽에서 들어옵니다. */
const BACK = new Set(['돌아가기', '나가기', '메인으로', '그만두기', '주소 다시 입력']);
let current = null;

function show(id, dir) {
  const el = document.getElementById('s-' + id);
  if (!el || id === current) return;
  stopLive();
  document.querySelectorAll('.scr').forEach((s) => { s.hidden = s !== el; });
  document.querySelectorAll('.dev-menu button').forEach((b) =>
    b.setAttribute('aria-current', String(b.dataset.go === id)));
  el.dataset.dir = dir === 'back' ? 'back' : 'fwd';
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  current = id;
  if (location.hash.slice(1) !== id) history.pushState({ id: id }, '', '#' + id);
  startLive(id, el);
}

/* ── 살아 있는 것 ──────────────────────────────────────────────
   화면을 떠나면 전부 멈춥니다. 안 멈추면 마이페이지를 보는 중에 세션이
   혼자 끝나 있습니다. */
let live = [];
function stopLive() {
  live.forEach((t) => { clearInterval(t); clearTimeout(t); });
  live = [];
}
function every(ms, fn) { if (!REDUCED) live.push(setInterval(fn, ms)); }
function after(ms, fn) { if (!REDUCED) live.push(setTimeout(fn, ms)); }

function bump(el) {
  if (!el || REDUCED) return;
  el.style.transition = 'none';
  el.style.transform = 'scale(1.08)';
  requestAnimationFrame(() => {
    el.style.transition = 'transform 260ms cubic-bezier(.34,1.56,.64,1)';
    el.style.transform = '';
  });
}

const HUE = { '좋음': '#74E294', '주의': '#F5C451', '무너짐': '#FF7E6E' };
const HUE_INK = { '좋음': '#0C4F2E', '주의': '#5A3F06', '무너짐': '#5E1608' };

function setPosture(tile, state) {
  tile.dataset.posture = state;
  const hue = HUE[state];
  tile.style.transition = 'box-shadow 320ms cubic-bezier(.16,1,.3,1)';
  const cur = getComputedStyle(tile).boxShadow;
  tile.style.boxShadow = cur.replace(/rgb\([^)]*\) 0px 0px 0px 3px inset/, hue + ' 0px 0px 0px 3px inset');
  const chip = tile.querySelector('[data-state-chip]');
  if (chip) {
    chip.textContent = state;
    chip.dataset.stateChip = state;
    chip.style.background = hue;
    chip.style.color = HUE_INK[state];
    bump(chip);
  }
}

const MINE_SKIN = {
  '좋음': { bg: '#E7F8ED', dot: '#74E294', ink: '#14603C', title: '자세 좋아요' },
  '주의': { bg: '#FCF3DE', dot: '#F5C451', ink: '#6B5316', title: '조금 무너졌어요' }
};
function setMine(card, state) {
  card.dataset.state = state;
  const skin = MINE_SKIN[state];
  const dot = card.firstElementChild;
  const title = card.querySelector('b');
  card.style.transition = 'background 320ms ease-out';
  card.style.background = skin.bg;
  if (dot) { dot.style.transition = 'background 320ms ease-out'; dot.style.background = skin.dot; }
  if (title) { title.textContent = skin.title; title.style.color = skin.ink; bump(title); }
}

function startLive(id, root) {
  if (id === 'Lg4') {                       // 불러오는 중은 스스로 끝납니다
    after(1400, () => show('Lg1'));
    return;
  }

  if (id === 'Session') {
    const timer = root.querySelector('[data-timer]');
    const remain = root.querySelector('[data-remain]');
    const bar = root.querySelector('[data-progress]');
    const recover = root.querySelector('[data-recover]');
    let min = 23, left = 27, hits = 3;

    every(2200, () => {                     // 시계
      if (left <= 0) return;
      min += 1; left -= 1;
      if (timer) { timer.textContent = min + '분 집중'; bump(timer); }
      if (remain) remain.textContent = left + '분';
      if (bar) bar.style.width = Math.round(min / (min + left) * 100) + '%';
    });

    const tiles = [...root.querySelectorAll('[data-posture]')];
    const mine = root.querySelector('[data-my-posture]');
    every(2600, () => {                     // 자세는 계속 흔들립니다
      const tile = tiles[Math.floor(Math.random() * tiles.length)];
      if (!tile) return;
      const was = tile.dataset.posture;
      const next = was === '좋음'
        ? (Math.random() < 0.5 ? '주의' : '무너짐')
        : (Math.random() < 0.7 ? '좋음' : was);
      if (next === was) return;
      setPosture(tile, next);
      if (next === '좋음' && recover) {      // 돌아오면 회복 한 번
        hits += 1; recover.textContent = hits + '회'; bump(recover);
      }
    });

    if (mine) every(7000, () => {
      setMine(mine, (mine.dataset.state || '좋음') === '좋음' ? '주의' : '좋음');
    });
  }

  if (id === 'Room') {                      // 사람이 들어옵니다
    const empties = [...root.querySelectorAll('[aria-label]')]
      .filter((e) => e.getAttribute('aria-label') === '아직 안 온 자리');
    const count = root.querySelector('[data-seat-count]');
    let i = 0;
    const join = () => {
      if (i >= empties.length) return;
      const cell = empties[i];
      const who = ['개구리', '해울', '노을'][i] || '새 사람';
      i += 1;
      cell.style.transition = 'background 260ms ease-out, box-shadow 260ms ease-out';
      cell.style.background = 'linear-gradient(165deg, #F1EAF9, #E2E6F7)';
      cell.style.boxShadow = '0 16px 30px -16px rgba(25,31,40,.45),'
        + ' inset 0 6px 12px rgba(255,255,255,.9), inset 0 -7px 13px rgba(86,110,146,.2)';
      cell.innerHTML = '';
      const tag = document.createElement('span');
      tag.style.cssText = 'padding:5px 10px;border-radius:99px;background:rgba(25,31,40,.68);'
        + 'color:#FBFDFF;font-weight:750;font-size:10.5px;white-space:nowrap';
      tag.textContent = who;
      cell.appendChild(tag);
      if (count) {
        const nums = count.textContent.split('/').map((n) => parseInt(n, 10));
        count.textContent = (nums[0] + 1) + ' / ' + nums[1];
        bump(count);
      }
      toast(who + ' 님이 들어왔어요');
      after(4200, join);
    };
    after(2600, join);
  }
}

/* 화면 안의 길: 버튼 글자가 링크표에 있으면 그리로 갑니다. 같은 글자를 가진
   것 중 가장 안쪽 하나에만 답니다 — 조상까지 달면 한 번 눌러도 두 번 갑니다. */
document.querySelectorAll('.scr').forEach((sec) => {
  const map = JSON.parse(sec.dataset.links || '{}');
  const linked = new Set();
  for (const [label, dest] of Object.entries(map)) {
    const hit = [...sec.querySelectorAll('button, a, span, b, div')]
      .filter((el) => (el.textContent || '').trim() === label)
      .sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0];
    if (!hit) continue;
    linked.add(hit);
    hit.dataset.hot = '1';
    hit.addEventListener('click', (e) => {
      e.stopPropagation();
      show(dest, BACK.has(label) ? 'back' : 'fwd');
    });
  }

  /* 세그먼트는 화면을 옮기는 것과 그 자리에서 고르는 것 둘 다입니다.
     옮기는 쪽이 이미 붙어 있으면 여기서는 손대지 않습니다. */
  sec.querySelectorAll('[data-seg]').forEach((box) => {
    const btns = [...box.children].filter((b) => b.tagName === 'BUTTON');
    if (btns.some((b) => linked.has(b))) return;
    btns.forEach((b) => b.addEventListener('click', () => pickSeg(box, b)));
  });
});

/* ── 켜고 끄기 · 복사 ── */
document.addEventListener('click', (e) => {
  const sw = e.target.closest('[data-switch]');
  if (sw) {
    const on = sw.dataset.switch !== 'on';
    setSwitch(sw, on);
    return;
  }
  const copy = e.target.closest('[data-copy]');
  if (copy) {
    const v = copy.dataset.copy;
    if (navigator.clipboard) navigator.clipboard.writeText(v).catch(() => {});
    toast('복사했어요 · ' + v);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== ' ' && e.key !== 'Enter') return;
  const sw = e.target.closest && e.target.closest('[data-switch]');
  if (!sw) return;
  e.preventDefault();
  setSwitch(sw, sw.dataset.switch !== 'on');
});

const btn = document.getElementById('devBtn'), menu = document.getElementById('devMenu');
btn.addEventListener('click', () => {
  menu.hidden = !menu.hidden;
  btn.setAttribute('aria-expanded', String(!menu.hidden));
});
menu.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-go]');
  if (!b) return;
  show(b.dataset.go); menu.hidden = true; btn.setAttribute('aria-expanded', 'false');
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.hidden = true; });
addEventListener('popstate', () => show(location.hash.slice(1) || first, 'back'));

show(location.hash.slice(1) || first);
</script>
</body>
</html>
`;

writeFileSync(join(HERE, 'index.html'), out, 'utf8');
console.log('화면 ' + screens.length + '장 · ' + Math.round(out.length / 1024) + ' KB · 그림 '
  + dataURI.size + '장 내장 · 외부 요청 0');

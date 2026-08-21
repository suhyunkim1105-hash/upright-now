/* ══════════════════════════════════════════════════════════
   미니게임 넷 — **직접 그리지 않습니다.**

   전 판은 목 펴기와 달리기를 캔버스에 손으로 그렸습니다. 막대 하나에
   네모 몇 개라 게임이라기보다 시연이었습니다. 그래서 넷 다
   **이미 만들어져 돌아가는 것** 으로 바꿨습니다.

     ① 동물 짝 맞추기 · ② 동물 셋 지우기
        2D 월드가 쓰던 순수 엔진 모듈 그대로(../openworld/*.mjs).
        규칙을 두 벌 쓰면 반드시 어긋납니다.
     ③ 동물 러너
        같은 레포의 Phaser 게임(animal-runner-game.mjs)을 그대로 띄웁니다.
        Phaser 는 MIT 이고 vendor/ 에 이미 들어와 있습니다.
     ④ 2048
        규칙을 vendor/2048-logic.js 로 가져왔습니다 — winsonwq/2048term,
        MIT. 원본에 mocha 시험이 붙어 있는 검증된 구현입니다.
        여기서는 그리기만 합니다.
   ══════════════════════════════════════════════════════════ */
import * as MEM from '../openworld/animal-find-engine.mjs';
import * as M3 from '../openworld/animal-match3-engine.mjs';
import { TableCalc } from './vendor/2048-logic.js';

export const GAMES = {
  memory: { title: '동물 짝 맞추기', how: '같은 동물 카드 짝을 맞춥니다' },
  match3: { title: '동물 셋 지우기', how: '옆 칸과 바꿔 같은 동물 셋을 만듭니다' },
  run:    { title: '동물 러너', how: '↑ 로 뛰어서 장애물을 넘고 동전을 모읍니다' },
  n2048:  { title: '2048', how: '방향키로 같은 수를 붙여 2048 을 만듭니다' },
};

let host = null, raf = 0, keyH = null, done = null, closing = false, teardown = null;

function shell(key) {
  const G = GAMES[key];
  host = document.createElement('div');
  host.id = 'game';
  host.innerHTML = `
    <div class="gbox">
      <div class="ghead">
        <div><b>${G.title}</b><span>${G.how}</span></div>
        <div class="gstat"><em class="score">0</em><i class="tm"></i></div>
        <button class="gx">그만두기 (Esc)</button>
      </div>
      <div class="gbody"></div>
      <div class="gover"><b></b><span></span><button class="again">한 번 더</button>
        <button class="out">나가기</button></div>
    </div>`;
  document.body.appendChild(host);
  host.querySelector('.gx').addEventListener('click', () => close(0));
  host.querySelector('.out').addEventListener('click', () => close(lastScore));
  return host.querySelector('.gbody');
}
let lastScore = 0;
function over(title, sub, again) {
  const o = host.querySelector('.gover');
  o.querySelector('b').textContent = title;
  o.querySelector('span').textContent = sub;
  o.classList.add('on');
  o.querySelector('.again').onclick = () => { o.classList.remove('on'); again(); };
}
function setScore(v) { lastScore = v; host.querySelector('.score').textContent = v; }
function setTime(v) { host.querySelector('.tm').textContent = v; }
function close(score) {
  if (closing) return; closing = true;
  cancelAnimationFrame(raf);
  try { teardown?.(); } catch {} teardown = null;
  if (keyH) { removeEventListener('keydown', keyH); removeEventListener('keyup', keyH); keyH = null; }
  host?.remove(); host = null;
  const d = done; done = null;
  d?.(score || 0);
}

/** 미니게임 하나를 엽니다. 끝나면 onDone(점수) 를 부릅니다. */
export function openGame(key, onDone) {
  closing = false; lastScore = 0; done = onDone; teardown = null;
  const body = shell(key);
  ({ memory, match3, run, n2048 })[key](body);
  const esc = (e) => { if (e.code === 'Escape') { e.preventDefault(); close(lastScore); } };
  addEventListener('keydown', esc);
  const old = done;
  done = (s) => { removeEventListener('keydown', esc); old?.(s); };
}
export const gameOpen = () => !!host;

/* ---------- ① 짝 맞추기 ---------- */
function memory(body) {
  const st = MEM.createGame();
  body.className = 'gbody grid8';
  const start = () => {
    MEM.startGame(st, performance.now());
    setScore(0); draw();
  };
  const draw = () => {
    body.innerHTML = st.cards.map((c, i) => {
      const A = MEM.ANIMAL_MEMORY_TYPES.find((a) => a.id === c.animalId);
      const show = c.isFlipped || c.isMatched;
      return `<button class="mc${show ? ' up' : ''}${c.isMatched ? ' ok' : ''}" data-i="${i}"
        style="${show ? `background:${A.color}` : ''}">${show ? A.emoji : '?'}</button>`;
    }).join('');
  };
  body.onclick = (e) => {
    const b = e.target.closest('button.mc'); if (!b) return;
    const r = MEM.selectCard(st, +b.dataset.i);
    if (!r.accepted) return;
    draw();
    if (r.checking) setTimeout(() => {
      const res = MEM.resolvePendingPair(st);
      setScore(st.score); draw();
      if (res.complete) over('다 맞췄어요', `${st.moves}번 만에 · 최고 연속 ${st.maxCombo}`, start);
    }, MEM.ANIMAL_MEMORY_CONFIG.mismatchDelayMs);
  };
  const loop = () => {
    MEM.tickGame(st, performance.now());
    const left = Math.max(0, st.previewEndsAt - performance.now());
    setTime(st.status === 'PREVIEW' ? `외우세요 ${(left / 1000).toFixed(1)}초` : `${st.moves}수`);
    if (st.status === 'PLAYING' && !body.querySelector('.mc.up:not(.ok)')) draw();
    raf = requestAnimationFrame(loop);
  };
  start(); loop();
}

/* ---------- ② 셋 지우기 ---------- */
function match3(body) {
  body.className = 'gbody grid7';
  let board = M3.createBoard();
  let score = 0, sel = -1, t0 = performance.now(), LIMIT = 90;
  const specials = new Map();
  const draw = () => {
    body.innerHTML = board.map((t, i) => {
      const A = M3.ACTIVE_TYPES[t] || M3.ACTIVE_TYPES[0];
      return `<button class="mc${sel === i ? ' sel' : ''}" data-i="${i}"
        style="background:${A.color}">${A.emoji}</button>`;
    }).join('');
  };
  body.onclick = (e) => {
    const b = e.target.closest('button.mc'); if (!b) return;
    const i = +b.dataset.i;
    if (sel < 0) { sel = i; draw(); return; }
    if (sel === i) { sel = -1; draw(); return; }
    if (M3.isAdjacent(sel, i)) {
      const r = M3.swapIfMatches(board, sel, i, Math.random, specials);
      if (r && r.cleared) score += M3.scoreForMatch(r.cleared, r.chains || 1);
      setScore(score);
    }
    sel = -1; draw();
  };
  const loop = () => {
    const left = LIMIT - (performance.now() - t0) / 1000;
    setTime(`${Math.max(0, left).toFixed(0)}초`);
    if (left <= 0) { over('시간 끝', `${score}점`, () => { board = M3.createBoard(); score = 0; t0 = performance.now(); setScore(0); draw(); }); return; }
    raf = requestAnimationFrame(loop);
  };
  setScore(0); draw(); loop();
}

/* ---------- ③ 동물 러너 — 같은 레포의 Phaser 게임 ---------- */
/* 손으로 그린 「달리기 100m」(막대 하나 + 네모 주자)를 버리고,
   연우가 만들어 둔 Phaser 러너를 그대로 띄웁니다. 물리·난이도·동전·
   무적시간까지 animal-runner-engine.mjs 가 이미 다 들고 있습니다. */
function run(body) {
  body.className = 'gbody';
  const box = document.createElement('div');
  box.style.cssText = 'width:100%;max-width:390px;height:min(64vh,560px);border-radius:14px;'
    + 'overflow:hidden;background:#DFF2F0';
  body.appendChild(box);
  const wait = document.createElement('div');
  wait.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;'
    + 'font:700 13px inherit;color:#5C6672';
  wait.textContent = '러너를 불러오는 중…';
  box.style.position = 'relative'; box.appendChild(wait);
  setScore(0); setTime('');
  let live = true, handle = null;
  teardown = () => { live = false; try { handle?.destroy(); } catch {} };
  /* Phaser 는 1.2MB 라 **필요할 때만** 받아옵니다 — 월드 첫 화면을 늦추지 않습니다 */
  import('../openworld/animal-runner-game.mjs').then((mod) => {
    if (!live) return;
    wait.remove();
    handle = mod.mountAnimalRunner({
      container: box,
      character: { id: 'turtle', name: '거북이' },
      onGameComplete: (r) => {
        const sc = Math.max(0, Math.round(r?.score ?? 0));
        setScore(sc);
        over('완주', `${sc}점 · 동전 ${r?.coins ?? 0}개`, () => handle?.restart());
      },
    });
  }).catch(() => {
    if (!live) return;
    wait.textContent = '러너를 불러오지 못했습니다. Esc 로 닫아 주세요.';
  });
}

/* ---------- ④ 2048 — 규칙은 vendor/2048-logic.js(MIT) ---------- */
const T2 = { 2:['#F0E6D8','#5C5348'], 4:['#EEDFC4','#5C5348'], 8:['#F2B279','#FFF8EE'],
  16:['#F09B63','#FFF8EE'], 32:['#F07E5F','#FFF8EE'], 64:['#EC5F3D','#FFF8EE'],
  128:['#EDCF72','#FFF8EE'], 256:['#EDCC61','#FFF8EE'], 512:['#EDC850','#FFF8EE'],
  1024:['#EDC53F','#FFF8EE'], 2048:['#35E0C6','#08251F'] };
function n2048(body) {
  body.className = 'gbody';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:9px;padding:9px;'
    + 'background:rgba(34,42,51,.10);border-radius:16px;width:min(360px,74vw)';
  const hint = document.createElement('div');
  hint.style.cssText = 'margin-top:11px;font:600 11.5px inherit;color:#5C6672;text-align:center';
  hint.innerHTML = '방향키 · WASD · 화면을 밀어도 됩니다';
  body.appendChild(wrap); body.appendChild(hint);

  let tb, score, best = +(localStorage.getItem('girin3d.2048') || 0), overed;
  const empty = () => { const r = []; for (let y = 0; y < 4; y++) r.push([0, 0, 0, 0]); return r; };
  const spawn = () => {
    const free = [];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (!tb[y][x]) free.push([y, x]);
    if (!free.length) return false;
    const [y, x] = free[Math.floor(Math.random() * free.length)];
    tb[y][x] = Math.random() < .9 ? 2 : 4; return true;
  };
  const draw = () => {
    wrap.innerHTML = '';
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const v = tb[y][x], d = document.createElement('div');
      const [bg, fg] = T2[v] || ['#35E0C6', '#08251F'];
      d.style.cssText = 'aspect-ratio:1;border-radius:11px;display:grid;place-items:center;'
        + `font:800 ${v > 999 ? 20 : v > 99 ? 24 : 27}px inherit;`
        + (v ? `background:${bg};color:${fg};box-shadow:0 2px 0 rgba(34,42,51,.10)`
             : 'background:rgba(34,42,51,.06)');
      d.textContent = v || '';
      wrap.appendChild(d);
    }
  };
  /* 원본 규칙의 방향 이름 — ltr 은 오른쪽으로 밉니다 */
  const DIR = { ArrowLeft: 'rtl', KeyA: 'rtl', ArrowRight: 'ltr', KeyD: 'ltr',
                ArrowUp: 'btt', KeyW: 'btt', ArrowDown: 'ttb', KeyS: 'ttb' };
  const move = (mode) => {
    if (overed) return;
    const r = TableCalc.merge(tb.map((row) => row.slice()), mode);
    if (TableCalc.isSame(tb, r.result)) return;                 // 안 움직이면 한 수가 아닙니다
    tb = r.result;
    r.mergedNums.forEach((line) => line.forEach((n) => { score += n; }));
    spawn(); setScore(score); draw();
    if (best < score) { best = score; try { localStorage.setItem('girin3d.2048', best); } catch {} }
    setTime(`최고 ${best}`);
    if (tb.some((row) => row.some((v) => v >= 2048)))
      { overed = true; over('2048!', `${score}점`, start); return; }
    if (!Object.values(DIR).some((m) => !TableCalc.isSame(tb, TableCalc.merge(tb.map((q) => q.slice()), m).result)))
      { overed = true; over('더 못 움직여요', `${score}점 · 최고 ${best}`, start); }
  };
  keyH = (e) => {
    if (e.type !== 'keydown') return;
    const m = DIR[e.code]; if (!m) return;
    e.preventDefault(); move(m);
  };
  addEventListener('keydown', keyH);
  /* 손가락으로 밀기 */
  let t0 = null;
  wrap.addEventListener('pointerdown', (e) => { t0 = [e.clientX, e.clientY]; });
  wrap.addEventListener('pointerup', (e) => {
    if (!t0) return;
    const dx = e.clientX - t0[0], dy = e.clientY - t0[1]; t0 = null;
    if (Math.hypot(dx, dy) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'ltr' : 'rtl') : (dy > 0 ? 'ttb' : 'btt'));
  });
  function start() {
    tb = empty(); score = 0; overed = false;
    spawn(); spawn(); setScore(0); setTime(`최고 ${best}`); draw();
  }
  start();
}

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
  suika:  { title: '동물 합치기', how: '같은 동물을 붙이면 더 큰 동물이 됩니다 — 수박게임 방식' },
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
  ({ memory, match3, run, n2048, suika })[key](body);
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


/* ---------- ⑤ 동물 합치기 — 수박게임 방식 ----------
   물리는 **matter-js**(MIT, npm `matter-js@0.20.0` 그대로 vendor/에)가
   다 합니다. 우리는 과일 대신 우리 동물 여덟을 얹었을 뿐입니다. */
const SUI = [
  ['🐸', 16, '#C8EBB4'], ['🐹', 21, '#F2D8B0'], ['🦔', 27, '#E0C4A0'],
  ['🐧', 34, '#C7D9EF'], ['🦢', 43, '#EFF3F8'], ['🐢', 53, '#BCE3C6'],
  ['🦙', 64, '#F2E8D8'], ['🦒', 78, '#F6E2AC'],
];
const showOver = (t, s2, a) => over(t, s2, a);
let matterP = null;
function loadMatter() {
  if (window.Matter) return Promise.resolve(window.Matter);
  if (matterP) return matterP;
  matterP = new Promise((res, rej) => {
    const t = document.createElement('script');
    t.src = './vendor/matter.min.js';
    t.onload = () => (window.Matter ? res(window.Matter) : rej(new Error('matter?')));
    t.onerror = () => rej(new Error('matter 로드 실패'));
    document.head.append(t);
  });
  return matterP;
}
function suika(body) {
  body.className = 'gbody';
  const W = 380, H = 500, LINE = 84;
  const cv = document.createElement('canvas');
  cv.width = W * 2; cv.height = H * 2;
  cv.style.cssText = `width:${W}px;height:${H}px;border-radius:14px;background:#FFF9EC;touch-action:none`;
  body.appendChild(cv);
  const c = cv.getContext('2d'); c.scale(2, 2);
  const hint = document.createElement('div');
  hint.style.cssText = 'margin-top:10px;font:600 11.5px inherit;color:#5C6672;text-align:center';
  hint.textContent = '누르거나 ← → 로 자리 잡고, 떼면(스페이스) 떨어집니다';
  body.appendChild(hint);
  setScore(0); setTime('');
  let live = true, engine = null, runner = 0;
  teardown = () => { live = false; cancelAnimationFrame(runner); };
  loadMatter().then((Matter) => {
    if (!live) return;
    const { Engine, Bodies, Composite, Events, Body } = Matter;
    engine = Engine.create({ gravity: { x: 0, y: 1.1 } });
    const walls = [
      Bodies.rectangle(W / 2, H + 30, W + 120, 60, { isStatic: true }),
      Bodies.rectangle(-30, H / 2, 60, H * 2, { isStatic: true }),
      Bodies.rectangle(W + 30, H / 2, 60, H * 2, { isStatic: true }),
    ];
    Composite.add(engine.world, walls);
    let score = 0, over = false, dropX = W / 2, next = Math.floor(Math.random() * 3), canDrop = true;
    const balls = new Set();
    const spawn = (x, y, tier, vy) => {
      const [, r] = SUI[tier];
      const b = Bodies.circle(x, y, r, { restitution: .12, friction: .35, density: .0016 });
      b.tier = tier; b.bornAt = performance.now();
      if (vy) Body.setVelocity(b, { x: 0, y: vy });
      Composite.add(engine.world, b); balls.add(b);
      return b;
    };
    Events.on(engine, 'collisionStart', (ev) => {
      for (const pr of ev.pairs) {
        const a = pr.bodyA, b = pr.bodyB;
        if (a.tier === undefined || b.tier === undefined) continue;
        if (a.tier !== b.tier || a.merged || b.merged) continue;
        if (a.tier >= SUI.length - 1) continue;                      // 기린은 끝판
        a.merged = b.merged = true;
        const nx = (a.position.x + b.position.x) / 2, ny = (a.position.y + b.position.y) / 2;
        Composite.remove(engine.world, a); Composite.remove(engine.world, b);
        balls.delete(a); balls.delete(b);
        spawn(nx, ny, a.tier + 1);
        score += (a.tier + 1) * 10; setScore(score);
      }
    });
    const moveTo = (x) => { dropX = Math.max(30, Math.min(W - 30, x)); };
    cv.addEventListener('pointermove', (e) => {
      const rc = cv.getBoundingClientRect(); moveTo((e.clientX - rc.left));
    });
    cv.addEventListener('pointerup', (e) => {
      const rc = cv.getBoundingClientRect(); moveTo(e.clientX - rc.left); drop();
    });
    keyH = (e) => {
      if (e.type !== 'keydown') return;
      if (e.code === 'ArrowLeft') { e.preventDefault(); moveTo(dropX - 16); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); moveTo(dropX + 16); }
      else if (e.code === 'Space' || e.code === 'ArrowDown') { e.preventDefault(); drop(); }
    };
    addEventListener('keydown', keyH);
    function drop() {
      if (!canDrop || over) return;
      canDrop = false;
      spawn(dropX, LINE - SUI[next][1] - 4, next, 1.5);
      next = Math.floor(Math.random() * 3);
      setTimeout(() => { canDrop = true; }, 480);
    }
    const loop = () => {
      if (!live) return;
      Engine.update(engine, 1000 / 60);
      /* 넘침 판정 — 자리 잡은 지 1초가 지난 것이 선 위에 있으면 끝 */
      const now = performance.now();
      for (const b of balls)
        if (now - b.bornAt > 1700 && b.position.y - SUI[b.tier][1] < LINE - 6
            && Math.abs(b.velocity.y) < .35) { over = true; break; }
      /* 그리기 */
      c.clearRect(0, 0, W, H);
      c.fillStyle = '#FFF9EC'; c.fillRect(0, 0, W, H);
      c.strokeStyle = '#E8A0A0'; c.setLineDash([7, 7]); c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, LINE); c.lineTo(W, LINE); c.stroke(); c.setLineDash([]);
      for (const b of balls) {
        const [e2, r, col] = SUI[b.tier];
        c.fillStyle = col;
        c.beginPath(); c.arc(b.position.x, b.position.y, r, 0, Math.PI * 2); c.fill();
        c.save();
        c.translate(b.position.x, b.position.y); c.rotate(b.angle * .3);
        c.font = `${Math.round(r * 1.15)}px sans-serif`;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(e2, 0, 2);
        c.restore();
      }
      if (!over) {
        const [e2, r] = SUI[next];
        c.globalAlpha = .55;
        c.font = `${Math.round(r * 1.15)}px sans-serif`;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(e2, dropX, LINE - r - 4);
        c.globalAlpha = 1;
        c.strokeStyle = 'rgba(90,100,110,.3)';
        c.beginPath(); c.moveTo(dropX, LINE); c.lineTo(dropX, LINE + 26); c.stroke();
        runner = requestAnimationFrame(loop);
      } else {
        showOver('선을 넘었어요', `${score}점 · 최고 동물 ${SUI[Math.max(...[...balls].map((b) => b.tier), 0)][0]}`, () => {
          for (const b of [...balls]) { Composite.remove(engine.world, b); balls.delete(b); }
          score = 0; setScore(0); over = false; canDrop = true; loop();
        });
      }
    };
    loop();
  }).catch(() => {
    hint.textContent = '물리 엔진을 못 불러왔습니다. Esc 로 닫아 주세요.';
  });
}

/* ══════════════════════════════════════════════════════════
   미니게임 — 2D 규칙과 검증된 엔진을 이어 씁니다.

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

   ---- 뒤에 붙은 넷(⑥~⑨) 은 사정이 다릅니다 ----
   기린 목 펴기 · 달리기 시합 100m · 연못 낚시 · 책 정리는 2D 판
   openworld/index.html **안에** 규칙과 그림이 한 덩어리로 들어 있어서,
   import 로 끌어올 모듈이 하나도 없었습니다. 그래서 유일하게 남은 길인
   "그대로 옮겨 적기" 를 했습니다. 어디서 가져왔는지는 각 게임 머리말에
   2D 쪽 함수 이름으로 적어 두었습니다. 규칙을 새로 지으면 같은 게임이
   두 판본에서 다르게 굴러가고, 그건 옮긴 게 아닙니다.
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
  /* 열쇠는 2D 판 이름 그대로입니다(giraffeNeck · trackRace · pondFish · bookSort).
     spots.js 가 어느 판을 보고 적든 같은 이름으로 걸립니다. */
  giraffeNeck: { title: '기린 목 펴기', how: '두드려서 나무 꼭대기 잎사귀까지 목을 폅니다' },
  trackRace:   { title: '달리기 시합 100m', how: '← → 를 번갈아 밟아 100m 를 달립니다' },
  pondFish:    { title: '연못 낚시', how: '찌가 쑥 잠기는 순간 Space 로 챕니다' },
  bookSort:    { title: '책 정리', how: '청구기호가 작은 책부터 골라 꽂습니다' },
  /* 이 열쇠도 2D 판 이름 그대로입니다 — 2D 는 코인을 'postureRun' 으로
     적습니다. 이름이 갈리면 같은 게임이 두 판에서 다른 것으로 세어집니다. */
  postureRun:  { title: '거북목 탈출 러너', how: '고개를 살짝 들면 뛰어넘어요 — 자판 Space 도 됩니다' },
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

/** 미니게임 하나를 엽니다. 끝나면 onDone(점수) 를 부릅니다.
    ctx 는 게임에 물려 줄 바깥 장치입니다. 지금은 ctx.posture(웹캠 자세)
    하나뿐이고 거북목 탈출 러너만 씁니다 — 없어도 그 게임은 자판으로
    그대로 굴러갑니다. 부르는 쪽이 안 넘길 수도 있으므로 없는 것을
    기본으로 놓습니다.
    갈래마다 인자를 달리 넘기지 않고 **다 (body, ctx) 로 넘깁니다.**
    한 게임만 인자가 하나 더 붙으면 이 줄이 갈라지고, 갈라진 자리는
    다음에 게임을 붙일 때 빠뜨리기 좋은 자리입니다. */
export function openGame(key, onDone, ctx) {
  /* 이미 하나 열려 있으면 먼저 닫습니다. 안 닫으면 앞 게임의 rAF 와
     자판 손잡이가 그대로 살아서 새 게임 칸에 점수를 적습니다.
     지금은 부르는 쪽(index.html)이 막고 있지만, 막는 코드가 **다른 파일**에
     있는 보호는 언젠가 사라집니다. */
  if (host) close(0);
  closing = false; lastScore = 0; done = onDone; teardown = null;
  const body = shell(key);
  ({ memory, match3, run, n2048, suika, giraffeNeck, trackRace, pondFish, bookSort,
     postureRun })[key](body, ctx);
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
  let mt = 0;
  body.onclick = (e) => {
    const b = e.target.closest('button.mc'); if (!b) return;
    const r = MEM.selectCard(st, +b.dataset.i);
    if (!r.accepted) return;
    draw();
    /* 이 타이머는 **창보다 오래 삽니다.** 짝이 틀린 뒤 0.7초 안에 Esc 를
       누르면 host 가 이미 null 인데 setScore 가 host 를 찾다가 터졌고,
       그 사이에 다른 게임을 열면 앞 게임 점수가 새 게임 칸에 적혔습니다.
       손잡이를 들고 있다가 닫을 때 같이 끕니다. */
    if (r.checking) {
      clearTimeout(mt);
      mt = setTimeout(() => {
        mt = 0;
        if (!gameOpen()) return;
        const res = MEM.resolvePendingPair(st);
        setScore(st.score); draw();
        if (res.complete) over('다 맞췄어요', `${st.moves}번 만에 · 최고 연속 ${st.maxCombo}`, start);
      }, MEM.ANIMAL_MEMORY_CONFIG.mismatchDelayMs);
    }
  };
  const loop = () => {
    MEM.tickGame(st, performance.now());
    const left = Math.max(0, st.previewEndsAt - performance.now());
    setTime(st.status === 'PREVIEW' ? `외우세요 ${(left / 1000).toFixed(1)}초` : `${st.moves}수`);
    if (st.status === 'PLAYING' && !body.querySelector('.mc.up:not(.ok)')) draw();
    raf = requestAnimationFrame(loop);
  };
  teardown = () => { clearTimeout(mt); mt = 0; };
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
    /* 다시 시작할 때 loop() 를 도로 걸어야 합니다. 안 걸었더니 두 판째부터
       시계가 '0초' 에 멈춘 채로 영영 안 끝났습니다 — 그만두기 말고는
       나갈 길이 없고, 점수도 0 으로 나갑니다. */
    if (left <= 0) {
      over('시간 끝', `${score}점`, () => {
        board = M3.createBoard(); score = 0; t0 = performance.now(); setScore(0); draw(); loop();
      });
      return;
    }
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

  /* localStorage 를 **감싸서** 읽습니다. 쿠키·사이트 데이터를 막아 둔
     브라우저에서는 getItem 자체가 던지는데, 그러면 openGame 이 통째로
     터져서 판이 빈 채로 열리고 Esc 도 안 먹었습니다(Esc 를 다는 줄이
     이 아래에 있습니다). 기록 하나 때문에 게임이 안 열리면 안 됩니다. */
  let tb, score, best = +(ls('girin3d.2048', 0) || 0), overed;
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


/* ══════════════════════════════════════════════════════════
   ⑥~⑨ 2D 판에서 옮겨 온 넷

   위 다섯과 달리 이 넷은 **엔진 모듈이 없습니다.** 2D 판
   openworld/index.html 안에 그리기까지 한 덩어리로 들어 있어서,
   import 로 끌어올 수 있는 것이 하나도 없었습니다. 그래서 규칙과
   숫자를 **그대로** 옮겨 적었습니다 — 규칙을 새로 지으면 같은
   게임이 두 판본에서 다르게 굴러가고, 그건 옮긴 게 아닙니다.

   옮길 때 지킨 것
     · 좌표계를 원본 그대로 둡니다(880x330 · 트랙은 레인 수만큼).
       화면 폭에 맞추는 일은 fitCv 한 곳만 하므로, 그림 상수를
       한 개도 안 고치고 원본에서 그대로 베낄 수 있습니다.
     · 판정에 쓰는 수는 전부 원본 이름 그대로 상수로 둡니다.
       NECK_* · RACE_* · FISH_* · BOOK_* 를 2D 에서 찾으면 같은 값입니다.
     · 문구도 원본입니다. '찰칵! N단 고정' · '같은 발이에요' ·
       '톡톡 두 번 뒤에 잠깁니다' · '더 작은 번호가 카트에 남아 있어요'.

   옮기면서 뺀 것 (여기 없는 것에 기대던 부분입니다)
     · SFX — 3D 판 소리는 index.html 안에 있고 games.js 는 그걸 안 봅니다.
     · MP(같이 달리는 사람 레인) — 3D 판 미니게임에는 통신이 없습니다.
       그래서 RACE_KEEP_MS(조용한 레인 접기)도 같이 빠졌습니다.
     · 코인 — 3D 는 openGame 의 onDone(점수) 이 하루 한 번 규칙을
       들고 있습니다. 다만 2D 는 **성공해야** 코인이므로, 실패한 판은
       끝낼 때 점수를 0 으로 되돌려 그 규칙을 지킵니다.

   저장 열쇠는 2D 와 **같은 것**을 씁니다 — girin.fishbook(어류도감) ·
   girin.fish.best · girin.giraffe.best · girin.race.best. 같은 사람이
   2D 로 채운 도감을 3D 에서 이어서 채웁니다. 3D 전용 열쇠를 새로 파면
   도감이 두 벌이 되고, 그러면 도감이 아니라 그냥 카운터입니다.
   ══════════════════════════════════════════════════════════ */

/* 캔버스를 화면 폭에 맞춥니다(2D 판 fitGameCanvas 와 같은 방식).
   크기를 다시 넣으면 캔버스가 통째로 지워지므로, 안 바뀌었으면 그냥 둡니다 —
   매 프레임 넣으면 그리기 전에 한 번씩 흰 판이 됩니다. */
function fitCv(cv, W, H) {
  if (!cv || !cv.isConnected) return null;
  const cssW = cv.clientWidth || W;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(cssW * dpr));
  const h = Math.max(1, Math.round(w * H / W));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const g = cv.getContext('2d');
  const s = w / W;
  g.setTransform(s, 0, 0, s, 0, 0);
  return g;
}

/* 픽셀아트 원. arc 로 그리면 가장자리가 부드러워져 이 그림들의 각진
   결과 안 맞습니다 — 가로줄로 쌓습니다(2D 판 disc 그대로). */
function disc(g, cx, cy, r, c) {
  g.fillStyle = c;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
    g.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
}

/** 남은 시간을 0:45 꼴로. 초만 쓰면 90초가 얼마인지 세어 봐야 압니다. */
function mmss(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}

/* 그림에 쓰는 색과 글꼴은 **HUD 에서 읽어 옵니다.** 여기에 색을 또
   적어 두면 HUD 를 손볼 때마다 게임 창만 옛 색으로 남습니다. */
let PAL = null;
function pal() {
  if (PAL) return PAL;
  const v = (n, fb) => {
    try { return (getComputedStyle(document.documentElement).getPropertyValue(n) || '').trim() || fb; }
    catch { return fb; }
  };
  let ff = 'system-ui, sans-serif';
  try { ff = getComputedStyle(document.body).fontFamily || ff; } catch { /* 무시 */ }
  PAL = { ink: v('--ink', '#222A33'), ink2: v('--ink2', '#5C6672'),
          acc: v('--acc', '#35E0C6'), acc2: v('--acc2', '#19B9A2'),
          paper: v('--paper', '#FFFCF5'), warn: v('--warn', '#F5C451'),
          bad: v('--bad', '#FF7E6E'), ok: v('--ok', '#74E294'), ff };
  return PAL;
}
const F7 = (px) => '700 ' + px + 'px ' + pal().ff;
const F8 = (px) => '800 ' + px + 'px ' + pal().ff;

/* 판 위의 부스러기 · 뜨는 글자. 2D 판 JUICE 를 창 하나 몫으로 줄인
   것입니다 — 창은 한 번에 하나만 열리므로 배열도 하나면 됩니다. */
const FX = {
  a: [],
  reduced: (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })(),
  reset() { this.a.length = 0; },
  burst(x, y, col, n, spd) {
    if (this.reduced) return;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const v = (spd || 90) * (0.45 + Math.random() * 0.75);
      this.a.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - 40, t: 0,
                    life: 0.34 + Math.random() * 0.3, r: 2 + Math.random() * 2.4, col, gr: 380 });
    }
  },
  puff(x, y, col, n) {
    if (this.reduced) return;
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const v = 40 + Math.random() * 70;
      this.a.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, t: 0,
                    life: 0.3 + Math.random() * 0.3, r: 2 + Math.random() * 3, col, gr: 130 });
    }
  },
  say(x, y, text, col, size) {
    this.a.push({ x, y, text, col, size: size || 18, t: 0, life: 0.9, vx: 0, vy: -34, gr: 0 });
  },
  update(dt) {
    for (let i = this.a.length - 1; i >= 0; i--) {
      const p = this.a[i];
      p.t += dt;
      if (p.t >= p.life) { this.a.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.gr * dt;
    }
  },
  draw(g) {
    for (const p of this.a) {
      g.globalAlpha = Math.max(0, Math.min(1, (1 - p.t / p.life) * 1.5));
      if (p.text) {
        g.fillStyle = p.col; g.font = F8(p.size);
        g.textAlign = 'center'; g.fillText(p.text, p.x, p.y); g.textAlign = 'left';
      } else {
        g.fillStyle = p.col; g.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
    }
    g.globalAlpha = 1;
  },
};

/* 게임마다 아래에 한 줄. "지금 뭘 해야 하는지" 를 캔버스 밖에도 적어
   둡니다 — 캔버스 안에만 두면 글자가 그림에 묻힙니다. */
function sayLine(body, text) {
  const p = document.createElement('p');
  p.style.cssText = 'margin:0;font:600 11.5px/1.45 inherit;color:var(--ink2);text-align:center;'
    + 'min-height:17px;max-width:560px';
  p.textContent = text;
  body.appendChild(p);
  return (t) => { p.textContent = t; };
}
/* 창 안의 단추는 .gover 의 것과 같은 모양입니다 — 한 창에 두 가지
   단추 모양이 있으면 어느 쪽이 주된 것인지 안 읽힙니다. */
function gbtn(label, ghost) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.style.cssText = 'border:0;border-radius:99px;padding:11px 22px;font-family:inherit;'
    + 'font-weight:800;font-size:13px;cursor:pointer;'
    + (ghost ? 'background:rgba(34,42,51,.08);color:var(--ink)' : 'background:var(--ink);color:var(--paper)');
  return b;
}
/* localStorage 는 시크릿 창에서 던집니다. 기록 하나 때문에 게임이
   안 열리면 안 되므로 조용히 물러납니다(2D 판 loadJSON/saveJSON 과 같은 규칙). */
function ls(key, fb) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fb; } catch { return fb; }
}
function lsSet(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* 무시 */ } }

/* ---------- ⑥ 기린 목 펴기 ----------
   2D: startGiraffeNeck / giraffeNeckTick / drawGiraffeNeck.
   숫자는 전부 원본입니다 — 45초 한 판, 걸쇠 34%·67%, 별 셋 12초·둘 20초,
   연속 인정 420ms, 한 번에 0.035 + min(12,연속)*0.0035. */
const NECK_W = 880, NECK_H = 330;   // 그리는 좌표계
const NECK_MS = 45000;              // 한 판
const NECK_LOCKS = [0.34, 0.67];    // 걸쇠 — 넘으면 그 아래로 안 처집니다
const NECK_STAR3 = 12, NECK_STAR2 = 20;   // 별 기준(초)
const NECK_COMBO_MS = 420;          // 이 안에 다시 누르면 이어집니다
const NECK_SEGS = 14, NECK_SEG_LEN = 10;  // 목 마디 열넷 x 10px = 140px
const NECK_BASE_X = 300, NECK_BASE_Y = 206, NECK_GROUND = 240;

const neckStars = (sec) => (sec <= NECK_STAR3 ? 3 : sec <= NECK_STAR2 ? 2 : 1);
const neckBest = () => Number(ls('girin.giraffe.best', 0)) || 0;

/** 목 마디의 자리. 굽은 정도는 (1 - 펴짐) 에 비례합니다. */
function neckPath(vp) {
  const bend = (1 - vp) * 2.5;
  const pts = [];
  let x = NECK_BASE_X, y = NECK_BASE_Y, a = -Math.PI / 2;
  pts.push({ x, y, a });
  for (let i = 0; i < NECK_SEGS; i++) {
    a = -Math.PI / 2 + bend * ((i + 1) / NECK_SEGS);
    x += Math.cos(a) * NECK_SEG_LEN;
    y += Math.sin(a) * NECK_SEG_LEN;
    pts.push({ x, y, a });
  }
  return pts;
}
/** 목표 잎의 높이 — 다 폈을 때 뿔 끝이 오는 자리(머리 끝에서 41px 위). */
const neckGoalY = () => neckPath(1).at(-1).y - 41;

function giraffeNeck(body) {
  body.className = 'gbody';
  const P = pal();
  const cv = document.createElement('canvas');
  cv.style.cssText = `width:100%;aspect-ratio:${NECK_W}/${NECK_H};display:block;`
    + 'cursor:pointer;touch-action:manipulation';
  body.appendChild(cv);
  const btn = gbtn('목 펴기 (Space · 클릭)');
  btn.style.width = '100%';
  body.appendChild(btn);
  const say = sayLine(body, '여기를 두드려 주세요.');
  const note = document.createElement('p');
  note.style.cssText = 'margin:0;font:600 11px/1.5 inherit;color:var(--ink2);opacity:.75;'
    + 'text-align:center;max-width:520px';
  note.textContent = `빠르게 이어 두드리면 연속이 쌓여 한 번에 더 많이 펴집니다. `
    + `34% · 67% 에는 걸쇠가 있어서, 한 번 넘으면 그 아래로는 안 처져요 — ${NECK_STAR3}초 안이면 별 셋이에요.`;
  body.appendChild(note);

  const G = { p: 0, vp: 0, kick: 0, lock: 0, combo: 0, bestCombo: 0, taps: 0,
              lastTapAt: 0, shake: 0, over: false, won: false, time: 0,
              startedAt: 0, last: 0, overAt: 0 };
  const floor = () => (G.lock > 0 ? NECK_LOCKS[G.lock - 1] : 0);
  const headX = () => neckPath(G.vp).at(-1).x;
  const headY = () => neckPath(G.vp).at(-1).y;

  function tap() {
    if (G.over) return;
    const now = performance.now();
    G.combo = now - G.lastTapAt <= NECK_COMBO_MS ? G.combo + 1 : 1;
    G.bestCombo = Math.max(G.bestCombo, G.combo);
    G.lastTapAt = now; G.taps++;
    /* 한 번에 펴지는 양. 연속 열둘까지만 세어 줍니다 — 그 위를 열어 두면
       연타 매크로가 2초에 끝냅니다. */
    G.p = Math.min(1, G.p + 0.035 + Math.min(12, G.combo) * 0.0035);
    G.kick = Math.min(1, G.kick + 0.5);
    if (G.combo > 1 && G.combo % 5 === 0) FX.say(headX() + 40, headY() - 16, G.combo + ' 연속!', P.warn, 20);
    /* 걸쇠를 넘는 순간이 이 게임에서 기분 좋은 자리라 소리·부스러기·문구를
       여기 한 곳에 모읍니다. */
    while (G.lock < NECK_LOCKS.length && G.p >= NECK_LOCKS[G.lock]) {
      G.lock++; G.shake = 0.32;
      FX.burst(headX(), headY(), '#FFE9A8', 14, 130);
      FX.say(headX(), headY() - 30, '찰칵! ' + G.lock + '단 고정', '#FFFFFF', 22);
      say(G.lock + '단 걸쇠에 걸렸어요 — 여기부터는 안 처져요.');
    }
    setScore(Math.round(G.p * 100));
    if (G.p >= 1) finish(true);
  }

  function finish(won) {
    if (G.over) return;
    G.over = true; G.won = won;
    G.time = Math.max(0, (performance.now() - G.startedAt) / 1000);
    G.overAt = performance.now();
    if (won) {
      const prev = neckBest();
      const t = Math.round(G.time * 10) / 10;
      if (!prev || t < prev) lsSet('girin.giraffe.best', t);
      FX.burst(headX(), headY(), '#FFE9A8', 26, 190);
      const st = neckStars(G.time);
      setScore(Math.round(G.p * 100));
      say('목을 다 폈어요. ' + G.time.toFixed(1) + '초 · 별 ' + st + '개.');
      over('목을 다 폈어요',
           '★'.repeat(st) + '☆'.repeat(3 - st) + ' · ' + G.time.toFixed(1) + '초 · 최고 '
           + G.bestCombo + '연속 · 내 최고 ' + neckBest().toFixed(1) + '초', start);
    } else {
      /* 2D 는 성공해야 코인입니다. 3D 는 점수>0 이 곧 코인이므로 0 으로 되돌립니다. */
      setScore(0);
      say('시간이 끝났어요. 걸쇠(34% · 67%)까지만 넘겨 두면 그 아래로는 안 처져요.');
      over('시간이 끝났어요', Math.round(G.p * 100) + '% 까지 폈어요 · 조금 더 빠르게 이어서', start);
    }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - G.last) / 1000);
    G.last = now;
    if (dt <= 0) { draw(); return; }
    if (!G.over) {
      /* 처짐 — 위로 갈수록 빨라집니다. 아래에서는 두드리는 법을 배우고,
         위에서는 그 손을 유지해야 합니다. */
      G.p = Math.max(floor(), G.p - (0.075 + 0.20 * G.p) * dt);
      if (now - G.lastTapAt > NECK_COMBO_MS) G.combo = 0;
      const left = NECK_MS - (now - G.startedAt);
      setTime(mmss(left));
      setScore(Math.round(G.p * 100));
      if (left <= 0) finish(false);
    }
    /* 그림은 값을 따라갑니다. 두드린 자리로 목이 순간이동하면 손맛이
       없고, 처지는 것도 안 보입니다. */
    G.vp += (G.p - G.vp) * Math.min(1, dt * 14);
    G.kick = Math.max(0, G.kick - dt * 3.4);
    G.shake = Math.max(0, G.shake - dt * 2);
    FX.update(dt);
    draw();
  }

  function draw() {
    const g = fitCv(cv, NECK_W, NECK_H);
    if (!g) return;
    const W = NECK_W, H = NECK_H;
    /* 걸쇠에 걸리는 순간만 흔들립니다. 늘 흔들면 멀미가 나고, 안 흔들면
       걸린 줄 모릅니다. */
    if (G.shake > 0) g.translate((Math.random() - 0.5) * G.shake * 9, (Math.random() - 0.5) * G.shake * 6);

    const sky = g.createLinearGradient(0, 0, 0, NECK_GROUND);
    sky.addColorStop(0, '#BFE3EF'); sky.addColorStop(1, '#EAF3E4');
    g.fillStyle = sky; g.fillRect(0, 0, W, NECK_GROUND);
    /* 먼 언덕 — 뒤가 비면 기린이 색종이처럼 떠 보입니다 */
    for (let i = 0; i < 5; i++) disc(g, 40 + i * 200, NECK_GROUND + 44, 74 + (i % 2) * 24, '#C3DEC0');
    for (let i = 0; i < 4; i++) disc(g, 140 + i * 220, NECK_GROUND + 52, 56, '#AFD3AE');
    g.fillStyle = '#8FBF7A'; g.fillRect(0, NECK_GROUND, W, H - NECK_GROUND);
    g.fillStyle = '#A3CE8B'; g.fillRect(0, NECK_GROUND, W, 3);
    g.fillStyle = '#79AE68';
    for (let i = 0; i < 90; i++) {
      const x = (i * 97) % W, y = NECK_GROUND + 8 + ((i * 37) % (H - NECK_GROUND - 10));
      g.fillRect(x, y, 3, 4 + (i % 3));
    }

    /* 목표 나무 — 열매를 오른쪽 끝에 달면 목을 펴도 안 닿는 자리라,
       화면이 시키는 것과 조작이 하는 것이 어긋납니다. 닿을 자리에 답니다. */
    const treeX = 742, goalY = neckGoalY();
    g.fillStyle = '#6B4A2E'; g.fillRect(treeX - 15, 70, 30, H - 70);
    g.fillStyle = '#8A6039'; g.fillRect(treeX - 15, 70, 8, H - 70);
    g.fillStyle = '#4A3323'; g.fillRect(treeX + 8, 70, 7, H - 70);
    g.fillStyle = '#5A3D25';
    for (let y = 96; y < H; y += 26) g.fillRect(treeX - 6, y, 3, 14);
    disc(g, treeX + 8, 56, 66, '#3F8F5C');
    disc(g, treeX - 40, 68, 46, '#4E9E63');
    disc(g, treeX + 62, 72, 40, '#357C4E');
    disc(g, treeX - 30, 28, 32, '#6FBE7F');
    const bez = (t, a, b, c) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
    for (let t = 0; t <= 1.001; t += 0.014) {
      const x = bez(t, treeX - 14, 520, NECK_BASE_X + 4);
      const y = bez(t, 104, 96, goalY + 8);
      const th = 13 - t * 8;
      g.fillStyle = '#6B4A2E'; g.fillRect(x - th / 2, y - th / 2, th, th);
      g.fillStyle = '#8A6039'; g.fillRect(x - th / 2, y - th / 2, th, 2);
    }
    /* 잎 덩이 — 한 덩이가 원 셋이라야 잎으로 보이고, 하나면 사탕이 됩니다. */
    [0.2, 0.42, 0.64, 0.84].forEach((t, i) => {
      const x = bez(t, treeX - 14, 520, NECK_BASE_X + 4);
      const y = bez(t, 104, 96, goalY + 8) + Math.sin(performance.now() / 900 + i) * 2;
      disc(g, x + 7, y + 5, 16, '#357C4E');
      disc(g, x - 11, y + 1, 14, '#4E9E63');
      disc(g, x - 3, y - 7, 11, '#6FBE7F');
    });
    const wob = Math.sin(performance.now() / 260) * 3;
    const done = G.p >= 1;
    disc(g, NECK_BASE_X + 2 + wob, goalY + 10, 27, 'rgba(255,255,255,.34)');
    disc(g, NECK_BASE_X + 4 + wob, goalY + 12, 22, done ? '#C98536' : '#2F6B45');
    disc(g, NECK_BASE_X - 2 + wob, goalY + 7, 18, done ? '#E0AE3C' : '#4E9E63');
    disc(g, NECK_BASE_X - 8 + wob, goalY + 2, 12, done ? '#FFD98A' : '#7BD68F');
    disc(g, NECK_BASE_X - 12 + wob, goalY - 2, 6, done ? '#FFF3C8' : '#C2ECC9');
    if (!done) {
      g.fillStyle = 'rgba(34,42,51,.72)';
      g.fillRect(NECK_BASE_X - 148, goalY - 4, 88, 26);
      g.fillStyle = P.paper; g.font = F7(14);
      g.textBaseline = 'middle'; g.fillText('여기까지!', NECK_BASE_X - 138, goalY + 9);
      g.textBaseline = 'alphabetic';
      g.fillStyle = 'rgba(34,42,51,.72)';
      g.fillRect(NECK_BASE_X - 60, goalY + 6, 12, 3);
    }

    const pts = neckPath(G.vp + G.kick * 0.02);
    /* 접지 그림자 먼저. 이게 없으면 기린이 잔디 위에 붙지 않습니다. */
    g.fillStyle = 'rgba(60,40,24,.22)';
    g.beginPath(); g.ellipse(NECK_BASE_X + 8, 296, 82, 11, 0, 0, 7); g.fill();
    /* 다리 넷. 뒤 둘이 어둡고 조금 안쪽입니다 — 넷을 같은 색으로 두면
       판자 넷이 서 있는 것으로 보입니다. */
    const leg = (x, top, w, back) => {
      g.fillStyle = back ? '#B66D31' : '#9B5B2B'; g.fillRect(x - 1, top, w + 2, 294 - top);
      g.fillStyle = back ? '#C98536' : '#D7953F'; g.fillRect(x, top, w, 292 - top);
      if (!back) { g.fillStyle = '#E8AD50'; g.fillRect(x, top, 4, 292 - top); }
      g.fillStyle = back ? '#7A4520' : '#6B4A2E'; g.fillRect(x - 1, 286, w + 2, 8);
    };
    leg(NECK_BASE_X - 38, 240, 14, true); leg(NECK_BASE_X + 36, 240, 14, true);
    leg(NECK_BASE_X - 22, 244, 16, false); leg(NECK_BASE_X + 18, 244, 16, false);
    const bodyPaint = (inset, col) => {
      disc(g, NECK_BASE_X - 26 + inset, 226 + inset * 0.4, 30 - inset, col);
      disc(g, NECK_BASE_X + 38 - inset, 228 + inset * 0.4, 32 - inset, col);
      g.fillStyle = col; g.fillRect(NECK_BASE_X - 26, 196 + inset, 64, 62 - inset * 2);
    };
    bodyPaint(0, '#9B5B2B');
    bodyPaint(3, '#E8AD50');
    /* 빛은 왼쪽 위 — 등이 밝고 배가 어둡습니다 */
    g.save(); g.beginPath(); g.rect(NECK_BASE_X - 58, 199, 130, 12); g.clip();
    bodyPaint(3, '#F0C378'); g.restore();
    g.save(); g.beginPath(); g.rect(NECK_BASE_X - 58, 242, 130, 18); g.clip();
    bodyPaint(3, '#C98536'); g.restore();
    g.fillStyle = '#B66D31';
    [[-30, 214], [-4, 208], [24, 218], [-18, 232], [14, 236], [36, 236]].forEach(([a, b]) =>
      g.fillRect(NECK_BASE_X + a, b, 14, 11));
    const tail = Math.sin(performance.now() / 320) * 5;
    g.fillStyle = '#9B5B2B';
    g.fillRect(NECK_BASE_X + 66, 208, 6, 28);
    g.fillRect(NECK_BASE_X + 64 + tail, 232, 9, 12);

    /* 목 — 마디마다 왼쪽에 밝은 줄, 오른쪽에 어두운 줄. */
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i], p1 = pts[i + 1], wSeg = 27 - i * 0.7;
      g.save();
      g.translate(p0.x, p0.y); g.rotate(p1.a + Math.PI / 2);
      g.fillStyle = '#9B5B2B'; g.fillRect(-wSeg / 2 - 2, -NECK_SEG_LEN, wSeg + 4, NECK_SEG_LEN + 4);
      g.fillStyle = '#E8AD50'; g.fillRect(-wSeg / 2, -NECK_SEG_LEN, wSeg, NECK_SEG_LEN + 3);
      g.fillStyle = '#F0C378'; g.fillRect(-wSeg / 2, -NECK_SEG_LEN, 5, NECK_SEG_LEN + 3);
      g.fillStyle = '#C98536'; g.fillRect(wSeg / 2 - 5, -NECK_SEG_LEN, 5, NECK_SEG_LEN + 3);
      if (i % 2 === 0 && i < pts.length - 3) {
        g.fillStyle = '#B66D31'; g.fillRect(-wSeg / 2 + 5, -NECK_SEG_LEN + 1, wSeg - 11, 6);
      }
      g.fillStyle = '#8A5024'; g.fillRect(wSeg / 2 - 1, -NECK_SEG_LEN + 1, 4, 7);
      g.restore();
    }
    const head = pts[pts.length - 1];
    g.save();
    g.translate(head.x, head.y); g.rotate(head.a + Math.PI / 2);
    g.fillStyle = '#9B5B2B'; g.fillRect(-16, -28, 32, 32);
    g.fillStyle = '#E8AD50'; g.fillRect(-13, -25, 26, 26);
    g.fillStyle = '#F0C378'; g.fillRect(-13, -25, 26, 6);
    g.fillStyle = '#E8AD50'; g.fillRect(-23, -20, 11, 12);
    g.fillStyle = '#9B5B2B'; g.fillRect(-25, -20, 3, 12);
    g.fillStyle = '#2A2520'; g.fillRect(-5, -18, 5, 5);
    g.fillStyle = '#FFFFFF'; g.fillRect(-5, -18, 2, 2);
    g.fillStyle = '#9B5B2B'; g.fillRect(-8, -38, 4, 11); g.fillRect(4, -38, 4, 11);
    g.fillStyle = '#6B4A2E'; g.fillRect(-9, -41, 6, 5); g.fillRect(3, -41, 6, 5);
    g.fillStyle = '#E8AD50'; g.fillRect(11, -24, 13, 8);
    g.fillStyle = '#C98536'; g.fillRect(13, -22, 9, 4);
    g.restore();

    /* 펴짐 막대 — 걸쇠가 보이는 자리. 채움은 HUD 강조색입니다. */
    const bx = 30, by = 38, bh = 232, bw = 20;
    g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(bx - 5, by - 6, bw + 10, bh + 12);
    g.fillStyle = '#D8D2CC'; g.fillRect(bx, by, bw, bh);
    const fill = bh * G.vp;
    const grad = g.createLinearGradient(0, by + bh - fill, 0, by + bh);
    grad.addColorStop(0, P.acc); grad.addColorStop(1, P.acc2);
    g.fillStyle = grad; g.fillRect(bx, by + bh - fill, bw, fill);
    NECK_LOCKS.forEach((L, i) => {
      g.fillStyle = G.lock > i ? '#2E9E5B' : '#9A8E88';
      g.fillRect(bx - 5, by + bh - bh * L - 2, bw + 10, 4);
    });
    g.fillStyle = P.ink; g.font = F7(12); g.textAlign = 'center';
    g.fillText(Math.round(G.vp * 100) + '%', bx + bw / 2, by - 12);
    g.textAlign = 'left';

    FX.draw(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  function start() {
    FX.reset();
    G.p = 0; G.vp = 0; G.kick = 0; G.lock = 0; G.combo = 0; G.bestCombo = 0;
    G.taps = 0; G.lastTapAt = 0; G.time = 0; G.shake = 0; G.over = false; G.won = false;
    G.startedAt = performance.now(); G.last = performance.now();
    setScore(0); setTime(mmss(NECK_MS));
    say(neckBest() ? '여기를 두드려 주세요. 내 최고 기록은 ' + neckBest().toFixed(1) + '초예요.'
                   : '여기를 두드려 주세요.');
  }

  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
  btn.addEventListener('click', tap);
  const kd = (e) => { if (e.code === 'Space') { e.preventDefault(); tap(); } };
  addEventListener('keydown', kd);
  teardown = () => removeEventListener('keydown', kd);
  start();
  raf = requestAnimationFrame(loop);
}

/* ---------- ⑦ 달리기 시합 100m ----------
   2D: startTrackRace / trackRaceTick / racePacerAt / raceRank.
   빠져 있는 것: 같이 달리는 사람 레인(MP) 과 그것을 접는 RACE_KEEP_MS —
   3D 판 미니게임에는 통신이 없습니다. 페이서 셋과 '내 최고' 는 그대로입니다. */
const RACE_M = 100;              // 100m 는 20초 안쪽입니다
const RACE_TARGET = 18;          // 이 안에 들어오면 성공
const RACE_LIMIT = 30;           // 한 판의 끝. 안 두면 안 뛰는 판이 안 끝납니다
const RACE_VMAX = 9.6;           // m/s
const RACE_GAIN = 0.55;          // 한 걸음이 더해 주는 속도
const RACE_DECAY = 0.45;         // 초당 잃는 비율
const RACE_W = 880, RACE_LANE = 44, RACE_TOP = 34;
const RACE_X0 = 158, RACE_X1 = RACE_W - 42;   // 출발선 · 결승선
const RACE_SPURT_M = 80;         // 여기서부터 스퍼트
const RACE_TEMPO = [100, 340];   // 좋은 박자로 치는 걸음 간격(ms)
/* 페이서 셋. 이름과 종은 이 월드에 사는 것들에서 가져옵니다. */
const RACE_PACERS = [
  { nick: '느린거북', sec: 19.6, col: '#5CB177' },
  { nick: '뒤뚱펭귄', sec: 17.2, col: '#4A7FB5' },
  { nick: '폴짝개구리', sec: 15.4, col: '#7BB661' },
];
/** 페이서는 등속이 아닙니다 — 처음 1.6초를 가속에 씁니다. 등속으로 두면
    출발선에서 저 혼자 튀어 나갑니다. */
function racePacerAt(q, t) {
  const v = RACE_M / q.sec, acc = 1.6;
  return t < acc ? v * t * t / (2 * acc) : v * (t - acc / 2);
}
const raceBest = () => Number(ls('girin.race.best', 0)) || 0;

function trackRace(body) {
  body.className = 'gbody';
  const P = pal();
  const cv = document.createElement('canvas');
  cv.style.cssText = 'width:100%;display:block';
  body.appendChild(cv);
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;width:100%;max-width:520px';
  const bL = gbtn('왼발  ←'), bR = gbtn('오른발  →');
  bL.style.flex = bR.style.flex = '1';
  row.appendChild(bL); row.appendChild(bR);
  body.appendChild(row);
  const say = sayLine(body, '신호를 기다려 주세요.');
  const note = document.createElement('p');
  note.style.cssText = 'margin:0;font:600 11px/1.5 inherit;color:var(--ink2);opacity:.75;'
    + 'text-align:center;max-width:520px';
  note.textContent = `← → · A D 로 왼발 오른발을 번갈아 밟습니다. 마지막 20m 는 스퍼트 구간이라 `
    + `한 걸음이 더 나가요. ${RACE_TARGET}초 안이면 성공이고, ${RACE_LIMIT}초를 넘기면 그 판은 거기서 끝나요.`;
  body.appendChild(note);

  const R = { phase: 'ready', wait: 2.4, t: 0, dist: 0, v: 0, lastFoot: '', lastStepAt: 0,
              slip: 0, steps: 0, tempo: 0, prints: [], pacers: [], best: 0, time: 0,
              rank: 0, won: false, done: false, spurt: false, last: 0, overAt: 0, over: false };

  /** 결승선을 나보다 먼저 넘은 레인 수 + 1. 2D 는 페이서와 사람만 셉니다 —
      '내 최고' 레인은 보여 주기만 하고 순위에는 안 넣습니다(넣으면 혼자
      달려서 낸 기록이 다음 판의 등수를 깎습니다). */
  function raceRank() {
    let ahead = 0;
    for (const q of R.pacers) if (q.sec < R.t) ahead++;
    return ahead + 1;
  }
  /** 다음에 밟을 발을 단추에도 표시합니다. 화면 안에만 두면 손이 어디를
      눌러야 하는지 모르고, 단추에만 두면 트랙에서 눈을 떼야 합니다. */
  function paintFeet() {
    const next = R.lastFoot === 'left' ? 'right' : R.lastFoot === 'right' ? 'left' : '';
    for (const [side, el] of [['left', bL], ['right', bR]]) {
      const on = R.phase === 'run' && (next === '' || next === side);
      el.style.background = on ? 'var(--ink)' : 'rgba(34,42,51,.08)';
      el.style.color = on ? 'var(--paper)' : 'var(--ink)';
      el.style.transform = on ? 'translateY(-2px)' : 'none';
    }
  }
  /** 한 걸음. 같은 발을 두 번 밟으면 안 나갑니다. */
  function step(foot) {
    if (R.phase !== 'run') {
      if (R.phase === 'ready') { say('아직 출발 신호 전이에요. 초록불에 나가 주세요.'); R.slip = 0.22; }
      return;
    }
    if (foot === R.lastFoot) {
      R.slip = 0.35; R.tempo = 0;
      say('같은 발이에요. 왼발 오른발 번갈아!');
      FX.say(RACE_X0 + 120, RACE_TOP + 12, '같은 발!', '#E0483A', 18);
      paintFeet();
      return;
    }
    const now = performance.now();
    const gap = R.lastStepAt ? now - R.lastStepAt : 0;
    /* 박자 — 너무 몰아치거나 늘어지면 그냥 한 걸음, 고르면 1.3배.
       "빨리" 가 아니라 "고르게" 가 이기게 하는 자리입니다. */
    const good = gap >= RACE_TEMPO[0] && gap <= RACE_TEMPO[1];
    R.tempo = good ? Math.min(12, R.tempo + 1) : 0;
    const spurt = R.dist >= RACE_SPURT_M ? 1.35 : 1;
    R.v = Math.min(RACE_VMAX, R.v + RACE_GAIN * (good ? 1.3 : 1) * spurt);
    R.lastFoot = foot; R.lastStepAt = now; R.steps++;
    /* 발자국 — 조작에 흔적이 없으면 눌러도 아무 일이 없는 것처럼 느껴집니다. */
    R.prints.push({ d: R.dist, side: foot, t: 0 });
    if (R.prints.length > 26) R.prints.shift();
    if (good && R.tempo === 4) FX.say(RACE_X0 + 150, RACE_TOP + 14, '좋은 박자!', P.acc, 18);
    paintFeet();
  }

  function finish() {
    R.phase = 'done'; R.over = true; R.overAt = performance.now();
    R.time = R.t; R.rank = raceRank();
    R.done = R.dist >= RACE_M;                       // 못 넘고 끝났으면 기록이 아닙니다
    R.won = R.done && R.time <= RACE_TARGET;
    const prev = raceBest();
    const isBest = R.done && (!prev || R.time < prev);
    if (isBest) lsSet('girin.race.best', Math.round(R.time * 100) / 100);
    /* 2D 는 목표 시간 안에 들어와야 코인입니다 — 실패한 판은 0 점입니다. */
    setScore(R.won ? Math.round(R.dist) : 0);
    setTime(R.done ? R.time.toFixed(2) + '초' : '시간 초과');
    paintFeet();
    if (R.won) {
      FX.burst(RACE_X1 - 20, RACE_TOP + RACE_LANE / 2, '#FFE9A8', 26, 210);
      say(isBest ? '개인 최고 기록이에요!' : '목표 안에 들어왔어요.');
      over(R.time.toFixed(2) + '초 · ' + R.rank + '위',
           '목표 ' + RACE_TARGET + '초 통과! · ' + R.steps + '걸음', start);
    } else if (R.done) {
      say(RACE_TARGET + '초를 넘겼어요(' + R.time.toFixed(2) + '초). 같은 발을 두 번 누르지 않고 고르게 밟으면 훨씬 빨라져요.');
      over(R.time.toFixed(2) + '초 · ' + R.rank + '위',
           '목표는 ' + RACE_TARGET + '초예요 · ' + R.steps + '걸음', start);
    } else {
      say(RACE_LIMIT + '초 안에 못 들어왔어요. ' + Math.round(R.dist) + 'm 에서 끝났습니다.');
      over(Math.round(R.dist) + 'm 에서 끝',
           RACE_LIMIT + '초 안에 못 들어왔어요 · ' + R.steps + '걸음', start);
    }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - R.last) / 1000);
    R.last = now;
    if (dt <= 0) { draw(); return; }
    FX.update(dt);
    for (const p of R.prints) p.t += dt;
    if (R.phase === 'ready') {
      R.wait -= dt;
      setTime(R.wait > 1.0 ? '제자리에' : R.wait > 0 ? '준비' : '출발!');
      if (R.wait <= 0) {
        R.phase = 'run'; R.t = 0; R.lastStepAt = 0;
        say('가세요! 왼발 오른발 번갈아.');
        paintFeet();
      }
    } else if (R.phase === 'run') {
      R.t += dt;
      R.v = Math.max(0, R.v - R.v * RACE_DECAY * dt);
      const was = R.dist;
      R.dist = Math.min(RACE_M, R.dist + R.v * dt);
      if (!R.spurt && was < RACE_SPURT_M && R.dist >= RACE_SPURT_M) {
        R.spurt = true;
        say('스퍼트! 마지막 20m — 한 걸음이 더 나가요.');
        FX.say(RACE_W / 2, RACE_TOP + 20, '스퍼트!', '#FFD98A', 26);
      }
      if (R.slip > 0) R.slip -= dt;
      for (const q of R.pacers) q.d = Math.min(RACE_M, racePacerAt(q, R.t));
      setScore(Math.round(R.dist));
      setTime(R.t.toFixed(2) + '초 · ' + R.v.toFixed(1) + 'm/s');
      if (R.dist >= RACE_M || R.t >= RACE_LIMIT) { draw(); return finish(); }
    }
    draw();
  }

  /* 위에서 내려다본 레인. 옆에서 보면 남이 앞선 것이 안 보입니다 —
     레인을 세로로 쌓아야 "누가 앞에 있나" 가 한눈에 들어옵니다. */
  function draw() {
    const lanes = [{ nick: '나', d: R.dist, col: P.acc, me: true }]
      .concat(R.pacers.map((q) => ({ nick: q.nick, d: q.d, col: q.col })));
    if (R.best) lanes.splice(1, 0, { nick: '내 최고', col: '#9AA3AE', ghost: true,
      d: Math.min(RACE_M, racePacerAt({ sec: R.best }, R.t)) });
    lanes.length = Math.min(6, lanes.length);

    /* 레인 수만큼만 높이를 잡습니다. 여섯 칸을 고정으로 두면 혼자 달릴 때
       화면 절반이 빈 붉은 판입니다. */
    const H = RACE_TOP + lanes.length * RACE_LANE + 10;
    const ratio = RACE_W + ' / ' + H;
    if (cv.style.aspectRatio !== ratio) cv.style.aspectRatio = ratio;
    const g = fitCv(cv, RACE_W, H);
    if (!g) return;

    g.fillStyle = '#C4553F'; g.fillRect(0, 0, RACE_W, H);
    g.fillStyle = '#8E3A29'; g.fillRect(0, 0, RACE_W, RACE_TOP - 4);
    g.font = F7(12); g.textBaseline = 'middle';
    for (let m = 0; m <= RACE_M; m += 10) {
      const x = RACE_X0 + (RACE_X1 - RACE_X0) * (m / RACE_M);
      const big = m % 50 === 0;
      g.fillStyle = big ? '#F4EDE4' : 'rgba(244,237,228,.45)';
      g.fillRect(x, RACE_TOP - 14, big ? 2 : 1, big ? 10 : 6);
      if (m % 25 === 0) { g.textAlign = 'center'; g.fillText(m + 'm', x, RACE_TOP - 22); }
    }
    /* 스퍼트 구간 — 마지막 20m 가 왜 특별한지 자에 적어 둡니다 */
    const sx = RACE_X0 + (RACE_X1 - RACE_X0) * (RACE_SPURT_M / RACE_M);
    g.fillStyle = 'rgba(255,217,138,.9)'; g.fillRect(sx, RACE_TOP - 6, RACE_X1 - sx, 3);
    g.textAlign = 'left'; g.fillStyle = '#FFD98A'; g.font = F7(11);
    g.fillText('스퍼트', sx + 6, RACE_TOP - 22);

    for (let i = 0; i < lanes.length; i++) {
      const L = lanes[i], y = RACE_TOP + i * RACE_LANE, lh = RACE_LANE - 3;
      g.fillStyle = i % 2 ? '#B84E3A' : '#C4553F'; g.fillRect(0, y, RACE_W, lh);
      /* 우레탄 알갱이 — 민판이면 붉은 종이가 됩니다 */
      g.fillStyle = 'rgba(0,0,0,.05)';
      for (let k = 0; k < 60; k++)
        g.fillRect(RACE_X0 + ((k * 101 + i * 37) % (RACE_X1 - RACE_X0)), y + 3 + ((k * 7 + i * 3) % (lh - 6)), 2, 2);
      g.fillStyle = 'rgba(244,237,228,.5)'; g.fillRect(0, y + lh, RACE_W, 1);
      g.fillStyle = 'rgba(255,217,138,.10)'; g.fillRect(sx, y, RACE_X1 - sx, lh);

      if (L.me) for (const p of R.prints) {
        const px = RACE_X0 + (RACE_X1 - RACE_X0 - 22) * (p.d / RACE_M);
        g.fillStyle = 'rgba(42,24,18,' + Math.max(0, 0.3 - p.t * 0.12).toFixed(2) + ')';
        g.fillRect(px, y + (p.side === 'left' ? 8 : 26), 9, 6);
      }
      /* 이름표 — 왼쪽에 붙박이. 레인 위에 띄우면 달리는 동안 글자가
         같이 움직여서 못 읽습니다. */
      g.fillStyle = L.me ? 'rgba(12,90,79,.94)' : 'rgba(34,42,51,.8)';
      g.fillRect(0, y, RACE_X0 - 12, lh);
      g.fillStyle = L.me ? P.acc : 'rgba(244,237,228,.35)';
      g.fillRect(0, y, 4, lh);
      g.fillStyle = L.me ? '#A8FBF0' : '#FFF6F3';
      g.font = F7(13); g.textAlign = 'left';
      const nm = String(L.nick);
      g.fillText(nm.length > 9 ? nm.slice(0, 8) + '…' : nm, 12, y + lh / 2 - 7);
      g.font = '600 12px ' + P.ff;
      g.fillStyle = L.me ? 'rgba(168,251,240,.78)' : 'rgba(255,246,243,.62)';
      g.fillText(Math.round(L.d) + 'm', 12, y + lh / 2 + 11);
      g.fillStyle = 'rgba(244,237,228,.8)'; g.fillRect(RACE_X0 - 3, y, 2, lh);
      for (let k = 0; k < 5; k++) {
        g.fillStyle = k % 2 ? '#2A2320' : '#F4EDE4';
        g.fillRect(RACE_X1, y + k * 9, 12, 9);
      }

      const rx = RACE_X0 + (RACE_X1 - RACE_X0 - 22) * (L.d / RACE_M);
      if (L.ghost) g.globalAlpha = 0.5;
      const moving = R.phase === 'run' && (L.me ? R.v > 0.4 : L.d > 0 && L.d < RACE_M);
      const sw = moving ? Math.sin(performance.now() / 62 + i * 2) * 5 : 0;
      /* 속도선 — 빠를수록 길어집니다. 내 레인에만 답니다. */
      if (L.me && R.v > 4) {
        g.fillStyle = 'rgba(255,255,255,' + Math.min(0.4, (R.v - 4) / 14).toFixed(2) + ')';
        for (let k = 1; k <= 3; k++) g.fillRect(rx - 12 - k * 14, y + 10 + k * 5, 11, 3);
      }
      g.fillStyle = 'rgba(24,16,12,.42)'; g.fillRect(rx + 1, y + lh - 8, 24, 5);
      g.fillStyle = 'rgba(24,16,12,.55)'; g.fillRect(rx - 2, y + 3, 32, 28);
      g.fillStyle = L.col; g.fillRect(rx + 1, y + 11, 17, 14);
      g.fillStyle = 'rgba(255,255,255,.24)'; g.fillRect(rx + 1, y + 11, 17, 4);
      g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(rx + 1, y + 22, 17, 3);
      g.fillStyle = L.col; g.fillRect(rx + 16, y + 4, 12, 12);
      g.fillStyle = 'rgba(255,255,255,.24)'; g.fillRect(rx + 16, y + 4, 12, 3);
      g.fillStyle = L.col;
      g.fillRect(rx + 18, y - 1, 3, 6); g.fillRect(rx + 24, y - 1, 3, 6);
      g.fillRect(rx - 4, y + 13, 7, 4);
      g.fillRect(rx + 15, y + 13 - sw * 0.4, 6, 4);
      g.fillStyle = 'rgba(24,16,12,.8)'; g.fillRect(rx + 24, y + 8, 3, 3);
      g.fillStyle = L.col;
      g.fillRect(rx + 3, y + 24, 6, 7 + sw);
      g.fillRect(rx + 11, y + 24, 6, 7 - sw);
      g.fillStyle = 'rgba(24,16,12,.55)';
      g.fillRect(rx + 3, y + 30 + sw, 6, 3); g.fillRect(rx + 11, y + 30 - sw, 6, 3);
      g.globalAlpha = 1;
    }

    FX.draw(g);

    /* 신호등 — 출발 전에는 이것만 봅니다. 제자리에·준비·출발이
       빨강·노랑·초록이면 글자를 안 읽어도 몸이 압니다. */
    if (R.phase === 'ready') {
      const mid = H / 2;
      g.fillStyle = 'rgba(34,42,51,.82)'; g.fillRect(0, mid - 46, RACE_W, 92);
      const stepI = R.wait > 1.0 ? 0 : R.wait > 0 ? 1 : 2;
      const LIGHTS = [['#E0483A', '제자리에'], ['#E0AE3C', '준비'], ['#2E9E5B', '출발!']];
      LIGHTS.forEach(([col, label], i) => {
        const cx = RACE_W / 2 - 92 + i * 92;
        disc(g, cx, mid - 8, 26, i === stepI ? col : 'rgba(255,255,255,.14)');
        if (i === stepI) disc(g, cx - 7, mid - 15, 10, 'rgba(255,255,255,.45)');
      });
      g.fillStyle = '#FFFFFF'; g.textAlign = 'center'; g.font = F8(26);
      g.fillText(LIGHTS[stepI][1], RACE_W / 2, mid + 34);
      g.textAlign = 'left';
    }
    if (R.slip > 0) {
      g.fillStyle = 'rgba(224,72,58,' + Math.min(0.34, R.slip).toFixed(2) + ')';
      g.fillRect(0, 0, RACE_W, H);
    }
    g.textBaseline = 'alphabetic';
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  function start() {
    FX.reset();
    R.phase = 'ready'; R.wait = 2.4; R.over = false;
    R.t = 0; R.dist = 0; R.v = 0; R.lastFoot = ''; R.lastStepAt = 0; R.steps = 0;
    R.slip = 0; R.tempo = 0; R.prints = []; R.spurt = false;
    R.won = false; R.done = false; R.time = 0; R.rank = 0;
    R.best = raceBest();
    /* 페이서 기록을 판마다 조금씩 흔듭니다. 늘 같은 초로 들어오면 두 판만에
       "저 셋은 그림" 이라는 게 들통납니다. */
    R.pacers = RACE_PACERS.map((q) => ({ ...q, sec: q.sec + (Math.random() - 0.5) * 1.2, d: 0 }));
    R.last = performance.now();
    setScore(0); setTime('제자리에');
    say(R.best ? '신호를 기다려 주세요. 내 최고 기록은 ' + R.best.toFixed(2) + '초예요.'
               : '신호를 기다려 주세요.');
    paintFeet();
  }

  bL.addEventListener('click', () => step('left'));
  bR.addEventListener('click', () => step('right'));
  /* 화살표와 A·D 를 같이 받습니다. 한 키를 누르고 있으면 자동 반복이
     들어오는데, 같은 발은 안 나가므로 그대로 둡니다. */
  const kd = (e) => {
    const L = e.code === 'ArrowLeft' || e.code === 'KeyA';
    const Rt = e.code === 'ArrowRight' || e.code === 'KeyD';
    if (!L && !Rt) return;
    e.preventDefault(); step(L ? 'left' : 'right');
  };
  addEventListener('keydown', kd);
  teardown = () => removeEventListener('keydown', kd);
  start();
  raf = requestAnimationFrame(loop);
}

/* ---------- ⑧ 연못 낚시 ----------
   2D: startPondFish / fishPress / pondFishTick / drawPondFish / fishBook.
   등급 경계 · 창 좁아지는 폭 · 가중치 누르기(w^(1-0.55x)) 는 원본 그대로입니다.
   도감은 2D 와 **같은 열쇠 · 같은 형식**입니다 — girin.fishbook 에
   잡은 종 이름만 담긴 문자열 배열(중복 없음). */
const FISH_CASTS = 5;
const FISH_NEED = 3;
const FISH_WIN0 = 700;           // 첫 판의 챔질 창(ms)
const FISH_WIN_STEP = 55;        // 던질 때마다 좁아지는 폭
const FISH_PERFECT = 230;        // 이 안이면 완벽. 사람 반응이 0.2초쯤입니다
const FISH_W = 880, FISH_H = 330;
const FISH_SURF = 118;           // 수면 높이
/* 이 월드에 사는 여덟 종에서 이름을 땁니다. w 는 뽑기 가중치입니다. */
const FISH_KINDS = [
  { name: '기린무늬 잉어',   w: 26, col: '#E8AD50', spot: '#9B5B2B' },
  { name: '거북등 붕어',     w: 24, col: '#5CB177', spot: '#2F6B45' },
  { name: '펭귄꼬리 빙어',   w: 18, col: '#4A7FB5', spot: '#22405E' },
  { name: '햄스터볼 복어',   w: 14, col: '#D8A66C', spot: '#8E6440' },
  { name: '개구리알 우렁',   w: 10, col: '#7BB661', spot: '#3F6B32' },
  { name: '고슴도치 성게',   w: 5,  col: '#8A6BC4', spot: '#4E3480' },
  { name: '알파카털 해초',   w: 2,  col: '#E4D3CC', spot: '#B9A99F' },
  { name: '백조깃 은어',     w: 1,  col: '#F4EDE4', spot: '#9AA3AE' },
];
const FISH_GRADE_NAME = ['아슬아슬', '좋아요', '완벽!'];
const FISH_GRADE_COL = ['#E0AE3C', '#2DD4BF', '#FFD98A'];

/** 받침이 있으면 앞 것, 없으면 뒤 것. 이름이 여덟이라 '빙어 을 잡았어요'
    가 그대로 화면에 나왔습니다. */
function josa(word, withJong, withoutJong) {
  const c = String(word).charCodeAt(word.length - 1) - 0xAC00;
  const hasJong = c >= 0 && c <= 11171 && c % 28 !== 0;
  return word + (hasJong ? withJong : withoutJong);
}
function fishBook() {
  const v = ls('girin.fishbook', []);
  return Array.isArray(v) ? v : [];
}
function fishBookAdd(name) {
  const b = fishBook();
  if (b.includes(name)) return;
  b.push(name); lsSet('girin.fishbook', b);
}
const fishBest = () => Number(ls('girin.fish.best', 0)) || 0;
/** 이번 판의 챔질 창. 던진 횟수만큼 좁아집니다(0.70초 → 0.48초). */
const fishWindow = (cast) => Math.max(360, FISH_WIN0 - (cast - 1) * FISH_WIN_STEP);
/** 등급 0(아슬아슬) · 1(좋아요) · 2(완벽). '완벽' 은 절대 시간입니다 —
    창에 비례로 두면 마지막 판의 완벽이 0.13초가 되어 사람이 못 냅니다. */
const fishGrade = (react, win) => (react <= FISH_PERFECT ? 2 : react <= win * 0.7 ? 1 : 0);
/** 등급이 좋을수록 귀한 종. 가중치를 w^(1-0.55x) 로 눌러 폅니다 —
    26:1 이 4.4:1 까지 좁혀집니다. 도감이 실력과 이어지는 자리입니다. */
function pickFish(quality) {
  const x = Math.max(0, Math.min(1, quality || 0));
  const pow = 1 - 0.55 * x;
  const ws = FISH_KINDS.map((f) => Math.pow(f.w, pow));
  let r = Math.random() * ws.reduce((s, v) => s + v, 0);
  for (let i = 0; i < FISH_KINDS.length; i++) { r -= ws[i]; if (r <= 0) return FISH_KINDS[i]; }
  return FISH_KINDS[0];
}

function pondFish(body) {
  body.className = 'gbody';
  const P = pal();
  const cv = document.createElement('canvas');
  cv.style.cssText = `width:100%;aspect-ratio:${FISH_W}/${FISH_H};display:block;`
    + 'cursor:pointer;touch-action:manipulation';
  body.appendChild(cv);
  const btn = gbtn('던지기 · 채기 (Space)');
  btn.style.width = '100%';
  body.appendChild(btn);
  const say = sayLine(body, '던져 보세요.');
  const note = document.createElement('p');
  note.style.cssText = 'margin:0;font:600 11px/1.5 inherit;color:var(--ink2);opacity:.75;'
    + 'text-align:center;max-width:520px';
  body.appendChild(note);
  const paintNote = () => {
    note.textContent = `챈 시간이 0.23초 안이면 완벽이고, 등급이 좋을수록 귀한 종이 걸립니다. `
      + `던질수록 창이 좁아져요(0.70초 → 0.48초). 도감 ${fishBook().length} / ${FISH_KINDS.length}종`
      + (fishBest() ? ` · 가장 빠른 챔질 ${fishBest()}ms` : '');
  };

  const F = { phase: 'idle', at: 0, biteAt: 0, nibbleAt: [], cast: 0, got: 0,
              last: '', bag: [], done: false, bob: 0, react: 0, grade: '',
              win: FISH_WIN0, resultAt: 0, shake: 0, overAt: 0 };

  /** Space 와 단추가 같이 부릅니다. 상태에 따라 던지기이기도 하고
      채기이기도 합니다 — 조작이 하나면 무엇을 눌러야 할지 고민할 것이 없습니다. */
  function press() {
    if (F.done) return;
    const now = performance.now();
    if (F.phase === 'idle' || F.phase === 'result') {
      if (F.cast >= FISH_CASTS) return;
      F.cast++; F.phase = 'wait'; F.last = ''; F.grade = ''; F.react = 0;
      F.win = fishWindow(F.cast);
      /* 기다리는 시간을 매번 다르게 둡니다. 일정하면 초를 세는 게임이 되고,
         그러면 찌를 안 보게 됩니다. */
      F.at = now + 1500 + Math.random() * 2400;
      /* 톡톡 — 잠기기 0.9초와 0.55초 전. 예고가 없으면 반사신경 시험이 됩니다. */
      F.nibbleAt = [F.at - 900, F.at - 550];
      FX.puff(430, FISH_SURF, 'rgba(230,246,252,.9)', 7);
      say('던졌어요. 찌를 보세요 — 톡톡 두 번 뒤에 잠깁니다.');
      setTime(Math.max(0, FISH_CASTS - F.cast) + '번 남음');
      return;
    }
    if (F.phase === 'wait') {
      /* 헛챔질. 얼마나 일렀는지를 말해 줍니다 — 벌만 주고 이유를 안
         알려 주면 다음 판도 똑같이 틀립니다. */
      const early = Math.max(0, F.at - now) / 1000;
      F.phase = 'result'; F.resultAt = now; F.grade = 'early'; F.shake = 0.3;
      FX.say(430, FISH_SURF - 20, '헛챔질', '#E0483A', 22);
      say('잠기기 ' + early.toFixed(1) + '초 전이었어요. 톡톡 뒤 한 박자 더 기다려 주세요.');
      return after();
    }
    if (F.phase === 'bite') {
      F.react = Math.round(now - F.biteAt);
      const gi = fishGrade(F.react, F.win);
      const f = pickFish(gi / 2);
      F.got++; F.bag.push(f.name); F.last = f.name;
      F.grade = String(gi);
      fishBookAdd(f.name);
      const prev = fishBest();
      if (!prev || F.react < prev) lsSet('girin.fish.best', F.react);
      F.phase = 'result'; F.resultAt = now; F.shake = 0.18 + gi * 0.12;
      FX.burst(430, FISH_SURF, 'rgba(214,240,250,.95)', 12 + gi * 6, 150);
      FX.say(430, FISH_SURF - 26, FISH_GRADE_NAME[gi], FISH_GRADE_COL[gi], 24 + gi * 3);
      say(FISH_GRADE_NAME[gi] + ' ' + F.react + 'ms — ' + josa(f.name, '을', '를') + ' 잡았어요!');
      setScore(F.got); paintNote();
      return after();
    }
  }
  function after() { if (F.cast >= FISH_CASTS) finish(); }

  function finish() {
    F.done = true; F.overAt = performance.now();
    const won = F.got >= FISH_NEED;
    /* 같은 종을 다섯 번 잡으면 이름이 다섯 번 나와 칸을 넘칩니다.
       세어서 한 줄로 줄입니다. */
    const tally = new Map();
    for (const n of F.bag) tally.set(n, (tally.get(n) || 0) + 1);
    const line = [...tally].map(([n, c]) => (c > 1 ? n + ' x' + c : n)).join(' · ');
    /* 2D 는 세 마리부터 코인입니다 — 못 채운 판은 0 점입니다. */
    setScore(won ? F.got : 0);
    if (won) {
      FX.burst(FISH_W / 2, FISH_H / 2, '#FFE9A8', 26, 200);
      say('세 마리를 채웠어요.');
    } else {
      say(F.got + '마리로 끝났어요. 세 마리부터예요 — 톡톡 뒤 잠기는 순간이에요.');
    }
    paintNote();
    over(F.got + '마리', F.bag.length ? line : '한 마리도 못 잡았어요', start);
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - F.bob) / 1000);
    F.bob = now;
    F.shake = Math.max(0, F.shake - dt * 2.2);
    FX.update(dt);
    if (!F.done) {
      if (F.phase === 'wait' && now >= F.at) {
        F.phase = 'bite'; F.biteAt = now;
        FX.puff(430, FISH_SURF, 'rgba(230,246,252,.95)', 9);
        say('지금 채세요!');
      } else if (F.phase === 'bite' && now - F.biteAt > F.win) {
        F.phase = 'result'; F.resultAt = now; F.last = ''; F.grade = 'miss';
        FX.say(430, FISH_SURF - 20, '놓쳤어요', '#9AA3AE', 22);
        say('놓쳤어요. 찌가 잠긴 뒤 ' + (F.win / 1000).toFixed(2) + '초 안이에요.');
        after();
      }
    }
    draw();
  }

  /* 데크에 서서 물을 내려다보는 그림입니다. 위에서부터 돌 둘레 · 나무
     데크 · 물. 물은 아래로 갈수록 짙어지고, 빛은 왼쪽 위에서 옵니다. */
  function draw() {
    const g = fitCv(cv, FISH_W, FISH_H);
    if (!g) return;
    const W = FISH_W, H = FISH_H;
    if (F.shake > 0) g.translate((Math.random() - 0.5) * F.shake * 10, (Math.random() - 0.5) * F.shake * 7);

    g.fillStyle = '#8C99A6'; g.fillRect(0, 0, W, 40);
    g.fillStyle = '#A7B3BE'; g.fillRect(0, 0, W, 28);
    g.fillStyle = '#6F7C88';
    for (let x = 6; x < W; x += 38) g.fillRect(x, 9, 26, 19);
    g.fillStyle = '#C4CDD5';
    for (let x = 6; x < W; x += 38) g.fillRect(x, 9, 26, 3);
    g.fillStyle = '#6F9E5C';
    for (let x = 14; x < W; x += 51) g.fillRect(x, 31, 10, 9);
    /* 나무 데크 — 널 여덟 장. 널이 가로로 길어 판이 넓어진 것이 보입니다. */
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#A97A4C' : '#B98756';
      g.fillRect(0, 40 + i * 8, W, 8);
      g.fillStyle = '#8A6039'; g.fillRect(0, 46 + i * 8, W, 1);
    }
    g.fillStyle = '#C79A6B'; g.fillRect(0, 40, W, 2);
    g.fillStyle = '#7A5637'; g.fillRect(0, 104, W, 6);
    g.fillStyle = '#5E4028'; g.fillRect(0, 108, W, 3);
    g.fillStyle = '#6B4A2E';
    for (let x = 40; x < W; x += 120) { g.fillRect(x, 52, 3, 3); g.fillRect(x, 92, 3, 3); }

    const w = g.createLinearGradient(0, FISH_SURF - 8, 0, H);
    w.addColorStop(0, '#6BC3D8'); w.addColorStop(0.45, '#3E93B4'); w.addColorStop(1, '#0F4257');
    g.fillStyle = w; g.fillRect(0, 111, W, H - 111);
    g.fillStyle = 'rgba(255,255,255,.24)'; g.fillRect(0, 111, W, 3);
    /* 빛줄기 — 이 한 겹이 없으면 물이 파란 판입니다. */
    for (let i = 0; i < 5; i++) {
      const x = 90 + i * 165 + Math.sin(F.bob / 2200 + i) * 12;
      g.fillStyle = 'rgba(255,255,255,.055)';
      g.beginPath();
      g.moveTo(x, 114); g.lineTo(x + 34, 114); g.lineTo(x + 128, H); g.lineTo(x + 62, H);
      g.closePath(); g.fill();
    }
    /* 물결 — 층마다 다른 속도로 흘러야 물이 깊어 보입니다 */
    for (let i = 0; i < 11; i++) {
      const y = 128 + i * 18, sp = 26 + (i % 3) * 16;
      const x = ((i * 137 + F.bob / sp) % (W + 140)) - 140;
      g.fillStyle = 'rgba(255,255,255,' + (0.15 - i * 0.008).toFixed(3) + ')';
      g.fillRect(x, y, 72, 3); g.fillRect(x + 96, y, 34, 3);
    }
    for (let x = 24; x < W; x += 71) {
      const sway = Math.sin(F.bob / 700 + x) * 3;
      g.fillStyle = 'rgba(16,66,54,.45)';
      g.fillRect(x, H - 44, 5, 44);
      g.fillRect(x + 8 + sway, H - 32, 5, 32);
      g.fillStyle = 'rgba(30,96,78,.5)'; g.fillRect(x + 16, H - 24, 4, 24);
    }
    /* 물속 그림자 — 뭔가 살고 있어야 못이 됩니다. 미끼와는 무관합니다. */
    g.fillStyle = 'rgba(8,40,56,.3)';
    for (let i = 0; i < 6; i++) {
      const y = 176 + (i % 3) * 48, sp = i % 2 ? 34 : 46;
      const x = ((i * 191 - F.bob / sp) % (W + 160) + W + 160) % (W + 160) - 80;
      g.fillRect(x, y, 34, 10); g.fillRect(x - 9, y + 3, 10, 5);
    }
    [[120, 132], [760, 146]].forEach(([lx, ly], i) => {
      const sw = Math.sin(F.bob / 800 + i) * 2;
      g.fillStyle = '#2F6B45'; g.beginPath(); g.ellipse(lx, ly + sw, 44, 13, 0, 0, 7); g.fill();
      g.fillStyle = '#4E9E63'; g.beginPath(); g.ellipse(lx, ly - 3 + sw, 42, 12, 0, 0, 7); g.fill();
      g.fillStyle = '#3F8F5C'; g.fillRect(lx - 3, ly - 8 + sw, 24, 3);
    });

    /* 낚싯대 — 끝이 휘어야 낚싯대입니다. 데크와 색이 비슷해서 어두운 테를
       한 겹 두르지 않으면 널 위에 그은 선으로 보입니다. */
    const bite = F.phase === 'bite';
    const pull = bite ? 12 : 0;
    const rodAt = (t) => ({ x: 66 + t * 338, y: 100 - t * 56 - Math.sin(t * Math.PI) * 20 + pull * t * t });
    for (const pass of [0, 1]) {
      for (let k = 0; k <= 60; k++) {
        const t = k / 60, q = rodAt(t), th = (10 - t * 5.5) + (pass ? 0 : 4);
        g.fillStyle = pass ? (t > 0.62 ? '#B98756' : '#8A6039') : '#4A3323';
        g.fillRect(q.x - th / 2, q.y - th / 2, th, th);
      }
    }
    disc(g, 92, 100, 13, '#5F6874');
    disc(g, 92, 100, 9, '#98A2AD');
    disc(g, 89, 97, 4, '#C2CAD2');
    g.fillStyle = '#4A3323'; g.fillRect(40, 96, 34, 14);
    g.fillStyle = '#6B4A2E'; g.fillRect(42, 98, 30, 8);
    g.fillStyle = '#8A6039'; g.fillRect(42, 98, 30, 2);

    /* 찌 — 여기가 이 게임의 전부라 제일 크게 그립니다. */
    const fx = 430;
    let fy = FISH_SURF + 6;
    if (F.phase === 'wait') {
      fy += Math.sin(F.bob / 300) * 3;
      for (const t of F.nibbleAt) {
        const d = F.bob - t;
        if (d >= 0 && d < 260) fy += Math.sin((d / 260) * Math.PI) * 11;
      }
      /* 물밑 그림자 — 잠기기 전 1초 동안 올라옵니다. 눈이 여기에 붙습니다. */
      const near = 1 - Math.max(0, Math.min(1, (F.at - F.bob) / 1000));
      if (near > 0) {
        g.fillStyle = 'rgba(8,40,56,' + (0.18 + near * 0.3).toFixed(2) + ')';
        const sy = 286 - near * 132;
        g.fillRect(fx - 30, sy, 54, 15); g.fillRect(fx - 44, sy + 5, 15, 7);
      }
    } else if (bite) {
      const d = Math.min(1, (F.bob - F.biteAt) / 140);
      fy += 46 * (1 - Math.pow(1 - d, 3));      // 쑥 — 뒤로 갈수록 느려집니다
    }
    g.strokeStyle = 'rgba(250,250,255,.9)'; g.lineWidth = 2;
    const tip = rodAt(1);
    g.beginPath(); g.moveTo(tip.x, tip.y); g.lineTo(fx + 6, fy - 20); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,' + (bite ? 0.9 : 0.42) + ')';
    g.lineWidth = bite ? 3 : 2;
    for (let r = 1; r <= 3; r++) {
      const grow = ((F.bob / (bite ? 90 : 260) + r * 0.8) % 3) + 0.4;
      g.beginPath();
      g.ellipse(fx + 6, FISH_SURF + 14, grow * (bite ? 30 : 15), grow * (bite ? 8 : 5), 0, 0, 7);
      g.stroke();
    }
    g.fillStyle = '#2A2320'; g.fillRect(fx, fy - 6, 13, 28);
    g.fillStyle = '#F4EDE4'; g.fillRect(fx - 4, fy - 24, 21, 19);
    g.fillStyle = '#D8D2CC'; g.fillRect(fx + 11, fy - 24, 6, 19);
    g.fillStyle = '#D8442C'; g.fillRect(fx - 4, fy - 42, 21, 19);
    g.fillStyle = '#F08A78'; g.fillRect(fx - 4, fy - 42, 21, 4);
    g.fillStyle = '#9B2E1C'; g.fillRect(fx + 11, fy - 42, 6, 37);

    /* 잡은 물고기 — 이름표만 뜨면 "숫자가 올라갔다" 이고, 튀어 오르면
       "잡았다" 입니다. */
    if (F.phase === 'result' && F.last) {
      const t = Math.min(1, (F.bob - F.resultAt) / 420);
      const rise = 1 - Math.pow(1 - t, 3);
      const k = FISH_KINDS.find((q) => q.name === F.last) || FISH_KINDS[0];
      const cx = 636, cy = 282 - rise * 138, tilt = (1 - rise) * 0.5;
      g.save(); g.translate(cx, cy); g.rotate(-tilt);
      /* 몸통은 위아래가 좁아지는 줄로 쌓습니다 — 네모로 그리면 물고기로
         안 읽힙니다. 물빛과 겹치는 종이 있어 테두리를 먼저. */
      const rows = [6, 12, 18, 24, 28, 32, 34, 34, 32, 28, 24, 18, 12, 6];
      rows.forEach((wRow, i) => {
        g.fillStyle = 'rgba(12,40,52,.8)';
        g.fillRect(-(wRow * 1.5) - 3, -21 + i * 3 - 1, wRow * 3 + 6, 5);
      });
      rows.forEach((wRow, i) => {
        const x = -(wRow * 1.5), y = -21 + i * 3;
        g.fillStyle = k.col; g.fillRect(x, y, wRow * 3, 3);
        g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x, y, wRow * 3, 1);
      });
      g.fillStyle = 'rgba(12,40,52,.8)'; g.fillRect(-72, -14, 22, 28);
      g.fillStyle = k.col; g.fillRect(-68, -10, 18, 20); g.fillRect(-72, -4, 6, 8);
      g.fillStyle = k.spot;
      [[-24, -6], [-2, 4], [18, -10]].forEach(([a, b]) => g.fillRect(a, b, 11, 9));
      g.fillStyle = '#FFF6F3'; g.fillRect(36, -6, 10, 10);
      g.fillStyle = '#2A2320'; g.fillRect(39, -3, 5, 5);
      g.restore();
      g.fillStyle = 'rgba(34,42,51,.9)'; g.fillRect(cx - 96, cy + 34, 192, 30);
      g.fillStyle = '#FFF6F3'; g.font = F7(16);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(k.name, cx, cy + 49);
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    }

    /* 챔질 자 — "완벽" 이 왜 완벽인지 눈으로 한 번 더 말해 주는 자리입니다. */
    if (F.phase === 'result' && F.grade !== '' && F.grade !== 'early' && F.grade !== 'miss') {
      const bw = 300, bx = W - bw - 26, by = H - 54;
      g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(bx - 8, by - 22, bw + 16, 44);
      g.fillStyle = '#D8D2CC'; g.fillRect(bx, by, bw, 12);
      g.fillStyle = '#FFD98A'; g.fillRect(bx, by, bw * (FISH_PERFECT / F.win), 12);
      g.fillStyle = P.acc;
      g.fillRect(bx + bw * (FISH_PERFECT / F.win), by, bw * (0.7 - FISH_PERFECT / F.win), 12);
      g.fillStyle = P.ink; g.fillRect(bx + bw * Math.min(1, F.react / F.win) - 2, by - 6, 4, 24);
      g.font = F7(12); g.textBaseline = 'middle';
      g.fillText(F.react + 'ms / ' + F.win + 'ms', bx, by - 12);
      g.textBaseline = 'alphabetic';
    }

    FX.draw(g);

    /* 지금 뭘 해야 하는지 — 캔버스 안에도 한 줄. 아래 글만 보면 찌에서
       눈을 떼야 하고, 그 사이에 판이 끝납니다. */
    g.fillStyle = bite ? 'rgba(224,72,58,.94)' : 'rgba(34,42,51,.66)';
    g.fillRect(0, 0, W, 24);
    g.fillStyle = '#FFFFFF'; g.font = F7(14); g.textBaseline = 'middle';
    g.fillText(bite ? '지금 채세요!' : F.phase === 'wait' ? '기다리는 중… 톡톡 두 번 뒤에 잠깁니다'
               : F.done ? '끝났어요' : '던지려면 Space', 12, 12);
    g.textAlign = 'right';
    g.fillText(F.got + ' / ' + FISH_NEED + '마리 · ' + Math.max(0, FISH_CASTS - F.cast) + '번 남음 · 창 '
               + (fishWindow(Math.min(FISH_CASTS, F.cast + 1)) / 1000).toFixed(2) + '초', W - 12, 12);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  function start() {
    FX.reset();
    F.phase = 'idle'; F.done = false;
    F.cast = 0; F.got = 0; F.bag = []; F.last = '';
    F.at = 0; F.biteAt = 0; F.nibbleAt = []; F.react = 0; F.grade = '';
    F.win = FISH_WIN0; F.resultAt = 0; F.shake = 0;
    F.bob = performance.now();
    setScore(0); setTime(FISH_CASTS + '번 남음');
    say('던져 보세요.'); paintNote();
  }

  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });
  btn.addEventListener('click', press);
  const kd = (e) => { if (e.code === 'Space') { e.preventDefault(); press(); } };
  addEventListener('keydown', kd);
  teardown = () => removeEventListener('keydown', kd);
  start();
  raf = requestAnimationFrame(loop);
}

/* ---------- ⑨ 책 정리 ----------
   2D: startBookSort / bookDeal / pickBook.
   청구기호는 KDC 꼴입니다 — 분류번호가 먼저, 같으면 저자기호.
   도서관에서 실제로 꽂는 순서 그대로라 규칙을 따로 배울 것이 없습니다.

   2D 는 책등을 DOM 으로 그렸지만(writing-mode 세로쓰기 + @keyframes),
   여기서는 캔버스입니다. index.html 은 손대지 않기로 했고, 책등에 붙일
   클래스가 3D 판 CSS 에 없기 때문입니다. 세로쓰기는 글자를 한 자씩
   쌓아서 흉내 냅니다. */
const BOOK_ROUNDS = 3;
const BOOK_MS = 90000;
const BOOK_PENALTY = 3000;       // 틀리면 3초. 못 꽂는 벌은 안 줍니다
const BOOK_PER_ROUND = [4, 5, 6];   // 늘어나는 것이 곧 난이도 곡선입니다
/* 제목은 일곱 자 안쪽입니다 — 책등에 세로로 한 줄로 서야 하는데,
   길면 접히면서 읽는 순서가 뒤엉킵니다. */
const BOOK_POOL = [
  { n: '026.4', a: '김72ㄷ', t: '도서관 안내' },
  { n: '182.1', a: '박43ㅈ', t: '집중의 기술' },
  { n: '325.2', a: '이55ㅅ', t: '시간 관리법' },
  { n: '411.8', a: '정31ㅌ', t: '통계 첫걸음' },
  { n: '512.6', a: '최09ㅁ', t: '목 해부학' },
  { n: '513.4', a: '한27ㅇ', t: '앉는 사람들' },
  { n: '513.4', a: '한27ㅈ', t: '일어나기' },
  { n: '517.2', a: '윤66ㅅ', t: '생활 스트레칭' },
  { n: '598.3', a: '서14ㅋ', t: '책상 앞 자세' },
  { n: '658.9', a: '노88ㅍ', t: '픽셀 그리기' },
  { n: '701.3', a: '강20ㅎ', t: '한국어 문법' },
  { n: '813.7', a: '문95ㄱ', t: '기린의 목' },
  { n: '818.2', a: '오03ㄴ', t: '느린 거북' },
  { n: '911.5', a: '배77ㅅ', t: '서울의 대학' },
  { n: '982.1', a: '류61ㅇ', t: '도서관 기행' },
];
const BOOK_COLORS = ['#D8442C', '#E8C34A', '#3F8F5C', '#4A7FB5', '#8A6BC4', '#E4805A'];
const BOOK_W = 880, BOOK_H = 330;

/** 꽂는 순서 — 분류번호가 먼저, 같으면 저자기호. */
const bookOrder = (x, y) => (Number(x.n) - Number(y.n)) || (x.a < y.a ? -1 : x.a > y.a ? 1 : 0);
/** 같은 분류번호를 나눠 갖는 짝. 저자기호 규칙은 짝이 있어야만 쓸 일이 생깁니다. */
function bookTwins() {
  const by = new Map();
  for (const b of BOOK_POOL) by.set(b.n, (by.get(b.n) || []).concat([b]));
  return [...by.values()].filter((gp) => gp.length > 1);
}
function bookShuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
/** 칸 하나를 뽑습니다. round 는 0·1·2.
    1칸은 앞자리가 다 다른 것만 고릅니다 — 첫 칸에서 소수점을 읽게 하면
    규칙을 배우기 전에 지칩니다. */
function bookDeal(round) {
  const n = BOOK_PER_ROUND[round] || 5;
  let pick = [];
  if (round === 0) {
    const byHead = new Map();
    for (const b of bookShuffle(BOOK_POOL.slice())) if (!byHead.has(b.n[0])) byHead.set(b.n[0], b);
    pick = bookShuffle([...byHead.values()]).slice(0, n);
  } else {
    const twins = bookTwins();
    const pair = twins[(Math.random() * twins.length) | 0] || [];
    pick = pair.slice(0, 2);
    let rest = BOOK_POOL.filter((b) => !pick.includes(b));
    /* 3칸은 나머지도 같은 백의 자리로 모읍니다. 500 번대가 이 표에서
       가장 두꺼워(512·513·513·517) 소수점을 꼭 읽어야 하는 칸이 됩니다. */
    if (round === 2) {
      const head = pick[0] ? pick[0].n[0] : '5';
      const near = bookShuffle(rest.filter((b) => b.n[0] === head));
      pick = pick.concat(near.slice(0, n - pick.length));
      rest = rest.filter((b) => !pick.includes(b));
    }
    pick = pick.concat(bookShuffle(rest).slice(0, Math.max(0, n - pick.length)));
  }
  /* 섞습니다. 뽑은 순서대로 두면 가끔 이미 정렬된 판이 나옵니다. */
  return bookShuffle(pick).map((b, i) => ({ ...b, col: BOOK_COLORS[i % BOOK_COLORS.length] }));
}

function bookSort(body) {
  body.className = 'gbody';
  const P = pal();
  const cv = document.createElement('canvas');
  cv.style.cssText = `width:100%;aspect-ratio:${BOOK_W}/${BOOK_H};display:block;`
    + 'cursor:pointer;touch-action:manipulation';
  body.appendChild(cv);
  const say = sayLine(body, '가장 작은 번호부터 눌러 주세요.');
  const note = document.createElement('p');
  note.style.cssText = 'margin:0;font:600 11px/1.5 inherit;color:var(--ink2);opacity:.75;'
    + 'text-align:center;max-width:520px';
  note.textContent = '틀려도 책은 그대로 있어요 — 시간만 3초 줄어듭니다. 칸이 올라갈수록 '
    + '권수가 늘고(4 · 5 · 6권), 2칸부터는 번호가 같은 책이 섞여요. 그때는 저자기호를 보셔야 해요.';
  body.appendChild(note);

  const B = { round: 0, cart: [], shelf: [], wrong: 0, roundWrong: 0, streak: 0,
              done: false, endAt: 0, placed: -1, placedAt: 0, no: -1, noAt: 0,
              flash: 0, hits: [], swap: 0, total: 0 };

  /* 캔버스 자리들. 책장과 카트를 나란히 놓습니다 — 위아래로 쌓으면
     책장 한 줄이 880px 을 가로지르는데 그 안에 든 책은 여섯 권뿐이라
     나무판만 넓어집니다. */
  const CASE_X = 18, CASE_W = 420, CART_X = 458, CART_W = 404;
  const TOP = 40, FLOOR = 244, SPW = 56, SPG = 6;

  function spine(g, b, x, h, opt) {
    const y = FLOOR - h;
    const shake = opt && opt.shake ? Math.sin(opt.shake * 40) * 5 : 0;
    const lift = opt && opt.lift ? opt.lift : 0;
    g.save();
    g.translate(x + shake, y - lift);
    g.fillStyle = 'rgba(34,42,51,.28)'; g.fillRect(2, 4, SPW, h);      // 접지 그림자
    g.fillStyle = b.col; g.fillRect(0, 0, SPW, h);
    /* 빛은 왼쪽 위 — 왼쪽 모서리가 밝고 오른쪽이 어둡습니다 */
    g.fillStyle = 'rgba(255,255,255,.26)'; g.fillRect(0, 0, 4, h);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, SPW, 4);
    g.fillStyle = 'rgba(0,0,0,.32)'; g.fillRect(SPW - 6, 0, 6, h);
    /* 제목은 세로쓰기 — 실제 책등이 그렇고, 가로로 쓰면 52px 안에서 뭉개집니다 */
    g.fillStyle = '#FFF6F3'; g.font = F7(13);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let ty = 16;
    for (const ch of String(b.t)) {
      if (ch === ' ') { ty += 6; continue; }
      g.fillText(ch, SPW / 2, ty); ty += 14;
    }
    /* 아래 흰 딱지 — 도서관 라벨이 붙는 자리 그대로입니다 */
    g.fillStyle = '#FFF6F3'; g.fillRect(3, h - 34, SPW - 6, 30);
    g.fillStyle = P.ink; g.font = F7(10);
    g.fillText(b.n, SPW / 2, h - 24);
    g.fillText(b.a, SPW / 2, h - 11);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.restore();
  }

  function draw() {
    const g = fitCv(cv, BOOK_W, BOOK_H);
    if (!g) return;
    const now = performance.now();
    g.fillStyle = P.paper; g.fillRect(0, 0, BOOK_W, BOOK_H);
    const ri = Math.min(B.round, BOOK_ROUNDS - 1);

    /* 머리말 두 줄 */
    g.font = '800 12px ' + P.ff; g.fillStyle = P.ink2; g.textBaseline = 'alphabetic';
    g.fillText('책장  ' + (B.done && B.round >= BOOK_ROUNDS ? BOOK_ROUNDS + '칸 다 채움'
               : (ri + 1) + '칸 · ' + BOOK_PER_ROUND[ri] + '권'), CASE_X + 2, 26);
    g.fillText('반납 카트  작은 번호부터', CART_X + 2, 26);
    if (B.streak >= 3) {
      g.fillStyle = P.acc2; g.textAlign = 'right';
      g.fillText(B.streak + '권 연속 정답', CASE_X + CASE_W - 2, 26);
      g.textAlign = 'left';
    }

    /* 책장 — 뒤판 · 옆판 · 선반. 널 하나만 그리면 벽에 책을 세워 둔
       그림이 되고, 그러면 도서관으로 안 읽힙니다. */
    const cs = g.createLinearGradient(0, TOP, 0, FLOOR);
    cs.addColorStop(0, '#7C563A'); cs.addColorStop(0.42, '#63432C'); cs.addColorStop(1, '#543824');
    g.fillStyle = cs; g.fillRect(CASE_X, TOP, CASE_W, FLOOR - TOP);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(CASE_X, TOP, CASE_W, 3);
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(CASE_X + CASE_W - 5, TOP, 5, FLOOR - TOP);
    g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(CASE_X, TOP, 5, FLOOR - TOP);
    /* 선반 널 — 아래 어두운 접지 그림자가 있어야 책이 널에 놓입니다 */
    const pk = g.createLinearGradient(0, FLOOR, 0, FLOOR + 15);
    pk.addColorStop(0, '#8A6039'); pk.addColorStop(1, '#4A3323');
    g.fillStyle = pk; g.fillRect(CASE_X, FLOOR, CASE_W, 15);
    g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(CASE_X, FLOOR, CASE_W, 3);
    /* 카트 */
    const ct = g.createLinearGradient(0, TOP, 0, FLOOR + 15);
    ct.addColorStop(0, '#9A8E88'); ct.addColorStop(1, '#7A6E68');
    g.fillStyle = ct; g.fillRect(CART_X, TOP, CART_W, FLOOR + 15 - TOP);
    g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(CART_X, TOP, CART_W, 3);

    /* 꽂힌 책 + 빈 홈. 몇 권이 더 들어가는지가 보여야 "이 칸이 얼마나
       남았나" 를 세지 않고 압니다. */
    const slots = Math.max(0, BOOK_PER_ROUND[ri] - B.shelf.length);
    const nCase = B.shelf.length + slots;
    let x = CASE_X + (CASE_W - (nCase * SPW + Math.max(0, nCase - 1) * SPG)) / 2;
    B.shelf.forEach((b, i) => {
      const h = 132 + (i % 3) * 10;
      /* 방금 꽂힌 책은 위에서 떨어집니다 — 바로 나타나면 꽂았다는 느낌이 없습니다 */
      const k = i === B.placed ? Math.max(0, 1 - (now - B.placedAt) / 300) : 0;
      spine(g, b, x, h, { lift: k * k * 38 });
      x += SPW + SPG;
    });
    for (let i = 0; i < slots; i++) {
      g.fillStyle = 'rgba(0,0,0,.16)';
      g.fillRect(x, FLOOR - 138, SPW, 138);
      g.fillStyle = 'rgba(0,0,0,.10)';
      for (let k = -138; k < SPW; k += 12) g.fillRect(x + Math.max(0, k), FLOOR - 138 + Math.max(0, -k), 6, 6);
      x += SPW + SPG;
    }

    /* 카트의 책 — 여기만 누를 수 있습니다 */
    B.hits = [];
    const nCart = B.cart.length;
    let cx = CART_X + (CART_W - (nCart * SPW + Math.max(0, nCart - 1) * SPG)) / 2;
    B.cart.forEach((b, i) => {
      const h = 132 + (i % 3) * 10;
      const sh = i === B.no ? Math.max(0, 0.22 - (now - B.noAt) / 1000) : 0;
      spine(g, b, cx, h, { shake: sh });
      B.hits.push({ i, x: cx, y: FLOOR - h, w: SPW, h });
      cx += SPW + SPG;
    });
    if (!nCart) {
      g.fillStyle = 'rgba(255,246,243,.8)'; g.font = F7(13);
      g.textAlign = 'center';
      g.fillText(B.done ? '카트가 비었어요. 수고했어요!' : '카트가 비었어요.', CART_X + CART_W / 2, (TOP + FLOOR) / 2);
      g.textAlign = 'left';
    }

    /* 아래 한 줄 — 남은 권수 · 틀린 횟수. 시간은 HUD 가 들고 있습니다. */
    g.font = F7(12.5);
    g.fillStyle = B.flash > 0 ? P.bad : P.ink2;
    const left = Math.max(0, B.endAt - Date.now());
    g.fillText('정리한 칸 ' + Math.min(B.round, BOOK_ROUNDS) + ' / ' + BOOK_ROUNDS
               + '   ·   이 칸 남은 권수 ' + B.cart.length + '권'
               + '   ·   틀린 횟수 ' + B.wrong + '번'
               + '   ·   남은 시간 ' + mmss(left), CASE_X + 2, BOOK_H - 14);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** 카트에서 한 권 고르기. 남은 것 중 가장 작은 것이면 꽂히고, 아니면
      시간만 깎입니다 — 책을 뺏지는 않습니다. */
  function pick(i) {
    if (B.done || B.swap) return;
    const b = B.cart[i];
    if (!b) return;
    const first = B.cart.slice().sort(bookOrder)[0];
    if (b !== first) {
      B.wrong++; B.roundWrong++; B.streak = 0; B.endAt -= BOOK_PENALTY;
      B.no = i; B.noAt = performance.now(); B.flash = 0.42;
      /* 처음 틀리면 방향만, 같은 칸에서 두 번째부터 답을 짚습니다.
         헤매는 사람은 건지고, 찍는 사람에게는 답을 안 팝니다. */
      say(B.roundWrong >= 2
        ? '아직이에요 — ' + first.n + ' ' + first.a + ' 먼저!'
        : (Number(b.n) > Number(first.n)
            ? '더 작은 번호가 카트에 남아 있어요.'
            : '번호는 맞는데 저자기호가 뒤예요 — ' + first.a + ' 가 먼저예요.'));
      return;
    }
    B.cart.splice(i, 1);
    B.shelf.push(b);
    B.placed = B.shelf.length - 1; B.placedAt = performance.now();
    B.streak++; B.total++; B.no = -1;
    setScore(B.total);
    if (B.cart.length) { say(B.streak >= 3 ? B.streak + '권 연속! 다음은?' : '좋아요. 다음은?'); return; }
    B.round++;
    if (B.round >= BOOK_ROUNDS) return finish(true);
    say(B.round + '칸 끝! 다음 칸은 ' + BOOK_PER_ROUND[B.round] + '권이에요'
        + (B.round >= 1 ? ' — 번호가 같은 책이 섞여 있어요.' : '.'));
    B.roundWrong = 0;
    /* 칸이 끝나면 잠깐 두었다가 다음 칸이 옵니다. 바로 갈아치우면
       방금 다 채운 칸을 못 보고 넘어갑니다. */
    B.swap = setTimeout(() => {
      B.swap = 0;
      if (B.done) return;
      B.shelf = []; B.cart = bookDeal(B.round); B.placed = -1;
    }, 520);
  }

  function finish(won) {
    if (B.done) return;
    B.done = true;
    if (B.swap) { clearTimeout(B.swap); B.swap = 0; }
    const left = Math.max(0, B.endAt - Date.now());
    setTime(won ? mmss(left) : '0:00');
    if (won) {
      say((left / 1000).toFixed(1) + '초 남기고 · 틀린 횟수 ' + B.wrong + '번.');
      over(BOOK_ROUNDS + '칸 정리 끝!',
           (left / 1000).toFixed(1) + '초 남김 · 틀린 횟수 ' + B.wrong + '번', start);
    } else {
      /* 2D 는 세 칸을 다 채워야 코인입니다 — 시간이 끝난 판은 0 점입니다. */
      setScore(0);
      say('시간이 다 됐어요. 번호 앞자리부터 보면 훨씬 빨라요 — 같은 번호일 때만 저자기호를 봅니다.');
      over('시간이 다 됐어요',
           Math.min(B.round, BOOK_ROUNDS) + ' / ' + BOOK_ROUNDS + '칸 · 꽂은 책 ' + B.total + '권', start);
    }
  }

  let bLast = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - bLast) / 1000);
    bLast = now;
    if (!B.done) {
      const left = B.endAt - Date.now();
      setTime(mmss(left));
      if (left <= 0) finish(false);
    }
    B.flash = Math.max(0, B.flash - dt);
    draw();
  }

  function start() {
    if (B.swap) { clearTimeout(B.swap); B.swap = 0; }
    B.round = 0; B.wrong = 0; B.roundWrong = 0; B.streak = 0; B.done = false;
    B.placed = -1; B.no = -1; B.flash = 0; B.total = 0;
    B.shelf = []; B.cart = bookDeal(0);
    B.endAt = Date.now() + BOOK_MS;
    bLast = performance.now();
    setScore(0); setTime(mmss(BOOK_MS));
    say('가장 작은 번호부터 눌러 주세요.');
  }

  cv.addEventListener('pointerdown', (e) => {
    const rc = cv.getBoundingClientRect();
    const s = BOOK_W / rc.width;
    const x = (e.clientX - rc.left) * s, y = (e.clientY - rc.top) * s;
    for (const h of B.hits)
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) { pick(h.i); return; }
  });
  teardown = () => { if (B.swap) clearTimeout(B.swap); };
  start();
  raf = requestAnimationFrame(loop);
}

/* ---------- ⑩ 거북목 탈출 러너 ----------
   2D: startPostureRun / postureRunTick / drawPostureRun / postureLift.
   숫자는 전부 원본입니다 — 한 바퀴 400m, 미터당 24px, 중력 2250,
   뛰는 힘 -645(체공 0.57초), 목숨 셋, 뛰기 0.7 · 재장전 0.3배.

   이 파일에서 자세를 **조작 장치로** 쓰는 하나뿐인 게임입니다. 고개를
   살짝 들면 뜁니다. 그것 하나라 규칙을 설명할 것이 없고, 시키는 동작이
   마침 목에 좋은 쪽입니다.

   ---- 옮기면서도 그대로 지킨 것 셋 ----

   1) **절대 각도로 판정하지 않습니다.** 판정식은 여기 없습니다 — 부르는
      쪽이 넘겨주는 ctx.posture.lift() 가 "자기 기준에서 얼마나 들었나" 를
      허용치 배수로 돌려줍니다. 원래 고개가 앞으로 나와 있는 사람도 자기
      기준에서 조금만 들면 뜁니다. 절대값으로 잡으면 그 사람은 이 게임을
      **아예 못 합니다.**

   2) **카메라 없이도 됩니다.** ctx 가 아예 안 오는 판(다른 호출자, 웹캠
      모듈이 빠진 빌드)에서도 조용히 자판으로 갑니다. 카메라를 켜 둔
      사람도 Space·↑ 를 같이 씁니다 — 조작을 카메라 뒤에 잠그지 않습니다.

   3) **자세에 점수를 매기지 않습니다.** 고개를 든 횟수도 크기도 기록하지
      않고 아무 데도 안 보냅니다. 성적은 달린 거리로만 납니다. 숙이라고
      시키는 조작(엎드리기)은 넣지 않았고, 한 바퀴로 끝나는 것도 같은
      이유입니다 — 목을 몇 바퀴씩 젖히게 시키는 게임이 되면 안 됩니다.

   접두사가 RUN_ 이 아니라 PRUN_ 인 것은 이 파일의 run() 이 이미 Phaser
   동물 러너의 자리이기 때문입니다. 같은 접두사를 쓰면 두 게임의 상수가
   한 이름에서 섞입니다. */
const PRUN_LAP_M = 400;          // 트랙 한 바퀴. 이 이상은 목에 일을 시키는 것이 됩니다
const PRUN_PX_M = 24;            // 그림 픽셀 / 미터
const PRUN_LAP_PX = PRUN_LAP_M * PRUN_PX_M;
const PRUN_LIVES = 3;
/* 체공 0.57초. 더 길게 두면 "고개를 들고 기다리기" 가 유리해지는데,
   그건 이 게임이 시키면 안 되는 자세입니다. */
const PRUN_G = 2250;             // 중력 px/s²
const PRUN_V0 = -645;            // 뛰는 힘 — 0.57초 떠 있습니다
const PRUN_W = 880, PRUN_H = 300, PRUN_GY = 232, PRUN_ME = 128;
/* 허용치(tol) 배수로 읽습니다. 판정이 "기준에서 벗어났다" 고 보기
   시작하는 값이 1.0 이므로, 0.7 은 그보다 작은 **분명하지만 가벼운**
   움직임입니다. 여기를 더 올리면 목을 크게 젖혀야 합니다. */
const PRUN_JUMP_AT = 0.7;
const PRUN_REARM_AT = 0.3;       // 여기까지 돌아와야 다시 뜁니다
/* 축값이 이만큼 안 오면 그 동안은 자판으로 물러납니다. 한 프레임 빠졌다고
   글자를 바꾸면 조작 표시가 깜빡이기만 하고 아무것도 안 알려 줍니다. */
const PRUN_STALE_MS = 700;
const PRUN_KINDS = ['book', 'monitor', 'chair'];
/* 넘어야 하는 높이. 셋 다 92px(뛰는 높이) 아래입니다 — 못 넘는 것을
   세워 두면 그건 장애물이 아니라 함정입니다. */
const prunObsH = (kind) => (kind === 'monitor' ? 45 : kind === 'chair' ? 39 : 30);

function postureRun(body, ctx) {
  body.className = 'gbody';
  const P = pal();

  /* 조작 갈래는 캔버스 밖 머리줄에 적습니다. 캔버스 안에만 두면 "지금
     카메라로 하는 중인지 자판으로 하는 중인지" 가 그림에 묻힙니다. */
  const head = document.createElement('div');
  head.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;justify-content:center;'
    + 'width:100%;max-width:560px;font:600 11.5px inherit;color:var(--ink2)';
  head.innerHTML = '<span>조작 <b>준비 중</b></span>'
    + '<span>남은 거리 <b>' + PRUN_LAP_M + 'm</b></span>'
    + '<span>연속 통과 <b>0개</b></span>'
    + '<span>부딪힘 <b>0 / ' + PRUN_LIVES + '</b></span>';
  for (const b of head.querySelectorAll('b')) b.style.cssText = 'font-weight:800;color:var(--ink)';
  const [elMode, elDist, elClear, elLife] = head.querySelectorAll('b');
  body.appendChild(head);

  const cv = document.createElement('canvas');
  cv.style.cssText = `width:100%;aspect-ratio:${PRUN_W}/${PRUN_H};display:block;`
    + 'cursor:pointer;touch-action:manipulation';
  body.appendChild(cv);

  const bar = document.createElement('div');
  bar.style.cssText = 'width:100%;max-width:560px;height:10px;border-radius:99px;'
    + 'overflow:hidden;background:rgba(34,42,51,.10)';
  const fill = document.createElement('i');
  fill.style.cssText = 'display:block;width:0%;height:100%;background:var(--acc);'
    + 'transition:width .1s linear';
  bar.appendChild(fill);
  body.appendChild(bar);

  const say = sayLine(body, '시작합니다. 고개를 들 준비!');
  const note = document.createElement('p');
  note.style.cssText = 'margin:0;font:600 11px/1.5 inherit;color:var(--ink2);opacity:.75;'
    + 'text-align:center;max-width:520px';
  note.textContent = '고개를 살짝 들었다가 제자리로 돌아오면 한 번 뜁니다. 억지로 젖히지 '
    + '않으셔도 되고, 카메라가 없으면 Space · ↑ 로 하시면 돼요. 이 게임은 자세에 점수를 '
    + `매기지 않습니다 — 고개 움직임을 조작으로만 씁니다. ${PRUN_LIVES}번 부딪히면 그 판은 `
    + '끝이에요. 뒤로 갈수록 장애물이 촘촘해지고, 200m 부터는 둘씩 붙어 나오기도 해요.';
  body.appendChild(note);

  /* 자세 입력은 부르는 쪽이 넘겨줍니다. ctx 도 ctx.posture 도 없을 수
     있어서 한 번만 걸러 두고, 아래에서는 POS 가 있는지만 봅니다. */
  const POS = (ctx && ctx.posture) || null;
  const posMode = () => { try { return POS ? POS.mode : 'off'; } catch { return 'off'; } };
  /** 기준선 대비 고개를 든 정도. 안 잡히면 null 이고, 그때는 자판입니다. */
  function readLift() {
    if (!POS || typeof POS.lift !== 'function') return null;
    let v = null;
    try { v = POS.lift(); } catch { return null; }
    return typeof v === 'number' && isFinite(v) ? v : null;
  }

  const R = { dist: 0, spd: 300, y: 0, vy: 0, lives: PRUN_LIVES, invuln: 0,
              obs: [], nextAt: 700, lift: null, liveAt: 0, armed: true, mode: 'key',
              jumps: 0, step: 0, clear: 0, bestClear: 0, shake: 0, land: 0, cloud: 0,
              over: false, won: false, last: 0, rowsAt: 0 };

  function jump() {
    if (R.over || R.y > 0) return;
    R.vy = PRUN_V0; R.y = 0.001; R.jumps++;
    /* 발밑 먼지 — 뛴 자리에 흔적이 남아야 "내가 뛰었다" 가 됩니다 */
    FX.puff(PRUN_ME + 14, PRUN_GY - 2, 'rgba(232,206,180,.85)', 6);
  }

  function paintRows() {
    if (!cv.isConnected) return;
    /* 조작 갈래는 매 프레임 다시 정하지만 글자는 여기서만 만집니다. */
    elMode.textContent = R.mode === 'pose' ? '카메라로 조작'
      : (posMode() === 'asking' || posMode() === 'loading' || posMode() === 'calibrating')
        ? '준비 중' : '자판으로 조작';
    const m = R.dist / PRUN_PX_M;
    const left = Math.max(0, Math.ceil(PRUN_LAP_M - m));
    elDist.textContent = left + 'm';
    elClear.textContent = R.clear + '개';
    /* 몇 번 부딪혔는지로 씁니다. 남은 목숨으로 쓰면 "1번 더 괜찮아요" 를
       띄운 다음 판이 끝나서, 화면이 거짓말을 합니다. */
    elLife.textContent = (PRUN_LIVES - Math.max(0, R.lives)) + ' / ' + PRUN_LIVES;
    fill.style.width = Math.min(100, (R.dist / PRUN_LAP_PX) * 100) + '%';
    /* 성적은 **달린 거리** 하나입니다. 고개를 든 횟수도 크기도 점수에
       안 들어갑니다 — 자세에 점수를 매기지 않는다는 것이 그 뜻입니다. */
    setScore(Math.min(PRUN_LAP_M, Math.floor(m)));
    setTime(R.over ? (R.won ? '완주' : '중단') : left + 'm 남음');
  }

  function finish(won) {
    if (R.over) return;
    R.over = true; R.won = won;
    paintRows();
    if (won) {
      FX.burst(PRUN_ME + 20, PRUN_GY - 70, '#FFE9A8', 26, 210);
      say('한 바퀴 다 돌았어요. 최고 ' + R.bestClear + '개 연속 통과.');
      over('한 바퀴 완주!',
           PRUN_LAP_M + 'm · ' + R.jumps + '번 뛰었어요 · 최고 ' + R.bestClear + '개 연속 통과',
           start);
    } else {
      /* 2D 는 완주해야 코인입니다 — 실패한 판은 0 점입니다(달리기 시합 ·
         책 정리와 같은 규칙). 간 거리는 아래 글로만 남깁니다. */
      setScore(0);
      say('세 번 부딪혔어요. 장애물이 보이면 조금 일찍 들어 주세요.');
      over('세 번 부딪혔어요',
           Math.floor(R.dist / PRUN_PX_M) + 'm 에서 끝 · 조금 일찍 들면 넉넉히 넘어갑니다',
           start);
    }
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - R.last) / 1000);
    R.last = now;
    if (dt <= 0) { draw(); return; }
    FX.update(dt);
    R.shake = Math.max(0, R.shake - dt * 2.4);
    R.land = Math.max(0, R.land - dt * 5);
    /* 끝난 뒤에도 계속 그립니다 — 먼지가 가라앉는 것까지 보여야 판이
       끊긴 것이 아니라 끝난 것으로 읽힙니다. */
    if (R.over) { draw(); return; }

    /* ---- 조작 ----
       갈래를 **매 프레임** 다시 정합니다. 판 도중에 기준 잡기가 끝나면
       그 자리에서 고개 조작이 살아나야 합니다. */
    const before = R.mode;
    const lift = readLift();
    if (lift !== null) { R.lift = lift; R.liveAt = now; } else R.lift = null;
    R.mode = POS && R.liveAt && now - R.liveAt < PRUN_STALE_MS ? 'pose' : 'key';
    if (lift !== null) {
      /* 한 번 들면 한 번만 뜁니다. 들고 있는다고 연달아 뛰면 "든 채로
         버티기" 가 유리해지는데, 그건 이 게임이 시키면 안 되는 동작입니다. */
      if (R.armed && lift >= PRUN_JUMP_AT) { R.armed = false; jump(); }
      else if (!R.armed && lift <= PRUN_REARM_AT) R.armed = true;
    } else R.armed = true;
    if (before !== R.mode) paintRows();

    /* ---- 달리기 ----
       조금씩 빨라집니다 — 한 바퀴 동안 300 -> 500(px/s). 끝에 가서 숨이
       차야 완주가 완주로 느껴집니다. */
    R.spd = Math.min(500, R.spd + 7.5 * dt);
    R.dist += R.spd * dt;
    R.step += R.spd * dt;
    R.cloud += dt;
    if (R.invuln > 0) R.invuln -= dt;
    /* y 는 땅에서 뜬 높이(위가 +), vy 는 화면 좌표 방향(위가 -)입니다. */
    if (R.y > 0 || R.vy !== 0) {
      const wasUp = R.y > 0;
      R.vy += PRUN_G * dt;
      R.y = Math.max(0, R.y - R.vy * dt);
      if (R.y <= 0) {
        R.y = 0; R.vy = 0;
        /* 착지 — 눌렸다 펴집니다. 이게 없으면 공중에서 바닥으로
           순간이동하는 것으로 보입니다. */
        if (wasUp) { R.land = 1; FX.puff(PRUN_ME + 14, PRUN_GY - 2, 'rgba(232,206,180,.85)', 7); }
      }
    }

    /* ---- 장애물 ----
       간격이 거리에 따라 좁아집니다(첫 100m 는 넉넉하게, 마지막 100m 는
       빠듯하게). 200m 부터는 둘이 붙어 나오기도 합니다 — 한 번 뛰어 둘을
       넘는 자리라, 뛰는 때를 고르는 재미가 생깁니다. */
    if (R.dist >= R.nextAt && R.dist < PRUN_LAP_PX - 600) {
      const at = R.dist + PRUN_W + 40;
      const prog = R.dist / PRUN_LAP_PX;
      R.obs.push({ at, kind: PRUN_KINDS[(Math.random() * 3) | 0], hit: false });
      if (prog > 0.5 && Math.random() < 0.34)
        R.obs.push({ at: at + 118, kind: PRUN_KINDS[(Math.random() * 3) | 0], hit: false });
      R.nextAt = R.dist + (760 - prog * 260) + Math.random() * 300;
    }
    R.obs = R.obs.filter((o) => o.at - R.dist > -90);
    for (const o of R.obs) {
      const sx = o.at - R.dist;
      if (sx < PRUN_ME + 30 && sx > PRUN_ME - 33 && R.y < prunObsH(o.kind) && R.invuln <= 0) {
        R.lives -= 1; R.invuln = 1.0; R.spd *= 0.75; R.clear = 0; R.shake = 1;
        FX.burst(PRUN_ME + 20, PRUN_GY - 26, '#E0483A', 14, 160);
        paintRows();
        say(R.lives > 0 ? '부딪혔어요. ' + R.lives + '번 더 부딪히면 끝이에요.' : '');
        if (R.lives <= 0) { draw(); return finish(false); }
      }
      /* 넘어간 것을 셉니다. 통과가 아무 표시도 없으면 뛰어넘은 보람이
         없고, 뛰어야 하는 이유도 안 배웁니다. */
      if (!o.hit && sx < PRUN_ME - 33) {
        o.hit = true;
        R.clear++; R.bestClear = Math.max(R.bestClear, R.clear);
        if (R.clear % 5 === 0)
          FX.say(PRUN_ME + 30, PRUN_GY - 90, R.clear + '개 연속 통과!', '#FFD98A', 22);
        paintRows();
      }
    }

    if (R.dist >= PRUN_LAP_PX) { R.dist = PRUN_LAP_PX; draw(); return finish(true); }
    draw();
    /* 숫자 줄은 초당 열 번이면 충분합니다. 프레임마다 고치면 60분의 1초마다
       DOM 을 다섯 번씩 만지는데, 눈은 그 차이를 못 봅니다. */
    if (now - R.rowsAt > 100) { R.rowsAt = now; paintRows(); }
  }

  /* ---- 그림 ----
     트랙은 붉은 우레탄, 안쪽은 잔디. 월드의 운동장과 같은 색이라 창을 열면
     방금 서 있던 자리가 옆에서 흘러갑니다.
     층은 다섯입니다 — 하늘 · 구름 · 관중석 · 잔디 인필드 · 트랙. 층마다
     흐르는 속도가 다르고(0.035 ~ 1.15), 그 차이가 곧 깊이입니다. 한 겹만
     흘리면 배경이 종이처럼 미끄러집니다. */
  function draw() {
    const g = fitCv(cv, PRUN_W, PRUN_H);
    if (!g) return;
    const d = R.dist, W = PRUN_W;
    if (R.shake > 0)
      g.translate((Math.random() - 0.5) * R.shake * 12, (Math.random() - 0.5) * R.shake * 8);

    const sky = g.createLinearGradient(0, 0, 0, PRUN_GY);
    sky.addColorStop(0, '#A8D8E8'); sky.addColorStop(0.7, '#D6ECEF'); sky.addColorStop(1, '#EAF3E4');
    g.fillStyle = sky; g.fillRect(0, 0, W, PRUN_GY);

    /* 구름 — 가장 느립니다. 뭉치 셋이 한 덩이입니다. */
    for (let i = 0; i < 4; i++) {
      const x = ((i * 260 - d * 0.035 - R.cloud * 6) % (W + 300) + W + 300) % (W + 300) - 150;
      const y = 26 + (i % 3) * 22;
      disc(g, x, y, 22, 'rgba(255,255,255,.85)');
      disc(g, x + 24, y + 5, 17, 'rgba(255,255,255,.85)');
      disc(g, x - 22, y + 7, 14, 'rgba(255,255,255,.8)');
      g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(x - 22, y, 48, 9);
    }
    /* 먼 나무 — 관중석 뒤 */
    for (let i = 0; i < 12; i++) {
      const x = ((i * 92 - d * 0.09) % (W + 120) + W + 120) % (W + 120) - 60;
      g.fillStyle = '#6B4A2E'; g.fillRect(x + 9, 108, 6, 22);
      disc(g, x + 12, 104, 17, '#4E9E63');
      disc(g, x + 6, 98, 11, '#6FBE7F');
    }
    /* 관중석 — 계단 셋에 앉은 사람들. 색 점만 뿌리면 색종이가 흩어진
       것으로 보여서 **머리와 몸통 두 조각**으로 사람 꼴을 만듭니다.
       색은 채도를 낮춘 것들만 씁니다 — 관중이 주자보다 눈에 띄면 안 됩니다. */
    g.fillStyle = '#9FB6A6'; g.fillRect(0, 130, W, 46);
    const CROWD = ['#B9705F', '#B49653', '#5E7FA0', '#7E6B9E', '#5FA093', '#A46A78'];
    for (let r = 0; r < 3; r++) {
      const y = 131 + r * 15;
      g.fillStyle = r % 2 ? '#B7CCBC' : '#A9C0AF';
      g.fillRect(0, y, W, 15);
      g.fillStyle = 'rgba(42,35,32,.14)'; g.fillRect(0, y + 14, W, 1);
      for (let i = 0; i < 72; i++) {
        const x = ((i * 14 + r * 7 - d * 0.14) % (W + 40) + W + 40) % (W + 40) - 20;
        /* 응원 — 몇은 위아래로 조금 움직입니다. 다 멈춰 있으면 인형입니다. */
        const hop = ((i + r) % 7 === 0) ? Math.round(Math.sin(R.cloud * 4 + i) * 1.5) : 0;
        g.fillStyle = CROWD[(i * 3 + r * 2) % CROWD.length];
        g.fillRect(x, y + 6 + hop, 9, 8);
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y + 6 + hop, 9, 2);
        g.fillStyle = '#8A6A55'; g.fillRect(x + 2, y + 2 + hop, 5, 5);
      }
    }
    g.fillStyle = '#7E9C86'; g.fillRect(0, 176, W, 8);
    g.fillStyle = '#93AE99'; g.fillRect(0, 176, W, 3);

    /* 잔디 인필드는 **트랙 뒤**입니다. 발이 닿는 줄(PRUN_GY)보다 위에서
       붉은 우레탄이 시작해야 "트랙 위를 달린다" 로 읽힙니다 — 경계선에
       발을 딱 붙여 놓으면 잔디에 서 있는 것처럼 보입니다. */
    g.fillStyle = '#8FBF7A'; g.fillRect(0, 184, W, 22);
    g.fillStyle = '#A3CE8B'; g.fillRect(0, 184, W, 4);
    g.fillStyle = '#79AE68';
    for (let i = 0; i < 40; i++) {
      const x = ((i * 47 - d * 0.5) % (W + 60) + W + 60) % (W + 60) - 30;
      g.fillRect(x, 190 + (i % 3) * 5, 4, 4);
    }
    g.fillStyle = '#C4553F'; g.fillRect(0, 206, W, PRUN_H - 206);
    g.fillStyle = '#D96A50'; g.fillRect(0, 206, W, 4);
    g.fillStyle = '#B04A36'; g.fillRect(0, PRUN_GY - 2, W, 2);
    /* 레인 선 · 100m 표지 */
    g.fillStyle = '#F4EDE4';
    for (let i = 0; i < 22; i++) {
      const x = ((i * 72 - d) % (W + 72) + W + 72) % (W + 72) - 72;
      g.fillRect(x, PRUN_GY + 24, 38, 4);
    }
    g.fillStyle = '#A8422F'; g.fillRect(0, PRUN_GY + 44, W, 3);
    g.fillStyle = 'rgba(244,237,228,.5)';
    for (let i = 0; i < 30; i++) {
      const x = ((i * 44 - d * 1.15) % (W + 44) + W + 44) % (W + 44) - 44;
      g.fillRect(x, PRUN_GY + 52, 20, 3);
    }
    /* 100m 마다 표지판. "얼마나 왔나" 를 막대 말고 트랙 위에서도 봅니다. */
    g.textBaseline = 'middle';
    for (let m = 100; m < PRUN_LAP_M; m += 100) {
      const x = m * PRUN_PX_M - d + PRUN_ME;
      if (x < -60 || x > W + 20) continue;
      g.fillStyle = '#F4EDE4'; g.fillRect(x, PRUN_GY - 4, 3, 6);
      g.fillStyle = 'rgba(42,35,32,.62)'; g.fillRect(x - 16, 186, 40, 18);
      g.fillStyle = '#FFF6F3'; g.font = F7(12); g.textAlign = 'center';
      g.fillText(m + 'm', x + 4, 195);
      g.textAlign = 'left';
    }
    g.textBaseline = 'alphabetic';

    /* 장애물 — 책상에서 굴러 나온 것들. 운동장 허들 자리에 이것들이
       서 있는 것이 이 게임의 농담입니다. */
    for (const o of R.obs) {
      const x = Math.round(o.at - d);
      if (x < -60 || x > W + 20) continue;
      /* 접지 그림자 — 셋 다 바닥에 붙어 있어야 뛰어넘을 것으로 보입니다 */
      g.fillStyle = 'rgba(80,30,20,.28)'; g.fillRect(x - 3, PRUN_GY - 3, 40, 5);
      if (o.kind === 'book') {
        [['#D8442C', 0], ['#E8C34A', 10], ['#3F8F5C', 20]].forEach(([c, dy]) => {
          g.fillStyle = '#6B2A1C'; g.fillRect(x - 1, PRUN_GY - 10 - dy, 35, 10);
          g.fillStyle = c; g.fillRect(x, PRUN_GY - 9 - dy, 33, 8);
          g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, PRUN_GY - 9 - dy, 33, 2);
          g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, PRUN_GY - 3 - dy, 33, 2);
        });
      } else if (o.kind === 'monitor') {
        g.fillStyle = '#4A525C'; g.fillRect(x + 12, PRUN_GY - 15, 12, 15);
        g.fillRect(x + 3, PRUN_GY - 6, 30, 6);
        g.fillStyle = '#2E343B'; g.fillRect(x - 1, PRUN_GY - 46, 38, 33);
        g.fillStyle = '#3A4048'; g.fillRect(x, PRUN_GY - 45, 36, 31);
        g.fillStyle = '#8FD3E8'; g.fillRect(x + 3, PRUN_GY - 42, 30, 25);
        g.fillStyle = '#CDEAF5'; g.fillRect(x + 3, PRUN_GY - 42, 30, 6);
        g.fillStyle = 'rgba(255,255,255,.5)';
        g.fillRect(x + 5, PRUN_GY - 34, 14, 3); g.fillRect(x + 5, PRUN_GY - 28, 20, 3);
      } else {
        g.fillStyle = '#6B4A2E'; g.fillRect(x - 1, PRUN_GY - 19, 38, 8);
        g.fillStyle = '#8A6039'; g.fillRect(x, PRUN_GY - 18, 36, 6);
        g.fillStyle = '#B08050'; g.fillRect(x, PRUN_GY - 18, 36, 2);
        g.fillStyle = '#8A6039'; g.fillRect(x + 1, PRUN_GY - 40, 8, 23);
        g.fillStyle = '#B08050'; g.fillRect(x + 1, PRUN_GY - 40, 8, 3);
        g.fillStyle = '#6B4A2E';
        g.fillRect(x + 3, PRUN_GY - 11, 6, 11); g.fillRect(x + 28, PRUN_GY - 11, 6, 11);
      }
    }

    /* 기린 — 달리는 사람 자리. chars.js 는 three.js 모듈이라 여기서는
       못 씁니다. 캔버스 게임의 그림은 이 파일 안에서 끝냅니다. */
    const y = PRUN_GY - R.y;
    const air = R.y > 0.5;
    /* 그림자는 늘 땅에 붙어 있고 뜬 만큼 작아집니다. 이게 없으면 공중에
       있는지 그냥 위에 그려진 것인지 구별이 안 됩니다. */
    g.fillStyle = 'rgba(90,40,28,' + (0.3 - Math.min(0.22, R.y / 460)).toFixed(2) + ')';
    g.fillRect(PRUN_ME + 2 + Math.min(7, R.y / 16), PRUN_GY - 3, 28 - Math.min(13, R.y / 8), 5);
    /* 부딪힌 뒤 잠깐은 깜빡입니다 — 무적인 동안 또 부딪힌 줄 알면
       목숨이 왜 안 줄었는지 설명이 안 됩니다. */
    const blink = R.invuln > 0 && ((performance.now() / 90) | 0) % 2 === 0;
    if (!blink) {
      const sq = R.land * 0.16;                 // 착지 눌림 — 0.2초 동안 납작해집니다
      g.save();
      g.translate(PRUN_ME + 15, y);
      g.scale(1 + sq, 1 - sq);
      g.translate(-(PRUN_ME + 15), -y);
      const swing = air ? 0 : Math.sin(R.step / 15) * 6;
      g.fillStyle = '#9B5B2B';
      g.fillRect(PRUN_ME + 3, y - 18 + (air ? 6 : 0), 6, air ? 12 : 18 + swing);
      g.fillRect(PRUN_ME + 18, y - 18 + (air ? 6 : 0), 6, air ? 12 : 18 - swing);
      g.fillStyle = '#6B4A2E';
      g.fillRect(PRUN_ME + 3, y - 3 + (air ? 3 : 0), 6, 3);
      g.fillRect(PRUN_ME + 18, y - 3 + (air ? 3 : 0), 6, 3);
      g.fillStyle = '#9B5B2B'; g.fillRect(PRUN_ME - 1, y - 40, 32, 24);
      g.fillStyle = '#E8AD50'; g.fillRect(PRUN_ME, y - 39, 30, 22);
      g.fillStyle = '#F0C378'; g.fillRect(PRUN_ME, y - 39, 30, 5);
      g.fillStyle = '#C98536'; g.fillRect(PRUN_ME, y - 22, 30, 5);
      g.fillStyle = '#B66D31';
      [[4, -35], [18, -32], [9, -26], [22, -24]].forEach(([a, b]) => g.fillRect(PRUN_ME + a, y + b, 7, 6));
      g.fillStyle = '#9B5B2B';
      g.fillRect(PRUN_ME - 6, y - 34, 7, 4 + (air ? 0 : Math.sin(R.step / 15) * 2));
      /* 목 — 뛰는 동안 더 곧게 섭니다. 이 게임이 파는 그림이 그것입니다. */
      const nh = air ? 46 : 36;
      g.fillStyle = '#9B5B2B'; g.fillRect(PRUN_ME + 17, y - 40 - nh, 12, nh);
      g.fillStyle = '#E8AD50'; g.fillRect(PRUN_ME + 18, y - 40 - nh, 10, nh);
      g.fillStyle = '#F0C378'; g.fillRect(PRUN_ME + 18, y - 40 - nh, 3, nh);
      g.fillStyle = '#B66D31';
      for (let k = 0; k < 3; k++) g.fillRect(PRUN_ME + 21, y - 34 - nh + k * 12, 5, 5);
      g.fillStyle = '#9B5B2B'; g.fillRect(PRUN_ME + 15, y - 48 - nh, 21, 13);
      g.fillStyle = '#E8AD50'; g.fillRect(PRUN_ME + 16, y - 47 - nh, 19, 11);
      g.fillStyle = '#F0C378'; g.fillRect(PRUN_ME + 16, y - 47 - nh, 19, 3);
      g.fillStyle = '#E8AD50'; g.fillRect(PRUN_ME + 33, y - 44 - nh, 8, 7);   // 주둥이
      g.fillStyle = '#2A2520'; g.fillRect(PRUN_ME + 28, y - 44 - nh, 3, 3);   // 눈
      g.fillStyle = '#9B5B2B';
      g.fillRect(PRUN_ME + 19, y - 55 - nh, 3, 7); g.fillRect(PRUN_ME + 26, y - 55 - nh, 3, 7);
      g.fillStyle = '#6B4A2E';
      g.fillRect(PRUN_ME + 18, y - 58 - nh, 5, 4); g.fillRect(PRUN_ME + 25, y - 58 - nh, 5, 4);
      g.restore();
    }

    FX.draw(g);

    /* 고개 막대 — 얼마나 들었는지. 조작이 눈에 보여야 "내가 뭘 해서
       뛰었는지" 를 배웁니다. 점수가 아니라 **입력 표시**이고, 판이 끝나면
       사라집니다 — 어디에도 안 남습니다. */
    if (R.mode === 'pose') {
      const gx = W - 46, gy = 22, gh = 150;
      g.fillStyle = 'rgba(255,255,255,.84)'; g.fillRect(gx - 8, gy - 20, 40, gh + 34);
      g.fillStyle = P.ink2; g.font = F7(11); g.textAlign = 'center';
      g.fillText('고개', gx + 12, gy - 8);
      g.fillStyle = '#D8D2CC'; g.fillRect(gx, gy, 24, gh);
      const t = Math.max(0, Math.min(1, ((R.lift || 0) + 0.5) / 2.2));
      g.fillStyle = R.armed ? '#2E9E5B' : '#9A8E88';
      g.fillRect(gx, gy + gh - gh * t, 24, gh * t);
      g.fillStyle = '#E0483A';
      g.fillRect(gx - 6, gy + gh - gh * ((PRUN_JUMP_AT + 0.5) / 2.2), 36, 3);
      g.font = F7(10); g.fillText('뛰기', gx + 12, gy + gh + 12);
      g.textAlign = 'left';
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  function start() {
    FX.reset();
    R.dist = 0; R.spd = 300; R.y = 0; R.vy = 0; R.lives = PRUN_LIVES; R.invuln = 0;
    R.obs = []; R.nextAt = 700; R.armed = true; R.jumps = 0; R.step = 0; R.rowsAt = 0;
    R.clear = 0; R.bestClear = 0; R.shake = 0; R.land = 0; R.cloud = 0;
    R.over = false; R.won = false; R.lift = null; R.liveAt = 0;
    R.last = performance.now();
    paintRows();
    say(R.mode === 'pose' ? '고개를 살짝 들면 뜁니다. 출발!' : '시작합니다. Space 로 뛰어 주세요.');
  }

  /* 자판은 **늘** 먹습니다. 카메라가 도는 동안에도 그대로 두는 것은
     조작을 카메라 뒤에 잠그지 않기 위해서입니다. */
  const kd = (e) => {
    if (e.code !== 'Space' && e.code !== 'ArrowUp' && e.code !== 'KeyW') return;
    e.preventDefault();
    if (!R.over) jump();
  };
  addEventListener('keydown', kd);
  /* 손가락으로 하는 사람에게는 자판이 없습니다 — 판을 두드려도 뜁니다. */
  cv.addEventListener('pointerdown', () => { if (!R.over) jump(); });

  /* 카메라는 이 게임이 켠 것이므로 이 게임이 끕니다. 창을 닫고도 불이
     켜져 있으면 그건 게임이 아니라 감시로 읽힙니다. */
  teardown = () => {
    removeEventListener('keydown', kd);
    try { POS?.stop?.(); } catch { /* 무시 */ }
  };

  /* 켜지는 데 몇 초 걸립니다(권한 · 모델 · 기준 잡기). 그 동안에도 판은
     이미 굴러가고 있고 Space 로 됩니다 — 기다리게 하지 않습니다. */
  if (POS && typeof POS.start === 'function') {
    Promise.resolve().then(() => POS.start()).then(paintRows, paintRows);
  }

  start();
  raf = requestAnimationFrame(loop);
}

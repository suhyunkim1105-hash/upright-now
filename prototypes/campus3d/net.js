/* ══════════════════════════════════════════════════════════
   실시간 — Supabase Realtime.

   2D 월드(prototypes/openworld/multiplayer.js)가 쓰는 것과 **같은 방식**
   입니다. 채널 이름만 다릅니다: 'world3d:<zone>'.
   좌표계가 달라서(2D 는 46×42 타일, 3D 는 ±40 미터) 같은 채널에 넣으면
   사람이 벽 속에 서 있게 됩니다. 좌표 변환을 붙이기 전까지는 나눕니다.

   보내는 것 셋
     presence  누가 있나 · 어떤 모습인가 (5초마다)
     'm'       어디 있나 (초당 최대 열 번 · 움직일 때만)
     'say'     말 (사람이 칠 때만)
     'emo'     감정표현 (누를 때만)

   못 붙어도 월드는 그대로 돕니다. 붙는 것이 실패해서 화면이 멈추면
   그건 기능이 아니라 사고입니다.

   mode 는 넷입니다. 부르는 쪽은 이 넷과 error 만 보면 됩니다.
     connecting  붙는 중
     online      진짜 사람과 붙었습니다
     local       못 붙어서 흉내 이웃이 걷고 있습니다 — error 에 이유가 남습니다
     offline     못 붙었고 흉내도 못 냅니다
   ══════════════════════════════════════════════════════════ */

/* 욕설 — 보낼 때와 받을 때 둘 다 여기서 가립니다. 받는 쪽을 빼면
   남의 브라우저가 보낸 말이 내 화면에 그대로 뜹니다. */
import { maskProfanity } from './chat-filter.js';

const SEND_HZ = 10, SEND_MS = 1000 / SEND_HZ;
const INTERP_DELAY = 130;      // 보간 지연은 패킷 간격(100ms)보다 커야 합니다
const BUF_KEEP = 1400;
const PRESENCE_MS = 5000;
const CONNECT_TIMEOUT = 8000;

let sdkPromise = null;
function loadSdk() {
  if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = '../shared/supabase.js';
    s.onload = () => (window.supabase && window.supabase.createClient
      ? res(window.supabase) : rej(new Error('supabase.js 가 이상합니다')));
    s.onerror = () => rej(new Error('supabase.js 를 못 받았습니다'));
    document.head.append(s);
  });
  return sdkPromise;
}
function loadConfig() {
  if (window.GIRIN_SUPABASE) return Promise.resolve(window.GIRIN_SUPABASE);
  return new Promise((res) => {
    const s = document.createElement('script');
    s.src = '../shared/config.js';
    s.onload = () => res(window.GIRIN_SUPABASE || null);
    s.onerror = () => res(null);
    document.head.append(s);
  });
}

/* ══════════════════════════════════════════════════════════
   흉내 이웃 — 진짜 서버가 없을 때만 삽니다.

   2D 월드의 LocalTransport 와 같은 생각입니다. 설정이 없는 사람이 열면
   캠퍼스가 폐교로 보이고, 그러면 이 프로토타입이 무엇을 만들려는
   것인지가 화면에서 사라집니다. 시연도 대부분 혼자 합니다.

   대신 **사람인 척은 안 합니다.** 봇이 도는 동안 mode 는 'online' 이
   아니라 'local' 이고, error 에는 못 붙은 이유가 그대로 남습니다.
   진짜로 붙은 뒤에는 아무도 없어도 봇을 안 넣습니다 — 비어 있는 것이
   사실이면 비어 있어야 합니다.
   ══════════════════════════════════════════════════════════ */
const BOT_R = 30;              // 월드는 ±40, 광장이 한가운데입니다
const BOT_TICK_MS = SEND_MS;   // 진짜 전송과 같은 굵기여야 보간이 같은 조건에서 돕니다
const BOT_SAY_MIN = 20;        // 초 — 이보다 자주 떠들면 사람이 아니라 라디오입니다
/* 씨앗은 아무 숫자나 괜찮습니다. **안 바뀌는 것** 만 중요합니다 —
   Math.random 으로 두면 새로고침마다 종과 옷이 뒤바뀌어서, 이웃이
   아니라 슬롯머신처럼 보입니다. */
/* 흉내 이웃을 세울 것인가. 제출본은 false 입니다 — 위 startBots 참고 */
const BOTS_ON = false;
const BOT_SEED = 20260822;
const BOT_NICKS = ['느린거북', '목긴기린', '삼층창가', '알파카부탁',
                   '점심먼저', '광장한바퀴', '자세교정중', '도서관붙박이'];
/* 백조는 캐릭터에서 뺐습니다 — 랜딩 레퍼런스가 일곱 종입니다 */
/* 랜딩 렌더에서 변환한 넷만 씁니다. 나머지 셋은 개별 렌더가 없어
   변환 품질을 보장할 수 없었습니다. */
const BOT_SPECIES = ['거북이', '기린', '개구리', '펭귄'];
const BOT_LINES = ['오늘 자세 어때요?', '도서관 가는 길이에요', '광장 한 바퀴 돌고 갈게요',
                   '삼층에 자리 남았어요', '목이 뻐근해서 좀 걷습니다', '점심 뭐 드셨어요?',
                   '분수 앞에서 봐요', '이따 같이 앉을래요?'];
const BOT_EMOS = ['wave', 'yes', 'clap', 'jump', 'love'];   // emote.js 의 키 그대로입니다

/* mulberry32 — 씨앗 하나로 같은 줄을 계속 뽑습니다 */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clampR = (v) => Math.max(-BOT_R, Math.min(BOT_R, v));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function createNet(opts) {
  const me = {
    id: 'g3-' + Math.random().toString(36).slice(2, 9),
    nick: opts.nick || '나', species: opts.species, fit: opts.fit, school: opts.school || '',
  };
  // id → { id, nick, species, fit, buf[], say, sayT, emo, emoT }  (봇은 bot:true 가 더 붙습니다)
  const peers = new Map();
  const N = {
    mode: 'connecting', me, peers,
    error: null,
    setZone, move, say, emote, dispose, setLook, setSchool,
  };
  let client = null, ch = null, zone = 'campus', dead = false;
  let lastSend = 0, lastPresence = 0, lastKey = '';
  let pos = { x: 0, z: 0, dir: 0, moving: false };
  /* 흉내 이웃 — fellBack 이 켜져야 삽니다(아래 봇 구역) */
  let bots = null, botTimer = 0, botLast = 0, botSayT = 0, botFails = 0;
  let botBroken = false, fellBack = false;

  /* 못 붙으면 **완전히 놓습니다.** 안 놓으면 SDK 가 몇 초마다 다시 붙으려
     하고, 그 재시도가 웹캠 추론과 CPU 를 나눠 씁니다(콘솔도 도배됩니다). */
  const t0 = setTimeout(() => {
    if (N.mode !== 'connecting') return;
    goLocal('연결 시간 초과');
  }, CONNECT_TIMEOUT);
  function giveUp() {
    try { if (client && ch) client.removeChannel(ch); } catch {}
    try { client?.realtime?.disconnect(); } catch {}
    ch = null;
  }

  (async () => {
    try {
      const cfg = await loadConfig();
      if (!cfg || !cfg.url || !cfg.anonKey) throw new Error('설정 없음');
      const sdk = await loadSdk();
      client = sdk.createClient(cfg.url, cfg.anonKey, {
        auth: { persistSession: false }, realtime: { params: { eventsPerSecond: SEND_HZ } },
      });
      join(zone);
    } catch (e) {
      clearTimeout(t0);
      if (dead) return;
      goLocal(e.message || String(e));
    }
  })();

  function peer(id) {
    let p = peers.get(id);
    if (!p) peers.set(id, p = { id, nick: '', school: '', sessionSec: 0, species: '거북이', fit: 0, buf: [], say: '', sayT: 0, emo: '', emoT: 0 });
    return p;
  }
  function join(z) {
    if (!client) return;
    /* 다시 붙어 보는 동안에는 흉내를 세웁니다. 안 세우면 아래 peers.clear()
       가 지운 봇이 봇 배열에만 남아, 아무도 못 보는 채로 계속 걷습니다. */
    fellBack = false; stopBots();
    if (ch) { try { client.removeChannel(ch); } catch {} ch = null; }
    peers.clear(); opts.onReset?.();
    const c = client.channel('world3d:' + z, {
      config: { broadcast: { self: false, ack: false }, presence: { key: me.id } },
    });
    c.on('broadcast', { event: 'm' }, (msg) => {
      const p = msg?.payload; if (!p || p.id === me.id) return;
      const r = peer(p.id);
      r.sessionSec = Math.max(0, Number(p.sessionSec || 0));
      r.buf.push({ t: performance.now(), x: p.x, z: p.z, dir: p.dir, moving: !!p.moving });
      while (r.buf.length > 2 && performance.now() - r.buf[0].t > BUF_KEEP) r.buf.shift();
    });
    c.on('broadcast', { event: 'say' }, (msg) => {
      const p = msg?.payload; if (!p || p.id === me.id) return;
      const channel = p.channel === 'school' ? 'school' : 'all';
      if (channel === 'school' && (!me.school || p.school !== me.school)) return;
      /* 들어올 때 한 번 가립니다 — 그리는 쪽(이름표·말풍선·대화 기록)이
         여럿이라, 그릴 때 가리면 한 군데를 빠뜨리는 순간 뚫립니다. */
      const r = peer(p.id); r.say = maskProfanity(String(p.text || '').slice(0, 80)); r.sayT = performance.now();
      opts.onSay?.(r, r.say, channel);
    });
    c.on('broadcast', { event: 'emo' }, (msg) => {
      const p = msg?.payload; if (!p || p.id === me.id) return;
      const r = peer(p.id); r.emo = p.k; r.emoT = performance.now();
    });
    c.on('presence', { event: 'sync' }, () => {
      const st = c.presenceState() || {};
      const live = new Set();
      Object.keys(st).forEach((k) => {
        const e = st[k] && st[k][0]; if (!e || e.id === me.id) return;
        live.add(e.id);
        const r = peer(e.id);
        /* 이름은 **남이 정하는 값**입니다. 말(say)은 아래에서 80자로 자르면서
           이름만 그대로 받고 있었습니다. 글자로 만들어 자릅니다 — 화면에
           넣는 쪽에서도 막지만, 들어오는 길목에서 한 번 더 막습니다. */
        if (e.nick != null) r.nick = String(e.nick).slice(0, 24);
        r.species = e.species || r.species; r.fit = e.fit ?? r.fit;
        r.school = String(e.school || '').slice(0, 40);
        if (!r.buf.length && typeof e.x === 'number')
          r.buf.push({ t: performance.now(), x: e.x, z: e.z, dir: e.dir || 0, moving: false });
      });
      [...peers.keys()].forEach((id) => { if (!live.has(id)) { peers.delete(id); opts.onGone?.(id); } });
      opts.onPeers?.(peers);
    });
    c.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(t0);
        /* 진짜 이웃이 생겼으니 흉내는 접습니다 */
        fellBack = false; stopBots();
        N.mode = 'online'; N.error = null; opts.onMode?.(N.mode);
        track();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        goLocal(status);
      }
    });
    ch = c; zone = z;
  }
  function track() {
    if (!ch) return;
    lastPresence = performance.now();
    try {
      ch.track({ id: me.id, nick: me.nick, species: me.species, fit: me.fit, school: me.school,
        x: +pos.x.toFixed(2), z: +pos.z.toFixed(2), dir: +pos.dir.toFixed(2) });
    } catch {}
  }
  function setLook(species, fit, nick) {
    me.species = species; me.fit = fit; if (nick) me.nick = nick;
    track();
  }
  function setSchool(school) { me.school = String(school || '').slice(0, 40); track(); }
  function setZone(z) {
    /* `ch` 까지 봅니다. giveUp() 은 채널만 놓고 client 는 남기므로,
       client 만 보면 **이미 포기한 뒤에도** join 이 돌았습니다. join 은
       fellBack 을 지우고 봇을 걷어 가므로, 건물을 드나들 때마다 캠퍼스가
       십수 초씩 비었고 문 하나에 소켓 두 번씩 다시 붙어 보려 했습니다 —
       그 재시도가 웹캠 추론과 CPU 를 나눠 쓰는 것이 포기한 이유였습니다. */
    if (z !== zone && client && ch) join(z); else zone = z;
    /* 봇은 바깥에만 있습니다. 방까지 흉내 내면 "이 방에 사람이 있다" 는
       거짓말이 되고, 들어간 사람은 없는 사람에게 말을 겁니다. */
    syncBots();
  }
  function move(x, z, dir, moving, sessionSec = 0) {
    pos = { x, z, dir, moving };
    if (N.mode !== 'online' || !ch) return;
    const now = performance.now();
    if (now - lastPresence > PRESENCE_MS) track();
    if (now - lastSend < SEND_MS) return;
    const key = [Math.round(x * 8), Math.round(z * 8), Math.round(dir * 8), moving ? 1 : 0].join(',');
    if (key === lastKey && !moving) return;   // 안 움직이면 안 보냅니다
    lastKey = key; lastSend = now;
    try {
      ch.send({ type: 'broadcast', event: 'm', payload: {
        id: me.id, x: +x.toFixed(2), z: +z.toFixed(2), dir: +dir.toFixed(2), moving,
        sessionSec: Math.max(0, Math.round(sessionSec || 0)) } });
    } catch {}
  }
  function say(text, channel = 'all', school = '') {
    const t = maskProfanity(String(text || '').slice(0, 80));
    if (!t) return;
    channel = channel === 'school' ? 'school' : 'all';
    if (channel === 'school' && !school) return;
    if (N.mode === 'online' && ch)
      try { ch.send({ type: 'broadcast', event: 'say', payload: {
        id: me.id, text: t, channel, school: channel === 'school' ? String(school).slice(0, 40) : '' } }); } catch {}
  }
  function emote(k) {
    if (N.mode === 'online' && ch)
      try { ch.send({ type: 'broadcast', event: 'emo', payload: { id: me.id, k } }); } catch {}
  }

  /* ── 흉내 이웃 ──
     진짜 전송이 하는 일을 안에서 그대로 흉내 냅니다. peers 에 들어가는
     모양이 위 peer() 와 **같아야** 합니다 — 부르는 쪽은 봇인지 사람인지
     묻지 않고 sample() 만 부릅니다. bot 표시는 화면에 "흉내" 라고 적고
     싶을 때 쓰라고 붙여 둔 것이고, 안 봐도 그려집니다. */
  function makeBots() {
    const r = seeded(BOT_SEED);
    const n = 3 + Math.floor(r() * 3);                       // 셋에서 다섯
    const n0 = Math.floor(r() * 8), s0 = Math.floor(r() * 8), f0 = Math.floor(r() * 8);
    const out = [];
    for (let i = 0; i < n; i++) {
      /* 이름·종·옷은 서로 어긋난 걸음으로 고릅니다. 같은 종 셋이 서 있으면
         여덟 종을 만든 의미가 화면에서 사라집니다. */
      const p = {
        id: 'bot3-' + i, nick: BOT_NICKS[(n0 + i * 3) % BOT_NICKS.length],
        species: BOT_SPECIES[(s0 + i * 3) % BOT_SPECIES.length],
        fit: (f0 + i * 5) % 8, bot: true,
        buf: [], say: '', sayT: 0, emo: '', emoT: 0,
      };
      /* 광장 언저리를 크게 도는 고리 하나씩.
         길찾기는 없습니다 — net.js 는 지도를 모릅니다. 그래서
         고리를 한가운데로만 잡아 둡니다. 봇을 건물 사이로 보낼 거면
         index.html 에서 길을 받아 와야 합니다. */
      const cx = (r() * 2 - 1) * 12, cz = (r() * 2 - 1) * 12;
      const rad = 7 + r() * 8, legs = 3 + Math.floor(r() * 2), a0 = r() * Math.PI * 2;
      const route = [];
      for (let k = 0; k < legs; k++) {
        const a = a0 + (k / legs) * Math.PI * 2, rr = rad * (.7 + r() * .6);
        route.push({ x: clampR(cx + Math.sin(a) * rr), z: clampR(cz + Math.cos(a) * rr) });
      }
      out.push({ p, route, leg: 1 % route.length,
        x: route[0].x, z: route[0].z, dir: 0, moving: false,
        sp: 1.2 + r() * .8,                 // 걷는 빠르기 — 뛰면 사람으로 안 읽힙니다
        wait: r() * 2, enter: .6 + i * 1.3 });   // 한꺼번에 안 나타납니다
    }
    return out;
  }
  function stepBot(b, dt, now) {
    if (b.enter > 0) { b.enter -= dt; return; }
    if (!peers.has(b.p.id)) { peers.set(b.p.id, b.p); opts.onPeers?.(peers); }
    if (b.wait > 0) { b.wait -= dt; b.moving = false; }
    else {
      const w = b.route[b.leg];
      const dx = w.x - b.x, dz = w.z - b.z, d = Math.hypot(dx, dz);
      if (d < .4) {
        b.leg = (b.leg + 1) % b.route.length;
        b.wait = 1.5 + Math.random() * 3.5;    // 가끔 멈춰 서야 인형이 아닙니다
        b.moving = false;
      } else {
        const s = Math.min(d, b.sp * dt);
        b.x += dx / d * s; b.z += dz / d * s;
        b.dir = Math.atan2(dx / d, dz / d);    // 가는 쪽을 봅니다(index.html 과 같은 규칙)
        b.moving = true;
      }
    }
    /* 진짜 'm' 이 하는 줄과 같습니다. sample() 은 130ms 뒤를 보므로 이
       버퍼가 없으면 봇은 아예 안 그려집니다. */
    b.p.buf.push({ t: now, x: b.x, z: b.z, dir: b.dir, moving: b.moving });
    while (b.p.buf.length > 2 && now - b.p.buf[0].t > BUF_KEEP) b.p.buf.shift();
  }
  /* 말과 감정표현은 진짜 사람이 쓰는 그 칸을 그대로 씁니다.
     드물게 둡니다 — 넷이서 쉬지 않고 떠들면 캠퍼스가 아니라 광고판입니다. */
  function botSpeak(now) {
    const live = bots.filter((b) => b.enter <= 0);
    if (!live.length) return;
    const b = pick(live);
    if (Math.random() < .3) { b.p.emo = pick(BOT_EMOS); b.p.emoT = now; }
    else {
      b.p.say = pick(BOT_LINES); b.p.sayT = now;
      opts.onSay?.(b.p, b.p.say);
    }
  }
  function botTick() {
    if (!bots) return;
    try {
      const now = performance.now();
      /* 탭이 뒤로 가면 setInterval 이 늘어집니다. 안 자르면 돌아왔을 때
         봇이 한 번에 몇 미터를 순간이동합니다. */
      const dt = Math.min(.25, (now - botLast) / 1000);
      botLast = now;
      for (const b of bots) stepBot(b, dt, now);
      botSayT -= dt;
      if (botSayT <= 0) { botSayT = BOT_SAY_MIN + Math.random() * 14; botSpeak(now); }
      botFails = 0;                            // 한 번 지나갔으면 앞의 실패는 잊습니다
    } catch (e) {
      /* 흉내가 넘어져도 월드는 돕니다 — 이 함수는 부르는 쪽 프레임이
         아니라 제 타이머 위에서 돕니다. 연달아 넘어지면 조용히 접고
         'offline' 이라고 말합니다. 못 하는 것을 하는 척하지 않습니다.
         못 붙은 원래 이유는 지우지 않고 뒤에 덧붙입니다. */
      if (++botFails > 4) {
        botBroken = true; stopBots();
        if (!dead && N.mode === 'local') {
          N.mode = 'offline';
          N.error = (N.error || '연결 없음') + ' · 흉내도 실패(' + (e?.message || e) + ')';
          opts.onMode?.(N.mode);
        }
      }
    }
  }
  function startBots() {
    /* 2026-08-27 — 봇을 세우지 않습니다.
       "설정이 없는 사람이 열면 캠퍼스가 폐교로 보인다" 는 이유로 넣은
       것인데, 제출본에서는 **그 폐교가 사실**입니다. 서버에 아무도
       없는데 이웃 다섯이 걸어 다니면 화면이 거짓말을 합니다.
       봇을 되살리려면 이 한 줄만 지우면 됩니다 — 아래 장치는 그대로
       두었습니다(2D 판의 LocalTransport 와 짝이 맞아야 해서요). */
    if (!BOTS_ON) return;
    if (bots || botTimer || dead || botBroken) return;
    try { bots = makeBots(); } catch { botBroken = true; return; }
    botLast = performance.now();
    botSayT = 12 + Math.random() * 10;        // 들어오자마자 말 걸지는 않습니다
    botFails = 0;
    botTimer = setInterval(botTick, BOT_TICK_MS);
  }
  function stopBots() {
    if (botTimer) { clearInterval(botTimer); botTimer = 0; }
    if (!bots) return;
    for (const b of bots) if (peers.delete(b.p.id)) opts.onGone?.(b.p.id);
    bots = null; opts.onPeers?.(peers);
  }
  /* 봇이 살 조건은 셋뿐입니다: 진짜를 놓았고 · 아직 살아 있고 · 바깥일 것 */
  function syncBots() {
    if (fellBack && !dead && zone === 'campus') startBots(); else stopBots();
  }
  /** 진짜를 놓고 흉내로 내려갑니다. 이유는 error 에 그대로 둡니다 —
      감추면 "아무도 없네" 와 "못 붙었네" 가 같은 화면이 됩니다. */
  function goLocal(why) {
    clearTimeout(t0); giveUp();
    if (dead) return;
    N.error = why || '연결 없음';
    fellBack = true; syncBots();
    /* 방 안이라 봇이 하나도 없어도 'local' 입니다. 이 값은 "사람이 있나"
       가 아니라 "진짜 서버에 붙었나" 를 말합니다. */
    N.mode = (botBroken || !BOTS_ON) ? 'offline' : 'local';
    opts.onMode?.(N.mode);
  }

  function dispose() {
    dead = true; clearTimeout(t0);
    stopBots();
    if (client && ch) try { client.removeChannel(ch); } catch {}
  }
  /* 지금 그려야 할 자리 — 130ms 뒤를 봅니다(그래야 끊기지 않습니다) */
  N.sample = (p) => {
    const now = performance.now() - INTERP_DELAY;
    const b = p.buf;
    if (!b.length) return null;
    if (b.length === 1) return b[0];
    for (let i = b.length - 1; i > 0; i--) {
      if (b[i - 1].t <= now && b[i].t >= now) {
        const s = (now - b[i - 1].t) / Math.max(1, b[i].t - b[i - 1].t);
        const a = b[i - 1], c = b[i];
        let dd = ((c.dir - a.dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        return { x: a.x + (c.x - a.x) * s, z: a.z + (c.z - a.z) * s,
                 dir: a.dir + dd * s, moving: c.moving };
      }
    }
    return b[b.length - 1];
  };
  return N;
}

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
   ══════════════════════════════════════════════════════════ */

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

export function createNet(opts) {
  const me = {
    id: 'g3-' + Math.random().toString(36).slice(2, 9),
    nick: opts.nick || '나', species: opts.species, fit: opts.fit,
  };
  const peers = new Map();        // id → { id, nick, species, fit, buf[], say, sayT, emo, emoT }
  const N = {
    mode: 'connecting', me, peers,
    error: null,
    setZone, move, say, emote, dispose, setLook,
  };
  let client = null, ch = null, zone = 'campus', dead = false;
  let lastSend = 0, lastPresence = 0, lastKey = '';
  let pos = { x: 0, z: 0, dir: 0, moving: false };

  /* 못 붙으면 **완전히 놓습니다.** 안 놓으면 SDK 가 몇 초마다 다시 붙으려
     하고, 그 재시도가 웹캠 추론과 CPU 를 나눠 씁니다(콘솔도 도배됩니다). */
  const t0 = setTimeout(() => {
    if (N.mode !== 'connecting') return;
    N.mode = 'offline'; N.error = '연결 시간 초과'; opts.onMode?.(N.mode);
    giveUp();
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
      N.mode = 'offline'; N.error = e.message || String(e);
      opts.onMode?.(N.mode);
    }
  })();

  function peer(id) {
    let p = peers.get(id);
    if (!p) peers.set(id, p = { id, nick: '', species: '거북이', fit: 0, buf: [], say: '', sayT: 0, emo: '', emoT: 0 });
    return p;
  }
  function join(z) {
    if (!client) return;
    if (ch) { try { client.removeChannel(ch); } catch {} ch = null; }
    peers.clear(); opts.onReset?.();
    const c = client.channel('world3d:' + z, {
      config: { broadcast: { self: false, ack: false }, presence: { key: me.id } },
    });
    c.on('broadcast', { event: 'm' }, (msg) => {
      const p = msg?.payload; if (!p || p.id === me.id) return;
      const r = peer(p.id);
      r.buf.push({ t: performance.now(), x: p.x, z: p.z, dir: p.dir, moving: !!p.moving });
      while (r.buf.length > 2 && performance.now() - r.buf[0].t > BUF_KEEP) r.buf.shift();
    });
    c.on('broadcast', { event: 'say' }, (msg) => {
      const p = msg?.payload; if (!p || p.id === me.id) return;
      const r = peer(p.id); r.say = String(p.text || '').slice(0, 80); r.sayT = performance.now();
      opts.onSay?.(r, r.say);
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
        r.nick = e.nick || r.nick; r.species = e.species || r.species; r.fit = e.fit ?? r.fit;
        if (!r.buf.length && typeof e.x === 'number')
          r.buf.push({ t: performance.now(), x: e.x, z: e.z, dir: e.dir || 0, moving: false });
      });
      [...peers.keys()].forEach((id) => { if (!live.has(id)) { peers.delete(id); opts.onGone?.(id); } });
      opts.onPeers?.(peers);
    });
    c.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(t0);
        N.mode = 'online'; N.error = null; opts.onMode?.(N.mode);
        track();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        N.mode = 'offline'; N.error = status; opts.onMode?.(N.mode);
        clearTimeout(t0); giveUp();
      }
    });
    ch = c; zone = z;
  }
  function track() {
    if (!ch) return;
    lastPresence = performance.now();
    try {
      ch.track({ id: me.id, nick: me.nick, species: me.species, fit: me.fit,
        x: +pos.x.toFixed(2), z: +pos.z.toFixed(2), dir: +pos.dir.toFixed(2) });
    } catch {}
  }
  function setLook(species, fit, nick) {
    me.species = species; me.fit = fit; if (nick) me.nick = nick;
    track();
  }
  function setZone(z) { if (z !== zone && client) join(z); else zone = z; }
  function move(x, z, dir, moving) {
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
        id: me.id, x: +x.toFixed(2), z: +z.toFixed(2), dir: +dir.toFixed(2), moving } });
    } catch {}
  }
  function say(text) {
    const t = String(text || '').slice(0, 80);
    if (!t) return;
    if (N.mode === 'online' && ch)
      try { ch.send({ type: 'broadcast', event: 'say', payload: { id: me.id, text: t } }); } catch {}
  }
  function emote(k) {
    if (N.mode === 'online' && ch)
      try { ch.send({ type: 'broadcast', event: 'emo', payload: { id: me.id, k } }); } catch {}
  }
  function dispose() {
    dead = true; clearTimeout(t0);
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

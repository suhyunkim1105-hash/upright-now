/* ==================================================================
   기린캠퍼스 — 멀티플레이 기반

   index.html 이 다 뜬 뒤에 읽힙니다. index.html 의 전역(T, ZONES,
   player, camX/camY, ctx, urban …)을 그대로 씁니다.

   여기서 하는 일은 셋입니다.
     1. 전송 계층을 인터페이스 하나로 좁힙니다 (Transport).
     2. 남의 위치를 **띄엄띄엄** 받아 **부드럽게** 그립니다 (보간).
     3. 서버가 아직 없으니 가짜 서버를 하나 붙여 둡니다.

   서버는 아직 없습니다. 그래서 LocalTransport 가 가짜 플레이어 넷을
   자기 안에서 굴리고, 진짜 서버처럼 초당 열 번만 스냅샷을 흘립니다.
   일부러 열 번입니다 — 60번 흘리면 보간이 맞는지 영영 모릅니다.
   ================================================================== */
(function () {
  'use strict';

  /* ---------------- 숫자 ----------------
     SEND_HZ 10 · INTERP_DELAY 120ms.

     보간 지연은 **패킷 간격보다 커야** 합니다. 10Hz 면 간격이 100ms 이고,
     여기에 흔들림 여유를 조금 더한 것이 120ms 입니다. 이보다 짧게 잡으면
     다음 스냅샷이 늦을 때마다 캐릭터가 멈췄다 튑니다. 길게 잡으면
     부드럽지만 남이 실제보다 뒤에 보입니다. 걸어다니기만 하는 월드라
     지연 쪽으로 넉넉히 잡았습니다. */
  const SEND_HZ = 10;
  const SEND_MS = 1000 / SEND_HZ;
  const INTERP_DELAY = 120;
  const BUF_KEEP = 1200;      // 이보다 오래된 스냅샷은 버립니다

  /* 캐릭터 시트에서 사람 한 벌이 있는 자리. index.html 의
     CHAR_BASE / DIR_COL / WALK_ROW 와 같은 칸을 가리킵니다. */
  const SHEET_COL = 23, SHEET_W = 4, SHEET_H = 3;

  /* ================================================================
     Transport — 서버를 붙일 때 **이 객체만** 갈아 끼웁니다.

       connect(handlers)   handlers = { onJoin, onLeave, onState, onChat }
       send(msg)           msg = { type:'state', … } | { type:'chat', … }
       disconnect()

     오가는 것 두 가지뿐입니다.
       state { type:'state', t, zone, x, y, dir, flip, moving }
       chat  { type:'chat',  t, text, emoji }

     t 는 **보낸 쪽 시계**입니다. 클라이언트가 자기 시계와의 차이를
     따로 재기 때문에(clockOffset) 서버가 시계를 맞춰 줄 필요는 없습니다.

     chat 은 보낸 사람에게도 되돌려 줘야 합니다(에코). 그래야 내 말풍선이
     남의 말풍선과 같은 길로 오고, 필터·차단을 한 군데서만 걸면 됩니다.

     Supabase Realtime 으로 바꾼다면 이 정도입니다:

       const ch = supabase.channel('campus');
       return {
         name: 'supabase',
         connect(h) {
           ch.on('broadcast', { event: 'state' }, ({ payload }) =>
                 h.onState(payload.id, payload))
             .on('broadcast', { event: 'chat' }, ({ payload }) =>
                 h.onChat(payload.id, payload))
             .on('presence', { event: 'join' },  ({ newPresences }) =>
                 newPresences.forEach((p) => h.onJoin(p.id, p)))
             .on('presence', { event: 'leave' }, ({ leftPresences }) =>
                 leftPresences.forEach((p) => h.onLeave(p.id)))
             .subscribe();
         },
         send(m) { ch.send({ type: 'broadcast', event: m.type, payload: m }); },
         disconnect() { ch.unsubscribe(); },
       };

     주의: 위치는 broadcast 로 흘리고 **DB 에 쓰지 않습니다.** 초당 열 번
     × 사람 수만큼 insert 하면 비용도 지연도 감당이 안 됩니다.
     ================================================================ */

  /* ================== 원격 플레이어 ================== */

  function Remote(id, profile) {
    return {
      id,
      nick: profile.nick || '누군가',
      school: profile.school || '',
      hue: profile.hue || 0,
      buf: [],            // 받은 스냅샷 (시간순)
      zone: profile.zone || 'campus',
      /* 화면에 그릴 값 — 매 프레임 buf 에서 새로 만듭니다 */
      x: 0, y: 0, dir: 'down', flip: false, moving: false,
      anim: 0, frame: 0,
      ready: false,       // 스냅샷을 두 개 이상 받아야 그립니다
    };
  }

  const remotes = new Map();

  /* 남의 시계와 내 시계의 차이. 가장 **덜 늦은** 표본을 정답으로 칩니다 —
     네트워크는 늦어지기만 하지 빨라지지 않으므로, 관측한 offset 중
     최솟값이 진짜 시차에 가장 가깝습니다. */
  let clockOffset = null;
  function noteClock(sentAt) {
    const o = performance.now() - sentAt;
    if (clockOffset === null || o < clockOffset) clockOffset = o;
  }

  /* ---------------- 보간 ----------------
     "지금"이 아니라 "120ms 전"을 그립니다. 그 시점을 감싸는 스냅샷 두
     개 사이를 선형으로 잇습니다. 두 개가 없으면(막 들어왔거나 끊겼거나)
     가장 가까운 것을 그대로 씁니다 — 없는 데이터를 지어내지 않습니다. */
  function resolve(rp, now) {
    const b = rp.buf;
    if (!b.length) return;
    const t = now - (clockOffset || 0) - INTERP_DELAY;

    let a = null, c = null;
    for (let i = b.length - 1; i >= 0; i--) {
      if (b[i].t <= t) { a = b[i]; c = b[i + 1] || null; break; }
    }
    let s, k = 0;
    if (a && c) { s = a; k = (t - a.t) / (c.t - a.t); }
    else if (a) { s = a; c = null; }          // 아직 다음 게 안 왔음 → 멈춰 세웁니다
    else { s = b[0]; c = null; }              // 아직 과거가 없음 → 첫 스냅샷 자리

    const px = rp.x, py = rp.y;
    rp.x = c ? s.x + (c.x - s.x) * k : s.x;
    rp.y = c ? s.y + (c.y - s.y) * k : s.y;
    rp.zone = s.zone;
    rp.dir = s.dir; rp.flip = s.flip;

    /* 걷는 그림은 **실제로 움직인 거리**로 넘깁니다. moving 플래그만
       믿으면 보간이 멈춘 프레임에도 다리가 움직여 미끄러져 보입니다. */
    const d = rp.ready ? Math.hypot(rp.x - px, rp.y - py) : 0;
    rp.moving = d > 0.05;
    if (rp.moving) { rp.anim += d / 3.2; rp.frame = Math.floor(rp.anim); }
    else { rp.anim = 0; rp.frame = 0; }
    rp.ready = true;

    /* 오래된 것 버리기 */
    while (b.length > 2 && b[1].t < t - BUF_KEEP) b.shift();
  }

  /* ================== 그리기 ================== */

  /* 사람마다 색을 돌려 씁니다. 시트에 사람이 한 벌뿐이라 넷이 똑같이
     생기면 누가 누군지 구분이 안 됩니다. 한 번 구워 두고 씁니다 —
     매 프레임 filter 를 걸면 그때마다 다시 칠합니다. */
  const sheets = new Map();
  function sheetFor(hue) {
    if (sheets.has(hue)) return sheets.get(hue);
    const c = document.createElement('canvas');
    c.width = SHEET_W * T; c.height = SHEET_H * T;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    if (hue) g.filter = 'hue-rotate(' + hue + 'deg) saturate(1.15)';
    g.drawImage(urban, SHEET_COL * T, 0, SHEET_W * T, SHEET_H * T,
                0, 0, SHEET_W * T, SHEET_H * T);
    sheets.set(hue, c);
    return c;
  }

  /** index.html 의 draw() 가 y 정렬 목록을 만들 때 불러 줍니다.
      같은 목록에 끼워야 남이 나무 뒤로 걸어 들어갑니다. */
  function collect(items) {
    const now = performance.now();
    for (const rp of remotes.values()) {
      resolve(rp, now);
      if (!rp.ready || rp.zone !== zoneId) continue;
      items.push({ sort: sortKey(rp.y, rp.x), kind: 'mp', rp });
    }
  }

  function drawOne(rp) {
    const dx = Math.round(rp.x - T / 2 - camX);
    const dy = Math.round(rp.y - T - camY);

    /* 그림자는 장식입니다. 성능 모드에서 제일 먼저 끕니다. */
    if (!(window.PERF && PERF.on)) {
      ctx.save();
      ctx.globalAlpha = 0.22; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(dx + T / 2, dy + T - 1, 5, 2.2, 0, 0, 7); ctx.fill();
      ctx.restore();
    }

    const sheet = sheetFor(rp.hue);
    const col = DIR_COL[rp.dir] ?? 0;
    const row = rp.moving ? WALK_ROW[rp.frame & 3] : 0;
    const sx = col * T, sy = row * T;
    const bob = rp.moving && !(window.PERF && PERF.on)
      ? (Math.floor(rp.anim * 2) % 2 ? -1 : 0) : 0;

    if (rp.dir === 'side' && rp.flip) {
      ctx.save(); ctx.translate(dx + T, dy + bob); ctx.scale(-1, 1);
      ctx.drawImage(sheet, sx, sy, T, T, 0, 0, T, T); ctx.restore();
    } else {
      ctx.drawImage(sheet, sx, sy, T, T, dx, dy + bob, T, T);
    }
  }

  /* ================== 이름표 ==================
     캔버스가 아니라 DOM 입니다. 월드 배율이 4배라 캔버스에 쓰면 글자가
     사람보다 커지고, 픽셀 폰트로 줄이면 한글이 뭉갭니다. DOM 이면
     또렷하고, 스크린리더도 읽고, 대비도 CSS 로 맞춥니다. */
  const layer = document.createElement('div');
  layer.id = 'mp-layer';
  layer.setAttribute('aria-hidden', 'true');   // 목록은 아래 라이브 영역이 읽습니다
  document.body.append(layer);

  const roster = document.createElement('div');
  roster.id = 'mp-roster';
  roster.setAttribute('aria-live', 'polite');
  roster.className = 'sr-only';
  document.body.append(roster);

  const tags = new Map();     // id -> { el, nick, school }
  function tagFor(rp) {
    let t = tags.get(rp.id);
    if (!t) {
      const el = document.createElement('div');
      el.className = 'mp-tag';
      el.innerHTML = '<b></b><i></i>';
      layer.append(el);
      t = { el, nick: null, school: null, bubble: null };
      tags.set(rp.id, t);
    }
    if (t.nick !== rp.nick) { t.nick = rp.nick; t.el.querySelector('b').textContent = rp.nick; }
    if (t.school !== rp.school) {
      t.school = rp.school;
      t.el.querySelector('i').textContent = rp.school;
    }
    return t;
  }

  let rect = cv.getBoundingClientRect();
  window.addEventListener('resize', () => { rect = cv.getBoundingClientRect(); });

  /** 월드 좌표 → 화면 좌표. 말풍선도 같은 걸 씁니다. */
  function toScreen(wx, wy) {
    return { x: rect.left + (wx - camX) * SCALE, y: rect.top + (wy - camY) * SCALE };
  }

  function syncTags() {
    rect = cv.getBoundingClientRect();
    for (const rp of remotes.values()) if (rp.ready) tagFor(rp);
    for (const [id, t] of tags) {
      const rp = remotes.get(id);
      if (!rp || !rp.ready || rp.zone !== zoneId) { t.el.style.display = 'none'; continue; }
      const p = toScreen(rp.x, rp.y - T);
      /* 화면 밖이면 감춥니다. 안 그러면 지도 가장자리에서 이름만 남습니다. */
      if (p.x < rect.left - 40 || p.x > rect.right + 40 ||
          p.y < rect.top - 40 || p.y > rect.bottom + 40) {
        t.el.style.display = 'none'; continue;
      }
      /* 회의 결정 — 이름표는 기본 감춤. 캐릭터에 커서를 올렸을 때만
         닉네임·학교 툴팁으로 보여 줍니다. window.MOUSE 는 index.html 이
         채웁니다. */
      const M = window.MOUSE;
      const hov = M && Math.abs(M.x - p.x) <= T * SCALE / 2 &&
                  M.y >= p.y - 4 && M.y <= p.y + T * SCALE + 4;
      if (!hov) { t.el.style.display = 'none'; continue; }
      t.el.style.display = 'block';
      t.el.style.left = p.x + 'px';
      t.el.style.top = (p.y - 6) + 'px';
    }
  }

  /** 스크린리더용 — 같은 공간에 누가 있는지 글로 알립니다. */
  let rosterKey = '';
  function syncRoster() {
    const here = [...remotes.values()]
      .filter((r) => r.ready && r.zone === zoneId)
      .map((r) => r.nick + ' · ' + r.school);
    const key = here.join('|');
    if (key === rosterKey) return;
    rosterKey = key;
    roster.textContent = here.length
      ? '같은 공간에 ' + here.length + '명 — ' + here.join(', ')
      : '같은 공간에 다른 사람이 없습니다';
  }

  /* ================== 내 위치 올리기 ================== */
  let lastSent = 0, lastSentKey = '';
  function pushSelf(now) {
    if (now - lastSent < SEND_MS) return;
    lastSent = now;
    /* 안 움직이면 안 보냅니다. 서 있는 사람 몫으로 초당 열 번을 쓰는 건
       낭비입니다. 다만 한 번은 더 보내 "멈췄다"를 알립니다. */
    const key = [zoneId, Math.round(player.x), Math.round(player.y),
                 player.dir, player.flip, player.moving].join(',');
    if (key === lastSentKey) return;
    lastSentKey = key;
    MP.send({
      type: 'state', t: now, zone: zoneId,
      x: player.x, y: player.y,
      dir: player.dir, flip: player.flip, moving: player.moving,
    });
  }

  /* ================== 핸들러 ================== */
  const listeners = { chat: [], join: [], leave: [] };
  function emit(kind, ...a) { listeners[kind].forEach((f) => f(...a)); }

  const handlers = {
    onJoin(id, profile) {
      if (!remotes.has(id)) remotes.set(id, Remote(id, profile || {}));
      emit('join', remotes.get(id));
    },
    onLeave(id) {
      remotes.delete(id);
      const t = tags.get(id);
      if (t) { t.el.remove(); tags.delete(id); }
      emit('leave', id);
    },
    onState(id, s) {
      const rp = remotes.get(id);
      if (!rp) return;
      noteClock(s.t);
      /* 늦게 도착한 옛날 스냅샷은 버립니다. 끼워 넣으면 뒤로 걷습니다. */
      const b = rp.buf;
      if (b.length && s.t <= b[b.length - 1].t) return;
      b.push(s);
    },
    onChat(id, m) {
      const rp = remotes.get(id);
      emit('chat', {
        id,
        nick: id === MP.meId ? (ROOM.nickname || '나') : (rp ? rp.nick : '???'),
        mine: id === MP.meId,
        text: m.text || '',
        emoji: m.emoji || '',
      });
    },
  };

  /* ================== 공개 ================== */
  const MP = {
    meId: 'me',
    remotes,
    collect, drawOne, toScreen,
    /** 남의 머리 위 화면 좌표 — 말풍선이 씁니다 */
    headOf(id) {
      if (id === MP.meId) return toScreen(player.x, player.y - T);
      const rp = remotes.get(id);
      if (!rp || !rp.ready || rp.zone !== zoneId) return null;
      return toScreen(rp.x, rp.y - T);
    },
    visible(id) {
      if (id === MP.meId) return true;
      const rp = remotes.get(id);
      return !!(rp && rp.ready && rp.zone === zoneId);
    },
    on(kind, fn) { listeners[kind].push(fn); },
    transport: null,
    setTransport(t) {
      if (MP.transport) MP.transport.disconnect();
      /* 사람이 남아 있으면 지웁니다 — 서버가 바뀌면 명단도 바뀝니다 */
      [...remotes.keys()].forEach(handlers.onLeave);
      MP.transport = t;
      t.connect(handlers);
    },
    send(msg) { if (MP.transport) MP.transport.send(msg); },
    /** 채팅에서 부릅니다. 서버가 나에게도 되돌려 주므로 여기서는 안 그립니다. */
    say(text, emoji) {
      MP.send({ type: 'chat', t: performance.now(), text: text || '', emoji: emoji || '' });
    },
  };
  window.MP = MP;

  /* ================== 가짜 서버 ==================
     진짜 서버가 붙기 전까지만 삽니다. 안에서 사람 넷을 굴리고,
     밖으로는 초당 열 번짜리 스냅샷만 흘립니다 — 실제 서버와 같은
     굵기로 내보내야 보간이 맞는지 눈으로 볼 수 있습니다. */
  const FAKE = [
    /* hue 0 은 내 캐릭터와 같은 색이라 안 씁니다 — 광장에서 나를 못 찾습니다 */
    { id: 'p1', nick: '느린거북', school: '명지대학교', hue: 320, speed: 46 },
    { id: 'p2', nick: '목긴기린', school: '홍익대학교', hue: 55,  speed: 62 },
    { id: 'p3', nick: '서서보는미어캣', school: '명지대학교', hue: 150, speed: 40 },
    { id: 'p4', nick: '쉬는돼지', school: '서강대학교', hue: 250, speed: 52 },
  ];
  const FAKE_LINES = [
    '도서관 자리 남았어요?', '30분만 더 앉아 있을게요',
    '목이 뻐근하네요… 운동장 갔다 올게요', '본관 음악 오늘 괜찮은데요',
    '방금 회복 3번째', '같이 앉을 사람', '커피 마시고 올게요',
  ];
  const EMOJIS = ['👍', '😂', '🔥', '💪', '👀'];

  function LocalTransport() {
    let h = null, timer = 0, chatTimer = 0, alive = false;
    const m = ZONES.campus;
    const bots = [];

    function solidIn(px, py) {
      const tx = Math.floor(px / T), ty = Math.floor(py / T);
      if (!inMap(m, tx, ty)) return true;
      return m.solid[at(m, tx, ty)] === 1;
    }
    /* index.html 의 BOX 와 같은 크기입니다. 다르면 남만 벽을 통과합니다. */
    function free(px, py) {
      const l = px - 4.5, r = px + 3.5, t = py - 6, b = py - 1;
      return !(solidIn(l, t) || solidIn(r, t) || solidIn(l, b) || solidIn(r, b));
    }
    function pickTarget() {
      /* 광장 언저리에서만 고릅니다. 지도 아무 데나 고르면 절반은
         호수 건너편이라 벽에 붙어 비비기만 합니다. */
      for (let i = 0; i < 40; i++) {
        const tx = 11 + Math.random() * 23, ty = 13 + Math.random() * 14;
        const px = tx * T, py = ty * T;
        if (free(px, py)) return { x: px, y: py };
      }
      return { x: 22 * T, y: 25 * T };
    }

    function spawn(def) {
      const p = pickTarget();
      bots.push({
        ...def, x: p.x, y: p.y, dir: 'down', flip: false, moving: false,
        target: pickTarget(), wait: Math.random() * 2, stuck: 0,
      });
    }

    /* 봇 한 걸음. 서버 쪽 계산입니다 — 클라이언트는 결과만 받습니다. */
    function stepBot(b, dt) {
      if (b.wait > 0) { b.wait -= dt; b.moving = false; return; }
      let dx = b.target.x - b.x, dy = b.target.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 3) { b.target = pickTarget(); b.wait = 0.6 + Math.random() * 2.5; b.moving = false; return; }
      dx /= dist; dy /= dist;
      const step = b.speed * dt;
      const nx = b.x + dx * step, ny = b.y + dy * step;
      let moved = false;
      if (free(nx, b.y)) { b.x = nx; moved = true; }
      if (free(b.x, ny)) { b.y = ny; moved = true; }
      b.moving = moved;
      /* 막히면 다른 데로 갑니다. 길찾기를 넣을 자리지만, 광장은 뚫려
         있어서 목표만 다시 골라도 충분합니다.
         ponytail: 길찾기 없음 — 실내나 좁은 길에 봇을 세울 거면 A* 필요 */
      if (!moved) { if (++b.stuck > 8) { b.target = pickTarget(); b.stuck = 0; } }
      else b.stuck = 0;
      if (Math.abs(dx) > Math.abs(dy)) { b.dir = 'side'; b.flip = dx < 0; }
      else b.dir = dy < 0 ? 'up' : 'down';
    }

    let simLast = 0;
    function tick() {
      if (!alive) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - simLast) / 1000);
      simLast = now;
      for (const b of bots) stepBot(b, dt);
      timer += dt * 1000;
      if (timer >= SEND_MS) {
        timer = 0;
        for (const b of bots) {
          h.onState(b.id, {
            type: 'state', t: now, zone: 'campus',
            x: b.x, y: b.y, dir: b.dir, flip: b.flip, moving: b.moving,
          });
        }
      }
      chatTimer -= dt;
      if (chatTimer <= 0) {
        chatTimer = 7 + Math.random() * 12;
        const b = bots[Math.floor(Math.random() * bots.length)];
        if (b) {
          const emo = Math.random() < 0.25;
          h.onChat(b.id, emo
            ? { text: '', emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)] }
            : { text: FAKE_LINES[Math.floor(Math.random() * FAKE_LINES.length)] });
        }
      }
      requestAnimationFrame(tick);
    }

    return {
      name: 'local-mock',
      connect(handlersIn) {
        h = handlersIn;
        alive = true;
        simLast = performance.now();
        /* 한꺼번에 들어오지 않습니다. 진짜 서버도 그렇고, 한 명씩
           나타나야 join 처리가 되는지 눈으로 봅니다. */
        FAKE.forEach((def, i) => setTimeout(() => {
          if (!alive) return;
          spawn(def);
          h.onJoin(def.id, def);
        }, 400 + i * 700));
        requestAnimationFrame(tick);
      },
      send(msg) {
        /* 서버 에코 — 내가 보낸 채팅은 나에게 되돌아옵니다.
           state 는 나에게 되돌리지 않습니다(내 캐릭터는 내가 그립니다). */
        if (msg.type === 'chat') setTimeout(() => alive && h.onChat(MP.meId, msg), 30);
      },
      disconnect() { alive = false; bots.length = 0; },
    };
  }
  MP.LocalTransport = LocalTransport;

  /* ================== 스타일 ==================
     index.html 의 <style> 을 건드리지 않으려고 여기서 넣습니다.
     다른 세션이 같은 파일을 고치는 중이라 충돌을 만들지 않는 쪽이
     낫습니다. 합칠 때 <style> 로 옮기면 됩니다. */
  const css = document.createElement('style');
  css.textContent = `
  .sr-only {
    position: absolute; width: 1px; height: 1px; margin: -1px;
    padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
  #mp-layer { position: fixed; inset: 0; pointer-events: none; z-index: 5; }
  .mp-tag {
    position: absolute; transform: translate(-50%, -100%);
    text-align: center; white-space: nowrap; line-height: 1.15;
  }
  /* 흰 알약 위 잉크. 월드 위에 얹히므로 배경 없이 두면 잔디에서
     읽히다가 포장 위에서 사라집니다. */
  .mp-tag b {
    display: inline-block; padding: 2px 7px; border-radius: 999px;
    background: rgba(255,255,255,.94); color: #2A2320;
    font-size: 10.5px; font-weight: 700; letter-spacing: -.01em;
    box-shadow: 0 1px 3px rgba(78,47,38,.22), 0 0 0 1px rgba(78,47,38,.08);
  }
  /* 학교도 알약입니다. 글자에 흰 테두리만 두르면 잔디 위에서는 읽히다가
     밝은 포장 위에서 3.4:1 로 떨어집니다 — 9.5px 글자에는 못 씁니다.
     바탕을 깔면 배경이 무엇이든 7.6:1 로 고정됩니다. */
  .mp-tag i {
    display: inline-block; margin-top: 2px; font-style: normal;
    padding: 1px 6px; border-radius: 999px;
    background: rgba(255,255,255,.90); color: #5A4A44;
    font-size: 9.5px; font-weight: 600;
  }
  .perf .mp-tag b { box-shadow: 0 0 0 1px rgba(78,47,38,.22); }
  `;
  document.head.append(css);

  /* ================== 루프 ==================
     게임 루프와 따로 돕니다. index.html 을 안 건드리려는 것도 있지만,
     전송 주기와 화면 주기는 원래 다른 시계입니다. */
  function loop() {
    const now = performance.now();
    pushSelf(now);
    syncTags();
    syncRoster();
    requestAnimationFrame(loop);
  }

  /* 시트를 굽자면 urban.png 가 있어야 합니다. 로딩이 끝난 뒤 시작합니다. */
  function boot() {
    if (!urban.complete || !urban.naturalWidth) { setTimeout(boot, 100); return; }
    MP.setTransport(LocalTransport());
    requestAnimationFrame(loop);
  }
  boot();
})();

/* ==================================================================
   Deskfit — 멀티플레이 기반

   index.html 이 다 뜬 뒤에 읽힙니다. index.html 의 전역(T, TS, AS, BOX,
   ZONES, player, camX/camY, ctx, urban …)을 그대로 씁니다.
   T 는 월드 타일(32), TS 는 그림 한 칸(16), AS 는 그 배율입니다 —
   **자를 때는 TS, 얹을 때는 T** 입니다.

   여기서 하는 일은 셋입니다.
     1. 전송 계층을 인터페이스 하나로 좁힙니다 (Transport).
     2. 남의 위치를 **띄엄띄엄** 받아 **부드럽게** 그립니다 (보간).
     3. 진짜 서버(Supabase Realtime)에 붙이고, 못 붙으면 봇으로 물러납니다.

   진짜 서버가 붙었습니다. SupabaseTransport 가 존별 채널 하나에
   presence(누가 있나 · 어떤 모습인가)와 broadcast(어디 있나)를 같이
   씁니다. LocalTransport(봇 넷)는 남겨 뒀습니다 — 언제 사는지는
   아래 "봇을 왜 남겼나" 를 보세요.

   ---- 캐릭터 크기 ----
   남도 내 캐릭터와 **같은 32x48** 로 그립니다. 그림은 index.html 이 열어
   두는 window.GIRIN_CHAR 에서만 받습니다(아래 charAPI 참고). 그 창구가
   아직 없으면 예전 16x16 Kenney 시트로 물러납니다 — 없다고 멈추면
   합치는 중에 화면에서 사람이 통째로 사라집니다.
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

  /* presence 를 다시 올리는 최소 간격.
     presence 는 "누가 있고 어떤 모습인가" 라 자주 보낼 것이 아닙니다.
     다만 x/y 를 같이 실어야 **늦게 들어온 사람**이 서 있는 사람을 봅니다 —
     안 움직이는 사람은 broadcast 를 한 줄도 안 보내므로, presence 에 든
     좌표가 그 사람의 유일한 자리입니다. 5초면 늦게 온 사람이 최대 5초
     묵은 자리를 잠깐 보고, 그 사람이 걷기 시작하면 곧바로 맞춰집니다. */
  const PRESENCE_MS = 5000;

  /* 붙는 데 이만큼 걸리면 포기하고 봇으로 물러납니다. 무한정 기다리면
     "사람이 없는 건지 못 붙은 건지" 를 화면이 영영 말 못 합니다. */
  const CONNECT_TIMEOUT_MS = 8000;

  /* 캐릭터 시트에서 사람 한 벌이 있는 자리. index.html 의
     CHAR_BASE / DIR_COL / WALK_ROW 와 같은 칸을 가리킵니다.
     GIRIN_CHAR 가 없을 때만 씁니다. */
  const SHEET_COL = 23, SHEET_W = 4, SHEET_H = 3;

  /* ================================================================
     캐릭터 그림 창구 — window.GIRIN_CHAR

     index.html 이 채웁니다. 우리는 읽기만 합니다.
       W, H          32, 48
       groundY       45 — 프레임 안에서 발바닥이 닿는 줄
       dirIndex      { right:0, up:1, left:2, down:3 }
       names         종 여덟
       sheetFor(종, worn, 학교) -> 128x48 캔버스 (right/up/left/down) | null
                     학교를 안 넘기면 과잠이 **내** 학교 색으로 칠해집니다.

     **매 프레임 찾습니다.** 한 번 찾아 변수에 담아 두면, 이 파일이 먼저
     읽히고 GIRIN_CHAR 가 나중에 붙는 순서일 때 영영 16x16 으로 남습니다.
     찾는 값은 캐시하므로(sheets) 매 프레임 하는 일은 Map 조회 하나입니다.
     ================================================================ */
  function charAPI() {
    const C = window.GIRIN_CHAR;
    return (C && typeof C.sheetFor === 'function' && C.W && C.groundY) ? C : null;
  }

  /* 종 이름. GIRIN_CHAR 가 아직 없을 때 id 로 종을 정하는 데만 씁니다 —
     창구가 붙으면 GIRIN_CHAR.names 가 정답입니다. */
  const FALLBACK_NAMES = ['거북이', '기린', '펭귄', '햄스터', '개구리', '고슴도치', '알파카', '백조'];
  const WORN_SLOTS = ['top', 'bottom', 'shoes', 'hat', 'glasses', 'bag'];

  /* ================================================================
     Transport — 서버를 붙일 때 **이 객체만** 갈아 끼웁니다.

       connect(handlers)   handlers = { onJoin, onLeave, onState, onChat }
       send(msg)           msg = { type:'state', … } | { type:'chat', … }
       disconnect()

     오가는 것 두 가지뿐입니다.
       state { type:'state', t, zone, x, y, dir, flip, moving }
       chat  { type:'chat',  t, text, emoji }

     join 프로필에 species(종 이름)와 worn({ top, bottom, shoes, hat,
     glasses, bag })을 같이 실으면 그 모습으로 그립니다. 안 실으면 id 로
     종을 정하고 맨몸으로 세웁니다 — 서버가 옷을 안 알려 줘도 사람은
     여덟 종으로 흩어져 보입니다.

     t 는 **보낸 쪽 시계**입니다. 클라이언트가 자기 시계와의 차이를
     따로 재기 때문에(clockOffset) 서버가 시계를 맞춰 줄 필요는 없습니다.

     chat 은 보낸 사람에게도 되돌려 줘야 합니다(에코). 그래야 내 말풍선이
     남의 말풍선과 같은 길로 오고, 필터·차단을 한 군데서만 걸면 됩니다.

     주의: 위치는 broadcast 로 흘리고 **DB 에 쓰지 않습니다.** 초당 열 번
     × 사람 수만큼 insert 하면 비용도 지연도 감당이 안 됩니다.
     ================================================================ */

  /* ================================================================
     내보내는 것 — 이 목록이 전부입니다

     presence(느림 · 사람이 들어오거나 모습이 바뀔 때)
       id · nick · school · species · worn · zone · x · y · dir · moving · sessionMs
     broadcast 'm' (초당 최대 열 번 · 움직일 때만)
       id · t · x · y · dir · flip · moving
     broadcast 'say' (사람이 말할 때만)
       id · t · text · emoji

     **여기 없는 것은 안 나갑니다.** 특히 카메라 프레임 · 랜드마크 좌표 ·
     자세 판정 상태(good/warn/bad) · 회복 횟수는 한 글자도 안 나갑니다.
     world_sessions 표 주석에 "영상·프레임·랜드마크는 절대 없습니다" 라고
     적어 두었고, 개인정보 안내(dorm 의 privacy 패널)도 같은 말을 합니다.
     화면에 뜨는 세션 시간(sessionMs)만 예외인데, 그건 이름표에 이미
     띄우기로 한 값이고 "얼마나 앉아 있었나" 이지 "어떻게 앉아 있나" 가
     아닙니다.

     sessionMs 를 보내는 이유(sessionAt 이 아니라): 남의 시계가 틀어져
     있으면 시작 시각은 그대로 틀린 값이 됩니다. **얼마나 지났나**를
     보내면 받는 쪽이 자기 시계로 시작 시각을 되돌립니다.
     ================================================================ */

  /* ================== 원격 플레이어 ================== */

  /* 서버가 종을 안 알려 주면 id 로 정합니다. 무작위로 고르면 새로고침마다
     같은 사람이 다른 동물이 되고, 다 거북이로 두면 누가 누군지 모릅니다. */
  function speciesFor(id) {
    const C = charAPI();
    const names = (C && C.names && C.names.length) ? C.names : FALLBACK_NAMES;
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return names[h % names.length];
  }

  /* 시트 하나를 가리키는 이름. **사람이 아니라 (종 + 옷)** 입니다 —
     같은 차림이면 스무 명이 캔버스 하나를 같이 씁니다. */
  function charKeyOf(species, worn) {
    let k = species;
    for (const s of WORN_SLOTS) k += '|' + ((worn && worn[s]) || '');
    return k;
  }

  function Remote(id, profile) {
    const species = profile.species || speciesFor(id);
    const worn = profile.worn || null;
    return {
      id,
      nick: profile.nick || '누군가',
      school: profile.school || '',
      hue: profile.hue || 0,          // GIRIN_CHAR 가 없을 때만 쓰는 색
      /* 이름표에 함께 띄우는 세션 시간. 흘러가는 숫자를 매 스냅샷마다
         보내면 초당 열 번씩 같은 값을 다시 보내게 되므로, **시작 시각만**
         한 번 받고 흐르는 것은 각자 화면에서 셉니다.
         없으면 시간 줄은 그냥 안 뜹니다 — 0:00 을 띄우면 방금 온 사람과
         시간을 안 보내는 사람이 구별되지 않습니다.

         sessionMs(얼마나 지났나)로 오면 **내 시계로** 시작 시각을 되돌립니다.
         남의 시계가 틀어져 있어도 이름표 숫자는 맞습니다. */
      sessionAt: profile.sessionAt
        || (typeof profile.sessionMs === 'number' ? Date.now() - profile.sessionMs : null),
      species, worn,
      charKey: charKeyOf(species, worn),
      buf: [],            // 받은 스냅샷 (시간순)
      zone: profile.zone || 'campus',
      /* 화면에 그릴 값 — 매 프레임 buf 에서 새로 만듭니다 */
      x: 0, y: 0, dir: 'down', flip: false, dir4: 'down', moving: false, sit: false,
      anim: 0, frame: 0,
      big: false,         // 32x48 로 그려졌는지 — drawOne 이 매 프레임 적습니다
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

  /* 'side' + flip 을 left/right 로 풉니다. 32x48 시트에는 왼쪽·오른쪽이
     **따로** 들어 있어서 뒤집을 일이 없습니다. 뒤집으면 가방끈처럼 한쪽에만
     있는 것이 반대편으로 넘어갑니다. 옛 16x16 시트는 오른쪽 한 벌뿐이라
     거기서는 여전히 flip 을 씁니다(drawSmall).
     서버가 'side' 로 보내든 'left'/'right' 로 보내든 둘 다 받습니다. */
  function dir4Of(dir, flip) {
    if (dir === 'side') return flip ? 'left' : 'right';
    if (dir === 'left' || dir === 'right' || dir === 'up' || dir === 'down') return dir;
    return 'down';
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
    rp.dir4 = dir4Of(s.dir, s.flip);
    rp.sit = !!s.sit;

    /* 걷는 그림은 **실제로 움직인 거리**로 넘깁니다. moving 플래그만
       믿으면 보간이 멈춘 프레임에도 다리가 움직여 미끄러져 보입니다.

       눈금은 index.html 의 걷기와 같아야 합니다 — 거기서는 반 보폭(STRIDE/2
       = 9.5 x AS = 19px)마다 한 박자입니다. 3.2px 마다 한 박자이던 예전
       값은 몸이 1px 들썩이는 것뿐일 때는 안 보였지만, 다리가 실제로
       움직이는 지금은 남만 여섯 배 빨리 걷습니다. */
    const d = rp.ready ? Math.hypot(rp.x - px, rp.y - py) : 0;
    rp.moving = d > 0.05;
    if (rp.moving) { rp.anim += d / (9.5 * AS); rp.frame = Math.floor(rp.anim); }
    else { rp.anim = 0; rp.frame = 0; }
    rp.ready = true;

    /* 오래된 것 버리기 */
    while (b.length > 2 && b[1].t < t - BUF_KEEP) b.shift();
  }

  /* ================== 그리기 ================== */

  /* 시트는 **저쪽이 캐시합니다.** 여기서 한 겹 더 받지 않습니다.

     처음엔 여기도 (종 + 옷) 열쇠로 들고 있었는데, 그 열쇠가 틀렸습니다.
     GIRIN_CHAR 쪽 열쇠에는 **학교 색**이 같이 들어갑니다(과잠). 학교를
     바꾸면 저쪽은 새로 굽는데 여기는 옛 캔버스를 계속 돌려줘서, 남의
     과잠만 옛 색으로 남습니다. 저쪽은 24장이 넘으면 오래된 것부터
     버리는데 여기서 붙들고 있으면 그 한도도 뜻이 없어집니다.

     "같은 (종, worn) 이면 구운 것을 돌려주므로 매 프레임 불러도 된다" 가
     약속입니다. 캐시는 굽는 쪽이 합니다. */
  function sheetOf(rp) {
    const C = charAPI();
    if (!C) return null;
    /* 저쪽이 던지면 16x16 으로 물러납니다 — 남 그리다 난 예외로 월드
       전체가 멈추면 안 됩니다. */
    /* 세 번째 인자가 그 사람 학교입니다. 안 넘기면 저쪽이 내 학교 색으로
       과잠을 칠해서, 홍익대 사람이 내 학교 과잠을 입고 걸어다닙니다.
       이름표에 이미 쓰는 rp.school 을 그대로 넘깁니다. */
    try { return C.sheetFor(rp.species, rp.worn, rp.school) || null; } catch { return null; }
  }

  /* 남이 16x16 으로 물러났으면 머리 높이도 16 입니다. 사람마다 따로 봅니다 —
     한 명만 시트를 못 구웠을 때 그 사람 이름표만 제자리에 있게.

     그릴 때 적어 둔 rp.big 을 봅니다. 여기서 sheetOf 를 다시 부르면 한
     사람이 한 프레임에 세 번(그리기·이름표·말풍선) 굽는 쪽을 두드립니다. */
  function liftOf(rp) {
    const C = charAPI();
    /* 앉으면 몸이 의자 높이만큼 올라갑니다 — 이름표도 같이 올라가야
       앉은 사람 이름이 뒤통수에 걸치지 않습니다. */
    return (C && rp.big) ? C.groundY + (rp.sit ? (C.sitLift || 0) : 0) : T;
  }
  /* 내 캐릭터 몫. 내 그림은 index.html 이 그리므로 창구만 보고 정합니다. */
  function liftMe() {
    const C = charAPI();
    return C ? C.groundY + (player.sitting ? (C.sitLift || 0) : 0) : T;
  }

  /* 그림자는 장식입니다. 성능 모드에서 제일 먼저 끕니다. */
  function shadowAt(cx, cy, rx, ry) {
    if (window.PERF && PERF.on) return;
    ctx.save();
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill();
    ctx.restore();
  }

  function bobOf(rp) {
    return rp.moving && !(window.PERF && PERF.on)
      ? (Math.floor(rp.anim * 2) % 2 ? -1 : 0) : 0;
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
    const sheet = sheetOf(rp);
    /* 이름표·말풍선이 이 값을 봅니다 — 32x48 로 그렸는지 16x16 으로
       물러났는지에 따라 머리 높이가 다릅니다. */
    rp.big = !!sheet;
    if (sheet) drawBig(rp, sheet);
    else drawSmall(rp);
  }

  /* 32x48. 그릴 자리는 내 캐릭터와 같은 규칙입니다 —
     가로는 중심에서 W/2(16), 세로는 발 위치에서 groundY(45) 를 뺍니다.
     그림자 크기·농도도 같습니다. 다르면 바닥 높이가 달라 보입니다.

     시트에 걷는 그림은 없습니다(가로 넷이 네 **방향**입니다). 그래서
     걸을 때 표는 위아래 1px 흔들림뿐입니다 — 내 캐릭터와 같습니다. */
  function drawBig(rp, sheet) {
    const C = window.GIRIN_CHAR;
    const W = C.W, H = C.H, G = C.groundY;
    const dx = Math.round(rp.x - W / 2 - camX);
    const dy = Math.round(rp.y - G - camY);

    /* 앉아 있으면 그림자를 안 깝니다 — 발이 바닥에 없습니다(drawPlayer 와 같음) */
    if (!rp.sit) shadowAt(dx + W / 2, dy + G - 1, 6, 2.4);

    /* 걷기 네 박자·앉은 자세는 저쪽 창구가 구워 줍니다. 창구가 옛 판이면
       pose 가 없으니 예전처럼 시트에서 바로 잘라 씁니다. */
    if (typeof C.pose === 'function') {
      const p = C.pose(sheet, rp.species, rp.dir4, { sitting: rp.sit, moving: rp.moving, frame: rp.frame });
      ctx.drawImage(p.img, p.sx, p.sy, W, H, dx, dy - (p.lift || 0), W, H);
      return;
    }
    const sx = (C.dirIndex?.[rp.dir4] ?? 0) * W;
    ctx.drawImage(sheet, sx, 0, W, H, dx, dy + bobOf(rp), W, H);
  }

  /* 16x16 Kenney 시트. GIRIN_CHAR 가 아직 안 붙었을 때만 옵니다.
     여기서는 사람이 한 벌뿐이라 hue 로 색을 돌려 씁니다. */
  const sheets = new Map();
  function tintedSheet(hue) {
    if (sheets.has(hue)) return sheets.get(hue);
    const c = document.createElement('canvas');
    /* 옛 시트는 16px 짜리라 자를 때는 TS 를 씁니다. 월드 타일(T)로 자르면
       한 칸 건너 엉뚱한 사람이 잘려 나옵니다. */
    c.width = SHEET_W * TS; c.height = SHEET_H * TS;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    if (hue) g.filter = 'hue-rotate(' + hue + 'deg) saturate(1.15)';
    g.drawImage(urban, SHEET_COL * TS, 0, SHEET_W * TS, SHEET_H * TS,
                0, 0, SHEET_W * TS, SHEET_H * TS);
    sheets.set(hue, c);
    return c;
  }

  function drawSmall(rp) {
    const dx = Math.round(rp.x - T / 2 - camX);
    const dy = Math.round(rp.y - T - camY);

    shadowAt(dx + T / 2, dy + T - 1, 5 * AS, 2.2 * AS);

    const sheet = tintedSheet(rp.hue);
    const col = DIR_COL[rp.dir] ?? 0;
    const row = rp.moving ? WALK_ROW[rp.frame & 3] : 0;
    const sx = col * TS, sy = row * TS;
    const bob = bobOf(rp) * AS;

    /* 옛 시트에는 오른쪽 한 벌뿐이라 왼쪽은 뒤집어 씁니다. */
    if (rp.dir4 === 'left') {
      ctx.save(); ctx.translate(dx + T, dy + bob); ctx.scale(-1, 1);
      ctx.drawImage(sheet, sx, sy, TS, TS, 0, 0, T, T); ctx.restore();
    } else {
      ctx.drawImage(sheet, sx, sy, TS, TS, dx, dy + bob, T, T);
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

  /* "명지대학교" 를 그대로 쓰면 이름표가 이름보다 학교가 길어집니다.
     머리 위에 붙는 글자는 짧아야 읽힙니다 — 정식 이름은 이름표를 눌러
     여는 자리(명단)에 그대로 남아 있습니다. */
  function shortSchool(name) {
    return String(name || '').replace('여자대학교', '여대').replace('대학교', '대');
  }

  const tags = new Map();     // id -> { el, nick, school }
  function tagFor(rp) {
    let t = tags.get(rp.id);
    if (!t) {
      const el = document.createElement('div');
      el.className = 'mp-tag';
      /* 두 줄입니다 — 위에 "이름 / 학교", 아래에 시간.
         셋을 옆으로 늘어놓으면 표가 캐릭터보다 넓어져서, 사람이 둘만
         모여도 이름이 서로를 가립니다. 위로 쌓으면 폭이 캐릭터만 해집니다. */
      el.innerHTML = '<b></b><u></u>';
      layer.append(el);
      t = { el, nick: null, school: null, bubble: null,
            who: el.querySelector('b'), clock: el.querySelector('u') };
      tags.set(rp.id, t);
    }
    if (t.nick !== rp.nick || t.school !== rp.school) {
      t.nick = rp.nick; t.school = rp.school;
      const sc = shortSchool(rp.school);
      t.who.textContent = sc ? rp.nick + ' / ' + sc : rp.nick;
    }
    /* 시간은 매 프레임 바뀌므로 다른 두 줄과 달리 비교 없이 씁니다.
       분:초 문자열이 같으면 DOM 은 어차피 안 건드립니다. */
    if (rp.sessionAt) {
      const sec = Math.max(0, Math.floor((Date.now() - rp.sessionAt) / 1000));
      const txt = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
      if (t.clock.textContent !== txt) t.clock.textContent = txt;
      t.clock.hidden = false;
    } else {
      t.clock.hidden = true;
    }
    return t;
  }

  let rect = cv.getBoundingClientRect();
  window.addEventListener('resize', () => { rect = cv.getBoundingClientRect(); });

  /** 월드 좌표 → 화면 좌표. 말풍선도 같은 걸 씁니다. */
  function toScreen(wx, wy) {
    return { x: rect.left + (wx - camX) * SCALE, y: rect.top + (wy - camY) * SCALE };
  }

  /* 이름표 한 장이 차지하는 자리(px). 세 줄(이름·학교·시간)이라 예전보다
     높습니다. 정확히 재려면 getBoundingClientRect 를 사람 수만큼 불러야
     하는데, 매 프레임 레이아웃을 강제로 계산시키는 값이라 상수로 둡니다. */
  const TAG_W = 74, TAG_H = 15;

  function syncTags() {
    const placed = [];
    rect = cv.getBoundingClientRect();
    for (const rp of remotes.values()) if (rp.ready) tagFor(rp);
    for (const [id, t] of tags) {
      const rp = remotes.get(id);
      if (!rp || !rp.ready || rp.zone !== zoneId) { t.el.style.display = 'none'; continue; }
      /* 머리 위 한 점. 32x48 은 발에서 45 를 올려야 프레임 맨 위입니다 —
         16 만 올리면 이름표가 배꼽에 붙습니다. */
      const lift = liftOf(rp);
      const p = toScreen(rp.x, rp.y - lift);
      /* 화면 밖이면 감춥니다. 안 그러면 지도 가장자리에서 이름만 남습니다. */
      if (p.x < rect.left - 40 || p.x > rect.right + 40 ||
          p.y < rect.top - 40 || p.y > rect.bottom + 40) {
        t.el.style.display = 'none'; continue;
      }
      /* 이름표는 **항상** 띄웁니다.
         전에는 커서를 올렸을 때만 떴습니다(회의 결정). 그런데 남을 그리는
         일이 이 파일의 전부인데 누가 누군지 커서를 올려야만 알 수 있으면,
         지나가는 사람은 영영 익명입니다. ZEP·Gather 도 상시 표시입니다.
         커서 판정에 쓰던 window.MOUSE 는 다른 곳에서도 쓰므로 그대로 둡니다.

         겹침은 위치로 풉니다 — 아래 syncTags 끝에서 서로 가까운 표를
         한 줄씩 밀어 올립니다. 감추는 것보다 낫습니다. */
      /* flex 여야 두 줄로 쌓입니다. block 으로 두면 알약 둘이 옆으로
         나란히 서서, 표가 캐릭터보다 넓어집니다. */
      t.el.style.display = 'flex';
      t.el.style.left = p.x + 'px';
      t.el.style.top = (p.y - 6) + 'px';
      placed.push({ t, x: p.x, y: p.y - 6 });
    }
    /* 겹침 풀기 — 사람들이 모이면 이름표가 서로 위에 쌓여 아무것도 못 읽습니다.
       위(작은 y)에 있는 것부터 자리를 잡고, 뒤에 오는 것이 그 자리와 겹치면
       한 칸씩 올립니다. 감추지 않는 이유는, 감추면 하필 사람이 몰린 곳에서
       이름이 사라지기 때문입니다 — 정작 누군지 제일 궁금한 순간입니다.
       열 번까지만 밀고 그 뒤로는 그대로 둡니다. 스무 명이 한 점에 서 있으면
       어차피 답이 없고, 무한히 밀면 하늘로 날아갑니다. */
    placed.sort((a, b) => a.y - b.y);
    const done = [];
    for (const it of placed) {
      let y = it.y;
      for (let k = 0; k < 10; k++) {
        const hit = done.find((o) => Math.abs(o.x - it.x) < TAG_W && Math.abs(o.y - y) < TAG_H);
        if (!hit) break;
        y = hit.y - TAG_H;
      }
      if (y !== it.y) it.t.el.style.top = y + 'px';
      done.push({ x: it.x, y });
    }
  }

  /** 스크린리더용 — 같은 공간에 누가 있는지 글로 알립니다. */
  let rosterKey = '';
  function syncRoster() {
    const here = [...remotes.values()]
      .filter((r) => r.ready && r.zone === zoneId)
      .map((r) => r.nick + ' · ' + r.school);
    const key = MP.mode + '|' + MP.link + '|' + here.join('|');
    if (key === rosterKey) return;
    rosterKey = key;
    /* 봇이면 봇이라고 말합니다 — 화면 왼쪽 위 안내와 같은 말이어야
       스크린리더로 듣는 사람도 같은 사실을 압니다. */
    const kind = MP.mode === 'bots' ? '연습용 캐릭터 ' : '';
    roster.textContent = here.length
      ? '같은 공간에 ' + kind + here.length + '명 — ' + here.join(', ')
      : (MP.link === 'live' ? '같은 공간에 다른 사람이 없습니다'
                            : '아직 서버에 못 붙었습니다');
  }

  /* ================== 내 것 올리기 ==================
     둘을 따로 보냅니다.
       위치   broadcast · 초당 최대 열 번 · **움직일 때만**
       모습   presence  · 들어올 때 한 번 + 바뀔 때 + 5초에 한 번

     이 앱은 앉아 있는 시간이 대부분이라, "움직일 때만" 이 요금과 배터리를
     거의 다 줄여 줍니다. 건물 사이를 걷는 30초 남짓만 초당 열 번이고
     나머지는 0 입니다. */

  /* 내 이름표·모습에 들어갈 것. index.html 의 ROOM 을 그대로 봅니다 —
     여기 한 벌을 또 만들면 옷을 갈아입어도 남에게는 안 바뀝니다.
     **여기 없는 값은 안 나갑니다**(위 "내보내는 것" 목록 참고). */
  function myProfile() {
    const R = (typeof ROOM !== 'undefined' && ROOM) || {};
    const started = (typeof SESSION !== 'undefined' && SESSION && SESSION.startedAt) || 0;
    return {
      id: MP.meId,
      nick: R.nickname || '누군가',
      school: R.school || '',
      species: R.character || '거북이',
      worn: Object.assign({}, R.worn || {}),
      zone: zoneId,
      x: player.x, y: player.y, dir: player.dir, flip: player.flip,
      moving: player.moving,
      /* 시작 시각이 아니라 흐른 시간. 남의 시계가 틀어져 있어도 맞습니다. */
      sessionMs: started ? Math.max(0, Date.now() - started) : 0,
    };
  }

  let myZone = null;
  let lastSent = 0, lastSentKey = '';
  let lastPresence = 0, lastProfileKey = '', lastPresPos = '';
  function pushSelf(now) {
    /* 존이 바뀌면 채널을 갈아탑니다. index.html 의 enterZone 은 아무것도
       쏘지 않으므로 여기서 봅니다 — 그 파일을 안 건드리는 것이 이 파일의
       규칙이고, 매 프레임 문자열 비교 하나는 공짜입니다. */
    if (zoneId !== myZone) {
      myZone = zoneId;
      lastSentKey = ''; lastProfileKey = ''; lastPresPos = '';
      if (MP.transport && MP.transport.setZone) MP.transport.setZone(myZone);
    }

    if (now - lastSent < SEND_MS) return;
    lastSent = now;

    /* 모습 — 바뀌었거나, 5초가 지났는데 그동안 움직였을 때만 */
    const prof = myProfile();
    const pkey = [prof.nick, prof.school, prof.species, JSON.stringify(prof.worn)].join('|');
    const ppos = Math.round(prof.x) + ',' + Math.round(prof.y);
    if (pkey !== lastProfileKey || (now - lastPresence > PRESENCE_MS && ppos !== lastPresPos)) {
      lastProfileKey = pkey; lastPresence = now; lastPresPos = ppos;
      MP.send(Object.assign({ type: 'profile' }, prof));
    }

    /* 위치 — 안 움직이면 안 보냅니다. 서 있는 사람 몫으로 초당 열 번을
       쓰는 건 낭비입니다. 다만 한 번은 더 보내 "멈췄다"를 알립니다. */
    const key = [zoneId, ppos, player.dir, player.flip, player.moving, player.sitting].join(',');
    if (key === lastSentKey) return;
    lastSentKey = key;
    MP.send({
      type: 'state', t: now, zone: zoneId,
      x: player.x, y: player.y,
      dir: player.dir, flip: player.flip, moving: player.moving,
      /* 앉았는지도 보냅니다 — 남이 의자에 앉으면 나도 앉은 모습으로 봐야
         자리 잡은 사람과 서 있는 사람이 구별됩니다. */
      sit: !!player.sitting,
    });
  }

  /* ================== 핸들러 ================== */
  const listeners = { chat: [], join: [], leave: [], race: [] };
  function emit(kind, ...a) { listeners[kind].forEach((f) => f(...a)); }

  const handlers = {
    onJoin(id, profile) {
      const p = profile || {};
      if (!remotes.has(id)) remotes.set(id, Remote(id, p));
      const rp = remotes.get(id);
      const fresh = !rp.seen; rp.seen = true;
      /* 이미 있던 사람이 모습을 바꿨을 수도 있습니다(옷을 갈아입었거나
         닉네임을 고쳤거나). presence 는 그때마다 다시 옵니다. */
      if (p.nick) rp.nick = p.nick;
      if (p.school !== undefined) rp.school = p.school || '';
      if (p.species && p.species !== rp.species) rp.species = p.species;
      if (p.worn !== undefined) rp.worn = p.worn || null;
      rp.charKey = charKeyOf(rp.species, rp.worn);
      if (typeof p.sessionMs === 'number') rp.sessionAt = Date.now() - p.sessionMs;

      /* **자리를 하나 심어 둡니다.** 이게 없으면 가만히 서 있는 사람은
         영영 안 보입니다 — 안 움직이면 broadcast 를 한 줄도 안 보내므로
         버퍼가 비고, 버퍼가 비면 ready 가 안 되고, ready 가 아니면
         collect 가 건너뜁니다. presence 에 실려 온 좌표가 그 답입니다.

         **버퍼에 넣지 않고 그릴 값에 바로 씁니다.** presence 에는 보낸 쪽
         시계가 없어서 t 를 지어내야 하는데, 내 시계로 지어 넣으면 그 뒤에
         오는 진짜 스냅샷이 전부 "그것보다 옛날 것" 으로 걸러집니다
         (onState 의 t 비교). 실제로 그렇게 만들었다가 남이 제자리에서
         얼어붙는 것을 봤습니다. buf 가 비어 있으면 resolve 는 아무것도
         안 하므로 이 값이 그대로 남고, 진짜 스냅샷이 한 줄이라도 오면
         그때부터 보간이 맡습니다. */
      if (!rp.buf.length && typeof p.x === 'number' && typeof p.y === 'number') {
        rp.x = p.x; rp.y = p.y;
        rp.dir = p.dir || 'down'; rp.flip = !!p.flip;
        rp.dir4 = dir4Of(rp.dir, rp.flip);
        rp.zone = p.zone || rp.zone;
        rp.moving = false;
        rp.ready = true;
      }
      /* presence 는 누가 뭘 할 때마다 명단 전체가 다시 옵니다. 그때마다
         join 을 알리면 "누가 왔다" 가 초당 몇 번씩 울립니다. */
      if (fresh) emit('join', rp);
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
    /* 달리기 시합 — 같은 존에 있는 사람들끼리만 오갑니다(채널이 존별이라
       그 자체로 걸러집니다). 위치처럼 지나가면 사라지는 값이라 DB 에 안
       씁니다. 닉네임을 payload 에 실어 보내는 이유: 트랙에 이름표를
       세워야 하는데, 방금 들어온 사람은 presence 가 아직 안 왔을 수
       있습니다. */
    onRace(id, p) { emit('race', id, p || {}); },
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
    /* 이 탭만의 id 입니다. **로그인 uid 가 아닙니다.**
       두 가지 이유입니다. (1) 한 사람이 탭 두 개를 열 수 있는데 presence
       열쇠가 같으면 둘이 서로를 지웁니다. (2) 화면에 사람을 그리는 데
       계정 id 는 필요 없고, 필요 없는 값을 같은 존의 모두에게 뿌릴 이유가
       없습니다. 새로고침하면 다른 사람으로 다시 들어옵니다 — presence 가
       나감/들어옴을 알려 주므로 명단은 안 어긋납니다. */
    meId: (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : 'me-' + Math.random().toString(36).slice(2),
    remotes,
    collect, drawOne, toScreen,
    /** 남의 머리 위 화면 좌표 — 말풍선이 씁니다 */
    headOf(id) {
      if (id === MP.meId) return toScreen(player.x, player.y - liftMe());
      const rp = remotes.get(id);
      if (!rp || !rp.ready || rp.zone !== zoneId) return null;
      return toScreen(rp.x, rp.y - liftOf(rp));
    },
    visible(id) {
      if (id === MP.meId) return true;
      const rp = remotes.get(id);
      return !!(rp && rp.ready && rp.zone === zoneId);
    },
    /** 눈으로 확인할 때 씁니다. combos 는 지금 서 있는 사람들의 서로 다른
        (종 + 옷) 가짓수 — 사람이 스무 명이어도 굽는 쪽이 실제로 만드는
        시트는 이 수를 넘지 않습니다. */
    stats() {
      const combos = new Set();
      for (const r of remotes.values()) combos.add(r.charKey);
      return {
        people: remotes.size,
        combos: combos.size,
        big: [...remotes.values()].filter((r) => r.big).length,
        api: !!charAPI(),
        /* 지금 무엇에 붙어 있나. 화면이 "혼자" 와 "못 붙음" 을 구별해
           말하려면 이 값이 필요합니다.
             mode  'supabase' | 'bots' | 'none'
             link  'connecting' | 'live' | 'down'    (bots 일 때는 'live') */
        mode: MP.mode, link: MP.link, zone: myZone,
      };
    },
    mode: 'none', link: 'connecting',
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
    /** 채팅에서 부릅니다. 전송 계층이 나에게도 되돌려 주므로(에코)
        여기서는 안 그립니다. */
    say(text, emoji) {
      MP.send({ type: 'chat', t: performance.now(), text: text || '', emoji: emoji || '' });
    },
    /** 달리기 시합 진행 상황. 서버가 없으면 아무 데도 안 갑니다 —
        그래서 혼자 하는 판은 이걸 불러도 그냥 조용합니다. */
    race(p) { MP.send(Object.assign({ type: 'race' }, p)); },
  };
  window.MP = MP;

  /* ================== Supabase Realtime ==================
     존마다 채널 하나입니다: 'world:<zone>'. 존을 옮기면 옛 채널에서 나가고
     새 채널에 듭니다 — 도서관에 앉아 있는데 운동장 사람들 좌표가 초당 열 번씩
     날아오면 받을 이유도 없고 요금만 씁니다.

     한 채널 안에서 둘을 같이 씁니다.
       presence   누가 있나 · 어떤 모습인가 · 마지막으로 본 자리
       broadcast  어디 있나 (초당 최대 열 번 · 움직일 때만)

     왜 위치를 DB 에 안 쓰나: 초당 열 번 × 사람 수만큼 insert 하면 비용도
     지연도 감당이 안 됩니다. broadcast 는 지나가면 사라지는 값이고,
     위치는 원래 그런 값입니다.

     왜 broadcast self:false 인가: 내 캐릭터는 index.html 이 그립니다.
     되돌아오면 두 겹으로 보이기도 하지만, 그보다 **내가 보낸 초당 열 번이
     그대로 나에게 돌아옵니다.** 채팅만 에코가 필요한데 그건 send 안에서
     직접 만듭니다.

     ---- 보안에 대해 솔직히 ----
     지금은 **공개 채널**입니다. anon 키를 아는 사람은 누구나 이 채널에
     들어와 아무 닉네임·아무 학교로 설 수 있습니다. 막으려면 Supabase
     대시보드에서 Realtime Authorization(private channel + realtime.messages
     RLS)을 켜야 하는데, 그건 코드가 아니라 프로젝트 설정입니다.
     README 의 "수현이 할 일" 에 적어 두었습니다.
     ================================================================ */

  /* SDK 는 **설정이 있을 때만** 그 자리에서 불러옵니다.
     index.html 의 <script src> 목록에 넣지 않는 이유는 build-supabase-js.mjs
     머리말에 있습니다 — 단독본에 쓰지도 않을 200KB 를 박게 됩니다. */
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

  function SupabaseTransport(client) {
    let h = null, ch = null, zone = null, alive = false, lastProfile = null;

    function leave() {
      if (!ch) return;
      const old = ch; ch = null;
      try { old.unsubscribe(); client.removeChannel(old); } catch { /* 이미 닫힘 */ }
    }

    /* presence 는 누가 뭘 할 때마다 **명단 전체**가 다시 옵니다(sync).
       join/leave 를 따로 듣지 않는 이유: sync 하나만 보면 늘 지금 명단이라
       두 길이 어긋날 일이 없습니다. */
    function syncPresence(c) {
      if (c !== ch) return;
      let st = {};
      try { st = c.presenceState() || {}; } catch { return; }
      const here = new Set();
      for (const key of Object.keys(st)) {
        if (key === MP.meId) continue;
        const meta = (st[key] || [])[0];
        if (!meta) continue;
        here.add(key);
        h.onJoin(key, meta);
      }
      /* 목록을 먼저 복사합니다 — onLeave 가 remotes 를 지우면서 도는 것을
         피하려는 것이고, Array.from 을 쓰는 것은 spread 로 쓰면 lint 가
         "쓸데없는 복사" 로 봅니다(여기서는 쓸데 있습니다). */
      for (const id of Array.from(remotes.keys())) if (!here.has(id)) h.onLeave(id);
    }

    function track() {
      if (!ch || MP.link !== 'live' || !lastProfile) return;
      /* type 은 우리 내부 봉투라 빼고 보냅니다 */
      const p = Object.assign({}, lastProfile);
      delete p.type;
      Promise.resolve(ch.track(p)).catch(() => { /* 끊긴 중 — 다음 5초에 다시 */ });
    }

    function join(z) {
      leave();
      zone = z;
      MP.link = 'connecting';
      /* 존을 옮기면 저쪽 사람들은 더 이상 내 화면에 있을 이유가 없습니다 */
      [...remotes.keys()].forEach(h.onLeave);

      const c = client.channel('world:' + z, {
        config: { broadcast: { self: false, ack: false }, presence: { key: MP.meId } },
      });
      ch = c;
      c.on('broadcast', { event: 'm' }, (msg) => {
        const p = msg && msg.payload;
        if (!p || !p.id || p.id === MP.meId) return;
        /* zone 은 채널이 이미 말해 줍니다. 보내는 쪽 말을 믿지 않는 편이
           낫습니다 — 남의 존으로 자기를 그려 넣을 수 있습니다. */
        h.onState(p.id, {
          t: p.t, zone, x: p.x, y: p.y, dir: p.dir, flip: !!p.flip, moving: !!p.moving,
          sit: !!p.sit,
        });
      });
      c.on('broadcast', { event: 'say' }, (msg) => {
        const p = msg && msg.payload;
        if (!p || !p.id || p.id === MP.meId) return;
        h.onChat(p.id, p);
      });
      c.on('broadcast', { event: 'race' }, (msg) => {
        const p = msg && msg.payload;
        if (!p || !p.id || p.id === MP.meId) return;
        h.onRace(p.id, p);
      });
      c.on('presence', { event: 'sync' }, () => syncPresence(c));
      c.subscribe((status) => {
        if (c !== ch || !alive) return;
        if (status === 'SUBSCRIBED') {
          MP.link = 'live';
          /* 붙자마자 내 모습을 올립니다. 안 그러면 이미 와 있던 사람들
             화면에 내가 안 뜹니다 — 내가 걷기 시작할 때까지. */
          track();
          syncPresence(c);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          MP.link = 'down';
          /* 못 받는 동안 남을 화면에 그대로 두면 "다들 멈춰 있네" 가 됩니다.
             지우는 쪽이 정직합니다 — 다시 붙으면 presence 가 명단을 줍니다.
             (SDK 가 알아서 물러났다 다시 붙습니다.) */
          [...remotes.keys()].forEach(h.onLeave);
        }
      });
    }

    return {
      name: 'supabase',
      connect(handlersIn) {
        h = handlersIn; alive = true;
        join(zoneId);
      },
      setZone(z) { if (alive && z !== zone) join(z); },
      send(m) {
        if (!alive) return;
        if (m.type === 'profile') { lastProfile = m; return track(); }
        if (!ch || MP.link !== 'live') return;
        if (m.type === 'state') {
          ch.send({ type: 'broadcast', event: 'm', payload: {
            id: MP.meId, t: m.t, x: m.x, y: m.y,
            dir: m.dir, flip: !!m.flip, moving: !!m.moving, sit: !!m.sit,
          } });
        } else if (m.type === 'race') {
          const p = Object.assign({}, m); delete p.type;
          p.id = MP.meId;
          ch.send({ type: 'broadcast', event: 'race', payload: p });
        } else if (m.type === 'chat') {
          const p = { id: MP.meId, t: m.t, text: m.text || '', emoji: m.emoji || '' };
          ch.send({ type: 'broadcast', event: 'say', payload: p });
          /* 에코를 여기서 만듭니다. self:false 라 서버가 안 돌려주는데,
             chat.js 는 내 말도 같은 길로 와야 말풍선을 띄웁니다. */
          h.onChat(MP.meId, p);
        }
      },
      disconnect() { alive = false; leave(); },
    };
  }

  /* ================== 가짜 서버 ==================
     진짜 서버가 붙기 전까지만 삽니다. 안에서 사람 넷을 굴리고,
     밖으로는 초당 열 번짜리 스냅샷만 흘립니다 — 실제 서버와 같은
     굵기로 내보내야 보간이 맞는지 눈으로 볼 수 있습니다.

     넷을 **서로 다른 종·다른 옷**으로 세웁니다. 다 거북이면 여덟 종을
     만든 의미가 없고, 회의에서 보여 줄 때도 한 종만 보입니다.
     옷은 index.html SHOP 의 id 그대로입니다.
     hue 는 GIRIN_CHAR 가 없을 때(16x16) 서로 구분하는 데만 씁니다. */
  const FAKE = [
    { id: 'p1', nick: '느린거북', school: '명지대학교', hue: 320, speed: 46,
      species: '거북이',
      worn: { top: 'top-hoodie', bottom: 'bot-jeans', shoes: 'sho-sneaker', hat: 'hat-cap' } },
    { id: 'p2', nick: '목긴기린', school: '홍익대학교', hue: 55, speed: 62,
      species: '기린',
      worn: { top: 'top-varsity', bottom: 'bot-slacks', shoes: 'sho-dress', glasses: 'fac-round' } },
    /* 예전 넷 중 미어캣·돼지는 종 여덟에 없습니다(알 상품으로만 남았습니다).
       그림이 있는 종으로 바꿉니다 — 없는 종을 부르면 맨몸으로 섭니다. */
    { id: 'p3', nick: '뒤뚱펭귄', school: '명지대학교', hue: 150, speed: 40,
      species: '펭귄',
      worn: { top: 'top-tee', bottom: 'bot-shorts', shoes: 'sho-slipper', bag: 'bag-tote' } },
    { id: 'p4', nick: '폴짝개구리', school: '서강대학교', hue: 250, speed: 52,
      species: '개구리',
      worn: { top: 'top-shirt', bottom: 'bot-trainer', shoes: 'sho-sneaker',
              hat: 'hat-beanie', glasses: 'fac-sun', bag: 'bag-backpack' } },
  ];

  /* 사람을 늘려 볼 때 씁니다: ?bots=20.
     차림은 위 넷을 돌려 씁니다 — 스무 명이어도 구운 시트는 넷이어야
     한다는 것을 그대로 보이려고 일부러 그렇게 뒀습니다. */
  function crowd(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const base = FAKE[i % FAKE.length];
      if (i < FAKE.length) { out.push(base); continue; }
      out.push({
        ...base,
        id: 'p' + (i + 1),
        nick: base.nick + (Math.floor(i / FAKE.length) + 1),
        hue: (base.hue + i * 37) % 360,
        /* 지도 눈금입니다 — 타일이 커진 만큼 같이 올려야 봇이 나와 같은
           빠르기로 걷습니다. */
        speed: (38 + (i * 7) % 30) * AS,
      });
    }
    return out;
  }

  const FAKE_LINES = [
    '도서관 자리 남았어요?', '30분만 더 앉아 있을게요',
    '목이 뻐근하네요… 운동장 갔다 올게요', '본관 음악 오늘 괜찮은데요',
    '방금 회복 3번째', '같이 앉을 사람', '커피 마시고 올게요',
  ];
  const EMOJIS = ['👍', '😂', '🔥', '💪', '👀'];

  /* 봇의 "앉은 지 얼마" — id 로 정해서 새로고침해도 같은 사람이 같은
     정도로 앉아 있게 합니다. 무작위로 두면 새로고침마다 시간이 튑니다. */
  function botSessionMs(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return (Math.abs(h) % 47 + 3) * 60000;      // 3~49분
  }

  function LocalTransport(count) {
    let h = null, timer = 0, chatTimer = 0, alive = false;
    const m = ZONES.campus;
    const bots = [];
    const cast = crowd(Math.max(1, Math.min(60, count || FAKE.length)));

    function solidIn(px, py) {
      const tx = Math.floor(px / T), ty = Math.floor(py / T);
      if (!inMap(m, tx, ty)) return true;
      return m.solid[at(m, tx, ty)] === 1;
    }
    /* index.html 의 BOX 와 같은 크기입니다. 다르면 남만 벽을 통과합니다.
       캐릭터가 32x48 로 커져도 **발이 딛는 자리는 그대로**입니다 —
       키 큰 그림은 위로 자라지 바닥을 더 차지하지 않습니다.

       숫자를 베껴 적지 않고 BOX 에서 바로 계산합니다. 타일이 16 에서 32 로
       올라갈 때 한쪽만 고치는 사고가 실제로 우려됐던 자리입니다. */
    function free(px, py) {
      const l = px - BOX.w / 2, r = px + BOX.w / 2 - 1, t = py - BOX.h, b = py - 1;
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
        ...def, x: p.x, y: p.y, dir: 'down', moving: false,
        target: pickTarget(), wait: Math.random() * 2, stuck: 0,
      });
    }

    /* 봇 한 걸음. 서버 쪽 계산입니다 — 클라이언트는 결과만 받습니다. */
    function stepBot(b, dt) {
      if (b.wait > 0) { b.wait -= dt; b.moving = false; return; }
      let dx = b.target.x - b.x, dy = b.target.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 3 * AS) { b.target = pickTarget(); b.wait = 0.6 + Math.random() * 2.5; b.moving = false; return; }
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
      /* 네 방향 그대로 보냅니다. 'side' + flip 으로 접었다가 받는 쪽에서
         다시 펴던 것을 그만뒀습니다 — 시트에 좌우가 다 있습니다. */
      if (Math.abs(dx) > Math.abs(dy)) b.dir = dx < 0 ? 'left' : 'right';
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
            x: b.x, y: b.y, dir: b.dir, flip: false, moving: b.moving,
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
           나타나야 join 처리가 되는지 눈으로 봅니다.
           스무 명을 700ms 씩 세우면 다 모이는 데 14초라, 사람이 많아지면
           간격을 좁힙니다. */
        const gap = cast.length > 8 ? 90 : 700;
        cast.forEach((def, i) => setTimeout(() => {
          if (!alive) return;
          spawn(def);
          /* 봇도 이름표에 시간을 띄웁니다 — 남의 표에만 시간이 없으면
             "저 사람은 왜 없지" 가 되고, 화면에서 확인할 방법도 없습니다.
             자리마다 다르게 보이도록 이미 얼마쯤 앉아 있던 것으로 둡니다.
             Date.now() 를 쓰는 것은 흐름을 각자 화면에서 세기 때문입니다. */
          h.onJoin(def.id, { ...def, sessionAt: Date.now() - botSessionMs(def.id) });
        }, 400 + i * gap));
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
    display: flex; flex-direction: column; align-items: center; gap: 2px;
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
  /* 학교는 이름과 한 알약에 넣습니다. 따로 두면 줄이 셋이 되어
     캐릭터보다 표가 높아집니다. 슬래시로 가릅니다. */
  /* 세션 시간. 이름·학교와 성격이 달라서(흐르는 값) 따로 둡니다 —
     앞의 점이 "지금 재는 중" 이라는 뜻입니다. 색만으로 상태를 말하지
     않도록 점과 숫자를 같이 둡니다. */
  .mp-tag u {
    display: inline-block; text-decoration: none;
    padding: 1px 6px 1px 5px; border-radius: 999px;
    background: rgba(255,255,255,.90); color: #4E3F39;
    font-size: 9.5px; font-weight: 700; font-variant-numeric: tabular-nums;
  }
  .mp-tag u::before {
    content: ''; display: inline-block; width: 5px; height: 5px;
    margin-right: 4px; border-radius: 999px; background: #C4573B;
    vertical-align: middle;
  }
  .mp-tag u[hidden] { display: none; }
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
    syncNote();
    requestAnimationFrame(loop);
  }

  /* 봇 수는 주소로 바꿉니다: ?bots=20. 안 쓰면 null 이고, null 이면
     진짜 서버를 먼저 시도합니다. */
  function botParam() {
    const raw = new URLSearchParams(location.search).get('bots');
    if (raw === null) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : FAKE.length;
  }

  /* ================== 봇을 왜 남겼나 ==================
     Gather 에는 봇이 없습니다. 그래도 남깁니다 — 다만 **진짜 서버에 못
     붙었을 때만** 삽니다.

     남긴 이유: 이 월드의 전제가 "캠퍼스" 인데, 서버 설정이 없는 사람이
     열면 아무도 없는 벌판입니다. 그러면 이 프로토타입이 무엇을 만들려는
     것인지가 화면에서 사라집니다. 시연도 대부분 혼자 합니다.

     남기면서 지킨 것: **봇을 사람인 척하지 않습니다.** 봇이 도는 동안에는
     화면 왼쪽 위에 "연습용" 이라고 적어 두고, 스크린리더용 명단도 같은
     말을 합니다. 그리고 진짜 서버에 붙은 뒤에는 아무도 없어도 봇을 안
     넣습니다 — 비어 있는 것이 사실이면 비어 있어야 합니다.
     ================================================================ */
  const note = document.createElement('div');
  note.id = 'mp-note';
  note.hidden = true;
  document.body.append(note);

  const NOTE_CSS = document.createElement('style');
  NOTE_CSS.textContent = `
  #mp-note {
    position: fixed; left: 12px; top: 12px; z-index: 6; pointer-events: none;
    padding: 5px 10px; border-radius: 999px;
    background: rgba(255,255,255,.92); color: #4E3F39;
    font-size: 11px; font-weight: 700; letter-spacing: -.01em;
    box-shadow: 0 1px 3px rgba(78,47,38,.18), 0 0 0 1px rgba(78,47,38,.08);
  }
  #mp-note[hidden] { display: none; }
  `;
  document.head.append(NOTE_CSS);

  /* 감출 때 글자도 같이 비웁니다. 남겨 두면 hidden 인 채로 옛 문장을 들고
     있어서, 화면 밖에서 읽는 도구나 검사 스크립트가 지난 상태를 봅니다. */
  function setNote(text) {
    if (note.textContent !== text) note.textContent = text;
    note.hidden = !text;
  }

  /** why 는 사람에게 보여 줄 한 줄, detail 은 개발자용 원문입니다.
      'Failed to fetch' 같은 영어 원문을 화면에 그대로 띄우면, 읽는 사람이
      할 수 있는 일이 없는 문장이 됩니다. 원문은 MP.why 로만 남깁니다. */
  function useBots(n, why, detail) {
    MP.mode = 'bots'; MP.link = 'live'; MP.why = detail || why || '';
    MP.setTransport(LocalTransport(n));
    setNote('연습용 캐릭터 ' + n + '명 · ' + (why || '서버에 못 붙었어요'));
  }

  /** 진짜 서버에 붙습니다. 못 붙으면 던집니다 — 부르는 쪽이 봇으로 갑니다. */
  async function connectReal() {
    if (!window.WORLD_SAVE || !WORLD_SAVE.configured) throw new Error('설정 없음');
    const sdk = await loadSdk();
    /* 토큰은 save.js 것을 그대로 씁니다. 로그인 갈래(학교 이메일 → 익명)를
       두 곳에서 따로 만들면 같은 사람이 두 사람이 됩니다. */
    const token = await WORLD_SAVE.accessToken();
    const client = sdk.createClient(GIRIN_SUPABASE.url, GIRIN_SUPABASE.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      /* 초당 12 — 위치가 초당 열 번이고 그 위에 presence 와 채팅이 얹힙니다.
         딱 10 으로 두면 걸으면서 말할 때 밀립니다. */
      realtime: { params: { eventsPerSecond: 12 } },
    });
    client.realtime.setAuth(token);

    MP.mode = 'supabase'; MP.link = 'connecting';
    MP.setTransport(SupabaseTransport(client));

    /* 붙었는지 눈으로 확인될 때까지 기다립니다. 안 기다리면 "봇도 없고
       사람도 없는" 화면이 8초쯤 이어집니다. */
    await new Promise((res, rej) => {
      const t0 = Date.now();
      (function wait() {
        if (MP.link === 'live') return res();
        if (Date.now() - t0 > CONNECT_TIMEOUT_MS) return rej(new Error('시간 초과'));
        setTimeout(wait, 120);
      })();
    });
  }

  /* 화면 왼쪽 위 한 줄. 없는 상태를 지어내지 않습니다 —
     "혼자" 와 "못 붙음" 과 "연습용" 은 서로 다른 말입니다. */
  function syncNote() {
    if (MP.mode !== 'supabase') return;             // 봇 안내는 useBots 가 씁니다
    if (MP.link === 'connecting') return setNote('접속 중…');
    if (MP.link === 'down') return setNote('연결이 끊겼어요 · 다시 붙는 중');
    setNote(remotes.size ? '' : '지금 이 공간에 혼자 있어요');
  }

  /* 16x16 으로 물러날 때를 대비해 urban.png 가 뜬 뒤에 시작합니다.
     32x48 시트는 index.html 이 알아서 챙깁니다. */
  function boot() {
    if (!urban.complete || !urban.naturalWidth) { setTimeout(boot, 100); return; }
    requestAnimationFrame(loop);

    const forced = botParam();
    if (forced !== null) return useBots(forced, '?bots= 로 켠 시연용');

    connectReal().catch((e) => {
      /* 여기 오는 길 셋: 설정 없음 · SDK 못 받음 · 채널이 안 붙음.
         셋 다 "서버가 없는 것처럼" 굴어야 월드가 안 멈춥니다. */
      if (MP.transport) { MP.transport.disconnect(); MP.transport = null; }
      [...remotes.keys()].forEach(handlers.onLeave);
      const detail = String((e && e.message) || e);
      useBots(FAKE.length, detail === '설정 없음' ? '서버 설정이 없어요' : '서버에 못 붙었어요', detail);
    });
  }
  boot();
})();

/* ============================================================================
   월드 세션 서버 저장 — Supabase REST 를 fetch 로 직접 부릅니다.

   왜 SDK 를 안 쓰는가: prototypes/shared/school-auth.js 와 같은 이유입니다.
   프로토타입은 빌드 없는 단일 HTML 이고, 필요한 종단점이 몇 개뿐이라
   fetch 로 충분합니다.

   역할 분담
   ---------
   - 세션이 끝나면 world_finish_session RPC 를 부릅니다. 세션 행과 코인
     지급은 **서버가** 합니다. 이 파일과 index.html 은 서버가 돌려준
     잔액을 "표시"만 합니다.
   - 오프라인이거나 요청이 실패하면 localStorage 큐에 쌓아 두고, 다음
     접속(또는 다음 호출) 때 다시 보냅니다. 세션 id 를 클라이언트가
     만들기 때문에 두 번 보내도 두 번 지급되지 않습니다.
   - 로그인이 없으면 Supabase 익명 로그인으로 이 브라우저만의 user_key 를
     만들어 씁니다. 학교 이메일 로그인 세션(girin.session)이 있으면 그걸
     먼저 씁니다 — 그래야 로그인한 사람의 기록이 한 uid 로 모입니다.

   설정이 없거나 file:// 로 열었으면 configured=false 로 조용히 물러나고,
   월드는 지금처럼 localStorage 만으로 돕니다.
   ============================================================================ */
(function (global) {
  'use strict';

  const CFG = global.GIRIN_SUPABASE || {};
  const URL_BASE = (CFG.url || '').replace(/\/+$/, '');
  const ANON = CFG.anonKey || '';
  const configured =
    Boolean(URL_BASE && ANON) && /^https?:$/.test(global.location.protocol);

  const AUTH_STORE = 'girin.worldsave.auth';   // 익명 로그인 세션
  const QUEUE_STORE = 'girin.worldsave.queue'; // 아직 못 보낸 요청들

  function load(key, fallback) {
    try { return JSON.parse(global.localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }
  function save(key, v) {
    try { global.localStorage.setItem(key, JSON.stringify(v)); } catch { /* 무시 */ }
  }

  function uuid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    /* file:// 같은 비보안 문맥 폴백. 서버 중복 제거용이라 이 정도면 됩니다. */
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  /* ---------------- 토큰 ---------------- */

  async function authPost(path, body) {
    const r = await fetch(URL_BASE + '/auth/v1' + path, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    if (!r.ok) throw new Error('auth ' + r.status);
    return r.json();
  }

  function packSession(s) {
    return {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600),
    };
  }

  async function token() {
    const now = Math.floor(Date.now() / 1000);

    /* 학교 이메일 로그인(shared/school-auth.js)이 살아 있으면 그 토큰을 씁니다. */
    const school = load('girin.session', null);
    if (school && school.access_token && (school.expires_at || 0) > now + 60) {
      return school.access_token;
    }

    let s = load(AUTH_STORE, null);
    if (s && s.expires_at > now + 60) return s.access_token;

    if (s && s.refresh_token) {
      try {
        s = packSession(await authPost('/token?grant_type=refresh_token', {
          refresh_token: s.refresh_token,
        }));
        save(AUTH_STORE, s);
        return s.access_token;
      } catch { /* 갱신 실패 — 아래에서 새로 만듭니다 */ }
    }

    /* 익명 로그인. body 에 email/phone 이 없으면 익명 가입이 됩니다. */
    s = packSession(await authPost('/signup', {}));
    save(AUTH_STORE, s);
    return s.access_token;
  }

  /* ---------------- 큐 ----------------
     맨 앞부터 순서대로 보냅니다. 네트워크가 없으면 그대로 두고,
     서버가 4xx 로 거절한 항목은 버립니다 — 다시 보내도 똑같이 거절되므로
     안 버리면 큐가 영영 막힙니다. */

  /** replaceKey 를 주면 큐에 있던 같은 열쇠의 항목을 지우고 새것만 남깁니다.
      옷을 열 번 갈아입으면 큐에 열 개가 쌓이는데, 이 RPC 들은 "지금 상태를
      통째로" 보내는 것이라 마지막 하나만 보내면 결과가 같습니다. 세션
      종료(world_finish_session)에는 절대 쓰면 안 됩니다 — 그건 사건이라
      하나하나가 다른 뜻입니다. */
  function enqueue(fn, args, replaceKey) {
    let q = load(QUEUE_STORE, []);
    if (replaceKey) q = q.filter((it) => it.key !== replaceKey);
    q.push({ fn, args, at: Date.now(), key: replaceKey || null });
    save(QUEUE_STORE, q);
  }

  /** 아직 못 보낸 것이 있나. 화면이 "저장됨" 이라고 거짓말하지 않으려고 씁니다. */
  function pending() { return load(QUEUE_STORE, []).length; }

  let flushing = null;
  function flush() {
    if (!configured) return Promise.resolve(null);
    if (flushing) return flushing; // 동시에 두 번 돌면 같은 항목을 두 번 보냅니다
    flushing = (async () => {
      let latest = null;   // 마지막 응답이 알려 준 잔액
      try {
        const t = await token();
        for (;;) {
          const q = load(QUEUE_STORE, []);
          if (!q.length) break;
          const item = q[0];
          const r = await fetch(URL_BASE + '/rest/v1/rpc/' + item.fn, {
            method: 'POST',
            headers: {
              apikey: ANON,
              Authorization: 'Bearer ' + t,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(item.args),
          });
          if (r.ok) {
            const out = await r.json();
            if (out && typeof out.balance === 'number') latest = out.balance;
          } else if (r.status === 401 || r.status === 429 || r.status >= 500) {
            break; // 일시적 — 다음 기회에 다시
          }
          /* 성공했거나, 영구히 거절된 항목 — 큐에서 뺍니다 */
          q.shift();
          save(QUEUE_STORE, q);
        }
      } catch { /* 오프라인 — 큐는 남습니다 */ }
      flushing = null;
      return latest;
    })();
    return flushing;
  }

  /* ---------------- 공개 API ---------------- */

  /** 세션 종료. 서버가 지급까지 마친 뒤의 잔액(숫자)이나, 오프라인이면 null.
   *
   *  숫자 둘을 따로 보냅니다. 헷갈리기 쉬워서 여기 적어 둡니다.
   *    seatedMinutes  자세 판정이 실제로 돌아간 시간. **코인의 분모입니다.**
   *                   카메라 앞에 사람이 없으면 안 쌓입니다.
   *    chairMinutes   의자에 앉아 있던 시간. 회고 화면에 보여 줄 값일 뿐
   *                   코인 계산에는 안 들어갑니다. 이 둘을 섞으면 앉혀 두고
   *                   자리를 비우는 것을 막던 규칙이 무너집니다.
   *
   *  p_chair_minutes 는 RPC 의 마지막 인자이고 기본값이 있어서, 이 값을
   *  안 보내는 옛 판본도 그대로 돕니다(안 보내면 서버가 판정 시간으로 둡니다).
   */
  function finishSession(s) {
    if (!configured) return Promise.resolve(null);
    enqueue('world_finish_session', {
      p_id: s.id || uuid(),
      p_school: s.school || null,
      p_seated_minutes: Math.max(0, Math.round(s.seatedMinutes || 0)),
      p_campus_minutes: Math.max(0, Math.round(s.campusMinutes || 0)),
      p_recoveries: Math.max(0, Math.round(s.recoveries || 0)),
      p_started_at: new Date(s.startedAt || Date.now()).toISOString(),
      p_ended_at: new Date(s.endedAt || Date.now()).toISOString(),
      p_chair_minutes: Math.max(0, Math.round(s.chairMinutes ?? s.seatedMinutes ?? 0)),
    });
    return flush();
  }

  /** 미니게임 완료. 게임별 하루 1회는 서버가 셉니다. */
  function earnMinigame(game) {
    if (!configured) return Promise.resolve(null);
    enqueue('world_earn_minigame', { p_game: game });
    return flush();
  }

  /** 서버가 아는 내 잔액. 행이 아직 없으면 0, 못 물어보면 null. */
  async function balance() {
    if (!configured) return null;
    try {
      const t = await token();
      const r = await fetch(URL_BASE + '/rest/v1/world_coins?select=balance', {
        headers: { apikey: ANON, Authorization: 'Bearer ' + t },
      });
      if (!r.ok) return null;
      const rows = await r.json();
      return rows.length ? rows[0].balance : 0;
    } catch { return null; }
  }

  /* ---------------- 상점 ----------------
     큐를 안 거치고 **그 자리에서** 부르는 것이 하나 있습니다: 사기.
     이유는 아래 buyItem 주석에 적었습니다. */

  /** 큐를 안 쓰는 RPC 한 번. 실패는 던지지 않고 { ok:false, reason } 로 돌려줍니다 —
      부르는 쪽이 화면에 뭐라고 쓸지 정해야 하기 때문입니다. */
  async function callRpc(fn, args) {
    if (!configured) return { ok: false, reason: 'unconfigured' };
    let t;
    try { t = await token(); }
    catch { return { ok: false, reason: 'offline' }; }
    let r;
    try {
      r = await fetch(URL_BASE + '/rest/v1/rpc/' + fn, {
        method: 'POST',
        headers: {
          apikey: ANON,
          Authorization: 'Bearer ' + t,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args || {}),
      });
    } catch { return { ok: false, reason: 'offline' }; }
    if (!r.ok) return { ok: false, reason: 'server', status: r.status };
    try { return { ok: true, data: await r.json() }; }
    catch { return { ok: false, reason: 'server' }; }
  }

  /** 상점에서 삽니다.
   *
   *  **오프라인이면 큐에 안 넣고 그 자리에서 거절합니다.** 세션 종료와
   *  다릅니다 — 세션 종료는 이미 일어난 사실을 알리는 것이라 나중에 보내도
   *  뜻이 같지만, 사기는 **부탁**이고 결과를 모릅니다. 큐에 넣으면 화면은
   *  "샀다"고 해 놓고 몇 시간 뒤 서버가 "잔액 부족" 이라고 답할 수 있습니다.
   *  그때 아이템을 도로 뺏는 화면을 만들거나, 안 만들면 화면이 거짓말을
   *  계속합니다. 둘 다 나쁘므로 못 사는 동안은 못 산다고 말합니다.
   *
   *  금액은 **안 보냅니다.** 보내는 것은 item_id 하나이고 값은 서버 값표가
   *  정합니다. 못 보내는 값은 못 속입니다.
   *
   *  돌려주는 것: { ok, reason, balance, price }
   *    reason  null | 'poor' | 'already' | 'unknownItem'   서버가 거절
   *            'offline' | 'server' | 'unconfigured'        못 물어봄
   */
  async function buyItem(itemId) {
    const r = await callRpc('world_buy_item', { p_item_id: itemId });
    if (!r.ok) return { ok: false, reason: r.reason, balance: null };
    const d = r.data || {};
    return { ok: !!d.ok, reason: d.reason || null, balance: d.balance ?? null, price: d.price ?? null };
  }

  /** 입은 것·색·종을 통째로 저장합니다. 큐를 씁니다 —
      입기는 잔액을 안 건드리므로 나중에 보내도 결과가 같고, 오프라인에서
      옷을 못 갈아입게 할 이유가 없습니다. 안 산 것은 서버가 걸러 냅니다. */
  function setLoadout(worn, tint, character) {
    if (!configured) return Promise.resolve(null);
    enqueue('world_set_loadout', {
      p_worn: worn || {},
      p_tint: tint || {},
      p_character: character || null,
    }, 'loadout');
    return flush();
  }

  /** 방에 놓은 가구 목록을 통째로 저장합니다. 같은 이유로 큐를 씁니다. */
  function setDecor(list) {
    if (!configured) return Promise.resolve(null);
    enqueue('world_set_decor', {
      p_items: (Array.isArray(list) ? list : []).map((d) => ({ id: d.id, x: d.x, y: d.y })),
    }, 'decor');
    return flush();
  }

  /** 접속할 때 한 번. 잔액·산 것·입은 것·놓은 것·값표를 한 왕복으로 받습니다.
      못 물어봤으면 null — 부르는 쪽은 이 기기에 남은 것으로 계속 돕니다. */
  async function roomState() {
    const r = await callRpc('world_room_state', {});
    return r.ok ? r.data : null;
  }

  /** 명예의 전당 — 학교 순위.
   *
   *  큐를 안 씁니다. 읽기라서 나중에 보낼 이유가 없고, 늦게 도착한 순위는
   *  틀린 순위입니다.
   *
   *  **왜 못 받았는지를 갈라서 돌려줍니다.** 화면이 "서버가 없는 판본" 과
   *  "지금 인터넷이 끊김" 과 "로그인이 풀림" 에 같은 말을 하면, 사람은
   *  기다려야 하는지 다시 열어야 하는지 알 수 없습니다.
   *
   *    reason  'unconfigured'  config.js 가 없거나 file:// — 이 판본엔 서버가 없음
   *            'offline'       토큰이나 요청이 네트워크에서 실패
   *            'unauth'        서버가 401/403 — 로그인이 풀림
   *            'server'        그 밖의 서버 오류
   */
  async function schoolRanking() {
    if (!configured) return { ok: false, reason: 'unconfigured', data: null };
    let t;
    try { t = await token(); }
    catch (e) {
      /* 토큰을 못 얻는 길이 둘입니다. 인터넷이 없거나(fetch 가 던짐),
         서버가 4xx 로 거절하거나(익명 로그인이 꺼져 있는 경우 등).
         뒤엣것을 "오프라인" 이라고 하면 사람은 기다리면 될 줄 압니다. */
      const auth4xx = /^auth 4\d\d$/.test(String((e && e.message) || ''));
      return { ok: false, reason: auth4xx ? 'unauth' : 'offline', data: null };
    }
    let r;
    try {
      r = await fetch(URL_BASE + '/rest/v1/rpc/world_school_ranking', {
        method: 'POST',
        headers: {
          apikey: ANON,
          Authorization: 'Bearer ' + t,
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
    } catch { return { ok: false, reason: 'offline', data: null }; }
    if (r.status === 401 || r.status === 403) return { ok: false, reason: 'unauth', data: null };
    if (!r.ok) return { ok: false, reason: 'server', data: null, status: r.status };
    try { return { ok: true, reason: null, data: await r.json() }; }
    catch { return { ok: false, reason: 'server', data: null }; }
  }

  global.WORLD_SAVE = {
    configured, uuid, finishSession, earnMinigame, balance, flush, pending,
    buyItem, setLoadout, setDecor, roomState, schoolRanking,
    /** 지금 쓰는 액세스 토큰. multiplayer.js 가 Realtime 에 붙일 때 씁니다 —
        여기 로그인 갈래(학교 이메일 → 익명)를 두 곳에서 따로 쓰면 언젠가
        서로 다른 사람으로 붙습니다. 없으면 만들어 옵니다. */
    accessToken: token,
  };

  /* 접속하면: 밀린 것부터 보내고, 서버가 아는 방으로 화면을 맞춥니다.
     index.html 이 'worldsave:room' 을 받아 ROOM 을 덮어씁니다.

     'worldsave:balance' 도 그대로 쏩니다. 잔액만 보던 옛 판본이 아직 있고,
     한 줄 남겨 두는 값이 그것을 찾아 고치는 값보다 쌉니다. */
  if (configured) {
    flush()
      .then(() => roomState())
      .then((st) => {
        if (!st) return;
        global.dispatchEvent(new CustomEvent('worldsave:room', { detail: st }));
        if (typeof st.balance === 'number') {
          global.dispatchEvent(new CustomEvent('worldsave:balance', { detail: { balance: st.balance } }));
        }
      });
  }
})(window);

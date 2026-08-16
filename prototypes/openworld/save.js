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

  function enqueue(fn, args) {
    const q = load(QUEUE_STORE, []);
    q.push({ fn, args, at: Date.now() });
    save(QUEUE_STORE, q);
  }

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

  /** 세션 종료. 서버가 지급까지 마친 뒤의 잔액(숫자)이나, 오프라인이면 null. */
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

  global.WORLD_SAVE = { configured, uuid, finishSession, earnMinigame, balance, flush };

  /* 접속하면: 밀린 것부터 보내고, 서버 잔액으로 화면을 맞춥니다.
     index.html 이 'worldsave:balance' 를 받아 ROOM.coins 를 덮어씁니다. */
  if (configured) {
    flush()
      .then(() => balance())
      .then((b) => {
        if (b !== null) {
          global.dispatchEvent(new CustomEvent('worldsave:balance', { detail: { balance: b } }));
        }
      });
  }
})(window);

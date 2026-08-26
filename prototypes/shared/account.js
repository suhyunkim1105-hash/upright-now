/* 계정에 붙은 기록 — 로그인했으면 서버, 아니면 이 기기.
 *
 * 한동안 세션·코인·연속출석이 전부 localStorage 였습니다. 브라우저가 다르면
 * 다른 사람이었고, 그래서 랭킹전도 팀원 합계도 만들 수가 없었습니다.
 *
 * 표는 새로 만들지 않습니다. `world_sessions` 와 `world_coins` 가 이미
 * 있고, 영상·프레임·랜드마크가 안 들어가도록 설계된 것도 그쪽입니다.
 * 여기서 두 번째 기록 체계를 만들면 값이 조용히 갈라집니다.
 *
 * 코인 규칙도 서버 것을 씁니다 — `world_finish_session` 이 계산합니다.
 * 클라이언트가 세어서 보내면 그 숫자를 믿어야 하고, 믿는 순간 규칙이
 * 아니라 부탁이 됩니다.
 *
 * 로그인 전에 한 세션은 버리지 않습니다. 큐에 담아 두었다가 인증한 뒤
 * 한 번에 올립니다 — 발표에서 메일이 늦게 오는 사람이 있어도 화면이
 * 멈추지 않아야 합니다.
 */
(function (global) {
  'use strict';

  var CFG = global.GIRIN_SUPABASE || {};
  var URL_BASE = (CFG.url || '').replace(/\/+$/, '');
  var ANON = CFG.anonKey || '';

  var LOCAL = 'girin.sessions';     // 기기에만 있는 기록 (= 아직 안 올린 것)
  var QUEUE = 'girin.pending';      // 올려야 하는데 아직 못 올린 것
  var PROFILE = 'girin.profile';

  function read(key, fallback) {
    try {
      var v = JSON.parse(global.localStorage.getItem(key) || 'null');
      return v === null ? fallback : v;
    } catch (e) { return fallback; }
  }
  function write(key, v) {
    try { global.localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* 막혀 있어도 화면은 돕니다 */ }
  }

  /** uuid v4. 세션 id 를 클라이언트가 만들어야 재전송해도 행이 두 번 안 생깁니다. */
  function uuid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : ((r & 0x3) | 0x8)).toString(16);
    });
  }

  var ACCOUNT = {
    /** 지금 로그인한 세션(access_token 포함) 또는 null */
    async session() {
      if (!global.SchoolAuth || !global.SchoolAuth.live) return null;
      try { return await global.SchoolAuth.session(); } catch (e) { return null; }
    },
    async signedIn() { return Boolean(await ACCOUNT.session()); },

    /** RPC 하나 부르기. 로그인 안 했으면 null 을 돌려주고 부르는 쪽이 정합니다. */
    async rpc(name, args) {
      var s = await ACCOUNT.session();
      if (!s || !URL_BASE) return null;
      var res = await global.fetch(URL_BASE + '/rest/v1/rpc/' + name, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: ANON,
          Authorization: 'Bearer ' + s.access_token,
        },
        body: JSON.stringify(args || {}),
      });
      var text = await res.text();
      var data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
      if (!res.ok) {
        var err = new Error((data && (data.message || data.hint)) || ('rpc ' + name + ' ' + res.status));
        err.status = res.status; err.data = data;
        throw err;
      }
      return data;
    },

    /** 표를 그냥 읽습니다 (RLS 가 자기 것만 내줍니다) */
    async select(path) {
      var s = await ACCOUNT.session();
      if (!s || !URL_BASE) return null;
      var res = await global.fetch(URL_BASE + '/rest/v1/' + path, {
        headers: { apikey: ANON, Authorization: 'Bearer ' + s.access_token },
      });
      if (!res.ok) return null;
      return res.json();
    },

    /* ── 기록 ────────────────────────────────────────────────────── */

    /** 세션 하나가 끝났습니다.
     *  @param seatedMin 자세 판정이 실제로 돌아간 분 (카메라가 꺼져 있었으면 0)
     *  @param chairMin  화면에 머문 분 — 사람이 보는 "앉은 시간"
     */
    async finish(row) {
      var body = {
        p_id: row.id || uuid(),
        p_school: row.school || null,
        p_seated_minutes: Math.max(0, Math.round(row.seatedMin || 0)),
        p_campus_minutes: 0,
        p_recoveries: Math.max(0, row.recovers | 0),
        p_started_at: new Date(row.startedAt).toISOString(),
        p_ended_at: new Date(row.endedAt).toISOString(),
      };
      /* 화면에 쓰는 값은 서버가 안 받는 것도 있어서(신호 집계 등) 기기에도
         한 벌 남깁니다. 리포트는 이것을 봅니다 — 지표별 횟수는 서버로
         보내지 않습니다. */
      var localRow = {
        at: row.endedAt, min: Math.round(row.chairMin || row.seatedMin || 0),
        recovers: row.recovers | 0, signals: row.signals || {}, dips: row.dips || [],
        id: body.p_id,
      };
      var all = read(LOCAL, []); all.push(localRow); write(LOCAL, all.slice(-400));

      try {
        var out = await ACCOUNT.rpc('world_finish_session', body);
        if (out === null) throw new Error('not signed in');
        return { synced: true, result: out };
      } catch (e) {
        var q = read(QUEUE, []); q.push(body); write(QUEUE, q.slice(-200));
        return { synced: false, queued: true };
      }
    },

    /** 인증한 뒤 부릅니다. 큐에 쌓인 것을 한 번에 올립니다.
     *  같은 id 로 다시 보내도 행이 두 번 안 생깁니다(서버가 id 로 막습니다). */
    async sync() {
      var q = read(QUEUE, []);
      if (!q.length) return { sent: 0, left: 0 };
      if (!(await ACCOUNT.signedIn())) return { sent: 0, left: q.length };
      var left = [], sent = 0;
      for (var i = 0; i < q.length; i++) {
        try { await ACCOUNT.rpc('world_finish_session', q[i]); sent++; }
        catch (e) { left.push(q[i]); }
      }
      write(QUEUE, left);
      return { sent: sent, left: left.length };
    },

    /** 화면이 쓰는 기록. 로그인 여부와 무관하게 기기 것을 돌려줍니다 —
     *  서버 것은 코인·랭킹의 근거이고, 화면의 그래프는 기기 것으로 그립니다.
     *  둘이 갈라지지 않는 이유는 같은 순간에 같이 쓰기 때문입니다. */
    local() { return read(LOCAL, []); },
    saveLocal(list) { write(LOCAL, list.slice(-400)); },
    pending() { return read(QUEUE, []).length; },

    /** 서버의 코인 잔액. 못 읽으면 null — 화면이 "아직" 이라고 말하게 둡니다. */
    async coins() {
      var rows = await ACCOUNT.select('world_coins?select=balance');
      if (!rows || !rows.length) return null;
      return rows[0].balance;
    },

    profile() { return read(PROFILE, {}); },
    saveProfile(patch) {
      var v = Object.assign(read(PROFILE, {}), patch);
      write(PROFILE, v);
      return v;
    },

    uuid: uuid,
  };

  global.Account = ACCOUNT;
})(typeof window !== 'undefined' ? window : globalThis);

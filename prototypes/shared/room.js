/* 진짜 방 — 코드가 화면 안의 글자가 아니라 서버의 행이 됩니다.
 *
 * 한동안 초대 코드는 내 화면에만 찍히는 여섯 글자였습니다. 복사도 되고
 * 링크도 나갔는데, 받은 사람이 넣어도 같은 곳으로 오지 않았습니다.
 *
 * 표와 RPC 는 이미 있습니다 — rooms · room_members · create_room ·
 * join_room · leave_room · heartbeat_room_member. 여기서는 그것을 부르고,
 * 누가 들어오고 나가는지를 Realtime 으로 받습니다.
 *
 * ── 자세를 주고받는 규칙 ──────────────────────────────────────────
 * 나가는 것은 **상태 한 글자뿐**입니다: good | warning | bad | idle.
 * 영상도, 프레임도, 랜드마크 좌표도, 지표 수치도 보내지 않습니다. 남의
 * 화면에 필요한 것은 "저 사람 지금 어떤 색인가" 하나이고, 그 이상을
 * 보내면 보낼 이유가 없는 것을 보내는 것입니다.
 *
 * 상태는 표에 안 남깁니다. broadcast 로만 흐르고 아무 데도 안 쌓입니다 —
 * 지나간 자세를 남길 이유가 없고, 남기면 그 순간부터 지켜야 할 기록이
 * 하나 늘어납니다.
 */
(function (global) {
  'use strict';

  var CFG = global.GIRIN_SUPABASE || {};
  var URL_BASE = (CFG.url || '').replace(/\/+$/, '');
  var ANON = CFG.anonKey || '';

  var client = null;          // supabase-js (Realtime 때문에 필요합니다)
  var channel = null;
  var beat = 0;

  var STATE = {
    id: null,                 // rooms.id
    code: null,
    host: false,
    me: null,                 // 내 user id
    members: [],              // [{user_id, nickname, role, state, posture}]
    posture: {},              // user_id -> 'good'|'warning'|'bad'|'idle'
  };

  var listeners = [];
  function emit() { listeners.forEach(function (f) { try { f(ROOM.snapshot()); } catch (e) { /* 한 명이 죽어도 나머지는 받습니다 */ } }); }

  async function ensureClient() {
    if (client) return client;
    if (!global.supabase || !URL_BASE) return null;
    var s = global.Account ? await global.Account.session() : null;
    if (!s) return null;
    client = global.supabase.createClient(URL_BASE, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 4 } },
    });
    client.realtime.setAuth(s.access_token);
    /* PostgREST 도 같은 토큰으로 — 안 걸면 RLS 가 anon 으로 봅니다 */
    client.rest.headers.Authorization = 'Bearer ' + s.access_token;
    STATE.me = s.user && s.user.id ? s.user.id : (s.userId || null);
    return client;
  }

  /** 여섯 글자 코드. 서버 제약이 ^[A-Z0-9]{6}$ 이라 같은 모양으로 만듭니다.
   *  헷갈리는 글자(O·0·I·1)는 뺍니다 — 말로 불러 주는 코드입니다. */
  function newCode() {
    var pool = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var out = '';
    for (var i = 0; i < 6; i++) out += pool[Math.floor(Math.random() * pool.length)];
    return out;
  }

  async function refreshMembers() {
    if (!STATE.id || !global.Account) return;
    var rows = await global.Account.select(
      'room_members?room_id=eq.' + STATE.id + '&select=user_id,nickname,role,state&order=joined_at.asc');
    if (!rows) return;
    STATE.members = rows;
    emit();
  }

  function watch() {
    if (!client || !STATE.id) return;
    if (channel) { try { client.removeChannel(channel); } catch (e) { /* 이미 없어졌으면 됐습니다 */ } }
    channel = client.channel('room:' + STATE.id, { config: { broadcast: { self: false } } });

    /* 들어오고 나가는 것은 표를 보고 압니다 — presence 보다 정확합니다.
       표가 곧 정원이고, presence 는 창을 두 개 열면 두 명이 됩니다. */
    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'room_members', filter: 'room_id=eq.' + STATE.id },
      function () { refreshMembers(); });

    /* 자세는 표를 거치지 않습니다. 상태 한 글자만 지나갑니다. */
    channel.on('broadcast', { event: 'posture' }, function (msg) {
      var p = msg && msg.payload;
      if (!p || !p.user) return;
      var v = p.state;
      if (v !== 'good' && v !== 'warning' && v !== 'bad' && v !== 'idle') return;
      STATE.posture[p.user] = v;
      emit();
    });

    channel.subscribe();
  }

  var ROOM = {
    get live() { return Boolean(STATE.id); },
    snapshot: function () {
      return {
        id: STATE.id, code: STATE.code, host: STATE.host, me: STATE.me,
        members: STATE.members.map(function (m) {
          return Object.assign({}, m, { posture: STATE.posture[m.user_id] || null });
        }),
      };
    },
    onChange: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
    newCode: newCode,

    /** 방을 엽니다. 코드를 안 주면 새로 만듭니다. */
    async create(opts) {
      var c = await ensureClient();
      if (!c) return null;
      var code = (opts && opts.code) || newCode();
      var id = await global.Account.rpc('create_room', {
        p_code: code,
        p_nickname: String((opts && opts.nickname) || '나').slice(0, 12),
        p_subject: (opts && opts.subject) || null,
        p_goal: null,
        p_duration_seconds: Math.max(180, Math.min(7200, Math.round(((opts && opts.minutes) || 25) * 60))),
        p_capacity: Math.max(2, Math.min(10, (opts && opts.capacity) || 6)),
      });
      if (!id) return null;
      STATE.id = id; STATE.code = code; STATE.host = true; STATE.posture = {};
      watch(); await refreshMembers(); ROOM.beat(true);
      return ROOM.snapshot();
    },

    /** 코드로 들어갑니다. 없는 코드면 서버가 거절합니다 — 여기서 지어내지 않습니다. */
    async join(code, nickname) {
      var c = await ensureClient();
      if (!c) return null;
      var id = await global.Account.rpc('join_room', {
        p_code: String(code).toUpperCase(),
        p_nickname: String(nickname || '나').slice(0, 12),
      });
      if (!id) return null;
      STATE.id = id; STATE.code = String(code).toUpperCase(); STATE.host = false; STATE.posture = {};
      watch(); await refreshMembers(); ROOM.beat(true);
      return ROOM.snapshot();
    },

    async leave() {
      ROOM.beat(false);
      if (STATE.id) { try { await global.Account.rpc('leave_room', { p_room_id: STATE.id }); } catch (e) { /* 이미 나갔으면 됐습니다 */ } }
      if (channel && client) { try { client.removeChannel(channel); } catch (e) { /* 무시 */ } }
      channel = null; STATE.id = null; STATE.code = null; STATE.members = []; STATE.posture = {};
      emit();
    },

    /** 살아 있다고 알립니다. 안 보내면 서버가 자리를 비웁니다. */
    beat: function (on) {
      clearInterval(beat); beat = 0;
      if (!on || !STATE.id) return;
      var tick = function () {
        global.Account.rpc('heartbeat_room_member', { p_room_id: STATE.id }).catch(function () { /* 한 번 놓쳐도 다음이 있습니다 */ });
      };
      tick();
      beat = setInterval(tick, 20000);
    },

    /** 내 자세를 알립니다. **상태 한 글자만** 나갑니다. */
    say: function (state) {
      if (!channel || !STATE.me) return;
      if (state !== 'good' && state !== 'warning' && state !== 'bad' && state !== 'idle') return;
      if (STATE.posture[STATE.me] === state) return;   // 같은 값은 다시 안 보냅니다
      STATE.posture[STATE.me] = state;
      channel.send({ type: 'broadcast', event: 'posture', payload: { user: STATE.me, state: state } });
      emit();
    },
  };

  global.Room = ROOM;
})(typeof window !== 'undefined' ? window : globalThis);

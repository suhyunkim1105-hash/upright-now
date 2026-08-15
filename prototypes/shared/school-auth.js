/* ============================================================================
   학교 이메일 로그인 — Supabase Auth 를 REST 로 직접 부릅니다.

   왜 SDK 를 안 쓰는가
   -------------------
   프로토타입은 빌드가 없는 단일 HTML 입니다. 여기에 120KB SDK 를 CDN 으로
   끌어오면 그 전제가 깨지고, 팀에 넘기는 standalone.html 도 외부 요청이
   생깁니다. 필요한 것은 종단점 넷뿐이라 fetch 로 충분합니다.

   왜 링크가 아니라 6자리 번호인가
   -------------------------------
   매직 링크는 메일 앱의 내장 브라우저에서 열립니다. 그러면 세션이 월드를
   띄운 브라우저가 아니라 **그 안**에 생기고, 사용자는 로그인했는데
   로그인이 안 된 화면을 보게 됩니다. 번호는 원래 있던 탭에 되돌려
   입력하므로 그런 일이 없습니다. 리디렉트 URL 설정도 필요 없어져
   로컬과 배포가 같은 코드로 돕니다.

   file:// 에서는 동작하지 않습니다
   --------------------------------
   출처가 `null` 이라 Supabase 가 CORS 로 막습니다. `node prototypes/serve.mjs`
   로 띄운 http://localhost 에서 열어야 합니다. 설정이 없거나 file:// 이면
   이 모듈은 `configured: false` 를 돌려주고, 화면은 예전처럼 흉내로
   넘어갑니다 - 팀원이 파일을 더블클릭해서 여는 길을 막지 않기 위해서입니다.
   ============================================================================ */
(function (global) {
  'use strict';

  const CFG = global.GIRIN_SUPABASE || {};
  const URL_BASE = (CFG.url || '').replace(/\/+$/, '');
  const ANON = CFG.anonKey || '';
  const STORE = 'girin.session';

  /* 메일을 한 번 보내고 다음 번까지 기다려야 하는 시간. Supabase 기본값과
     같게 둡니다 - 화면이 60 초를 세어 주지 않으면 사용자는 버튼을 계속
     누르고 429 를 받습니다. 막힌 이유를 화면이 미리 말해 주는 편이 낫습니다. */
  const RESEND_SEC = 60;

  const configured = Boolean(URL_BASE && ANON);
  /* 출처가 http(s) 여야 합니다. file:// 은 `null` 출처라 거절당합니다. */
  const servedOverHttp = /^https?:$/.test(global.location.protocol);

  /* ---------------- 학교 이메일 판정 ----------------
     서버(is_school_email)와 **같은 규칙**입니다. 여기 것은 사용자를 돕는
     것이고, 막는 것은 서버입니다. 둘이 어긋나면 화면은 통과시켰는데
     서버가 거절하는 상황이 생기므로 규칙을 나란히 둡니다. */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  /* .ac.kr 을 안 쓰는 학교. 서버의 school_email_domains 표와 같은 내용입니다. */
  const EXTRA_DOMAINS = { 'skku.edu': '성균관대학교' };

  function domainOf(email) {
    return String(email || '').trim().toLowerCase().split('@')[1] || '';
  }

  function isSchoolEmail(email) {
    const d = domainOf(email);
    if (!d) return false;
    /* 앞의 점을 요구하므로 `notac.kr` 같은 흉내는 걸리지 않습니다. */
    return d === 'ac.kr' || d.endsWith('.ac.kr') || Boolean(EXTRA_DOMAINS[d]);
  }

  /* ---------------- 세션 보관 ----------------
     기기 안에만 남습니다. 토큰 말고는 아무것도 안 담습니다. */
  function readSession() {
    try {
      const s = JSON.parse(global.localStorage.getItem(STORE) || 'null');
      return s && s.access_token ? s : null;
    } catch { return null; }
  }

  function writeSession(s) {
    if (!s) { global.localStorage.removeItem(STORE); return null; }
    const out = {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      /* 서버가 준 만료 시각을 그대로 씁니다. expires_in 으로 직접 재면
         기기 시계가 틀어졌을 때 멀쩡한 토큰을 버리게 됩니다. */
      expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600),
      email: (s.user && s.user.email) || '',
      user_id: (s.user && s.user.id) || '',
    };
    global.localStorage.setItem(STORE, JSON.stringify(out));
    return out;
  }

  /* ---------------- 요청 ---------------- */
  async function call(path, body, token) {
    const res = await global.fetch(URL_BASE + '/auth/v1' + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON,
        Authorization: 'Bearer ' + (token || ANON),
      },
      body: JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch { /* 204 는 본문이 없습니다 */ }
    if (!res.ok) throw makeError(res.status, data);
    return data;
  }

  /* GoTrue 는 판본에 따라 `msg` 또는 `message` 로 옵니다. 둘 다 받습니다. */
  function makeError(status, data) {
    const code = (data && (data.error_code || data.code)) || '';
    const raw = (data && (data.msg || data.message || data.error_description)) || '';
    const e = new Error(raw || ('요청이 실패했습니다 (' + status + ')'));
    e.status = status;
    e.code = code;
    e.friendly = friendly(status, code, raw);
    return e;
  }

  /** 사용자가 읽을 문장. 서버가 준 영어를 그대로 보여 주면 안 됩니다. */
  function friendly(status, code, raw) {
    if (status === 429 || code === 'over_email_send_rate_limit')
      return '메일을 너무 자주 보냈습니다. 1 분쯤 뒤에 다시 시도해 주세요.';
    if (status === 403)
      /* 가입 차단 훅이 돌려준 한국어 문장입니다. 그대로 보여 주는 것이
         맞습니다 - 왜 막혔는지는 서버만 정확히 압니다. */
      return raw || '이 주소로는 가입할 수 없습니다.';
    if (code === 'otp_expired' || /expired/i.test(raw))
      return '번호가 만료됐습니다. 메일을 다시 받아 주세요.';
    if (status === 400 || status === 401 || code === 'invalid_credentials')
      return '번호가 맞지 않습니다. 메일을 다시 확인해 주세요.';
    if (status === 422) return '이메일 주소를 다시 확인해 주세요.';
    return '지금은 연결이 안 됩니다. 잠시 뒤에 다시 시도해 주세요.';
  }

  /* ---------------- 공개 ---------------- */
  const AUTH = {
    configured,
    servedOverHttp,
    /** 진짜 로그인을 걸 수 있는 상태인가. 아니면 화면이 흉내로 넘어갑니다. */
    get live() { return configured && servedOverHttp; },
    /** 왜 못 쓰는지 - 화면에 그대로 띄웁니다. 조용히 흉내로 넘어가면
        가짜 통과를 진짜로 착각합니다. */
    get reason() {
      if (!configured) return 'Supabase 설정이 없습니다 (prototypes/shared/config.js)';
      if (!servedOverHttp) return 'file:// 에서는 로그인할 수 없습니다 (node prototypes/serve.mjs)';
      return '';
    },
    RESEND_SEC,
    isSchoolEmail,
    domainOf,

    /** 인증 메일을 보냅니다. 계정이 없으면 이때 만들어집니다 -
        그 순간 서버의 가입 차단 훅이 학교 메일인지 봅니다. */
    async sendCode(email) {
      await call('/otp', {
        email: String(email).trim().toLowerCase(),
        create_user: true,
        data: {},
        gotrue_meta_security: {},
      });
      return true;
    },

    /** 6자리를 세션으로 바꿉니다. */
    async verifyCode(email, token) {
      const data = await call('/verify', {
        email: String(email).trim().toLowerCase(),
        token: String(token).trim(),
        type: 'email',
        gotrue_meta_security: {},
      });
      if (!data || !data.access_token) throw makeError(400, data);
      return writeSession(data);
    },

    /** 지금 로그인된 세션. 만료가 가까우면 조용히 갱신합니다.
        갱신에 실패하면 지웁니다 - 죽은 토큰을 들고 있으면 이후 모든
        요청이 401 로 떨어지고 원인이 안 보입니다. */
    async session() {
      const s = readSession();
      if (!s) return null;
      /* 60 초 여유. 정확히 만료 시각에 맞춰 갱신하면 요청이 날아가는
         사이에 만료됩니다. */
      if (s.expires_at > Math.floor(Date.now() / 1000) + 60) return s;
      if (!s.refresh_token || !this.live) return null;
      try {
        const res = await global.fetch(URL_BASE + '/auth/v1/token?grant_type=refresh_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: 'Bearer ' + ANON },
          body: JSON.stringify({ refresh_token: s.refresh_token }),
        });
        if (!res.ok) { writeSession(null); return null; }
        return writeSession(await res.json());
      } catch { return null; }
    },

    /** 서버 쪽 세션도 끊습니다. 실패해도 기기에서는 지웁니다 -
        네트워크가 없다고 로그아웃이 안 되면 안 됩니다. */
    async signOut() {
      const s = readSession();
      writeSession(null);
      if (s && this.live) { try { await call('/logout', {}, s.access_token); } catch { /* 지웠으면 됐습니다 */ } }
    },
  };

  global.SchoolAuth = AUTH;
})(window);

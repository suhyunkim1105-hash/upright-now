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

   번호는 이 파일만으로 오지 않습니다
   ----------------------------------
   GoTrue 는 인증 메일마다 링크와 6자리 번호를 **둘 다** 만들고, 어느 쪽을
   보여 줄지는 오직 메일 본문 템플릿이 정합니다. Supabase 기본 템플릿은
   링크만 찍으므로, 여기서 아무리 번호를 기다려도 사용자는 링크를 받습니다.
   실제로 그 상태로 한동안 돌았습니다.

   대시보드 -> Authentication -> Emails 의 **Confirm signup 과 Magic Link
   둘 다** 본문에 {{ .Token }} 이 있어야 합니다. 첫 인증은 Magic Link 가
   아니라 Confirm signup 이 나가므로, 한쪽만 고치면 신규 사용자는 그대로
   링크를 받습니다. 붙여 넣을 원본과 이유는 supabase/email-templates/ 입니다.

   file:// 에서는 동작하지 않습니다
   --------------------------------
   출처가 `null` 이라 Supabase 가 CORS 로 막습니다. `npx http-server . -p 8177 -c-1`
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
  /* 도메인 → 학교 이름. 온보딩과 마이페이지가 **같은 표**를 봅니다 —
     한동안 온보딩 안에만 있었는데, 마이페이지에서 다시 인증하면 같은
     주소가 다른 이름으로 저장될 수 있었습니다.
     .ac.kr 을 안 쓰는 학교도 여기 들어 있습니다. 서버의
     school_email_domains 표와 같은 내용입니다. */
  const SCHOOLS = {
    'mju.ac.kr': '명지대학교', 'snu.ac.kr': '서울대학교', 'yonsei.ac.kr': '연세대학교',
    'korea.ac.kr': '고려대학교', 'hanyang.ac.kr': '한양대학교', 'skku.edu': '성균관대학교',
    'kaist.ac.kr': 'KAIST', 'postech.ac.kr': 'POSTECH', 'cau.ac.kr': '중앙대학교',
    'khu.ac.kr': '경희대학교', 'ewha.ac.kr': '이화여자대학교', 'sogang.ac.kr': '서강대학교',
    'konkuk.ac.kr': '건국대학교', 'dankook.ac.kr': '단국대학교', 'inha.ac.kr': '인하대학교',
  };
  /* .ac.kr 밖의 주소만 따로 셉니다 — 판정에 쓰는 것은 이쪽입니다. */
  const EXTRA_DOMAINS = Object.fromEntries(
    Object.entries(SCHOOLS).filter(([d]) => !d.endsWith('.ac.kr')));

  function domainOf(email) {
    return String(email || '').trim().toLowerCase().split('@')[1] || '';
  }

  function isSchoolEmail(email) {
    const d = domainOf(email);
    if (!d) return false;
    /* 앞의 점을 요구하므로 `notac.kr` 같은 흉내는 걸리지 않습니다. */
    return d === 'ac.kr' || d.endsWith('.ac.kr') || Boolean(EXTRA_DOMAINS[d]);
  }

  /** 주소에서 학교 이름. 모르는 .ac.kr 도 이름을 만들어 돌려줍니다 —
      null 을 돌려주면 화면이 인증된 사람을 미인증으로 그립니다. */
  function schoolOf(email) {
    const d = domainOf(email);
    if (SCHOOLS[d]) return SCHOOLS[d];
    /* 학과 서브도메인 — cs.snu.ac.kr 같은 주소도 받습니다 */
    const hit = Object.keys(SCHOOLS).find((k) => d.endsWith('.' + k));
    if (hit) return SCHOOLS[hit];
    return d.endsWith('.ac.kr') ? d.replace(/\.ac\.kr$/, '') + ' (미등록 학교)' : null;
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
    if (!res.ok) throw makeError(res.status, data, path);
    return data;
  }

  /* GoTrue 는 판본에 따라 `msg` 또는 `message` 로 옵니다. 둘 다 받습니다. */
  function makeError(status, data, path) {
    const code = (data && (data.error_code || data.code)) || '';
    const raw = (data && (data.msg || data.message || data.error_description)) || '';
    const e = new Error(raw || ('요청이 실패했습니다 (' + status + ')'));
    e.status = status;
    e.code = code;
    e.friendly = friendly(status, code, raw, path || '');
    return e;
  }

  /** 사용자가 읽을 문장. 서버가 준 영어를 그대로 보여 주면 안 됩니다. */
  function friendly(status, code, raw, path) {
    if (status === 429 || code === 'over_email_send_rate_limit')
      return '메일을 너무 자주 보냈습니다. 1 분쯤 뒤에 다시 시도해 주세요.';
    /* 403 은 두 끝에서 옵니다.

       `/otp` 에서는 가입 차단 훅이 막은 것이고, 서버가 왜 막혔는지
       한국어로 담아 보냅니다 - 이유는 서버만 정확히 아니 그대로 보여
       줍니다.

       `/verify` 에서는 틀리거나 만료된 6자리입니다. GoTrue 가
       "Token has expired or is invalid" 를 보내는데, 상태 코드만 보고
       raw 를 내보내면 그 영어가 화면에 그대로 떴습니다.

       그래서 상태가 아니라 **어느 끝** 인지로 가릅니다. */
    if (status === 403 && path === '/otp') return raw || '이 주소로는 가입할 수 없습니다.';
    if (code === 'otp_expired' || /expired/i.test(raw))
      return '번호가 만료됐습니다. 메일을 다시 받아 주세요.';
    if (status === 400 || status === 401 || status === 403 || code === 'invalid_credentials')
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
      if (!servedOverHttp) return 'file:// 에서는 로그인할 수 없습니다 (npx http-server . -p 8177 -c-1)';
      return '';
    },
    RESEND_SEC,
    isSchoolEmail,
    domainOf,
    schoolOf,
    SCHOOLS,

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

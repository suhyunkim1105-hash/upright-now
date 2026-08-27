/* ══════════════════════════════════════════════════════════
   비공개 세션 녹음 → 노션 AI 회의록.

   **두 화면이 함께 씁니다** — 메인(deskfit)의 비공개 세션과 월드
   (campus3d). 그래서 shared/ 에 있습니다. 월드는 모듈이라 import 로
   받고, 메인은 고전 스크립트라 한 줄짜리 모듈 껍데기로 window 에
   올려 씁니다(deskfit/index.html 의 <script type="module"> 참고).

   이 파일이 하는 일은 셋뿐입니다 — 마이크를 열고, 소리를 모으고,
   `/api/notion-meeting` 으로 한 번 보냅니다. 전사도 요약도 노션이
   합니다. 여기서는 소리를 **저장하지도 분석하지도** 않습니다.

   자세 판정과 완전히 따로입니다
   ------------------------------
   posture-live.js 는 카메라만 쓰고 프레임을 즉시 버립니다. 이 파일은
   마이크만 씁니다. 둘은 서로를 부르지 않고, 같은 스트림을 나눠 쓰지도
   않습니다. 녹음을 켜도 자세 판정은 하던 대로 돌고, 녹음을 안 켜도
   세션은 그대로 됩니다.

   왜 audio/mp4 인가
   -----------------
   **노션은 WebM 을 안 받습니다.** 크롬 MediaRecorder 의 기본값이 WebM 이라
   그냥 두면 전사가 통째로 실패합니다. 크롬 151 부터 audio/mp4(AAC)를
   네이티브로 녹음하므로 그걸 씁니다 — 브라우저에서 변환할 필요가 없습니다.
   (재 봤습니다: isTypeSupported('audio/mp4;codecs=mp4a.40.2') === true)

   24kbps 모노인 이유
   ------------------
   사람 말을 전사하는 데는 이만하면 됩니다. 그리고 Vercel 함수의 요청
   본문이 4.5MB 라 그게 실제 한도입니다 — 24kbps 면 3KB/s 이므로 약
   25분입니다. 64kbps 로 올리면 9분에서 끊깁니다.

   켜져 있지 않으면 없는 기능입니다
   --------------------------------
   토큰이 없으면 서버가 { configured: false } 를 돌려주고, 부르는 쪽은
   단추를 아예 안 그립니다. 눌러도 아무 일이 없는 단추가 제일 나쁩니다.
   ══════════════════════════════════════════════════════════ */

const MIME = 'audio/mp4;codecs=mp4a.40.2';
const MIME_FALLBACK = 'audio/mp4';
const BPS = 24000;
const MAX_SEC = 25 * 60;
const API = '/api/notion-meeting';
const OAUTH = '/api/notion-oauth';

/* 학교 인증으로 로그인해 둔 사람이면 그 토큰을 실어 보냅니다.
   서버는 이걸 보고 **그 사람 자기 노션**에 씁니다. 없으면 서버가
   내부 통합(한 워크스페이스)으로 물러납니다.
   토큰 갱신은 school-auth 가 알아서 합니다 — 여기서 또 하지 않습니다. */
async function bearer() {
  try {
    const s2 = await window.SchoolAuth?.session?.();
    return s2?.access_token ? { Authorization: 'Bearer ' + s2.access_token } : {};
  } catch { return {}; }
}

/** 내 노션이 연결돼 있나. { connected, workspace } */
export async function notionStatus() {
  try {
    const r = await fetch(OAUTH, { headers: await bearer() });
    return r.ok ? await r.json() : { configured: false };
  } catch { return { configured: false }; }
}

/** 노션 승인 화면으로 보냅니다. 돌아오면 ?notion=ok 가 붙습니다. */
export async function notionConnect() {
  const r = await fetch(OAUTH + '?start=1', { headers: await bearer() });
  const j = await r.json().catch(() => ({}));
  if (j.url) { location.href = j.url; return true; }
  return false;
}

/** 연결 끊기 */
export async function notionDisconnect() {
  await fetch(OAUTH, { method: 'DELETE', headers: await bearer() });
}

/** 이 브라우저가 노션이 받는 형식으로 녹음할 수 있나 */
export function canRecord() {
  if (typeof MediaRecorder === 'undefined') return false;
  if (!navigator.mediaDevices?.getUserMedia) return false;
  return MediaRecorder.isTypeSupported(MIME) || MediaRecorder.isTypeSupported(MIME_FALLBACK);
}

/** 서버에 토큰이 꽂혀 있나. 한 번만 묻고 답을 들고 있습니다 */
let asked = null;
export function isConfigured() {
  if (asked) return asked;
  asked = bearer()
    .then((h) => fetch(API, { method: 'GET', headers: h }))
    .then((r) => (r.ok ? r.json() : { configured: false }))
    .then((j) => !!j.configured)
    /* 프로토타입을 그냥 정적 서버로 열면 /api 가 없어 404 입니다.
       그건 고장이 아니라 "안 켜져 있음" 입니다. */
    .catch(() => false);
  return asked;
}

/** 다 담긴 소리를 노션으로 보냅니다.

    createRecorder 를 안 쓰고 **올리는 일만** 필요한 쪽이 있습니다 —
    메인 화면(deskfit)의 비공개 세션은 이미 자기 마이크 스트림을 열어
    레벨 미터까지 그리고 있어서, 여기서 getUserMedia 를 또 부르면
    권한창이 두 번 뜨고 스트림이 둘이 됩니다. 그래서 보내는 길만
    따로 냅니다 — 올리는 코드는 이 함수 하나입니다.

    @returns {{ok: boolean, result?: object, message?: string}} */
export async function sendToNotion(blob, title) {
  const type = (blob.type || MIME_FALLBACK).split(';')[0];
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: {
        'Content-Type': type,
        'X-Session-Title': encodeURIComponent(title || '비공개 세션'),
        ...(await bearer()),
      },
      body: blob,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) return { ok: false, message: j.message || '노션에 못 올렸어요.' };
    return { ok: true, result: j };
  } catch {
    return { ok: false, message: '보내는 중에 끊겼어요.' };
  }
}

/** 노션이 받는 형식인가. WebM 이면 전사가 통째로 실패하므로 미리 거릅니다. */
export function notionTakes(mime) {
  return /audio\/(mp4|mpeg|m4a|wav|ogg)/.test(String(mime || ''));
}

/**
 * @param {object} opt
 *   onState(s)  idle · asking · recording · sending · done · failed
 *   onTime(sec) 초마다
 *   onDone(res) { url, id, status }
 *   onError(msg)
 */
export function createRecorder(opt = {}) {
  let rec = null, stream = null, chunks = [], t0 = 0, timer = 0;
  let state = 'idle';

  const set = (s) => { state = s; opt.onState?.(s); };

  async function start(title) {
    if (state === 'recording' || state === 'asking') return state;
    set('asking');
    try {
      /* 소리만 받습니다. 카메라를 같이 요구하면 권한창이 "카메라와
         마이크" 가 되어 허용률이 떨어집니다 — posture.js 가 카메라를
         따로 받는 것과 같은 이유입니다. */
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
        video: false,
      });
    } catch {
      set('idle');
      opt.onError?.('마이크를 못 켰어요. 주소창의 자물쇠에서 허용해 주세요.');
      return 'idle';
    }
    const mime = MediaRecorder.isTypeSupported(MIME) ? MIME : MIME_FALLBACK;
    chunks = [];
    rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: BPS });
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => finish(title);
    rec.start(4000);                       // 4초마다 덩어리 — 중간에 끊겨도 앞부분은 남습니다
    t0 = Date.now();
    set('recording');
    timer = setInterval(() => {
      const sec = Math.floor((Date.now() - t0) / 1000);
      opt.onTime?.(sec);
      /* 한도에서 스스로 멈춥니다. 넘겨서 보내면 서버가 413 을 주고
         그때까지 녹음한 것이 통째로 사라집니다. */
      if (sec >= MAX_SEC) stop();
    }, 1000);
    return 'recording';
  }

  function stop() {
    if (state !== 'recording') return;
    clearInterval(timer); timer = 0;
    try { rec.stop(); } catch { finish(); }
  }

  function release() {
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    rec = null;
  }

  async function finish(title) {
    const type = (rec && rec.mimeType ? rec.mimeType : MIME_FALLBACK).split(';')[0];
    const blob = new Blob(chunks, { type });
    chunks = [];
    release();
    if (blob.size < 2000) {              // 1초도 안 되는 것은 안 보냅니다
      set('idle');
      opt.onError?.('너무 짧아요.');
      return;
    }
    set('sending');
    const r = await sendToNotion(blob, title);
    if (r.ok) { set('done'); opt.onDone?.(r.result); }
    else { set('failed'); opt.onError?.(r.message); }
  }

  return {
    start, stop,
    get state() { return state; },
    get max() { return MAX_SEC; },
    dispose() { clearInterval(timer); release(); },
  };
}

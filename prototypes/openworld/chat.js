/* ==================================================================
   Deskfit — 채팅

   multiplayer.js 뒤에 읽힙니다. 말은 전부 MP 를 거쳐 갑니다 —
   내가 한 말도 서버가 되돌려 준 것을 그립니다(에코). 그래야 필터를
   한 군데만 걸면 되고, 서버가 붙어도 코드가 안 바뀝니다.

   말풍선은 3초입니다. 짧으면 못 읽고, 길면 광장에 사람이 여섯만 돼도
   글자가 서로를 가립니다. 못 본 말은 아래 목록에 남습니다.
   ================================================================== */
(function () {
  'use strict';

  const BUBBLE_MS = 3000;
  const LOG_LINES = 5;
  const MAX_LEN = 80;
  const EMOJIS = [
    ['👍', '좋아요'], ['😂', '웃김'], ['🔥', '불타는 중'],
    ['💪', '힘내요'], ['👀', '보고 있어요'],
  ];

  /* ================== 화면 ================== */
  const css = document.createElement('style');
  css.textContent = `
  /* 왼쪽 아래. 전에는 화면 한복판 아래였는데, 캐릭터 바로 밑이라
     NPC 앞에서 뜨는 안내가 채팅에 가렸습니다. 오른쪽 아래는 세션·코인·
     웹캠이 쓰므로 남은 자리는 왼쪽입니다. */
  #chat {
    position: fixed; left: 20px; bottom: 18px;
    z-index: 7; width: min(400px, calc(100vw - 420px));
    display: flex; flex-direction: column; gap: 7px; align-items: stretch;
  }

  #chat-log {
    display: flex; flex-direction: column; gap: 3px;
    font-size: 12px; line-height: 1.45;
    /* 목록은 배경 없이 뜹니다. 항상 떠 있는 상자를 두면 월드가 그만큼
       좁아지는데, 대화는 늘 오는 게 아닙니다. */
  }
  #chat-log:empty { display: none; }
  #chat-log div {
    align-self: flex-start; max-width: 100%;
    padding: 3px 9px; border-radius: 999px;
    background: rgba(255,255,255,.93); color: #2A2320;
    box-shadow: 0 1px 3px rgba(78,47,38,.16), 0 0 0 1px rgba(78,47,38,.06);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  #chat-log div b { font-weight: 700; color: #A8391F; margin-right: 5px; }
  #chat-log div.mine b { color: #1F6B45; }
  #chat-log div.fade { opacity: .55; }

  #chat-bar {
    display: flex; align-items: center; gap: 6px;
    background: var(--surface); border: 1px solid var(--line-2);
    border-radius: 999px; padding: 5px 6px 5px 13px; box-shadow: var(--sh);
  }
  #chat-bar.hot { border-color: var(--coral-400); }
  #chat-input {
    flex: 1; min-width: 0; border: 0; background: transparent;
    font: inherit; font-size: 13px; color: var(--ink);
  }
  #chat-input::placeholder { color: #7A6C66; }
  #chat-input:focus { outline: none; }
  #chat-emoji { display: flex; gap: 2px; flex: none; }
  #chat-emoji button {
    width: 26px; height: 26px; padding: 0; flex: none;
    border: 0; border-radius: 50%; background: transparent;
    font-size: 15px; line-height: 1; cursor: pointer;
  }
  #chat-emoji button:hover { background: var(--coral-100); }
  #chat-emoji button:focus-visible { outline: 2px solid var(--coral-600); outline-offset: 1px; }
  #chat-send {
    flex: none; border: 0; border-radius: 999px; cursor: pointer;
    background: var(--coral); color: var(--on-coral);
    font: inherit; font-size: 12px; font-weight: 700; padding: 5px 12px;
  }
  #chat-send:focus-visible { outline: 2px solid var(--coral-600); outline-offset: 2px; }

  .chat-bubble {
    position: absolute; transform: translate(-50%, -100%);
    max-width: 190px; padding: 5px 10px; border-radius: 11px;
    background: #fff; color: #2A2320;
    font-size: 12px; font-weight: 600; line-height: 1.4;
    text-align: center; word-break: break-word;
    box-shadow: 0 3px 10px rgba(78,47,38,.22), 0 0 0 1px rgba(78,47,38,.09);
  }
  /* 꼬리. 없으면 누가 한 말인지 두 사람이 붙어 서면 모릅니다. */
  .chat-bubble::after {
    content: ''; position: absolute; left: 50%; bottom: -5px;
    width: 8px; height: 8px; margin-left: -4px; background: #fff;
    transform: rotate(45deg); border-radius: 1px;
    box-shadow: 2px 2px 0 rgba(78,47,38,.07);
  }
  .chat-bubble.emo { font-size: 22px; padding: 3px 9px; line-height: 1.1; }
  .chat-bubble.mine { background: #FFF0EB; }
  .chat-bubble.mine::after { background: #FFF0EB; }

  /* ---- 숨기기 ----
     설정에서 끄면 **읽는 것만** 닫습니다. 입력줄은 남습니다 — 쓰는 것과
     읽는 것은 다른 결정이고, 조용히 있고 싶은 사람도 말은 걸 수 있어야
     합니다. Enter 로 입력줄에 들어가면 그동안만 목록이 열립니다. */
  body.chat-quiet #chat-log,
  body.chat-quiet .chat-bubble { display: none; }
  body.chat-quiet.chat-peek #chat-log { display: flex; }

  /* ---- 막혔을 때 ----
     왜 막혔는지는 목록에 한 줄로 남깁니다. 조용히 삼키면 사용자는
     자기 말이 갔는지 안 갔는지도 모릅니다. 남의 말과 색으로 갈라
     이건 사람이 한 말이 아니라는 것을 먼저 보여 줍니다. */
  #chat-log div.sys {
    background: #FFF0EB; color: #8E2E1C;
    box-shadow: 0 1px 3px rgba(142,46,28,.14), 0 0 0 1px rgba(142,46,28,.14);
    font-weight: 600; white-space: normal;
  }
  #chat-log div.sys.calm { background: var(--teal-50); color: var(--teal-800);
    box-shadow: 0 1px 3px rgba(12,90,79,.12), 0 0 0 1px rgba(12,90,79,.12); }
  #chat-bar.locked { border-color: var(--coral); background: #FFF7F4; }
  #chat-bar.locked #chat-send { opacity: .45; }
  `;
  document.head.append(css);

  const box = document.createElement('div');
  box.id = 'chat';
  box.innerHTML =
    '<div id="chat-log" role="log" aria-live="polite" aria-label="최근 대화"></div>' +
    '<div id="chat-bar">' +
      '<input id="chat-input" type="text" autocomplete="off" maxlength="' + MAX_LEN + '"' +
      ' placeholder="Enter · 채팅" aria-label="채팅 입력. Enter 로 보냅니다. Esc 로 닫습니다.">' +
      '<div id="chat-emoji" role="group" aria-label="반응 보내기"></div>' +
      '<button type="button" id="chat-send">보내기</button>' +
    '</div>';
  document.body.append(box);

  const logEl = box.querySelector('#chat-log');
  const barEl = box.querySelector('#chat-bar');
  const inputEl = box.querySelector('#chat-input');
  const emojiEl = box.querySelector('#chat-emoji');

  EMOJIS.forEach(([e, label]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = e;
    b.setAttribute('aria-label', label + ' 반응 보내기');
    /* 반응도 같은 제한을 받습니다. 광장에 뜨는 말풍선은 글자든 그림이든
       같은 자리를 쓰고, 도배도 같이 됩니다. */
    b.addEventListener('click', () => {
      const v = CHAT.check(e);
      if (!v.ok) { if (v.msg) sys(v.msg, false); return; }
      MP.say('', e);
      inputEl.focus();
    });
    emojiEl.append(b);
  });

  /* ================== 도배 제한 ==================
     세 가지를 같이 봅니다. 하나만으로는 다 못 막습니다 —
     간격만 두면 1.3초마다 계속 칠 수 있고, 개수만 세면 붙여넣기 한 번에
     다섯 줄이 나갑니다.

       간격  1초  한 줄 치는 데 그보다는 걸립니다. "ㅇㅇ" · "ㅋㅋ" 같은
                    짧은 맞장구는 그대로 되고, 키를 누른 채 두거나 붙여넣기로
                    쏟는 것만 걸립니다.
       개수  10초에 8줄  간격의 바닥(1초)을 여덟 번 연속으로 친 경우입니다.
                    처음엔 10초에 5줄로 뒀는데, 1.4초 간격으로 평범하게
                    말하는 사람이 스물두 줄 중 열한 줄에서 막혔습니다 —
                    도배를 막으려다 대화를 막았습니다. 트위치가 30초에
                    20줄(=1.5초에 한 줄)이고, 여기는 그보다 조금 넉넉합니다.
       반복  같은 말 3번  "ㅋㅋ" 를 세 번까지는 사람이 합니다. 네 번째부터는
                    도배입니다.

     넘으면 **8초 잠깁니다.** 잠긴 동안 남은 시간이 입력줄과 목록에 같이
     보입니다 — 왜 안 나가는지 모르는 채로 기다리게 두지 않습니다.
     8초인 이유: 대화의 흐름이 끊길 만큼은 길고, 자리를 뜰 만큼은 아닙니다.

     친 글은 지우지 않습니다. 막힌 이유를 읽고 고쳐서 다시 보낼 수 있어야
     하고, 잘못 걸린 경우에 다시 치게 만드는 것이 가장 나쁩니다. */
  const RATE = {
    GAP: 1000, WINDOW: 10000, BURST: 8, SAME: 3, LOCK: 8000,
    sent: [], last: 0, lastText: '', same: 0, lockUntil: 0, timer: 0, line: null,
  };

  /** 잠금 남은 시간을 초 단위로 */
  const lockLeft = () => Math.max(0, Math.ceil((RATE.lockUntil - Date.now()) / 1000));

  function lock(why) {
    RATE.lockUntil = Date.now() + RATE.LOCK;
    RATE.sent = []; RATE.same = 0;
    barEl.classList.add('locked');
    const line = sys(why + ' ' + lockLeft() + '초 뒤에 다시 보낼 수 있어요.', false);
    RATE.line = line;
    clearInterval(RATE.timer);
    RATE.timer = setInterval(() => {
      const left = lockLeft();
      if (left > 0) {
        if (line.isConnected) line.querySelector('span').textContent = why + ' ' + left + '초 뒤에 다시 보낼 수 있어요.';
        inputEl.placeholder = left + '초 뒤에 보낼 수 있어요';
        return;
      }
      clearInterval(RATE.timer); RATE.timer = 0;
      RATE.line = null;
      barEl.classList.remove('locked');
      inputEl.placeholder = 'Enter · 채팅';
      /* 세는 줄이 목록에서 밀려났으면 새로 한 줄 남깁니다 — 다섯 줄만
         남기는 목록이라 대화가 오가면 밀려납니다. */
      if (line.isConnected) { line.querySelector('span').textContent = '이제 보낼 수 있어요.'; line.classList.add('calm'); }
      else sys('이제 보낼 수 있어요.', true);
    }, 250);
  }

  /** 보내도 되는지. 안 되면 이유를 돌려줍니다. */
  function rateCheck(text) {
    const now = Date.now();
    if (now < RATE.lockUntil) {
      /* 세는 줄이 아직 목록에 있으면 거기서 이미 말하고 있습니다.
         칠 때마다 같은 줄을 새로 쌓으면 목록이 안내로 가득 찹니다. */
      return { ok: false, msg: RATE.line && RATE.line.isConnected ? '' : lockLeft() + '초 뒤에 다시 보낼 수 있어요.' };
    }
    if (now - RATE.last < RATE.GAP)
      return { ok: false, msg: '조금 천천히 보내 주세요. 한 줄 보내고 1초예요.' };
    RATE.sent = RATE.sent.filter((t) => now - t < RATE.WINDOW);
    if (RATE.sent.length >= RATE.BURST) {
      lock('10초에 여덟 줄까지예요.');
      return { ok: false, msg: '' };            // lock 이 이미 한 줄 남겼습니다
    }
    RATE.same = text && text === RATE.lastText ? RATE.same + 1 : 1;
    if (RATE.same > RATE.SAME) {
      lock('같은 말을 네 번 보냈어요.');
      return { ok: false, msg: '' };
    }
    RATE.last = now; RATE.sent.push(now); RATE.lastText = text;
    return { ok: true, msg: '' };
  }

  /* ================== 비속어 ==================
     닉네임과 **같은 검사기**를 씁니다(prototypes/shared/korcen.js).
     목록을 새로 쓰지 않는 이유는 "시1발" 한 번에 뚫리기 때문입니다.

     닉네임과 다르게 다뤄야 하는 점이 둘 있습니다.

     ① 채팅은 흐름입니다. 닉네임은 한 번 정하는 값이라 막고 다시 짓게 해도
        되지만, 대화 도중에 멀쩡한 문장이 통째로 사라지면 대화가 끊깁니다.
        그래서 **내가 보내는 말은 막고**(보내기 전이라 고칠 수 있습니다),
        **남에게서 오는 말은 그 낱말만 가립니다**(이미 일어난 일이고,
        통째로 지우면 무슨 일이 있었는지도 안 보입니다).
     ② 잘못 걸리는 쪽이 더 나쁩니다. 실측으로 평범한 문장 서른 개(“시발점은
        여기부터야” 포함)에서 하나도 안 걸렸습니다. korcen 이 오탐 목록을
        따로 들고 있어서 문맥이 있는 낱말은 통과합니다.

     korcen 이 놓치는 것 한 줌을 여기서 덧댑니다. 구운 파일(korcen.js)은
     "직접 고치지 마세요" 가 규칙이라 원본을 다시 굽기 전까지의 임시입니다.
     지금 확인된 구멍은 **'씨발' 원형** 입니다 — '시발'·'씨빨'·'씹발'·'씨바'
     는 잡는데 정작 '씨발' 이 사전에 없습니다. 우회형이 아니라 원형이라
     그냥 두면 필터가 있는 뜻이 없습니다. */
  const EXTRA_BAD = ['씨발', '싀발', '씨발놈', '씨발년'];
  /* korcen 이 오탐으로 빼 둔 말은 여기서도 빼야 합니다 — 안 그러면
     "아저씨발" 이 걸립니다. */
  const EXTRA_OK = /아저씨발|아조씨발|아저씨바|씨발라/g;

  function isBad(text) {
    if (!text) return false;
    try {
      if (window.Korcen && Korcen.isProfane(text)) return true;
      const t = String(text).replace(EXTRA_OK, '');
      return EXTRA_BAD.some((w) => t.includes(w));
    } catch {
      /* 검사기가 터지면 통과시킵니다 — 닉네임과 같은 규칙입니다.
         고장 난 검사기 때문에 아무 말도 못 하게 되는 편이 더 큰 고장입니다. */
      return false;
    }
  }

  const CHAT = {
    /** 남에게서 온 말 — 걸린 **낱말만** 가립니다. 어느 낱말인지 못 짚으면
        문장을 통째로 가립니다(문맥으로 걸린 경우).
        @param {string} text @returns {string} */
    filter(text) {
      if (!isBad(text)) return text;
      const parts = String(text).split(/(\s+)/);
      let hit = false;
      const out = parts.map((w) => {
        if (!w.trim() || !isBad(w)) return w;
        hit = true;
        return '●'.repeat(Math.min(6, [...w].length));
      }).join('');
      return hit ? out : '(가려진 말)';
    },
    /** 내가 보내는 말 — 보내도 되는지. */
    check(text) {
      if (isBad(text))
        return { ok: false, msg: '욕설·비하로 걸려서 안 보냈어요. 고쳐서 다시 보내 주세요.' };
      return rateCheck(text);
    },
    /** 남의 말을 화면에 띄울지. 끄면 최근 대화와 머리 위 말풍선이 닫히고,
        입력줄은 그대로 남습니다. 설정(마이페이지)이 부릅니다. */
    setVisible(on) { document.body.classList.toggle('chat-quiet', !on); },
  };
  window.CHAT = CHAT;

  /* ================== 말풍선 ================== */
  const bubbles = new Map();      // id -> { el, until }

  function bubble(id, text, emoji, mine) {
    let b = bubbles.get(id);
    if (!b) {
      const el = document.createElement('div');
      el.className = 'chat-bubble';
      el.setAttribute('aria-hidden', 'true');   // 목록이 이미 읽어 줍니다
      document.body.append(el);
      b = { el }; bubbles.set(id, b);
    }
    b.el.className = 'chat-bubble' + (emoji ? ' emo' : '') + (mine ? ' mine' : '');
    b.el.textContent = emoji || text;
    b.until = performance.now() + BUBBLE_MS;
  }

  /* 내 머리 위에는 세션 타이머와 상호작용 안내가 이미 있습니다.
     그 위로 비켜 세웁니다. 남은 이름표 위. */
  const LIFT_ME = 52, LIFT_OTHER = 34;

  function syncBubbles() {
    const now = performance.now();
    for (const [id, b] of bubbles) {
      if (now > b.until) { b.el.remove(); bubbles.delete(id); continue; }
      const p = MP.visible(id) && MP.headOf(id);
      if (!p) { b.el.style.display = 'none'; continue; }
      b.el.style.display = 'block';
      b.el.style.left = p.x + 'px';
      b.el.style.top = (p.y - (id === MP.meId ? LIFT_ME : LIFT_OTHER)) + 'px';
    }
    requestAnimationFrame(syncBubbles);
  }
  requestAnimationFrame(syncBubbles);

  /* ================== 목록 ================== */
  function log(nick, text, emoji, mine) {
    const d = document.createElement('div');
    if (mine) d.className = 'mine';
    d.innerHTML = '<b></b><span></span>';
    d.querySelector('b').textContent = nick;
    d.querySelector('span').textContent = emoji || text;
    logEl.append(d);
    while (logEl.children.length > LOG_LINES) logEl.firstChild.remove();
    /* 위로 갈수록 흐려집니다. 다섯 줄이 같은 진하기면 어느 게 방금 온
       말인지 눈으로 못 고릅니다. */
    [...logEl.children].forEach((c, i, a) => c.classList.toggle('fade', i < a.length - 2));
  }

  /** 사람이 한 말이 아닌 줄. 막힌 이유가 여기 남습니다. */
  function sys(text, calm) {
    const d = document.createElement('div');
    d.className = 'sys' + (calm ? ' calm' : '');
    d.innerHTML = '<span></span>';
    d.querySelector('span').textContent = text;
    logEl.append(d);
    while (logEl.children.length > LOG_LINES) logEl.firstChild.remove();
    return d;
  }

  MP.on('chat', (m) => {
    const text = CHAT.filter(m.text);
    if (!text && !m.emoji) return;
    bubble(m.id, text, m.emoji, m.mine);
    log(m.nick, text, m.emoji, m.mine);
  });

  /* ================== 보내기 ================== */
  function send() {
    const raw = inputEl.value.trim().slice(0, MAX_LEN);
    if (!raw) { inputEl.value = ''; close(); return; }
    const v = CHAT.check(raw);
    /* 막히면 친 글을 **그대로 둡니다.** 지우면 잘못 걸렸을 때 다시 쳐야
       하고, 그게 필터가 주는 가장 큰 손해입니다. */
    if (!v.ok) { if (v.msg) sys(v.msg, false); inputEl.focus(); return; }
    inputEl.value = '';
    MP.say(raw, '');
    close();
  }
  function open() { inputEl.focus(); barEl.classList.add('hot'); }
  function close() { inputEl.blur(); barEl.classList.remove('hot'); }

  /* 입력줄에 들어가 있는 동안만 목록을 엽니다(숨기기를 켠 경우). */
  const peek = (on) => document.body.classList.toggle('chat-peek', on);
  inputEl.addEventListener('focus', () => { barEl.classList.add('hot'); peek(true); });
  inputEl.addEventListener('blur', () => { barEl.classList.remove('hot'); peek(false); });
  box.querySelector('#chat-send').addEventListener('click', send);

  /* 캡처 단계입니다.

     index.html 은 window 에 keydown 을 걸어 두고 스페이스를 상호작용으로
     씁니다. 채팅을 치는 동안 그게 살아 있으면 띄어쓰기마다 말을 걸고
     WASD 마다 캐릭터가 걷습니다. 캡처로 먼저 받아 stopPropagation 하면
     index.html 을 한 줄도 안 고치고 막힙니다. */
  window.addEventListener('keydown', (e) => {
    const typing = document.activeElement === inputEl;

    if (typing) {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); send(); }
      else if (e.key === 'Escape') { e.preventDefault(); inputEl.value = ''; close(); }
      return;
    }

    /* 마이페이지가 떠 있거나 다른 입력칸을 쓰는 중이면 비켜 줍니다.
       panelOpen 은 index.html 의 전역 let 입니다 — window 에는 안 붙지만
       뒤에 오는 스크립트에서 이름으로 그냥 읽힙니다. */
    const ae = document.activeElement;
    if (panelOpen) return;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
    /* 가구 서랍에서 Enter 는 '집어 들기' 입니다. 여기서 채팅이 먼저
       가져가 버리면 자판만 쓰는 사람은 가구를 영영 못 놓습니다.
       panelOpen 과 같은 방식으로 index.html 의 전역을 이름으로 읽습니다. */
    if (typeof DECOR !== 'undefined'
        && (DECOR.it || (ae && ae.closest && ae.closest('#furn')))) return;

    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); open(); }
  }, true);
})();

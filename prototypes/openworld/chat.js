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
    b.addEventListener('click', () => { MP.say('', e); inputEl.focus(); });
    emojiEl.append(b);
  });

  /* ================== 필터 ==================
     비속어 필터는 다른 세션이 만들고 있습니다. 자리만 잡아 둡니다.
     들어오는 말과 나가는 말 **둘 다** 여기를 지나갑니다 — 내 말도
     서버 에코로 돌아오므로 실제로는 받는 쪽 한 번이면 되지만, 보내기
     전에 한 번 더 거르면 서버까지 안 갑니다. */
  const CHAT = {
    /** @param {string} text @returns {string} 걸러진 문장 */
    filter(text) { return text; },
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

  MP.on('chat', (m) => {
    const text = CHAT.filter(m.text);
    if (!text && !m.emoji) return;
    bubble(m.id, text, m.emoji, m.mine);
    log(m.nick, text, m.emoji, m.mine);
  });

  /* ================== 보내기 ================== */
  function send() {
    const raw = inputEl.value.trim().slice(0, MAX_LEN);
    inputEl.value = '';
    if (!raw) { close(); return; }
    MP.say(CHAT.filter(raw), '');
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

    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); open(); }
  }, true);
})();

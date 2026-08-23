/* variant.js — 시안 다섯 장이 함께 쓰는 동작.
   ==================================================================
   시안끼리 다른 것은 **재질과 배치**뿐이고, 동작은 같아야 합니다.
   같아야 비교가 재질 비교가 됩니다 — 한쪽만 뒤로가기가 되면 그게
   디자인 평가에 섞입니다.

   여기 있는 것: 화면 전환(주소 자국 포함) · 고르기 · 문 앞 확인.
   여기 없는 것: 실제 기준 맞추기와 학교 인증. 그 둘은 본판
   (prototypes/lobby/index.html)에서 shared/calibrate.js 와
   shared/school-auth.js 로 이미 돕니다. 시안은 **그 판이 어떻게
   생겼는지**만 보면 되므로 문구만 띄웁니다.
   ================================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var lobby  = $('v-lobby');
  var choose = $('v-choose');
  var gate   = $('gate');
  if (!lobby || !choose) return;

  var kind = 'open';        /* 'open' | 'invite' */

  /* ---------------- 화면 전환 ----------------
     주소에 자국을 남깁니다. 안 남기면 브라우저 뒤로가기가 "고르는
     화면 → 로비" 가 아니라 "로비 → 이전 페이지" 가 됩니다. */
  function paint(toChoose) {
    lobby.hidden  = toChoose;
    choose.hidden = !toChoose;
    lobby.classList.toggle('on', !toChoose);
    choose.classList.toggle('on', toChoose);
    document.body.classList.toggle('picking', toChoose);
    var focusOn = toChoose ? $('p-open') : $('start');
    if (focusOn) focusOn.focus({ preventScroll: true });
  }

  function toChoose() {
    if (location.hash !== '#choose') history.pushState({ v: 1 }, '', '#choose');
    paint(true);
  }
  function toLobby(fromPop) {
    if (fromPop) paint(false);
    else history.back();
  }

  $('start').addEventListener('click', function () { toChoose(); });
  $('back').addEventListener('click', function () { toLobby(false); });

  addEventListener('popstate', function () {
    if (gate && !gate.hidden) { closeGate(); return; }
    paint(location.hash === '#choose');
  });

  /* 새로고침·직접 접속에서도 주소가 화면을 정합니다. */
  if (location.hash === '#choose') paint(true);

  /* ---------------- 고르기 ---------------- */
  function pick(which) {
    kind = which;
    var open = which === 'open';
    $('p-open').setAttribute('aria-pressed', String(open));
    $('p-invite').setAttribute('aria-pressed', String(!open));
    $('p-open').classList.toggle('sel', open);
    $('p-invite').classList.toggle('sel', !open);
    var go = $('go');
    if (go) go.textContent = open ? '캠퍼스로 들어가기' : '방 만들기';
  }
  $('p-open').addEventListener('click', function () { pick('open'); });
  $('p-invite').addEventListener('click', function () { pick('invite'); });
  pick('open');

  /* ---------------- 문 앞 확인 ----------------
     초대는 막지 않습니다. 기준도 학교 인증도 안 봅니다 — 친구가 부른
     자리에 들어가는 데 관문을 세우면 초대가 초대가 아니게 됩니다. */
  var GATES = {
    cal: {
      ico: '◎',
      h: '앉은 자세를 10초만 볼게요',
      p: '지금 앉은 모습이 기준이 돼요. 이 값은 기기 밖으로 나가지 않아요.',
      act: '기준 맞추기'
    },
    verify: {
      ico: '✉',
      h: '학교 이메일을 확인할게요',
      p: '같은 학교끼리 겨루는 자리라, 소속만 한 번 확인해요.',
      act: '학교 인증하기'
    }
  };

  function needs() {
    if (kind === 'invite') return null;
    try {
      if (!localStorage.getItem('girin.baseline')) return 'cal';
      if (!localStorage.getItem('girin.school'))   return 'verify';
    } catch (e) { return 'cal'; }
    return null;
  }

  function openGate(which) {
    var g = GATES[which];
    $('gate-ico').textContent = g.ico;
    $('gate-h').textContent   = g.h;
    $('gate-p').textContent   = g.p;
    $('gate-go').textContent  = g.act;
    gate.hidden = false;
    requestAnimationFrame(function () { gate.classList.add('on'); });
    $('gate-go').focus({ preventScroll: true });
  }
  function closeGate() {
    gate.classList.remove('on');
    gate.hidden = true;
    var go = $('go');
    if (go) go.focus({ preventScroll: true });
  }

  $('go').addEventListener('click', function () {
    var n = needs();
    if (n) { openGate(n); return; }
    location.href = kind === 'open' ? '../openworld/index.html' : '../room/index.html';
  });

  if (gate) {
    $('gate-x').addEventListener('click', closeGate);
    /* 시안에서는 관문을 통과한 척합니다 — 재질만 보면 되므로. */
    $('gate-go').addEventListener('click', function (e) {
      e.preventDefault();
      try {
        localStorage.setItem('girin.baseline', '{"demo":true}');
        if ($('gate-h').textContent.indexOf('학교') >= 0) localStorage.setItem('girin.school', '데모대학교');
      } catch (err) { /* 저장을 막아 둔 브라우저 — 그냥 닫습니다 */ }
      closeGate();
    });
  }

  addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (gate && !gate.hidden) { closeGate(); return; }
    if (!choose.hidden) toLobby(false);
  });

  /* ---------------- 시안 이름표 ----------------
     다섯 장을 오가며 보게 되므로, 지금 보는 것이 무엇인지 항상
     화면에 있어야 합니다. */
  var tag = document.querySelector('meta[name="variant"]');
  if (tag) {
    var bar = document.createElement('nav');
    bar.className = 'vbar';
    bar.setAttribute('aria-label', '시안 넘기기');
    var names = [
      ['v1-ladder.html',  '1 정론'],
      ['v2-tile.html',    '2 타일'],
      ['v3-sticker.html', '3 스티커'],
      ['v4-quiet.html',   '4 절제'],
      ['v5-world.html',   '5 월드']
    ];
    var here = location.pathname.split('/').pop();
    var html = '<a href="index.html">모아 보기</a><span class="vbar-sep"></span>';
    for (var i = 0; i < names.length; i++) {
      html += '<a href="' + names[i][0] + '"' +
              (names[i][0] === here ? ' aria-current="page"' : '') + '>' +
              names[i][1] + '</a>';
    }
    bar.innerHTML = html;
    document.body.appendChild(bar);
  }
})();

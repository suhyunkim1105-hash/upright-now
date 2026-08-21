/* corner-nav.js — 화면 오른쪽에 세로로 서는 내비게이션 레일.
 *
 *   <script src="../shared/corner-nav.js" data-page="lobby"></script>
 *
 * 상단 가로줄(홈 / 랭킹전 / 마이페이지)을 뗐습니다. 대신 알약 하나에
 * 갈 곳 둘만 담습니다.
 *
 *   로비 — 세션 시작 버튼 **아래** 에 가로로 앉습니다. 페이지가 자리를
 *          내주므로(#cnav-slot) 화면에 떠 있지 않고 글자 덩어리의
 *          일부가 됩니다.
 *   창  — 마이페이지·랭킹전은 창이라 내줄 자리가 없습니다. 오른쪽
 *          가운데에 세로로 고정합니다.
 *
 *   마이페이지 (학생증)
 *   랭킹전   (트로피)
 *
 * 지금 보고 있는 화면의 칸은 **떠오릅니다** — 파인 홈 안에서 그 칸만
 * 흰 판이 되어 솟고 이름이 항상 붙어 있습니다. 색으로만 말하지 않으므로
 * 색을 못 보는 사람도 어느 칸에 있는지 압니다.
 *
 * 로비로 돌아가는 길은 레일에 없습니다. 마이페이지와 랭킹전은 로비 위에
 * 뜬 **창** 이라 제목줄 오른쪽 × 가 이미 그 일을 합니다. 같은 곳으로
 * 가는 길이 한 화면에 둘이면 어느 쪽이 맞는지 매번 고르게 됩니다.
 *
 * 이름표는 **왼쪽** 으로 펼칩니다. 버튼이 이미 화면 오른쪽 끝에 붙어
 * 있어서 오른쪽으로 펼치면 화면 밖으로 나갑니다.
 *
 * 레일 자체는 pointer-events 를 끕니다 — 오른쪽 세로줄을 통째로 덮으면
 * 그 아래 내용이 안 눌립니다.
 */
(function (global) {
  'use strict';

  const doc = global.document;
  const here = (doc.currentScript && doc.currentScript.dataset.page)
    || (global.location.pathname.match(/\/(lobby|league|mypage)\//) || [])[1]
    || 'lobby';

  /* 24 격자, 굵기 2. 옆에 오는 글자가 700 이라 실선도 그 무게에
     맞춥니다 — 1.5 는 굵은 글자 옆에서 실낱처럼 보입니다. */
  const ICON = {
    card:
      '<rect x="2.5" y="4.5" width="19" height="15" rx="3"/>' +
      '<circle cx="8.5" cy="10.5" r="2.1"/>' +
      '<path d="M5.2 15.8c.5-1.6 1.8-2.4 3.3-2.4s2.8.8 3.3 2.4"/>' +
      '<path d="M15 9.6h4M15 13h3"/>',
    trophy:
      '<path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/>' +
      '<path d="M7 5.6H4.6a2.4 2.4 0 0 0 2.4 3.6"/>' +
      '<path d="M17 5.6h2.4a2.4 2.4 0 0 1-2.4 3.6"/>' +
      '<path d="M12 14v3.4M8.6 20.4h6.8M9.6 20.4c0-1.7 1-3 2.4-3s2.4 1.3 2.4 3"/>',
  };

  /* 두 칸뿐입니다. 로비는 창의 × 가 맡습니다. */
  const ITEMS = [
    { key: 'mypage', icon: 'card',   href: '../mypage/index.html', label: '마이페이지' },
    { key: 'league', icon: 'trophy', href: '../league/index.html', label: '랭킹전' },
  ];

  const CSS = `
/* 레일은 자리만 잡고 클릭을 안 받습니다. */
.cnav-rail {
  position: fixed; top: 50%; right: 22px; z-index: 40;
  transform: translateY(-50%);
  pointer-events: none;
}
/* 두 칸이 앉는 홈. 안으로만 파여 있어서 그 위에 솟은 칸이 도드라집니다. */
.cnav-track {
  pointer-events: auto;
  display: flex; flex-direction: column; gap: 4px;
  padding: 6px; border-radius: 999px;
  background: rgba(255,255,255,.82);
  -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
  box-shadow:
    inset 0 3px 7px rgba(13,60,52,.11),
    inset 0 -2px 4px rgba(255,255,255,.9),
    0 8px 22px rgba(23,32,30,.14),
    0 2px 6px rgba(23,32,30,.07);
}

.cnav {
  position: relative;
  width: 54px; height: 54px;
  display: grid; place-items: center;
  border-radius: 50%;
  text-decoration: none; color: var(--ink-2, #55605D);
  transition: transform .2s var(--ease, cubic-bezier(.16,1,.3,1)),
              box-shadow .2s var(--ease, cubic-bezier(.16,1,.3,1)),
              background .2s var(--ease, cubic-bezier(.16,1,.3,1)),
              color .2s var(--ease, cubic-bezier(.16,1,.3,1));
}
.cnav svg { display: block; }

/* 이름표 — 왼쪽으로 펼쳐집니다. 평소에는 폭이 0 이라 자리를 안 먹습니다. */
.cnav-label {
  position: absolute; right: calc(100% + 8px); top: 50%;
  transform: translateY(-50%) translateX(6px);
  white-space: nowrap; opacity: 0; pointer-events: none;
  padding: 0 15px; line-height: 36px; border-radius: 999px;
  background: #fff; color: var(--ink, #17201E);
  font-size: 13.5px; font-weight: 700; letter-spacing: -0.01em;
  box-shadow: 0 6px 18px rgba(23,32,30,.16), 0 1px 3px rgba(23,32,30,.10);
  transition: opacity .18s var(--ease, cubic-bezier(.16,1,.3,1)),
              transform .18s var(--ease, cubic-bezier(.16,1,.3,1));
}

/* 지금 있는 칸 — 파인 홈에서 흰 판이 솟고 이름이 계속 붙어 있습니다.
   색만으로 말하지 않는 이유입니다. */
.cnav[aria-current] {
  background: #fff; color: var(--teal-700, #0D7769);
  box-shadow:
    inset 0 2px 4px rgba(255,255,255,.9),
    inset 0 -3px 6px rgba(13,60,52,.10),
    0 6px 14px rgba(23,32,30,.15),
    0 1px 3px rgba(23,32,30,.08);
}
.cnav[aria-current] .cnav-label { opacity: 1; transform: translateY(-50%) translateX(0); }

/* 터치에서는 :hover 가 탭 뒤에 눌어붙습니다. */
@media (hover: hover) and (pointer: fine) {
  .cnav:hover {
    background: #fff; color: var(--teal-700, #0D7769);
    transform: translateX(-2px);
    box-shadow:
      inset 0 2px 4px rgba(255,255,255,.92),
      inset 0 -3px 6px rgba(13,60,52,.10),
      0 10px 22px rgba(23,32,30,.18),
      0 2px 5px rgba(23,32,30,.09);
  }
  .cnav:hover .cnav-label { opacity: 1; transform: translateY(-50%) translateX(0); }
}
/* 키보드로 왔을 때도 이름이 보여야 합니다 — 초점만 가고 이름이 안 뜨면
   무엇을 누르는지 모릅니다. */
.cnav:focus-visible { outline: 3px solid var(--teal-700, #0D7769); outline-offset: 3px; }
.cnav:focus-visible .cnav-label { opacity: 1; transform: translateY(-50%) translateX(0); }

/* 점토는 밀리는 게 아니라 눌려 들어갑니다. */
.cnav:active {
  transform: translateX(0) translateY(1px);
  box-shadow:
    inset 0 4px 9px rgba(13,60,52,.17),
    inset 0 -2px 5px rgba(255,255,255,.5);
}

/* 데스크톱 전용 제품이라 1280 을 아래 기준으로 잡습니다. */
/* ---- 슬롯 안(로비) ----
   레퍼런스처럼 아이콘과 이름이 나란히 늘 보입니다. 아이콘만 두고
   가리켰을 때만 이름을 띄우면, 처음 본 사람은 무엇인지 모른 채
   두 개 중 하나를 찍어야 합니다.

   트랙은 크림에 주색을 아주 옅게 섞습니다 — 청록으로 채우면 세션 시작
   버튼과 무게가 같아지고, 순백이면 배경에서 뜹니다. */
#cnav-slot .cnav-track {
  flex-direction: row; gap: 6px; padding: 7px;
  background: linear-gradient(180deg, rgba(255,255,255,.94) 0%, rgba(239,251,249,.90) 100%);
  box-shadow:
    inset 0 4px 8px rgba(13,60,52,.10),
    inset 0 -2px 4px rgba(255,255,255,.95),
    0 12px 28px rgba(23,32,30,.14),
    0 3px 8px rgba(23,32,30,.07);
}
#cnav-slot .cnav {
  width: auto; height: 52px; padding: 0 22px;
  display: inline-flex; align-items: center; gap: 9px;
  border-radius: 999px;
  font-size: 14.5px; font-weight: 700; letter-spacing: -0.012em;
}
/* 이름이 늘 보이므로 떠 있는 이름표는 안 씁니다. */
#cnav-slot .cnav-label {
  position: static; opacity: 1; transform: none;
  padding: 0; line-height: 1; background: none; box-shadow: none;
  color: inherit; font: inherit;
}
/* 아이콘에 주색을 답니다. 글자는 먹이라 아이콘만 색을 가지면 두 칸이
   바 안에서 살아 있으면서도 세션 시작 버튼을 안 이깁니다. */
#cnav-slot .cnav svg { color: var(--teal-700, #0D7769); }
#cnav-slot .cnav { color: var(--ink-2, #55605D); }
@media (hover: hover) and (pointer: fine) {
  #cnav-slot .cnav:hover {
    color: var(--ink, #17201E); transform: translateY(-2px);
    background: #fff;
    box-shadow:
      inset 0 2px 4px rgba(255,255,255,.95),
      inset 0 -3px 6px rgba(13,60,52,.10),
      0 10px 22px rgba(23,32,30,.18),
      0 2px 5px rgba(23,32,30,.09);
  }
}
#cnav-slot .cnav:active { transform: translateY(1px); }

@media (max-width: 1180px) {
  .cnav-rail { right: 14px; }
  .cnav { width: 46px; height: 46px; }
}

@media (prefers-reduced-motion: reduce) {
  .cnav, .cnav-label { transition: none; }
  .cnav:hover, .cnav:active { transform: none; }
}
`;

  function build() {
    if (doc.querySelector('.cnav-track')) return;

    const style = doc.createElement('style');
    style.textContent = CSS;
    doc.head.append(style);

    /* 페이지가 자리를 내줬으면 거기 앉습니다. 아니면 오른쪽에 고정합니다. */
    const slot = doc.getElementById('cnav-slot');
    const rail = doc.createElement('nav');
    rail.className = slot ? '' : 'cnav-rail';
    rail.setAttribute('aria-label', '화면 이동');

    const track = doc.createElement('div');
    track.className = 'cnav-track';
    rail.append(track);

    ITEMS.forEach((it) => {
      const a = doc.createElement('a');
      a.className = 'cnav';
      a.href = it.href;
      a.setAttribute('aria-label', it.label);
      if (it.key === here) a.setAttribute('aria-current', 'page');
      a.innerHTML =
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" ' +
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        ICON[it.icon] +
        '</svg>' +
        '<span class="cnav-label" aria-hidden="true">' + it.label + '</span>';
      track.append(a);
    });

    if (slot) slot.append(rail);
    else doc.body.prepend(rail);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', build);
  else build();
})(window);

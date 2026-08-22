/* ══════════════════════════════════════════════════════════
   창(panel) 들.
   "말 걸면 문구만 뜬다" 는 껍데기입니다. 여기서는 **실제로 도는 것**만
   담습니다 — 시간표는 고쳐지고, 기록은 쌓이고, 옷은 갈아입힙니다.
   미니게임처럼 2D 월드에 이미 있는 것은 여기서 부르지 않고 자리만
   남겨 둡니다(가짜로 흉내 내면 시연에서 반드시 들킵니다).
   ══════════════════════════════════════════════════════════ */

import { FURN_MORE } from './room.js';

const KEY = 'girin3d.save';
const DEF = {
  nick: '', school: '', species: '거북이', fit: 0,
  look: null,                 // { topId, top, bottomId, bottom, ... } — 없으면 기본 차림
  owned2: [],                 // 산 옷 id
  ownedSp: [],                // 깨어난 종 (기본 셋은 코드가 채웁니다)
  furn: {},                   // 가구 id → 개수
  decor: [],                  // 방에 놓인 가구 [{id,x,z,ry}]
  egg: null,                  // 품는 알 { hatchAt }
  gameDay: null,              // { date, played:{게임:1} } — 하루 한 번 지급
  timetable: {},              // "월-3" → { name, room, color }
  sessions: [],               // { t, sec, bad, zone }
  coins: 120,
  owned: [0],                 // 가진 옷 번호
  seenTutorial: false,
};
export const SAVE = load();
function load() {
  try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch { return Object.assign({}, DEF); }
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(SAVE)); } catch {}
}

const DAYS = ['월', '화', '수', '목', '금'];
const PERIODS = [
  ['1교시', '09:00'], ['2교시', '10:30'], ['3교시', '12:00'],
  ['4교시', '13:30'], ['5교시', '15:00'], ['6교시', '16:30'],
];
const COLORS = ['#2DD4BF', '#E8695A', '#F2C14E', '#5B84C4', '#9B7BD4', '#63C47C', '#E8935A'];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- 시간표 — 칸을 눌러 직접 채웁니다 ---------- */
export function timetable() {
  const cell = (d, p) => SAVE.timetable[`${d}-${p}`];
  const rows = PERIODS.map(([nm, tm], p) => `
    <tr><th><b>${nm}</b><i>${tm}</i></th>${DAYS.map((d) => {
      const c = cell(d, p);
      return `<td><button class="tt${c ? ' on' : ''}" data-d="${d}" data-p="${p}"
        style="${c ? `background:${c.color};color:#1B2430` : ''}">${c ? esc(c.name) : '+'}</button></td>`;
    }).join('')}</tr>`).join('');
  return {
    tag: '시간표', title: '내 시간표',
    html: `<table class="tt"><thead><tr><th></th>${DAYS.map((d) => `<th>${d}</th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody></table>
      <p class="note">칸을 눌러 강의를 넣고, 한 번 더 누르면 지웁니다. 이 기기에 저장됩니다.</p>`,
    on(root, redraw) {
      root.querySelectorAll('button.tt').forEach((b) => b.addEventListener('click', () => {
        const k = `${b.dataset.d}-${b.dataset.p}`;
        if (SAVE.timetable[k]) { delete SAVE.timetable[k]; save(); redraw(); return; }
        const name = prompt('강의 이름', '');
        if (!name) return;
        SAVE.timetable[k] = { name: name.slice(0, 10), color: COLORS[Object.keys(SAVE.timetable).length % COLORS.length] };
        save(); redraw();
      }));
    },
  };
}

/* ---------- 오늘의 기록 — 앉은 세션이 실제로 쌓입니다 ---------- */
export function records() {
  const S = SAVE.sessions.slice(-14).reverse();
  const total = SAVE.sessions.reduce((a, s) => a + s.sec, 0);
  const bad = SAVE.sessions.reduce((a, s) => a + s.bad, 0);
  const mm = (s) => `${Math.floor(s / 60)}분 ${Math.round(s % 60)}초`;
  const bars = S.length ? S.map((s) => {
    const h = Math.max(4, Math.min(56, s.sec / 3));
    const c = s.bad > 4 ? '#E8695A' : s.bad > 1 ? '#F2C14E' : '#63C47C';
    return `<div class="bar" title="${mm(s.sec)} · 무너짐 ${s.bad}번">
      <i style="height:${h}px;background:${c}"></i></div>`;
  }).join('') : '<p class="note">아직 앉은 기록이 없습니다. 도서관이나 본관에서 앉아 보세요.</p>';
  return {
    tag: '기록', title: '오늘의 기록',
    html: `<div class="kv"><span>앉은 시간</span><b>${mm(total)}</b></div>
      <div class="kv"><span>무너진 횟수</span><b>${bad}번</b></div>
      <div class="kv"><span>세션</span><b>${SAVE.sessions.length}번</b></div>
      <div class="bars">${bars}</div>
      <p class="note">막대 하나가 세션 하나입니다. 색이 붉을수록 오래 굽어 있었습니다.</p>`,
  };
}

/* ---------- 학생증 ---------- */
export function studentCard() {
  const total = SAVE.sessions.reduce((a, s) => a + s.sec, 0);
  return {
    tag: '학생증', title: '기린캠퍼스 학생증',
    html: `<div class="card-id">
        <div class="ph" id="idph"></div>
        <div class="info">
          <b>${esc(SAVE.species)}</b>
          <span>기린캠퍼스 · 26학번</span>
          <span>누적 ${Math.floor(total / 60)}분 · 코인 ${SAVE.coins}</span>
        </div>
      </div>
      <p class="note">얼굴 창에 뜨는 그 캐릭터입니다. 종과 옷은 아래 줄에서 바꿉니다.</p>`,
  };
}

/* ---------- 상점 — 실제로 사고 갈아입습니다 ---------- */
export function shop(outfits, cur, onWear) {
  const PRICE = [0, 40, 40, 60, 60, 80];
  const items = outfits.map((o, i) => {
    const own = SAVE.owned.includes(i);
    const on = i === cur;
    return `<button class="buy${on ? ' on' : ''}" data-i="${i}">
      <span class="sw" style="background:#${o.top.toString(16).padStart(6, '0')}"></span>
      <em>${own ? (on ? '입는 중' : '가진 옷') : PRICE[i] + '코인'}</em></button>`;
  }).join('');
  return {
    tag: '옷 가게', title: '오늘의 옷',
    html: `<div class="buys">${items}</div>
      <div class="kv"><span>내 코인</span><b>${SAVE.coins}</b></div>
      <p class="note">몸이 여덟 종 다 같아서 옷 하나면 전부 입습니다. 2D 때는 종마다 따로 잘라야 했습니다.</p>`,
    on(root, redraw) {
      root.querySelectorAll('button.buy').forEach((b) => b.addEventListener('click', () => {
        const i = +b.dataset.i;
        if (!SAVE.owned.includes(i)) {
          if (SAVE.coins < PRICE[i]) { flash(root, '코인이 모자랍니다'); return; }
          SAVE.coins -= PRICE[i]; SAVE.owned.push(i);
        }
        save(); onWear(i); redraw();
      }));
    },
  };
}
function flash(root, msg) {
  const n = document.createElement('div');
  n.className = 'flash'; n.textContent = msg; root.appendChild(n);
  setTimeout(() => n.remove(), 1400);
}

/* ---------- 공지 · 공고 ----------
   실제 연동은 api/notice.ts 가 합니다(명지대 RSS 확인 완료).
   여기서는 그 자리와 **크롤링하면 안 되는 이유**를 같이 남깁니다. */
export const BOARD_LINKS = [
  ['링커리어', 'https://linkareer.com/list/contest'],
  ['올콘', 'https://www.all-con.co.kr/'],
  ['위비티', 'https://www.wevity.com/'],
  ['캠퍼스픽', 'https://www.campuspick.com/contest'],
];
/**
 * 학교 공지 — `/api/notice` 가 학교 RSS 를 받아 옵니다(2D 판과 같은 함수).
 * rows 가 undefined 면 "받는 중", null 이면 "못 받았음" 입니다.
 */
export function notices(kind, rows) {
  if (kind !== 'school') {
    return {
      tag: '공고', title: '대외활동 · 공모전',
      html: `<p>마감이 가까운 순서로 보려면 아래 사이트에서 직접 보세요.</p>
        <div class="wr">${BOARD_LINKS.map(([n, u]) =>
          `<button data-open="${u}">${n} ↗</button>`).join('')}</div>
        <div class="note"><b>왜 목록을 안 가져오나</b><br>
        링커리어 이용약관 제20조 4항이 크롤링·스크래핑을 금지합니다.
        에브리타임은 2022년에 크롤링으로 유죄 판결이 났습니다.
        그래서 저희는 목록 대신 <b>공식 링크만</b> 겁니다 — 누르면 그쪽에서 직접 보시게 됩니다.</div>`,
      on(root) {
        root.querySelector('.bd').onclick = (e) => {
          const b = e.target.closest('button[data-open]'); if (!b) return;
          window.open(b.dataset.open, '_blank', 'noopener');
        };
      },
    };
  }
  let body;
  if (rows === undefined) body = '<p class="note">학교 공지를 받아 오는 중입니다…</p>';
  else if (!rows || !rows.length) {
    body = `<p>지금은 공지를 못 받아왔습니다.</p>
      <p class="note">배포본에서는 <code>/api/notice</code> 가 학교 RSS 를 받아 옵니다.
      명지대는 연결을 확인했고, 나머지 아홉 곳은 게시판 id 를 확인 중입니다.</p>`;
  } else {
    body = `<ul class="feed">${rows.slice(0, 12).map((r) =>
      `<li><b>${esc(r.date || '')}</b><span>${r.link
        ? `<a href="${esc(r.link)}" target="_blank" rel="noopener">${esc(r.title)}</a>`
        : esc(r.title)}</span></li>`).join('')}</ul>
      <p class="note">학교가 공식으로 여는 RSS 를 그대로 받아 옵니다. 누르면 원문으로 갑니다.</p>`;
  }
  return { tag: '공지', title: '학교 공지사항', html: body };
}

/* ---------- 아직 2D 월드에 있는 것 ---------- */
export function stub(tag, title, body) {
  return { tag, title, html: (body || []).map((t) => `<p>${esc(t)}</p>`).join('') };
}

/* ══════════════════════════════════════════════════════════
   상점 · 식당 · 자판기 · 인형뽑기 · 명예의 전당 · 방 꾸미기
   전부 **실제로 도는** 창입니다 — 코인이 줄고, 산 것이 남고,
   서버(world_buy_item)가 붙어 있으면 서버 잔액이 정답입니다.
   ══════════════════════════════════════════════════════════ */
const won = (n) => (n === 0 ? '무료' : n + '코인');
const coinbar = (coins, extra) =>
  `<div class="kv"><span>내 코인${extra || ''}</span><b>🪙 ${coins}</b></div>`;

/** 옷 가게 — 사는 곳. 입는 것은 옷장(C)에서 합니다 */
export function wearShop(ctx) {
  const SLOT = [['top', '상의'], ['bottom', '하의'], ['shoes', '신발'],
    ['hat', '모자'], ['glasses', '안경'], ['bag', '가방']];
  const html = coinbar(ctx.coins, ctx.server ? ' <i style="font-style:normal;color:#8B94A1">· 서버 잔액</i>' : '')
    + SLOT.map(([slot, nm]) => {
      const items = ctx.wear[slot].filter(([id]) => id !== 'none');
      return `<div class="lbl">${nm}</div><div class="wr">`
        + items.map(([id, label, price]) => {
          const own = ctx.owned.includes(id) || price === 0;
          return `<button data-buy="${id}" data-slot="${slot}" ${own ? 'disabled' : ''}
            class="${own ? 'own' : ''}">${label}${own ? ' ✓' : ' · ' + won(price)}</button>`;
        }).join('') + '</div>';
    }).join('')
    + (ctx.rides ? '<div class="lbl">탈것</div><div class="wr">'
      + ctx.rides.map(([id, nm, price, mult]) => {
        const own = (ctx.ownedRide || []).includes(id);
        return `<button data-rbuy="${id}" ${own ? 'disabled' : ''} class="${own ? 'own' : ''}"
          title="걷는 속도 ×${mult.toFixed(2)}">${nm} ×${mult.toFixed(2)}${own ? ' ✓' : ' · ' + won(price)}</button>`;
      }).join('') + '</div>' : '')
    + '<p class="note">산 옷은 <b>옷장(C)</b> 어디서든 갈아입습니다. 탈것도 옷장에서 타고 내립니다 — 실내에 들어가면 저절로 내려요. 값은 서버 값표가 정합니다 — 이 화면은 보여 줄 뿐입니다.</p>';
  return {
    tag: '옷 가게', title: '동아리 옷 상점', html,
    on(root, again) {
      root.querySelector('.bd').onclick = (e) => {
        const r = e.target.closest('button[data-rbuy]');
        if (r && !r.disabled) { ctx.onBuyRide?.(r.dataset.rbuy, again); return; }
        const b = e.target.closest('button[data-buy]'); if (!b || b.disabled) return;
        ctx.onBuy(b.dataset.buy, b.dataset.slot, again);
      };
    },
  };
}

/** 가구 목록 — 기숙사에 놓는 것들 */
/* 여섯은 처음부터 있던 것이고, 뒤엣것은 room.js 가 짓습니다.
   id 는 2D 판 아이템 표와 같은 것을 씁니다 — 서버 구매(world_buy_item)가
   두 판에서 하나로 이어져야 하므로 여기서 새 이름을 지으면 안 됩니다.
   네 번째 칸은 상점에 보여 줄 글자입니다. */
export const FURN = [
  ['plant', '화분', 30, '🪴'], ['lamp2', '스탠드', 40, '💡'], ['rug2', '깔개', 40, '🟫'],
  ['books2', '책 더미', 20, '📚'], ['guitar2', '기타', 80, '🎸'], ['bear', '곰인형', 60, '🧸'],
  ...FURN_MORE,
];
export function furnShop(ctx) {
  const html = coinbar(ctx.coins)
    + '<div class="lbl">가구</div><div class="buys">'
    + FURN.map(([id, nm, price, icon]) => {
      const n = ctx.furn[id] || 0;
      return `<button class="buy" data-fbuy="${id}">
        <span class="sw" style="background:#EFE4D0;display:grid;place-items:center;font-size:17px">${icon || '▫'}</span>
        ${nm}<br>${won(price)}${n ? ` · ${n}개` : ''}</button>`;
    }).join('') + '</div>'
    + '<p class="note">산 가구는 기숙사 <b>방 꾸미기</b> 게시판에서 놓습니다.</p>';
  return {
    tag: '가구 가게', title: '동아리 가구 상점', html,
    on(root, again) {
      root.querySelector('.bd').onclick = (e) => {
        const b = e.target.closest('button[data-fbuy]'); if (!b) return;
        ctx.onBuy(b.dataset.fbuy, again);
      };
    },
  };
}

/** 알 가게 — 알을 품으면 새 종이 깨어납니다 */
export function eggShop(ctx) {
  const left = ctx.egg ? Math.max(0, Math.ceil((ctx.egg.hatchAt - Date.now()) / 1000)) : 0;
  const locked = ctx.allSp.filter((n) => !ctx.ownedSp.includes(n));
  const html = coinbar(ctx.coins)
    + `<div class="card-id"><div class="ph" style="display:grid;place-items:center;font-size:34px">🥚</div>
      <div class="info"><b>비밀 알 — 40코인</b>
      <span>품고 3분이 지나면 아직 없는 종이 깨어납니다.</span>
      <span>남은 종 ${locked.length} : ${locked.join(' · ') || '없음'}</span></div></div>`
    + (ctx.egg
      ? `<p class="note">지금 품는 알 — <b>${left}초</b> 뒤에 깨어납니다. 월드를 돌아다녀도 됩니다.</p>`
      : `<div class="wr" style="margin-top:12px"><button data-egg="1" ${locked.length ? '' : 'disabled'}>
          ${locked.length ? '알 사기 (40코인)' : '여덟 종이 모두 있습니다'}</button></div>`)
    + '<p class="note">깨어난 종은 옷장(C)의 종 목록에서 고릅니다.</p>';
  return {
    tag: '알 가게', title: '미르의 알 가게', html,
    on(root, again) {
      root.querySelector('.bd').onclick = (e) => {
        const b = e.target.closest('button[data-egg]'); if (!b || b.disabled) return;
        ctx.onBuy(again);
      };
    },
  };
}

/** 학식 · 자판기 */
export function cafeteria(ctx) {
  const MENU = [['백반', 8, '🍚'], ['라면', 5, '🍜'], ['돈까스', 10, '🍛']];
  return {
    tag: '식당', title: '오늘의 학식', html: coinbar(ctx.coins)
      + '<div class="buys">' + MENU.map(([nm, price, e]) =>
        `<button class="buy" data-menu="${nm}" data-price="${price}">
          <span class="sw" style="background:#EFE4D0;display:grid;place-items:center;font-size:17px">${e}</span>
          ${nm}<br>${price}코인</button>`).join('') + '</div>'
      + '<p class="note">먹으면 잠깐 기운이 납니다. 자세 세션 중에는 못 먹습니다 — 앉아서 드세요.</p>',
    on(root, again) {
      root.querySelector('.bd').onclick = (e) => {
        const b = e.target.closest('button[data-menu]'); if (!b) return;
        ctx.onBuy(b.dataset.menu, +b.dataset.price, again);
      };
    },
  };
}
export function vending(ctx) {
  const DRINK = [['이온음료', 4, '🥤'], ['딸기우유', 4, '🥛'], ['커피', 5, '☕'], ['보리차', 3, '🍵']];
  return {
    tag: '자판기', title: '음료 자판기', html: coinbar(ctx.coins)
      + '<div class="buys">' + DRINK.map(([nm, price, e]) =>
        `<button class="buy" data-menu="${nm}" data-price="${price}">
          <span class="sw" style="background:#EFE4D0;display:grid;place-items:center;font-size:17px">${e}</span>
          ${nm}<br>${price}코인</button>`).join('') + '</div>',
    on(root, again) {
      root.querySelector('.bd').onclick = (e) => {
        const b = e.target.closest('button[data-menu]'); if (!b) return;
        ctx.onBuy(b.dataset.menu, +b.dataset.price, again);
      };
    },
  };
}

/** 인형뽑기 — 30코인, 반드시 하나는 나옵니다(꽝 없는 기계) */
export function claw(ctx) {
  return {
    tag: '인형뽑기', title: '인형 뽑기', html: coinbar(ctx.coins)
      + `<div class="card-id"><div class="ph" style="display:grid;place-items:center;font-size:34px">🧸</div>
        <div class="info"><b>한 판 30코인</b><span>곰인형 · 화분 · 책 더미 중 하나가 나옵니다.</span>
        <span>뽑은 것은 기숙사에 놓을 수 있습니다.</span></div></div>`
      + '<div class="wr" style="margin-top:12px"><button data-claw="1">뽑기 (30코인)</button></div>',
    on(root, again) {
      root.querySelector('.bd').onclick = (e) => {
        const b = e.target.closest('button[data-claw]'); if (!b) return;
        ctx.onPlay(again);
      };
    },
  };
}

/** 명예의 전당 — 서버 집계. 없으면 없다고 말합니다 */
export function fame(ctx) {
  let body;
  if (ctx.rows === undefined) body = '<p>순위를 불러오는 중…</p>';
  else if (ctx.rows === null)
    body = '<p class="note">이 판본에는 서버 연결이 없어 순위를 못 받아왔습니다. 배포본에서는 학교별 순위가 여기 나옵니다 — 점수는 합계가 아니라 <b>참여자 1인당</b>이고, 20명을 넘긴 학교만 오릅니다.</p>';
  else if (!ctx.rows.length) body = '<p class="note">아직 순위에 오른 학교가 없습니다. 참여자 20명을 넘긴 학교부터 오릅니다.</p>';
  else body = '<ul class="feed">' + ctx.rows.map((r, i) =>
    `<li><b>${i + 1}위</b><span>${esc(r.school || r.name || '')} — ${
      Math.round((r.score ?? r.avg ?? 0) * 10) / 10}점${r.n ? ` · ${r.n}명` : ''}</span></li>`).join('') + '</ul>';
  /* 시즌 — 90일 한 바퀴. 언제 끝나는지 안 보이면 랭킹전이 아니라 그냥 표입니다 */
  const S = season();
  const head = `<div class="kv"><span>${S.n}시즌</span><b>${S.left}일 남음</b></div>
    <div class="bars" style="height:10px;margin:6px 0 14px">
      <div class="bar" style="flex:${S.done}"><i style="width:100%;height:100%;background:#2DD4BF"></i></div>
      <div class="bar" style="flex:${100 - S.done}"><i style="width:100%;height:100%;background:rgba(34,42,51,.12)"></i></div>
    </div>`;
  return {
    tag: '명예의 전당', title: '이번 시즌 랭킹전', html: head + body
      + (ctx.myschool ? `<p class="note">내 학교 — <b>${esc(ctx.myschool)}</b>${
          ctx.verified ? ' <b>· 인증됨</b>' : ' <i style="font-style:normal;color:#8B94A1">· 아직 메일 인증 전</i>'}. 오늘 앉은 시간이 여기에 쌓입니다.</p>`
        : '<p class="note">학생회관 창구에서 학교를 인증하면 내 시간이 학교 점수로 쌓입니다.</p>')
      + `<div class="note"><b>무엇으로 순위를 매기나</b><br>
        참여 시간(그 학교 사람들이 카메라 앞에서 실제로 앉아 있던 시간의 합)과
        회복 횟수(무너졌다가 다시 돌아온 횟수의 합)입니다.
        회복을 같이 세는 이유가 있어요 — 앉은 시간만 보면 <b>오래 버틴 사람만 이깁니다.</b>
        회복은 무너졌다는 걸 전제로 하는 지표라, 고쳐 앉는 행동 자체에 값을 매깁니다.<br>
        <b>개인 순위는 만들지 않습니다.</b> 자세로 사람을 줄 세우지 않겠다는 게 이 서비스의 원칙입니다.</div>`,
  };
}

/** 창밖 날씨 — /api/weather 는 배포본에서만 돕니다 */
export function weather(ctx) {
  const W = ctx.data;
  let body;
  if (W === undefined) body = '<p>창밖을 보는 중…</p>';
  else if (W === null) body = '<p class="note">지금은 날씨를 못 받아왔습니다. 배포본에서는 기상청 값이 나옵니다.</p>';
  else body = `<div class="card-id"><div class="ph" style="display:grid;place-items:center;font-size:34px">${W.icon || '🌤'}</div>
    <div class="info"><b>${esc(W.label || '')} ${W.temp != null ? W.temp + '°' : ''}</b>
    <span>${esc(W.desc || '')}</span></div></div>`;
  return { tag: '창밖', title: '지금 바깥 날씨', html: body };
}

/** 셔틀 — 다음 차까지 남은 시간. 20분 간격 가짜 시간표지만 진짜처럼 셉니다 */
export function bus() {
  const now = new Date();
  const mm = now.getMinutes() % 20;
  const left = (20 - mm) % 20 || 20;
  return {
    tag: '정류장', title: '셔틀 정류장',
    html: `<div class="kv"><span>다음 셔틀</span><b>${left}분 뒤</b></div>
      <p class="note">기숙사 → 정문 → 본관을 돕니다. 20분 간격.</p>`,
  };
}

/** 방 꾸미기 — 가진 가구를 방에 놓습니다 */
export function decor(ctx) {
  const owned = FURN.filter(([id]) => (ctx.furn[id] || 0) > (ctx.placedCount[id] || 0));
  return {
    tag: '방 꾸미기', title: '내 방 가구 놓기',
    html: (owned.length
      ? '<div class="lbl">놓을 수 있는 것</div><div class="buys">'
        + owned.map(([id, nm]) => `<button class="buy" data-place="${id}">
            <span class="sw" style="background:#EFE4D0;display:grid;place-items:center;font-size:17px">${
              { plant: '🪴', lamp2: '💡', rug2: '🟫', books2: '📚', guitar2: '🎸', bear: '🧸' }[id]}</span>
            ${nm}</button>`).join('') + '</div>'
      : '<p class="note">놓을 가구가 없습니다. 동아리 상점의 <b>가구 가게</b>에서 사 오세요.</p>')
      + (ctx.placed.length
        ? `<p class="note">놓인 가구 ${ctx.placed.length}개 — <button class="tt on" data-clearall="1" style="width:auto;padding:4px 10px;background:#C4553F">전부 치우기</button></p>`
        : ''),
    on(root, again) {
      root.querySelector('.bd').onclick = (e) => {
        const c = e.target.closest('button[data-clearall]');
        if (c) { ctx.onClear(again); return; }
        const b = e.target.closest('button[data-place]'); if (!b) return;
        ctx.onPlace(b.dataset.place);
      };
    },
  };
}

/* ══════════════════════════════════════════════════════════
   2D 판에 있던 창들 — 회고 · 코인 · 마이페이지 · 안내 · 개인정보.
   3D 로 옮기면서 빠져 있었습니다. 숫자는 전부 실제 기록에서 나옵니다.
   ══════════════════════════════════════════════════════════ */

const mmss = (s) => `${Math.floor(s / 60)}분 ${Math.round(s % 60)}초`;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

/* 스트레칭 처방 — 어느 축이 오래 벗어났는지로 고릅니다.
   "목이 아프면 목 스트레칭" 이 아니라, **판정이 실제로 잡아낸 축**에서 옵니다. */
const STRETCH = {
  facePitchRatio: ['턱 당기기', '턱을 목 쪽으로 살짝 당기고 5초. 열 번.'],
  earEyeRatio: ['턱 당기기', '턱을 목 쪽으로 살짝 당기고 5초. 열 번.'],
  headPitchDeg: ['목 뒤 늘이기', '두 손을 뒤통수에 얹고 천천히 숙였다 펴기. 다섯 번.'],
  headHeightRatio: ['어깨 으쓱', '어깨를 귀까지 올렸다 툭 떨어뜨리기. 열 번.'],
  shoulderSpan: ['가슴 열기', '문틀에 팔을 대고 한 발 앞으로. 20초씩 양쪽.'],
  faceScaleRatio: ['모니터 밀기', '화면을 팔 길이만큼 밀고 눈높이를 화면 위쪽에 맞추기.'],
  headDistanceCm: ['모니터 밀기', '화면을 팔 길이만큼 밀고 눈높이를 화면 위쪽에 맞추기.'],
  shoulderTiltRatio: ['옆구리 늘이기', '한 팔을 머리 위로 넘겨 반대쪽으로 20초씩.'],
  lateralOffsetRatio: ['앉은 자리 고치기', '엉덩이를 등받이 끝까지 붙이고 발바닥을 바닥에.'],
  torsoLean: ['골반 세우기', '엉덩이를 등받이 끝까지 붙이고 배에 살짝 힘.'],
};
function stretchPlan(axes) {
  const list = Object.entries(axes || {}).filter(([k, v]) => STRETCH[k] && v > 20)
    .sort((a, b) => b[1] - a[1]).slice(0, 2);
  if (!list.length) return null;
  const seen = new Set();
  return list.map(([k]) => STRETCH[k]).filter((s2) => {
    if (seen.has(s2[0])) return false; seen.add(s2[0]); return true;
  });
}
/* 자세 나이 — 유지력 0.5 · 회복 0.3 · 무너진 깊이 0.2.
   점수가 아니라 **버릇을 읽는 한 줄**입니다. 의학적 판단이 아닙니다. */
function postureAge(se) {
  const t = Math.max(1, se.judged || se.sec);
  const hold = 1 - Math.min(1, (se.tBad || 0) / t / .35);
  const back = 1 - Math.min(1, (se.bad || 0) / Math.max(1, t / 300) / 3);
  const depth = 1 - Math.min(1, ((se.tBad || 0) + (se.tWarn || 0) * .4) / t / .5);
  const good = hold * .5 + back * .3 + depth * .2;
  return Math.round(65 - good * 45);
}

/** 세션 회고 — 이번 세션과 지난 세션 */
export function retro(ctx) {
  const last = ctx?.last || SAVE.sessions[SAVE.sessions.length - 1] || null;
  const past = SAVE.sessions.slice(-30).reverse();
  let now = '<p>아직 마친 세션이 없습니다. 도서관이나 본관 자리에서 앉아 보세요.</p>';
  if (last) {
    const t = Math.max(1, last.judged || last.sec);
    const g = Math.max(0, t - (last.tWarn || 0) - (last.tBad || 0));
    const plan = stretchPlan(last.axes);
    const age = postureAge(last);
    now = `<div class="kv"><span>앉은 시간</span><b>${mmss(last.sec)}</b></div>
      <div class="kv"><span>판정이 돈 시간</span><b>${mmss(last.judged || last.sec)}</b></div>
      <div class="kv"><span>회복</span><b>${last.bad || 0}번</b></div>
      <div class="lbl">이번 세션의 자세</div>
      <div class="bars" style="height:26px;align-items:stretch">
        <div class="bar" style="flex:${Math.max(1, g)}"><i style="width:100%;height:100%;background:#63C47C"></i></div>
        <div class="bar" style="flex:${Math.max(1, last.tWarn || 0)}"><i style="width:100%;height:100%;background:#F2C14E"></i></div>
        <div class="bar" style="flex:${Math.max(1, last.tBad || 0)}"><i style="width:100%;height:100%;background:#E8695A"></i></div>
      </div>
      <p class="note">좋음 ${pct(g, t)}% · 주의 ${pct(last.tWarn || 0, t)}% · 굽음 ${pct(last.tBad || 0, t)}%</p>
      <div class="lbl">자세 나이</div>
      <div class="kv"><span>이번 세션 기준</span><b>${age}세</b></div>
      <p class="note">유지력·회복 속도·무너진 깊이로 계산한 <b>버릇의 나이</b>입니다.
        점수도 등급도 아니고, 의학적 판단은 하지 않습니다.</p>
      ${plan ? `<div class="lbl">오늘 이거 두 개만</div>` + plan.map(([n, d]) =>
        `<div class="kv" style="display:block"><b>${esc(n)}</b><br><span>${esc(d)}</span></div>`).join('')
        : '<p class="note">오래 벗어난 축이 없었습니다. 오늘은 잘 앉으셨어요.</p>'}`;
  }
  const rows = past.length ? `<ul class="feed">${past.map((se) => {
    const d = new Date(se.t || Date.now());
    return `<li><b>${d.getMonth() + 1}/${d.getDate()}</b><span>${mmss(se.sec)} · 회복 ${se.bad || 0}번
      · ${se.zone === 'campus' ? '캠퍼스' : (ROOM_LABEL[se.zone] || se.zone)}</span></li>`;
  }).join('')}</ul>` : '<p class="note">지난 기록이 없습니다.</p>';
  return {
    tag: '회고', title: '세션 회고',
    html: `<div class="wr" style="margin-bottom:10px">
        <button data-tab="now" class="on">이번 세션</button><button data-tab="past">지난 세션</button></div>
      <div data-pane="now">${now}</div>
      <div data-pane="past" style="display:none">${rows}</div>`,
    on(root) {
      root.querySelector('.bd').onclick = (e) => {
        const b = e.target.closest('button[data-tab]'); if (!b) return;
        root.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
        root.querySelectorAll('[data-pane]').forEach((x) =>
          { x.style.display = x.dataset.pane === b.dataset.tab ? '' : 'none'; });
      };
    },
  };
}
const ROOM_LABEL = { library: '도서관', mainhall: '본관', dorm: '기숙사',
  union: '학생회관', arcade: '미니게임관', shop: '동아리 상점' };

/** 코인 — 어떻게 벌고 어디에 쓰는지 한 장에 */
export function coinPanel(ctx) {
  const d = SAVE.coinDay?.date === new Date().toISOString().slice(0, 10) ? SAVE.coinDay.got : 0;
  const run = SAVE.attend?.run || 0;
  return {
    tag: '코인', title: '코인',
    html: `${coinbar(ctx.coins, ctx.server ? ' <i style="font-style:normal;color:#8B94A1">· 서버 잔액</i>' : '')}
      <div class="kv"><span>오늘 받은 코인</span><b>${d} / 300</b></div>
      <div class="kv"><span>연속 출석</span><b>${run}일</b></div>
      <div class="lbl">어떻게 버나</div>
      <table class="tt"><tbody>
        <tr><th><b>5분 앉기</b></th><td>10코인</td></tr>
        <tr><th><b>15분</b></th><td>30코인</td></tr>
        <tr><th><b>30분</b></th><td>40코인</td></tr>
        <tr><th><b>50분</b></th><td>60코인</td></tr>
        <tr><th><b>회복</b></th><td>한 번에 5코인 · 세션당 다섯 번까지</td></tr>
        <tr><th><b>미니게임</b></th><td>10코인 · 게임별 하루 한 번</td></tr>
        <tr><th><b>연속 출석</b></th><td>3·7·14·30·60일에 5·15·30·60·100코인</td></tr>
        <tr><th><b>하루 상한</b></th><td>300코인</td></tr>
      </tbody></table>
      <div class="note"><b>앉은 시간이 아니라 판정이 돈 시간으로 셉니다.</b>
        카메라를 가려 두거나 자리를 비운 동안은 안 세요 — 그래야 코인이 실제로 앉은 값이 됩니다.</div>
      <div class="lbl">어디에 쓰나</div>
      <table class="tt"><tbody>
        <tr><th><b>옷</b></th><td>상의·하의·신발·모자·안경·가방</td></tr>
        <tr><th><b>가구</b></th><td>기숙사 방에 놓습니다</td></tr>
        <tr><th><b>알</b></th><td>40코인 — 아직 없는 종이 깨어납니다</td></tr>
      </tbody></table>`,
  };
}

/** 마이페이지 — 내 정보 · 자세 기준 · 설정 */
export function mypage(ctx) {
  const total = SAVE.sessions.reduce((a, s2) => a + s2.sec, 0);
  const judged = SAVE.sessions.reduce((a, s2) => a + (s2.judged || s2.sec), 0);
  const bad = SAVE.sessions.reduce((a, s2) => a + (s2.bad || 0), 0);
  const zones = {};
  SAVE.sessions.forEach((s2) => { zones[s2.zone] = (zones[s2.zone] || 0) + s2.sec; });
  const base = ctx.baseline;
  return {
    tag: '마이페이지', title: '내 기록',
    html: `<div class="wr" style="margin-bottom:10px">
        <button data-tab="me" class="on">내 정보</button>
        <button data-tab="cal">자세 기준</button>
        <button data-tab="set">설정</button></div>
      <div data-pane="me">
        <div class="kv"><span>세션</span><b>${SAVE.sessions.length}번</b></div>
        <div class="kv"><span>앉은 시간</span><b>${mmss(total)}</b></div>
        <div class="kv"><span>판정이 돈 시간</span><b>${mmss(judged)}</b></div>
        <div class="kv"><span>회복</span><b>${bad}번</b></div>
        <div class="kv"><span>코인</span><b>🪙 ${ctx.coins}</b></div>
        <div class="lbl">어디서 앉았나</div>
        ${Object.keys(zones).length ? Object.entries(zones).sort((a, b) => b[1] - a[1]).map(([z, v]) =>
          `<div class="kv"><span>${ROOM_LABEL[z] || z}</span><b>${mmss(v)}</b></div>`).join('')
          : '<p class="note">아직 없습니다.</p>'}
        <div class="wr" style="margin-top:12px"><button data-do="retro">세션 회고 열기</button></div>
      </div>
      <div data-pane="cal" style="display:none">
        ${base ? `<div class="kv"><span>기준 잡은 때</span><b>${new Date(base.createdAt).toLocaleString('ko-KR')}</b></div>
          <div class="kv"><span>쓰는 축</span><b>${Object.keys(base.features).length}개</b></div>
          <div class="kv"><span>표본</span><b>${base.sampleCount}개</b></div>`
          : '<p>아직 기준이 없습니다. 자리에 앉으면 10초 동안 지금 앉은 모습을 기준으로 잡습니다.</p>'}
        <div class="note">정답 자세와 비교하지 않습니다. <b>10초 전의 나</b>와만 비교합니다.
          의자를 바꾸거나 책상 높이가 달라졌으면 기준을 다시 잡는 게 낫습니다.</div>
        <div class="wr"><button data-do="recal">기준 다시 잡기</button></div>
      </div>
      <div data-pane="set" style="display:none">
        <div class="lbl">소리</div>
        <div class="wr"><button data-do="snd" class="${ctx.snd ? 'on' : ''}">장소 소리 ${ctx.snd ? '켬' : '끔'}</button>
          <button data-do="bgm" class="${ctx.bgm ? 'on' : ''}">배경음악 ${ctx.bgm ? '켬' : '끔'}</button></div>
        <div class="lbl">음량</div>
        <div class="wr">${[0, .25, .45, .7, 1].map((v) =>
          `<button data-do="vol:${v}" class="${Math.abs((ctx.bgmVol ?? .45) - v) < .01 ? 'on' : ''}">${
            v === 0 ? '없음' : Math.round(v * 100) + '%'}</button>`).join('')}</div>
        <div class="lbl">곡</div>
        <div class="wr"><button data-do="bgm:auto" class="${ctx.bgmPick === 'auto' ? 'on' : ''}">장소 따라</button>${
          Object.entries(ctx.music || {}).map(([id, m]) =>
            `<button data-do="bgm:${id}" class="${ctx.bgmPick === id ? 'on' : ''}" title="${esc(m.by)}">${esc(m.name)}</button>`).join('')}</div>
        <p class="note">곡은 전부 CC0 입니다. 만든 사람은 단추에 손을 올리면 나옵니다.</p>
        <div class="lbl">기록</div>
        <div class="wr"><button data-do="wipe">이 기기 기록 전체 지우기</button></div>
        <p class="note">지우면 되돌릴 수 없습니다 — 되돌릴 열쇠(이메일·비밀번호)를 애초에 안 받습니다.
          서버 기록까지 지우려면 <b>ikmc554@mju.ac.kr</b> 로 ID 를 알려 주세요.</p>
      </div>`,
    on(root, again) {
      root.querySelector('.bd').onclick = (e) => {
        const t = e.target.closest('button[data-tab]');
        if (t) {
          root.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === t));
          root.querySelectorAll('[data-pane]').forEach((x) =>
            { x.style.display = x.dataset.pane === t.dataset.tab ? '' : 'none'; });
          return;
        }
        const b = e.target.closest('button[data-do]'); if (!b) return;
        ctx.onDo(b.dataset.do, again);
      };
    },
  };
}

/** 안내 — 처음 온 사람이 읽는 일곱 줄 */
export function guide() {
  return {
    tag: '안내', title: 'Deskfit 안내',
    html: `<ol style="margin:0 0 10px 18px;padding:0;font-size:13.5px;line-height:1.9">
        <li>도서관이나 본관 자리 앞에서 <b>E</b> — 자세 세션이 시작됩니다.</li>
        <li>처음이면 10초 동안 지금 앉은 모습을 기준으로 잡습니다.</li>
        <li>그 뒤로는 <b>기준 대비</b> 얼마나 벗어났는지만 봅니다. 정답 자세와 겨루지 않아요.</li>
        <li>무너지면 캐릭터가 같이 굽고 말풍선이 뜹니다.</li>
        <li>일어나면 세션이 끝나고 코인이 들어옵니다.</li>
        <li>코인으로 옷·가구·알을 삽니다. 알에서 새 종이 깨어나요.</li>
        <li>앉은 시간은 학교 점수로 모입니다 — 개인 순위는 만들지 않습니다.</li>
      </ol>
      <div class="lbl">조작</div>
      <table class="tt"><tbody>
        <tr><th><b>W A S D</b></th><td>걷기 · Shift 로 뛰기</td></tr>
        <tr><th><b>E</b></th><td>말 걸기 · 들어가기 · 앉기</td></tr>
        <tr><th><b>Z X</b></th><td>시점 좌우로 돌리기</td></tr>
        <tr><th><b>M</b></th><td>지도 — 건물을 누르면 그 앞으로</td></tr>
        <tr><th><b>C</b></th><td>옷장</td></tr>
        <tr><th><b>G · 1~8</b></th><td>감정표현</td></tr>
        <tr><th><b>Enter</b></th><td>채팅</td></tr>
        <tr><th><b>Tab</b></th><td>1인칭 · 3인칭</td></tr>
      </tbody></table>`,
  };
}

/** 개인정보 — 서버로 가는 것과 안 가는 것 */
export function privacy() {
  return {
    tag: '개인정보', title: '카메라와 개인정보',
    html: `<p>영상은 이 브라우저 밖으로 나가지 않습니다. 판정은 기기 안에서 끝나고
        프레임은 즉시 버려집니다.</p>
      <div class="lbl">서버로 가지 않는 것</div>
      <p>영상·사진·스냅샷, 자세 좌표 원본, 10초로 만든 내 기준값, 얼굴에서 뽑은 어떤 값도.</p>
      <div class="lbl">세션이 끝날 때 서버로 가는 것 (전부)</div>
      <table class="tt"><tbody>
        <tr><th><b>세션 ID</b></th><td>기기가 만든 임의 문자열</td></tr>
        <tr><th><b>앉은 시간</b></th><td>분</td></tr>
        <tr><th><b>캠퍼스 시간</b></th><td>분</td></tr>
        <tr><th><b>회복 횟수</b></th><td>번</td></tr>
        <tr><th><b>시작·종료</b></th><td>시각</td></tr>
        <tr><th><b>학교</b></th><td>고른 학교 이름</td></tr>
      </tbody></table>
      <div class="note"><b>직접 확인해 보세요.</b> F12 로 개발자도구를 열고 세션을 돌리면
        오가는 요청이 전부 보입니다. 모델을 한 번 받은 뒤 랜선을 뽑아도 자세 판정은 그대로 돕니다.</div>
      <p class="note">회원가입이 없습니다. 이메일·전화번호·비밀번호를 받지 않고,
        다른 사람에게 보이는 건 닉네임과 캐릭터뿐입니다. 화면 공유 기능 자체가 없습니다.</p>`,
  };
}

/* 시즌 — 90일. 시작일을 코드에 박아 두면 다음 시즌에 또 고쳐야 하므로
   에폭에서 계산합니다. 2D 판의 seasonNow 와 같은 기준(90일)입니다. */
const SEASON_EPOCH = Date.UTC(2026, 5, 1);
export function season() {
  const day = 86400000, len = 90;
  const past = Math.max(0, Math.floor((Date.now() - SEASON_EPOCH) / day));
  const n = Math.floor(past / len) + 1;
  const inSeason = past % len;
  return { n, day: inSeason + 1, left: len - inSeason, done: Math.round((inSeason / len) * 100) };
}

/* ---------- 학교 메일 인증 ----------
   학교를 목록에서 고르기만 하면 아무나 남의 학교 점수를 올릴 수 있습니다.
   랭킹전이 학교 대항인 이상 여기는 인증이 있어야 말이 됩니다. */
export function schoolAuth(ctx) {
  const st = ctx.state;                    // idle · sending · code · done · off
  const school = SAVE.school || '';
  let body;
  if (!ctx.configured) {
    body = `<p>이 판본에는 메일 서버 설정이 없어 인증을 못 합니다.</p>
      <p class="note">배포본에서는 <b>학교 메일(ac.kr)</b>로 여섯 자리 번호를 보내고,
      그 번호를 여기 넣으면 학교가 정해집니다. 지금은 옷장(C)에서 목록으로 고를 수 있습니다.</p>`;
  } else if (st === 'done') {
    body = `<div class="card-id"><div class="ph" style="display:grid;place-items:center;font-size:30px">🎓</div>
        <div class="info"><b>${esc(school || '학교')}</b>
        <span>${SAVE.schoolVerifiedAt ? new Date(SAVE.schoolVerifiedAt).toLocaleDateString('ko-KR') : ''} 인증됨</span>
        <span>이제 앉은 시간이 이 학교 점수로 쌓입니다.</span></div></div>
      <div class="wr" style="margin-top:12px"><button data-do="reset">다른 학교로 다시 인증</button></div>`;
  } else if (st === 'code') {
    body = `<p><b>${esc(ctx.email)}</b> 로 여섯 자리를 보냈습니다. 메일함을 열어 주세요.</p>
      <input class="nick" id="scode" inputmode="numeric" maxlength="6" placeholder="6자리 번호">
      <div class="wr" style="margin-top:10px"><button data-do="verify">확인</button>
        <button data-do="back">주소 다시 넣기</button></div>
      ${ctx.err ? `<p class="note" style="color:#C0392B">${esc(ctx.err)}</p>` : ''}
      <p class="note">링크가 아니라 번호를 쓰는 이유 — 메일 앱이 링크를 자기 브라우저에서 열면
      로그인이 <b>그쪽</b>에 생겨서, 이 탭은 로그인 안 된 화면 그대로입니다.</p>`;
  } else {
    body = `<p>학교 메일 주소를 넣어 주세요. <b>ac.kr</b> 로 끝나는 주소만 됩니다.</p>
      <input class="nick" id="smail" type="email" placeholder="학번@학교.ac.kr" value="${esc(ctx.email || '')}">
      <div class="wr" style="margin-top:10px"><button data-do="send" ${st === 'sending' ? 'disabled' : ''}>
        ${st === 'sending' ? '보내는 중…' : '번호 받기'}</button></div>
      ${ctx.err ? `<p class="note" style="color:#C0392B">${esc(ctx.err)}</p>` : ''}
      <p class="note">주소는 학교를 알아내는 데만 씁니다. 메일함을 읽지 않고,
      광고도 보내지 않습니다. 다른 사람에게 보이는 건 닉네임과 캐릭터뿐입니다.</p>`;
  }
  return {
    tag: '창구', title: '학교 인증', html: body,
    on(root, again) {
      const bd = root.querySelector('.bd');
      bd.querySelectorAll('input').forEach((i) => { i.onkeydown = (e) => e.stopPropagation(); });
      bd.onclick = (e) => {
        const b = e.target.closest('button[data-do]'); if (!b || b.disabled) return;
        ctx.onDo(b.dataset.do, {
          email: bd.querySelector('#smail')?.value?.trim(),
          code: bd.querySelector('#scode')?.value?.trim(),
        }, again);
      };
    },
  };
}

/* ══════════════════════════════════════════════════════════
   초대 코드 — 정문에서 건네는 여섯 자리

   2D 판에도 있던 것인데 3D 로 옮기면서 정문이 문구만 있는 자리로
   남아 있었습니다. 코드 자체는 본 서비스 기능이라(서버 invites 표)
   여기서 만드는 형식과 글자표를 그쪽과 같게 맞춰 둡니다.

   글자표에서 0·O·1·I 를 뺐습니다. 여섯 자리를 사람이 불러 주고
   사람이 받아 적는 물건이라, 저 넷이 섞이면 절반은 틀립니다.

   지금은 이 기기 안에만 남습니다. 서버가 붙는 자리는 각 메서드
   주석에 적어 뒀습니다 — 지우면 그 설계까지 같이 사라집니다.
   ══════════════════════════════════════════════════════════ */
export const INVITE = {
  KEY: 'girin.invites',
  ABC: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
  LEN: 6,
  all() { try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; } catch { return {}; } },
  _put(a) { try { localStorage.setItem(this.KEY, JSON.stringify(a)); } catch {} },
  /** → supabase.from('invites').upsert(...) */
  publish(code, profile) { const a = this.all(); a[code] = Object.assign({ at: Date.now() }, profile); this._put(a); },
  /** → supabase.from('invites').select().eq('code', code) */
  lookup(code) { return this.all()[String(code || '').toUpperCase().trim()] || null; },
  /** → supabase.from('invites').delete().eq('code', code) */
  revoke(code) { const a = this.all(); delete a[code]; this._put(a); },
  make() {
    let c = '';
    /* Math.random 으로 충분합니다 — 이 코드는 비밀이 아니라 약속입니다.
       친구에게 불러 줄 여섯 글자이지 남의 방을 지키는 자물쇠가 아닙니다. */
    for (let i = 0; i < this.LEN; i++) c += this.ABC[Math.floor(Math.random() * this.ABC.length)];
    return c;
  },
  valid(code) {
    const c = String(code || '').toUpperCase().trim();
    return c.length === this.LEN && [...c].every((ch) => this.ABC.includes(ch));
  },
  /** 내 코드. 없으면 만들고, 있으면 프로필만 갱신합니다 */
  mine(profile) {
    if (!SAVE.invite || !this.valid(SAVE.invite)) { SAVE.invite = this.make(); save(); }
    this.publish(SAVE.invite, Object.assign({ self: true }, profile || {}));
    return SAVE.invite;
  },
};

/** 정문 — 초대 코드를 만들고 건네는 자리 */
export function invitePanel(ctx) {
  const code = INVITE.mine({ nickname: ctx.nick, school: ctx.school, species: ctx.species });
  const url = (() => {
    try { const u = new URL(location.href); u.searchParams.set('invite', code); return u.toString(); }
    catch { return location.href; }
  })();
  const friends = Object.entries(INVITE.all())
    .filter(([c, v]) => c !== code && !v.self)
    .sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).slice(0, 6);
  const html = `
    <p>친구에게 이 여섯 자리를 불러 주세요. 같은 코드를 넣으면 서로가 이웃 목록에 뜹니다.</p>
    <div style="display:grid;place-items:center;margin:14px 0 10px">
      <b style="font:800 30px/1.1 ui-monospace,Menlo,monospace;letter-spacing:.18em;
        background:var(--surface-3,#F2EFE7);border:1px solid var(--line-2,#DDD6C8);
        border-radius:14px;padding:12px 18px">${esc(code)}</b>
    </div>
    <div class="wr">
      <button data-inv="copy">코드 복사</button>
      <button data-inv="link">초대 링크 복사</button>
      <button data-inv="new">새로 만들기</button>
    </div>
    <div class="lbl">코드 넣기</div>
    <div class="wr" style="align-items:center">
      <input class="invin" maxlength="6" placeholder="ABC123" autocomplete="off"
        style="flex:1;min-width:130px;text-transform:uppercase;letter-spacing:.16em;
        font:700 16px/1 ui-monospace,Menlo,monospace;padding:10px 12px;border-radius:10px;
        border:1px solid var(--line-2,#DDD6C8);background:var(--surface-2,#fff);color:inherit">
      <button data-inv="add">넣기</button>
    </div>
    <p class="hint invmsg" aria-live="polite"></p>
    <div class="lbl">받아 둔 코드</div>
    ${friends.length
      ? '<div class="wr">' + friends.map(([c, v]) =>
        `<button data-drop="${esc(c)}" title="지우기">${esc(c)}${v.nickname ? ' · ' + esc(v.nickname) : ''} ✕</button>`).join('') + '</div>'
      : '<p class="hint">아직 없어요.</p>'}
    <p class="note">코드는 <b>이 기기에만</b> 남습니다. 서버가 붙으면 같은 코드로 진짜 이웃이 이어집니다.
    코드에는 별명·학교·종만 들어 있고, 자세 기록은 들어가지 않습니다.</p>`;
  return {
    tag: '정문', title: '기린캠퍼스 정문', html,
    on(root, again) {
      const msg = root.querySelector('.invmsg');
      const inp = root.querySelector('.invin');
      if (inp) inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') root.querySelector('[data-inv="add"]').click(); };
      const copy = (t, ok) => {
        /* navigator.clipboard 는 https 나 localhost 에서만 삽니다. 안 되면
           조용히 실패하는 대신 코드를 그대로 보여 줍니다 — 받아적을 수 있게. */
        try { navigator.clipboard.writeText(t).then(() => { msg.textContent = ok; },
          () => { msg.textContent = t; }); }
        catch { msg.textContent = t; }
      };
      root.querySelector('.bd').onclick = (e) => {
        const d = e.target.closest('button[data-drop]');
        if (d) { INVITE.revoke(d.dataset.drop); again(); return; }
        const b = e.target.closest('button[data-inv]'); if (!b) return;
        const k = b.dataset.inv;
        if (k === 'copy') copy(code, '코드를 복사했어요');
        else if (k === 'link') copy(url, '초대 링크를 복사했어요');
        else if (k === 'new') { INVITE.revoke(code); SAVE.invite = null; save(); again(); }
        else if (k === 'add') {
          const v = (inp.value || '').toUpperCase().trim();
          if (!INVITE.valid(v)) { msg.textContent = '여섯 자리를 정확히 넣어 주세요 (0·O·1·I 는 안 씁니다)'; return; }
          if (v === code) { msg.textContent = '내 코드예요'; return; }
          INVITE.publish(v, { nickname: '', school: '', at: Date.now() });
          again();
        }
      };
    },
  };
}

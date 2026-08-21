/* ══════════════════════════════════════════════════════════
   창(panel) 들.
   "말 걸면 문구만 뜬다" 는 껍데기입니다. 여기서는 **실제로 도는 것**만
   담습니다 — 시간표는 고쳐지고, 기록은 쌓이고, 옷은 갈아입힙니다.
   미니게임처럼 2D 월드에 이미 있는 것은 여기서 부르지 않고 자리만
   남겨 둡니다(가짜로 흉내 내면 시연에서 반드시 들킵니다).
   ══════════════════════════════════════════════════════════ */

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
export function notices(kind) {
  const school = [
    ['08/22', '2학기 수강신청 정정 기간 안내'],
    ['08/21', '도서관 하계 단축 운영 (~08/30)'],
    ['08/20', '교내 장학금 2차 신청 접수'],
    ['08/19', '학사일정 변경 공지'],
  ];
  const out = [
    ['D-3', '대학생 UX 공모전 — 개인/팀'],
    ['D-9', '교내 창업경진대회 서류 마감'],
    ['D-14', '여름 서포터즈 15기 모집'],
  ];
  const L = kind === 'school' ? school : out;
  return {
    tag: kind === 'school' ? '공지' : '공고',
    title: kind === 'school' ? '학교 공지사항' : '대외활동 · 공모전',
    html: `<ul class="feed">${L.map(([d, t]) => `<li><b>${d}</b><span>${esc(t)}</span></li>`).join('')}</ul>
      <p class="note">${kind === 'school'
        ? '명지대 RSS 는 연결 확인했습니다. 나머지 아홉 곳은 게시판 id 를 확인 중입니다.'
        : '링커리어·올콘은 이용약관 제20조에서 크롤링을 금지합니다. 공식 링크로만 보냅니다.'}</p>`,
  };
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
    + '<p class="note">산 옷은 <b>옷장(C)</b> 어디서든 갈아입습니다. 값은 서버 값표가 정합니다 — 이 화면은 보여 줄 뿐입니다.</p>';
  return {
    tag: '옷 가게', title: '동아리 옷 상점', html,
    on(root, again) {
      root.querySelector('.bd').onclick = (e) => {
        const b = e.target.closest('button[data-buy]'); if (!b || b.disabled) return;
        ctx.onBuy(b.dataset.buy, b.dataset.slot, again);
      };
    },
  };
}

/** 가구 목록 — 기숙사에 놓는 것들 */
export const FURN = [
  ['plant', '화분', 30], ['lamp2', '스탠드', 40], ['rug2', '깔개', 40],
  ['books2', '책 더미', 20], ['guitar2', '기타', 80], ['bear', '곰인형', 60],
];
export function furnShop(ctx) {
  const html = coinbar(ctx.coins)
    + '<div class="lbl">가구</div><div class="buys">'
    + FURN.map(([id, nm, price]) => {
      const n = ctx.furn[id] || 0;
      return `<button class="buy" data-fbuy="${id}">
        <span class="sw" style="background:#EFE4D0;display:grid;place-items:center;font-size:17px">${
          { plant: '🪴', lamp2: '💡', rug2: '🟫', books2: '📚', guitar2: '🎸', bear: '🧸' }[id]}</span>
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
  return {
    tag: '명예의 전당', title: '학교 순위', html: body
      + (ctx.myschool ? `<p class="note">내 학교 — <b>${esc(ctx.myschool)}</b>. 오늘 앉은 시간이 여기에 쌓입니다.</p>`
        : '<p class="note">옷장(C)에서 학교를 고르면 내 시간이 학교 점수로 쌓입니다.</p>'),
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

/* ══════════════════════════════════════════════════════════
   창(panel) 들.
   "말 걸면 문구만 뜬다" 는 껍데기입니다. 여기서는 **실제로 도는 것**만
   담습니다 — 시간표는 고쳐지고, 기록은 쌓이고, 옷은 갈아입힙니다.
   미니게임처럼 2D 월드에 이미 있는 것은 여기서 부르지 않고 자리만
   남겨 둡니다(가짜로 흉내 내면 시연에서 반드시 들킵니다).
   ══════════════════════════════════════════════════════════ */


const KEY = 'girin3d.save';
const DEF = {
  /* 기본은 기린입니다. 거북이·펭귄은 변환된 메시의 뒤통수에도 눈이 파여
     있어(생성기가 앞면을 뒤에 복사했습니다) 돌아서면 얼굴이 둘로 보입니다.
     그 둘을 다시 뽑으면 되돌립니다. */
  nick: '', school: '', species: '기린', fit: 0,
  look: null,                 // { topId, top, bottomId, bottom, ... } — 없으면 기본 차림
  owned2: [],                 // 산 옷 id
  ownedSp: [],                // 깨어난 종 (기본 셋은 코드가 채웁니다)
  furn: {},                   // 가구 id → 개수
  decor: [],                  // 방에 놓인 가구 [{id,x,z,ry}]
  egg: null,                  // 품는 알 { hatchAt }
  gameDay: null,              // { date, played:{게임:1} } — 하루 한 번 지급
  timetable: {},              // "월-3" → { name, room, color, s, e } — s·e 는 분
  sessions: [],               // { t, sec, bad, zone }
  coins: 120,
  owned: [0],                 // 가진 옷 번호
  seenTutorial: false,
  links: { spotify: '', calendar: '' },   // 사람이 손으로 붙여 넣는 바깥 주소
};
export const SAVE = load();
function load() {
  let s;
  try { s = Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch { s = Object.assign({}, DEF); }
  /* links 는 여기서 **새로 지어 넣습니다.** 두 가지를 막습니다.
     하나. Object.assign 은 얕게 베낍니다. 저장본에 links 가 없으면
     SAVE.links 가 DEF.links 를 그대로 가리키고, 주소를 하나 넣는 순간
     기본값 표까지 같이 더럽혀집니다.
     둘. 옛 저장본이나 다른 탭이 이 자리에 null 이나 문자열을 넣어 둔
     경우가 있습니다. 그대로 두면 SAVE.links.spotify 를 읽는 창이 열리다
     말고 터져서, 눌러도 아무 일이 없는 것으로 보입니다. */
  const L = (s.links && typeof s.links === 'object' && !Array.isArray(s.links)) ? s.links : {};
  s.links = { spotify: String(L.spotify || ''), calendar: String(L.calendar || '') };
  return s;
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

/* ── 창을 짓는 조각 넷 ──
   창마다 같은 모양을 손으로 또 적으면 어느 창은 아이콘이 빠지고 어느
   창은 글자 크기가 다릅니다. 네 조각만 두고 전부 여기를 지나가게 합니다.
   글자는 **넣기 전에** esc 를 거칩니다 — 이 조각들은 받은 것을 그대로
   붙입니다(<b> 같은 것을 섞어 쓰는 자리가 있어서요). */
const pic = (id, big) => `<svg class="pic${big ? ' lg' : ''}"><use href="#pic-${id}"/></svg>`;
/* 줄 — 이름과 값 한 쌍. 두 칸짜리 표가 전부 이리로 옵니다.
   tone 은 비워 두면 하늘색으로 받습니다. 아이콘 바탕의 기본색(민트)이
   스타일표에서 칸(.cc) 안쪽에만 걸려 있어서, 줄에 색을 안 주면 그 줄만
   알약 없는 맨 아이콘이 됩니다 — 한 목록 안에서 어떤 줄은 알약이 있고
   어떤 줄은 없어 보입니다. */
const rw = (id, tone, title, sub2, val) =>
  `<div class="rw"><span class="ic ${tone || 'sky'}">${pic(id)}</span>`
  + `<span class="t">${title}${sub2 ? `<em>${sub2}</em>` : ''}</span>`
  + `${val != null && val !== '' ? `<span class="v">${val}</span>` : ''}</div>`;
/* 칸 — 숫자 하나가 주인공일 때 */
const cc = (id, tone, big, cap) =>
  `<div class="cc"><span class="ic${tone ? ' ' + tone : ''}">${pic(id)}</span>`
  + `<span class="big">${big}</span><small>${cap}</small></div>`;
/* 칸 — 이름과 설명이 주인공일 때. 줄글 한 문단이 보통 이것 서넛이 됩니다. */
const cb = (id, tone, name, desc) =>
  `<div class="cc"><span class="ic${tone ? ' ' + tone : ''}">${pic(id)}</span>`
  + `<b>${name}</b><small>${desc}</small></div>`;
/* 머리글에도 그림을 답니다 — 글자만 있는 줄은 눈이 그냥 지나갑니다. */
const lbl = (id, text) => `<div class="lbl">${pic(id)}${text}</div>`;

/* ══════════════════════════════════════════════════════════
   시간표 — 칸을 눌러 직접 채웁니다

   여기는 오래 window.prompt('강의 이름') 하나였습니다. 한 줄이라 짜기는
   쉬웠는데, 그 한 줄로는 장소도 시각도 색도 못 받습니다. 그래서 09:00 에
   시작하지 않는 강의는 넣을 방법 자체가 없었고, 브라우저 기본 대화상자가
   3D 화면 위에 떠서 그때만 다른 앱처럼 보였습니다. 2D 판의 폼을 그대로
   옮겨 옵니다 — 이름 · 장소 · 요일 · 시각(30분 단위) · 색.

   **격자와 저장 모양은 그대로 둡니다.** SAVE.timetable 은 여전히
   "월-3" → { name, room, color } 인 표이고, 여기에 s·e(자정부터 분)만
   더 적습니다. 옛 값에는 그 둘이 없으므로 **읽는 쪽이 그 교시의 시각으로
   메웁니다** — 모양이 다르다고 버리면 사람이 적어 둔 시간표가 판올림
   한 번에 사라집니다.
   ══════════════════════════════════════════════════════════ */
const hm2min = (t) => { const [h, m] = String(t).split(':'); return (+h) * 60 + (+m); };
const P_START = PERIODS.map(([, t]) => hm2min(t));
/* 교시 길이를 90 이라고 또 적지 않습니다 — PERIODS 의 간격이 곧 길이라,
   위 표를 고치면 여기도 같이 따라옵니다. */
const P_LEN = P_START[1] - P_START[0];
const ttHM = (min) => `${String((min / 60) | 0).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
/* 시작 시각이 어느 교시 칸에 앉는지. 8시 강의는 1교시 칸에, 밤 강의는
   마지막 칸에 붙습니다 — 격자가 여섯 줄이라 그 밖은 갈 곳이 없습니다. */
const ttSlot = (s) => Math.max(0, Math.min(P_START.length - 1, Math.floor((s - P_START[0]) / P_LEN)));

/** 저장된 표를 줄 목록으로 폅니다. 여기서 옛 값을 메웁니다. */
function ttItems() {
  const out = [];
  for (const [k, v] of Object.entries(SAVE.timetable || {})) {
    if (!v || typeof v !== 'object') continue;
    const cut = String(k).lastIndexOf('-');
    const day = String(k).slice(0, cut);
    const p = +String(k).slice(cut + 1);
    const di = DAYS.indexOf(day);
    if (di < 0 || !(p >= 0 && p < P_START.length)) continue;
    /* 칸이 곧 시각이던 판에서 넘어온 값입니다. 그 시절 약속대로 그
       교시의 시각을 채워 읽고, 다음에 저장될 때 파일에도 같이 적힙니다. */
    const s = Number.isFinite(v.s) ? v.s : P_START[p];
    const e = (Number.isFinite(v.e) && v.e > s) ? v.e : s + P_LEN;
    out.push({
      key: k, day, di, p, s, e,
      name: String(v.name || ''), room: String(v.room || ''),
      color: v.color || COLORS[0],
    });
  }
  return out.sort((a, b) => a.di - b.di || a.s - b.s);
}

/** 지금 하는 강의 · 오늘 남은 첫 강의 · 그다음 날 첫 강의 */
function ttNext(now) {
  const all = ttItems();
  if (!all.length) return null;
  const d = (now.getDay() + 6) % 7;              // 0=월 … 4=금 · 5=토 · 6=일
  const min = now.getHours() * 60 + now.getMinutes();
  const of = (di) => all.filter((it) => it.di === di);
  const today0 = of(d);
  const on = today0.find((it) => min >= it.s && min < it.e);
  if (on) return { kind: 'now', it: on };
  const nx = today0.find((it) => it.s > min);
  if (nx) return { kind: 'next', it: nx };
  /* 이레를 돕니다. 격자는 닷새뿐이지만 금요일 저녁에 열면 토·일을 지나
     월요일까지 가야 답이 나옵니다 — 닷새만 돌면 주말에 답이 없습니다. */
  for (let k = 1; k <= 7; k++) {
    const first = of((d + k) % 7)[0];
    if (first) return { kind: 'later', it: first };
  }
  return null;
}

/* 맨 윗줄은 격자가 아니라 **줄 하나**입니다. 시간표를 여는 이유는 대개
   "지금 뭐였지" 하나라, 그 답이 격자를 읽기 전에 나와야 합니다. 지금 ·
   오늘 · 다음 날을 아이콘 색으로 갈라 둡니다 — 글자를 안 읽어도 다릅니다. */
function ttLineHtml() {
  const nx = ttNext(new Date());
  if (!nx) return '';
  const it = nx.it;
  const where = it.room ? ' · ' + esc(it.room) : '';
  if (nx.kind === 'now')
    return rw('bell', 'peach', `지금 <b>${esc(it.name)}</b>`,
      `${ttHM(it.s)}~${ttHM(it.e)}${where}`, '진행 중');
  if (nx.kind === 'next')
    return rw('clock', 'lemon', `다음 <b>${esc(it.name)}</b>`, `오늘${where}`, ttHM(it.s));
  return rw('cal', 'sky', `다음 <b>${esc(it.name)}</b>`,
    `${esc(it.day)}요일${where}`, ttHM(it.s));
}

function ttGridHtml() {
  const all = ttItems();
  const at = (di, p) => all.find((it) => it.di === di && it.p === p);
  const rows = PERIODS.map(([nm, tm], p) => `
    <tr><th><b>${nm}</b><i>${tm}</i></th>${DAYS.map((d, di) => {
      const c = at(di, p);
      if (!c) return `<td><button class="tt" data-tt="new" data-d="${d}" data-p="${p}">+</button></td>`;
      /* 교시 시각과 다르게 넣은 강의만 시각을 덧붙입니다. 전부 적으면
         09:00 이 여섯 줄 왼쪽에도, 칸 안에도 또 적혀 있게 됩니다. */
      const odd = c.s !== P_START[p] || c.e !== P_START[p] + P_LEN;
      return `<td><button class="tt on" data-tt="edit" data-k="${esc(c.key)}"
        title="${esc(c.name)} ${ttHM(c.s)}~${ttHM(c.e)}${c.room ? ' · ' + esc(c.room) : ''}"
        style="background:${esc(c.color)};color:#1B2430">${esc(c.name)}${odd
          ? `<i style="display:block;font-style:normal;font-size:9px;opacity:.72">${ttHM(c.s)}~${ttHM(c.e)}</i>`
          : ''}</button></td>`;
    }).join('')}</tr>`).join('');
  return `<table class="tt"><thead><tr><th></th>${DAYS.map((d) => `<th>${d}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody></table>`;
}

/* 지금 고치고 있는 칸. null 이면 폼이 닫혀 있습니다. 창을 다시 그릴 때마다
   이 값에서 폼을 새로 만들므로, 요일 단추를 눌러도 적던 글자가 살아 있습니다. */
let TT_DRAFT = null;

/* 30분 단위. 15분으로 하면 고를 칸이 예순 개가 넘고, 대학 시간표는 보통
   30분에 걸립니다. 아침 7시부터 밤 11시까지. */
function ttTimeOptions(sel) {
  let o = '';
  for (let m = 7 * 60; m <= 23 * 60; m += 30)
    o += `<option value="${m}"${m === sel ? ' selected' : ''}>${ttHM(m)}</option>`;
  return o;
}
function ttFormHtml() {
  const d = TT_DRAFT;
  if (!d) {
    return '<div class="wr"><button data-tt="add">강의 넣기</button></div>';
  }
  const days = DAYS.map((n) =>
    `<button data-tt="day" data-d="${n}" class="${d.d === n ? 'on' : ''}">${n}</button>`).join('');
  /* 칩에 글자가 없으므로 이름을 따로 답니다 — 색만으로 말하는 단추는
     읽어 주는 프로그램에게는 아무 말도 안 하는 단추입니다. */
  const sw = COLORS.map((c, i) =>
    `<button class="sw${d.color === c ? ' on' : ''}" data-tt="color" data-c="${esc(c)}"
      style="background:${esc(c)}" aria-label="색 ${i + 1}" aria-pressed="${d.color === c}"></button>`).join('');
  /* 칸 사이를 벌리려고 여백을 손으로 박아 두던 자리에 머리글을 세웁니다.
     간격도 생기고, 아래 칸이 무엇을 받는 칸인지도 같이 말합니다. */
  return lbl('board', d.key ? '강의 고치기' : '새 강의')
    + `<input id="ttname" class="nick" maxlength="16" placeholder="강의 이름 (예: 자료구조)" value="${esc(d.name)}">`
    + lbl('map', '장소')
    + `<input id="ttroom" class="nick" maxlength="20"
      placeholder="안 적어도 됩니다 (예: 공학관 302)" value="${esc(d.room)}">`
    + lbl('cal', '요일') + `<div class="wr">${days}</div>`
    + lbl('clock', '시각')
    + `<div class="wr"><select id="tts">${ttTimeOptions(d.s)}</select>
      <select id="tte">${ttTimeOptions(d.e)}</select></div>`
    + lbl('leaf', '색') + `<div class="wr">${sw}</div>
    <p class="ttmsg" aria-live="polite"></p>
    <div class="wr">
      <button data-tt="save" class="on">저장</button>
      <button data-tt="cancel">취소</button>
      ${d.key ? '<button data-tt="del">지우기</button>' : ''}
    </div>`;
}

export function timetable() {
  return {
    tag: '시간표', title: '내 시간표',
    html: ttLineHtml() + ttGridHtml() + ttFormHtml()
      + '<div class="note">찬 칸을 누르면 고치고, 빈 칸을 누르면 그 교시부터 새로 넣습니다.</div>',
    on(root, again) {
      const bd = root.querySelector('.bd');
      /* 월드가 W·A·S·D 로 걷고 화살표로 시점을 돌립니다. 칸에 글자를 넣는
         동안 그 키가 그대로 새어 나가면 강의 이름을 적는 사이에 캐릭터가
         걸어갑니다. select 도 같습니다 — 화살표로 시각을 고르니까요. */
      bd.querySelectorAll('input,select').forEach((i) => { i.onkeydown = (e) => e.stopPropagation(); });
      const msg = bd.querySelector('.ttmsg');
      const say = (t) => { if (msg) msg.textContent = t; };
      /* 단추가 전부 화면을 다시 그리므로, 손에 든 글자를 먼저 draft 로
         옮깁니다. 안 그러면 요일 단추 한 번에 강의 이름이 지워집니다. */
      const sync = () => {
        if (!TT_DRAFT) return;
        const n = bd.querySelector('#ttname'), r = bd.querySelector('#ttroom');
        const s0 = bd.querySelector('#tts'), e0 = bd.querySelector('#tte');
        if (n) TT_DRAFT.name = n.value;
        if (r) TT_DRAFT.room = r.value;
        if (s0) TT_DRAFT.s = +s0.value;
        if (e0) TT_DRAFT.e = +e0.value;
      };
      const focusName = () => { root.querySelector('#ttname')?.focus(); };
      bd.onclick = (e) => {
        const b = e.target.closest('[data-tt]'); if (!b) return;
        const k = b.dataset.tt;
        if (k === 'new' || k === 'add') {
          const p = k === 'new' ? +b.dataset.p : 0;
          /* 새 강의의 색은 돌아가며 줍니다. 늘 첫 색이면 시간표가 한 색이 됩니다. */
          TT_DRAFT = { key: '', name: '', room: '', d: k === 'new' ? b.dataset.d : DAYS[0],
            s: P_START[p], e: P_START[p] + P_LEN,
            color: COLORS[Object.keys(SAVE.timetable).length % COLORS.length] };
          again(); focusName(); return;
        }
        if (k === 'edit') {
          const it = ttItems().find((x) => x.key === b.dataset.k);
          if (it) { TT_DRAFT = { key: it.key, name: it.name, room: it.room, d: it.day, s: it.s, e: it.e, color: it.color }; again(); }
          return;
        }
        if (!TT_DRAFT) return;
        if (k === 'day') { sync(); TT_DRAFT.d = b.dataset.d; again(); return; }
        if (k === 'color') { sync(); TT_DRAFT.color = b.dataset.c; again(); return; }
        if (k === 'cancel') { TT_DRAFT = null; again(); return; }
        if (k === 'del') {
          delete SAVE.timetable[TT_DRAFT.key]; save(); TT_DRAFT = null; again(); return;
        }
        if (k === 'save') {
          sync();
          const d = TT_DRAFT;
          const name = (d.name || '').trim().slice(0, 16);
          /* 이름이 비면 격자에 빈 칸이 하나 생기고 그게 무엇인지 아무도
             모릅니다. 끝이 시작보다 빠르면 없는 시간이 됩니다. 둘 다
             저장 전에 여기서 막습니다. */
          if (!name) { say('강의 이름을 넣어 주세요.'); focusName(); return; }
          if (d.e <= d.s) d.e = d.s + P_LEN;
          const p = ttSlot(d.s);
          const key = `${d.d}-${p}`;
          const busy = SAVE.timetable[key];
          /* 격자는 한 칸에 하나만 그립니다. 이미 찬 칸에 말없이 덮어쓰면
             지운 적 없는 강의가 사라집니다 — 무엇이 있는지 이름을 대고 멈춥니다. */
          if (busy && key !== d.key) {
            say(`${d.d}요일 ${PERIODS[p][0]} 자리는 이미 차 있어요 — "${busy.name || '강의'}". 그 칸을 먼저 비우거나 다른 시각으로 옮겨 주세요.`);
            return;
          }
          if (d.key && d.key !== key) delete SAVE.timetable[d.key];
          SAVE.timetable[key] = { name, room: (d.room || '').trim().slice(0, 20), color: d.color, s: d.s, e: d.e };
          save(); TT_DRAFT = null; again();
        }
      };
    },
  };
}

/* ---------- 교단 — 오늘 강의 ----------
   시간표 창을 열 이유의 대부분이 "지금 뭐였지" 한 줄이라, 그 한 줄만
   따로 세워 둡니다. 격자와 **같은 ttNext 를 씁니다** — 답이 두 곳에서
   따로 계산되면 언젠가 서로 다른 말을 합니다. */
export function today() {
  const now = new Date();
  const all = ttItems();
  if (!all.length) {
    return {
      tag: '교단', title: '오늘 강의',
      html: rw('cal', 'lilac', '아직 넣은 강의가 없어요',
        '본관 교탁이나 기숙사 노트북에서 시간표를 채우면 여기에 뜹니다'),
    };
  }
  const d = (now.getDay() + 6) % 7;
  const min = now.getHours() * 60 + now.getMinutes();
  const mine = all.filter((it) => it.di === d);
  const later = mine.filter((it) => it.s > min);
  /* 지난 것 · 지금 것 · 올 것을 아이콘과 색으로 가릅니다. 예전에는 줄
     끝에 '끝남' 이라고 적어 두었는데, 열 줄이 되면 그 글자를 세게 됩니다. */
  const rows = mine.length
    ? mine.map((it) => {
        const done = min >= it.e, on = !done && min >= it.s;
        return rw(on ? 'bell' : done ? 'seat' : 'clock',
          on ? 'peach' : done ? 'lilac' : 'sky',
          esc(it.name), (it.room ? esc(it.room) : '강의실 미정') + (on ? ' · 진행 중' : done ? ' · 끝남' : ''),
          `${ttHM(it.s)}~${ttHM(it.e)}`);
      }).join('')
    /* 격자는 닷새뿐이라 토·일에는 DAYS[d] 가 없습니다. 그때 "요일" 을
       그냥 붙이면 "오늘요일" 이 됩니다 — 요일 이름이 있을 때만 붙입니다. */
    : rw('sun', 'lemon', `${DAYS[d] ? DAYS[d] + '요일' : '오늘'}은 강의가 없어요`, '');
  return {
    tag: '교단', title: '오늘 강의',
    html: ttLineHtml()
      + `<div class="cg two">${cc('book', '', mine.length, '오늘 강의')}`
      + `${cc('clock', 'sky', later.length, '아직 남음')}</div>`
      + lbl('cal', '오늘 하루') + rows,
  };
}

/* ══════════════════════════════════════════════════════════
   바깥 화면 두 칸 — 스포티파이 · 구글 캘린더

   사람이 주소를 붙여 넣고, 그 주소로 iframe 을 하나 세웁니다. 주소를
   받는 자리는 설정 화면이 아니라 **그 창 안**입니다 — 음악 주소를 고치러
   마이페이지에 들어갔다 나오는 사람은 없습니다.

   여기서 지키는 규칙이 하나입니다. **붙여 넣은 글자는 절대 그대로
   iframe 에 넣지 않습니다.** 종류와 id 만 뽑아 우리 손으로 주소를 다시
   짓습니다. 그래야 javascript: 든 남의 서버든 애초에 들어올 자리가
   없습니다 — 걸러내는 목록을 관리하는 대신, 만들 수 있는 주소를 둘로
   못박는 쪽입니다.
   ══════════════════════════════════════════════════════════ */

/* ---- 스포티파이 ----
   oEmbed 를 안 부릅니다. 붙여 넣은 주소에서 종류와 id 만 뽑아 embed 주소를
   바로 만듭니다. 요청이 하나도 안 나가므로 CORS 도, 키도, 실패할 왕복도
   없습니다 — oEmbed 로 얻는 것은 제목뿐인데 그 값에 왕복 하나를 걸 이유가
   없습니다.
   받아 주는 꼴: https://open.spotify.com/playlist/ID · spotify:track:ID ·
   ?si=... 붙은 공유 링크. */
export function spotifyEmbed(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  let m = /^spotify:(track|album|playlist|artist|show|episode):([A-Za-z0-9]+)/.exec(s);
  /* 호스트를 **맨 앞에** 못박습니다. 안 박으면
     https://evil.example/open.spotify.com/playlist/abc 같은 주소에서도 id 를
     뽑아 갑니다. 만들어지는 주소는 어차피 우리가 다시 짓지만, 잘못 붙여
     넣은 것을 말없이 "고쳐" 주면 사람은 자기가 맞게 넣은 줄 압니다. */
  if (!m) m = /^(?:https?:\/\/)?open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|artist|show|episode)\/([A-Za-z0-9]+)/.exec(s);
  if (!m) return null;
  return 'https://open.spotify.com/embed/' + m[1] + '/' + m[2];
}

/* 새 탭으로 열 주소. embed 주소에서 `/embed` 만 뺍니다 — spotifyEmbed 가
   이미 종류와 id 만 뽑아 우리 손으로 다시 지은 주소라, 여기 오는 것은
   언제나 https://open.spotify.com/… 입니다. javascript: 같은 것은 그
   앞에서 이미 null 이 되어 여기까지 못 옵니다. 이 갈림길이 없으면
   window.open 에 사람이 붙여 넣은 글자가 그대로 들어갑니다. */
export function spotifyLink(raw) {
  const e = spotifyEmbed(raw);
  return e && e.replace('/embed/', '/');
}

/* ---- 구글 캘린더 ----
   "웹에 공개" 로 만든 달력만 embed 로 열립니다. 비공개 달력은 로그인
   화면이 뜨는데, iframe 안에서는 구글이 로그인을 막으므로 빈 칸이 됩니다.
   그래서 주소를 받는 자리에 그 조건을 같이 적어 둡니다.

   받아 주는 꼴 넷 — 캘린더 ID(xxx@group.calendar.google.com) · 구글이 주는
   embed 주소 · <iframe …> 통째 · 설정에 있는 "공유 가능한 링크"(cid=base64).

   2D 판은 embed 주소를 **그대로 돌려주었습니다.** 호스트는 맨 앞에서
   확인하니 남의 서버로 새지는 않지만, 물음표 뒤는 붙여 넣은 사람이 쓴
   글자 그대로였습니다. 여기서는 그 주소에서도 캘린더 ID 만 뽑아 다시
   짓습니다 — 받는 꼴은 똑같고, 나가는 주소만 우리 것이 됩니다. */
const CAL_ID = /^[\w.#+-]+@[\w.-]+$/;
/* 캘린더 ID 에는 # 이 들어갑니다 — 구글이 주는 공휴일 달력이
   ko.south_korea#holiday@group.v.calendar.google.com 꼴입니다.
   처음에 # 을 빼고 짰다가 그 달력이 통째로 거절됐습니다. */
function calendarIds(raw) {
  const s = String(raw || '').trim();
  if (!s) return [];
  /* <iframe src="..."> 를 통째로 붙여 넣는 사람이 많아서 그것도 받습니다.
     안에서 찾는 것도 calendar.google.com 의 embed 주소뿐이라, src 가 둘
     붙어 있어도 남의 주소를 주워 오지 않습니다. */
  const inFrame = /src="(https:\/\/calendar\.google\.com\/calendar\/embed\?[^"]+)"/.exec(s);
  if (inFrame) return calendarIds(inFrame[1].replace(/&amp;/g, '&'));
  if (/^https:\/\/calendar\.google\.com\/calendar\/embed\?/.test(s)) {
    /* src 가 여럿일 수 있습니다(달력 두세 개를 겹쳐 보는 주소). 전부
       꺼내되, 캘린더 ID 꼴이 아닌 것은 버립니다. */
    const ids = [];
    const re = /[?&]src=([^&#\s]+)/g;
    let m;
    while ((m = re.exec(s))) {
      let id = '';
      try { id = decodeURIComponent(m[1]); } catch { id = m[1]; }
      if (CAL_ID.test(id) && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }
  /* **"공유 가능한 링크" 도 받습니다.**
     구글 캘린더 설정의 "공유 가능한 내 캘린더 링크" 는
       https://calendar.google.com/calendar/u/0?cid=<base64>
     꼴이고, cid 는 캘린더 ID 를 base64 로 감싼 것입니다. 사람들이 가장
     쉽게 찾는 링크가 이것인데 여태 통째로 거절당했습니다 — 형식이 틀린
     것이 아니라 **우리가 못 읽은 것**이라, 풀어서 받습니다.

     다만 이 링크는 "내 캘린더에 추가" 용이라, 그 달력이 비공개면 풀어도
     iframe 은 여전히 빈 칸입니다. 그 경우는 창의 안내 문구가 맡습니다 —
     주소를 못 읽는 것과 달력이 비공개인 것은 다른 문제이고, 둘을 같은
     오류로 뭉뚱그리면 사람이 주소만 계속 바꿔 넣게 됩니다.

     호스트는 여기서도 맨 앞에 못박습니다. 스포티파이와 같은 이유예요 —
     아무 주소에서나 cid 를 주워 오면, 엉뚱한 곳에서 복사해 온 링크를
     말없이 달력으로 "고쳐" 주게 됩니다. */
  const cid = /^(?:https?:\/\/)?calendar\.google\.com\/[^\s]*[?&]cid=([^&#\s]+)/.exec(s);
  if (cid) {
    try {
      /* base64url 로 오는 경우가 있어 -_ 를 +/ 로 되돌리고 padding 을 채웁니다 */
      const b = cid[1].replace(/-/g, '+').replace(/_/g, '/');
      const id = atob(b + '='.repeat((4 - b.length % 4) % 4));
      if (CAL_ID.test(id)) return [id];
    } catch { /* base64 가 아니면 아래 규칙으로 흘려보냅니다 */ }
    return [];
  }
  return CAL_ID.test(s) ? [s] : [];
}
export function calendarEmbed(raw) {
  const ids = calendarIds(raw);
  if (!ids.length) return null;
  /* 아젠다(목록)로 엽니다. 창이 470px 이라 월 달력을 넣으면 글자가 안
     읽히고, 이 창을 여는 이유도 "오늘 뭐가 있나" 하나입니다. */
  return 'https://calendar.google.com/calendar/embed?ctz=Asia%2FSeoul&mode=AGENDA'
    + ids.map((id) => '&src=' + encodeURIComponent(id)).join('');
}

/* 창 안에 끼우는 바깥 화면 한 칸.

   **안 뜨는 것을 안 뜬다고 말하는 것**이 이 함수의 전부입니다. iframe 은
   교차 출처라 안에서 무슨 일이 났는지 알 수 없고, 차단당해도 onload 가
   그냥 뜨는 경우가 있습니다. 그래서 시간을 재고, 시간 안에 아무 일도 안
   일어나면 "지금은 못 불러옵니다" 로 바꿉니다. 흰 칸을 그냥 두면 사람은
   자기 인터넷을 의심하며 기다립니다.

   높이를 380px 로 못박는 이유 — 안이 교차 출처라 내용에 맞춰 늘릴 수가
   없고, 안 정하면 0px 로 접힙니다. 380 은 플레이리스트와 일정 목록이
   둘 다 한눈에 들어오는 높이입니다. */
function embedHtml(src, label) {
  /* 인터넷이 꺼져 있는 줄 아는 경우에는 아예 안 만듭니다. 만들어 봐야
     6초 기다렸다 "못 불러왔어요" 가 되고, 그 사이 브라우저가 자기 오류
     페이지를 창 안에 띄웁니다.
     navigator.onLine 은 "랜선이 꽂혀 있나" 수준이라 false 일 때만 믿습니다 —
     true 인데 못 닿는 경우는 아래 watchEmbeds 가 시간으로 잡습니다. */
  if (navigator.onLine === false) {
    return `<p class="note">인터넷이 꺼져 있어요. 연결되면 창을 다시 열어 주세요.</p>`;
  }
  /* sandbox 를 안 겁니다. 두 가지 이유입니다.
     (1) 주소는 사람이 붙여 넣은 문자열이 아니라 **우리가 만든 것**입니다.
         spotifyEmbed·calendarEmbed 는 종류와 id 만 뽑아 주소를 다시 짓습니다.
         그래서 여기 들어오는 src 는 open.spotify.com 아니면
         calendar.google.com 둘 중 하나입니다 — 임의의 사이트를 띄우는
         창구가 아닙니다.
     (2) sandbox 를 걸면 저장소 접근이 막혀서 두 서비스가 자기 안에서
         SecurityError 를 냅니다. 스포티파이는 로그인 상태를 저장소로
         확인하므로, 막으면 전곡 재생이 30초 미리듣기로 떨어집니다.
     대신 allow 는 필요한 것만 켭니다.
     안내 글자는 화면 **뒤에** 깝니다(z-index 0). 앞에 두면 다 뜬 뒤에도
     글자가 얹혀 있고, 뒤에 두면 화면이 뜨는 순간 자연히 가려집니다. */
  return `<div class="embed" style="position:relative;margin:10px 0 6px;height:380px;
      border-radius:13px;overflow:hidden;background:rgba(34,42,51,.05);border:1.5px solid var(--pl)">
      <iframe title="${esc(label)}" src="${esc(src)}" loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
        style="position:relative;z-index:1;display:block;width:100%;height:100%;border:0"></iframe>
      <p class="embed-wait" style="position:absolute;inset:0;z-index:0;margin:0;display:flex;
        align-items:center;justify-content:center;padding:0 24px;text-align:center;
        font-size:12px;line-height:1.5;color:var(--ink2)">불러오는 중…</p>
    </div>`;
}

/* 창을 그린 뒤에 부릅니다. 뜨면 안내를 지우고, 안 뜨면 **iframe 을 치우고**
   정직하게 씁니다.

   왜 load 이벤트만으로는 안 되나 — 2D 판에서 실제로 겪은 일입니다.
   처음에는 iframe.onload 로 성공을 판정했습니다. 그런데 주소에 못 닿으면
   크로미움이 그 자리에 **자기 오류 페이지**를 넣고, 그것도 load 로 셉니다.
   그래서 "다 떴다" 며 안내를 지우고 회색 빈 칸만 남았습니다 — 정확히
   하지 말자고 한 그 화면입니다. 교차 출처라 안을 들여다볼 수도 없습니다.

   그래서 **따로 두드려 봅니다.** mode:'no-cors' 로 fetch 하면 내용은 못
   읽지만(opaque), 호스트에 닿았는지는 알 수 있습니다 — 닿으면 resolve,
   못 닿으면 reject 입니다. */
function watchEmbeds(root) {
  for (const box of root.querySelectorAll('.embed')) {
    const frame = box.querySelector('iframe');
    const wait = box.querySelector('.embed-wait');
    if (!frame || !wait) continue;
    let done = false;
    const fail = (text) => {
      if (done) return;
      done = true;
      /* 빈 칸을 남기지 않으려고 치웁니다. 380px 짜리 회색 판에 글자 한
         줄이 떠 있으면 아직 뭔가 오는 중처럼 보입니다. */
      frame.remove();
      box.style.height = 'auto';
      wait.style.position = 'static';
      wait.style.padding = '18px 20px';
      wait.textContent = text;
    };
    const good = () => { if (!done) { done = true; wait.remove(); } };
    fetch(frame.src, { mode: 'no-cors', cache: 'no-store' })
      .then(() => { /* 호스트가 답했습니다 — load 를 기다립니다 */ })
      .catch(() => fail('지금은 못 불러왔어요. 인터넷이 막혀 있거나 이 주소가 차단돼 있어요. 아래 “새 탭에서 열기” 로는 열릴 수 있어요.'));
    frame.addEventListener('load', () => setTimeout(good, 250));
    frame.addEventListener('error', () => fail('지금은 못 불러왔어요. 새 탭에서 열어 보세요.'));
    /* 6초. 느린 회선에서 성급하게 실패라고 하지 않을 만큼이면서,
       사람이 빈 칸을 보고 있기에는 이미 긴 시간입니다. */
    setTimeout(() => fail('지금은 못 불러왔어요. 주소가 공개가 아니거나 응답이 없어요.'), 6000);
  }
}

/* 주소를 받는 줄. 두 창이 같은 모양을 쓰므로 한 번만 적습니다. */
function linkRowHtml(id, cur, ok, place) {
  /* 안내 줄은 상자(.note)로 감싸지 않습니다. 할 말이 없을 때도 빈 상자가
     남아서, 아직 뭔가 오는 중처럼 보입니다. */
  return lbl('key', '주소')
    + `<input id="${id}" class="nick" placeholder="${esc(place)}" value="${esc(cur || '')}"
      autocomplete="off" spellcheck="false">
    <p class="lnkmsg" aria-live="polite"></p>
    <div class="wr"><button data-lnk="set" class="on">${ok ? '바꾸기' : '걸기'}</button>
      ${cur ? '<button data-lnk="clear">내리기</button>' : ''}</div>`;
}

/* 주소 칸 하나짜리 창의 공통 손잡이. onSet 은 넣은 글자가 읽히는
   주소면 true 를, 아니면 사람에게 할 말을 문자열로 돌려줍니다. */
function linkOn(root, again, id, onSet, onClear) {
  const bd = root.querySelector('.bd');
  bd.querySelectorAll('input').forEach((i) => { i.onkeydown = (e) => e.stopPropagation(); });
  watchEmbeds(bd);
  const msg = bd.querySelector('.lnkmsg');
  bd.onclick = (e) => {
    const b = e.target.closest('button[data-lnk]'); if (!b) return;
    if (b.dataset.lnk === 'clear') { onClear(); save(); again(); return; }
    const v = (bd.querySelector('#' + id)?.value || '').trim();
    const r = onSet(v);
    if (r !== true) { if (msg) msg.textContent = r; return; }
    save(); again();
  };
}

/** 강단 스피커 — 본관에서 트는 음악.
    ctx 는 없어도 됩니다. ctx.bgm 이 true 면 월드 배경음악이 지금 켜져
    있다는 뜻이라, 두 소리가 겹친다고 한 줄 적어 줍니다. */
export function radio(ctx) {
  const raw = SAVE.links.spotify;
  const src = spotifyEmbed(raw);
  const open = spotifyLink(raw);
  return {
    tag: '음악', title: '강단 스피커',
    html: (src
      ? embedHtml(src, '스포티파이 플레이어')
        + (open ? `<div class="note"><a href="${esc(open)}" target="_blank" rel="noopener">스포티파이에서 열기 ↗</a></div>` : '')
      : rw('music', 'lilac', '아직 아무것도 안 걸려 있어요',
        '본관에서 틀 플레이리스트 링크를 아래에 붙여 넣으세요'))
      + (ctx && ctx.bgm
        ? rw('bell', 'peach', '월드 배경음악이 켜져 있어요', '두 소리가 겹치면 마이페이지 설정에서 끄세요')
        : '')
      + linkRowHtml('lnkspot', raw, !!src, '플레이리스트 · 앨범 · 트랙 링크')
      + `<div class="cg two">${cb('music', '', '어디서 복사하나', '스포티파이 앱 → 플레이리스트 → 공유 → 링크 복사')}`
      + `${cb('key', 'lemon', '로그인하면 전곡', '로그인 안 한 브라우저에서는 30초 미리듣기만 나옵니다')}</div>`,
    on(root, again) {
      linkOn(root, again, 'lnkspot', (v) => {
        if (!v) { SAVE.links.spotify = ''; return true; }
        if (!spotifyEmbed(v)) return '스포티파이 링크가 아닌 것 같아요. open.spotify.com/playlist/… 또는 spotify:track:… 꼴이면 됩니다.';
        SAVE.links.spotify = v;
        return true;
      }, () => { SAVE.links.spotify = ''; });
    },
  };
}

/** 탁상 달력 — 기숙사 책상 위. ctx 는 없어도 됩니다. */
export function calendar(ctx) {
  const raw = SAVE.links.calendar;
  const src = calendarEmbed(raw);
  return {
    tag: '달력', title: '탁상 달력',
    html: (src
      ? embedHtml(src, '구글 캘린더')
        + `<div class="note"><a href="${esc(src)}" target="_blank" rel="noopener">새 탭에서 열기 ↗</a></div>`
      : rw('cal', 'lilac', '아직 아무것도 안 걸려 있어요',
        '강의 시간표는 노트북에 따로 있어요 — 이쪽은 강의가 아닌 약속입니다'))
      + linkRowHtml('lnkcal', raw, !!src, '캘린더 ID 또는 공유 링크')
      /* 안 뜨는 이유가 대개 "비공개" 라 그 한 가지만 남깁니다. 주소가
         틀린 것과 달력이 잠긴 것은 사람이 할 일이 다릅니다. */
      + `<div class="cg two">${cb('key', 'lemon', '공개로 켠 달력만',
        '캘린더 설정 → 액세스 권한 → 공개 사용 설정. 잠긴 달력은 구글이 창 안에서 로그인을 막아 빈 칸이 됩니다')}`
      + `${cb('board', 'sky', '뭘 붙여 넣나', '캘린더 ID · 공유 링크 · &lt;iframe …&gt; 조각 — 셋 다 읽습니다')}</div>`,
    on(root, again) {
      linkOn(root, again, 'lnkcal', (v) => {
        if (!v) { SAVE.links.calendar = ''; return true; }
        if (!calendarEmbed(v)) return '캘린더 주소를 못 읽었어요. 캘린더 ID(xxx@group.calendar.google.com)나 구글이 주는 공유 링크를 넣어 주세요.';
        SAVE.links.calendar = v;
        return true;
      }, () => { SAVE.links.calendar = ''; });
    },
  };
}

/** 기숙사 노트북 — 캘린더와 강의 시간표를 한 창의 탭 둘로 엽니다. */
export function schedule(ctx) {
  const tab = ctx.tab === 'timetable' ? 'timetable' : 'calendar';
  const active = tab === 'calendar' ? calendar() : timetable();
  return {
    tag: '노트북', title: '일정 관리', medium: true,
    html: `<div class="board-tabs schedule-tabs" role="tablist" aria-label="일정 관리 종류">
      <button type="button" role="tab" data-schedule-tab="calendar" class="${tab === 'calendar' ? 'on' : ''}"
        aria-selected="${tab === 'calendar'}">내 일정 · 구글 캘린더</button>
      <button type="button" role="tab" data-schedule-tab="timetable" class="${tab === 'timetable' ? 'on' : ''}"
        aria-selected="${tab === 'timetable'}">강의 시간표</button></div>
      <div class="schedule-view">${active.html}</div>`,
    on(root, again) {
      active.on?.(root, again);
      root.querySelector('.schedule-tabs').onclick = (e) => {
        const b = e.target.closest('button[data-schedule-tab]');
        if (!b || b.dataset.scheduleTab === tab) return;
        ctx.onTab(b.dataset.scheduleTab, again);
      };
    },
  };
}

/* ---------- 오늘의 기록 — 앉은 세션이 실제로 쌓입니다 ---------- */
export function records() {
  const S = SAVE.sessions.slice(-14).reverse();
  const total = SAVE.sessions.reduce((a, s) => a + s.sec, 0);
  const bad = SAVE.sessions.reduce((a, s) => a + s.bad, 0);
  const mm = (s) => `${Math.floor(s / 60)}분 ${Math.round(s % 60)}초`;
  if (!S.length) {
    return {
      tag: '기록', title: '오늘의 기록',
      html: rw('seat', 'lilac', '아직 앉은 기록이 없어요',
        '도서관이나 본관 자리 앞에서 E 를 누르면 세션이 시작됩니다'),
    };
  }
  const bars = S.map((s) => {
    const h = Math.max(4, Math.min(56, s.sec / 3));
    const c = s.bad > 4 ? '#E8695A' : s.bad > 1 ? '#F2C14E' : '#63C47C';
    return `<div class="bar" title="${mm(s.sec)} · 무너짐 ${s.bad}번">
      <i style="height:${h}px;background:${c}"></i></div>`;
  }).join('');
  return {
    tag: '기록', title: '오늘의 기록',
    html: `<div class="cg">${cc('clock', '', Math.floor(total / 60) + '분', '앉은 시간')}`
      + `${cc('heart', 'peach', bad, '무너진 횟수')}`
      + `${cc('seat', 'sky', SAVE.sessions.length, '세션')}</div>`
      + lbl('chart', '최근 세션')
      + `<div class="bars">${bars}</div>`
      + '<div class="note">막대 하나가 세션 하나입니다. 색이 붉을수록 오래 굽어 있었어요.</div>',
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
          <b>${esc(SAVE.nick || SAVE.species)}</b>
          <span>기린캠퍼스 · 26학번 · ${esc(SAVE.species)}</span>
          <span>${esc(SAVE.school || '학교 미설정')}</span>
        </div>
      </div>
      <div class="cg two">${cc('clock', '', Math.floor(total / 60) + '분', '누적 앉은 시간')}`
      + `${cc('coin', 'lemon', SAVE.coins, '가진 코인')}</div>`
      + rw('shirt', 'lilac', '종과 옷 바꾸기', '어디서든 C 를 누르면 옷장이 열립니다', 'C'),
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
    html: rw('coin', 'lemon', '내 코인', '', SAVE.coins)
      + lbl('shirt', '오늘의 옷')
      + `<div class="buys">${items}</div>`,
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
  ['링커리어', '공모전 · 대외활동', 'https://linkareer.com/list/contest'],
  ['올콘', '공모전 · 대회', 'https://www.all-con.co.kr/'],
  ['위비티', '공모전 · 서포터즈', 'https://www.wevity.com/'],
  ['캠퍼스픽', '대학생 공모전', 'https://www.campuspick.com/contest'],
];
/**
 * 학교 공지 — `/api/notice` 가 학교 RSS 를 받아 옵니다(2D 판과 같은 함수).
 * rows 가 undefined 면 "받는 중", null 이면 "못 받았음" 입니다.
 */
export function notices(kind, rows, meta = {}) {
  if (kind !== 'school') {
    /* 왜 목록을 안 가져오는지는 약관과 판례까지 적어 두었었습니다. 그건
       만드는 쪽의 사정이고, 여기 온 사람은 공고를 보러 온 것입니다.
       한 줄로 줄이고 자리는 링크에 내줍니다. */
    /* 넷을 서로 다른 색으로 칠해 봤는데, 색이 아무 뜻도 없어 그냥
       알록달록해지기만 했습니다. 넷 다 같은 것(바깥 사이트)이라 한 색입니다.
       줄마다 같은 설명을 달던 것도 뺍니다 — 네 번 읽을 문장이 아닙니다. */
    return {
      tag: '공고', title: '대외활동 · 공모전',
      html: '<div class="board-head"><span class="ic sky">' + pic('ticket') + '</span>'
        + '<div><b>대외활동 · 공모전</b><br><span>참여하려는 분야의 공식 목록을 엽니다.</span></div></div>'
        + BOARD_LINKS.map(([n, d, u]) =>
        `<a class="rw" href="${esc(u)}" target="_blank" rel="noopener">
          <span class="ic sky">${pic('ticket')}</span>
          <span class="t">${esc(n)}<em>${esc(d)}</em></span>
          <span class="v">참여하기 ↗</span></a>`).join('')
        + '<div class="note">공고 원문과 지원은 각 서비스에서 진행합니다.</div>',
    };
  }
  let body;
  const school = meta.school || '';
  if (!school) {
    body = rw('board', 'peach', '학교를 먼저 설정해 주세요', 'MY의 내 정보에서 학교를 고르면 이 게시판이 바뀝니다');
  } else if (rows === undefined) body = rw('board', 'sky', '학교 공지를 받아 오는 중이에요', school);
  else if (!rows || !rows.length) {
    body = rw('board', 'peach', '목록을 직접 받아오지 못했어요', meta.reason || '학교 공식 게시판에서 확인할 수 있습니다')
      + (meta.page ? `<a class="rw" href="${esc(meta.page)}" target="_blank" rel="noopener">
          <span class="ic sky">${pic('board')}</span><span class="t">${esc(school)} 공식 공지<em>학교가 운영하는 원문 게시판</em></span>
          <span class="v">열기 ↗</span></a>` : '');
  } else {
    body = `<div class="board-head"><span class="ic sky">${pic('board')}</span><div>
        <b>${esc(meta.name || school)} 공지</b><br><span>학교가 공개한 목록을 그대로 가져옵니다.</span></div></div>`
      + `<ul class="feed">${rows.slice(0, 12).map((r) =>
      `<li><b>${esc(r.date || r.at || '')}</b><span>${r.link
        ? `<a href="${esc(r.link)}" target="_blank" rel="noopener">${esc(r.title)}</a>`
        : esc(r.title)}</span></li>`).join('')}</ul>`;
  }
  return { tag: '공지', title: '학교 공지사항', html: body };
}

/** 분수 옆 게시판 둘이 함께 여는 한 창. 처음 누른 판에 맞춰 탭만 다릅니다. */
export function campusBoard(ctx) {
  const view = notices(ctx.tab === 'school' ? 'school' : 'out', ctx.rows, ctx.meta);
  return {
    tag: '공지 · 공고', title: '캠퍼스 게시판', wide: true,
    html: `<div class="board-tabs" role="tablist" aria-label="게시판 종류">
      <button type="button" role="tab" data-board-tab="school" class="${ctx.tab === 'school' ? 'on' : ''}"
        aria-selected="${ctx.tab === 'school'}">학교 공지</button>
      <button type="button" role="tab" data-board-tab="out" class="${ctx.tab === 'out' ? 'on' : ''}"
        aria-selected="${ctx.tab === 'out'}">대외활동 · 공모전</button></div>
      <div class="board-view">${view.html}</div>`,
    on(root, again) {
      root.querySelector('.board-tabs').onclick = (e) => {
        const b = e.target.closest('button[data-board-tab]'); if (!b || b.dataset.boardTab === ctx.tab) return;
        ctx.onTab(b.dataset.boardTab, again);
      };
    },
  };
}

/* ---------- 아직 2D 월드에 있는 것 ----------
   자리 설명 한두 줄이 전부인 창입니다. 줄글 두 문단으로 흘리면 창을 연
   보람이 없어서, 첫 줄을 제목으로 세우고 나머지를 그 아래 작은 글씨로
   붙입니다 — 줄 하나면 눈이 한 번에 받습니다. */
export function stub(tag, title, body) {
  const lines = (body || []).map((t) => String(t).trim()).filter(Boolean);
  const head = lines.length ? esc(lines[0]) : '여기는 아직 설명이 없어요.';
  const rest = lines.slice(1).map(esc).join(' ');
  return { tag, title, html: rw('map', 'lilac', head, rest) };
}

/* ══════════════════════════════════════════════════════════
   상점 · 식당 · 자판기 · 인형뽑기 · 명예의 전당 · 방 꾸미기
   전부 **실제로 도는** 창입니다 — 코인이 줄고, 산 것이 남고,
   서버(world_buy_item)가 붙어 있으면 서버 잔액이 정답입니다.
   ══════════════════════════════════════════════════════════ */
const won = (n) => (n === 0 ? '무료' : n + '코인');
/* 상점 창은 전부 이 줄로 시작합니다. 값을 보기 전에 얼마가 있는지부터
   보여야 "살 수 있나" 를 머리로 안 세게 됩니다. 두 번째 인자는 서버가
   세는 잔액인지 여부 — 예전에는 여기에 HTML 조각을 그대로 넘겼습니다. */
const coinbar = (coins, server) =>
  `<div class="coinbar">${rw('coin', 'lemon', '내 코인', server ? '서버가 세는 잔액이에요' : '', coins)}</div>`;

/* 옷 카드의 실제 그림은 shopview.js의 공유 WebGL 판이 그립니다.
   카드마다 컨텍스트를 만들지 않고 판 하나를 나눠 쓰므로 월드와 충돌하지
   않으며, 각 칸에는 캐릭터 없이 옷 조형만 클레이 3D로 보입니다. */
function wearArt(id, slot, label, schoolColor) {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const pal = ['#E86F61','#3E78B7','#2FAF98','#846AC5','#E6A53A','#59687E','#D66F9A'];
  const schoolHex = typeof schoolColor === 'number'
    ? '#' + schoolColor.toString(16).padStart(6, '0') : schoolColor;
  const c = id === 'varsity' ? (schoolHex || '#3E78B7') : pal[h % pal.length];
  const dark = '#263548', light = '#F7FBFF';
  const top = `<path d="M37 22 50 14l13 8 17 7-8 17-10-5v35H38V41l-10 5-8-17z" fill="${c}"/><path d="M44 18q6 10 12 0" fill="none" stroke="${light}" stroke-width="5" stroke-linecap="round"/><path d="M50 29v45" stroke="${dark}" stroke-opacity=".25" stroke-width="3"/>`;
  const bottom = `<path d="M35 20h30l7 56H54l-4-35-4 35H28z" fill="${c}"/><path d="M35 28h30" stroke="${light}" stroke-opacity=".7" stroke-width="4"/>`;
  const shoes = `<path d="M18 55q13 0 22-17l12 10-7 19H18zM58 55q13 0 22-17l12 10-7 19H58z" fill="${c}"/><path d="M20 67h27M60 67h27" stroke="${dark}" stroke-width="5" stroke-linecap="round"/>`;
  const hat = `<path d="M28 53q2-28 22-28t22 28z" fill="${c}"/><path d="M18 55h64q-7 10-32 10T18 55" fill="${dark}"/>`;
  const glasses = `<g fill="none" stroke="${c}" stroke-width="7"><rect x="17" y="36" width="27" height="22" rx="9"/><rect x="56" y="36" width="27" height="22" rx="9"/><path d="M44 44h12M17 42 8 37M83 42l9-5"/></g>`;
  const bag = `<path d="M27 35q0-17 23-17t23 17" fill="none" stroke="${dark}" stroke-width="7"/><rect x="20" y="31" width="60" height="47" rx="13" fill="${c}"/><path d="M30 52h40" stroke="${light}" stroke-opacity=".7" stroke-width="4"/>`;
  const body = ({ top, bottom, shoes, hat, glasses, bag })[slot] || top;
  return `<svg class="wear-art" viewBox="0 0 100 92" role="img" aria-label="${esc(label)} 상품 미리보기"><ellipse cx="50" cy="82" rx="33" ry="5" fill="#71839A" opacity=".18"/>${body}<path d="M18 13h64" stroke="#fff" stroke-opacity=".45" stroke-width="3" stroke-linecap="round"/></svg>`;
}

/** 옷 가게 — 사는 곳. 입는 것은 옷장(C)에서 합니다 */
export function wearShop(ctx) {
  /* 세 번째 칸은 머리글에 달 그림입니다 — 여섯 줄이 글자만 있으면
     어느 줄이 신발이었는지 매번 다시 읽게 됩니다. */
  const SLOT = [['top', '상의', 'shirt'], ['bottom', '하의', 'seat'], ['shoes', '신발', 'run'],
    ['hat', '모자', 'sun'], ['glasses', '안경', 'cam'], ['bag', '가방', 'book']];
  const cats = ctx.rides ? [...SLOT, ['ride', '탈것', 'bus']] : SLOT;
  const active = cats.some(([k]) => k === ctx.category) ? ctx.category : 'top';
  const [slot, nm, ic] = cats.find(([k]) => k === active);
  const itemHtml = active === 'ride'
    ? (ctx.rides || []).map(([id, label, price, mult]) => {
        const own = (ctx.ownedRide || []).includes(id);
        return `<button class="cc ${own ? 'on' : ''}" data-rbuy="${esc(id)}" ${own ? 'disabled' : ''}>
          <span class="th" style="width:100%;height:88px"></span><b>${esc(label)}</b>
          <small>걷기 ×${mult.toFixed(2)} · ${own ? '가지고 있어요' : won(price)}</small></button>`;
      }).join('')
    : (() => {
      /* 글자만 있던 칩을 카드로 바꿉니다. `.th` 는 비워 두고 부르는 쪽이
         3D 그림을 그려 넣습니다 — 옷은 모양이 값보다 먼저 궁금한 물건이라
         이름만 적어 두면 뭘 사는지 모르고 삽니다. */
      /* **카드를 누르면 사던 것을 입어보는 것으로 바꿨습니다.** 사기 전에
         입어 보는 것이 옷 가게가 하는 일이고, 사는 것은 그 다음입니다.
         전에는 마우스를 올렸을 때만 잠깐 보이고 떼면 사라져서, 둘을 겹쳐
         입어 보거나 하나만 벗어 볼 방법이 아예 없었습니다.
         `none`(없음)도 카드로 냅니다 — 벗는 것도 골라 보는 일입니다. */
      const tried = ctx.tryOn || {};
      return ctx.wear[slot].map(([id, label, price]) => {
          const own = ctx.owned.includes(id) || price === 0;
          const on = tried[slot] && tried[slot].id === id;
          const none = id === 'none';
          return `<button class="cc ${own ? 'on' : ''}" data-try="${esc(id)}" data-slot="${esc(slot)}"
            aria-pressed="${on ? 'true' : 'false'}" data-owned="${own ? '1' : '0'}">
            <span class="th wear-product" style="width:100%;height:118px" ${none ? '' : `data-wear-art="${esc(id)}"`} aria-label="${esc(label)} 3D 클레이 미리보기">
              <i class="wear-chip">${none ? '벗기' : '3D CLAY'}</i></span>
            <b>${esc(label)}</b><small>${none ? '이 칸 비우기' : (own ? '가지고 있어요' : won(price))} · ${on ? '입는 중' : '입어보기'}</small></button>`;
        }).join('');
    })();

  /* ── 입어보는 중 ──
     오른쪽 칸이 하던 말이 "구매해도 여기서 바로 장착되지는 않습니다" 였습니다.
     창이 할 수 있는 일을 스스로 줄여 놓은 문장이었습니다. 여기서 입고 삽니다. */
  const tried = ctx.tryOn || {};
  const nameOf = (sl) => (SLOT.find(([k]) => k === sl) || [, sl])[1];
  const worn = Object.entries(tried).filter(([, v]) => v && v.id !== 'none');
  const emptied = Object.entries(tried).filter(([, v]) => v && v.id === 'none');
  const unowned = worn.filter(([, v]) => !v.own);
  const cost = unowned.reduce((s, [, v]) => s + (v.price || 0), 0);
  const tryList = (worn.length || emptied.length)
    ? '<ul class="try-list">'
      + worn.map(([sl, v]) => `<li><b>${esc(v.label)}</b><em>${v.own ? '가진 것' : won(v.price)}</em>
          <button data-try-off="${esc(sl)}" aria-label="${esc(v.label)} 벗기">벗기</button></li>`).join('')
      + emptied.map(([sl]) => `<li><b>${esc(nameOf(sl))} 비움</b><em>—</em>
          <button data-try-off="${esc(sl)}" aria-label="${esc(nameOf(sl))} 되돌리기">되돌리기</button></li>`).join('')
      + '</ul>'
    : '<p class="try-empty">상품을 누르면 여기 캐릭터가 바로 입습니다. 여러 개를 같이 입어 볼 수 있어요.</p>';
  const acts = (worn.length || emptied.length)
    ? '<div class="try-acts">'
      + (unowned.length
          ? `<button class="try-main" data-try-buy>${unowned.length}벌 사고 입기 · ${won(cost)}</button>`
          : '<button class="try-main" data-try-apply>이대로 입기</button>')
      + '<button data-try-clear>전부 벗기</button></div>'
    : '';

  const gallery = active === 'ride' ? `<div class="cg">${itemHtml}</div>`
    : `<div class="wear-gallery"><div class="cg">${itemHtml}</div><aside class="wear-preview-card">
        <div class="wear-preview-stage" aria-label="내 캐릭터 옷 입어보기"></div>
        <b>입어보는 중</b>${tryList}${acts}
      </aside></div>`;
  const html = `<div class="shop-layout"><nav class="shop-tabs" aria-label="옷 가게 카테고리">`
    + cats.map(([k, label]) => `<button type="button" data-shop-cat="${k}" class="${k === active ? 'on' : ''}">${label}</button>`).join('')
    + `</nav><section class="shop-main">${coinbar(ctx.coins, ctx.server)}${lbl(ic, nm)}${gallery}`
    + rw('shirt', 'lilac', '입어 보고 사요', '카드를 누르면 오른쪽 캐릭터가 입습니다. 옷장(C)에서도 갈아입어요', 'C')
    + '</section></div>';
  return {
    tag: '동아리 상점', title: '옷 가게', html, wide: true, shop: true,
    on(root, again) {
      const bd = root.querySelector('.bd');
      /* 마우스를 올렸을 때 보여 주던 것을 뗐습니다. 눌러서 입는 것과
         올려서 보는 것이 같이 있으면, 입어 둔 것이 마우스가 지나갈 때마다
         덮여서 무엇을 입고 있는지 알 수 없습니다. */
      bd.onclick = (e) => {
        const cat = e.target.closest('button[data-shop-cat]');
        if (cat) { ctx.onCategory(cat.dataset.shopCat, again); return; }
        const r = e.target.closest('button[data-rbuy]');
        if (r && !r.disabled) { ctx.onBuyRide?.(r.dataset.rbuy, again); return; }
        const off = e.target.closest('button[data-try-off]');
        if (off) { ctx.onTry?.(null, off.dataset.tryOff, again); return; }
        if (e.target.closest('button[data-try-clear]')) { ctx.onTryClear?.(again); return; }
        if (e.target.closest('button[data-try-buy]')) { ctx.onTryBuy?.(again); return; }
        if (e.target.closest('button[data-try-apply]')) { ctx.onTryApply?.(again); return; }
        const b = e.target.closest('button[data-try]');
        if (b) ctx.onTry?.(b.dataset.try, b.dataset.slot, again);
      };
    },
  };
}

/** 가구 목록 — 기숙사에 놓는 것들 */
/* ── 가구 표 ──
   **이 파일에 둡니다.** 처음에는 room.js 에 두고 여기서 import 했는데,
   room.js 는 three.js 를 씁니다. ui.js 는 3D 월드와 2D 아이소메트릭 월드가
   **같이 쓰는 파일**이라, 그 순간 2D 판이 "three 를 못 찾겠다" 며 통째로
   안 열렸습니다. 표는 글자와 값일 뿐이고, 파는 일은 이 파일 몫입니다.
   짓는 일은 room.js 의 buildFurn 이 id 로 받습니다.

   id 는 2D 판 아이템 표와 같은 것을 씁니다 — 서버 구매(world_buy_item)가
   두 판에서 하나로 이어져야 하므로 여기서 새 이름을 지으면 안 됩니다. */
export const FURN_MORE = [
  ['fur-cushion',   '방석',          25, '🟥'],
  ['fur-rug-round', '둥근 러그',     45, '⭕'],
  ['fur-beanbag',   '빈백',          70, '🛋'],
  ['fur-chair',     '나무 의자',     35, '🪑'],
  ['fur-sidetable', '협탁',          40, '🧰'],
  ['fur-shelf',     '낮은 책장',     50, '📕'],
  ['fur-drawers',   '서랍장',        60, '🗄'],
  ['fur-laundry',   '빨래바구니',    30, '🧺'],
  ['fur-suitcase',  '캐리어',        45, '🧳'],
  ['fur-fridge',    '냉장고',        80, '🧊'],
  ['fur-fan',       '선풍기',        40, '🌀'],
  ['fur-tv',        '브라운관 TV',   75, '📺'],
  ['fur-mirror',    '전신 거울',     55, '🪞'],
  ['fur-fishtank',  '어항',          65, '🐟'],
  ['fur-dumbbell',  '아령',          25, '🏋'],
  ['fur-cattower',  '캣타워',        85, '🐈'],
  ['fur-plant2',    '큰 화분',       55, '🌿'],
  ['fur-floorlamp', '플로어 스탠드', 50, '🏮'],
];

/* 여섯은 처음부터 있던 것이고, 뒤엣것은 room.js 가 짓습니다.
   id 는 2D 판 아이템 표와 같은 것을 씁니다 — 서버 구매(world_buy_item)가
   두 판에서 하나로 이어져야 하므로 여기서 새 이름을 지으면 안 됩니다.
   네 번째 칸은 상점에 보여 줄 글자입니다. */
export const FURN = [
  ['plant', '화분', 30, '🪴'], ['lamp2', '스탠드', 40, '💡'], ['rug2', '깔개', 40, '🟫'],
  ['books2', '책 더미', 20, '📚'], ['guitar2', '기타', 80, '🎸'], ['bear', '곰인형', 60, '🧸'],
  ...FURN_MORE,
];
const FURN_CATS = [
  ['seat', '앉기', ['fur-cushion', 'fur-beanbag', 'fur-chair']],
  ['floor', '바닥', ['rug2', 'fur-rug-round']],
  ['storage', '수납', ['fur-sidetable', 'fur-shelf', 'fur-drawers', 'fur-suitcase']],
  ['living', '살림', ['fur-laundry', 'fur-fridge', 'fur-fan', 'fur-mirror']],
  ['hobby', '취미', ['books2', 'guitar2', 'bear', 'fur-tv', 'fur-fishtank', 'fur-dumbbell', 'fur-cattower']],
  ['green', '초록·불', ['plant', 'fur-plant2', 'lamp2', 'fur-floorlamp']],
];
export function furnShop(ctx) {
  /* 가구 그림은 그림문자 그대로 둡니다 — 스물넷이 다 다른 물건이라
     한 벌짜리 픽토그램으로는 서랍장과 냉장고가 같은 그림이 됩니다.
     대신 담는 그릇은 칸(.cc)으로 바꿔, 다른 창과 같은 재질이 됩니다.
     레몬색은 **이미 가진 것** 입니다 — 이 창에서 색은 그 한 가지 뜻입니다. */
  const active = FURN_CATS.some(([k]) => k === ctx.category) ? ctx.category : 'seat';
  const cat = FURN_CATS.find(([k]) => k === active);
  const items = cat[2].map((id) => FURN.find(([q]) => q === id)).filter(Boolean);
  const html = `<div class="shop-layout"><nav class="shop-tabs" aria-label="가구 가게 카테고리">`
    + FURN_CATS.map(([k, label]) => `<button type="button" data-shop-cat="${k}" class="${k === active ? 'on' : ''}">${label}</button>`).join('')
    + `</nav><section class="shop-main">${coinbar(ctx.coins)}${lbl('sofa', cat[1])}<div class="cg">`
    + items.map(([id, nm, price]) => {
      const n = ctx.furn[id] || 0;
      return `<button class="cc" data-fbuy="${esc(id)}">
        <span class="th" style="width:100%;height:88px"></span>
        <b>${esc(nm)}</b><small>${won(price)}${n ? ` · 가진 것 ${n}개` : ''}</small></button>`;
    }).join('') + '</div>'
    + rw('map', 'lilac', '산 가구는 기숙사에서 놓아요', '방 꾸미기 게시판에서 자리를 잡습니다')
    + '</section></div>';
  return {
    tag: '동아리 상점', title: '가구 가게', html, wide: true, shop: true,
    on(root, again) {
      root.querySelector('.bd').onclick = (e) => {
        const cat = e.target.closest('button[data-shop-cat]');
        if (cat) { ctx.onCategory(cat.dataset.shopCat, again); return; }
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
  const html = `<div class="shop-layout"><nav class="shop-tabs"><button type="button" class="on">알</button></nav>
    <section class="shop-main">${coinbar(ctx.coins)}`
    + (ctx.egg ? rw('clock', 'peach', `${esc(ctx.egg.species || '새 동물')} 알을 품는 중`, '월드를 돌아다녀도 됩니다', `${left}초`) : '')
    + lbl('egg', '알') + '<div class="cg">'
    + ctx.allSp.map((species) => {
      const own = ctx.ownedSp.includes(species), busy = !!ctx.egg;
      return `<button class="cc ${own ? 'on' : ''}" data-egg="${esc(species)}" ${own || busy ? 'disabled' : ''}>
        <span class="th" style="width:100%;height:96px"></span><b>${esc(species)} 알</b>
        <small>${own ? '이미 함께하고 있어요' : busy ? '다른 알을 품는 중' : '40코인'}</small></button>`;
    }).join('') + '</div>'
    + (locked.length ? rw('shirt', 'lemon', '깨어난 종은 옷장에서 골라요', '어디서든 C', 'C')
      : rw('heart', 'lemon', '여덟 종이 모두 깨어났어요', '모든 친구가 함께합니다'))
    + '</section></div>';
  return {
    tag: '동아리 상점', title: '알 가게', html, wide: true, shop: true,
    on(root, again) {
      root.querySelector('.bd').onclick = (e) => {
        const b = e.target.closest('button[data-egg]'); if (!b || b.disabled) return;
        ctx.onBuy(b.dataset.egg, again);
      };
    },
  };
}

/** 학교별 실제 학식. 메뉴를 지어내거나 게임 코인으로 사지 않습니다. */
export function cafeteria(ctx) {
  const d = ctx.data;
  let body;
  if (!ctx.school) {
    body = rw('board', 'lilac', '학교를 먼저 설정해 주세요', 'MY의 내 정보에서 학교를 고르면 식단이 바뀝니다');
  } else if (d === undefined) {
    body = rw('cup', 'lemon', '오늘 식단을 확인하는 중…', `${esc(ctx.school)} 공식 식단 페이지에 묻고 있어요`);
  } else if (d && Array.isArray(d.items) && d.items.length) {
    body = lbl('cup', `${esc(d.name || ctx.school)} · ${esc(d.date || '오늘')}`)
      + '<div class="meal-list">' + d.items.map((it) => {
        const menu = Array.isArray(it.menu) ? it.menu.join(' · ') : String(it.menu || '');
        return rw('cup', it.meal === '저녁' ? 'lilac' : it.meal === '아침' ? 'lemon' : 'peach',
          esc(it.place || it.meal || '학생식당'), esc(menu), esc(it.meal || ''));
      }).join('') + '</div>';
  } else {
    body = rw('cup', 'lilac', '오늘 식단을 자동으로 받지 못했어요',
      esc(d?.reason || '학교가 공개 API나 읽을 수 있는 공식 식단표를 제공하지 않습니다'));
  }
  if (d?.page) body += `<div class="note"><a href="${esc(d.page)}" target="_blank" rel="noopener">${esc(ctx.school || '학교')} 공식 식단표에서 확인 ↗</a></div>`;
  return {
    tag: '학교 식단', title: '오늘의 학식', html: body
      + '<div class="note">메뉴와 가격은 학교가 공개한 공식 식단표 기준이며, 식자재 사정으로 현장에서 바뀔 수 있어요.</div>',
  };
}
export function vending(ctx) {
  const DRINK = [['이온음료', 4, '🥤'], ['딸기우유', 4, '🥛'], ['커피', 5, '☕'], ['보리차', 3, '🍵']];
  return {
    tag: '자판기', title: '음료 자판기', html: coinbar(ctx.coins)
      + lbl('cup', '음료')
      + '<div class="cg">' + DRINK.map(([nm, price, e]) =>
        `<button class="cc" data-menu="${esc(nm)}" data-price="${price}">
          <span class="ic sky"><span class="big">${e}</span></span>
          <b>${esc(nm)}</b><small>${price}코인</small></button>`).join('') + '</div>',
    on(root, again) {
      root.querySelector('.bd').onclick = (e) => {
        const b = e.target.closest('button[data-menu]'); if (!b) return;
        ctx.onBuy(b.dataset.menu, +b.dataset.price, again);
      };
    },
  };
}

/** 이벤트 선물 뽑기 — 당첨 즉시 보관함에 들어갑니다 */
export function claw(ctx) {
  const reveal = ctx.prize
    ? `<div class="gift-reveal"><span>🎁</span><b>${esc(ctx.prize.title)}</b><small>${esc(ctx.prize.desc)}</small></div>` : '';
  return {
    tag: '기간 이벤트', title: '희귀 선물 뽑기', html: coinbar(ctx.coins)
      + reveal
      + `<div class="cg two">${cc('ticket', 'lemon', 30, '한 번 (코인)')}`
      + `${cb('heart', 'peach', '꽝은 없어요', '희귀 알 · 보너스 티켓 · 한정 가구가 바로 들어옵니다')}</div>`
      + '<div class="wr"><button data-claw="1">선물 상자 열기 (30코인)</button></div>'
      + rw('user', 'lilac', '당첨 즉시 내 것이 돼요', '알은 옷장에, 가구는 기숙사 방 꾸미기에 표시됩니다'),
    on(root, again) {
      root.querySelector('.bd').onclick = (e) => {
        const b = e.target.closest('button[data-claw]'); if (!b) return;
        ctx.onPlay(again);
      };
    },
  };
}

/* ══════════════════════════════════════════════════════════
   명예의 전당 — 학교끼리 겨룹니다

   3D 로 옮길 때 여기는 "1위 · 학교 — 12.3점" 한 줄짜리 목록이었습니다.
   2D 판에 있던 것 넷이 그때 빠졌고, 넷 다 빠지면 안 되는 것이었습니다.

     하나  **하한 미달 학교를 따로 세웁니다.** 참여자 스무 명을 못 넘긴
           학교를 목록에서 지워 버리면, 그 학교 사람은 자기 기록이 어디로
           갔는지 알 수 없습니다. 순위 밖에 두되 몇 명 남았는지는 보입니다.
     둘    **역대 시즌 1위.** 이번 시즌만 보이면 시즌이 끝날 때 아무 일도
           안 일어난 것이 됩니다.
     셋    **학교 색.** 이름만 열 줄이면 우리 학교를 눈으로 못 찾습니다.
     넷    **못 받은 이유를 갈라서 씁니다.** 서버가 없는 판본 · 못 닿음 ·
           로그인 풀림 · 서버 오류는 사람이 할 일이 다 다릅니다. 넷에 같은
           말을 하면 기다려야 하는지 다시 열어야 하는지 알 수 없습니다.

   숫자는 전부 서버가 준 것입니다. 못 받았으면 **못 받았다고 씁니다** —
   지어낸 순위를 보여 주느니 빈 자리를 보여 줍니다.
   ══════════════════════════════════════════════════════════ */

/* 학교 색 표는 **여기 두지 않습니다.** index.html 이 이미 갖고 있고
   (과잠 띠와 이름줄이 같은 표를 씁니다), 같은 표를 두 곳에 적으면 한 곳만
   고치는 날이 옵니다 — 가구 표에서 이미 겪은 일입니다. ctx.schoolColor 로
   받고, 안 주면 무채색 하나로 칠합니다.

   받은 색을 그대로 쓰지는 않습니다. 학교 상징색은 대개 아주 어두워서
   (#00468B 같은 것들) 흰 종이 위의 작은 점으로는 열 곳이 다 검게 보입니다.
   색상과 채도는 그 학교 것 그대로 두고 **명도만 30~55% 구간으로** 끌어
   옵니다 — 2D 판과 같은 처리입니다. */
const FAME_GREY = '#5A6472';
function hexRGB(hex) {
  const h = String(hex || '').replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [90, 100, 114];
}
function hexToHsl(hex) {
  const [r, g, b] = hexRGB(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dd = mx - mn;
  const l = (mx + mn) / 2;
  if (!dd) return [0, 0, l];
  const sa = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
  const h = mx === r ? ((g - b) / dd + (g < b ? 6 : 0))
    : mx === g ? (b - r) / dd + 2
      : (r - g) / dd + 4;
  return [h / 6, sa, l];
}
function hslToHex(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, '0');
  };
  return '#' + f(0) + f(8) + f(4);
}
function schoolTint(hex) {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.min(0.55, Math.max(0.30, l)));
}
/** 바탕색 위에서 읽히는 글자색. 밝기를 재서 잉크와 흰색 중 대비가 큰 쪽. */
function readableOn(hex) {
  const [r, g, b] = hexRGB(hex).map((v) => {
    const q = v / 255;
    return q <= 0.03928 ? q / 12.92 : ((q + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (L + 0.05) / 0.05 > 1.05 / (L + 0.05) ? '#1B2430' : '#FFFFFF';
}

/* 못 받았을 때 뭐라고 쓸지. 한 곳에 모아 둡니다 — 여기저기 흩어 두면
   나중에 갈래가 하나 늘 때 한 군데를 빠뜨립니다. */
const FAME_TROUBLE = {
  idle: ['불러오는 중이에요', '학교 순위를 서버에서 받아 오고 있어요.'],
  loading: ['불러오는 중이에요', '학교 순위를 서버에서 받아 오고 있어요.'],
  unconfigured: ['이 판본에는 서버가 없어요',
    '학교 순위는 서버가 셉니다. 파일로 연 화면이나 서버 설정이 없는 판본에서는 볼 수 없어요. 다른 창은 그대로 씁니다.'],
  offline: ['서버에 닿지 못했어요',
    '인터넷이 끊겼거나 서버가 잠깐 쉬는 중이에요. 창을 다시 열면 한 번 더 물어봅니다.'],
  unauth: ['로그인이 풀렸어요',
    '학교 순위는 로그인한 뒤에 볼 수 있어요. 세션을 한 번 마치면 다시 붙습니다.'],
  server: ['서버가 답하지 못했어요',
    '잠시 뒤에 창을 다시 열어 주세요. 이 창 말고 다른 기능은 그대로 돕니다.'],
};

/**
 * 명예의 전당.
 *
 *   ctx.state        'idle' · 'loading' · 'ok' · 'unconfigured' · 'offline'
 *                    · 'unauth' · 'server'. 없으면 ctx.rows 로 짐작합니다.
 *   ctx.data         서버가 준 것 그대로 —
 *                    { season:{no,daysLeft,progress,from,to},
 *                      ranked:[{school,score,minutes,recoveries,contributors}],
 *                      pending:[{school,contributors}],
 *                      past:[{no,school,minutes}],
 *                      totals:{contributors}, rules:{minContributors},
 *                      me:{school,rank,contributors} }
 *   ctx.rows         옛 호출. data 가 없으면 이것을 ranked 로 씁니다.
 *   ctx.myschool     이 기기가 아는 내 학교
 *   ctx.verified     학교 메일 인증 여부
 *   ctx.schoolColor  (학교이름) => '#rrggbb'. 없으면 전부 무채색
 *   ctx.onRetry      (again) => …  없으면 다시 묻는 단추를 안 세웁니다
 */
export function fame(ctx) {
  const c = ctx || {};
  /* 옛 호출을 그대로 받습니다 — index.html 이 rows 하나만 넘기던 때의
     약속입니다. undefined 는 아직 물어보는 중, null 은 서버가 없는 판본. */
  const state = c.state
    || (c.rows === undefined ? 'loading' : c.rows === null ? 'unconfigured' : 'ok');
  /* 서버가 표를 통째로 배열로 내려보내는 판이 있습니다(3D 쪽 RPC 가
     그랬습니다). 그대로 두면 d.ranked 가 undefined 라 "아직 아무 학교도
     집계되지 않았어요" 가 뜹니다 — 순위를 받아 놓고 없다고 말하는 화면이
     제일 나쁩니다. 배열로 오면 순위표로 봅니다. */
  const raw = c.data != null ? c.data : (c.rows || []);
  const d = state === 'ok' ? (Array.isArray(raw) ? { ranked: raw } : raw) : null;
  const ranked = (d && d.ranked) || [];
  const pending = (d && d.pending) || [];
  const past = (d && d.past) || [];
  const rules = (d && d.rules) || {};
  const floor = rules.minContributors || 20;
  /* 내 학교는 서버가 내 세션에서 뽑은 것이 먼저입니다. 서버가 모르면
     (아직 세션이 없으면) 이 기기에 저장된 학교로 칠합니다. */
  const my = (d && d.me && d.me.school) || c.myschool || '';
  /* 서버가 me 를 안 보내는 판이면(옛 호출도 그렇습니다) 목록에서 직접
     찾습니다. 순위표를 눈으로 훑어 우리 학교를 세는 일은 화면이 할 일입니다. */
  const inList = my ? ranked.findIndex((r) => r.school === my) : -1;
  const myRank = (d && d.me && d.me.rank) || (inList >= 0 ? inList + 1 : null);
  const myCount = d && d.me && d.me.contributors != null ? d.me.contributors
    : (pending.find((r) => r.school === my) || {}).contributors ?? null;
  const tint = (name) => schoolTint(c.schoolColor ? (c.schoolColor(name) || FAME_GREY) : FAME_GREY);
  const num = (v) => Number(v || 0).toLocaleString();
  const mark = (name) => String(name || '학교').replace(/대학교|학교|대/g, '').trim().slice(0, 2) || '교';
  /* 순위 뱃지를 그 학교 색으로 칠합니다. 예전에는 이름 옆에 9px 짜리
     점을 찍었는데, 열 줄이 되면 점이 너무 작아 우리 학교를 못 찾습니다.
     칸 자체를 칠하면 훑기만 해도 걸립니다. 색은 index.html 의 표가
     주고(ctx.schoolColor), 여기서는 밝기만 읽히게 맞춥니다. */
  /* 알약 안에는 **그림만** 넣습니다. 줄(.rw)의 알약은 스타일표에서 가운데
     정렬을 안 걸어 둬서, 글자를 넣으면 왼쪽 위 모서리에 붙어 잘립니다.
     등수는 이름 앞에 글자로 답니다 — 어차피 이름과 같이 읽는 값입니다. */
  const badge = (name) => {
    const b = tint(name);
    return `<span class="fame-logo" style="--logo:${b};color:${readableOn(b)}" aria-label="${esc(name)} 로고">${esc(mark(name))}</span>`;
  };
  const row = (r, i) => {
    const sub2 = [];
    if (r.minutes != null) sub2.push(`${num(Math.round(r.minutes / 60))}시간`);
    if (r.recoveries != null) sub2.push(`회복 ${num(r.recoveries)}회`);
    const cn = r.contributors != null ? r.contributors : r.n;
    if (cn != null) sub2.push(`${num(cn)}명`);
    if (r.school === my) sub2.unshift('우리 학교');
    return `<div class="fame-frame top${Math.min(i + 1, 4)} ${r.school === my ? 'mine' : ''}"><span class="fame-rank">${i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}</span>${badge(r.school)}`
      + `<span class="fame-school">${esc(r.school || r.name || '')}<em>${sub2.join(' · ')}</em></span>`
      + `<strong>${num(Math.round(r.score ?? r.avg ?? 0))}<small>분/인</small></strong></div>`;
  };
  /* 하한 미달 학교. 분·회복·점수는 서버가 아예 안 보냅니다 — 참여자가
     한둘인 학교의 "합계" 는 그 사람의 기록 그 자체라서요. */
  const pendRow = (r) => `<div class="rw">${badge(r.school)}`
    + `<span class="t">${esc(r.school || '')}<em>${r.school === my ? '우리 학교 · ' : ''}`
    + `순위까지 ${Math.max(0, floor - (r.contributors || 0))}명</em></span>`
    + `<span class="v">${num(r.contributors)}/${floor}명</span></div>`;

  /* 시즌 — 서버가 준 것이 먼저, 없으면 이 기기가 셉니다.
     90일 한 바퀴. 언제 끝나는지 안 보이면 랭킹전이 아니라 그냥 표입니다. */
  const sv = d && d.season;
  const local = season();
  const S = sv
    ? { n: sv.no, left: sv.daysLeft, done: Math.round((sv.progress || 0) * 100),
      from: sv.from || '', to: sv.to || '' }
    : { n: local.n, left: local.left, done: local.done, from: '', to: '' };

  const t = FAME_TROUBLE[state];
  let body;
  if (t) {
    /* 못 받은 넷 + 아직 받는 중. 여기서 갈래를 하나로 뭉치면 위 표를
       만든 이유가 사라집니다. */
    body = rw('bell', 'peach', esc(t[0]), esc(t[1]))
      + (c.onRetry && state !== 'unconfigured' && state !== 'loading' && state !== 'idle'
        ? '<div class="wr"><button data-fame="retry">다시 물어보기</button></div>' : '');
  } else if (!ranked.length && !pending.length) {
    body = rw('seat', 'lilac', '아직 아무 학교도 집계되지 않았어요',
      '도서관이나 본관에 앉아 세션을 한 번 마치면 우리 학교가 이 자리에 처음 올라와요');
  } else {
    body = (ranked.length
      ? `<div class="fame-wall">${ranked.map(row).join('')}</div>`
      : rw('chart', 'lilac', `아직 참여자 ${floor}명을 넘긴 학교가 없어요`,
        '넘는 학교가 생기면 여기에 순위가 섭니다'))
      + (pending.length ? lbl('user', '집계 중')
        + pending.map(pendRow).join('')
        + `<div class="note">참여자 ${floor}명부터 순위에 오릅니다. 순위 밖이어도 지우지 않아요 — 지우면 그 학교 사람은 자기 기록이 어디로 갔는지 알 수가 없습니다.</div>` : '');
  }

  /* 못 물어봤으면 액자 칸을 아예 안 세웁니다. "아직 끝난 시즌이 없어요" 는
     서버가 없다고 답했을 때만 할 수 있는 말입니다 — 못 물어본 것과 없다는
     것은 다른 말입니다. */
  const frames = t ? '' : lbl('key', '역대 시즌 1위')
    + (past.length
      ? `<div class="cg">${past.map((p) => {
        const b = tint(p.school);
        return `<div class="cc"><span class="ic" style="background:${b};color:${readableOn(b)}">${esc(String(p.no ?? ''))}</span>`
          + `<b>${esc(p.school || '')}</b><small>${num(Math.round((p.minutes || 0) / 60))}시간</small></div>`;
      }).join('')}</div>`
      : rw('key', 'lilac', '아직 끝난 시즌이 없어요', '시즌이 하나 끝나면 여기에 액자가 걸립니다'));

  const head = `<div class="cg two">${cc('cal', '', S.n, '시즌')}`
    + `${cc('clock', 'sky', S.left + '일', '남은 날')}</div>`
    + `<div class="mtr"><i style="width:${S.done}%"></i></div>`
    + rw('chart', 'lemon', '이번 시즌',
      S.from && S.to ? `${esc(S.from)} ~ ${esc(S.to)}` : '90일 한 바퀴', `${S.done}%`)
    /* 우리 학교 줄은 순위표 **위**에 둡니다. 이 창을 여는 이유가 대개
       "우리 몇 등이지" 하나라, 열 줄을 훑기 전에 답이 나와야 합니다. */
    + rw('user', 'peach', my ? esc(my) : '아직 학교가 없어요',
      my ? '내 설정 학교 · 앉은 시간이 이 학교 점수로 쌓입니다'
        : 'MY의 내 정보에서 학교를 고르면 내 시간이 학교 점수로 쌓입니다',
      myRank ? myRank + '위' : myCount != null ? `${myCount}/${floor}명` : '—')
    + (t ? '' : rw('heart', 'lilac', '이번 시즌 참여자', '세션이 한 번이라도 돈 사람',
      `${num((d && d.totals && d.totals.contributors) || 0)}명`))
    + lbl('chart', '이번 시즌 학교 순위');

  return {
    tag: '명예의 전당', title: '이번 시즌 랭킹전',
    html: head + body + frames
      + lbl('board', '무엇으로 순위를 매기나')
      + `<div class="cg two">${cb('clock', '', '참여 시간', '카메라 앞에서 실제로 앉아 있던 시간')}`
      + `${cb('heart', 'peach', '회복 횟수', '무너졌다가 다시 돌아온 횟수 — 고쳐 앉는 행동 자체에 값을 매깁니다')}</div>`
      + '<div class="note">학교 합계가 아니라 <b>참여자 한 명당</b>으로 셉니다. <b>개인 순위는 만들지 않습니다</b> — 자세로 사람을 줄 세우지 않겠다는 게 이 서비스의 원칙입니다.</div>',
    on(root, again) {
      if (!c.onRetry) return;
      root.querySelector('.bd').onclick = (e) => {
        if (e.target.closest('button[data-fame="retry"]')) c.onRetry(again);
      };
    },
  };
}

/** 창밖 날씨 — /api/weather 는 배포본에서만 돕니다 */
export function weather(ctx) {
  const W = ctx.data;
  let body;
  if (W === undefined) body = rw('sun', 'lemon', '창밖을 보는 중…', '');
  else if (W === null) body = rw('sun', 'lilac', '지금은 날씨를 못 받아왔어요', '잠시 뒤에 창을 다시 열어 주세요');
  else if (W.error) body = rw('sun', 'lilac', '기상청 날씨를 표시하지 못했어요', esc(W.error));
  /* 하늘 그림만은 픽토그램으로 안 바꿉니다 — 비인지 눈인지가 이 창의
     내용 전부인데, 한 벌짜리 아이콘에는 그 갈래가 없습니다. */
  else body = `<div class="cg two">${cc('sun', 'lemon', W.temp != null ? W.temp + '°' : '—', '지금 기온')}`
    + `<div class="cc"><span class="ic sky"><span class="big">${esc(W.icon || '🌤')}</span></span>`
    + `<b>${esc(W.label || '')}</b><small>${esc(W.desc || '')}</small></div></div>`;
  return { tag: '창밖', title: '지금 바깥 날씨', html: body };
}

/** 셔틀 — 다음 차까지 남은 시간. 20분 간격 가짜 시간표지만 진짜처럼 셉니다 */
export function bus() {
  const now = new Date();
  const mm = now.getMinutes() % 20;
  const left = (20 - mm) % 20 || 20;
  return {
    tag: '정류장', title: '셔틀 정류장',
    html: `<div class="cg two">${cc('bus', '', left + '분', '다음 셔틀까지')}`
      + `${cc('clock', 'sky', '20분', '배차 간격')}</div>`
      + rw('map', 'lilac', '기숙사 → 정문 → 본관', '한 바퀴를 돕니다'),
  };
}

/** 방 꾸미기 — 가진 가구를 방에 놓습니다 */
export function decor(ctx) {
  const owned = FURN.filter(([id]) => (ctx.furn[id] || 0) > (ctx.placedCount[id] || 0));
  return {
    tag: '방 꾸미기', title: '내 방 가구 놓기',
    html: (owned.length
      ? lbl('sofa', '놓을 수 있는 것') + '<div class="cg">'
        /* 표의 네 번째 칸을 씁니다. 여섯 개짜리 표를 여기에 또 박아 뒀더니
           새로 늘린 가구가 전부 'undefined' 라고 적혔습니다 — 같은 표를
           두 곳에 적으면 한 곳만 고치는 날이 옵니다. */
        /* 칸마다 "눌러서 방에 놓기" 를 적어 두었더니 스무 번 같은 문장이
           됩니다. 그 자리에는 칸마다 다른 값 — 아직 안 놓고 남은 개수를
           넣습니다. 셋 다 이미 ctx 에 있는 값이라 지어낸 숫자가 아닙니다. */
        + owned.map(([id, nm]) => `<button class="cc" data-place="${esc(id)}">
            <span class="th" style="width:100%;height:70px"></span>
            <b>${esc(nm)}</b><small>${(ctx.furn[id] || 0) - (ctx.placedCount[id] || 0)}개 남음</small></button>`).join('') + '</div>'
      : rw('sofa', 'lilac', '놓을 가구가 없어요', '동아리 상점의 가구 가게에서 사 오세요'))
      + (ctx.placed.length
        ? lbl('map', '지금 방에 놓인 것')
          + rw('sofa', 'sky', '놓인 가구', '', `${ctx.placed.length}개`)
          + '<div class="wr"><button data-clearall="1">전부 치우기</button></div>'
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

/* 칸(.big) 에 들어갈 짧은 꼴. "3분 12초" 는 크게 키우면 줄을 넘습니다. */
const mshort = (s) => (s < 60 ? `${Math.round(s)}초` : `${Math.floor(s / 60)}분`);
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
  let now = rw('seat', 'lilac', '아직 마친 세션이 없어요',
    '도서관이나 본관 자리 앞에서 E 를 누르면 시작됩니다');
  if (last) {
    const t = Math.max(1, last.judged || last.sec);
    const g = Math.max(0, t - (last.tWarn || 0) - (last.tBad || 0));
    const plan = stretchPlan(last.axes);
    const age = postureAge(last);
    /* 좋음·주의·굽음을 색으로 못박습니다 — 이 창 안에서 민트는 늘 좋음,
       레몬은 주의, 복숭아는 굽음입니다. 예전에는 세 칸짜리 막대 하나였는데,
       막대만 봐서는 몇 퍼센트인지 읽을 수가 없어 밑에 또 적어 뒀었습니다. */
    now = `<div class="cg two">${cc('clock', '', mshort(last.sec), '앉은 시간')}`
      + `${cc('cam', 'sky', mshort(last.judged || last.sec), '판정이 돈 시간')}</div>`
      + lbl('chart', '이번 세션의 자세')
      + `<div class="cg">${cc('heart', '', pct(g, t) + '%', '좋음')}`
      + `${cc('bell', 'lemon', pct(last.tWarn || 0, t) + '%', '주의')}`
      + `${cc('seat', 'peach', pct(last.tBad || 0, t) + '%', '굽음')}</div>`
      + `<div class="mtr"><i style="width:${pct(g, t)}%"></i></div>`
      + `<div class="cg two">${cc('run', '', last.bad || 0, '회복한 횟수')}`
      + `${cc('user', 'lilac', age + '세', '자세 나이')}</div>`
      + '<div class="note">자세 나이는 유지력·회복 속도·무너진 깊이로 읽은 <b>버릇의 나이</b>입니다. 점수도 등급도 아니고, 의학적 판단은 하지 않습니다.</div>'
      + (plan
        ? lbl('run', '오늘 이거 두 개만')
          + plan.map(([n, d]) => rw('run', 'lemon', esc(n), esc(d))).join('')
        : rw('leaf', 'sky', '오래 벗어난 축이 없었어요', '오늘은 잘 앉으셨습니다'));
  }
  const rows = past.length ? past.map((se) => {
    const d = new Date(se.t || Date.now());
    const where = se.zone === 'campus' ? '캠퍼스' : (ROOM_LABEL[se.zone] || esc(se.zone || '어딘가'));
    return rw('seat', '', `${d.getMonth() + 1}/${d.getDate()} ${where}`,
      `회복 ${se.bad || 0}번`, mshort(se.sec));
  }).join('') : rw('clock', 'lilac', '지난 기록이 없어요', '');
  return {
    tag: '회고', title: '세션 회고',
    html: `<div class="wr">
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
    /* 값표 둘이 표였습니다. 표는 칸이 좁아 "5분 앉기" 가 두 줄로 접히고,
       무엇을 하면 얼마인지가 눈에 안 들어왔습니다. 줄로 폅니다 —
       왼쪽은 무엇을 하는지, 오른쪽은 얼마인지. */
    html: coinbar(ctx.coins, ctx.server)
      + `<div class="cg two">${cc('chart', '', d, '오늘 받은 코인')}`
      + `${cc('cal', 'sky', run + '일', '연속 출석')}</div>`
      + `<div class="mtr"><i style="width:${Math.min(100, Math.round((d / 300) * 100))}%"></i></div>`
      + rw('key', 'peach', '하루 상한', '상한에 닿으면 그날은 더 안 들어와요', '300코인')
      + lbl('coin', '어떻게 버나')
      + rw('seat', 'lemon', '앉기', '5분 10 · 15분 30 · 30분 40 · 50분 60', '10~60코인')
      + rw('run', 'lemon', '회복', '한 번에 5코인 · 세션당 다섯 번까지', '5코인')
      + rw('ticket', 'lemon', '미니게임', '게임별 하루 한 번', '10코인')
      + rw('cal', 'lemon', '연속 출석', '3 · 7 · 14 · 30 · 60일에', '5~100코인')
      + '<div class="note"><b>앉은 시간이 아니라 판정이 돈 시간으로 셉니다.</b> 카메라를 가려 두거나 자리를 비운 동안은 안 세요 — 그래야 코인이 실제로 앉은 값이 됩니다.</div>'
      + lbl('shirt', '어디에 쓰나')
      + rw('shirt', 'lilac', '옷', '상의 · 하의 · 신발 · 모자 · 안경 · 가방')
      + rw('sofa', 'lilac', '가구', '기숙사 방에 놓습니다')
      + rw('egg', 'lilac', '알', '아직 없는 종이 깨어납니다', '40코인'),
  };
}

/** 마이페이지 — 내 정보 · 자세 기준 · 설정 */
export function mypage(ctx) {
  const total = SAVE.sessions.reduce((a, s2) => a + s2.sec, 0);
  const judged = SAVE.sessions.reduce((a, s2) => a + (s2.judged || s2.sec), 0);
  const bad = SAVE.sessions.reduce((a, s2) => a + (s2.bad || 0), 0);
  const zones = {};
  SAVE.sessions.forEach((s2) => { zones[s2.zone] = (zones[s2.zone] || 0) + s2.sec; });
  /* 옛 형식(존별로 잡던 것 · version 2)이 남아 있으면 features 가 없습니다.
     그대로 Object.keys 를 하면 창을 **짓는 중에** 터져서 마이페이지가
     아예 안 열립니다 — 눌러도 아무 일이 없는 것으로 보입니다.
     기준선 하나 때문에 창이 안 열리면 안 되므로 없는 것으로 봅니다. */
  const base = (ctx.baseline && ctx.baseline.features
    && Object.keys(ctx.baseline.features).length) ? ctx.baseline : null;
  return {
    tag: '마이페이지', title: '내 기록',
    html: `<div class="wr">
        <button data-tab="me" class="on">내 정보</button>
        <button data-tab="coin">코인</button>
        <button data-tab="cal">자세 기준</button>
        <button data-tab="set">설정</button></div>
      <div data-pane="me">`
      + `<div class="cg two">${cc('clock', '', mshort(total), '앉은 시간')}`
      + `${cc('cam', 'sky', mshort(judged), '판정이 돈 시간')}</div>`
      + `<div class="cg">${cc('seat', '', SAVE.sessions.length, '세션')}`
      + `${cc('run', 'peach', bad, '회복')}${cc('coin', 'lemon', ctx.coins, '코인')}</div>`
      + lbl('map', '어디서 앉았나')
      + (Object.keys(zones).length
        ? Object.entries(zones).sort((a, b) => b[1] - a[1]).map(([z, v]) =>
          rw('seat', '', ROOM_LABEL[z] || esc(z), '', mshort(v))).join('')
        : rw('seat', 'lilac', '아직 앉은 자리가 없어요', '도서관이나 본관 자리에서 E'))
      + lbl('user', '내 학교')
      + `<div class="wr school-pick">${(ctx.schools || []).map((q) =>
          `<button type="button" data-school="${esc(q.name)}" class="${q.name === ctx.school ? 'on' : ''}"
            style="--school:#${Number(q.c).toString(16).padStart(6, '0')}">${esc(q.name.replace('대학교', '대'))}</button>`).join('')}</div>`
      + '<div class="note">학교를 바꾸면 공지 · 학식 · 학교 채팅과 과잠 대표색이 함께 바뀝니다.</div>'
      + `<div class="wr"><button data-do="retro">세션 회고 열기</button></div>
      </div>
      <div data-pane="coin" style="display:none">${coinPanel({ coins: ctx.coins, server: ctx.server }).html}</div>
      <div data-pane="cal" style="display:none">`
      + (base
        ? `<div class="cg two">${cc('chart', '', Object.keys(base.features).length, '쓰는 축')}`
          + `${cc('cam', 'sky', base.sampleCount, '표본')}</div>`
          + rw('clock', 'lilac', '기준 잡은 때', esc(new Date(base.createdAt).toLocaleString('ko-KR')))
        : rw('cam', 'lilac', '아직 기준이 없어요',
          '자리에 앉으면 10초 동안 지금 앉은 모습을 기준으로 잡습니다'))
      + '<div class="note">정답 자세와 비교하지 않습니다. <b>10초 전의 나</b>와만 비교해요. 의자를 바꾸거나 책상 높이가 달라졌으면 기준을 다시 잡는 게 낫습니다.</div>'
      + `<div class="wr"><button data-do="recal">기준 다시 잡기</button>
        <button data-do="tour">처음 안내 다시 보기</button></div>
      </div>
      <div data-pane="set" style="display:none">`
      + lbl('bell', '소리')
      + `<div class="wr"><button data-do="snd" class="${ctx.snd ? 'on' : ''}">장소 소리 ${ctx.snd ? '켬' : '끔'}</button>
          <button data-do="bgm" class="${ctx.bgm ? 'on' : ''}">배경음악 ${ctx.bgm ? '켬' : '끔'}</button></div>`
      + lbl('chart', '음량')
      + `<div class="wr">${[0, .25, .45, .7, 1].map((v) =>
          `<button data-do="vol:${v}" class="${Math.abs((ctx.bgmVol ?? .45) - v) < .01 ? 'on' : ''}">${
            v === 0 ? '없음' : Math.round(v * 100) + '%'}</button>`).join('')}</div>`
      + lbl('music', '시설별 집중 ASMR · 음악')
      + `<div class="wr"><button data-do="bgm:auto" class="${ctx.bgmPick === 'auto' ? 'on' : ''}">장소 따라</button>${
          Object.entries(ctx.music || {}).map(([id, m]) =>
            `<button data-do="bgm:${id}" class="${ctx.bgmPick === id ? 'on' : ''}" title="${esc(m.by)}">${esc(m.name)}</button>`).join('')}</div>`
      + '<div class="note"><b>Spotify 집중 재생</b><br>아래 플레이어에서 로그인한 Spotify 계정으로 바로 재생할 수 있어요.</div>'
      + '<iframe title="Spotify 집중 플레이리스트" style="width:100%;height:152px;border:0;border-radius:16px;margin-top:10px" allow="autoplay;clipboard-write;encrypted-media;fullscreen;picture-in-picture" loading="lazy" src="https://open.spotify.com/embed/playlist/37i9dQZF1DWZeKCadgRdKQ?utm_source=generator"></iframe>'
      + '<div class="note">장소 따라를 고르면 시설에 맞는 곡이 자동으로 바뀝니다. 내장 곡은 전부 CC0이며 만든 사람은 단추에 손을 올리면 나옵니다.</div>'
      + lbl('key', '기록')
      + '<div class="wr"><button data-do="wipe">이 기기 기록 전체 지우기</button></div>'
      + '<div class="note">지우면 되돌릴 수 없습니다 — 되돌릴 열쇠(이메일·비밀번호)를 애초에 안 받습니다. 서버 기록까지 지우려면 <b>ikmc554@mju.ac.kr</b> 로 ID 를 알려 주세요.</div>'
      + '</div>',
    on(root, again) {
      root.querySelector('.bd').onclick = (e) => {
        const t = e.target.closest('button[data-tab]');
        if (t) {
          root.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === t));
          root.querySelectorAll('[data-pane]').forEach((x) =>
            { x.style.display = x.dataset.pane === t.dataset.tab ? '' : 'none'; });
          return;
        }
        const school = e.target.closest('button[data-school]');
        if (school) { ctx.onSchool?.(school.dataset.school, again); return; }
        const b = e.target.closest('button[data-do]'); if (!b) return;
        ctx.onDo(b.dataset.do, again);
      };
    },
  };
}

/** 안내 — 처음 온 사람이 읽는 일곱 칸 */
/* 번호 매긴 일곱 줄이었습니다. 순서가 있는 이야기라 번호가 틀린 것은
   아닌데, 일곱 줄을 다 읽어야 무슨 앱인지 알 수 있었습니다. 칸으로
   펴면 그림만 훑어도 얼개가 잡힙니다. 색으로 네 묶음 — 시작 · 판정 ·
   보상 · 원칙. 조작은 표를 걷어 내고 줄로 폅니다(왼쪽 할 일, 오른쪽 키). */
export function guide() {
  const STEP = [
    ['seat', '', '앉기', '도서관이나 본관 자리 앞에서 E — 자세 세션이 시작됩니다'],
    ['cam', '', '10초 기준', '처음이면 지금 앉은 모습을 10초 동안 기준으로 잡습니다'],
    ['chart', 'sky', '기준 대비', '정답 자세와 겨루지 않습니다. 10초 전의 나와만 비교해요'],
    ['bell', 'sky', '무너지면', '캐릭터가 같이 굽고 말풍선이 뜹니다'],
    ['coin', 'lemon', '일어나면', '세션이 끝나고 코인이 들어옵니다'],
    ['egg', 'lemon', '코인으로', '옷 · 가구 · 알을 삽니다. 알에서 새 종이 깨어나요'],
    ['user', 'lilac', '학교 점수', '앉은 시간은 학교 점수로 모입니다 — 개인 순위는 만들지 않습니다'],
  ];
  const KEY = [
    ['run', '걷기', 'Shift 로 뛰기', 'W A S D'],
    ['key', '말 걸기 · 들어가기 · 앉기', '', 'E'],
    ['cam', '시점 좌우로 돌리기', '', 'Z X'],
    ['map', '지도', '건물을 누르면 그 앞으로', 'M'],
    ['shirt', '옷장', '', 'C'],
    ['heart', '감정표현', '', 'G · 1~8'],
    ['board', '채팅', '', 'Enter'],
    ['user', '1인칭 · 3인칭', '', 'Tab'],
  ];
  return {
    tag: '안내', title: 'Deskfit 안내',
    html: `<div class="cg">${STEP.map(([ic, tone, nm, ds]) => cb(ic, tone, nm, ds)).join('')}</div>`
      + lbl('key', '조작')
      + KEY.map(([ic, nm, ds, k]) => rw(ic, '', nm, ds, k)).join(''),
  };
}

/** 개인정보 — 서버로 가는 것과 안 가는 것 */
export function privacy() {
  return {
    tag: '개인정보', title: '카메라와 개인정보',
    /* 여기는 줄글이 남을 만한 자리이지만, 표 하나에 문단 셋이던 것을
       그대로 두면 "안 읽고 닫는 화면" 이 됩니다. 색을 뜻으로 씁니다 —
       민트는 **안 나가는 것**, 하늘색은 **나가는 것**. 두 목록을 눈으로
       가를 수 있으면 문장을 다 안 읽어도 답이 나옵니다. */
    html: `<div class="cg two">${cb('cam', '', '영상은 안 나갑니다', '판정은 이 브라우저 안에서 끝나고 프레임은 즉시 버려집니다')}`
      + `${cb('user', 'lilac', '회원가입이 없습니다', '이메일 · 전화번호 · 비밀번호를 안 받습니다. 남에게 보이는 건 닉네임과 캐릭터뿐이에요')}</div>`
      + lbl('key', '서버로 가지 않는 것')
      + rw('cam', 'lilac', '영상 · 사진 · 스냅샷', '한 장도 올라가지 않습니다')
      + rw('chart', 'lilac', '자세 좌표 원본', '기기 안에서만 씁니다')
      + rw('user', 'lilac', '얼굴에서 뽑은 값 · 10초 기준값', '기기 밖으로 안 나갑니다')
      + lbl('board', '세션이 끝날 때 가는 것 — 이게 전부')
      + rw('key', 'sky', '세션 ID', '기기가 만든 임의 문자열')
      + rw('clock', 'sky', '앉은 시간', '', '분')
      + rw('map', 'sky', '캠퍼스 시간', '', '분')
      + rw('run', 'sky', '회복 횟수', '', '번')
      + rw('cal', 'sky', '시작 · 종료', '', '시각')
      + rw('user', 'sky', '학교', '고른 학교 이름')
      + '<div class="note"><b>직접 확인해 보세요.</b> F12 로 개발자도구를 열고 세션을 돌리면 오가는 요청이 전부 보입니다. 모델을 한 번 받은 뒤 랜선을 뽑아도 자세 판정은 그대로 돕니다.</div>',
  };
}

/** 출입문 옆 안내 표지판 — 사용법과 카메라 안내를 한 창에 묶습니다. */
export function dormInfo(ctx) {
  const tab = ctx.tab === 'privacy' ? 'privacy' : 'guide';
  const active = tab === 'privacy' ? privacy() : guide();
  return {
    tag: '안내 표지판', title: 'Deskfit 안내', medium: true,
    html: `<div class="board-tabs dorm-info-tabs" role="tablist" aria-label="Deskfit 안내 종류">
      <button type="button" role="tab" data-info-tab="guide" class="${tab === 'guide' ? 'on' : ''}"
        aria-selected="${tab === 'guide'}">사용 방법</button>
      <button type="button" role="tab" data-info-tab="privacy" class="${tab === 'privacy' ? 'on' : ''}"
        aria-selected="${tab === 'privacy'}">카메라 · 개인정보</button></div>
      <div class="dorm-info-view">${active.html}</div>`,
    on(root, again) {
      root.querySelector('.dorm-info-tabs').onclick = (e) => {
        const b = e.target.closest('button[data-info-tab]');
        if (!b || b.dataset.infoTab === tab) return;
        ctx.onTab(b.dataset.infoTab, again);
      };
    },
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
  all() {
    /* 모양까지 봅니다. 예전 판이나 다른 탭이 숫자·글자를 넣어 두면
       `a[code] = …` 가 엄격 모드에서 터져서 정문 창이 안 열립니다. */
    try {
      const v = JSON.parse(localStorage.getItem(this.KEY));
      return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
    } catch { return {}; }
  },
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
  /* 코드 자체가 이 창의 주인공이라 가장 큰 글자(.big) 자리를 내줍니다.
     예전에는 여기에 monospace 와 자간을 손으로 박아 두었는데, 창이
     찰흙이 된 뒤로는 그 한 덩어리만 다른 앱에서 온 것처럼 보였습니다. */
  const html = `<div class="cg two">${cc('key', 'lilac', esc(code), '내 초대 코드')}`
    + `${cc('user', '', friends.length, '받아 둔 코드')}</div>`
    + `<div class="wr">
      <button data-inv="copy">코드 복사</button>
      <button data-inv="link">초대 링크 복사</button>
      <button data-inv="new">새로 만들기</button>
    </div>`
    + lbl('ticket', '친구 코드 넣기')
    + '<input class="nick invin" maxlength="6" placeholder="ABC123" autocomplete="off">'
    + '<p class="invmsg" aria-live="polite"></p>'
    + '<div class="wr"><button data-inv="add">넣기</button></div>'
    + lbl('user', '받아 둔 코드')
    + (friends.length
      ? friends.map(([c, v]) => `<button class="rw" data-drop="${esc(c)}" title="지우기">`
        + `<span class="ic sky">${pic('user')}</span>`
        + `<span class="t">${esc(c)}<em>${v.nickname ? esc(v.nickname) : '별명 없음'}</em></span>`
        + '<span class="v">지우기 ✕</span></button>').join('')
      : rw('user', 'lilac', '아직 없어요', '친구가 불러 준 여섯 자리를 위에 넣어 보세요'))
    + '<div class="note">코드는 <b>이 기기에만</b> 남습니다. 별명 · 학교 · 종만 들어 있고, 자세 기록은 들어가지 않습니다.</div>';
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

/* ══════════════════════════════════════════════════════════
   처음 안내 — 넉 장

   2D 판에는 캠퍼스 지도를 그려 놓고 "여기가 무엇을 하는 곳인지" 를
   짚어 주는 그림 투어가 있었고, 마이페이지에서 다시 볼 수 있었습니다.
   3D 로 옮기면서 화면 구석의 힌트 다섯 줄만 남았는데, 그 힌트는
   **조작**을 알려 주지 이 세계가 무엇인지는 말해 주지 않습니다.

   글로 설명하지 않습니다. 넉 장에 그림 하나씩입니다 — 읽는 것이 아니라
   보는 것이라야 처음 들어온 사람이 넘깁니다.
   ══════════════════════════════════════════════════════════ */
const TOUR = [
  { ic: 'pic-map', tone: 'sky', t: '섬 하나가 캠퍼스예요',
    p: '건물 여섯 채와 운동장·동아리 거리가 있습니다. M 을 누르면 지도가 열리고, 이름 앞 숫자를 누르면 그 앞으로 갑니다.' },
  { ic: 'pic-seat', tone: '', t: '앉으면 시작됩니다',
    p: '도서관이나 본관 의자 앞에서 E. 웹캠이 목 각도를 보고, 무너지면 캐릭터도 같이 굽어요.' },
  { ic: 'pic-coin', tone: 'lemon', t: '앉은 시간이 코인이 돼요',
    p: '판정이 실제로 돈 시간만 셉니다. 옷 · 가구 · 알을 사고, 알에서 새 종이 깨어납니다.' },
  { ic: 'pic-heart', tone: 'peach', t: '점수를 매기지 않아요',
    p: '자세에 등수를 매기지 않고, 굽은 기록을 어디에도 보내지 않습니다. 앉은 시간은 학교 점수로만 모입니다.' },
];
/** ctx: { step, onStep(i), onDone } */
export function tour(ctx) {
  const i = Math.max(0, Math.min(TOUR.length - 1, ctx.step | 0));
  const it = TOUR[i], last = i === TOUR.length - 1;
  const html = `
    <div class="cg" style="grid-template-columns:1fr">
      <div class="cc tour-card">
        <span class="ic ${it.tone} tour-icon">
          <svg class="pic lg"><use href="#${it.ic}"/></svg></span>
        <b class="tour-title">${esc(it.t)}</b>
        <small class="tour-copy">${esc(it.p)}</small>
      </div>
    </div>
    <div class="wr" style="justify-content:center;margin:14px 0 4px">
      ${TOUR.map((_, k) => `<button data-go="${k}" class="sw ${k === i ? 'on' : ''}"
        style="width:9px;height:9px;border-radius:99px;padding:0" aria-label="${k + 1}장"></button>`).join('')}
    </div>
    <div class="wr" style="justify-content:space-between">
      <button data-go="${Math.max(0, i - 1)}" ${i ? '' : 'disabled'}>이전</button>
      <button data-go="${last ? 'done' : i + 1}" class="on">${last ? '시작하기' : '다음'}</button>
    </div>`;
  return {
    tag: '처음 안내', title: '기린캠퍼스', html,
    on(root, again) {
      root.querySelector('.bd').onclick = (e) => {
        const b = e.target.closest('button[data-go]'); if (!b || b.disabled) return;
        if (b.dataset.go === 'done') ctx.onDone();
        else { ctx.onStep(+b.dataset.go); again(); }
      };
    },
  };
}

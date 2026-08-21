/* ══════════════════════════════════════════════════════════
   창(panel) 들.
   "말 걸면 문구만 뜬다" 는 껍데기입니다. 여기서는 **실제로 도는 것**만
   담습니다 — 시간표는 고쳐지고, 기록은 쌓이고, 옷은 갈아입힙니다.
   미니게임처럼 2D 월드에 이미 있는 것은 여기서 부르지 않고 자리만
   남겨 둡니다(가짜로 흉내 내면 시연에서 반드시 들킵니다).
   ══════════════════════════════════════════════════════════ */

const KEY = 'girin3d.save';
const DEF = {
  nick: '', species: '거북이', fit: 0,
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

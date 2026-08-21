/* ══════════════════════════════════════════════════════════
   픽셀 캐릭터 — **코드로 굽습니다.**

   여덟 종 × 네 방향 × 걷기 네 컷 × 옷 조합 × 표정 다섯을 손으로
   찍을 수는 없습니다. 몸은 한 벌만 만들고 머리와 옷만 갈아 끼웁니다 —
   3D 판에서 옷 하나로 여덟이 다 입던 것과 같은 이유입니다.

   좌표는 **1픽셀이 1픽셀**입니다. 그려 놓고 정수배로 확대하므로
   중간에 소수점을 쓰면 그 순간 픽셀아트가 아니게 됩니다.

   칸 배치 (20 × 34)
     y 0~7    모자 · 뿔 · 귀 · 가시가 올라가는 자리
     y 8~18   머리
     y 18~26  몸통
     y 26~31  다리
     y 32~33  그림자
   ══════════════════════════════════════════════════════════ */

export const SPECIES = {
  거북이:   { skin: '#8FD4A0', dark: '#5FA875', face: '#D4F0DA', extra: '#53A468', extra2: '#3B7A50' },
  기린:     { skin: '#F6D9A0', dark: '#CBA96A', face: '#FFEFD4', extra: '#C98E4E', extra2: '#A97038' },
  알파카:   { skin: '#EFDFC6', dark: '#C6B295', face: '#FFF8EC', extra: '#FFFBF2', extra2: '#D8C7AE' },
  햄스터:   { skin: '#E8B87A', dark: '#BE8E52', face: '#FFF0DC', extra: '#F4A2A6', extra2: '#D4787C' },
  고슴도치: { skin: '#E0C09A', dark: '#B4936C', face: '#FFF2E0', extra: '#8A6444', extra2: '#63462F' },
  개구리:   { skin: '#7FC96A', dark: '#54963F', face: '#E2F2C8', extra: '#3E7A34', extra2: '#2E5E26' },
  백조:     { skin: '#FDFDFD', dark: '#D6DCE4', face: '#FFFFFF', extra: '#F2933C', extra2: '#D9761F' },
  펭귄:     { skin: '#3E4A5A', dark: '#2A3240', face: '#FFFFFF', extra: '#F2933C', extra2: '#D9761F' },
};
export const SPEC_LIST = Object.keys(SPECIES);

/* 옷 — 몸이 같으니 색만 바꾸면 여덟 종이 다 입습니다.
   2D 때는 종마다 207장을 따로 잘랐습니다. */
export const WEAR = {
  top:     [['tee', '반팔티', 0], ['hoodie', '후드티', 60], ['shirt', '셔츠', 50], ['varsity', '과잠', 90]],
  bottom:  [['jeans', '청바지', 0], ['trainers', '트레이닝', 40], ['slacks', '슬랙스', 50], ['shorts', '반바지', 40]],
  shoes:   [['sneakers', '운동화', 0], ['slippers', '슬리퍼', 30], ['dress', '구두', 60]],
  hat:     [['none', '없음', 0], ['cap', '볼캡', 50], ['beanie', '비니', 50], ['grad_cap', '학사모', 90]],
  glasses: [['none', '없음', 0], ['round', '동그란테', 40], ['horn', '뿔테', 40], ['sunglasses', '선글라스', 60]],
  bag:     [['backpack', '백팩', 0], ['tote', '에코백', 50], ['none', '없음', 0]],
};
export const WEAR_FREE = ['tee', 'jeans', 'sneakers', 'none', 'backpack'];

export const OUTFITS = [
  { style: 'hoodie', top: '#2DD4BF', bottom: '#3E5C82', shoe: '#F2F2F2' },
  { style: 'tee',    top: '#E8695A', bottom: '#4A4A58', shoe: '#F6E8D2' },
  { style: 'shirt',  top: '#F7F3E8', bottom: '#5B84C4', shoe: '#8E6238' },
  { style: 'hoodie', top: '#9B7BD4', bottom: '#3A3F4A', shoe: '#F2F2F2' },
  { style: 'varsity',top: '#C0392B', bottom: '#3E465A', shoe: '#3E4A5A' },
  { style: 'tee',    top: '#63C47C', bottom: '#6B4A2A', shoe: '#F2E4CE' },
  { style: 'shirt',  top: '#F2C14E', bottom: '#4A4038', shoe: '#3A332C' },
  { style: 'hoodie', top: '#5B84C4', bottom: '#30384A', shoe: '#F2F2F2' },
];

const hexOf = (v) => (typeof v === 'number' ? '#' + v.toString(16).padStart(6, '0') : v);
/** 옛 형식({top,bottom,shoe,style})도 그대로 받습니다 — NPC 들이 씁니다 */
export function normalizeLook(fit) {
  if (fit && fit.topId) return {
    ...fit,
    top: hexOf(fit.top ?? '#2DD4BF'), bottom: hexOf(fit.bottom ?? '#3E5C82'),
    shoes: hexOf(fit.shoes ?? '#F2F2F2'), hat: hexOf(fit.hat ?? '#E8695A'),
    bagC: hexOf(fit.bagC ?? '#4A6EA8'),
  };
  return {
    topId: fit?.style || 'tee', top: hexOf(fit?.top ?? '#2DD4BF'),
    bottomId: fit?.bottomId || 'jeans', bottom: hexOf(fit?.bottom ?? '#3E5C82'),
    shoesId: fit?.shoesId || 'sneakers', shoes: hexOf(fit?.shoe ?? '#F2F2F2'),
    hatId: 'none', hat: '#E8695A',
    glassesId: 'none',
    bagId: fit?.bag === false ? 'none' : 'backpack', bagC: '#4A6EA8',
  };
}

const INK = '#2B2530', WHITE = '#FFFFFF', BLUSH = '#F49CA4';
export const FW = 20, FH = 34;
const HX = 4, HY = 8, BX = 4, BY = 18;

const shd = (h, d) => {
  const n = parseInt(h.slice(1), 16), c = (x) => Math.max(0, Math.min(255, x + d));
  return '#' + [c((n >> 16) & 255), c((n >> 8) & 255), c(n & 255)]
    .map((x) => x.toString(16).padStart(2, '0')).join('');
};

function brush(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return { c, x, P: (a, b, w2, h2, col) => { x.fillStyle = col; x.fillRect(a | 0, b | 0, w2 | 0, h2 | 0); } };
}

/* ── 표정 다섯 ── 2D 판의 얼굴 다섯을 그대로 잇습니다 */
function eyes(P, x0, y, st, side, L) {
  const ex = side ? (L ? x0 + 2 : x0 + 8) : null;
  const put = (px2, py2, w, h, c) => P(px2, py2, w, h, c);
  if (st === 'bad') {                     // 반쯤 감긴 눈 + 처진 입
    if (side) { put(ex, y + 1, 2, 2, INK); }
    else { put(x0 + 2, y + 1, 3, 2, INK); put(x0 + 7, y + 1, 3, 2, INK); }
    return 'frown';
  }
  if (st === 'warn') {
    if (side) { put(ex, y, 2, 3, INK); }
    else { put(x0 + 2, y, 3, 3, INK); put(x0 + 7, y, 3, 3, INK); }
    return 'flat';
  }
  if (st === 'recover') {                 // 웃는 눈 — 아래로 볼록한 호
    if (side) { put(ex, y + 2, 2, 1, INK); put(ex, y + 1, 1, 1, INK); }
    else { put(x0 + 2, y + 2, 3, 1, INK); put(x0 + 7, y + 2, 3, 1, INK);
      put(x0 + 1, y + 1, 1, 1, INK); put(x0 + 9, y + 1, 1, 1, INK); }
    return 'smile';
  }
  if (side) { put(ex, y, 2, 3, INK); put(ex, y, 1, 1, WHITE); }
  else { put(x0 + 2, y, 3, 3, INK); put(x0 + 7, y, 3, 3, INK);
    put(x0 + 2, y, 1, 1, WHITE); put(x0 + 7, y, 1, 1, WHITE); }
  return 'smile';
}

/* ── 머리 ── dir 0 앞 · 1 왼 · 2 오른 · 3 뒤 */
function head(P, C, dir, sp, L, st, dy, dx) {
  const back = dir === 3, side = dir === 1 || dir === 2;
  const LEFT = dir === 1;
  const x0 = HX + (side ? (LEFT ? -1 : 1) : 0) + (dx || 0), w = 12;
  const y0 = HY + (dy || 0);

  P(x0 + 1, y0, w - 2, 1, C.skin);
  P(x0, y0 + 1, w, 9, C.skin);
  P(x0 + 1, y0 + 10, w - 2, 1, C.skin);
  P(x0 + 1, y0 + 9, w - 2, 1, C.dark);

  if (!back) {
    if (side) {
      /* 옆얼굴은 **주둥이만** 내밉니다. 얼굴판을 넓게 깔면 흰 가면이 됩니다 */
      P(x0 + (LEFT ? 0 : 7), y0 + 6, 5, 3, C.face);
      P(x0 + (LEFT ? -2 : 12), y0 + 6, 2, 3, C.face);
    } else {
      P(x0 + 2, y0 + 5, 8, 4, C.face);
      P(x0 + 3, y0 + 9, 6, 1, C.face);
    }
  }

  /* ── 종의 표시 ── */
  if (sp === '기린') {
    [1, 8].forEach((d2) => { P(x0 + d2 + 1, y0 - 4, 2, 4, C.skin); P(x0 + d2, y0 - 6, 4, 2, C.extra); });
    P(x0 - 1, y0 + 2, 2, 3, C.skin); P(x0 + w - 1, y0 + 2, 2, 3, C.skin);
    if (!back) { P(x0 + 1, y0 + 1, 3, 2, C.extra); P(x0 + 8, y0 + 3, 3, 2, C.extra); }
    else { P(x0 + 2, y0 + 2, 3, 2, C.extra); P(x0 + 7, y0 + 5, 3, 2, C.extra); }
  } else if (sp === '알파카') {
    P(x0 + 1, y0 - 4, 10, 5, C.extra); P(x0, y0 - 2, 12, 3, C.extra);
    P(x0 + 2, y0 - 3, 2, 2, C.extra2); P(x0 + 8, y0 - 3, 2, 2, C.extra2);
    P(x0 - 2, y0 + 2, 2, 4, C.skin); P(x0 + w, y0 + 2, 2, 4, C.skin);
  } else if (sp === '햄스터') {
    P(x0 - 1, y0 - 3, 4, 4, C.skin); P(x0 + w - 3, y0 - 3, 4, 4, C.skin);
    P(x0, y0 - 2, 2, 2, C.extra); P(x0 + w - 2, y0 - 2, 2, 2, C.extra);
    if (!back && !side) { P(x0 - 2, y0 + 6, 3, 3, C.face); P(x0 + w - 1, y0 + 6, 3, 3, C.face); }
  } else if (sp === '고슴도치') {
    for (let i = 0; i < 6; i++) P(x0 + i * 2, y0 - 4, 2, 5, i % 2 ? C.extra2 : C.extra);
    P(x0 - 2, y0 - 1, 2, 4, C.extra2); P(x0 + w, y0 - 1, 2, 4, C.extra2);
    if (back) { P(x0, y0 + 1, w, 8, C.extra);
      for (let i = 0; i < 6; i++) P(x0 + i * 2, y0 + 2, 1, 6, C.extra2); }
  } else if (sp === '개구리') {
    [-1, 8].forEach((d2) => { P(x0 + d2, y0 - 4, 5, 5, C.skin);
      if (!back) { P(x0 + d2 + 1, y0 - 3, 3, 3, WHITE); P(x0 + d2 + 1, y0 - 2, 2, 2, INK); } });
  } else if (sp === '백조') {
    P(x0 + 4, y0 - 3, 4, 3, C.skin); P(x0 + 5, y0 - 5, 2, 2, C.skin);
  } else if (sp === '펭귄') {
    if (!back) P(x0 + (side ? (LEFT ? 1 : 3) : 3), y0 + 3, 6, 7, C.face);
    P(x0 + 4, y0 - 2, 4, 2, C.dark);
  } else if (sp === '거북이') {
    P(x0 + 3, y0 - 2, 6, 2, C.dark);
  }

  /* ── 눈 · 입 ── */
  if (!back) {
    const mouth = eyes(P, x0, y0 + 4, st, side, LEFT);
    if (side) {
      if (mouth === 'frown') P(LEFT ? x0 + 1 : x0 + 9, y0 + 8, 2, 1, INK);
      else P(LEFT ? x0 + 1 : x0 + 9, y0 + 7, 2, 1, INK);
      if (sp !== '펭귄' && sp !== '백조') P(x0 + 5, y0 + 7, 2, 1, BLUSH);
      if (sp === '백조' || sp === '펭귄') P(LEFT ? x0 - 3 : x0 + 13, y0 + 6, 2, 2, C.extra);
    } else {
      if (sp !== '펭귄' && sp !== '백조') { P(x0, y0 + 7, 2, 1, BLUSH); P(x0 + 10, y0 + 7, 2, 1, BLUSH); }
      if (mouth === 'frown') { P(x0 + 4, y0 + 9, 4, 1, INK); P(x0 + 3, y0 + 8, 1, 1, INK); P(x0 + 8, y0 + 8, 1, 1, INK); }
      else if (mouth === 'flat') P(x0 + 5, y0 + 8, 2, 1, INK);
      else { P(x0 + 5, y0 + 8, 2, 1, INK); P(x0 + 4, y0 + 7, 1, 1, INK); P(x0 + 7, y0 + 7, 1, 1, INK); }
      if (sp === '백조' || sp === '펭귄') { P(x0 + 5, y0 + 6, 2, 2, C.extra); P(x0 + 5, y0 + 8, 2, 1, C.extra2); }
    }
  }

  /* ── 안경 ── */
  if (!back && L.glassesId && L.glassesId !== 'none') {
    const gc = L.glassesId === 'sunglasses' ? '#2B2530' : L.glassesId === 'horn' ? '#3A3038' : '#8A7F6E';
    if (side) { P(LEFT ? x0 + 1 : x0 + 8, y0 + 3, 4, 4, gc); }
    else {
      P(x0 + 1, y0 + 3, 4, 4, gc); P(x0 + 7, y0 + 3, 4, 4, gc); P(x0 + 5, y0 + 4, 2, 1, gc);
      if (L.glassesId !== 'sunglasses') { P(x0 + 2, y0 + 4, 2, 2, C.face); P(x0 + 8, y0 + 4, 2, 2, C.face); }
    }
  }
  /* ── 모자 ── */
  if (L.hatId === 'cap') {
    P(x0, y0 - 3, 12, 4, L.hat); P(x0 + 1, y0 - 4, 10, 1, shd(L.hat, 18));
    if (!back) P(x0 + (side ? (LEFT ? -4 : 10) : 1), y0 + 0, side ? 6 : 10, 2, shd(L.hat, -24));
  } else if (L.hatId === 'beanie') {
    P(x0, y0 - 4, 12, 5, L.hat); P(x0 + 1, y0 - 6, 10, 2, shd(L.hat, 16));
    P(x0, y0 + 1, 12, 2, shd(L.hat, -26));
  } else if (L.hatId === 'grad_cap') {
    P(x0, y0 - 2, 12, 3, '#2B2530');
    P(x0 - 3, y0 - 5, 18, 3, '#241E2B');
    P(x0 + 13, y0 - 2, 2, 5, '#F2C14E');
  }
}

/* ── 몸 ── */
function body(P, C, L, dir, pose, sp) {
  const side = dir === 1 || dir === 2, back = dir === 3;
  const y = BY + pose.bob;
  const topC = L.topId === 'varsity' ? '#F4EDE0' : L.top;
  const topD = shd(topC, -34);
  const botC = L.bottom, botD = shd(botC, -30), shoC = L.shoes;
  const shorts = L.bottomId === 'shorts';

  /* ── 다리 ── */
  const ly = y + 8;
  if (pose.sit) {
    /* 앉기 — 허벅지가 앞으로 나오고 정강이가 내려갑니다 */
    P(BX + 2, ly - 1, 8, 3, botC);
    P(BX + 2, ly + 2, 3, 4, shorts ? C.skin : botD);
    P(BX + 7, ly + 2, 3, 4, shorts ? C.skin : botD);
    P(BX + 2, ly + 6, 4, 2, shoC); P(BX + 7, ly + 6, 4, 2, shoC);
  } else if (side) {
    const sw = pose.swing;
    P(BX + 4 + sw, ly, 3, 4, shorts ? C.skin : botC);
    P(BX + 4 + sw, ly + 4, 4, 2, shoC);
    P(BX + 5 - sw, ly, 3, 4, shorts ? C.skin : botD);
    P(BX + 5 - sw, ly + 4, 4, 2, shoC);
    if (shorts) { P(BX + 4 + sw, ly - 1, 3, 2, botC); P(BX + 5 - sw, ly - 1, 3, 2, botD); }
  } else {
    const a = pose.swing > 0 ? 0 : 1, b = pose.swing < 0 ? 0 : 1;
    P(BX + 2, ly, 3, 4 + a, shorts ? C.skin : botC); P(BX + 2, ly + 4 + a, 3, 2, shoC);
    P(BX + 7, ly, 3, 4 + b, shorts ? C.skin : botC); P(BX + 7, ly + 4 + b, 3, 2, shoC);
    if (shorts) { P(BX + 2, ly - 1, 3, 2, botC); P(BX + 7, ly - 1, 3, 2, botC); }
  }

  /* ── 몸통 ── 아래가 살짝 넓은 사다리꼴 */
  P(BX + 2, y, 8, 2, topC);
  P(BX + 1, y + 2, 10, 6, topC);
  P(BX + 1, y + 7, 10, 1, topD);
  P(BX + 2, y + 1, 8, 1, topD);
  if (L.topId === 'varsity') {          // 과잠 — 소매만 색이 다릅니다
    P(BX, y + 2, 2, 5, L.top); P(BX + 10, y + 2, 2, 5, L.top);
    P(BX + 5, y + 3, 2, 3, L.top);
  }
  if (L.topId === 'hoodie' && !back) P(BX + 3, y + 1, 6, 2, shd(topC, 22));
  if (L.topId === 'shirt' && !back) { P(BX + 5, y + 2, 2, 6, shd(topC, -18)); }

  /* ── 팔 ── */
  const aL = y + 3 + pose.armL, aR = y + 3 + pose.armR;
  P(BX, aL, 2, 4, topC);      P(BX, aL + 4, 2, 2, C.skin);
  P(BX + 10, aR, 2, 4, topC); P(BX + 10, aR + 4, 2, 2, C.skin);

  /* ── 등딱지 · 가방 ── */
  if (sp === '거북이') {
    if (back) { P(BX + 1, y, 10, 8, C.extra); P(BX + 2, y + 1, 8, 6, C.extra2);
      P(BX + 3, y + 2, 2, 2, C.extra); P(BX + 7, y + 2, 2, 2, C.extra); P(BX + 5, y + 4, 2, 2, C.extra); }
    else if (dir === 1) P(BX, y + 1, 2, 6, C.extra);
    else if (dir === 2) P(BX + 10, y + 1, 2, 6, C.extra);
    else { P(BX + 1, y + 2, 1, 5, C.extra); P(BX + 10, y + 2, 1, 5, C.extra); }
  } else if (L.bagId === 'backpack') {
    if (back) { P(BX + 3, y + 1, 6, 6, L.bagC); P(BX + 4, y + 2, 4, 2, shd(L.bagC, -26)); }
    else if (dir === 1) P(BX, y + 2, 2, 5, L.bagC);
    else if (dir === 2) P(BX + 10, y + 2, 2, 5, L.bagC);
  } else if (L.bagId === 'tote') {
    const bx = dir === 1 ? BX - 1 : BX + 10;
    if (!back) { P(bx, y + 5, 3, 4, L.bagC); P(bx + 1, y + 3, 1, 2, shd(L.bagC, -30)); }
  }
}

/* ── 자세 ── 걷기 · 서기 · 앉기 · 감정표현 */
function poseOf(kind, f, t) {
  const p = { bob: 0, swing: 0, armL: 0, armR: 0, sit: false, hdx: 0, hdy: 0, lift: 0 };
  const S = [0, 1, 0, -1];
  if (kind === 'walk') { p.swing = S[f & 3]; p.bob = (f & 1) ? 0 : 1; p.armL = -S[f & 3]; p.armR = S[f & 3]; }
  else if (kind === 'sit') { p.sit = true; p.bob = 2; }
  else if (kind === 'wave') { p.armR = -6 - (Math.sin(t * 14) > 0 ? 1 : 0); p.bob = 0; }
  else if (kind === 'clap') { const c = Math.sin(t * 16) > 0 ? 1 : 0; p.armL = -3; p.armR = -3; p.hdx = 0; p.bob = c; }
  else if (kind === 'yes') { p.hdy = Math.sin(t * 9) > 0 ? 2 : 0; }
  else if (kind === 'no') { p.hdx = Math.sin(t * 9) > 0 ? 2 : -2; }
  else if (kind === 'jump') { p.lift = Math.max(0, Math.round(Math.sin(t * 6) * 6)); p.armL = -5; p.armR = -5; }
  else if (kind === 'dance') { const s = Math.sin(t * 7); p.hdx = s > 0 ? 1 : -1; p.bob = s > 0 ? 0 : 1;
    p.armL = s > 0 ? -5 : 0; p.armR = s > 0 ? 0 : -5; }
  else if (kind === 'sad') { p.hdy = 3; p.bob = 2; p.armL = 2; p.armR = 2; }
  else if (kind === 'love') { p.armL = -4; p.armR = -4; p.bob = Math.sin(t * 8) > 0 ? 0 : 1; }
  else { p.bob = (Math.sin(t * 2.2) > 0) ? 0 : 1; }         // idle — 숨쉬기
  return p;
}

const CACHE = new Map();
let CACHE_N = 0;

/**
 * 한 컷. dir 0 앞 · 1 왼 · 2 오른 · 3 뒤.
 * kind 는 walk · idle · sit · 감정표현 여덟 중 하나, f 는 걷기 컷(0~3),
 * t 는 감정표현의 흐른 시간, st 는 표정, k 는 굽은 정도(0~1).
 */
export function frame(spec, look, dir, kind = 'idle', f = 0, t = 0, st = 'good', k = 0) {
  /* 저장된 옷은 색이 숫자(0x2DD4BF)로 들어 있습니다 — 그리기 전에 반드시
     문자열로 바꿔야 합니다. 'topId 가 있으면 그대로' 로 두었더니
     숫자가 색 계산으로 흘러 들어가 h.slice 가 터졌습니다. */
  const L = normalizeLook(look);
  const tq = kind === 'walk' || kind === 'sit' || kind === 'idle' ? 0 : Math.round(t * 12);
  const kq = Math.round(k * 4);
  const key = `${spec}|${L.topId}${L.top}|${L.bottomId}${L.bottom}|${L.shoesId}${L.shoes}|${L.hatId}${L.hat}|${L.glassesId}|${L.bagId}${L.bagC}|${dir}|${kind}|${f}|${tq}|${st}|${kq}`;
  let c = CACHE.get(key);
  if (c) return c;
  /* 표가 너무 커지면 오래된 것부터 버립니다 — 옷을 바꿔 가며 놀면 무한히 늡니다 */
  if (CACHE_N > 1400) { CACHE.clear(); CACHE_N = 0; }

  const C = SPECIES[spec] || SPECIES['거북이'];
  const p = poseOf(kind, f, tq / 12);
  const b = brush(FW, FH);
  b.P(6, FH - 2, 8, 1, 'rgba(38,44,60,.22)');
  b.P(5, FH - 3, 10, 1, 'rgba(38,44,60,.16)');
  b.x.save();
  b.x.translate(0, -p.lift);
  body(b.P, C, L, dir, p, spec);
  /* 굽은 정도 — 머리가 **앞으로 그리고 아래로** 나갑니다. 거북목입니다 */
  const kk = kq / 4;
  const fwd = dir === 1 ? -1 : dir === 2 ? 1 : 0;
  head(b.P, C, dir, spec, L, st,
    p.bob + p.hdy + Math.round(kk * 3),
    p.hdx + Math.round(kk * 2 * fwd));
  b.x.restore();
  c = b.c;
  CACHE.set(key, c); CACHE_N++;
  return c;
}

/** 화면에서 어느 쪽으로 걷는지 — 아이소는 세계 방향이 아니라 **화면 방향**입니다 */
export function dirOf(dx, dz) {
  const sx = dx - dz, sy = (dx + dz) * .5;
  if (Math.abs(sx) < 1e-6 && Math.abs(sy) < 1e-6) return 0;
  const a = Math.atan2(sy, sx);
  if (a > -Math.PI / 4 && a <= Math.PI / 4) return 2;        // 오른쪽
  if (a > Math.PI / 4 && a <= Math.PI * .75) return 0;       // 앞(아래)
  if (a > -Math.PI * .75 && a <= -Math.PI / 4) return 3;     // 뒤(위)
  return 1;                                                  // 왼쪽
}

/** 얼굴만 크게 — 오른쪽 위 얼굴 창에 씁니다 */
export function portrait(spec, look, st, k, scale = 4) {
  const src = frame(spec, look, 0, 'idle', 0, 0, st, k);
  const b = brush(14 * scale, 16 * scale);
  b.x.imageSmoothingEnabled = false;
  b.x.drawImage(src, 3, 2, 14, 16, 0, 0, 14 * scale, 16 * scale);
  return b.c;
}

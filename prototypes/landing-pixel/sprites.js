/* ══════════════════════════════════════════════════════════
   픽셀 스프라이트 — **코드로 굽습니다.**

   여덟 종 × 네 방향 × 걷기 네 컷 = 128장을 손으로 찍을 수는 없습니다.
   몸은 한 벌만 만들고 머리만 종마다 갈아 끼웁니다 — 3D 판에서 옷 하나로
   여덟이 다 입던 것과 같은 이유입니다.

   좌표는 **1픽셀이 1픽셀**입니다. 그려 놓고 정수배로 확대하므로
   중간에 소수점을 쓰면 그 순간 픽셀아트가 아니게 됩니다.

   칸 배치 (16 × 30)
     y 0~3    종의 표시(뿔 · 귀 · 가시)가 올라가는 자리
     y 4~14   머리
     y 14~22  몸통
     y 22~27  다리
     y 28~29  그림자
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

export const OUTFITS = [
  { top: '#2DD4BF', topD: '#1B9E8E', bottom: '#3E5C82', botD: '#2C4463', shoe: '#F2F2F2' },
  { top: '#E8695A', topD: '#B84335', bottom: '#4A4A58', botD: '#33333F', shoe: '#F6E8D2' },
  { top: '#F7F3E8', topD: '#D2CCBC', bottom: '#5B84C4', botD: '#41639C', shoe: '#8E6238' },
  { top: '#9B7BD4', topD: '#7050AE', bottom: '#3A3F4A', botD: '#282C35', shoe: '#F2F2F2' },
  { top: '#C0392B', topD: '#8E2418', bottom: '#3E465A', botD: '#2A3040', shoe: '#3E4A5A' },
  { top: '#63C47C', topD: '#3F9A57', bottom: '#6B4A2A', botD: '#4E351C', shoe: '#F2E4CE' },
  { top: '#F2C14E', topD: '#C99A2C', bottom: '#4A4038', botD: '#332C26', shoe: '#3A332C' },
  { top: '#5B84C4', topD: '#3B6099', bottom: '#30384A', botD: '#212734', shoe: '#F2F2F2' },
];

const INK = '#2B2530', WHITE = '#FFFFFF', BLUSH = '#F49CA4';
export const FRAME_W = 16, FRAME_H = 30;
const HX = 2, HY = 4, BX = 2, BY = 14;

function brush(w, h) {
  const c = (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined')
    ? new OffscreenCanvas(w, h) : document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  const P = (px, py, pw, ph, col) => { x.fillStyle = col; x.fillRect(px | 0, py | 0, pw | 0, ph | 0); };
  return { c, x, P };
}

/* ── 머리 ── 12 × 11. dir 0 앞 · 1 왼 · 2 오른 · 3 뒤 */
function head(P, C, dir, sp) {
  const back = dir === 3, side = dir === 1 || dir === 2;
  const L = dir === 1;                       // 왼쪽을 볼 때
  /* 옆을 볼 때는 머리를 한 칸 좁히고 그쪽으로 붙입니다 — 이것만으로 옆얼굴이 됩니다 */
  const x0 = HX + (side ? (L ? -1 : 1) : 0), w = 12;

  P(x0 + 1, HY, w - 2, 1, C.skin);
  P(x0, HY + 1, w, 9, C.skin);
  P(x0 + 1, HY + 10, w - 2, 1, C.skin);
  P(x0 + 1, HY + 9, w - 2, 1, C.dark);       // 턱 그늘

  if (!back) {
    if (side) {
      /* 옆얼굴은 **주둥이만** 내밉니다. 얼굴판을 넓게 깔았더니 흰 가면이었습니다. */
      P(x0 + (L ? 0 : 7), HY + 6, 5, 3, C.face);
      P(x0 + (L ? -2 : 12), HY + 6, 2, 3, C.face);
    } else {
      P(x0 + 2, HY + 5, 8, 4, C.face);
      P(x0 + 3, HY + 9, 6, 1, C.face);
    }
  }

  /* ── 종의 표시 ── 위쪽 네 칸을 씁니다 */
  if (sp === '기린') {
    [1, 8].forEach((dx) => { P(x0 + dx + 1, HY - 4, 2, 4, C.skin); P(x0 + dx, HY - 6, 4, 2, C.extra); });
    P(x0 - 1, HY + 2, 2, 3, C.skin); P(x0 + w - 1, HY + 2, 2, 3, C.skin);
    if (!back) { P(x0 + 1, HY + 1, 3, 2, C.extra); P(x0 + 8, HY + 3, 3, 2, C.extra); }
    else { P(x0 + 2, HY + 2, 3, 2, C.extra); P(x0 + 7, HY + 5, 3, 2, C.extra); }
  } else if (sp === '알파카') {
    P(x0 + 1, HY - 4, 10, 5, C.extra); P(x0, HY - 2, 12, 3, C.extra);
    P(x0 + 2, HY - 3, 2, 2, C.extra2); P(x0 + 8, HY - 3, 2, 2, C.extra2);
    P(x0 - 2, HY + 2, 2, 4, C.skin); P(x0 + w, HY + 2, 2, 4, C.skin);
  } else if (sp === '햄스터') {
    P(x0 - 1, HY - 3, 4, 4, C.skin); P(x0 + w - 3, HY - 3, 4, 4, C.skin);
    P(x0, HY - 2, 2, 2, C.extra); P(x0 + w - 2, HY - 2, 2, 2, C.extra);
    if (!back && !side) { P(x0 - 2, HY + 6, 3, 3, C.face); P(x0 + w - 1, HY + 6, 3, 3, C.face); }
  } else if (sp === '고슴도치') {
    for (let i = 0; i < 6; i++) P(x0 + i * 2, HY - 4, 2, 5, i % 2 ? C.extra2 : C.extra);
    P(x0 - 2, HY - 1, 2, 4, C.extra2); P(x0 + w, HY - 1, 2, 4, C.extra2);
    if (back) { P(x0, HY + 1, w, 8, C.extra);
      for (let i = 0; i < 6; i++) P(x0 + i * 2, HY + 2, 1, 6, C.extra2); }
  } else if (sp === '개구리') {
    [-1, 8].forEach((dx) => { P(x0 + dx, HY - 4, 5, 5, C.skin);
      if (!back) { P(x0 + dx + 1, HY - 3, 3, 3, WHITE); P(x0 + dx + 1, HY - 2, 2, 2, INK); } });
  } else if (sp === '백조') {
    P(x0 + 4, HY - 3, 4, 3, C.skin); P(x0 + 5, HY - 5, 2, 2, C.skin);
  } else if (sp === '펭귄') {
    if (!back) P(x0 + (side ? (L ? 1 : 3) : 3), HY + 3, 6, 7, C.face);
    P(x0 + 4, HY - 2, 4, 2, C.dark);
  } else if (sp === '거북이') {
    P(x0 + 3, HY - 2, 6, 2, C.dark);         // 정수리 그늘 — 딱지는 등에
  }

  /* ── 눈 · 입 ── */
  if (back) return;
  if (side) {
    const ex = L ? x0 + 2 : x0 + 8;
    P(ex, HY + 4, 2, 3, INK); P(ex, HY + 4, 1, 1, WHITE);
    P(L ? x0 + 1 : x0 + 9, HY + 7, 2, 1, INK);
    if (sp !== '펭귄' && sp !== '백조') P(L ? x0 + 5 : x0 + 5, HY + 7, 2, 1, BLUSH);
    if (sp === '백조' || sp === '펭귄') P(L ? x0 - 3 : x0 + 13, HY + 6, 2, 2, C.extra);
  } else {
    P(x0 + 2, HY + 4, 3, 3, INK); P(x0 + 7, HY + 4, 3, 3, INK);
    P(x0 + 2, HY + 4, 1, 1, WHITE); P(x0 + 7, HY + 4, 1, 1, WHITE);
    if (sp !== '펭귄' && sp !== '백조') { P(x0, HY + 7, 2, 1, BLUSH); P(x0 + 10, HY + 7, 2, 1, BLUSH); }
    P(x0 + 5, HY + 8, 2, 1, INK);
    if (sp === '백조' || sp === '펭귄') { P(x0 + 5, HY + 6, 2, 2, C.extra); P(x0 + 5, HY + 8, 2, 1, C.extra2); }
    if (sp === '햄스터') { P(x0 + 5, HY + 9, 1, 1, WHITE); P(x0 + 7, HY + 9, 1, 1, WHITE); }
  }
}

/* ── 몸 ── f 0~3 걷기 컷 */
function body(P, C, O, dir, f, sp) {
  const swing = [0, 1, 0, -1][f];
  const bob = (f === 1 || f === 3) ? 0 : 1;
  const y = BY + bob;
  const side = dir === 1 || dir === 2;

  /* 다리 */
  const ly = y + 8;
  if (side) {
    P(BX + 4 + swing, ly, 3, 4, O.bottom); P(BX + 4 + swing, ly + 4, 4, 2, O.shoe);
    P(BX + 5 - swing, ly, 3, 4, O.botD);   P(BX + 5 - swing, ly + 4, 4, 2, O.shoe);
  } else {
    const a = swing > 0 ? 0 : 1, b = swing < 0 ? 0 : 1;
    P(BX + 2, ly, 3, 4 + a, O.bottom); P(BX + 2, ly + 4 + a, 3, 2, O.shoe);
    P(BX + 7, ly, 3, 4 + b, O.bottom);  P(BX + 7, ly + 4 + b, 3, 2, O.shoe);
  }

  /* 몸통 — 아래가 살짝 넓은 사다리꼴 */
  P(BX + 2, y, 8, 2, O.top);
  P(BX + 1, y + 2, 10, 6, O.top);
  P(BX + 1, y + 7, 10, 1, O.topD);
  P(BX + 2, y + 1, 8, 1, O.topD);            // 옷깃
  /* 팔 */
  const aL = y + 3 + (side ? 0 : swing), aR = y + 3 - (side ? 0 : swing);
  P(BX, aL, 2, 4, O.top);      P(BX, aL + 4, 2, 2, C.skin);
  P(BX + 10, aR, 2, 4, O.top); P(BX + 10, aR + 4, 2, 2, C.skin);

  /* 거북이 등딱지 · 가방 */
  if (sp === '거북이') {
    if (dir === 3) { P(BX + 1, y, 10, 8, C.extra); P(BX + 2, y + 1, 8, 6, C.extra2);
      P(BX + 3, y + 2, 2, 2, C.extra); P(BX + 7, y + 2, 2, 2, C.extra); P(BX + 5, y + 4, 2, 2, C.extra); }
    else if (dir === 1) P(BX, y + 1, 2, 6, C.extra);
    else if (dir === 2) P(BX + 10, y + 1, 2, 6, C.extra);
    else { P(BX + 1, y + 2, 1, 5, C.extra); P(BX + 10, y + 2, 1, 5, C.extra); }
  } else if (dir === 3) {
    P(BX + 3, y + 1, 6, 6, '#4A6EA8'); P(BX + 4, y + 2, 4, 2, '#37548A');
  }
  return bob;
}

/** 한 컷 */
export function frame(sp, fit, dir, f) {
  const C = SPECIES[sp] || SPECIES['거북이'];
  const O = OUTFITS[((fit | 0) % OUTFITS.length + OUTFITS.length) % OUTFITS.length];
  const b = brush(FRAME_W, FRAME_H);
  b.P(4, FRAME_H - 2, 8, 1, 'rgba(38,44,60,.22)');
  b.P(3, FRAME_H - 3, 10, 1, 'rgba(38,44,60,.16)');
  const bob = body(b.P, C, O, dir, f, sp);
  b.x.save(); b.x.translate(0, bob);
  head(b.P, C, dir, sp);
  b.x.restore();
  return b.c;
}

/** 한 종 한 벌의 시트 — 가로 걷기컷 4, 세로 방향 4 */
export function sheet(sp, fit) {
  const b = brush(FRAME_W * 4, FRAME_H * 4);
  for (let d = 0; d < 4; d++) for (let f = 0; f < 4; f++)
    b.x.drawImage(frame(sp, fit, d, f), f * FRAME_W, d * FRAME_H);
  return b.c;
}

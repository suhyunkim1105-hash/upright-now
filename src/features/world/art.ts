/* ==================================================================
   기린캠퍼스 - 월드 그림·맵·존

   **이 파일은 손으로 고치지 마세요.** prototypes/openworld/index.html 에서
   자동으로 뽑아 옵니다. 고칠 곳은 프로토타입이고, 고친 뒤에

     node tools/port-world-art.mjs
     npx playwright test e2e/world-parity.spec.ts --project=chromium

   을 돌리면 여기가 따라옵니다. 대조검사가 픽셀 단위로 확인합니다.

   이 구간은 DOM 을 만지지 않습니다. document.createElement('canvas') 만
   쓰므로 import 시점에 안전합니다. 화면·입력·세션은 React 로 다시 짜므로
   여기 없습니다.

   타입이 느슨한 이유는 DECISIONS.md §7 에 있습니다. px() 에 number 를
   붙여 잡히는 버그는 없고, 타입이 일하는 곳은 WorldMap 같은 경계면입니다.
   ================================================================== */
/* eslint-disable */

/* ==================================================================
   기린캠퍼스 — 캠퍼스 오픈월드

   세 벌의 타일을 씁니다.
     urban.png    Kenney RPG Urban Pack (CC0) · 16px · 야외·캐릭터
     city.png     Kenney Roguelike Modern City (CC0) · 16px · 건물 외벽·지붕
     school48.png Cool School (CC0) · 48px · 학교 실내 가구

   Cool School 만 해상도가 다릅니다. 48 을 3 으로 나누면 정확히 16 이라,
   불러온 뒤 브라우저에서 한 번 줄여 같은 격자에 올립니다. 파일을 미리
   변환해 두지 않는 이유는 원본을 남겨야 다른 배율로 다시 뽑을 수
   있기 때문입니다.

   축소는 평균이 아니라 **최빈색**으로 합니다. 픽셀아트는 1px 외곽선이
   형태를 만드는데, 평균을 내면 그 선이 배경과 섞여 흐려집니다.
   ================================================================== */

const T = 16;        // 월드 타일 한 변
const SCALE = 4;     // 화면 확대 — 3 에서는 책상·의자가 너무 작았습니다
const U_COLS = 27;   // urban.png
const C_COLS = 37;   // city.png
const K_COLS = 16;   // school (축소 후)

/* ---------------- 바닥 ----------------
   시트를 픽셀 단위로 훑어 "완전히 채워지고 색 변화가 적은" 칸만
   골라낸 값입니다. 짐작한 숫자가 아닙니다. */
const F = { grass: 28, plaza: 36, beige: 109, gray: 117, water: 198,
            asphalt: 441, brickR: 72, brickO: 180 };

/* ---------------- 자동 타일 ----------------
   재질마다 3×3 테두리 세트가 시트에 들어 있습니다.
   [좌상 상 우상 / 좌 중앙 우 / 좌하 하 우하].

   이게 없으면 잔디에 회색 사각형을 오려 붙인 것처럼 보입니다. */
const AUTO = [
  null,
  { t: [  8,  9, 10,  35,  36,  37,  62,  63,  64] },  // 1 광장 포장
  { t: [ 81, 82, 83, 108, 109, 110, 135, 136, 137] },  // 2 베이지
  { t: [ 89, 90, 91, 116, 117, 118, 143, 144, 145] },  // 3 회색
  { t: [170,171,172, 197, 198, 199, 224, 225, 226] },  // 4 물
  { t: [  0,  1,  2,  27,  28,  29,  54,  55,  56] },  // 5 잔디
];
const M = { PLAZA: 1, BEIGE: 2, GRAY: 3, WATER: 4, GRASS: 5 };

const K = (c: any, r: any) => r * K_COLS + c;   // 학교 시트 색인
const C = (c: any, r: any) => r * C_COLS + c;   // 도시 시트 색인

/* ---------------- 소품 ----------------
   s 는 시트 ('u' 야외 / 'c' 도시 / 'k' 학교).
   책상 한 칸짜리는 책상으로 안 보입니다. 도서관 열람석은 3칸짜리
   긴 책상을 쓰고 위아래로 의자를 붙여 6인석으로 만듭니다. */
const PROP: Record<string, any> = {
  tree:     { s:'u', w:1, h:3, t:[[232],[259],[286]], c:[[0],[1],[1]] },
  treeAut:  { s:'u', w:1, h:3, t:[[313],[340],[367]], c:[[0],[1],[1]] },
  treeBig:  { s:'u', w:3, h:3, t:[[234,235,236],[261,262,263],[288,289,290]],
                                c:[[0,0,0],[0,1,0],[0,1,0]] },
  bush:     { s:'u', w:1, h:1, t:[[292]], c:[[1]] },
  bushAut:  { s:'u', w:1, h:1, t:[[373]], c:[[1]] },
  bench:    { s:'u', w:1, h:1, t:[[223]], c:[[1]] },
  benchAlt: { s:'u', w:1, h:1, t:[[250]], c:[[1]] },
  lamp:     { s:'u', w:1, h:2, t:[[1],[28]], c:[[0],[1]] },
  bin:      { s:'u', w:1, h:1, t:[[254]], c:[[1]] },
  vending:  { s:'u', w:1, h:2, t:[[251],[278]], c:[[1],[1]] },
  vending2: { s:'u', w:1, h:2, t:[[305],[332]], c:[[1],[1]] },
  doorWood: { s:'u', w:1, h:1, t:[[283]], c:[[0]] },

  tableLong:{ s:'k', w:3, h:2, t:[[K(0,4),K(1,4),K(2,4)],[K(0,5),K(1,5),K(2,5)]],
                                c:[[1,1,1],[1,1,1]] },
  tableLong2:{s:'k', w:3, h:2, t:[[K(0,6),K(1,6),K(2,6)],[K(0,7),K(1,7),K(2,7)]],
                                c:[[1,1,1],[1,1,1]] },
  deskA:    { s:'k', w:1, h:2, t:[[K(0,2)],[K(0,3)]], c:[[1],[1]] },
  deskB:    { s:'k', w:1, h:2, t:[[K(1,2)],[K(1,3)]], c:[[1],[1]] },
  deskC:    { s:'k', w:1, h:2, t:[[K(3,2)],[K(3,3)]], c:[[1],[1]] },
  chair:    { s:'k', w:1, h:1, t:[[K(3,6)]], c:[[1]], sit:true },
  chairB:   { s:'k', w:1, h:1, t:[[K(4,6)]], c:[[1]], sit:true },
  chairC:   { s:'k', w:1, h:1, t:[[K(5,6)]], c:[[1]], sit:true },
  chairD:   { s:'k', w:1, h:1, t:[[K(6,6)]], c:[[1]], sit:true },
  bookcase: { s:'k', w:1, h:3, t:[[K(6,3)],[K(6,4)],[K(6,5)]], c:[[1],[1],[1]] },
  bookcase2:{ s:'k', w:1, h:3, t:[[K(7,3)],[K(7,4)],[K(7,5)]], c:[[1],[1],[1]] },
  shelfLow: { s:'k', w:1, h:2, t:[[K(6,1)],[K(6,2)]], c:[[1],[1]] },
  shelfLow2:{ s:'k', w:1, h:2, t:[[K(7,1)],[K(7,2)]], c:[[1],[1]] },
  lockers:  { s:'k', w:3, h:2, t:[[K(3,4),K(4,4),K(5,4)],[K(3,5),K(4,5),K(5,5)]],
                                c:[[1,1,1],[1,1,1]] },
  drawers:  { s:'k', w:2, h:2, t:[[K(0,8),K(1,8)],[K(0,9),K(1,9)]], c:[[1,1],[1,1]] },
  board:    { s:'k', w:2, h:1, t:[[K(6,0),K(7,0)]], c:[[1,1]] },
  poster:   { s:'k', w:3, h:2, t:[[K(3,0),K(4,0),K(5,0)],[K(3,1),K(4,1),K(5,1)]],
                                c:[[1,1,1],[1,1,1]] },
  windowK:  { s:'k', w:2, h:2, t:[[K(1,0),K(2,0)],[K(1,1),K(2,1)]], c:[[1,1],[1,1]] },
  plant:    { s:'k', w:1, h:1, t:[[K(3,7)]], c:[[1]] },
  plant2:   { s:'k', w:1, h:1, t:[[K(4,7)]], c:[[1]] },
  plantS:   { s:'k', w:1, h:1, t:[[K(5,7)]], c:[[1]] },
  pc:       { s:'k', w:1, h:1, t:[[K(2,8)]], c:[[1]] },
  laptop:   { s:'k', w:1, h:1, t:[[K(4,8)]], c:[[0]] },
  monitor:  { s:'k', w:1, h:1, t:[[K(6,8)]], c:[[1]] },
  tv:       { s:'k', w:1, h:1, t:[[K(5,8)]], c:[[1]] },
  books:    { s:'k', w:1, h:1, t:[[K(4,9)]], c:[[0]] },
  phone:    { s:'k', w:1, h:1, t:[[K(2,9)]], c:[[1]] },
};

/* ==================================================================
   건물 픽셀 그리기

   Kenney 타일로는 돔도 첨탑도 만들 수 없습니다. 시트에 없는 형태라
   조합으로는 안 나옵니다. 그래서 건물은 **한 장씩 직접 그립니다** —
   조감도(campus-map.html)와 같은 팔레트, 같은 실루엣으로.

   위에서 내려다보는 건물은 지붕이 대부분이고 아래 두 줄만 정면입니다.
   빛은 왼쪽 위에서 옵니다 — 밝은 면은 위·왼쪽, 그림자는 아래·오른쪽.
   이 규칙을 어기면 어느 것이 지붕이고 어느 것이 벽인지 안 보입니다.
   ================================================================== */

function px(g: CanvasRenderingContext2D, x: any, y: any, w: any, h: any, c: any) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); }

/** 원. 픽셀아트라 안티앨리어싱 없이 정수 격자로 채웁니다. */
function disc(g: CanvasRenderingContext2D, cx: any, cy: any, r: any, c: any) {
  g.fillStyle = c;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y));
    g.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
}
/** 원 테두리 한 겹 */
function circleLine(g: CanvasRenderingContext2D, cx: any, cy: any, r: any, c: any) {
  g.fillStyle = c;
  for (let a = 0; a < 360; a += 2) {
    const t = a * Math.PI / 180;
    g.fillRect(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), 1, 1);
  }
}

/**
 * 건물 한 채를 캔버스에 그립니다.
 * spec.roofRows 만큼 지붕, 나머지 두 줄이 정면입니다.
 */
function paintBuilding(spec: any) {
  const W = spec.w * T, H = spec.h * T;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const P = spec.pal;
  const faceY = H - T * 2;          // 정면이 시작하는 줄

  /* ---- 지붕 ---- */
  px(g, 0, 0, W, faceY, P.roof);
  /* 처마 — 바깥 한 겹을 어둡게 두르면 건물이 바닥에서 떨어져 보입니다 */
  px(g, 0, 0, W, 2, P.lit);
  px(g, 0, 0, 2, faceY, P.lit);
  px(g, W - 3, 0, 3, faceY, P.dark);
  px(g, 0, faceY - 3, W, 3, P.dark);
  /* 지붕 패널 이음선 — 밋밋한 색면을 지붕으로 만듭니다 */
  g.fillStyle = P.dark;
  for (let x = 10; x < W - 4; x += 12) g.fillRect(x, 3, 1, faceY - 6);
  g.fillStyle = P.lit;
  for (let x = 11; x < W - 4; x += 12) g.fillRect(x, 3, 1, faceY - 6);

  if (spec.ridge) {
    /* 박공 마룻대 — 길이 방향으로 밝은 띠 하나. 도서관처럼 긴 동에 씁니다. */
    const my = Math.floor(faceY * 0.42);
    px(g, 4, my - 3, W - 8, 3, P.lit);
    px(g, 4, my, W - 8, 2, P.dark);
  }

  /* ---- 옥상 기물 ---- */
  (spec.features || []).forEach((f: any) => {
    const fx = f.x * T, fy = f.y * T;
    if (f.k === 'dome') {
      /* 돔 — 위에서 보면 동심원입니다. 왼쪽 위가 밝습니다. */
      disc(g, fx, fy, f.r + 2, P.dark);
      disc(g, fx, fy, f.r, f.c);
      disc(g, fx - Math.round(f.r * 0.22), fy - Math.round(f.r * 0.22),
           Math.round(f.r * 0.62), f.lit);
      disc(g, fx - Math.round(f.r * 0.3), fy - Math.round(f.r * 0.3),
           Math.round(f.r * 0.3), f.hi || '#FFFFFF');
      /* 살 — 격자가 없으면 공으로 보입니다 */
      g.fillStyle = f.rib || P.dark;
      for (let a = 0; a < 8; a++) {
        const t = a * Math.PI / 4;
        /* 살은 가장자리에서 시작해 안쪽으로 들어옵니다. 중심까지 그으면
           한 점에 여덟 줄이 몰려 검은 얼룩이 됩니다. */
        for (let d = Math.round(f.r * 0.3); d < f.r - 1; d++) {
          const px_ = Math.round(fx + Math.cos(t) * d), py_ = Math.round(fy + Math.sin(t) * d);
          g.fillRect(px_, py_, 2, 2);
        }
      }
      circleLine(g, fx, fy, Math.round(f.r * 0.66), f.rib || P.dark);
      if (f.icon) roofIcon(g, f.icon, fx, fy);
      else disc(g, fx, fy, 3, f.lantern || '#F4F7C8');
    }
    else if (f.k === 'cone') {
      /* 원뿔 — 위에서 보면 동심원이고, 꼭짓점만 위로 올라갑니다.
         좌우로도 밀면 나선으로 보입니다. */
      disc(g, fx, fy, f.r + 2, P.dark);
      disc(g, fx, fy, f.r, f.c);
      for (let d = f.r; d >= 1; d--) {
        const t = 1 - d / f.r;
        const shade = t < 0.3 ? f.c : t < 0.62 ? f.lit : (f.hi || '#FFE7C8');
        disc(g, fx, fy - Math.round(t * f.r * 0.34), d, shade);
      }
      /* 꼭짓점 */
      disc(g, fx, fy - Math.round(f.r * 0.34), 2, '#FFF3DC');
      if (f.icon) roofIcon(g, f.icon, fx, fy - Math.round(f.r * 0.34) - 9, f.hi || '#FFE7C8');
    }
    else if (f.k === 'spire') {
      /* 시계탑 — 사각 탑 위에 계단식 피라미드 지붕, 꼭대기에 라임 시계판.
         캠퍼스에서 브랜드색이 나오는 유일한 건축 요소입니다. */
      const s = f.r;
      px(g, fx - s - 2, fy - s - 2, s * 2 + 4, s * 2 + 4, P.dark);
      px(g, fx - s, fy - s, s * 2, s * 2, f.c);
      px(g, fx - s, fy - s, s * 2, 3, f.lit);
      px(g, fx - s, fy - s, 3, s * 2, f.lit);
      /* 계단식 지붕 — 층마다 한 칸씩 좁아지며 밝아집니다 */
      const steps = Math.floor(s / 2.4);
      for (let k = 0; k < steps; k++) {
        const q = s - 3 - k * 2.2;
        if (q < 3) break;
        px(g, fx - q, fy - q - k, q * 2, q * 2, k % 2 ? f.lit : f.c);
        px(g, fx - q, fy - q - k, q * 2, 2, '#93B4D6');
      }
      /* 시계판 — 지난 판은 코랄 원판에 막대 둘이라 접시였습니다.
         눈금 열둘과 두 바늘이 있어야 시계로 읽힙니다. */
      roofIcon(g, 'clock', fx, fy - steps + 1, 11);
      /* 피뢰침 */
      px(g, fx - 1, fy - s - 8, 2, 8, '#C8D2DC');
      disc(g, fx, fy - s - 9, 2, '#FF6B52');
    }
    else if (f.k === 'deck') {
      px(g, fx, fy, f.w * T, f.h * T, P.dark);
      px(g, fx + 2, fy + 2, f.w * T - 4, f.h * T - 4, f.c);
      g.fillStyle = f.lit;
      for (let x = fx + 4; x < fx + f.w * T - 4; x += 5) g.fillRect(x, fy + 3, 1, f.h * T - 6);
    }
    else if (f.k === 'medal') {
      /* 지붕에 바로 얹는 상징. 돔이나 원뿔이 없는 건물도 문패를
         달 수 있어야 합니다. */
      roofIcon(g, f.icon, fx, fy, f.r);
    }
    else if (f.k === 'tank') {
      disc(g, fx, fy, f.r + 1, P.dark);
      disc(g, fx, fy, f.r, '#B9C2C8');
      disc(g, fx - 1, fy - 2, Math.max(1, f.r - 3), '#E2E8EC');
    }
    else if (f.k === 'sky') {
      /* 채광창 — 열람실 위에 줄지어 앉습니다 */
      for (let i = 0; i < f.n; i++) {
        const sx = fx + i * (f.gap * T);
        px(g, sx, fy, 10, 14, P.dark);
        px(g, sx + 1, fy + 1, 8, 12, '#8FC6D8');
        px(g, sx + 1, fy + 1, 8, 4, '#C4E4EE');
      }
    }
  });

  /* ---- 정면 ----
     위 한 줄은 창문 층, 아래 한 줄은 출입구. */
  const wallY = faceY;
  px(g, 0, wallY, W, T * 2, P.wall);
  px(g, 0, wallY, W, 3, P.trim);                 // 지붕과 벽 사이 띠
  px(g, 0, wallY + 3, W, 1, P.lit);
  /* 주춧돌 — 벽이 잔디에서 바로 솟으면 세워 둔 종잇장으로 보입니다 */
  px(g, 0, H - 8, W, 8, P.wallDark);
  px(g, 0, H - 8, W, 1, P.trim);
  px(g, 0, H - 3, W, 3, 'rgba(0,0,0,.28)');
  /* 모서리 벽기둥 — 벽의 양 끝을 잡아 줍니다 */
  [0, W - 7].forEach((x) => {
    px(g, x, wallY, 7, T * 2 - 8, P.wallDark);
    px(g, x + 1, wallY + 4, 5, T * 2 - 12, P.wall);
    for (let y = wallY + 6; y < H - 10; y += 6) px(g, x + 1, y, 5, 1, P.wallDark);
  });

  const doorX = ((spec.w >> 1) - 1) * T;
  /* 창문 — 건물마다 양식이 다릅니다. 색보다 형태가 성격을 말합니다. */
  const step = spec.win === 'shop' ? 16 : spec.win === 'grid' ? 11 : 13;
  let wi = 0;
  for (let x = 9; x < W - 14; x += step) {
    if (x + 10 > doorX - 12 && x < doorX + T * 2 + 14) continue;
    paintWindow(g, spec.win, x, wallY, P);
    /* 셋 중 하나는 불이 켜져 있습니다. 전부 같은 유리면 벽지입니다. */
    if (wi % 3 === 1) {
      px(g, x + 2, wallY + 6, 6, 9, 'rgba(255,214,138,.72)');
      px(g, x + 2, wallY + 6, 6, 3, 'rgba(255,240,200,.82)');
    }
    wi++;
  }
  /* ---- 출입구 ----
     들어가는 곳은 **한눈에** 보여야 합니다. 캐노피 한 겹으로는
     창 사이의 빈칸과 구분이 안 갑니다. 차양 · 유리문 · 계단 · 등,
     넷을 겹쳐 문 주변만 다른 리듬을 갖게 했습니다. */
  const dW = T * 2, dL = doorX - 8, dR = doorX + dW + 8;
  /* 벽감 — 문 둘레를 한 단 들여 그림자를 만듭니다 */
  px(g, dL, wallY + 3, dR - dL, T * 2 - 5, P.wallDark);
  px(g, dL + 1, wallY + 4, dR - dL - 2, T * 2 - 7, P.wall);
  /* 코랄 차양 — 캠퍼스에서 브랜드색이 벽에 닿는 유일한 자리입니다 */
  px(g, dL - 2, wallY + 4, dR - dL + 4, 9, '#B93E2A');
  for (let x = dL - 1; x < dR + 1; x += 6) {
    px(g, x, wallY + 5, 3, 7, '#FF6B52');
    px(g, x + 3, wallY + 5, 3, 7, '#FFF2EE');
  }
  px(g, dL - 2, wallY + 4, dR - dL + 4, 2, 'rgba(255,255,255,.34)');
  /* 차양 아랫단 — 물결이 있어야 천입니다 */
  for (let x = dL - 2; x < dR + 2; x += 6) {
    disc(g, x + 3, wallY + 13, 3, '#B93E2A');
    disc(g, x + 3, wallY + 12, 3, (x - dL) % 12 ? '#FF6B52' : '#FFF2EE');
  }
  /* 유리문 두 짝 */
  px(g, doorX - 2, wallY + 16, dW + 4, T * 2 - 22, P.frame);
  px(g, doorX, wallY + 18, dW, T * 2 - 25, '#24384C');
  px(g, doorX, wallY + 18, dW, 4, '#4E6C88');
  g.fillStyle = 'rgba(255,255,255,.30)';
  for (let i = 0; i < 9; i++) g.fillRect(doorX + 3 + i, wallY + 27 - i, 2, 1);
  for (let i = 0; i < 9; i++) g.fillRect(doorX + dW / 2 + 3 + i, wallY + 27 - i, 2, 1);
  px(g, doorX + T - 1, wallY + 18, 2, T * 2 - 25, P.frame);
  px(g, doorX + T - 4, wallY + 24, 2, 4, '#D8DEE4');
  px(g, doorX + T + 2, wallY + 24, 2, 4, '#D8DEE4');
  /* 계단 — 문 아래 두 단. 바닥에 닿는 곳이 있어야 서 있는 건물입니다. */
  px(g, doorX - 5, H - 8, dW + 10, 4, '#D8D2C6');
  px(g, doorX - 7, H - 4, dW + 14, 4, '#C2BBAE');
  px(g, doorX - 5, H - 8, dW + 10, 1, '#EDE8DE');
  /* 문 옆 등 — 어디로 들어가는지 밤에도 보입니다 */
  [dL - 4, dR + 1].forEach((x) => {
    px(g, x, wallY + 16, 4, 3, '#3A4652');
    px(g, x, wallY + 19, 4, 5, '#FFD98A');
    px(g, x + 1, wallY + 20, 2, 3, '#FFF6DC');
    px(g, x + 1, wallY + 24, 2, 4, '#3A4652');
  });

  /* 기둥 — 도서관 포르티코 */
  if (spec.portico) {
    const n = spec.portico;
    const step = W / (n + 1);
    for (let i = 1; i <= n; i++) {
      const cx = Math.round(i * step) - 3;
      if (cx > doorX - 8 && cx < doorX + T * 2 + 4) continue;
      px(g, cx, wallY + 4, 6, T * 2 - 7, P.wallDark);
      px(g, cx, wallY + 4, 4, T * 2 - 7, '#F2EDE0');
      px(g, cx - 1, wallY + 3, 8, 3, P.trim);
    }
  }

  return c;
}

/** 그린 캔버스를 소품으로 등록합니다. 충돌 격자는 문만 뚫어 둡니다. */
function buildingProp(spec: any) {
  const canvas = paintBuilding(spec);
  const doorX = (spec.w >> 1) - 1;
  const c: number[][] = [];
  for (let j = 0; j < spec.h; j++) {
    c.push([]);
    for (let i = 0; i < spec.w; i++) {
      const isDoor = j === spec.h - 1 && (i === doorX || i === doorX + 1);
      c[j].push(isDoor ? 0 : 1);
    }
  }
  return { s: 'img', canvas, w: spec.w, h: spec.h, c, t: null, doorX };
}

/* ==================================================================
   건물 상징 · 창문 · 실내

   겉과 속의 결이 다르면 문을 지날 때마다 다른 게임에 들어간 것 같습니다.
   그래서 실내 벽도 같은 팔레트, 같은 손으로 그립니다.

   그리고 건물마다 **말하는 물건**을 하나씩 얹습니다 — 도서관 돔 위에는
   책, 학생회관 돔 위에는 트로피. 색과 지붕 모양만으로는 "저기가 무슨
   건물인지"까지 말하지 못합니다.
   ================================================================== */

/** 지붕 꼭대기 상징. 8~14px 안에서 실루엣만으로 읽혀야 합니다. */
/* ---- 지붕 상징 ----
   지붕 색만으로 건물을 가리면 사용자가 색을 외워야 합니다. 상징이 있으면
   처음 온 사람도 압니다. 그러려면 **멀리서 읽혀야** 하고, 지붕색이
   주황이든 청록이든 같은 대비가 나와야 합니다.

   그래서 상징을 맨살에 그리지 않고 메달에 얹습니다 — 어두운 테 · 밝은
   바탕 · 상징. 지붕이 무엇이든 상징은 늘 밝은 바탕 위 검정입니다.
   지난 판은 상징을 지붕에 바로 그려서, 도서관 책은 청록 위 흰색이라
   보였지만 기숙사 달은 주황 위 아이보리라 뭉개져 있었습니다. */
function roofIcon(g: CanvasRenderingContext2D, kind: any, cx: any, cy: any, R?: any) {
  R = R || 13;
  const ink = '#22303F';
  /* 메달 */
  disc(g, cx, cy + 2, R + 1, 'rgba(0,0,0,.28)');
  disc(g, cx, cy, R, ink);
  disc(g, cx, cy, R - 2, '#EFE7D6');
  disc(g, cx - 1, cy - 1, R - 3, '#FBF7EC');
  circleLine(g, cx, cy, R - 4, 'rgba(34,48,63,.14)');

  if (kind === 'book') {
    /* 펼친 책 — 위에서 봅니다. 등이 가운데서 꺾이고, 바깥쪽 세 겹이
       종이 두께입니다. 두께가 없으면 종이 두 장으로 보입니다. */
    const w = 9, hh = 7;
    px(g, cx - w - 1, cy - hh, w * 2 + 2, hh * 2, ink);
    [-1, 1].forEach((s) => {
      const x0 = s < 0 ? cx - w : cx + 1;
      px(g, x0, cy - hh + 1, w, hh * 2 - 2, '#FFFDF6');
      px(g, x0, cy - hh + 1, w, 2, '#E4DBC6');            // 위쪽 그늘
      /* 종이 두께 — 바깥 모서리에 층을 셋 */
      for (let k = 0; k < 3; k++)
        px(g, s < 0 ? x0 - 1 + k : x0 + w - k, cy - hh + 2 + k, 1, hh * 2 - 4 - k * 2, '#CFC4AB');
      /* 글줄 */
      g.fillStyle = '#9AA7B4';
      for (let k = 0; k < 4; k++) g.fillRect(x0 + 2, cy - 3 + k * 2, w - 4, 1);
    });
    px(g, cx - 1, cy - hh - 1, 3, hh * 2 + 2, ink);       // 등
    px(g, cx, cy - hh, 1, hh * 2, '#4A5C6E');
    /* 코랄 갈피끈 — 브랜드색이 상징 안에서 한 번 나옵니다 */
    px(g, cx + 4, cy + hh - 2, 2, 6, '#FF6B52');
    px(g, cx + 4, cy + hh + 3, 2, 2, '#D8442C');
  }
  else if (kind === 'trophy') {
    /* 우승컵 — 명예의 전당. 손잡이가 없으면 화분입니다. */
    /* 손잡이 먼저 — 컵 뒤로 들어가야 붙어 보입니다 */
    [-1, 1].forEach((s) => {
      const x = cx + s * 8;
      px(g, x - 1, cy - 7, 3, 8, ink);
      px(g, x + (s < 0 ? 1 : -1), cy - 6, 1, 6, '#C8A33A');
      px(g, cx + s * 5, cy - 8, 4, 2, ink);
      px(g, cx + s * 5, cy - 2, 4, 2, ink);
    });
    /* 잔 — 위가 넓고 아래로 좁아집니다 */
    px(g, cx - 7, cy - 9, 14, 3, ink);
    px(g, cx - 6, cy - 8, 12, 2, '#FFE9A0');
    for (let k = 0; k < 6; k++)
      px(g, cx - 6 + k, cy - 6 + k, 12 - k * 2, 1, k < 2 ? '#F2C64A' : k < 4 ? '#D9A82F' : '#B8891F');
    px(g, cx - 5, cy - 6, 2, 4, '#FFF3C4');              // 광
    /* 별 — 잔 한가운데 */
    px(g, cx - 1, cy - 5, 3, 3, '#FFFBE8');
    px(g, cx - 2, cy - 4, 5, 1, '#FFFBE8');
    px(g, cx, cy - 6, 1, 5, '#FFFBE8');
    /* 자루와 받침 */
    px(g, cx - 1, cy, 3, 4, '#B8891F');
    px(g, cx - 4, cy + 4, 9, 2, '#D9A82F');
    px(g, cx - 6, cy + 6, 13, 3, ink);
    px(g, cx - 5, cy + 6, 11, 2, '#C8A33A');
  }
  else if (kind === 'moon') {
    /* 초승달과 별 — 기숙사. 잠드는 곳입니다.
       달은 원 두 개의 차이입니다. 바탕이 메달 안쪽 색이므로 그 색으로
       덮으면 깨끗하게 깎입니다 — 캔버스를 뚫으면 지붕이 비칩니다. */
    const bg = '#FBF7EC';
    disc(g, cx - 2, cy, 8, ink);
    disc(g, cx - 2, cy, 7, '#E0A526');
    disc(g, cx - 2, cy - 1, 6, '#FFCE55');
    disc(g, cx - 4, cy - 2, 4, '#FFE9A8');
    /* 깎아 냅니다. 바탕색으로 덮어야 합니다 — 캔버스를 뚫으면
       그 자리에 지붕이 비칩니다. */
    disc(g, cx + 4, cy - 2, 7, bg);
    disc(g, cx + 5, cy - 3, 7, bg);
    /* 곰보 — 없으면 손톱 조각입니다 */
    disc(g, cx - 5, cy + 2, 2, '#E0A526');
    disc(g, cx - 3, cy + 5, 1, '#E0A526');
    /* 별 셋, 크기를 다르게 */
    const star = (x: any, y: any, s: any) => {
      px(g, x, y - s, 1, s * 2 + 1, ink);
      px(g, x - s, y, s * 2 + 1, 1, ink);
      px(g, x, y - s + 1, 1, s * 2 - 1, '#FFF6D2');
      px(g, x - s + 1, y, s * 2 - 1, 1, '#FFF6D2');
    };
    star(cx + 7, cy - 5, 2);
    star(cx + 6, cy + 4, 1);
    star(cx + 2, cy + 8, 1);
  }
  else if (kind === 'clock') {
    /* 시계 — 본관. 열두 눈금 중 넷은 굵게. 눈금이 없으면 접시입니다. */
    disc(g, cx, cy, R - 3, '#FBF7EC');
    circleLine(g, cx, cy, R - 3, '#3C5C82');
    g.fillStyle = '#3C5C82';
    for (let k = 0; k < 12; k++) {
      const t = k * Math.PI / 6, big = k % 3 === 0;
      const r0 = R - 4, r1 = R - (big ? 8 : 6);
      for (let d = r1; d <= r0; d++)
        g.fillRect(Math.round(cx + Math.sin(t) * d), Math.round(cy - Math.cos(t) * d), big ? 2 : 1, big ? 2 : 1);
    }
    /* 바늘 — 10시 10분. 두 바늘이 겹치지 않는 각도라 시계로 읽힙니다. */
    const hand = (ang: any, len: any, wdt: any, col: any) => {
      g.fillStyle = col;
      for (let d = 0; d <= len; d++)
        g.fillRect(Math.round(cx + Math.sin(ang) * d) - (wdt >> 1),
                   Math.round(cy - Math.cos(ang) * d) - (wdt >> 1), wdt, wdt);
    };
    hand(-Math.PI / 3, R - 7, 3, '#22303F');   // 시침 — 10시
    hand(Math.PI / 6, R - 5, 2, '#22303F');    // 분침 — 10분
    disc(g, cx, cy, 2, '#FF6B52');
    disc(g, cx, cy, 1, '#8E2E1C');
  }
}

/** 창문. 건물의 성격이 가장 많이 드러나는 자리입니다. */
function paintWindow(g: CanvasRenderingContext2D, style: any, x: any, y: any, P: any) {
  if (style === 'arch') {
    /* 아치창 — 도서관. 위가 둥글면 오래된 열람실이 됩니다. */
    px(g, x, y + 3, 10, 14, P.frame);
    disc(g, x + 5, y + 4, 5, P.frame);
    px(g, x + 1, y + 4, 8, 12, P.glass);
    disc(g, x + 5, y + 4, 4, P.glass);
    px(g, x + 1, y + 4, 8, 3, P.glassLit);
    px(g, x + 4, y, 2, 17, P.frame);
    px(g, x + 1, y + 9, 8, 1, P.frame);
  } else if (style === 'tall') {
    /* 격자 큰창 — 본관. 관공서처럼 반듯합니다. */
    px(g, x - 1, y + 1, 12, 17, P.frame);
    px(g, x, y + 2, 10, 15, P.glass);
    px(g, x, y + 2, 10, 4, P.glassLit);
    px(g, x + 4, y + 2, 2, 15, P.frame);
    px(g, x, y + 8, 10, 1, P.frame);
    px(g, x - 2, y, 14, 2, P.trim);
  } else if (style === 'grid') {
    /* 작은 창이 규칙적으로 — 기숙사 */
    px(g, x, y + 4, 8, 7, P.frame);
    px(g, x + 1, y + 5, 6, 5, P.glass);
    px(g, x, y + 12, 8, 7, P.frame);
    px(g, x + 1, y + 13, 6, 5, P.glass);
  } else if (style === 'shop') {
    /* 넓은 상점 창에 차양 — 학생회관 */
    px(g, x - 2, y + 6, 14, 12, P.frame);
    px(g, x - 1, y + 7, 12, 10, P.glass);
    px(g, x - 1, y + 7, 12, 3, P.glassLit);
    for (let i = 0; i < 4; i++) {
      px(g, x - 2 + i * 4, y + 2, 2, 4, i % 2 ? '#E8EDF2' : '#C96C4E');
    }
    px(g, x - 3, y + 1, 16, 2, '#8E5A42');
  } else {
    px(g, x, y + 6, 8, 11, P.frame);
    px(g, x + 1, y + 7, 6, 9, P.glass);
    px(g, x + 1, y + 7, 6, 3, P.glassLit);
  }
}

/* ---------------- 실내 벽 ----------------
   위 세 줄이 벽면입니다. 천장 몰딩 · 벽 · 굽도리 세 켜로 나눠야
   평평한 색면이 벽으로 보입니다. */
function paintTopWall(w: any, P: any, decor: any) {
  const c = document.createElement('canvas');
  c.width = w * T; c.height = T * 3;
  const g = c.getContext('2d')!;
  const W = c.width;

  px(g, 0, 0, W, T * 3, P.iWall);
  g.fillStyle = P.iWallLit;
  for (let x = 3; x < W; x += 7) g.fillRect(x, 10, 1, T * 2 + 2);
  px(g, 0, 0, W, 6, P.iCeil);
  px(g, 0, 6, W, 2, P.iTrim);
  px(g, 0, 8, W, 1, P.iWallLit);
  px(g, 0, T * 3 - 9, W, 4, P.iTrim);
  px(g, 0, T * 3 - 5, W, 5, P.iBase);
  px(g, 0, T * 3 - 1, W, 1, P.iShadow);

  (decor || []).forEach((d: any) => {
    const x = d.x * T, y = 12;
    if (d.k === 'win') paintWindow(g, d.style, x, y, P);
    else if (d.k === 'shelf') {
      /* 벽 책장 — 도서관 */
      px(g, x - 2, y - 2, T * 2 + 4, 30, P.iTrim);
      px(g, x, y, T * 2, 26, '#4A3323');
      for (let r = 0; r < 3; r++) {
        const ry = y + 2 + r * 9;
        for (let bx = x + 2; bx < x + T * 2 - 2; bx += 3) {
          const h = 5 + ((bx + r) % 3);
          const col = ['#B75B4C', '#52739F', '#8B9C48', '#CDC2B1', '#9C6BA0'][(bx + r * 2) % 5];
          px(g, bx, ry + (7 - h), 2, h, col);
        }
        px(g, x + 1, ry + 7, T * 2 - 2, 2, '#6B4A32');
      }
    }
    else if (d.k === 'board') {
      /* 칠판 — 본관 강의동 */
      px(g, x - 2, y - 2, T * 3 + 4, 28, '#8A6A44');
      px(g, x, y, T * 3, 24, '#2C4034');
      px(g, x + 1, y + 1, T * 3 - 2, 4, '#3A5343');
      g.fillStyle = 'rgba(230,240,235,.5)';
      g.fillRect(x + 5, y + 8, 22, 1);
      g.fillRect(x + 5, y + 12, 30, 1);
      g.fillRect(x + 5, y + 16, 16, 1);
      px(g, x + T * 3 - 12, y + 20, 8, 2, '#E8EDF2');
    }
    else if (d.k === 'notice') {
      /* 게시판 — 학생회관 */
      px(g, x - 2, y - 1, T * 2 + 4, 26, '#7A5B3C');
      px(g, x, y + 1, T * 2, 22, '#C9A87C');
      const cols = ['#F2F4F7', '#FF6B52', '#F2C9C4', '#C4DDF2'];
      for (let i = 0; i < 6; i++) {
        const ax = x + 3 + (i % 3) * 9, ay = y + 4 + Math.floor(i / 3) * 9;
        px(g, ax, ay, 7, 7, cols[i % 4]);
        px(g, ax, ay, 7, 2, 'rgba(0,0,0,.14)');
      }
    }
    else if (d.k === 'banner') {
      /* 현수막 */
      px(g, x, 8, T, 30, d.c || '#3C5C82');
      px(g, x, 8, T, 3, 'rgba(255,255,255,.28)');
      px(g, x + 3, 16, T - 6, 3, '#FF6B52');
      px(g, x + 4, 23, T - 8, 2, 'rgba(255,255,255,.55)');
      px(g, x, 38, T, 3, 'rgba(0,0,0,.3)');
    }
    else if (d.k === 'clock' || d.k === 'clockFace') {
      /* 판만 그립니다. 바늘은 매 프레임 진짜 시각으로 덧그립니다
         (zone.clock). 벽 캔버스는 한 번만 그려지니 여기 바늘을 넣으면
         멈춘 시계가 됩니다. */
      disc(g, x + 8, y + 10, 10, P.iTrim);
      disc(g, x + 8, y + 10, 8, '#FFFDF8');
      g.fillStyle = P.iTrim;
      for (let h = 0; h < 12; h++) {
        const t = h * Math.PI / 6;
        const r = h % 3 === 0 ? 6 : 7;
        g.fillRect(Math.round(x + 8 + Math.sin(t) * r),
                   Math.round(y + 10 - Math.cos(t) * r), 1, 1);
      }
      if (d.k === 'clock') {  // 정지 시계(다른 방)는 바늘까지 그립니다
        px(g, x + 7, y + 5, 2, 6, '#2A3440');
        px(g, x + 8, y + 9, 5, 2, '#2A3440');
      }
    }
    else if (d.k === 'guide') {
      /* 벽에 붙인 안내판. 광장 표지판과 달리 실내라 작아야 합니다 —
         같은 크기로 두면 방 안에 도로표지판이 서 있는 꼴이 됩니다. */
      const w = T * 2, h = 22;
      px(g, x - 1, y - 2, w + 2, h + 2, '#8A6039');
      px(g, x, y - 1, w, h, '#FFF6F3');
      px(g, x, y - 1, w, 2, '#FFFFFF');
      px(g, x, y + h - 3, w, 2, '#E4D3CC');
      px(g, x + 3, y + 2, w - 6, 3, '#FF6B52');
      /* 광장 표지판과 **같은 글자**입니다. 실내라 한 급 작을 뿐입니다. */
      stamp(g, '안내', 9, '#2A2320', x + w / 2, y + 7, 'center');
      /* 못 두 개 */
      px(g, x + 2, y - 3, 2, 2, '#6B5F5A');
      px(g, x + w - 4, y - 3, 2, 2, '#6B5F5A');
    }
    else if (d.k === 'moonwin') {
      /* 기숙사 — 창밖에 달 */
      paintWindow(g, 'grid', x, y, P);
      disc(g, x + 4, y + 7, 2, '#F4F0D8');
    }
  });
  return c;
}

/** 좌우·아래 테두리 벽. 얇지만 색이 이어져야 방이 닫힙니다. */
function paintEdgeWall(w: any, h: any, P: any, vertical: any) {
  const c = document.createElement('canvas');
  c.width = w * T; c.height = h * T;
  const g = c.getContext('2d')!;
  px(g, 0, 0, c.width, c.height, P.iWall);
  if (vertical) {
    px(g, 0, 0, 4, c.height, P.iCeil);
    px(g, 4, 0, 2, c.height, P.iTrim);
    px(g, c.width - 5, 0, 5, c.height, P.iBase);
    g.fillStyle = P.iWallLit;
    for (let y = 4; y < c.height; y += 9) g.fillRect(7, y, 1, 5);
  } else {
    /* 가로 벽 — 위에서 아래로 몰딩 · 벽면 · 굽도리. 한 줄짜리 띠로
       두면 벽이 아니라 선으로 보입니다. */
    px(g, 0, 0, c.width, c.height, P.iWall);
    px(g, 0, 0, c.width, 4, P.iTrim);
    px(g, 0, 4, c.width, 1, P.iWallLit);
    g.fillStyle = P.iWallLit;
    for (let x = 3; x < c.width; x += 7) g.fillRect(x, 6, 1, c.height - 12);
    px(g, 0, c.height - 7, c.width, 3, P.iTrim);
    px(g, 0, c.height - 4, c.width, 4, P.iBase);
    px(g, 0, c.height - 1, c.width, 1, P.iShadow);
  }
  return c;
}

/** 방 하나에 벽 넉 장을 두릅니다. 그리기 전용이라 충돌은 그대로 둡니다. */
function dressRoom(m: WorldMap, P: any, decor: any) {
  m.walls = [
    { c: paintTopWall(m.w, P, decor), x: 0, y: 0 },
    { c: paintEdgeWall(1, m.h - 5, P, true), x: 0, y: 3 },
    { c: paintEdgeWall(1, m.h - 5, P, true), x: m.w - 1, y: 3 },
    { c: paintEdgeWall(m.w, 2, P, false), x: 0, y: m.h - 2 },
  ];
  /* 아래 두 줄이 벽입니다. 문이 그 안에 들어갑니다. */
  fillBase(m, 0, m.h - 2, m.w, 2, m.base[at(m, 0, 0)]);
}

/** 실내 팔레트 — 건물 겉색에서 뽑아 씁니다. 겉과 속이 같은 집이 됩니다. */
const IPAL = {
  library: {
    iWall: '#E6DCC6', iWallLit: '#F0E8D6', iCeil: '#2F6A62', iTrim: '#3E8D82',
    iBase: '#B8A98C', iShadow: '#8E8168',
    frame: '#3E8D82', glass: '#BFE0DC', glassLit: '#E2F2F0', trim: '#27665D',
  },
  mainhall: {
    iWall: '#DFE5EE', iWallLit: '#EDF1F7', iCeil: '#2A4361', iTrim: '#3C5C82',
    iBase: '#A9B4C6', iShadow: '#7C879A',
    frame: '#3C5C82', glass: '#C6D8EC', glassLit: '#E8F1FA', trim: '#26405E',
  },
  dorm: {
    iWall: '#F0E2CE', iWallLit: '#F8EEDF', iCeil: '#A0552F', iTrim: '#D07A4C',
    iBase: '#C4A783', iShadow: '#96805F',
    frame: '#B06C42', glass: '#D9E6EE', glassLit: '#F0F6FA', trim: '#A0552F',
  },
  union: {
    iWall: '#E2EEE6', iWallLit: '#F0F8F2', iCeil: '#33724C', iTrim: '#5CB177',
    iBase: '#AFC6B6', iShadow: '#82998A',
    frame: '#3B8055', glass: '#CDE8DA', glassLit: '#EDF9F2', trim: '#3B8055',
  },
};

/* ---- 네 건물. 조감도(campus-map.html)의 팔레트·실루엣을 그대로 옮깁니다 ---- */
const BSPEC = {
  /* 본관 — 남색 모임지붕, 가운데 시계탑. 캠퍼스에서 가장 높은 곳에
     라임 시계판이 딱 한 번 나옵니다. */
  bldMain: {
    w: 13, h: 8, win: 'tall',
    pal: { roof: '#3C5C82', lit: '#5A7FA8', dark: '#26405E',
           wall: '#EEF1F6', wallDark: '#B9C2D0', trim: '#8FA3BC',
           frame: '#5E7690', glass: '#39536E', glassLit: '#7C9CBC' },
    features: [
      { k: 'spire', x: 6.5, y: 2.6, r: 22, c: '#2F4E74', lit: '#6A8FBA' },
      { k: 'tank', x: 1.6, y: 4.6, r: 5 },
      { k: 'tank', x: 11.4, y: 4.6, r: 5 },
    ],
  },
  /* 도서관 — 청동 녹청 박공에 원형 유리 돔. 정면에는 기둥. */
  bldLibrary: {
    w: 13, h: 8, ridge: true, portico: 6, win: 'arch',
    pal: { roof: '#3E8D82', lit: '#5FB0A3', dark: '#27665D',
           wall: '#F2EAD9', wallDark: '#C6B99E', trim: '#A08E70',
           frame: '#6E8B9E', glass: '#3B5E72', glassLit: '#89B2C6' },
    features: [
      { k: 'dome', x: 6.5, y: 2.7, r: 26, c: '#9FD3E4', lit: '#C4E6F1',
        hi: '#EAF7FB', rib: '#5E93A8', icon: 'book' },
      { k: 'sky', x: 1.2, y: 4.9, n: 3, gap: 1.1 },
      { k: 'sky', x: 9.0, y: 4.9, n: 3, gap: 1.1 },
    ],
  },
  /* 기숙사 — 따뜻한 주황 지붕, 모서리 계단탑 원뿔, 옥상 물탱크와 초록 데크. */
  bldDorm: {
    w: 11, h: 7, win: 'grid',
    pal: { roof: '#D07A4C', lit: '#E79C6E', dark: '#A0552F',
           wall: '#F6EFE1', wallDark: '#CBBBA1', trim: '#B08E68',
           frame: '#7E93A5', glass: '#40566B', glassLit: '#8FA8BE' },
    features: [
      { k: 'deck', x: 2.2, y: 1.1, w: 4.2, h: 2.2, c: '#6CA96F', lit: '#8AC48C' },
      { k: 'tank', x: 7.5, y: 1.5, r: 6 },
      { k: 'tank', x: 8.8, y: 2.4, r: 5 },
      { k: 'cone', x: 9.2, y: 3.6, r: 17, c: '#A8542E', lit: '#CE7A4A', hi: '#EFA878' },
      { k: 'medal', x: 5.0, y: 3.4, r: 13, icon: 'moon' },
    ],
  },
  /* 학생회관 — 밝은 초록 지붕에 강당 돔. 이 캠퍼스 유일한 큰 곡면입니다. */
  bldUnion: {
    w: 15, h: 7, win: 'shop',
    pal: { roof: '#5CB177', lit: '#7FCE96', dark: '#3B8055',
           wall: '#F6F9FB', wallDark: '#BECBD4', trim: '#8FB0A0',
           frame: '#6F8FA6', glass: '#3A5568', glassLit: '#88A9BF' },
    features: [
      { k: 'dome', x: 7.5, y: 2.5, r: 30, c: '#6FC98A', lit: '#95DEA9',
        hi: '#C6F0D2', rib: '#3F8A5B', icon: 'trophy' },
      { k: 'tank', x: 1.8, y: 1.4, r: 5 },
      { k: 'tank', x: 13.2, y: 1.4, r: 5 },
    ],
  },
};

PROP.bldMain    = buildingProp(BSPEC.bldMain);
PROP.bldLibrary = buildingProp(BSPEC.bldLibrary);
PROP.bldDorm    = buildingProp(BSPEC.bldDorm);
PROP.bldUnion   = buildingProp(BSPEC.bldUnion);

/* ==================================================================
   기물과 바닥

   벤치·가로등·자판기를 시트에서 꺼내 쓰면 캠퍼스 색과 따로 놉니다.
   건물을 손으로 그린 이상 그 위에 놓이는 물건도 같은 손이어야 합니다.

   공통 규칙은 건물과 같습니다 — 빛은 왼쪽 위, 밝은 면은 위·왼쪽,
   그림자는 아래·오른쪽. 그리고 **바닥에 닿는 면을 어둡게** 깔아야
   물건이 떠 있지 않고 놓여 있는 것으로 보입니다.
   ================================================================== */

const FURN = {
  wood:  '#A8703F', woodLit: '#C99257', woodDark: '#7A4C25',
  metal: '#98A2AD', metalLit: '#C2CAD2', metalDark: '#5F6874',
  ink:   '#1B2430', lime: '#FF6B52',
  glass: '#3A5568', glassLit: '#8FB0C6',
  leaf:  '#4E9E63', leafLit: '#6FBE7F', soil: '#6B4C33',
};

function canvasOf(wTiles: any, hTiles: any) {
  const c = document.createElement('canvas');
  c.width = wTiles * T; c.height = hTiles * T;
  return c;
}
/** 바닥 그림자. 이게 없으면 모든 기물이 공중에 뜹니다. */
function shadow(g: CanvasRenderingContext2D, cx: any, y: any, rx: any, ry: any) {
  g.fillStyle = 'rgba(0,0,0,.20)';
  for (let dy = -ry; dy <= ry; dy++) {
    const half = Math.floor(rx * Math.sqrt(1 - (dy * dy) / (ry * ry || 1)));
    g.fillRect(cx - half, y + dy, half * 2 + 1, 1);
  }
}

/* ---- 픽셀 글자 ----
   6px 한글을 그대로 4배로 키우면 안티에일리어싱이 같이 커져 글자가
   번집니다. 크게 그린 다음 **알파를 1비트로 잘라** 냅니다 — 반투명
   픽셀이 하나도 안 남으므로 확대해도 계단만 보이고 흐려지지 않습니다.
   본문은 프리텐다드지만 여기만 맑은 고딕을 먼저 씁니다. 작은 크기에
   맞춰 힌팅된 글꼴이라 자르고 나서 획이 덜 끊깁니다. */
/* ---- 손으로 그린 한글 7×8 ----
   맑은 고딕을 잘라 쓰는 방식은 9px 이 바닥입니다. 8px 로 내리면 "도서관"
   이 "도서리" 가 되고 "본관" 이 "른관" 이 됩니다 — 획 사이가 반투명
   한 겹뿐이라, 자르면 그 겹이 통째로 사라집니다. 무게와 문턱값을 여섯
   조합 시험해도 마찬가지였습니다.

   더 작게 가려면 획을 직접 놓는 수밖에 없습니다. 표지판에 쓰는 열두
   글자만 7×8 격자에 그렸습니다. 자간은 1px 이라 "학생회관" 이 31px —
   같은 글을 잘라 쓰면 34px 입니다. 작아지고 또렷해졌습니다. */
const GLYPH8: Record<string, string[]> = {
  '기': ['#####.#', '....#.#', '....#.#', '......#', '......#', '......#', '......#', '.......'],
  '숙': ['...#...', '..#.#..', '.#...#.', '#######', '...#...', '.#####.', '.....#.', '.......'],
  '사': ['.#...#.', '.#...#.', '#.#..#.', '#.#..##', '#..#.#.', '#..#.#.', '.....#.', '.......'],
  '도': ['.#####.', '.#.....', '.#.....', '.#####.', '.......', '...#...', '...#...', '#######'],
  '서': ['.#....#', '.#....#', '#.#...#', '#.#.###', '#..#..#', '#..#..#', '......#', '.......'],
  '관': ['####..#.', '...#..#.', '......##', '..#...#.', '#####.#.', '........', '#.......', '######..'],
  '본': ['#..#...', '####...', '#..#...', '####...', '..#....', '#######', '#......', '######.'],
  '학': ['..#...#.', '#####.#.', '.####.##', '.#..#.#.', '.####.#.', '......#.', '####....', '...#....'],
  '생': ['.#...#.#', '#.#..#.#', '#.#..###', '#.#..#.#', '.....#.#', '####.#.#', '#..#.#.#', '####.#.#'],
  '회': ['..#...#', '#####.#', '.###..#', '.#.#..#', '.###..#', '..#...#', '..#...#', '#####.#'],
  '안': ['.###..#.', '#...#.#.', '#...#.##', '.###..#.', '......#.', '........', '#.......', '######..'],
  '내': ['#...#.#', '#...#.#', '#...#.#', '#...###', '#...#.#', '#...#.#', '###.#.#', '.......'],
};
/** 손글자를 한 장으로 이어 붙입니다. 없는 글자는 잘라 쓰기로 넘깁니다. */
function handText(text: any, color: any) {
  const rows = 8, gap = 1;
  const cells = [...text].map((ch) => GLYPH8[ch]);
  if (cells.some((c) => !c)) return null;
  /* 글자마다 실제로 쓴 폭만 씁니다 — 오른쪽 빈 칸을 그대로 두면
     "기" 와 "관" 사이가 벌어져 자간이 들쭉날쭉해집니다. */
  const widths = cells.map((c) => {
    let w = 0;
    c.forEach((r) => { const i = r.lastIndexOf('#'); if (i + 1 > w) w = i + 1; });
    return w;
  });
  const c = document.createElement('canvas');
  c.width = widths.reduce((a, b) => a + b, 0) + gap * (cells.length - 1);
  c.height = rows;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  let ox = 0;
  cells.forEach((cell, k) => {
    cell.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === '#') g.fillRect(ox + x, y, 1, 1);
    });
    ox += widths[k] + gap;
  });
  return c;
}

const PXTEXT = new Map<string, HTMLCanvasElement>();
const hexRGB = (h: any) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function pixelText(text: any, size: any, color: any) {
  const key = text + '|' + size + '|' + color;
  const hit = PXTEXT.get(key);
  if (hit) return hit;   // has() 는 타입을 좁혀 주지 않습니다
  /* 8px 이하는 손글자가 있으면 손글자를 씁니다. 자른 글자는 여기서
     이미 무너져 있습니다. */
  if (size <= 8) {
    const hand = handText(text, color);
    if (hand) { PXTEXT.set(key, hand); return hand; }
  }
  const pad = 4;
  const t = document.createElement('canvas');
  const g = t.getContext('2d')!;
  const font = `600 ${size}px "Malgun Gothic", "Pretendard Variable", sans-serif`;
  g.font = font;
  t.width = Math.ceil(g.measureText(text).width) + pad * 2;
  t.height = size + pad * 2;
  g.font = font;                       // 크기를 바꾸면 컨텍스트가 초기화됩니다
  /* 자간을 좁힙니다. 한글은 자간이 넉넉해서 그대로 두면 판이 길어지고,
     길어진 만큼 표지판이 커집니다. 크롬은 letterSpacing 을 지원하고,
     못 알아듣는 브라우저에서는 그냥 기본 자간이 됩니다. */
  try { g.letterSpacing = '-0.5px'; } catch (e) { /* 무시 */ }
  g.textBaseline = 'top'; g.fillStyle = '#000';
  g.fillText(text, pad, pad);
  const d = g.getImageData(0, 0, t.width, t.height), a = d.data;
  const [r, gg, b] = hexRGB(color);
  /* 알파를 1비트로 자르면서 잉크가 실제로 닿은 칸을 함께 잽니다 */
  let x0 = t.width, y0 = t.height, x1 = -1, y1 = -1;
  for (let y = 0; y < t.height; y++) for (let x = 0; x < t.width; x++) {
    const i2 = (y * t.width + x) * 4;
    const on = a[i2 + 3] > 96;
    a[i2] = r; a[i2 + 1] = gg; a[i2 + 2] = b; a[i2 + 3] = on ? 255 : 0;
    if (on) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  g.putImageData(d, 0, 0);
  if (x1 < 0) { PXTEXT.set(key, t); return t; }
  /* 딱 맞게 잘라 냅니다. 안 자르면 판 안에서 글자가 어디쯤 있는지 알 수
     없어, 위아래 여백을 눈대중으로 맞추게 됩니다. */
  const c = document.createElement('canvas');
  c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
  c.getContext('2d')!.drawImage(t, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  PXTEXT.set(key, c);
  return c;
}
/** 잘라 낸 글자를 찍습니다. x 는 left/center/right, y 는 top/middle 기준점. */
function stamp(g: CanvasRenderingContext2D, text: any, size: any, color: any, x: any, y: any, align = 'left', valign = 'top') {
  const t = pixelText(text, size, color);
  const dx = align === 'center' ? x - t.width / 2 : align === 'right' ? x - t.width : x;
  const dy = valign === 'middle' ? y - t.height / 2 : y;
  g.drawImage(t, Math.round(dx), Math.round(dy));
  return t.width;
}

const PAINTED: Record<string, HTMLCanvasElement> = {};

/* ---- 벤치 2×2 — 등받이가 뒤, 앉는 면이 앞 ---- */
{
  const c = canvasOf(2, 2), g = c.getContext('2d')!;
  shadow(g, 16, 29, 15, 3);
  /* 뒷다리 — 등받이보다 먼저 깔아야 뒤로 넘어갑니다 */
  [5, 25].forEach((x) => px(g, x, 8, 2, 6, FURN.metalDark));
  /* 등받이 기둥 둘 */
  [4, 26].forEach((x) => {
    px(g, x, 3, 3, 13, FURN.metalDark);
    px(g, x, 3, 1, 13, FURN.metal);
  });
  /* 등받이 살 셋 — 사이가 비어야 벤치로 보입니다 */
  for (let i = 0; i < 3; i++) {
    const y = 4 + i * 4;
    px(g, 4, y, 24, 3, FURN.wood);
    px(g, 4, y, 24, 1, FURN.woodLit);
    px(g, 4, y + 2, 24, 1, FURN.woodDark);
  }
  /* 팔걸이 — 좌면보다 한 칸 위에서 앞으로 뻗습니다 */
  [2, 27].forEach((x) => {
    px(g, x, 15, 3, 8, FURN.woodLit);
    px(g, x, 15, 3, 1, '#D8A66C');
    px(g, x, 22, 3, 1, FURN.woodDark);
  });
  /* 앉는 면 — 널 셋, 이음새가 보여야 나무입니다 */
  for (let i = 0; i < 3; i++) {
    const y = 16 + i * 3;
    px(g, 3, y, 26, 3, i === 0 ? FURN.woodLit : FURN.wood);
    px(g, 3, y + 2, 26, 1, FURN.woodDark);
  }
  px(g, 3, 25, 26, 2, '#6B4423');            // 앞코 그늘
  /* 앞다리 */
  [5, 25].forEach((x) => {
    px(g, x, 26, 3, 5, FURN.metalDark);
    px(g, x, 26, 1, 5, FURN.metal);
  });
  PAINTED.bench = c;
}

/* ---- 알과 받침 2×3 ----
   부화장은 없앴습니다. 알은 학생회관 상점에서 가장 비싼 물건으로 팔
   예정이라 그림만 남깁니다 — 상점 진열대에 그대로 올라갑니다.
   알만 놓으면 바닥에 굴러다니는 것으로 보입니다. 받침 위에 올려야
   "가져가도 되는 것" 이 아니라 "고르는 것" 이 됩니다. */
function eggCanvas(key: any, shell: any, shellLit: any, shellDark: any, spot: any) {
  const c = canvasOf(2, 3), g = c.getContext('2d')!;
  shadow(g, 16, 45, 12, 3);
  /* 돌받침 — 위가 둥근 원기둥 */
  px(g, 4, 36, 24, 9, '#7B8590');
  px(g, 5, 37, 22, 7, '#A3ADB8');
  disc(g, 16, 37, 11, '#BAC4CE');
  disc(g, 16, 36, 10, '#D2DAE2');
  disc(g, 14, 35, 6, '#E8EEF3');
  g.fillStyle = '#8A939E';
  for (let x = 6; x < 27; x += 5) g.fillRect(x, 40, 1, 4);
  /* 알 — 아래가 넓은 타원. 위아래 반지름을 다르게 줘야 공이 안 됩니다. */
  for (let y = -15; y <= 13; y++) {
    const t = y < 0 ? y / 15 : y / 13;
    const w = Math.round(Math.sqrt(Math.max(0, 1 - t * t)) * (y < 0 ? 8.5 : 10));
    if (!w) continue;
    px(g, 16 - w, 20 + y, w * 2, 1, shellDark);
    px(g, 16 - w + 1, 20 + y, w * 2 - 2, 1, shell);
  }
  /* 왼쪽 위 광 */
  disc(g, 12, 14, 4, shellLit);
  disc(g, 11, 13, 2, '#FFFFFF');
  /* 무늬 — 종마다 다릅니다. 이게 없으면 알 넷이 색만 다른 같은 알입니다. */
  g.fillStyle = spot;
  [[15, 9, 4, 3], [10, 18, 5, 4], [19, 15, 4, 5], [14, 26, 6, 3], [21, 24, 3, 3]]
    .forEach(([x, y, w, h]) => g.fillRect(x, y, w, h));
  PAINTED[key] = c;
}
eggCanvas('eggTurtle', '#63B87A', '#8FD9A2', '#3D8A55', '#3F8F5C');
eggCanvas('eggGiraffe', '#F0C566', '#FFE1A0', '#C39338', '#B5762E');
eggCanvas('eggMeerkat', '#D8AE84', '#F2D2AE', '#A87F58', '#8E6440');
eggCanvas('eggPig', '#F2A6B2', '#FFCBD4', '#C4737F', '#B95F6E');

/* ---- 천막 부스 3×3 — 동아리 거리 ----
   지붕 · 기둥 · 판매대 셋이 다 있어야 부스입니다. 지붕만 그리면
   땅에 떠 있는 우산이 됩니다. */
function tentCanvas(key: any, cloth: any, clothLit: any, clothDark: any) {
  const c = canvasOf(3, 3), g = c.getContext('2d')!;
  shadow(g, 24, 45, 20, 4);
  /* 기둥 넷 — 지붕보다 먼저 */
  [4, 41].forEach((x) => { px(g, x, 20, 3, 24, '#8A6039'); px(g, x, 20, 1, 24, '#A87B4C'); });
  /* 판매대 */
  px(g, 6, 30, 36, 12, '#8A6039');
  px(g, 7, 31, 34, 10, '#B08050');
  px(g, 7, 31, 34, 2, '#C99A64');
  px(g, 6, 40, 36, 3, '#6B4423');
  g.fillStyle = '#9A6C3E';
  for (let x = 10; x < 41; x += 7) g.fillRect(x, 33, 1, 7);
  /* 지붕 — 줄무늬 차양. 아래 가장자리가 물결이어야 천으로 보입니다. */
  px(g, 0, 8, 48, 14, clothDark);
  px(g, 1, 9, 46, 12, cloth);
  for (let x = 1; x < 47; x += 8) px(g, x, 9, 4, 12, clothLit);
  px(g, 1, 9, 46, 2, 'rgba(255,255,255,.28)');
  for (let x = 0; x < 48; x += 6) {
    disc(g, x + 3, 22, 3, clothDark);
    disc(g, x + 3, 21, 3, x % 12 ? cloth : clothLit);
  }
  /* 용마루 */
  px(g, 0, 6, 48, 3, '#6B4423');
  px(g, 22, 0, 4, 8, '#8A6039');
  disc(g, 24, 2, 3, '#FF6B52');
  PAINTED[key] = c;
}
tentCanvas('tentA', '#E8695A', '#FF9082', '#B3392E');
tentCanvas('tentB', '#4E8FC0', '#7FB6E0', '#2E5E86');
tentCanvas('tentC', '#E0AE3C', '#F7CE6E', '#A87A20');

/* ---- 관문 4×4 ----
   미니게임존의 문입니다. 넷이 나란히 서므로 **서로 달라야** 하고, 동시에
   한 식구로 보여야 합니다. 그래서 뼈대(돌기둥·처마·문간)는 같게 두고
   천 색 · 안쪽 빛 · 문장(紋章) 셋만 바꿉니다.

   문 안쪽을 벽처럼 막지 않고 어둡게 파서 빛을 물렸습니다 — 관문은
   지나가는 곳이라 안이 안 보이면 그냥 벽에 붙인 장식이 됩니다. */
function gateEmblem(g: CanvasRenderingContext2D, kind: any, cx: any, cy: any, ink: any) {
  if (kind === 'key') {
    /* 열쇠 — 방탈출 */
    circleLine(g, cx - 4, cy, 4, ink);
    circleLine(g, cx - 4, cy, 3, ink);
    px(g, cx - 1, cy - 1, 10, 2, ink);
    px(g, cx + 5, cy + 1, 2, 3, ink);
    px(g, cx + 8, cy + 1, 2, 3, ink);
  } else {
    /* 물음표 — 아직 정하지 않은 놀이 */
    px(g, cx - 4, cy - 7, 8, 2, ink);
    px(g, cx + 3, cy - 6, 2, 4, ink);
    px(g, cx - 1, cy - 3, 5, 2, ink);
    px(g, cx - 2, cy - 1, 2, 4, ink);
    px(g, cx - 2, cy + 5, 2, 2, ink);
  }
}
function gateCanvas(key: any, name: any, base: any, lit: any, dark: any, glow: any, emblem: any) {
  const c = canvasOf(4, 4), g = c.getContext('2d')!;
  shadow(g, 32, 60, 26, 4);

  /* ---- 문간 ---- */
  px(g, 14, 20, 36, 38, '#131A24');
  disc(g, 32, 24, 18, '#131A24');
  /* 안쪽 빛 — 다섯 겹으로 번집니다 */
  for (let k = 5; k >= 1; k--) {
    g.fillStyle = 'rgba(' + glow + ',' + (0.07 * (6 - k)).toFixed(2) + ')';
    g.beginPath(); g.ellipse(32, 42, 3 * k, 3.4 * k, 0, 0, 7); g.fill();
  }
  gateEmblem(g, emblem, 32, 40, 'rgba(' + glow + ',.85)');
  /* 아치 테두리 */
  circleLine(g, 32, 24, 18, dark);
  circleLine(g, 32, 24, 17, base);

  /* ---- 기둥 둘 ---- */
  [0, 48].forEach((x) => {
    px(g, x, 16, 16, 42, '#5E5449');
    px(g, x + 1, 17, 14, 40, '#A79A85');
    px(g, x + 1, 17, 5, 40, '#C6BAA3');
    px(g, x + 12, 17, 3, 40, '#877C6A');
    g.fillStyle = '#8B7F6C';
    for (let y = 22; y < 56; y += 7) g.fillRect(x + 1, y, 14, 1);
    /* 주두 · 초석 */
    px(g, x - 1, 12, 18, 6, '#5E5449');
    px(g, x, 13, 16, 4, '#C6BAA3');
    px(g, x - 1, 54, 18, 5, '#5E5449');
    px(g, x, 54, 16, 2, '#B3A791');
    /* 등 — 색이 문마다 달라, 멀리서도 넷을 셀 수 있습니다 */
    px(g, x + 4, 22, 8, 3, '#3A4652');
    px(g, x + 4, 25, 8, 7, dark);
    px(g, x + 5, 26, 6, 5, lit);
    px(g, x + 6, 27, 4, 3, '#FFFFFF');
    px(g, x + 4, 32, 8, 2, '#3A4652');
  });

  /* ---- 처마와 이름 판 ---- */
  px(g, 0, 10, 64, 6, '#5E5449');
  px(g, 1, 11, 62, 4, '#B3A791');
  px(g, 1, 11, 62, 1, '#D2C8B4');
  /* 박공 — 계단으로 쌓아 올립니다 */
  for (let k = 0; k < 4; k++) {
    px(g, 4 + k * 3, 10 - k * 3, 56 - k * 6, 3, k % 2 ? '#5E5449' : '#877C6A');
  }
  /* 이름 천 */
  px(g, 6, 0, 52, 12, dark);
  px(g, 7, 1, 50, 10, base);
  px(g, 7, 1, 50, 2, lit);
  px(g, 7, 9, 50, 2, dark);
  stamp(g, name, 9, dark, 32, 7, 'center', 'middle');
  stamp(g, name, 9, '#FFFFFF', 32, 6, 'center', 'middle');

  /* ---- 문지방 ---- */
  px(g, 10, 57, 44, 5, dark);
  px(g, 11, 57, 42, 3, base);
  px(g, 11, 57, 42, 1, lit);
  PAINTED[key] = c;
}
gateCanvas('gateEsc', '방탈출', '#FF6B52', '#FFA694', '#8E2E1C', '255,150,120', 'key');
gateCanvas('gateA', 'Ex 1', '#3E8D82', '#79C4B8', '#1F544C', '130,230,215', 'ex');
gateCanvas('gateB', 'Ex 2', '#E0AE3C', '#F7CE6E', '#8E6714', '255,220,130', 'ex');
gateCanvas('gateC', 'Ex 3', '#8A6BC4', '#B79BE8', '#4E3480', '190,160,255', 'ex');

/* ---- 서가 3×2 ----
   책등 색을 무작위로 흩되 폭은 2~4px 로 묶습니다. 폭까지 무작위면
   책이 아니라 색 얼룩이 됩니다. */
{
  const c = canvasOf(3, 2), g = c.getContext('2d')!;
  shadow(g, 24, 30, 22, 3);
  const spines = ['#B8523F', '#3E6E96', '#C89A3C', '#4E8A5C', '#8E5A9E',
                  '#C2705A', '#3F7F84', '#A8483F', '#5C6EA8', '#B08050'];
  /* 통 — 옆널 둘과 등판 */
  px(g, 1, 2, 46, 26, '#5E4128');
  px(g, 2, 3, 44, 24, '#7A5637');
  px(g, 2, 3, 44, 2, '#96693F');
  /* 두 단 */
  for (let s2 = 0; s2 < 2; s2++) {
    const y = 6 + s2 * 11;
    px(g, 4, y, 40, 9, '#4A3220');
    let x = 5;
    while (x < 43) {
      const w = 2 + Math.floor(rnd(x, y, s2) * 3);
      const h = 7 - Math.floor(rnd(x, y, s2 + 5) * 2);
      const col = spines[Math.floor(rnd(x, y, s2 + 9) * spines.length)];
      if (x + w > 43) break;
      px(g, x, y + 1 + (7 - h), w, h, col);
      px(g, x, y + 1 + (7 - h), w, 1, 'rgba(255,255,255,.28)');
      px(g, x, y + 8, w, 1, 'rgba(0,0,0,.30)');
      x += w + 1;
    }
    px(g, 3, y + 9, 42, 2, '#6B4A2E');       // 선반 앞코
    px(g, 3, y + 9, 42, 1, '#96693F');
  }
  px(g, 1, 27, 46, 2, '#3E2A18');
  PAINTED.stack = c;
}

/* ---- 게시판 2×2 ---- */
{
  const c = canvasOf(2, 2), g = c.getContext('2d')!;
  shadow(g, 16, 30, 12, 3);
  [6, 24].forEach((x) => px(g, x, 20, 3, 10, '#7A5637'));
  px(g, 1, 4, 30, 18, '#5E4128');
  px(g, 3, 6, 26, 14, '#3E5B3A');
  const notes = ['#FFF6E8', '#FFD9CF', '#E8F1FF', '#FFF0B8'];
  [[5, 8], [12, 8], [19, 8], [5, 14], [13, 14], [21, 14]].forEach(([x, y], i) => {
    px(g, x, y, 6, 5, notes[i % 4]);
    px(g, x, y, 6, 1, 'rgba(0,0,0,.14)');
    px(g, x + 2, y + 2, 3, 1, '#9AA3AE');
  });
  px(g, 1, 2, 30, 3, '#7A5637');
  px(g, 1, 2, 30, 1, '#9A7048');
  PAINTED.board = c;
}

/* ---- 스트레칭 매트 2×2 ---- */
{
  const c = canvasOf(2, 2), g = c.getContext('2d')!;
  px(g, 3, 9, 26, 20, 'rgba(0,0,0,.16)');
  px(g, 2, 6, 28, 22, '#D8442C');
  px(g, 3, 7, 26, 20, '#FF6B52');
  px(g, 3, 7, 26, 3, '#FF8E79');
  g.fillStyle = 'rgba(255,255,255,.34)';
  for (let y = 12; y < 26; y += 4) g.fillRect(6, y, 20, 1);
  px(g, 24, 6, 6, 22, '#E8503A');          // 말린 쪽
  px(g, 24, 6, 2, 22, '#FF8E79');
  PAINTED.mat = c;
}

/* ---- 부들 1×2 — 물가 ---- */
{
  const c = canvasOf(1, 2), g = c.getContext('2d')!;
  g.fillStyle = '#3E7A4A';
  [[4, 30, 10], [8, 30, 16], [12, 30, 12]].forEach(([x, y, h]) => {
    for (let k = 0; k < h; k++) g.fillRect(x + Math.round(Math.sin(k / 5) * 2), y - k, 1, 1);
  });
  px(g, 7, 10, 3, 7, '#6B4423');
  px(g, 7, 10, 1, 7, '#8A6039');
  px(g, 3, 16, 2, 5, '#5C9A5C');
  px(g, 12, 14, 2, 6, '#5C9A5C');
  PAINTED.reed = c;
}

/* ---- 가로등 1×2 — 광장 포장 위에만 놓습니다 ---- */
{
  const c = canvasOf(1, 2), g = c.getContext('2d')!;
  shadow(g, 8, 29, 5, 2);
  px(g, 5, 26, 6, 4, FURN.metalDark);
  px(g, 5, 26, 6, 1, FURN.metal);
  px(g, 7, 8, 2, 18, FURN.metalDark);
  px(g, 7, 8, 1, 18, FURN.metal);
  px(g, 4, 4, 8, 5, FURN.metalDark);
  px(g, 5, 5, 6, 3, '#FFF3C4');
  px(g, 5, 5, 6, 1, '#FFFDF0');
  px(g, 3, 3, 10, 2, FURN.metal);
  px(g, 6, 1, 4, 2, FURN.metalDark);
  /* 불빛 번짐 */
  g.fillStyle = 'rgba(255,243,196,.18)';
  g.fillRect(2, 8, 12, 4);
  PAINTED.lamp = c;
}

/* ---- 자판기 1×2 — 창에 상품이 보여야 자판기입니다 ---- */
function vendingCanvas(bodyC: any, bodyLit: any) {
  const c = canvasOf(1, 2), g = c.getContext('2d')!;
  shadow(g, 8, 30, 7, 2);
  px(g, 1, 3, 14, 27, FURN.ink);
  px(g, 2, 4, 12, 25, bodyC);
  px(g, 2, 4, 12, 2, bodyLit);
  px(g, 2, 4, 2, 25, bodyLit);
  /* 진열창 */
  px(g, 3, 7, 8, 15, '#16222E');
  const cans = ['#D8534A', '#3E8D82', '#FF6B52', '#4E7595', '#E0A06B'];
  for (let r = 0; r < 4; r++) {
    for (let i = 0; i < 3; i++) {
      px(g, 4 + i * 3, 8 + r * 4, 2, 3, cans[(r * 3 + i) % 5]);
      px(g, 4 + i * 3, 8 + r * 4, 2, 1, '#FFFFFF');
    }
  }
  px(g, 3, 7, 8, 2, 'rgba(255,255,255,.22)');
  /* 조작부 */
  px(g, 12, 8, 2, 8, FURN.metalDark);
  px(g, 12, 9, 2, 1, FURN.lime);
  px(g, 12, 12, 2, 1, '#E8EDF2');
  px(g, 3, 24, 8, 4, '#16222E');
  px(g, 4, 25, 6, 2, FURN.metalDark);
  PAINTED[bodyC === '#B44A44' ? 'vending' : 'vending2'] = c;
}
vendingCanvas('#B44A44', '#D2635C');
vendingCanvas('#3E6E96', '#5A8CB4');

/* ---- 쓰레기통 1×1 ---- */
{
  const c = canvasOf(1, 1), g = c.getContext('2d')!;
  shadow(g, 8, 15, 6, 2);
  px(g, 3, 5, 10, 10, '#2F4A3A');
  px(g, 4, 6, 8, 8, '#3F6B4E');
  px(g, 4, 6, 2, 8, '#54886A');
  g.fillStyle = '#2A4234';
  for (let x = 5; x < 12; x += 2) g.fillRect(x, 7, 1, 6);
  px(g, 2, 2, 12, 4, '#243A2E');
  px(g, 3, 3, 10, 2, '#4A7A5C');
  px(g, 6, 1, 4, 2, '#243A2E');
  PAINTED.bin = c;
}

/* ---- 분리수거함 2×1 — 대학 광장에 반드시 있습니다 ---- */
{
  const c = canvasOf(2, 1), g = c.getContext('2d')!;
  shadow(g, 16, 15, 14, 2);
  const lids = ['#4E7595', '#C9A23E', '#4E8F63'];
  lids.forEach((lid, i) => {
    const x = 1 + i * 10;
    px(g, x, 4, 9, 11, FURN.ink);
    px(g, x + 1, 5, 7, 9, '#DCDFE4');
    px(g, x + 1, 5, 2, 9, '#F0F2F5');
    px(g, x, 2, 9, 3, lid);
    px(g, x + 1, 2, 7, 1, 'rgba(255,255,255,.4)');
    px(g, x + 3, 6, 3, 2, '#2E3A46');
  });
  PAINTED.recycle = c;
}


/* ---- 야외 테이블 2×2 — 파라솔을 위에서 봅니다 ---- */
{
  const c = canvasOf(2, 2), g = c.getContext('2d')!;
  shadow(g, 16, 27, 13, 3);
  /* 의자 넷이 파라솔 밖으로 삐죽 나옵니다 */
  [[2, 12], [24, 12], [13, 1], [13, 24]].forEach(([x, y]) => {
    px(g, x, y, 7, 7, FURN.woodDark);
    px(g, x + 1, y + 1, 5, 5, FURN.wood);
  });
  disc(g, 16, 15, 13, 'rgba(0,0,0,.18)');
  disc(g, 16, 14, 12, '#C9503F');
  g.fillStyle = '#F0F2F5';
  for (let a = 0; a < 8; a += 2) {
    const t = a * Math.PI / 4;
    for (let d = 0; d < 12; d++) {
      const w = Math.max(1, Math.round(d * 0.55));
      g.fillRect(Math.round(16 + Math.cos(t) * d), Math.round(14 + Math.sin(t) * d), w, w);
    }
  }
  circleLine(g, 16, 14, 12, '#8E3A2C');
  disc(g, 16, 14, 3, '#8E3A2C');
  disc(g, 16, 13, 2, '#E8ECEF');
  PAINTED.cafeSet = c;
}

/* ---- 화단 1×2 — 세로로 섭니다 ----
   가로로 눕히면 벤치와 헷갈립니다. 돌 테두리 안에 흙을 담고 줄기를
   세워야 화단으로 보입니다 — 꽃만 흩뿌리면 얼룩입니다. */
{
  const c = canvasOf(1, 2), g = c.getContext('2d')!;
  shadow(g, 8, 30, 7, 2);
  /* 돌 테두리 */
  px(g, 1, 8, 14, 23, '#7E8590');
  px(g, 2, 9, 12, 21, '#9BA3AE');
  px(g, 2, 9, 12, 2, '#B8C0C9');
  px(g, 2, 9, 2, 21, '#B0B8C2');
  g.fillStyle = '#6E757F';
  for (let y = 12; y < 30; y += 5) g.fillRect(2, y, 12, 1);
  for (let y = 9; y < 30; y += 5)
    g.fillRect(((y / 5) | 0) % 2 ? 6 : 10, y, 1, 5);
  /* 흙 */
  px(g, 3, 11, 10, 17, '#5E4230');
  px(g, 3, 11, 10, 2, '#74523B');
  /* 줄기와 잎 — 뒤가 크고 앞이 작아야 깊이가 생깁니다 */
  const stems = [[5, 12, 9], [8, 11, 11], [11, 13, 8], [6, 18, 7], [10, 19, 6]];
  stems.forEach(([sx, sy, h], i) => {
    px(g, sx, sy, 1, h, i % 2 ? '#3F8A4E' : '#4E9E63');
    px(g, sx - 2, sy + h - 4, 2, 2, '#5AAE6E');
    px(g, sx + 1, sy + h - 6, 2, 2, '#3F8A4E');
  });
  /* 꽃 — 다섯 송이만. 많으면 흙이 안 보여 덤불이 됩니다. */
  const blooms = ['#E8D45C', '#E0708A', '#F2F4F7', '#FF6B52', '#C87ED8'];
  stems.forEach(([sx, sy], i) => {
    const by = sy - 1;
    px(g, sx - 1, by, 3, 3, blooms[i]);
    px(g, sx, by - 1, 1, 1, blooms[i]);
    px(g, sx, by + 1, 1, 1, '#B8942E');
    px(g, sx - 1, by, 2, 1, 'rgba(255,255,255,.35)');
  });
  PAINTED.planter = c;
}

/* ---- 캠퍼스 안내판 1×2 ---- */
{
  const c = canvasOf(1, 2), g = c.getContext('2d')!;
  shadow(g, 8, 30, 6, 2);
  px(g, 7, 20, 2, 10, FURN.metalDark);
  px(g, 7, 20, 1, 10, FURN.metal);
  px(g, 1, 4, 14, 17, FURN.ink);
  px(g, 2, 5, 12, 15, '#28556B');
  px(g, 2, 5, 12, 3, '#3E7A94');
  px(g, 3, 9, 5, 4, '#FF6B52');
  px(g, 9, 9, 4, 3, '#8FB0C6');
  px(g, 3, 14, 10, 1, '#8FB0C6');
  px(g, 3, 16, 7, 1, '#8FB0C6');
  px(g, 3, 18, 9, 1, '#8FB0C6');
  PAINTED.signBoard = c;
}

/* ---- 게시 기둥 1×2 — 광장에 서 있는 원통 광고탑 ---- */
{
  const c = canvasOf(1, 2), g = c.getContext('2d')!;
  shadow(g, 8, 30, 6, 2);
  px(g, 3, 28, 10, 3, FURN.metalDark);
  px(g, 4, 5, 8, 24, '#5A4A3E');
  px(g, 4, 5, 3, 24, '#77655A');
  const posters = ['#FF6B52', '#E0708A', '#8FB0C6', '#E8D45C'];
  for (let i = 0; i < 4; i++) {
    px(g, 5, 7 + i * 5, 6, 4, posters[i]);
    px(g, 5, 7 + i * 5, 6, 1, 'rgba(0,0,0,.16)');
  }
  px(g, 3, 2, 10, 4, '#3E5C82');
  px(g, 4, 3, 8, 2, '#5A7FA8');
  px(g, 7, 0, 2, 2, FURN.metalDark);
  PAINTED.pillar = c;
}

/* ---- 깃대 1×3 ---- */
{
  const c = canvasOf(1, 3), g = c.getContext('2d')!;
  shadow(g, 8, 46, 5, 2);
  px(g, 5, 42, 6, 4, FURN.metalDark);
  px(g, 5, 42, 6, 1, FURN.metal);
  px(g, 7, 4, 2, 38, FURN.metal);
  px(g, 8, 4, 1, 38, FURN.metalDark);
  disc(g, 8, 3, 2, FURN.lime);
  px(g, 9, 6, 7, 9, '#3C5C82');
  px(g, 9, 6, 7, 2, '#5A7FA8');
  px(g, 11, 9, 3, 3, FURN.lime);
  PAINTED.flagPole = c;
}

/* ---- 방향 표지판 6×4 — 광장 한가운데 ----
   메이플의 안내 NPC가 하던 일을 물건이 합니다. 스타듀밸리처럼 나무
   팻말이지만 판 색이 그 건물 지붕색과 같아서, 표지판만 보면 어디에
   뭐가 있는지 압니다.

   판에 상징을 넣어 봤다가 뺐습니다 — 18px 짜리 책과 글자가 같은 판
   안에서 겹쳐 둘 다 안 읽혔습니다. 상징은 지붕이 이미 맡고 있으니
   여기서는 **색 · 이름 · 화살표** 셋이면 충분합니다. */
{
  const c = canvasOf(3, 4), g = c.getContext('2d')!;
  const CX = 24;
  shadow(g, CX, 63, 10, 3);

  /* 돌 받침 */
  px(g, CX - 8, 54, 16, 8, '#6E757F');
  px(g, CX - 7, 55, 14, 6, '#96A0AA');
  px(g, CX - 7, 55, 14, 2, '#B6BFC7');
  px(g, CX - 7, 55, 3, 6, '#AAB3BC');
  g.fillStyle = '#7C848E';
  for (let x = CX - 5; x < CX + 6; x += 4) g.fillRect(x, 57, 1, 4);

  /* 기둥 */
  px(g, CX - 2, 3, 4, 53, '#6B4A2E');
  px(g, CX - 2, 3, 2, 53, '#8A6039');
  px(g, CX + 1, 3, 1, 53, '#523821');
  g.fillStyle = 'rgba(82,56,33,.5)';
  for (let y = 7; y < 55; y += 6) g.fillRect(CX - 1, y, 2, 1);


  /* 판 하나.
     방향은 **세 겹으로** 말합니다 — 판이 어느 쪽으로 뻗었는가, 끝이
     어느 쪽으로 뾰족한가, 화살촉이 어디를 보는가. 하나만 쓰면 북과 남을
     화살표 모양으로만 구분해야 해서 흘깃 봐서는 안 읽힙니다. */
  function board(y: any, dir: any, color: any, dark: any, label: any) {
    const w = 39, h = 10;
    const x = dir === 'r' ? 1 : dir === 'l' ? 8 : 4;
    const vert = dir === 'u' || dir === 'd';
    px(g, x + 1, y + 2, w, h, 'rgba(0,0,0,.26)');
    px(g, x, y, w, h, color);                      // 테두리 = 밝은 지붕색
    px(g, x + 1, y + 1, w - 2, h - 2, dark);       // 판 = 어두운 쪽
    px(g, x + 1, y + 1, w - 2, 1, 'rgba(255,255,255,.16)');
    px(g, x + 1, y + h - 2, w - 2, 1, 'rgba(0,0,0,.28)');

    if (!vert) {
      /* 뾰족한 끝 */
      const right = dir === 'r', tip = right ? x + w : x - 1;
      for (let k = 0; k < 6; k++) {
        const t = right ? tip + k : tip - k;
        px(g, t, y + k, 1, h - k * 2, dark);
        px(g, t, y + k, 1, 1, color);
        px(g, t, y + h - k - 1, 1, 1, color);
      }
    } else {
      /* 위·아래는 뾰족할 옆이 없습니다. 판 밖으로 삼각 갈매기를 세워
         붙입니다 — 판 위에 솟았으면 북, 아래로 늘어졌으면 남입니다. */
      const up = dir === 'u', cx = x + (w >> 1);
      for (let k = 0; k < 5; k++) {
        const yy = up ? y - 5 + k : y + h + 4 - k;
        px(g, cx - k, yy, k * 2 + 1, 1, k === 0 ? color : dark);
      }
      px(g, cx - 4, up ? y - 1 : y + h, 9, 1, color);
    }

    /* 이름 — 밝은 지붕색 위에서도 읽히도록 한 픽셀 아래에 그림자를 깝니다 */
    stamp(g, label, 8, '#FFFFFF', x + w / 2, y + h / 2, 'center', 'middle');
  }

  /* 위에서 아래로 북 · 동 · 서 · 남. 판 높이 순서가 곧 지도입니다. */
  board(7,  'u', '#D07A4C', '#8A461F', '기숙사');
  board(18, 'r', '#3E8D82', '#1F544C', '도서관');
  board(29, 'l', '#3C5C82', '#1E3550', '본관');
  board(40, 'd', '#5CB177', '#2E6B45', '학생회관');

  PAINTED.signpost = c;
}
/* ---- 침대 2×2 — 기숙사 미니룸 ---- */
{
  const c = canvasOf(2, 2), g = c.getContext('2d')!;
  shadow(g, 16, 30, 15, 2);
  px(g, 1, 4, 30, 27, '#8A6039');
  px(g, 2, 5, 28, 25, '#B08050');
  px(g, 2, 5, 28, 2, '#C99A64');
  /* 매트리스 */
  px(g, 3, 8, 26, 20, '#E8E2D4');
  px(g, 3, 8, 26, 2, '#F4F0E6');
  /* 이불 */
  px(g, 3, 15, 26, 13, '#5A8FBF');
  px(g, 3, 15, 26, 2, '#7EAAD4');
  g.fillStyle = 'rgba(255,255,255,.22)';
  for (let x = 5; x < 28; x += 5) g.fillRect(x, 17, 2, 9);
  /* 베개 */
  px(g, 6, 9, 20, 6, '#F6F4EE');
  px(g, 6, 9, 20, 2, '#FFFFFF');
  px(g, 6, 14, 20, 1, '#D6D2C8');
  PAINTED.bed = c;
}

/* ---- 우편함 1×1 — 친구 초대 ---- */
{
  const c = canvasOf(1, 1), g = c.getContext('2d')!;
  shadow(g, 8, 15, 6, 2);
  px(g, 6, 9, 4, 6, FURN.metalDark);
  px(g, 2, 3, 12, 8, '#B44A44');
  px(g, 3, 4, 10, 6, '#D2635C');
  px(g, 3, 4, 10, 2, '#E88078');
  px(g, 4, 6, 8, 2, '#5E2422');
  px(g, 11, 2, 2, 5, FURN.lime);
  px(g, 10, 1, 4, 2, FURN.lime);
  PAINTED.mailbox = c;
}

/* ---- 전신 거울 1×2 — 내 기록 ---- */
{
  const c = canvasOf(1, 2), g = c.getContext('2d')!;
  shadow(g, 8, 30, 6, 2);
  px(g, 2, 3, 12, 28, '#8A6039');
  px(g, 3, 4, 10, 26, '#B08050');
  px(g, 4, 5, 8, 24, '#3A5568');
  px(g, 4, 5, 8, 24, '#7FA8C4');
  px(g, 5, 6, 6, 10, '#A8C8DC');
  g.fillStyle = 'rgba(255,255,255,.45)';
  g.fillRect(5, 6, 2, 22); g.fillRect(9, 10, 1, 14);
  px(g, 5, 20, 6, 8, '#6B93B0');
  PAINTED.mirror = c;
}


/** 그린 캔버스를 소품으로 등록합니다. */
function paintedProp(key: any, w: any, h: any, solidRows?: any) {
  const c: number[][] = [];
  for (let j = 0; j < h; j++) {
    c.push([]);
    for (let i = 0; i < w; i++) c[j].push(solidRows ? (solidRows[j] ? 1 : 0) : 1);
  }
  return { s: 'img', canvas: PAINTED[key], w, h, c, t: null };
}

/* 윗줄이 뚫린 것들 — 가로등·깃대는 기둥만 막습니다 */
PROP.eggTurtle  = paintedProp('eggTurtle', 2, 3, [0, 0, 1]);
PROP.eggGiraffe = paintedProp('eggGiraffe', 2, 3, [0, 0, 1]);
PROP.eggMeerkat = paintedProp('eggMeerkat', 2, 3, [0, 0, 1]);
PROP.eggPig     = paintedProp('eggPig', 2, 3, [0, 0, 1]);
PROP.tentA     = paintedProp('tentA', 3, 3, [0, 1, 1]);
PROP.tentB     = paintedProp('tentB', 3, 3, [0, 1, 1]);
PROP.tentC     = paintedProp('tentC', 3, 3, [0, 1, 1]);
/* 막는 것은 기둥 둘뿐입니다 — 가운데는 걸어 들어가 설 수 있습니다.
   관문 안에 서는 것이 곧 미니게임을 시작하는 자리가 됩니다. */
['gateEsc', 'gateA', 'gateB', 'gateC'].forEach((k) => {
  const d = paintedProp(k, 4, 4, [0, 1, 1, 1]);
  d.c[1] = [1, 0, 0, 1]; d.c[2] = [1, 0, 0, 1]; d.c[3] = [1, 0, 0, 1];
  PROP[k] = d;
});
PROP.stack     = paintedProp('stack', 3, 2, [1, 1]);
PROP.board     = paintedProp('board', 2, 2, [0, 1]);
PROP.mat       = paintedProp('mat', 2, 2, [0, 0]);
PROP.reed      = paintedProp('reed', 1, 2, [0, 0]);
PROP.bench     = paintedProp('bench', 2, 2, [0, 1]);
PROP.benchAlt  = paintedProp('bench', 2, 2, [0, 1]);
PROP.lamp      = paintedProp('lamp', 1, 2, [0, 1]);
PROP.vending   = paintedProp('vending', 1, 2, [1, 1]);
PROP.vending2  = paintedProp('vending2', 1, 2, [1, 1]);
PROP.bin       = paintedProp('bin', 1, 1);
PROP.recycle   = paintedProp('recycle', 2, 1);
PROP.cafeSet   = paintedProp('cafeSet', 2, 2, [1, 1]);
PROP.planter   = paintedProp('planter', 1, 2);
PROP.signBoard = paintedProp('signBoard', 1, 2, [0, 1]);
PROP.pillar    = paintedProp('pillar', 1, 2, [0, 1]);
PROP.flagPole  = paintedProp('flagPole', 1, 3, [0, 0, 1]);
PROP.signpost = paintedProp('signpost', 3, 4, [0, 0, 0, 1]);
/* 막는 것은 받침돌뿐입니다 — 판 밑으로는 지나갈 수 있습니다 */
PROP.signpost.c[3] = [0, 1, 0];
PROP.bed      = paintedProp('bed', 2, 2);
PROP.mailbox  = paintedProp('mailbox', 1, 1);
PROP.mirror   = paintedProp('mirror', 1, 2, [0, 1]);
/* ---- 미니룸 소품 ----
   싸이월드 미니룸은 물건이 **빽빽해서** 방처럼 보입니다. 넓게 두면
   가구 카탈로그가 되고, 붙여 놓으면 사는 곳이 됩니다.
   여기 있는 것들은 전부 장식입니다 — 기능은 마이페이지 한 곳에 모았고,
   물건마다 창을 달면 사용자가 어디를 눌러야 할지 모릅니다. */

/* 옷장 2×2 */
{
  const c = canvasOf(2, 2), g = c.getContext('2d')!;
  shadow(g, 16, 30, 14, 2);
  px(g, 1, 2, 30, 29, '#6B4A2E');
  px(g, 2, 3, 28, 27, '#9A6C42');
  px(g, 2, 3, 28, 3, '#B98756');
  px(g, 2, 3, 3, 27, '#B08050');
  px(g, 15, 4, 2, 25, '#6B4A2E');
  [6, 21].forEach((x) => {
    px(g, x, 8, 6, 16, '#8A5F3A');
    px(g, x, 8, 6, 2, '#A97A4C');
  });
  px(g, 13, 15, 2, 4, '#E2C88A');
  px(g, 18, 15, 2, 4, '#E2C88A');
  px(g, 2, 29, 28, 2, '#5A3C24');
  PAINTED.wardrobe = c;
}

/* 플로어 스탠드 1×2 */
{
  const c = canvasOf(1, 2), g = c.getContext('2d')!;
  shadow(g, 8, 30, 6, 2);
  px(g, 5, 27, 7, 4, '#6B5F5A');
  px(g, 5, 27, 7, 1, '#8E827C');
  px(g, 7, 12, 2, 15, '#8E827C');
  px(g, 7, 12, 1, 15, '#B4AAA4');
  px(g, 3, 4, 11, 8, '#E8C87A');
  px(g, 4, 5, 9, 6, '#F6E7B4');
  px(g, 4, 5, 9, 2, '#FCF4D8');
  px(g, 3, 11, 11, 2, '#C9A85E');
  g.fillStyle = 'rgba(255,240,190,.22)';
  g.fillRect(1, 12, 14, 5);
  PAINTED.floorLamp = c;
}

/* 곰 인형 1×1 */
{
  const c = canvasOf(1, 1), g = c.getContext('2d')!;
  shadow(g, 8, 15, 5, 2);
  const f = '#C98F5E', d = '#A06E42', l = '#E0AC7A';
  disc(g, 5, 4, 2, d); disc(g, 11, 4, 2, d);
  disc(g, 5, 4, 1, l); disc(g, 11, 4, 1, l);
  disc(g, 8, 5, 4, f);
  disc(g, 7, 4, 2, l);
  px(g, 6, 5, 1, 1, '#2A2320'); px(g, 9, 5, 1, 1, '#2A2320');
  px(g, 7, 7, 2, 1, '#2A2320');
  px(g, 4, 9, 8, 6, f);
  px(g, 4, 9, 8, 2, l);
  px(g, 2, 10, 3, 3, d); px(g, 11, 10, 3, 3, d);
  px(g, 5, 14, 2, 1, d); px(g, 9, 14, 2, 1, d);
  px(g, 6, 11, 4, 3, '#E8D2B4');
  PAINTED.teddy = c;
}

/* 캐리어 1×1 */
{
  const c = canvasOf(1, 1), g = c.getContext('2d')!;
  shadow(g, 8, 15, 6, 2);
  px(g, 3, 4, 10, 11, '#8A3E36');
  px(g, 4, 5, 8, 9, '#B4544A');
  px(g, 4, 5, 8, 2, '#D06C60');
  px(g, 4, 8, 8, 1, '#7A342C');
  px(g, 4, 11, 8, 1, '#7A342C');
  px(g, 6, 2, 4, 3, '#5F5F66');
  px(g, 6, 2, 4, 1, '#8A8A92');
  px(g, 6, 9, 4, 2, '#E8C86A');
  PAINTED.suitcase = c;
}

/* 낮은 탁자 1×1 */
{
  const c = canvasOf(1, 1), g = c.getContext('2d')!;
  shadow(g, 8, 15, 7, 2);
  px(g, 1, 5, 14, 6, '#6B4A2E');
  px(g, 2, 6, 12, 4, '#A87A4C');
  px(g, 2, 6, 12, 1, '#C1955F');
  px(g, 2, 11, 2, 4, '#6B4A2E');
  px(g, 12, 11, 2, 4, '#6B4A2E');
  px(g, 4, 3, 4, 3, '#F0F2F5');
  px(g, 4, 3, 4, 1, '#FFFFFF');
  px(g, 9, 4, 3, 2, '#B4544A');
  PAINTED.sideTable = c;
}

/* 방석 1×1 */
{
  const c = canvasOf(1, 1), g = c.getContext('2d')!;
  shadow(g, 8, 14, 6, 2);
  px(g, 2, 5, 12, 8, '#C25A6E');
  px(g, 3, 6, 10, 6, '#E0788A');
  px(g, 3, 6, 10, 2, '#F0A0AC');
  px(g, 3, 12, 10, 1, '#A8465A');
  disc(g, 8, 9, 1, '#A8465A');
  PAINTED.cushion = c;
}

PROP.wardrobe  = paintedProp('wardrobe', 2, 2);
PROP.floorLamp = paintedProp('floorLamp', 1, 2, [0, 1]);
PROP.teddy     = paintedProp('teddy', 1, 1);
PROP.suitcase  = paintedProp('suitcase', 1, 1);
PROP.sideTable = paintedProp('sideTable', 1, 1);
PROP.cushion   = paintedProp('cushion', 1, 1);

/* ==================================================================
   앉는 자리와 문 — 직접 그립니다

   Cool School 의자는 48px 원본을 3으로 나눈 것이라 등받이 살이 뭉개져
   "잘린 상자" 로 보였습니다. 16px 에서 의자로 읽히려면 **등받이 · 앉는
   면 · 다리** 세 덩이가 각각 최소 4px 은 되어야 하는데, 축소로는 그
   경계가 남지 않습니다. 그래서 16px 격자에 맞춰 처음부터 그립니다.

   빛은 언제나 왼쪽 위. 바닥에 닿는 자리에는 그림자를 깔아야 물건이
   떠 있지 않습니다.
   ================================================================== */

const DESKPAL = {
  wood:    '#A9773F', woodLit: '#C99A5C', woodDark: '#7E5526', woodDeep: '#5E3D19',
  seat:    '#4E6E8E', seatLit: '#6E8FAE', seatDark: '#35506B',
  metal:   '#9AA3AD', metalLit: '#C4CBD2', metalDark: '#616974',
  glass:   '#BFD9E4', glassLit: '#E2F0F5', glassDark: '#6E93A4',
  mat:     '#C2412C', matLit: '#E0604A',
};

/* ---- 의자 1×1 — 등받이 · 앉는 면 · 다리 ---- */
function chairCanvas(seatCol: any, seatLit: any, seatDark: any) {
  const c = canvasOf(1, 1), g = c.getContext('2d')!;
  const P = DESKPAL;
  shadow(g, 8, 15, 6, 2);
  /* 등받이 — 위쪽. 살 두 개가 있어야 의자로 읽힙니다. */
  px(g, 3, 0, 10, 6, P.woodDark);
  px(g, 4, 1, 8, 4, P.wood);
  px(g, 4, 1, 8, 1, P.woodLit);
  px(g, 6, 2, 1, 3, P.woodDark);
  px(g, 9, 2, 1, 3, P.woodDark);
  /* 앉는 면 — 좌우로 조금 넓어야 등받이와 구분됩니다. */
  px(g, 2, 6, 12, 6, P.woodDeep);
  px(g, 2, 6, 12, 5, seatCol);
  px(g, 2, 6, 12, 2, seatLit);
  px(g, 3, 10, 10, 1, seatDark);
  /* 다리 넷 — 앞 둘만 보이고 뒤 둘은 그림자로 */
  px(g, 3, 12, 2, 4, P.woodDark);
  px(g, 3, 12, 1, 4, P.wood);
  px(g, 11, 12, 2, 4, P.woodDark);
  px(g, 11, 12, 1, 4, P.wood);
  px(g, 5, 12, 6, 1, 'rgba(0,0,0,.18)');
  return c;
}
PAINTED.chair  = chairCanvas(DESKPAL.seat, DESKPAL.seatLit, DESKPAL.seatDark);
PAINTED.chairB = chairCanvas('#8E5A4E', '#AE7A6A', '#6B4038');
PAINTED.chairC = chairCanvas('#4E7A5E', '#6E9A7C', '#376046');
PAINTED.chairD = chairCanvas('#7A6A4E', '#9A8A6C', '#5A4C36');

/* ---- 책상 ----
   상판 · 앞면 · 다리 세 켜. 상판만 그리면 판때기로 보입니다. */
function deskCanvas(wTiles: any, topCol: any, topLit: any) {
  const c = canvasOf(wTiles, 1), g = c.getContext('2d')!;
  const P = DESKPAL, W = wTiles * T;
  shadow(g, W / 2, 15, W / 2 - 2, 2);
  /* 상판 */
  px(g, 0, 1, W, 10, P.woodDeep);
  px(g, 1, 2, W - 2, 8, topCol);
  px(g, 1, 2, W - 2, 2, topLit);
  /* 나뭇결 */
  g.fillStyle = 'rgba(94,61,25,.20)';
  for (let x = 3; x < W - 3; x += 7) g.fillRect(x, 5, 5, 1);
  /* 앞면 — 상판보다 어두워야 두께가 보입니다 */
  px(g, 1, 10, W - 2, 3, P.woodDark);
  px(g, 1, 10, W - 2, 1, P.wood);
  /* 다리 */
  px(g, 2, 13, 2, 3, P.woodDeep);
  px(g, W - 4, 13, 2, 3, P.woodDeep);
  return c;
}
PAINTED.desk1 = deskCanvas(1, DESKPAL.wood, DESKPAL.woodLit);
PAINTED.desk2 = deskCanvas(2, DESKPAL.wood, DESKPAL.woodLit);
PAINTED.desk3 = deskCanvas(3, '#B8834A', '#D6A165');

/* ---- 책상 위 물건 — 노트북·책·스탠드 ---- */
{
  const c = canvasOf(1, 1), g = c.getContext('2d')!;
  /* 노트북 — 열린 화면이 뒤로 서 있습니다 */
  px(g, 3, 1, 10, 7, '#4A525C');
  px(g, 4, 2, 8, 5, '#8FB4C6');
  px(g, 4, 2, 8, 2, '#C4DDE8');
  px(g, 2, 8, 12, 3, '#6B747E');
  px(g, 2, 8, 12, 1, '#98A2AC');
  px(g, 4, 9, 8, 1, '#4A525C');
  PAINTED.laptopN = c;
}
{
  const c = canvasOf(1, 1), g = c.getContext('2d')!;
  const cols = ['#B75B4C', '#52739F', '#8B9C48', '#CDC2B1'];
  for (let i = 0; i < 4; i++) {
    px(g, 3, 12 - i * 3, 10, 3, cols[i]);
    px(g, 3, 12 - i * 3, 10, 1, 'rgba(255,255,255,.30)');
    px(g, 3, 14 - i * 3, 10, 1, 'rgba(0,0,0,.22)');
  }
  PAINTED.books2 = c;
}
{
  const c = canvasOf(1, 1), g = c.getContext('2d')!;
  shadow(g, 8, 15, 5, 2);
  px(g, 5, 12, 6, 3, DESKPAL.metalDark);
  px(g, 7, 5, 2, 8, DESKPAL.metal);
  px(g, 4, 2, 8, 4, DESKPAL.metalDark);
  px(g, 5, 3, 6, 2, '#FFF3C4');
  g.fillStyle = 'rgba(255,243,196,.20)'; g.fillRect(3, 6, 10, 4);
  PAINTED.deskLamp = c;
}

/* ---- 큰 출입문 3×2 ----
   건물마다 문이 다르면 "여기가 나가는 곳" 을 매번 새로 배워야 합니다.
   전부 같은 문을 씁니다 — 윗창 · 유리 두 짝 · 손잡이 · 발판. */
{
  const c = canvasOf(3, 2), g = c.getContext('2d')!;
  const P = DESKPAL;
  const W = 48;
  /* 문틀 */
  px(g, 0, 0, W, 32, P.metalDark);
  px(g, 1, 1, W - 2, 30, P.metal);
  px(g, 1, 1, W - 2, 2, P.metalLit);
  /* 윗창 */
  px(g, 4, 3, W - 8, 6, P.glassDark);
  px(g, 5, 4, W - 10, 4, P.glass);
  px(g, 5, 4, W - 10, 2, P.glassLit);
  /* 유리 두 짝 */
  [5, 25].forEach((x) => {
    px(g, x, 11, 18, 19, P.metalDark);
    px(g, x + 1, 12, 16, 17, P.glass);
    px(g, x + 1, 12, 16, 5, P.glassLit);
    /* 비스듬한 반사 — 한 줄이면 유리가 됩니다 */
    g.fillStyle = 'rgba(255,255,255,.42)';
    for (let i = 0; i < 12; i++) g.fillRect(x + 3 + i, 26 - i, 2, 1);
    px(g, x + 1, 27, 16, 2, P.glassDark);
  });
  /* 가운데 기둥과 손잡이 */
  px(g, 22, 11, 4, 19, P.metalDark);
  px(g, 22, 11, 1, 19, P.metal);
  px(g, 19, 19, 3, 5, P.metalLit);
  px(g, 26, 19, 3, 5, P.metalLit);
  /* 발판 — 코랄. 나가는 곳이라는 표시입니다. */
  px(g, 6, 30, 36, 2, P.mat);
  px(g, 6, 30, 36, 1, P.matLit);
  PAINTED.exitDoor = c;
}

/* 문은 통과할 수 있어야 합니다 — 아랫줄만 뚫습니다 */
/* 문은 **통로**입니다. 그림에 충돌을 주면 문 앞에서 막혀 영영 못
   나갑니다 — 막는 것은 문이 아니라 그 옆의 벽입니다. */
PROP.exitDoor = paintedProp('exitDoor', 3, 2, [0, 0]);
PROP.chair    = { ...paintedProp('chair', 1, 1), sit: true };
PROP.chairB   = { ...paintedProp('chairB', 1, 1), sit: true };
PROP.chairC   = { ...paintedProp('chairC', 1, 1), sit: true };
PROP.chairD   = { ...paintedProp('chairD', 1, 1), sit: true };
PROP.desk1    = paintedProp('desk1', 1, 1);
PROP.desk2    = paintedProp('desk2', 2, 1);
PROP.desk3    = paintedProp('desk3', 3, 1);
PROP.laptopN  = { ...paintedProp('laptopN', 1, 1), c: [[0]] };
PROP.books2   = { ...paintedProp('books2', 1, 1), c: [[0]] };
PROP.deskLamp = { ...paintedProp('deskLamp', 1, 1), c: [[0]] };

/* ==================================================================
   실내 바닥

   타일 한 장을 반복하면 격자가 눈에 띄고, 넓은 방일수록 심해집니다.
   방 전체를 한 장에 그리면 널판 이음새를 어긋나게 놓고, 통로를 다른
   재질로 깔고, 걸레받이 그림자까지 넣을 수 있습니다.
   ================================================================== */
function paintFloor(w: any, h: any, kind: any) {
  const c = canvasOf(w, h), g = c.getContext('2d')!;
  const W = c.width, H = c.height;

  if (kind === 'parquet') {
    /* 마루 — 도서관. 널판을 줄마다 어긋나게 깝니다. */
    px(g, 0, 0, W, H, '#C9A87C');
    for (let y = 0; y < H; y += 8) {
      const off = (y / 8 % 2) * 24;
      for (let x = -24; x < W; x += 48) {
        const n = rnd(x, y, 3);
        px(g, x + off, y, 47, 7, n < 0.33 ? '#C49A6C' : n < 0.66 ? '#CFA87E' : '#BC8F62');
        px(g, x + off, y, 47, 1, 'rgba(255,255,255,.12)');
        px(g, x + off + 46, y, 1, 7, 'rgba(0,0,0,.14)');
      }
      px(g, 0, y + 7, W, 1, 'rgba(0,0,0,.13)');
    }
  } else if (kind === 'stone') {
    /* 석재 — 본관. 큰 판을 줄눈으로 나눕니다. */
    px(g, 0, 0, W, H, '#B9BEC6');
    for (let y = 0; y < H; y += 24) for (let x = 0; x < W; x += 24) {
      const n = rnd(x, y, 7);
      px(g, x, y, 23, 23, n < 0.3 ? '#C2C7CE' : n < 0.7 ? '#B4B9C2' : '#BDC2C9');
      px(g, x, y, 23, 1, 'rgba(255,255,255,.16)');
      px(g, x, y, 1, 23, 'rgba(255,255,255,.12)');
      px(g, x + 23, y, 1, 24, 'rgba(0,0,0,.13)');
      px(g, x, y + 23, 24, 1, 'rgba(0,0,0,.13)');
      /* 반점 — 화강암 느낌 */
      g.fillStyle = 'rgba(90,100,115,.22)';
      for (let s = 0; s < 5; s++)
        g.fillRect(x + 3 + Math.floor(rnd(x + s, y, 11) * 17),
                   y + 3 + Math.floor(rnd(x, y + s, 13) * 17), 1, 1);
    }
  } else if (kind === 'laminate') {
    /* 장판 — 기숙사. 따뜻하고 이음새가 촘촘합니다. */
    px(g, 0, 0, W, H, '#DBC49E');
    for (let y = 0; y < H; y += 11) {
      const n = rnd(0, y, 5);
      px(g, 0, y, W, 10, n < 0.4 ? '#DCC6A2' : n < 0.75 ? '#D6BE99' : '#E0CBA6');
      px(g, 0, y, W, 1, 'rgba(255,255,255,.14)');
      px(g, 0, y + 10, W, 1, 'rgba(0,0,0,.07)');
      /* 나뭇결 — 촘촘하면 줄무늬가 되고 성글면 나무가 됩니다 */
      g.fillStyle = 'rgba(150,120,80,.11)';
      for (let x = 0; x < W; x += 19)
        g.fillRect(x + ((y / 11) % 2 ? 9 : 0), y + 4, 11, 1);
    }
  } else {
    /* 타일 — 학생회관. 반들거리는 대형 타일. */
    px(g, 0, 0, W, H, '#DDE3E6');
    for (let y = 0; y < H; y += 16) for (let x = 0; x < W; x += 16) {
      const n = rnd(x, y, 9);
      px(g, x, y, 15, 15, n < 0.5 ? '#E2E8EA' : '#D8DEE2');
      px(g, x, y, 15, 1, 'rgba(255,255,255,.5)');
      px(g, x, y, 1, 15, 'rgba(255,255,255,.35)');
      px(g, x + 15, y, 1, 16, 'rgba(120,132,140,.3)');
      px(g, x, y + 15, 16, 1, 'rgba(120,132,140,.3)');
    }
  }

  /* 벽에서 떨어지는 그림자. 바닥과 벽이 만나는 자리가 어두워야
     방이 닫힌 상자로 보입니다. */
  const grad = g.createLinearGradient(0, T * 3, 0, T * 3 + 14);
  grad.addColorStop(0, 'rgba(0,0,0,.30)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, T * 3, W, 14);
  const gl = g.createLinearGradient(T, 0, T + 10, 0);
  gl.addColorStop(0, 'rgba(0,0,0,.22)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gl; g.fillRect(T, T * 3, 10, H - T * 3);
  const gr = g.createLinearGradient(W - T, 0, W - T - 10, 0);
  gr.addColorStop(0, 'rgba(0,0,0,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(W - T - 10, T * 3, 10, H - T * 3);
  return c;
}

/** 통로·러그를 바닥 위에 덧그립니다. 방의 동선을 눈으로 알려 줍니다. */
/** 스탠드 아래 빛웅덩이. 조명이 켜져 있는데 바닥이 그대로면
    스탠드가 장식품으로 보입니다. */
function floorGlow(c: any, cx: any, cy: any, r: any) {
  const g = c.getContext('2d')!;
  const X = cx * T, Y = cy * T, R = r * T;
  for (let k = 4; k >= 1; k--) {
    g.fillStyle = 'rgba(255,214,138,' + (0.05 * k) + ')';
    g.beginPath(); g.ellipse(X, Y, R * (k / 4), R * (k / 4) * 0.72, 0, 0, 7); g.fill();
  }
}

function floorInlay(c: any, x: any, y: any, w: any, h: any, kind: any) {
  const g = c.getContext('2d')!;
  const X = x * T, Y = y * T, W = w * T, H = h * T;
  if (kind === 'border') {
    /* 벽을 따라 도는 테두리 띠. 넓은 방은 이게 없으면 바닥이 아니라
       무늬 종이가 됩니다. */
    px(g, X, Y, W, T, 'rgba(0,0,0,.10)');
    px(g, X, Y + H - T, W, T, 'rgba(0,0,0,.10)');
    px(g, X, Y, T, H, 'rgba(0,0,0,.10)');
    px(g, X + W - T, Y, T, H, 'rgba(0,0,0,.10)');
    px(g, X + T - 2, Y + T - 2, W - T * 2 + 4, 2, 'rgba(255,255,255,.20)');
    px(g, X + T - 2, Y + H - T, W - T * 2 + 4, 2, 'rgba(255,255,255,.20)');
    px(g, X + T - 2, Y + T - 2, 2, H - T * 2 + 4, 'rgba(255,255,255,.20)');
    px(g, X + W - T, Y + T - 2, 2, H - T * 2 + 4, 'rgba(255,255,255,.20)');
    return;
  }
  if (kind === 'runner') {
    px(g, X, Y, W, H, 'rgba(62,141,130,.16)');
    px(g, X, Y, W, 2, 'rgba(255,255,255,.22)');
    px(g, X + W - 2, Y, 2, H, 'rgba(0,0,0,.12)');
    g.fillStyle = 'rgba(62,141,130,.4)';
    g.fillRect(X + 2, Y, 2, H); g.fillRect(X + W - 5, Y, 2, H);
  } else if (kind === 'rug') {
    /* 테두리 두 겹에 안쪽 무늬. 동심 사각을 계속 겹치면 과녁이 됩니다. */
    px(g, X, Y, W, H, '#9A6A57');
    px(g, X + 4, Y + 4, W - 8, H - 8, '#B5866C');
    px(g, X + 7, Y + 7, W - 14, H - 14, '#A87458');
    px(g, X + 11, Y + 11, W - 22, H - 22, '#C39679');
    g.fillStyle = 'rgba(154,106,87,.55)';
    for (let yy = Y + 16; yy < Y + H - 16; yy += 14)
      for (let xx = X + 16; xx < X + W - 16; xx += 14) {
        g.fillRect(xx, yy + 2, 6, 2); g.fillRect(xx + 2, yy, 2, 6);
      }
    /* 술 */
    g.fillStyle = '#D9BCA4';
    for (let xx = X + 2; xx < X + W - 2; xx += 4) {
      g.fillRect(xx, Y - 3, 2, 3); g.fillRect(xx, Y + H, 2, 3);
    }
    px(g, X, Y, W, 2, 'rgba(255,255,255,.12)');
    px(g, X, Y + H - 2, W, 2, 'rgba(0,0,0,.16)');
  }
}

/* ================== 맵 ================== */
/* ---------------- 표면 ----------------
   무엇을 밟고 있는지. 발소리·먼지·풀 눕히기가 전부 이 값을 봅니다.

   over 나 base 로 매번 알아내지 않는 이유 - 트랙과 자갈 마당은 잔디
   위에 **그림으로만** 얹혀 있어 타일 값으로는 구분되지 않습니다. 그림과
   감촉이 어긋나면 포석 위에서 잔디 소리가 납니다. */
const SURF = { GRASS: 0, STONE: 1, WOOD: 2, TILE: 3, WATER: 4, GRAVEL: 5, TRACK: 6 };

/** 바닥 그림과 짝이 맞는 표면을 칠합니다. 그림을 그린 자리에 같은 범위로
    부르세요 - 안 부르면 bake 가 잔디로 둡니다. */
function fillSurf(m: any, x: any, y: any, w: any, h: any, kind: any) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++)
    if (inMap(m, i, j)) m.surf[at(m, i, j)] = kind;
}


/* ---------------- 존 ----------------
   맵 하나의 모양입니다. makeMap 이 뼈대를 만들고, 존을 짓는 쪽이 이름과
   그림을 붙이고, bake 가 충돌을 굽습니다. 세 단계라 나중에 붙는 것은
   전부 선택입니다.

   이 타입만 제대로 쓰는 이유 - 화면·이동·세션·저장이 전부 존을 읽습니다.
   여기서 이름 하나를 틀리면 그 오류가 파일 밖으로 나갑니다. */
export interface WorldProp { kind: string; x: number; y: number }
export interface WorldPortal {
  x: number; y: number; w: number; h: number;
  to: string; sx: number; sy: number; label: string;
}
export interface WorldThing { x: number; y: number; name: string; panel?: string }
export interface WorldNpc { x: number; y: number; name: string; [k: string]: any }
export interface WorldWall { c: HTMLCanvasElement; x: number; y: number }

export interface WorldMap {
  w: number; h: number;
  base: Uint16Array;          // 바닥 타일 인덱스
  over: Uint8Array;           // 오토타일 재질 (0 = 없음)
  /** 무엇을 밟고 있는지. SURF 값. 발소리·먼지·풀 눕히기가 이걸 봅니다.
      over 나 base 로 알아낼 수 없는 이유 - 트랙과 자갈 마당은 잔디 위에
      그림으로만 얹혀 있어 타일 값으로는 구분되지 않습니다. */
  surf: Uint8Array;
  /** 실내는 바닥 한 장이 방 전체라 방의 재질이 곧 표면입니다.
      bake 가 이 값으로 surf 의 빈 칸을 채웁니다. 야외는 없습니다. */
  floorKind?: number;
  props: WorldProp[];
  portals: WorldPortal[];
  npcs: WorldNpc[];
  things: WorldThing[];

  /* 존을 지으면서 붙습니다 */
  name?: string;
  sub?: string;
  floor?: HTMLCanvasElement;   // 실내 - 방 전체가 한 장
  ground?: HTMLCanvasElement;  // 야외 - 잔디를 한 장으로
  walls?: WorldWall[];
  spawn?: { x: number; y: number };
  clock?: { x: number; y: number };

  /* bake() 가 굽습니다 */
  solid?: Uint8Array;
  sitSpots?: { x: number; y: number }[];
}

function makeMap(w: number, h: number, baseTile: number): WorldMap {
  return { w, h, base: new Uint16Array(w * h).fill(baseTile),
           over: new Uint8Array(w * h), surf: new Uint8Array(w * h),
           props: [], portals: [], npcs: [], things: [] };
}
const at = (m: WorldMap, x: any, y: any) => y * m.w + x;
const inMap = (m: WorldMap, x: any, y: any) => x >= 0 && y >= 0 && x < m.w && y < m.h;

function fillBase(m: WorldMap, x: any, y: any, w: any, h: any, tile: any) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++)
    if (inMap(m, i, j)) m.base[at(m, i, j)] = tile;
}
function fillOver(m: WorldMap, x: any, y: any, w: any, h: any, mat: any) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++)
    if (inMap(m, i, j)) m.over[at(m, i, j)] = mat;
}
/** 타원으로 표면을 칠합니다. 트랙 인필드처럼 둥근 안쪽을 되살릴 때 씁니다. */
function fillEllipseSurf(m: any, cx: any, cy: any, rx: any, ry: any, kind: any) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1 && inMap(m, x, y)) m.surf[at(m, x, y)] = kind;
    }
}

/** 타원으로 재질을 칠합니다. 사각형으로 칠한 못은 수영장이 됩니다. */
function fillEllipse(m: WorldMap, cx: any, cy: any, rx: any, ry: any, mat: any) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1 && inMap(m, x, y)) m.over[at(m, x, y)] = mat;
    }
}
function ring(m: WorldMap, x: any, y: any, w: any, h: any, tile: any) {
  for (let i = x; i < x + w; i++) { fillBase(m, i, y, 1, 1, tile); fillBase(m, i, y + h - 1, 1, 1, tile); }
  for (let j = y; j < y + h; j++) { fillBase(m, x, j, 1, 1, tile); fillBase(m, x + w - 1, j, 1, 1, tile); }
}
function prop(m: WorldMap, kind: any, x: any, y: any) { m.props.push({ kind, x, y }); }
function rowOf(m: WorldMap, kind: any, x: any, y: any, n: any, step = 1) { for (let i = 0; i < n; i++) prop(m, kind, x + i * step, y); }
function rnd(x: any, y: any, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 건물을 세우고, 문에 포탈과 간판을 같이 답니다. */
function placeBuilding(m: WorldMap, kind: any, x: any, y: any, to: any, sx: any, sy: any, label: any) {
  const d = PROP[kind];
  prop(m, kind, x, y);
  const dx = x + d.doorX, dy = y + d.h - 1;
  m.portals.push({ x: dx, y: dy, w: 2, h: 1, to, sx, sy, label });
  /* 문 앞 진입로 */
  fillOver(m, dx - 1, dy + 1, 4, 3, M.PLAZA);
}

/* ---- 숲 ----
   맵을 십자로 자르면 잘린 면이 생깁니다. 잔디로 두면 "왜 더 못 가지"가
   되고, 검게 두면 화면이 고장 난 것처럼 보입니다. 나무를 빽빽이 세워
   **여기서 캠퍼스가 끝난다**고 말하게 했습니다. */
function treeBlob(g: CanvasRenderingContext2D, x: any, y: any, r: any) {
  const R = r > 0.6 ? 9 : r > 0.28 ? 7 : 6;
  g.fillStyle = 'rgba(0,0,0,.26)';
  g.beginPath(); g.ellipse(x, y, R, Math.max(2, R * 0.4), 0, 0, 7); g.fill();
  px(g, x - 1, y - R, 3, R, '#553A25');
  px(g, x - 1, y - R, 1, R, '#75543A');
  disc(g, x, y - R - 2, R, '#1F4B2C');
  disc(g, x, y - R - 3, R - 1, '#2E6A3C');
  disc(g, x - 2, y - R - 4, Math.max(2, R - 4), '#44884B');
  disc(g, x - 3, y - R - 5, Math.max(1, R - 6), '#5CA35C');
}
function bushBlob(g: CanvasRenderingContext2D, x: any, y: any, s: any) {
  disc(g, x, y, s, '#24522F');
  disc(g, x, y - 1, s - 1, '#33703E');
  disc(g, x - 1, y - 2, Math.max(1, s - 3), '#4A8C4F');
}
/* ---- 잔디 ----
   시트의 잔디 타일은 #38CBAB, 청록입니다. 그 위에 나무를 심으면 땅만
   물색이라 숲이 캠퍼스에 붙어 있지 않고 떠 보입니다. 실내 마루처럼
   캠퍼스 바닥도 한 장으로 그립니다 — 16px 격자가 사라지고, 얼룩과
   풀포기를 타일 경계와 상관없이 놓을 수 있습니다. */
function paintLawn(wTiles: any, hTiles: any) {
  const c = canvasOf(wTiles, hTiles), g = c.getContext('2d')!;
  const W = c.width, H = c.height;
  px(g, 0, 0, W, H, '#5B9E52');
  for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) {
    const r = rnd(x, y, 3);
    if (r > 0.78) px(g, x, y, 4, 3, '#68AC5C');
    else if (r < 0.20) px(g, x, y, 3, 3, '#4F8E49');
  }
  /* 넓은 얼룩 — 잔디가 한 톤이면 장판입니다. 풀포기보다 먼저 깔아야
     포기가 얼룩 위에 서 있는 것으로 보입니다. */
  for (let y = 0; y < H; y += 11) for (let x = 0; x < W; x += 11) {
    if (rnd(x, y, 41) < 0.6) continue;
    const r = 6 + Math.round(rnd(x, y, 42) * 7);
    disc(g, x + Math.round(rnd(x, y, 43) * 10), y + Math.round(rnd(x, y, 44) * 10), r,
         rnd(x, y, 45) > 0.5 ? 'rgba(122,191,102,.30)' : 'rgba(64,124,60,.26)');
  }
  /* 풀포기 — 3px 짜리 V 자. 간격만큼 흔들어야 격자가 안 보입니다:
     7px 격자에 4px 만 흔들었더니 대각선 줄이 그대로 남았습니다. */
  for (let y = 4; y < H - 3; y += 9) for (let x = 3; x < W - 3; x += 9) {
    if (rnd(x, y, 11) < 0.34) continue;
    const bx = x + Math.round(rnd(x, y, 12) * 8), by = y + Math.round(rnd(x, y, 13) * 8);
    if (bx >= W - 2 || by >= H - 3) continue;
    g.fillStyle = rnd(bx, by, 14) > 0.5 ? '#7CBF66' : '#6FB35C';
    const tall = rnd(bx, by, 15) > 0.62 ? 3 : 2;
    g.fillRect(bx, by, 1, tall);
    g.fillRect(bx - 1, by - 1 + (tall > 2 ? 1 : 0), 1, tall - 1);
    g.fillRect(bx + 1, by - 1, 1, tall - 1);
    g.fillStyle = '#46833F'; g.fillRect(bx, by + tall, 1, 1);
  }
  return c;
}
/* ---- 육상 트랙 ----
   레인 선이 없으면 붉은 도넛입니다. 선이 트랙을 트랙으로 만듭니다. */
function paintTrack(wTiles: any, hTiles: any) {
  const c = canvasOf(wTiles, hTiles), g = c.getContext('2d')!;
  const W = c.width, H = c.height, cx = W / 2, cy = H / 2;
  const RX = W / 2 - 5, RY = H / 2 - 5;
  const ell = (rx: any, ry: any, col: any) => {
    g.fillStyle = col;
    for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
      const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      if (w > 0) g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
    }
  };
  ell(RX + 3, RY + 3, '#7E8C6A');                 // 바깥 연석
  ell(RX, RY, '#BF563C');                          // 우레탄
  /* 레인 — 안쪽으로 네 줄. 흰 타원을 그리고 한 겹 안을 다시 덮어 선만 남깁니다. */
  for (let k = 0; k < 4; k++) {
    const rx = RX - 5 - k * 7, ry = RY - 4 - k * 6;
    ell(rx, ry, '#F0E7D8');
    ell(rx - 1, ry - 1, k % 2 ? '#B44F36' : '#BF563C');
  }
  const IX = RX - 32, IY = RY - 26;
  ell(IX + 2, IY + 2, '#E8DFCB');                  // 안쪽 연석
  ell(IX, IY, '#57A053');                          // 인필드
  /* 인필드 결 — 잔디깎이 자국. 이게 있으면 운동장이 됩니다. */
  g.globalAlpha = 0.18; g.fillStyle = '#8FD08A';
  for (let x = -IX; x < IX; x += 12) {
    for (let y = -IY; y <= IY; y++) {
      const w = Math.floor(IX * Math.sqrt(Math.max(0, 1 - (y * y) / (IY * IY))));
      if (x > -w && x < w) g.fillRect(Math.round(cx + x), Math.round(cy + y), 6, 1);
    }
  }
  g.globalAlpha = 1;
  /* 출발선 */
  g.fillStyle = '#F0E7D8';
  for (let y = 0; y < 22; y++) g.fillRect(Math.round(cx), Math.round(cy - RY + 5 + y), 2, 1);
  return c;
}

/* ---- 미니게임존 마당 ----
   관문 넷이 마주 보고 서는 안뜰입니다. 가운데 통로를 한 줄 비워 두면
   어디로 걸어 들어가는지가 바닥에서 먼저 읽힙니다 — 상가 거리와 같은
   원리입니다. */
function paintArcadeCourt(wTiles: any, hTiles: any) {
  const c = canvasOf(wTiles, hTiles), g = c.getContext('2d')!;
  const W = c.width, H = c.height;
  px(g, 0, 0, W, H, '#C6BCA6');
  /* 판석 — 줄눈을 한 줄씩 어긋나게 놓습니다. 맞추면 타일 격자가 보입니다. */
  for (let y = 0; y < H; y += 8) {
    const off = (y / 8) % 2 ? 6 : 0;
    for (let x = -12; x < W; x += 12) {
      const r = rnd(x, y, 71);
      px(g, x + off, y, 11, 7, r > 0.72 ? '#D3CAB5' : r < 0.2 ? '#B7AD97' : '#CBC2AC');
    }
  }
  g.fillStyle = 'rgba(120,110,92,.35)';
  for (let y = 7; y < H; y += 8) g.fillRect(0, y, W, 1);

  /* 가운데 통로 — 코랄 실선 둘로 폭을 표시합니다 */
  const aisle = 5 * T, aw = 3 * T;
  px(g, aisle, 0, aw, H, 'rgba(255,107,82,.10)');
  px(g, aisle, 0, 2, H, 'rgba(255,107,82,.55)');
  px(g, aisle + aw - 2, 0, 2, H, 'rgba(255,107,82,.55)');

  /* 모서리를 45도로 깎고 연석을 두릅니다 */
  const CUT = 22;
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  for (let k = 0; k < CUT; k++) {
    const w = CUT - k;
    g.fillRect(0, k, w, 1);         g.fillRect(W - w, k, w, 1);
    g.fillRect(0, H - 1 - k, w, 1); g.fillRect(W - w, H - 1 - k, w, 1);
  }
  g.globalCompositeOperation = 'source-over';
  for (let y = 0; y < H; y++) {
    const ins = y < CUT ? CUT - y : y >= H - CUT ? CUT - (H - 1 - y) : 0;
    px(g, ins, y, 2, 1, '#8E8471');
    px(g, W - ins - 2, y, 2, 1, '#8E8471');
  }
  for (let x = CUT; x < W - CUT; x++) {
    px(g, x, 0, 1, 2, '#8E8471');
    px(g, x, H - 2, 1, 2, '#8E8471');
  }
  return c;
}

function paintGrove(wTiles: any, hTiles: any, seed: any) {
  /* 걷는 쪽으로 두 칸 넘겨 그립니다. 잎이 잔디 위로 늘어져야 숲이
     **자란** 것으로 보입니다 — 딱 맞게 자르면 초록 카펫을 깐 꼴입니다.
     지도 밖으로 넘친 쪽은 어차피 잘려 나갑니다. */
  const PAD = 2;
  const c = canvasOf(wTiles + PAD * 2, hTiles + PAD * 2), g = c.getContext('2d')!;
  const W = c.width, H = c.height, m = PAD * T;

  /* 그늘진 바닥. 네 변을 모두 흔들어야 직선이 안 남습니다. */
  const img = g.createImageData(W, H), a = img.data;
  const mask = new Uint8Array(W * H);
  const tone = ['#37603D', '#43714A', '#2C5335'].map(hexRGB);
  const top = [], bot = [];
  for (let x = 0; x < W; x++) {
    top[x] = m - 6 + Math.round(rnd(x, 3, seed) * 11);
    bot[x] = H - m + 6 - Math.round(rnd(x, 91, seed) * 11);
  }
  for (let y = 0; y < H; y++) {
    const l = Math.max(0, m - 6 + Math.round(rnd(7, y, seed) * 11));
    const r = Math.min(W, W - m + 6 - Math.round(rnd(77, y, seed) * 11));
    for (let x = l; x < r; x++) {
      if (y < top[x] || y >= bot[x]) continue;
      const v = rnd(x, y, seed + 5);
      const t = tone[v > 0.76 ? 1 : v < 0.2 ? 2 : 0];
      const k = (y * W + x) * 4;
      a[k] = t[0]; a[k + 1] = t[1]; a[k + 2] = t[2]; a[k + 3] = 255;
      mask[y * W + x] = 1;
    }
  }
  g.putImageData(img, 0, 0);

  /* 나무는 격자를 어긋나게 심습니다. 줄이 맞으면 과수원이 됩니다. */
  const trees = [];
  for (let ty = 2; ty < H; ty += 10)
    for (let tx = 2; tx < W; tx += 10) {
      const x = tx + Math.round(rnd(tx, ty, seed) * 7);
      const y = ty + Math.round(rnd(tx, ty, seed + 7) * 7);
      if (x >= W || y >= H || !mask[y * W + x]) continue;   // 그늘 밖에는 안 심습니다
      trees.push({ x, y, r: rnd(tx, ty, seed + 13) });
    }
  trees.sort((u, v) => u.y - v.y);
  for (const t of trees) treeBlob(g, t.x, t.y, t.r);

  /* 덤불 — 숲 가장자리의 아랫도리. 나무만 있으면 발밑이 비어 보입니다. */
  for (let y = 3; y < H; y += 7) for (let x = 3; x < W; x += 7) {
    if (rnd(x, y, seed + 21) < 0.55) continue;
    const bx = x + Math.round(rnd(x, y, seed + 22) * 5);
    const by = y + Math.round(rnd(x, y, seed + 23) * 5);
    if (bx >= W || by >= H || !mask[by * W + bx]) continue;
    bushBlob(g, bx, by, 3 + Math.round(rnd(x, y, seed + 24) * 2));
  }
  return c;
}

const ZONES: Record<string, WorldMap> = {};

/* ================== 캠퍼스 ==================
   ZEP·하비티카·스타듀밸리의 공통점은 **가운데가 비어 있다**는 것입니다.
   사람이 모이는 곳에 물건을 놓으면 서로 가립니다. 가운데를 비우고
   기물은 가장자리로 미뤘습니다. 통로는 전부 4칸 이상 — 두 사람이
   마주 지나가도 안 막힙니다. */
{
  const m = makeMap(46, 42, F.grass);
  ZONES.campus = m; m.name = '기린캠퍼스'; m.sub = '중앙 광장';

  /* ---- 모서리 넷 ----
     처음엔 숲으로 막아 십자로 잘랐습니다. 막는 것과 채우는 것 중
     채우는 쪽이 낫습니다 — 같은 땅에서 갈 곳이 넷 늘어납니다.
     숲은 지도 바깥 테두리로만 남겨 캠퍼스의 끝을 표시합니다. */
  m.ground = paintLawn(m.w, m.h);

  {
    const gg = m.ground.getContext('2d')!;
    gg.drawImage(paintTrack(14, 12), 1 * T, 1 * T);        // 북서 운동장
    gg.drawImage(paintArcadeCourt(14, 12), 31 * T, 1 * T);        // 북동 미니게임존
  }
  /* 그림만 얹은 두 곳은 표면도 같이 칠합니다. 안 칠하면 우레탄 트랙
     위에서 잔디 소리가 납니다. 트랙은 타원이라 안쪽 잔디를 도로 살립니다. */
  fillSurf(m, 1, 1, 14, 12, SURF.TRACK);
  fillEllipseSurf(m, 8, 7, 4.2, 3.4, SURF.GRASS);          // 인필드
  fillSurf(m, 31, 1, 14, 12, SURF.GRAVEL);
  {
  }

  /* 가운데 원형 광장 — 모서리를 깎아 둥글게 */
  fillOver(m, 15, 16, 16, 11, M.PLAZA);
  fillOver(m, 13, 18, 20, 7, M.PLAZA);
  fillOver(m, 14, 17, 18, 9, M.PLAZA);

  /* ---- 길은 문까지만 ----
     지난 판은 대로가 잔디를 가로질러 끊겼다 이어졌다 했습니다. 그러면
     어디로 갈지 정하기 전에 **어디가 길인지**부터 알아내야 합니다.
     지금은 광장에서 네 건물 문까지, 그 네 갈래만 포장입니다. */
  fillOver(m, 17, 10, 11, 3, M.PLAZA);    // 기숙사 앞마당 — 건물 너비만큼
  fillOver(m, 19, 12, 6, 6, M.PLAZA);     // 북 대로
  fillOver(m, 1, 22, 14, 5, M.PLAZA);     // 본관 앞마당 + 서 대로
  fillOver(m, 31, 22, 14, 5, M.PLAZA);    // 도서관 앞마당 + 동 대로
  fillOver(m, 11, 22, 23, 5, M.PLAZA);    // 광장 남쪽 앞마당 — 네 갈래가 붙는 변
  /* 학생회관만 문이 남쪽이라 건물을 돌아 들어갑니다. 양옆으로 내려가
     아래에서 만나는 한 바퀴 — 어느 쪽으로 돌아도 도착합니다. */
  fillOver(m, 11, 26, 5, 13, M.PLAZA);
  fillOver(m, 29, 26, 5, 13, M.PLAZA);
  fillOver(m, 11, 38, 23, 3, M.PLAZA);

  /* 남서 — 호수. 물은 시트 오토타일이 테두리를 그려 주고, bake 가
     그대로 못 건너는 칸으로 만듭니다. 돌 둘레는 걸어서 한 바퀴. */
  /* 팔각으로 깎은 네모. 타원으로 그렸더니 가장자리가 울퉁불퉁해
     "여기가 물이고 여기가 뭍" 이 한눈에 안 들어왔습니다. 직선이
     들어간 못은 사람이 만든 못으로 보이고, 캠퍼스에는 그쪽이 맞습니다. */
  fillOver(m, 1, 31, 10, 8, M.GRAY);
  fillOver(m, 2, 30, 8, 10, M.GRAY);
  fillOver(m, 2, 32, 8, 6, M.WATER);
  fillOver(m, 3, 31, 6, 8, M.WATER);
  /* 남동 — 동아리 거리. 천막이 설 자리라 바닥은 포석입니다.
     모서리를 깎아야 잔디에 붙인 색종이로 안 보입니다. */
  fillOver(m, 35, 30, 11, 11, M.GRAY);
  fillOver(m, 34, 32, 12, 7, M.GRAY);

  /* ---- 북쪽 산책로 ----
     모서리를 컨텐츠로 채웠으니 거기까지 가는 길이 있어야 합니다.
     운동장 · 북 대로 · 부화장을 한 줄로 꿰는 가로 산책로입니다. */
  fillOver(m, 6, 13, 33, 3, M.PLAZA);

  /* ---- 건물 넷 ---- */
  placeBuilding(m, 'bldDorm',    17, 3,  'dorm',     3,  5,  '기숙사');
  placeBuilding(m, 'bldMain',    1,  16, 'mainhall', 18, 25, '본관');
  placeBuilding(m, 'bldLibrary', 32, 16, 'library',  18, 25, '도서관');
  placeBuilding(m, 'bldUnion',   16, 30, 'union',    16, 21, '학생회관');

  /* ---- 광장 한가운데: 방향 표지판 ---- */
  prop(m, 'signpost', 21, 20);

  /* 벤치는 **마주 보게**. 한 줄로 세우면 정류장처럼 보입니다. */
  prop(m, 'bench', 17, 19); prop(m, 'bench', 17, 24);
  prop(m, 'bench', 28, 19); prop(m, 'bench', 28, 24);

  /* 가로등 넷. 여섯이면 광장이 주차장이 되고, 가로등 자리가 곧 사람이
     서는 자리라 서로 가립니다. */
  [[15, 16], [30, 16], [15, 24], [30, 24]].forEach(([x, y]) => prop(m, 'lamp', x, y));

  /* 기물은 최소로. 자판기 하나, 쓰레기통 둘. 그것도 길 한복판이 아니라
     길가 잔디에 붙입니다 — 실제 캠퍼스가 그렇습니다. */
  /* 자판기와 쓰레기통은 뺐습니다. 광장은 사람이 모이는 곳이고, 모이는
     자리에 물건을 두면 서로를 가립니다. 필요해지면 건물 안에 둡니다. */

  /* 화단 — 세로로 서서 길을 따라 줄을 섭니다 */
  /* 화단은 **길이 끝나는 자리**에 섭니다. 길 한복판 옆에 세우면
     지나가다 부딪히는 물건이고, 끝에 세우면 "여기까지" 라는 표시입니다. */
  [[18, 16], [25, 16],        // 북 대로가 광장에 닿는 곳
   [4, 27], [9, 27],          // 본관 앞마당 끝
   [35, 27], [40, 27],        // 도서관 앞마당 끝
   [17, 28], [26, 28]]        // 학생회관 북쪽 잔디
    .forEach(([x, y]) => prop(m, 'planter', x, y));

  /* ================= 모서리 넷 ================= */

  /* 북서 — 운동장. 오래 앉아 있는 것이 이 제품이 고치려는 문제인데,
     그동안 캠퍼스에는 일어설 이유가 한 군데도 없었습니다. 매트 위에서
     하는 스트레칭은 랭킹 둘째 지표(회복 시간)와 곧장 이어집니다. */
  prop(m, 'mat', 6, 6); prop(m, 'mat', 9, 6);

  /* 북동 — 미니게임존. 집중이 흐트러졌을 때 세션을 끊는 대신 갈 곳입니다.
     관문 넷이 안뜰을 마주 보고, 가운데 통로로 들어갑니다. 지금 이름이
     붙은 것은 방탈출 하나이고 나머지 셋은 자리만 잡아 뒀습니다 —
     무엇이 들어갈지 정해지면 천 색과 문장만 바꾸면 됩니다. */
  prop(m, 'gateEsc', 32, 2); prop(m, 'gateA', 39, 2);
  prop(m, 'gateB', 32, 7);   prop(m, 'gateC', 39, 7);
  prop(m, 'board', 31, 12); prop(m, 'planter', 44, 12);

  /* 남서 — 호수. 세션과 세션 사이에 아무것도 안 해도 되는 자리가
     하나는 있어야 합니다. 광장은 지나가는 곳이라 머무는 곳이 못 됩니다. */
  prop(m, 'reed', 1, 33); prop(m, 'reed', 9, 32); prop(m, 'reed', 8, 39);
  prop(m, 'bench', 2, 30); prop(m, 'bench', 8, 41);

  /* 남동 — 동아리 거리. 학생회관이 혼자 쓰는 기능(상점·출석·랭킹)이면
     여기는 같이 쓰는 기능입니다. 친구 초대 링크가 닿을 자리. */
  prop(m, 'tentA', 35, 32); prop(m, 'tentB', 39, 32); prop(m, 'tentC', 43, 32);
  prop(m, 'board', 36, 37); prop(m, 'board', 41, 37);

  m.spawn = { x: 22, y: 25 };
}

/* ================== 도서관 ==================
   3칸 긴 책상 위아래에 의자를 붙여 6인석. 책상 사이 통로는 3칸이라
   뒤에 사람이 앉아 있어도 지나갈 수 있습니다. */
{
  const m = makeMap(38, 28, F.beige);
  ZONES.library = m; m.name = '도서관'; m.sub = '집중 공간 · 백색소음';

  ring(m, 0, 0, m.w, m.h, F.brickR);
  fillBase(m, 1, 1, m.w - 2, 2, F.brickR);
  m.floor = paintFloor(m.w, m.h, 'parquet'); m.floorKind = SURF.WOOD;
  floorInlay(m.floor, 1, 3, m.w - 2, m.h - 5, 'border');
  floorInlay(m.floor, 17, 3, 4, m.h - 5, 'runner');   // 가운데 통로

  /* 벽면 책장은 손으로 그린 벽에 이미 들어 있습니다 (dressRoom).
     타일 책장을 또 세우면 두 겹이 되어 벽이 두꺼워 보입니다. */

  /* 열람석 — 3칸 책상 하나에 위아래로 의자 셋씩, 6인석.
     책상 줄과 의자 줄이 늘 붙어 있어야 "여기 앉는다" 가 읽힙니다.
     본관도 같은 규칙을 씁니다 — 배치만 다르고 규칙은 하나입니다. */
  const table = (bx: any, by: any) => {
    for (let i = 0; i < 3; i++) prop(m, 'chairC', bx + i, by);      // 뒷줄
    prop(m, 'desk3', bx, by + 1);
    prop(m, 'books2', bx, by + 1);
    prop(m, 'deskLamp', bx + 2, by + 1);
    for (let i = 0; i < 3; i++) prop(m, 'chair', bx + i, by + 2);   // 앞줄
  };
  for (let r = 0; r < 3; r++) {
    table(3, 8 + r * 5);
    table(9, 8 + r * 5);
    table(24, 8 + r * 5);
    table(30, 8 + r * 5);
  }

  prop(m, 'drawers', 17, 5); prop(m, 'pc', 19, 6);
  /* 서가 — 열람석 위쪽 벽을 따라 두 줄. 도서관을 도서관으로 만드는 것은
     책상이 아니라 책입니다. */
  [2, 6, 10, 23, 27, 31].forEach((x) => prop(m, 'stack', x, 4));
  /* 스탠드 아래 빛웅덩이 — 책상마다 하나 */
  for (let r = 0; r < 3; r++) [5, 11, 26, 32].forEach((x) =>
    floorGlow(m.floor, x + 0.6, 9.6 + r * 5, 2.6));
  prop(m, 'lockers', 34, 24);
  /* 아래쪽 읽는 자리 — 깔개 한 장과 서가 둘. 열람석은 앉아서 버티는
     자리고, 여기는 잠깐 머무는 자리입니다. */
  floorInlay(m.floor, 12, 22, 14, 4, 'rug');
  prop(m, 'stack', 3, 24); prop(m, 'stack', 8, 24);
  prop(m, 'stack', 26, 24); prop(m, 'stack', 30, 24);
  floorGlow(m.floor, 19, 24, 4);
  prop(m, 'plant', 16, 4); prop(m, 'plant2', 21, 4);
  prop(m, 'plant', 2, 25); prop(m, 'plant2', 35, 4);
  prop(m, 'bin', 21, 25);

  dressRoom(m, IPAL.library, [
    { k: 'shelf', x: 2 }, { k: 'win', x: 6, style: 'arch' },
    { k: 'shelf', x: 9 }, { k: 'win', x: 13, style: 'arch' },
    { k: 'clock', x: 17 }, { k: 'win', x: 20, style: 'arch' },
    { k: 'shelf', x: 24 }, { k: 'win', x: 28, style: 'arch' },
    { k: 'shelf', x: 31 }, { k: 'win', x: 35, style: 'arch' },
  ]);

  /* 나가는 곳 — 네 건물이 전부 같은 문입니다. 건물마다 다르면
     "여기가 출구" 를 매번 새로 배워야 합니다. */
  prop(m, 'exitDoor', 17, m.h - 2);
  m.portals.push({ x: 17, y: m.h - 2, w: 3, h: 2, to: 'campus', sx: 37, sy: 25, label: '캠퍼스' });
}

/* ================== 본관 ==================
   강의실. 칠판을 향해 줄지어 앉습니다. 가운데 통로 2칸을 비웁니다. */
{
  const m = makeMap(38, 28, F.gray);
  ZONES.mainhall = m; m.name = '본관'; m.sub = '집중 공간 · 대중음악';

  ring(m, 0, 0, m.w, m.h, F.brickR);
  fillBase(m, 1, 1, m.w - 2, 2, F.brickR);
  m.floor = paintFloor(m.w, m.h, 'stone'); m.floorKind = SURF.STONE;
  floorInlay(m.floor, 1, 3, m.w - 2, m.h - 5, 'border');
  floorInlay(m.floor, 6, 8, 26, 17, 'runner');        // 강의실 바닥

  /* 칠판과 게시판은 벽에 그려져 있습니다 (dressRoom) */
  prop(m, 'desk3', 16, 5); prop(m, 'laptopN', 17, 5);
  prop(m, 'plant', 6, 4); prop(m, 'plant2', 31, 4);

  /* 강의실 — 2칸 책상 하나에 의자 둘. 도서관과 같은 규칙이고
     배치만 다릅니다: 여기는 전부 칠판을 봅니다. */
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (c === 2) continue;                        // 가운데 통로
      const x = 7 + c * 6, y = 9 + r * 4;
      prop(m, 'desk2', x, y);
      prop(m, 'books2', x, y);
      prop(m, 'chair', x, y + 1);
      prop(m, 'chairC', x + 1, y + 1);
    }
  }
  prop(m, 'lockers', 2, 24); prop(m, 'lockers', 33, 24);
  prop(m, 'bin', 35, 25);
  floorGlow(m.floor, 19, 6, 5);            // 칠판 위 조명
  for (let r = 0; r < 4; r++) [8, 14, 26].forEach((x) =>
    floorGlow(m.floor, x, 10.5 + r * 4, 2.2));

  dressRoom(m, IPAL.mainhall, [
    { k: 'win', x: 2, style: 'tall' }, { k: 'banner', x: 5, c: '#3C5C82' },
    { k: 'win', x: 8, style: 'tall' }, { k: 'board', x: 12 },
    { k: 'clock', x: 17 }, { k: 'board', x: 20 },
    { k: 'win', x: 26, style: 'tall' }, { k: 'banner', x: 30, c: '#2F4E74' },
    { k: 'win', x: 33, style: 'tall' },
  ]);

  /* 나가는 곳 — 네 건물이 전부 같은 문입니다. 건물마다 다르면
     "여기가 출구" 를 매번 새로 배워야 합니다. */
  prop(m, 'exitDoor', 17, m.h - 2);
  m.portals.push({ x: 17, y: m.h - 2, w: 3, h: 2, to: 'campus', sx: 6, sy: 25, label: '캠퍼스' });
}

/* ================== 기숙사 — 미니룸 ==================
   8×7. 싸이월드 미니룸 크기입니다 — 걸을 자리가 세 줄뿐이고,
   그게 맞습니다. 1인실은 원래 좁습니다.

   침대 · 책상 · 의자. 이게 전부입니다. 옷장과 화분까지 넣었더니
   방이 아니라 진열장이 됐습니다.

   벽에는 안내판과 시계 둘. 기능은 안내판과 마이페이지에만 있습니다. */
{
  const m = makeMap(8, 8, F.beige);
  ZONES.dorm = m; m.name = '기숙사'; m.sub = '내 방 · 1인실';

  ring(m, 0, 0, m.w, m.h, F.brickO);
  fillBase(m, 1, 1, m.w - 2, 2, F.brickO);
  m.floor = paintFloor(m.w, m.h, 'laminate'); m.floorKind = SURF.WOOD;
  floorInlay(m.floor, 2, 4, 3, 2, 'rug');

  dressRoom(m, IPAL.dorm, [
    { k: 'guide', x: 2 },      // 아래 한 칸을 비워야 다가갈 수 있습니다
    { k: 'clockFace', x: 5 },
  ]);
  m.clock = { x: 5, y: 0 };

  prop(m, 'desk1', 1, 3); prop(m, 'laptopN', 1, 3);
  prop(m, 'chair', 1, 5);                 // 여기 앉으면 세션 카메라가 켜집니다
  prop(m, 'bed', 5, 3);

  m.things = [{ x: 2, y: 2, name: '안내', panel: 'guide' }];

  prop(m, 'exitDoor', 2, m.h - 2);
  m.portals.push({ x: 2, y: m.h - 2, w: 3, h: 2, to: 'campus', sx: 21, sy: 11, label: '캠퍼스' });
}
/* ================== 학생회관 ==================
   NPC 셋이 각각 기능을 맡습니다. 계산대 앞에 줄 설 공간을 비웠습니다 —
   여러 명이 동시에 말을 걸 수 있어야 합니다. */
{
  const m = makeMap(34, 24, F.gray);
  ZONES.union = m; m.name = '학생회관'; m.sub = '상점 · 명예의 전당 · 출석';

  ring(m, 0, 0, m.w, m.h, F.brickO);
  fillBase(m, 1, 1, m.w - 2, 2, F.brickO);
  m.floor = paintFloor(m.w, m.h, 'tile'); m.floorKind = SURF.TILE;
  floorInlay(m.floor, 2, 5, 12, 8, 'runner');           // 상점
  floorInlay(m.floor, 20, 5, 12, 8, 'runner');          // 명예의 전당
  floorInlay(m.floor, 1, 3, m.w - 2, m.h - 5, 'border');
  floorInlay(m.floor, 11, 16, 12, 6, 'rug');            // 휴게
  floorGlow(m.floor, 8, 9, 5); floorGlow(m.floor, 26, 9, 5); floorGlow(m.floor, 17, 19, 4);

  prop(m, 'lockers', 7, 4);
  prop(m, 'shelfLow', 2, 5); prop(m, 'shelfLow2', 3, 5);
  prop(m, 'shelfLow', 11, 5); prop(m, 'shelfLow2', 12, 5);
  prop(m, 'desk3', 4, 9); prop(m, 'desk3', 8, 9);
  prop(m, 'phone', 4, 9); prop(m, 'pc', 9, 9);

  prop(m, 'board', 24, 5); prop(m, 'board', 26, 5);
  prop(m, 'desk3', 22, 9); prop(m, 'desk3', 27, 9);
  prop(m, 'monitor', 23, 9); prop(m, 'monitor', 28, 9);

  prop(m, 'desk3', 13, 18); prop(m, 'desk3', 18, 18);
  rowOf(m, 'chairB', 13, 17, 3); rowOf(m, 'chairD', 13, 20, 3);
  rowOf(m, 'chairB', 18, 17, 3); rowOf(m, 'chairD', 18, 20, 3);

  prop(m, 'plant', 10, 4); prop(m, 'plant2', 19, 4);
  prop(m, 'plantS', 10, 12); prop(m, 'plant', 19, 12);
  prop(m, 'vending', 32, 20);
  prop(m, 'bin', 30, 21);

  m.npcs.push(
    { x: 8, y: 8, sprite: 266, name: '상점 · 미르',
      line: '알은 하나만 깨고 나왔죠? 다른 알도 여기서 팝니다. 비싸요.' },
    { x: 26, y: 8, sprite: 185, name: '명예의 전당 · 하연',
      line: '이번 시즌은 42일 남았어요. 순위는 앉은 시간과 회복 시간으로만 매깁니다 — 자세를 점수로 매기지는 않아요.' },
    { x: 16, y: 5, sprite: 131, name: '출석 · 도윤',
      line: '오늘 출석은 아직이네요. 도서관이나 본관에서 한 세션만 채우면 됩니다.' },
  );

  dressRoom(m, IPAL.union, [
    { k: 'win', x: 2, style: 'shop' }, { k: 'notice', x: 5 },
    { k: 'banner', x: 9, c: '#3B8055' }, { k: 'win', x: 12, style: 'shop' },
    { k: 'clock', x: 16 }, { k: 'win', x: 19, style: 'shop' },
    { k: 'banner', x: 23, c: '#5CB177' }, { k: 'notice', x: 26 },
    { k: 'win', x: 30, style: 'shop' },
  ]);

  /* 나가는 곳 — 네 건물이 전부 같은 문입니다. 건물마다 다르면
     "여기가 출구" 를 매번 새로 배워야 합니다. */
  prop(m, 'exitDoor', 16, m.h - 2);
  m.portals.push({ x: 16, y: m.h - 2, w: 3, h: 2, to: 'campus', sx: 21, sy: 39, label: '캠퍼스' });
}

/* ---------------- 충돌 굽기 ---------------- */
function bake(m: WorldMap) {
  m.solid = new Uint8Array(m.w * m.h);
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const i = at(m, x, y);
    const b = m.base[i];
    if (b === F.brickR || b === F.brickO) m.solid[i] = 1;
    if (m.over[i] === M.WATER) m.solid[i] = 1;
    /* 표면은 존이 직접 칠한 자리(트랙·자갈)를 남기고 나머지만 유도합니다.
       실내는 바닥 한 장이 방 전체라 방의 재질이 곧 표면입니다. */
    if (!m.surf[i]) {
      if (m.over[i] === M.WATER) m.surf[i] = SURF.WATER;
      else if (m.over[i]) m.surf[i] = SURF.STONE;          // 포장·판석
      else if (m.floorKind) m.surf[i] = m.floorKind;
    }
  }
  m.sitSpots = [];
  for (const p of m.props) {
    const d = PROP[p.kind];
    for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) {
      if (!inMap(m, p.x + i, p.y + j)) continue;
      if (d.c[j][i]) m.solid[at(m, p.x + i, p.y + j)] = 1;
    }
    if (d.sit) m.sitSpots.push({ x: p.x, y: p.y });
  }
  for (const n of m.npcs) m.solid[at(m, n.x, n.y)] = 1;
  for (const po of m.portals)
    for (let j = 0; j < po.h; j++) for (let i = 0; i < po.w; i++)
      if (inMap(m, po.x + i, po.y + j)) m.solid[at(m, po.x + i, po.y + j)] = 0;
}
Object.values(ZONES).forEach(bake);
/* ---------------- 내보내기 ----------------
   최상위 선언 전부. 목록을 손으로 적으면 새로 만든 것이 빠집니다. */
export {
  T,
  SCALE,
  U_COLS,
  C_COLS,
  K_COLS,
  F,
  AUTO,
  M,
  K,
  C,
  PROP,
  px,
  disc,
  circleLine,
  paintBuilding,
  buildingProp,
  roofIcon,
  paintWindow,
  paintTopWall,
  paintEdgeWall,
  dressRoom,
  IPAL,
  BSPEC,
  FURN,
  canvasOf,
  shadow,
  GLYPH8,
  handText,
  PXTEXT,
  hexRGB,
  pixelText,
  stamp,
  PAINTED,
  eggCanvas,
  tentCanvas,
  gateEmblem,
  gateCanvas,
  vendingCanvas,
  paintedProp,
  DESKPAL,
  chairCanvas,
  deskCanvas,
  paintFloor,
  floorGlow,
  floorInlay,
  SURF,
  fillSurf,
  makeMap,
  at,
  inMap,
  fillBase,
  fillOver,
  fillEllipseSurf,
  fillEllipse,
  ring,
  prop,
  rowOf,
  rnd,
  placeBuilding,
  treeBlob,
  bushBlob,
  paintLawn,
  paintTrack,
  paintArcadeCourt,
  paintGrove,
  ZONES,
  bake,
};

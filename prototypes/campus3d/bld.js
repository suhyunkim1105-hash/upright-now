/* ══════════════════════════════════════════════════════════
   건물 여섯 채 — 캠퍼스에 세울 수 있게 모듈로 뺐습니다.
   buildings.html 은 이 모듈을 한 채씩 크게 찍어 보는 뷰어일 뿐입니다.
   opt.plate === false 면 전시용 받침판과 장식 나무 넷을 뺍니다
   (캠퍼스 위에 놓을 때는 땅이 이미 있습니다).
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { M, box, cyl, prism, win, door, archPortal, apron, column, tree, bush, plate, sign,
         steps, reveal } from './parts.js';

/* ══════════════════════════════════════════════════════════
   기린캠퍼스 건물 여섯 채 — 아이소메트릭 아이콘.
   같은 부품(parts.js)을 같은 규칙으로 쓰되 조합과 색만 다릅니다.
   나란히 놨을 때 한 캠퍼스로 읽혀야 합니다.
   ══════════════════════════════════════════════════════════ */

/* 공통 — 여섯 채가 나눠 쓰는 값. 여기가 캠퍼스의 재질입니다. */
const BASE = {
  trim: 0xFFF4DC, frame: 0xFFFFFF, glass: 0x4E8CA8, glassLit: 0x74B5CE,
  door: 0xB5713F, doorDark: 0x8E5730, doorLight: 0xD08F58,
  stone: 0xF4F1EA, stoneDark: 0xD9D4C8, gold: 0xF2B33C,
  base: 0xF0CE7E, baseDark: 0x6B4A2A, grass: 0x5FC15A, grassDark: 0x46A343,
  path: 0xF6C97E, trunk: 0x8E5A33, leaf: 0x53B84E,
};
const C = (o) => Object.assign({}, BASE, o);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xEFF2F5);

/* ─────────────────────────────────────────────
   ① 본관 — 가장 격식 있는 집. 시계탑 · 기둥 현관 · 국기
   ───────────────────────────────────────────── */
/* 아이콘이 아니라 **건물**입니다.

   전 판은 폭 9.6짜리 아이소메트릭 아이콘이었고, 캠퍼스에서는 배율 1.9로
   키워 폭 18로 세웠습니다. 축이 폭 22인데 그 머리가 18이면 축을 못
   막습니다 — 뒤가 다 보입니다.

   이제 아이콘 단위 28 × 9.4, 캠퍼스 배율 3.0 → **월드 84 × 28**.
   배율만 올리지 않고 다시 그린 이유는 문 때문입니다: 그냥 3배로 키우면
   문도 3배가 되어 거인의 집이 됩니다. 층을 늘리고 창을 잘게 나눠, 커진
   것은 건물이고 문은 사람 크기에 머물게 했습니다(월드 3.5 × 4.5,
   캐릭터 키의 2.3배 — 격식 있는 정문의 비율입니다).

   구성은 실제 대학 본관이 쓰는 것입니다.
     기단      건물이 땅에서 한 단 올라섭니다
     중앙동    가장 높고, 축 정중앙에 섭니다
     좌우 별관 한 층 낮게, 뒤로 물러서서 중앙을 돋보이게 합니다
     주랑      기둥 여덟과 박공. 정면이 어디인지를 말합니다
     시계탑    멀리서 보이는 것. 축의 종점은 이것입니다
   ───────────────────────────────────────────── */
export function mainHall(g, opt = {}) {
  const P = C({ wall: 0xF6E3B4, wallLight: 0xFFF0CC, roof: 0x5B84C4, roofDark: 0x3F6BA8,
                deck: 0x8E93B8 });
  if (opt.plate !== false) plate(g, P, 34);

  const W = 28, D = 9.4;              // 전체 폭 · 안길이
  const CW = 13, CD = 9.4;            // 중앙동
  const GW = 7.2, GD = 8.4;           // 별관
  const Y = .5;                       // 기단 높이
  const H1 = 1.9, H2 = 1.75, H3 = 1.75;
  const CT = Y + H1 + H2 + H3;        // 중앙동 처마 = 5.9
  const GT = Y + H1 + H2;             // 별관 처마 = 4.15

  /* ── 기단 ── */
  box(g, W + .8, Y, D + .8, .12, M(P.stoneDark, .8), 0, Y / 2, 0);
  box(g, W + 1.5, .16, D + 1.5, .06, M(P.stone, .74), 0, .08, 0);

  /* ── 좌우 별관 ── 뒤로 .6 물러섭니다 */
  [-1, 1].forEach((sx) => {
    const gx = sx * (CW / 2 + GW / 2);
    box(g, GW, GT - Y, GD, .12, M(P.wall), gx, Y + (GT - Y) / 2, -.6);
    box(g, GW + .22, .3, GD + .22, .07, M(P.trim), gx, Y + H1, -.6);
    box(g, GW + .4, .42, GD + .4, .1, M(P.trim), gx, GT + .1, -.6);
    box(g, GW - .3, .34, GD - .3, .08, M(P.roof), gx, GT + .42, -.6);
    /* 모서리 기둥 — 덩어리에 세로선을 줍니다 */
    [-1, 1].forEach((ex) => [-1, 1].forEach((ez) =>
      box(g, .46, GT - Y, .46, .07, M(P.wallLight),
          gx + ex * (GW / 2 - .12), Y + (GT - Y) / 2, -.6 + ez * (GD / 2 - .12))));
    /* 창 두 줄 × 넷 */
    [Y + H1 * .56, Y + H1 + H2 * .52].forEach((wy) =>
      [-2.4, -.8, .8, 2.4].forEach((wx) => {
        win(g, P, gx + wx, wy, GD / 2 - .6 + .02, 0, .74, 1.05);
        win(g, P, gx + wx, wy, -GD / 2 - .6 - .02, Math.PI, .74, 1.05);
      }));
    [-2.2, 0, 2.2].forEach((wz) => [Y + H1 * .56, Y + H1 + H2 * .52].forEach((wy) => {
      win(g, P, gx + sx * (GW / 2 + .02), wy, wz - .6, sx * Math.PI / 2, .74, 1.05);
    }));
  });

  /* ── 중앙동 ── */
  box(g, CW, CT - Y, CD, .12, M(P.wall), 0, Y + (CT - Y) / 2, 0);
  box(g, CW + .24, .3, CD + .24, .07, M(P.trim), 0, Y + H1, 0);
  box(g, CW + .24, .26, CD + .24, .07, M(P.trim), 0, Y + H1 + H2, 0);
  box(g, CW + .55, .5, CD + .55, .12, M(P.trim), 0, CT + .12, 0);
  box(g, CW - .3, .4, CD - .3, .1, M(P.roof), 0, CT + .46, 0);
  [-1, 1].forEach((ex) => [-1, 1].forEach((ez) =>
    box(g, .52, CT - Y, .52, .07, M(P.wallLight),
        ex * (CW / 2 - .12), Y + (CT - Y) / 2, ez * (CD / 2 - .12))));

  /* 창 — 주랑이 가운데 아래를 가리므로 1층은 바깥 두 짝만 */
  const yA = Y + H1 * .56, yB = Y + H1 + H2 * .52, yC = Y + H1 + H2 + H3 * .5;
  [-5.4, -3.9, 3.9, 5.4].forEach((wx) => win(g, P, wx, yA, CD / 2 + .02, 0, .8, 1.1));
  [-5.4, -3.9, -2.4, -.9, .9, 2.4, 3.9, 5.4].forEach((wx) => {
    win(g, P, wx, yB, CD / 2 + .02, 0, .8, 1.1);
    win(g, P, wx, yC, CD / 2 + .02, 0, .8, .95);
    win(g, P, wx, yB, -CD / 2 - .02, Math.PI, .8, 1.1);
  });
  [-2.6, 0, 2.6].forEach((wz) => [yA, yB, yC].forEach((wy) => {
    win(g, P, CW / 2 + .02, wy, wz, Math.PI / 2, .8, 1.05);
    win(g, P, -CW / 2 - .02, wy, wz, -Math.PI / 2, .8, 1.05);
  }));

  /* ── 주랑 — 기둥 여덟 · 박공 ── */
  const PZ = CD / 2 + 1.7, COL = 4.5;
  box(g, 12.2, .34, 3.0, .08, M(P.stone, .76), 0, Y - .05, PZ - .2);   // 주랑 바닥
  [-5.25, -3.75, -2.25, -.75, .75, 2.25, 3.75, 5.25].forEach((x) =>
    column(g, P, x, Y + .12, PZ, COL, .34));
  box(g, 12.0, .55, 2.7, .1, M(P.trim), 0, Y + .23 + COL + .4, PZ - .1);
  box(g, 12.4, .22, 2.9, .06, M(P.trim), 0, Y + .23 + COL + .78, PZ - .1);
  prism(g, 12.4, 1.7, 2.9, M(P.roof, .6), 0, Y + .23 + COL + .89, PZ - .12, .1);
  prism(g, 11.2, 1.15, .26, M(P.trim, .55), 0, Y + .23 + COL + 1.02, PZ + 1.36, .06);

  /* ── 문 셋 ──
     벽이 아니라 **감실 안**에 앉습니다. 문설주가 좌우와 위를 감싸고,
     그 뒤 어두운 판이 깊이를 만듭니다. 문 자체는 사람 크기 그대로. */
  /* 아치를 뺐습니다. 문설주(사각)와 아치(반원)를 같은 문에 겹쳐 씌우니
     테두리가 둘이 되어 서로를 잘랐습니다. 그리스식 주랑 아래에 로마식
     아치를 놓은 셈이라 문법도 섞였습니다 — 주랑 밑은 **평인방**입니다.
     아치는 도서관 로지아 하나에만 둡니다. */
  [-2.4, 0, 2.4].forEach((x, i) => {
    reveal(g, P, x, Y, CD / 2 + .06, 1.15, 1.62, .42);
    door(g, P, x, Y + .78, CD / 2 + .18, 1.15, 1.5);
    /* 문 위 — 가운데만 작은 박공, 좌우는 평평한 갓. 실제 신고전 현관이
       가운데를 한 번 높여 어디가 주된 문인지를 말하는 방식입니다. */
    box(g, 2.15, .2, .6, .04, M(P.trim, .52), x, Y + 2.06, CD / 2 + .22);
    if (i === 1) prism(g, 2.4, .66, .6, M(P.trim, .5), x, Y + 2.16, CD / 2 + .22, .05);
    else box(g, 1.85, .17, .52, .04, M(P.stone, .62), x, Y + 2.24, CD / 2 + .22);
  });

  /* ── 계단 ── 주랑 폭 전체. 기단 높이만큼 올라섭니다 */
  steps(g, P, 0, PZ + 1.34, 12.4, Y + .12, 1.55, 3);

  /* ── 시계탑 ── 축의 종점. 멀리서 보이는 것은 결국 이것입니다 */
  const TW = 3.4, T0 = CT + .66;
  box(g, TW, 3.5, TW, .12, M(P.wall), 0, T0 + 1.75, 0);
  box(g, TW + .3, .28, TW + .3, .07, M(P.trim), 0, T0 + 1.2, 0);
  box(g, TW + .42, .34, TW + .42, .08, M(P.trim), 0, T0 + 3.5, 0);
  [-1, 1].forEach((ex) => [-1, 1].forEach((ez) =>
    box(g, .4, 3.5, .4, .06, M(P.wallLight), ex * (TW / 2 - .1), T0 + 1.75, ez * (TW / 2 - .1))));
  /* 시계 — 네 면 중 정면과 좌우 */
  [[0, TW / 2 + .04, 0], [TW / 2 + .04, 0, Math.PI / 2], [-TW / 2 - .04, 0, -Math.PI / 2]]
    .forEach(([cx, cz, ry]) => {
      const f = new THREE.Group(); f.position.set(cx, T0 + 2.5, cz); f.rotation.y = ry; g.add(f);
      cyl(f, 1.02, 1.02, .14, 28, M(P.trim, .5), 0, 0, 0).rotation.x = Math.PI / 2;
      cyl(f, .84, .84, .16, 28, M(0x3E6E82, .4), 0, 0, .04).rotation.x = Math.PI / 2;
      box(f, .1, .56, .18, .03, M(P.trim, .4), 0, .2, .1);
      box(f, .44, .1, .18, .03, M(P.trim, .4), .16, 0, .1);
    });
  /* 종루 — 아치 트인 층 */
  const B0 = T0 + 3.84, BW = 2.8;
  box(g, BW, 1.5, BW, .1, M(P.wallLight), 0, B0 + .75, 0);
  [[0, BW / 2 + .02, 0], [0, -BW / 2 - .02, Math.PI], [BW / 2 + .02, 0, Math.PI / 2],
   [-BW / 2 - .02, 0, -Math.PI / 2]].forEach(([bx2, bz, ry]) =>
    win(g, P, bx2, B0 + .78, bz, ry, .9, 1.0, 'arch'));
  box(g, BW + .5, .3, BW + .5, .08, M(P.trim), 0, B0 + 1.6, 0);
  /* 첨탑 */
  prism(g, 3.0, 2.4, 3.0, M(P.roofDark, .5), 0, B0 + 1.72, 0, .06);
  cyl(g, .06, .06, .9, 8, M(P.gold, .3), 0, B0 + 4.4, 0);
  { const b = new THREE.Mesh(new THREE.SphereGeometry(.26, 14, 10), M(P.gold, .3));
    b.position.set(0, B0 + 4.0, 0); b.castShadow = true; g.add(b); }

  /* ── 깃대 — 별관 옥상 ── */
  box(g, .8, .3, .8, .07, M(P.trim, .6), -10.1, GT + .6, 1.6);
  cyl(g, .07, .07, 3.4, 10, M(0xD8DCE2, .35), -10.1, GT + 2.4, 1.6);
  {
    const sh = new THREE.Shape();
    sh.moveTo(0, 0); sh.lineTo(1.7, -.34); sh.lineTo(1.7, .56); sh.lineTo(0, .9); sh.closePath();
    const ge = new THREE.ExtrudeGeometry(sh, { depth: .1, bevelEnabled: true, bevelSize: .04,
      bevelThickness: .04, bevelSegments: 2, steps: 1 });
    const m = new THREE.Mesh(ge, M(0xE8483C, .62));
    m.position.set(-10.05, GT + 3.1, 1.56); m.castShadow = true; g.add(m);
  }
  sign(g, '본관', 0, Y + .23 + COL + .78, PZ + 1.5, 4.4, .8, '#3F6BA8', '#FFFFFF');
}

/* ─────────────────────────────────────────────
   ② 도서관/* ─────────────────────────────────────────────
   ② 도서관 — 돔과 아치창. 여섯 중 가장 조용해 보여야 합니다
   ───────────────────────────────────────────── */
/* 도서관은 **키 큰 아치창이 줄지어 선 것**으로 읽힙니다.

   실제 대학 중앙도서관의 정면은 거의 예외 없이 같은 문법입니다: 묵직한
   1층 기단 위로 두 층을 관통하는 좁고 높은 아치창이 반복되고, 그 위를
   두꺼운 처마가 한 줄로 닫습니다. 창 하나가 두 층을 먹기 때문에 안이
   열람실이라는 것이 밖에서 보입니다 — 사무실이면 층마다 창이 갈립니다.

   아이콘 단위 15 × 10, 배율 3.0 → **월드 45 × 30**.
   ───────────────────────────────────────────── */
export function library(g, opt = {}) {
  const P = C({ wall: 0xF3EBDA, wallLight: 0xFDF7EA, roof: 0x3FB3A2, roofDark: 0x2C8C7E });
  if (opt.plate !== false) plate(g, P, 20);

  const W = 15, D = 10, Y = .4;
  /* 1층을 2.3 에서 3.6 으로 올립니다.

     아치 하나의 머리는 문 위 1.67 에서 솟아 반지름 1.27 을 더한 3.36
     높이에서 끝나는데, 1층 처마가 2.7 에 있었습니다. 처마가 아치 이마를
     가로질러 **반원이 잘린 토막**으로 보였습니다. 층을 올려 아치를 층
     안에 넣습니다 — 실제로도 로지아를 낸 층은 다른 층보다 높습니다. */
  const BH = 3.6;                       // 1층 — 로지아가 사는 층
  const MH = 4.3;                       // 열람실 층
  const TOP = Y + BH + MH;              // 처마 = 7.0

  box(g, W + .7, Y, D + .7, .1, M(P.stoneDark, .8), 0, Y / 2, 0);

  /* ── 1층 기단 — 묵직하게. 작은 네모창만 ── */
  box(g, W, BH, D, .12, M(P.stoneDark, .8), 0, Y + BH / 2, 0);
  box(g, W + .3, .26, D + .3, .07, M(P.trim), 0, Y + BH, 0);
  /* 로지아가 폭 10.6 을 먹으므로 기단 창은 그 바깥에만 남습니다 */
  [-6.6, 6.6].forEach((x) => win(g, P, x, Y + BH * .3, D / 2 + .02, 0, .6, .8));
  [-3.4, 0, 3.4].forEach((z) => [-1, 1].forEach((sx) =>
    win(g, P, sx * (W / 2 + .02), Y + BH * .55, z, sx * Math.PI / 2, .55, .7)));

  /* ── 현관 — 아치 셋의 로지아 ──
     전 판은 문 **앞에** 벽 판을 한 장 더 세워 놓았습니다(z = D/2 - .1,
     두께 .5 → 문과 아치를 통째로 덮었습니다). 그래서 아치가 안 보이고
     문만 벽에 붙은 것처럼 보였습니다. 그 판을 뒤로 물려 감실 벽으로
     쓰고, 문과 아치를 그 앞에 세웁니다. */
  /* 아치 셋을 1.7 간격에 놓았더니 서로를 물었습니다 — 아치 하나가
     지름 2.54 를 먹는데 간격이 1.7 이면 이웃의 반원 안으로 들어갑니다.
     2.9 로 벌리고 감실도 그만큼 넓힙니다. 문설주(reveal)는 뺐습니다:
     아치가 이미 테두리라 둘을 겹치면 테가 둘이 됩니다. */
  /* 문과 아치를 벽면 **바깥**으로 냅니다.
     전 판은 z = D/2 - .2 에 두었는데, 기단 덩어리의 앞면이 z = D/2 라
     문이 벽 속에 파묻혀 문짝 윗동강과 손잡이만 보였습니다. 안으로
     파고 싶었지만 불리언이 없으니, 아치를 벽에 **덧대는** 쪽이 맞습니다 —
     실제 도서관 정면도 대개 아케이드를 앞에 붙입니다. */
  [-2.9, 0, 2.9].forEach((x) => {
    door(g, P, x, Y + .82, D / 2 + .1, 1.1, 1.55);
    archPortal(g, P, x, Y + .02, D / 2 + .1, 1.1, 1.55);
  });
  /* 아케이드 양끝 벽기둥 — 셋을 한 덩어리로 묶습니다 */
  [-1, 1].forEach((s) => box(g, .66, BH + .34, .78, .06, M(P.wallLight),
                             s * 5.5, Y + (BH + .34) / 2, D / 2 + .16));
  box(g, 12.0, .52, .92, .06, M(P.trim, .55), 0, Y + BH + .16, D / 2 + .16);

  /* ── 계단 ── */
  steps(g, P, 0, D / 2 + .42, 11.0, Y + .1, 1.4, 3);

  /* ── 열람실 — 두 층을 관통하는 아치창 일곱 ── */
  box(g, W - 1.4, MH, D - .6, .12, M(P.wall), 0, Y + BH + MH / 2, 0);
  const AX = [-4.2, -2.8, -1.4, 0, 1.4, 2.8, 4.2];
  AX.forEach((x) => {
    win(g, P, x, Y + BH + MH * .48, (D - .6) / 2 + .02, 0, .82, 2.9, 'arch');
    win(g, P, x, Y + BH + MH * .48, -(D - .6) / 2 - .02, Math.PI, .82, 2.9, 'arch');
  });
  /* 창 사이 필라스터 — 벽이 아니라 기둥 사이가 창이라는 인상을 만듭니다 */
  [-4.9, -3.5, -2.1, -.7, .7, 2.1, 3.5, 4.9].forEach((x) =>
    box(g, .34, MH, .3, .05, M(P.wallLight), x, Y + BH + MH / 2, (D - .6) / 2 + .06));
  [-3.0, 0, 3.0].forEach((z) => [-1, 1].forEach((sx) =>
    win(g, P, sx * ((W - 1.4) / 2 + .02), Y + BH + MH * .48, z, sx * Math.PI / 2, .78, 2.7, 'arch')));

  /* ── 처마 · 난간 ── */
  box(g, W + .5, .42, D + .1, .1, M(P.trim), 0, TOP + .1, 0);
  box(g, W + .1, .55, D - .3, .08, M(P.wallLight), 0, TOP + .58, 0);
  for (let i = -6; i <= 6; i++)
    box(g, .2, .5, .2, .04, M(P.trim, .5), i * 1.1, TOP + .58, (D - .3) / 2 + .02);

  /* ── 돔 ── 조용한 집의 표식 */
  const DY = TOP + .9;
  cyl(g, 2.5, 2.7, 1.0, 30, M(P.wallLight, .5), 0, DY + .5, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    win(g, P, Math.sin(a) * 2.52, DY + .52, Math.cos(a) * 2.52, a, .5, .6, 'arch');
  }
  box(g, 5.8, .24, 5.8, .1, M(P.trim), 0, DY + 1.08, 0);
  { const dm = new THREE.Mesh(new THREE.SphereGeometry(2.5, 26, 14, 0, Math.PI * 2, 0, Math.PI / 2),
                              M(P.roof, .3));
    dm.position.set(0, DY + 1.16, 0); dm.scale.y = .74; dm.castShadow = true; g.add(dm); }
  cyl(g, .09, .09, 1.1, 8, M(P.gold, .3), 0, DY + 3.4, 0);
  { const b = new THREE.Mesh(new THREE.SphereGeometry(.3, 14, 10), M(P.gold, .3));
    b.position.set(0, DY + 2.9, 0); b.castShadow = true; g.add(b); }

  /* ── 좌우 끝 파빌리온 ── 앞으로 나와 정면을 잡아 줍니다 */
  [-1, 1].forEach((sx) => {
    const px = sx * 6.2, PH = Y + BH + 2.4;
    box(g, 2.6, PH - Y, D + 1.1, .12, M(P.wall), px, Y + (PH - Y) / 2, 0);
    box(g, 2.9, .34, D + 1.4, .08, M(P.trim), px, PH + .06, 0);
    prism(g, 2.9, 1.1, D + 1.4, M(P.roof, .5), px, PH + .2, 0, .08);
    win(g, P, px, Y + BH + 1.0, (D + 1.1) / 2 + .02, 0, .95, 1.7, 'arch');
    win(g, P, px, Y + BH + 1.0, -(D + 1.1) / 2 - .02, Math.PI, .95, 1.7, 'arch');
    [-2.6, 0, 2.6].forEach((z) =>
      win(g, P, px + sx * 1.32, Y + BH + 1.0, z, sx * Math.PI / 2, .8, 1.5, 'arch'));
  });

  /* 간판은 로지아 처마 **위** 벽면에 붙입니다. 전 판은 아치와 같은
     높이라 반원들 위에 걸쳐 떠 있었습니다. */
  sign(g, '도서관', 0, Y + BH + .78, D / 2 + .04, 4.2, .78, '#2C8C7E', '#FFFFFF');
}

/* ─────────────────────────────────────────────
   ③ 기숙사/* ─────────────────────────────────────────────
   ③ 기숙사 — 사는 집. 발코니 · 굴뚝 · 옥상 데크
   ───────────────────────────────────────────── */
export function dorm(g, opt = {}) {
  const P = C({ wall: 0xFFE7C6, wallLight: 0xFFF3E2, roof: 0xF2934F, roofDark: 0xD1762F,
                deck: 0x7BC470 });
  if (opt.plate !== false) {
    plate(g, P, 14.4);
    [[-5.4, 4.4, .9], [5.4, 4.4, .9], [-5.6, -4.0, 1.05], [5.6, -4.0, 1.05]]
      .forEach(([x, z, s]) => tree(g, P, x, z, s));
  }
  bush(g, P, -3.4, 5.0, 1); bush(g, P, 3.4, 5.0, 1);
  const W = 8.2, D = 5.4, H1 = 2.7, H2 = 2.5, Y = .12;
  box(g, W, H1, D, .12, M(P.wall), 0, Y + H1 / 2, 0);
  box(g, W + .18, .3, D + .18, .08, M(P.trim), 0, Y + H1, 0);
  box(g, W, H2, D, .12, M(P.wall), 0, Y + H1 + .3 + H2 / 2, 0);
  box(g, W + .3, .4, D + .3, .1, M(P.trim), 0, Y + H1 + .3 + H2 + .13, 0);
  const yLo = Y + H1 * .56, yHi = Y + H1 + .3 + H2 * .5;
  /* 창이 많고 작습니다 — 방이 여럿이라는 뜻입니다 */
  [-2.9, -1.45, 1.45, 2.9].forEach((x) => {
    if (Math.abs(x) > 1.2) win(g, P, x, yLo, D / 2 + .02, 0, .92, 1.25);
    win(g, P, x, yHi, D / 2 + .02, 0, .92, 1.25);
    win(g, P, x, yHi, -D / 2 - .02, Math.PI, .92, 1.25);
  });
  [-1.4, 1.4].forEach((z) => {
    win(g, P, W / 2 + .02, yLo, z, Math.PI / 2, .92, 1.25);
    win(g, P, W / 2 + .02, yHi, z, Math.PI / 2, .92, 1.25);
    win(g, P, -W / 2 - .02, yLo, z, -Math.PI / 2, .92, 1.25);
    win(g, P, -W / 2 - .02, yHi, z, -Math.PI / 2, .92, 1.25);
  });
  /* 발코니 — 위층 창 아래 난간 */
  [-2.9, 2.9].forEach((x) => {
    box(g, 1.6, .16, .8, .06, M(P.trim), x, yHi - .78, D / 2 + .38);
    box(g, 1.6, .5, .1, .04, M(P.wallLight), x, yHi - .52, D / 2 + .74);
    [-.6, 0, .6].forEach((dx) => box(g, .08, .46, .1, .03, M(P.trim, .5), x + dx, yHi - .54, D / 2 + .74));
  });
  door(g, P, 0, Y + 1.2, D / 2 + .12, 1.9, 2.3);
  archPortal(g, P, 0, Y + 1.2 - (2.3) / 2, D / 2 + .12, 1.9, 2.3);
  box(g, 3.0, .2, 1.5, .07, M(P.roof, .6), 0, Y + 2.6, D / 2 + .7);   // 문 위 차양
  apron(g, P, 0, 0, D / 2 + 1.1, 4.2);
  const yT = Y + H1 + .3 + H2 + .34;
  box(g, W + .48, .5, D + .48, .12, M(P.roof), 0, yT, 0);
  box(g, W - .1, .34, D - .1, .1, M(P.roofDark, .7), 0, yT + .3, 0);
  /* 옥상 데크 — 사는 집이라 옥상에 쓸 일이 있습니다 */
  box(g, 3.6, .22, 3.0, .12, M(P.deck, .8), -1.8, yT + .48, .2);
  [-3.2, -.4].forEach((x) => box(g, .12, .62, 3.0, .05, M(P.trim, .55), x, yT + .78, .2));
  /* 굴뚝 */
  box(g, .9, 1.6, .9, .1, M(0xD98F5C, .8), 2.6, yT + 1.0, -1.2);
  box(g, 1.1, .26, 1.1, .06, M(P.trim, .7), 2.6, yT + 1.86, -1.2);
  sign(g, '기숙사', 0, yT + .06, D / 2 + .42, 2.9, .88, '#D1762F', '#FFFFFF');
}

/* ─────────────────────────────────────────────
   ④ 학생회관 — 볼일 보는 곳. 넓은 유리 정면 · 차양 · 게시판
   ───────────────────────────────────────────── */
/* 본관·도서관과 **같은 크기, 다른 성격**.

   앞의 둘이 격식(대칭 · 돌 · 아치)이라면 여기는 생활입니다: 1층이 통째로
   유리이고 긴 차양이 앞으로 나오며, 위층은 가로로 길게 띠창이 돕니다.
   한쪽 끝에는 둥근 유리 탑이 붙어 멀리서도 "저기가 학생회관" 이 됩니다.
   광장 세 변 중 하나를 맡으므로 크기는 같아야 하고, 성격은 달라야
   광장이 한 건물의 반복으로 보이지 않습니다.

   아이콘 단위 14 × 9.4, 배율 3.0 → **월드 42 × 28**.
   ───────────────────────────────────────────── */
export function union(g, opt = {}) {
  const P = C({ wall: 0xF2F6F0, wallLight: 0xFFFFFF, roof: 0x63C47C, roofDark: 0x43A05C,
                deck: 0xBFD8C6 });
  if (opt.plate !== false) plate(g, P, 19);

  const W = 14, D = 9.4, Y = .35;
  const G = 2.1, U = 3.3;               // 1층 · 위 두 층
  const TOP = Y + G + U;                // 처마 = 5.75

  box(g, W + .7, Y, D + .7, .1, M(P.stoneDark, .8), 0, Y / 2, 0);

  /* ── 1층 — 통유리 ── */
  box(g, W - .5, G, D - .3, .1, M(P.glass, .16), 0, Y + G / 2, 0);
  box(g, W - .3, .22, D - .1, .06, M(P.trim), 0, Y + .06, 0);
  box(g, W - .3, .3, D - .1, .07, M(P.trim), 0, Y + G, 0);
  /* 유리 사이 기둥 — 통유리는 기둥이 있어야 유리로 보입니다 */
  [-6.2, -4.4, -2.6, 2.6, 4.4, 6.2].forEach((x) =>
    box(g, .3, G, .34, .05, M(P.wallLight), x, Y + G / 2, (D - .3) / 2 + .04));
  [-1, 1].forEach((sx) => [-3.2, -1.0, 1.0, 3.2].forEach((z) =>
    box(g, .34, G, .3, .05, M(P.wallLight), sx * ((W - .5) / 2 + .04), Y + G / 2, z)));

  /* ── 문 — 넓은 유리문 ──
     여기는 격식이 아니라 생활이라 아치를 안 씁니다. 대신 두꺼운
     금속 테를 두르고 문 위를 한 줄 띄워, 통유리 가운데 어디가 문인지를
     테두리만으로 말합니다. */
  /* 나무문을 뺐습니다 — 통유리 건물에 참나무 두 짝은 다른 건물의
     부품입니다. 유리 두 짝에 금속 세로바를 대고, 위에 상인방 하나. */
  const GZ = (D - .3) / 2 + .04;
  box(g, 2.9, 1.8, .3, .04, M(P.stoneDark, .86), 0, Y + .8, GZ - .16);   // 안쪽 어둠
  [-1, 1].forEach((s) => {
    box(g, .92, 1.56, .14, .03, M(P.glassLit, .16), s * .5, Y + .82, GZ + .1);
    box(g, .06, 1.5, .17, .02, M(P.trim, .45), s * .96, Y + .82, GZ + .13);
    cyl(g, .05, .05, .5, 8, M(P.trim, .4), s * .14, Y + .82, GZ + .16);  // 손잡이 봉
  });
  box(g, .12, 1.62, .18, .03, M(P.trim, .5), 0, Y + .82, GZ + .13);      // 가운데 선틀
  [-1, 1].forEach((s) => box(g, .22, 1.9, .3, .04, M(P.wallLight), s * 1.55, Y + .9, GZ + .04));
  box(g, 3.5, .3, .42, .05, M(P.trim, .5), 0, Y + 1.82, GZ + .08);       // 상인방 하나만
  /* 문 앞 두 단 — 1층이 낮아 세 단은 과합니다 */
  steps(g, P, 0, (D - .3) / 2 + .34, 6.0, Y + .08, 1.1, 2);

  /* ── 차양 — 앞으로 길게 ── */
  const CZ = (D - .3) / 2 + 1.5;
  box(g, W + .8, .26, 3.1, .08, M(P.roof, .6), 0, Y + G + .5, CZ);
  box(g, W + .4, .12, 2.7, .05, M(P.wallLight), 0, Y + G + .34, CZ);
  [-5.6, -1.9, 1.9, 5.6].forEach((x) =>
    cyl(g, .12, .13, G + .32, 10, M(P.trim, .5), x, Y + (G + .32) / 2, CZ + 1.2));

  /* ── 위 두 층 — 가로 띠창 ── */
  box(g, W - 1.0, U, D - .8, .12, M(P.wall), 0, Y + G + U / 2, 0);
  box(g, W - .7, .26, D - .5, .07, M(P.trim), 0, Y + G + U * .5, 0);
  [Y + G + U * .26, Y + G + U * .76].forEach((wy) => {
    [-4.6, -2.3, 0, 2.3, 4.6].forEach((x) => {
      win(g, P, x, wy, (D - .8) / 2 + .02, 0, 2.0, .85);
      win(g, P, x, wy, -(D - .8) / 2 - .02, Math.PI, 2.0, .85);
    });
    [-2.6, 0, 2.6].forEach((z) => [-1, 1].forEach((sx) =>
      win(g, P, sx * ((W - 1.0) / 2 + .02), wy, z, sx * Math.PI / 2, 1.9, .85)));
  });

  /* ── 옥상 — 난간과 퍼걸러 ── */
  box(g, W - .6, .5, D - .4, .1, M(P.trim), 0, TOP + .16, 0);
  box(g, W - 1.0, .34, D - .8, .08, M(P.deck, .7), 0, TOP + .1, 0);
  [-1, 1].forEach((sx) => box(g, .22, .5, D - 2.4, .05, M(P.trim, .5),
                              sx * 3.6, TOP + .68, -.4));
  for (let i = -6; i <= 6; i++)
    box(g, .16, .12, D - 2.2, .04, M(P.wallLight), 3.6 - i * .0 + i * .55, TOP + .92, -.4);

  /* ── 둥근 유리 탑 ── 멀리서 보이는 표식 */
  const RX = 5.4, RZ = -1.2, RR = 2.15;
  cyl(g, RR, RR + .1, TOP - Y + .5, 26, M(P.glass, .16), RX, Y + (TOP - Y + .5) / 2, RZ);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    box(g, .18, TOP - Y + .5, .2, .04, M(P.wallLight),
        RX + Math.sin(a) * (RR + .04), Y + (TOP - Y + .5) / 2, RZ + Math.cos(a) * (RR + .04));
  }
  cyl(g, RR + .3, RR + .3, .26, 26, M(P.trim, .5), RX, Y + TOP - Y + .62, RZ);
  cyl(g, RR + .16, RR + .34, .22, 26, M(P.trim, .5), RX, Y + .06, RZ);
  { const cap = new THREE.Mesh(new THREE.SphereGeometry(RR + .2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
                               M(P.roof, .35));
    cap.position.set(RX, TOP + .75, RZ); cap.scale.y = .5; cap.castShadow = true; g.add(cap); }

  sign(g, '학생회관', -2.6, Y + G + .62, (D - .8) / 2 + .3, 4.0, .8, '#43A05C', '#FFFFFF');
}

/* ─────────────────────────────────────────────
   ⑤ 미니게임관/* ─────────────────────────────────────────────
   ⑤ 미니게임관 — 노는 집. 둥근 창 · 전구 간판 · 지붕 위 주사위
   ───────────────────────────────────────────── */
export function arcade(g, opt = {}) {
  const P = C({ wall: 0xF6F0FA, wallLight: 0xFFFFFF, roof: 0x9B7BD4, roofDark: 0x7A58B8 });
  if (opt.plate !== false) {
    plate(g, P, 14.4);
    [[-5.4, 4.4, .9], [5.4, 4.4, .9], [-5.6, -4.0, 1.05], [5.6, -4.0, 1.05]]
      .forEach(([x, z, s]) => tree(g, P, x, z, s));
  }
  const W = 8.4, D = 5.6, H1 = 3.4, Y = .12;
  box(g, W, H1, D, .14, M(P.wall), 0, Y + H1 / 2, 0);
  box(g, W + .3, .42, D + .3, .1, M(P.trim), 0, Y + H1 + .14, 0);
  /* 둥근 창 — 여섯 중 여기만 동그랗습니다 */
  [-2.9, -1.1, 1.1, 2.9].forEach((x) => {
    if (Math.abs(x) > 1.5) win(g, P, x, Y + H1 * .62, D / 2 + .02, 0, 1.3, 1.3, 'round');
  });
  [-1.5, 1.5].forEach((z) => {
    win(g, P, W / 2 + .02, Y + H1 * .62, z, Math.PI / 2, 1.3, 1.3, 'round');
    win(g, P, -W / 2 - .02, Y + H1 * .62, z, -Math.PI / 2, 1.3, 1.3, 'round');
  });
  door(g, P, 0, Y + 1.3, D / 2 + .12, 2.4, 2.5);
  archPortal(g, P, 0, Y + 1.3 - (2.5) / 2, D / 2 + .12, 2.4, 2.5);
  apron(g, P, 0, 0, D / 2 + 1.05, 4.2);
  /* 전구를 두른 간판 — 밤에 여기만 눈에 띕니다 */
  const sg = sign(g, '미니게임', 0, Y + H1 - .5, D / 2 + .24, 4.2, 1.15, '#4A3478', '#FFE9A8');
  for (let i = 0; i < 9; i++) {
    const x = -1.9 + i * .475;
    [-.62, .62].forEach((dy) => {
      const b = cyl(sg, .075, .075, .1, 10, M(i % 2 ? 0xFFF3C4 : 0xFFD16B, .4, {
        emissive: 0xFFCF6B, emissiveIntensity: .5 }), x, dy, .12);
      b.rotation.x = Math.PI / 2; b.castShadow = false;
    });
  }
  const yT = Y + H1 + .36;
  box(g, W + .5, .5, D + .5, .12, M(P.roof), 0, yT, 0);
  box(g, W - .1, .34, D - .1, .1, M(P.roofDark, .7), 0, yT + .3, 0);
  /* 지붕 위 주사위 — 각진 것 하나. 나머지 다섯은 둥근 것을 이고 있습니다 */
  {
    const s = 1.15, ink = M(0x2A2036, .5);
    const cube = box(g, s * 2, s * 2, s * 2, .28, M(0xF9F4E6, .5), 1.2, yT + .3 + s, 0);
    cube.rotation.y = .5;
    const pip = (dx, dy, dz, col) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(.14, 12, 10), col);
      m.position.set(dx, dy, dz); cube.add(m);
    };
    [[-.5,s+.02,-.5],[.5,s+.02,.5],[0,s+.02,0],[-.5,s+.02,.5],[.5,s+.02,-.5]]
      .forEach(([a,b,c2], i) => pip(a, b, c2, i === 2 ? M(0xD8442C, .45) : ink));
    [[-.45,.45,s+.02],[.45,-.45,s+.02]].forEach(([a,b,c2]) => pip(a, b, c2, ink));
    [[s+.02,.5,0],[s+.02,-.5,0],[s+.02,0,0]].forEach(([a,b,c2]) => pip(a, b, c2, ink));
  }
  /* 조이스틱 모양 장식 */
  cyl(g, .13, .16, 1.1, 10, M(P.trim, .5), -2.8, yT + .84, 1.0);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(.34, 16, 12), M(0xE8483C, .4));
  knob.position.set(-2.8, yT + 1.5, 1.0); knob.castShadow = true; g.add(knob);
}

/* ─────────────────────────────────────────────
   ⑥ 동아리 상점 — 장사하는 집. 줄무늬 차양 · 진열창 · 매대
   ───────────────────────────────────────────── */
export function shop(g, opt = {}) {
  const P = C({ wall: 0xFFEFE2, wallLight: 0xFFF8F0, roof: 0xE8735C, roofDark: 0xC4553F });
  if (opt.plate !== false) {
    plate(g, P, 14.0);
    [[-5.2, 4.2, .9], [5.2, 4.2, .9], [-5.4, -3.8, 1.0], [5.4, -3.8, 1.0]]
      .forEach(([x, z, s]) => tree(g, P, x, z, s));
  }
  const W = 8.0, D = 5.2, H1 = 3.1, Y = .12;
  box(g, W, H1, D, .14, M(P.wall), 0, Y + H1 / 2, 0);
  /* 벽돌 띠 — 장사하는 집이라 결이 따뜻해야 합니다 */
  for (let i = 0; i < 4; i++)
    box(g, W + .04, .1, D + .04, .04, M(0xE2C4AE, .8), 0, Y + .5 + i * .34, 0);
  box(g, W + .3, .42, D + .3, .1, M(P.trim), 0, Y + H1 + .14, 0);
  /* 진열창 셋 — 크고 낮습니다. 물건이 보여야 하니까요 */
  [-2.5, 2.5].forEach((x) => win(g, P, x, Y + H1 * .5, D / 2 + .02, 0, 2.0, 2.0));
  [-1.3, 1.3].forEach((z) => {
    win(g, P, W / 2 + .02, Y + H1 * .55, z, Math.PI / 2, 1.5, 1.7);
    win(g, P, -W / 2 - .02, Y + H1 * .55, z, -Math.PI / 2, 1.5, 1.7);
  });
  door(g, P, 0, Y + 1.25, D / 2 + .12, 2.0, 2.4);
  archPortal(g, P, 0, Y + 1.25 - (2.4) / 2, D / 2 + .12, 2.0, 2.4);
  apron(g, P, 0, 0, D / 2 + 1.0, 4.2);
  /* 줄무늬 차양 — 가게의 표시 */
  [-2.5, 0, 2.5].forEach((x) => {
    const wdt = x === 0 ? 2.6 : 2.4;
    for (let i = 0; i < 6; i++) {
      const sw = wdt / 6;
      const st = box(g, sw, .16, 1.5, .06, M(i % 2 ? 0xE8483C : 0xFFF6E6, .62),
                     x - wdt / 2 + sw * (i + .5), Y + H1 - .32, D / 2 + .82);
      st.rotation.x = -.24;
    }
    box(g, wdt + .1, .2, .24, .06, M(P.roofDark, .6), x, Y + H1 - .62, D / 2 + 1.52);
  });
  /* 매대 — 문 옆 상자 셋 */
  [[-3.2, .0], [-3.2, .9]].forEach(([x, dz], i) => {
    box(g, 1.3, .7, 1.0, .08, M(0xC08E58, .75), x, Y + .45, D / 2 + 1.0 + dz);
    [0xE8483C, 0xF2B33C, 0x63C47C].forEach((col, k) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(.19, 14, 12), M(col, .55));
      b.position.set(x - .35 + k * .35, Y + .92, D / 2 + 1.0 + dz);
      b.castShadow = true; g.add(b);
    });
  });
  const yT = Y + H1 + .36;
  box(g, W + .5, .5, D + .5, .12, M(P.roof), 0, yT, 0);
  prism(g, W + .3, 1.9, D + .4, M(P.roof, .6), 0, yT + .28, 0);
  /* 지붕 위 간판 */
  sign(g, '동아리 상점', 0, yT + 2.5, .1, 4.6, 1.1, '#C4553F', '#FFF3DC');
  [-1.6, 1.6].forEach((x) => box(g, .16, 1.0, .16, .05, M(P.roofDark, .6), x, yT + 1.9, .1));
}

/* ─────────────────────────────────────────────
   그리기
   ───────────────────────────────────────────── */
export const BLD = { mainHall, library, dorm, union, arcade, shop };

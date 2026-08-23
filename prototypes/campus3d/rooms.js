/* ══════════════════════════════════════════════════════════
   실내 여섯 — 건물마다 한 방씩.

   **이 파일의 규칙 하나: 통로가 먼저다.**
   전 판은 예쁜 스크린샷을 기준으로 가구를 놓았습니다. 그 결과 방마다
   걸을 수 있는 바닥이 7~26% 뿐이었고, 문 앞 시작 자리가 여섯 중 넷에서
   가구 안에 박혀 있어서 **아예 한 발짝도 못 움직였습니다.** 말 걸 자리는
   한 곳도 못 닿았습니다.

   그래서 방마다 CORRIDORS 를 먼저 적고, 가구는 그 바깥에만 놓습니다.
   diagroom.html 이 침범한 가구를 이름으로 집어 주고, 문에서 물을 채워
   모든 자리에 닿는지 검사합니다. 통로 폭은 전부 2.0 이상입니다.

   **방 안에 장식용 사람을 두지 않습니다.** 전 판은 방마다 서너 명을
   세워 놨는데, 말도 안 걸리고 비켜 주지도 않아서 마네킹이었습니다.
   지금은 말 걸 수 있는 NPC 만 npcs.js 의 INDOOR 로 세웁니다.
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { M, box, cyl, prism } from './parts.js';
import * as R from './room.js';

const IN = R.IN;

/* 방 크기 — 전 판보다 한 단계씩 키웠습니다. 같은 가구를 넣어도
   통로가 남아야 방이고, 안 남으면 창고입니다. */
export const ROOM_SIZE = {
  library:  { w: 32, d: 22, h: 5.0 },
  mainhall: { w: 28, d: 20, h: 4.6 },
  dorm:     { w: 14, d: 11, h: 4.2 },
  union:    { w: 22, d: 15, h: 4.6 },
  arcade:   { w: 20, d: 14, h: 4.6 },
  shop:     { w: 20, d: 14, h: 4.6 },
};

/* 비워 두어야 하는 곳 [x0, z0, x1, z1]. 가구가 여기 걸치면 검사에서 걸립니다. */
export const CORRIDORS = {
  /* 도서관·본관은 통로를 **먼저** 긋고 그 사이 띠에만 가구를 놓습니다.
     가로 통로가 방을 띠로 자르고, 세로 통로가 문에서 뒤벽까지 뚫습니다.
     띠마다 앞뒤가 통로라 어느 의자든 등 뒤에서 잡을 수 있습니다. */
  library:  [[-2.4, -9.8, 2.4, 10.4], [-14.6, -9.8, 13.0, -8.4], [-13.4, -6.2, 13.0, -4.7],
             [-13.4, -0.9, 13.0, 0.7], [-13.4, 4.5, 13.0, 6.5], [11.6, -8.4, 13.2, 4.5]],
  mainhall: [[-2.4, -7.6, 2.4, 9.6], [-11.4, -7.6, 11.4, -4.4], [-11.4, -2.2, 11.4, -0.65],
             [-11.4, 1.5, 11.4, 3.05], [-11.4, 5.2, 11.4, 7.9],
             [-12.4, -7.6, -10.2, 7.6], [10.2, -7.6, 12.4, 7.6]],
  dorm:     [[-1.7, -4.6, 1.7, 5.4], [-7, 0.4, 7, 2.2]],
  union:    [[-2.6, -6.6, 2.6, 5.4], [-11, 1.0, 11, 3.0], [-11, -4.4, 11, -3.2]],
  arcade:   [[-2.4, -6.0, 2.4, 6.8], [-10, 0.6, 10, 2.6]],
  shop:     [[-2.4, -6.0, 2.4, 6.8], [-10, 0.4, 10, 2.4]],
};

export const ROOMS = {
  /* ══ ① 도서관 ══ 32×22 — 메인 건물이라 제일 넓고 제일 붐빕니다.
     가로 통로 넷이 방을 다섯 띠로 자르고, 세로 통로 하나가 문에서
     뒤벽까지 뚫습니다. 가구는 띠 안에만 놓습니다.

     전 판은 26×18 에 열람 탁자가 둘뿐이었고, 의자를 탁자 모서리에서
     0.14 만 띄워 붙여 놨습니다. 의자에 앉으려면 등 뒤에 서야 하는데
     — 앉기는 1.6m 안에서 바라보는 쪽 의자를 고릅니다 — 탁자와 옆
     의자 사이에 낀 자리는 그 반경 안에 **설 데가 없습니다.**
     자리마다 제일 가까운 설 자리를 재 보면 중앙값 0.7, 제일 먼 것이
     1.35(라운지 소파, 낮은 탁자에 막힘)였고, 사람 폭을 0.46 으로 재면
     의자 넷이 1.2 를 넘겼습니다 — 보이기만 하고 못 앉는 자리입니다.

     그래서 키우면서 줄을 다시 그었습니다. 의자를 탁자에서 0.34 띄우고,
     의자 등 뒤에 1.7 이상을 비웁니다. 마흔네 자리 전부 1.1 안에 설
     자리가 있고, 그 자리는 전부 문까지 이어집니다. */
  library(g) {
    R.doormat(g, 0, 10.0);
    R.shell(g, 32, 22, 5.0, { floorA: 0xC9945C, floorB: 0xB8814A, wall: 0xF2E8D4 });
    /* 창은 뒤벽 오른쪽에만 냅니다. 왼쪽은 서가가 3.2 로 서 있어서
       거기 창을 내 봐야 책장 뒤에 파란 스티커를 붙이는 셈입니다. */
    [-2.2, 2.0, 6.2, 10.4, 14.0].forEach((x) => R.window3(g, x, 2.9, 22, 2.1, 2.3));

    /* ── 서가 ──
       뒤벽에 다섯, 거기 직각으로 다섯 줄. 전 판은 벽에 한 줄뿐이라
       서가가 배경 그림이었습니다. 직각 줄 사이는 1.69 라 사람이 지나가고,
       줄 앞뒤가 통로로 뚫려 있어 막다른 골목이 없습니다. */
    [-14.8, -12.85, -10.9, -8.95, -7.0].forEach((x) => R.shelf(g, x, -10.35, 0, 1.9, 3.2));
    [-14.6, -12.4, -10.2, -8.0, -5.8].forEach((x) => R.shelf(g, x, -7.3, Math.PI / 2, 1.8, 2.8));

    /* 뒤 오른쪽 1인 캐럴 넷 — 의자를 캐럴에서 1.15 빼 놓습니다.
       바짝 붙이면 등 뒤가 0.34 밖에 안 남아 아무도 못 섭니다. */
    [3.6, 5.6, 7.6, 9.6].forEach((x) => {
      R.carrel(g, x, -7.75, 0);
      R.chair(g, x, -6.6, Math.PI, IN.woodLight);
    });
    /* 왼벽 캐럴 넷 — 전 판은 칸막이를 방 쪽으로 두고 의자를 그 **뒤에**
       놓아서, 벽이 아니라 방을 등지고 앉는 자리가 됐습니다.
       등판을 벽에 붙이고 의자를 방 쪽에 둡니다. */
    [-3.85, -2.3, 1.45, 3.05].forEach((z) => {
      R.carrel(g, -15.1, z, Math.PI / 2);
      R.chair(g, -13.95, z, -Math.PI / 2, IN.woodLight);
    });

    /* 열람 탁자 넷 — 두 줄 × 두 칸. 뒤 줄은 여덟 자리, 문에 가까운 앞
       줄은 여섯 자리로 더 벌립니다. 앞 줄은 지나다니는 사람이 스치는
       자리라 옆 간격이 좁으면 앉기가 싫어집니다. */
    [[-8.6, -2.8, 4], [8.6, -2.8, 4], [-8.6, 2.6, 3], [8.6, 2.6, 3]].forEach(([cx, cz, n], k) => {
      R.readTable(g, cx, cz, 0, 5.6);
      (n === 4 ? [-1.95, -0.65, 0.65, 1.95] : [-1.9, 0, 1.9]).forEach((t) => {
        R.chair(g, cx + t, cz - 1.55, 0, IN.wood);
        R.chair(g, cx + t, cz + 1.55, Math.PI, IN.wood);
      });
      R.lamp(g, cx - 2.2, .87, cz);
      R.lamp(g, cx + 2.2, .87, cz);
      R.books(g, cx - 1.1, .87, cz + (k % 2 ? .4 : -.4), 3);
      R.laptop(g, cx + 0.7, .87, cz - .5, Math.PI);
      R.laptop(g, cx - 1.5, .87, cz + .5, 0);
    });

    /* 창가 높은 자리 — 오른쪽 가장자리에서 바깥을 봅니다.
       전 판은 의자만 셋 세워 놔서 허공을 보고 앉았습니다. 긴 상판을 답니다. */
    R.desk(g, 15.1, -0.1, Math.PI / 2, 8.8, 1.0, .9);
    [-3.6, -1.2, 1.2, 3.6].forEach((z, i) => {
      R.chair(g, 14.0, z, Math.PI / 2, 0xC98E4E);
      if (i % 2) R.books(g, 15.0, .96, z, 2); else R.laptop(g, 15.0, .96, z, -Math.PI / 2);
    });

    /* 검색 단말 둘 — 서가가 열 줄이 되면 물어볼 데가 있어야 합니다 */
    R.kiosk(g, -3.9, -10.1, 0);
    R.kiosk(g, 12.4, -10.1, 0);

    /* 앞쪽 — 왼쪽 대출대, 오른쪽 라운지 */
    R.counter(g, -9.0, 7.4, Math.PI, 5.0, IN.woodDark);
    R.counterTop(g, -9.0, 1.1, 7.2);
    R.globe(g, -6.9, 1.06, 7.4);
    R.bookCart(g, -4.6, 7.2, .3);
    R.bookCart(g, 3.6, 9.2, -.4);
    R.shelf(g, -15.4, 6.6, Math.PI / 2, 2.2, 2.6);
    R.mag(g, -3.6, 9.5, 0);
    R.sofa(g, 7.8, 9.3, Math.PI, 3.6, 0x7FA8C4);
    R.sofa(g, 12.6, 8.4, -Math.PI / 2, 3.0, 0xE8935A);
    R.lowTable(g, 7.8, 7.4, 0, 2.2, 1.1);
    R.books(g, 7.5, .56, 7.4, 2);

    /* 벽 · 천장 */
    R.clock(g, 7.9, 3.9, -10.82);
    R.poster(g, -15.72, 3.1, -8.4, Math.PI / 2, 1.0, 1.3, 0x63C47C);
    R.poster(g, -15.72, 3.1, 5.4, Math.PI / 2, 1.0, 1.3, 0xE8935A);
    R.poster(g, -4.6, 3.4, -10.82, 0, 1.1, 1.4, 0x5B84C4);
    R.banner(g, -15.72, 3.9, -1.2, Math.PI / 2, 3.4, .95, 0x2C8C7E);
    [-8.6, 0, 8.6].forEach((x) => {
      R.pendant(g, x, -2.8, 4.0); R.pendant(g, x, 2.6, 4.0); R.pendant(g, x, 8.2, 4.0);
    });
    R.rug(g, -8.6, -0.1, 6.4, 8.6, 0xC4A0BE, 0xF6ECF2);
    R.rug(g, 8.6, -0.1, 6.4, 8.6, 0xC4A0BE, 0xF6ECF2);
    R.rug(g, 9.4, 8.2, 7.4, 3.6, 0xB08AB0, 0xF2E4E8);
    R.bin(g, 3.4, 9.6); R.bin(g, -15.2, -5.6);
    R.plant(g, 15.0, 9.4, 1.15); R.plant(g, -15.0, 9.4, 1.0); R.plant(g, 14.6, -9.6, .95);
    R.aFrame(g, -14.3, 7.4, .5, 0x2C8C7E);
  },

  /* ══ ② 본관 ══ 28×20. 강의실.
     전 판은 22×16 에 줄 간격 2.9 로 세 줄을 넣었습니다. 의자 등 뒤에서
     다음 책상까지가 0.89 라, 가운데 줄 다섯 자리는 앞뒤 책상 사이에
     갇혀 제일 가까운 설 자리가 1.9~2.1 이었습니다. 1.6 밖이면 안
     잡힙니다 — 학기 내내 아무도 못 앉은 자리가 다섯이었습니다.
     줄 간격을 3.7 로 벌리고 의자를 책상에서 0.44 빼 놓습니다.
     의자 등 뒤가 1.63 이라, 줄 사이에 서서 아무 의자나 고를 수 있습니다. */
  mainhall(g) {
    R.doormat(g, 0, 9.2);

    R.shell(g, 28, 20, 4.6, { floorA: 0xE8E2D2, floorB: 0xD6CFBC, wall: 0xE6EAF2, under: 0x8A9098 });
    R.blackboard(g, -3.0, 2.4, -9.7, 8.0, 2.4);
    R.projScreen(g, 6.0, 2.7, -9.78, 4.0, 2.4);
    [-10.4, 2.5, 10.4].forEach((x) => R.window3(g, x, 2.7, 20, 2.1, 2.1));

    /* 교단 구역 — 세로 통로를 비켜 양옆으로. 칠판에서 1.5,
       첫 줄까지 3.4 를 띄워 강사가 앞을 오갈 수 있게 둡니다. */
    R.podium(g, -5.4, -8.2, .18);
    R.desk(g, 4.4, -8.2, 0, 2.6, 1.0, .9);
    R.books(g, 3.7, 1.06, -8.2, 2);
    R.laptop(g, 5.2, 1.06, -8.2);
    /* 강단 스피커 — spots.js 가 (8.2, -5.1) 에서 이걸 부르는데 여태
       실물이 없어서, 빈 바닥 위에 말풍선만 떠 있었습니다. */
    R.speaker(g, 8.2, -8.2, -.25);

    /* 강의석 세 줄 × 두 칸 — 한 책상에 다섯 자리, 의자 간격 1.4 */
    [-3.75, -0.05, 3.65].forEach((z, ri) => {
      [-6.2, 6.2].forEach((x, ci) => {
        R.desk(g, x, z, 0, 7.4, 1.1, .78);
        [-2.8, -1.4, 0, 1.4, 2.8].forEach((dx) => R.chair(g, x + dx, z + 1.25, Math.PI, 0x9BB4D6));
        R.books(g, x - 3.0, .87, z - .1, 2);
        R.books(g, x + 3.0, .87, z + .1, ((ri + ci) % 2) + 1);
        if ((ri + ci) % 2 === 0) R.laptop(g, x + 1.0, .87, z - .1);
        if ((ri + ci) % 3 === 1) R.deskClutter(g, x - .9, .87, z);
      });
    });

    /* 뒤쪽 — 사물함 · 벤치 · 겹친 의자 */
    R.lockers(g, -13.4, -2.0, Math.PI / 2, 4, 0x8AB4CE);
    R.lockers(g, -13.4, 3.0, Math.PI / 2, 4, 0x8AB4CE);
    R.lockers(g, -13.4, 7.8, Math.PI / 2, 3, 0x8AB4CE);
    /* 벤치도 강의실 **안쪽**(칠판 쪽)을 봅니다 */
    [-9.6, -5.6, 5.6, 9.6].forEach((x) => R.bench(g, x, 8.5, Math.PI, 3.4));
    R.stackChairs(g, 12.6, 8.4, -.4, 5);
    R.stackChairs(g, 12.9, 7.4, -.2, 4, 0xE8935A);
    R.cooler(g, 12.9, -6.2, Math.PI / 2);
    R.aFrame(g, -13.2, 5.6, .5, 0xF2C14E);
    R.bin(g, -13.3, -5.4, 0x5B84C4); R.bin(g, 12.9, 2.4, 0x5E8C6A);
    R.radiator(g, 2.5, -9.5, 0, 2.6);
    R.radiator(g, -10.4, -9.5, 0, 2.6);
    R.clock(g, 12.6, 3.6, -9.82);
    R.poster(g, 12.6, 2.2, -9.82, 0, 1.0, 1.3, 0xF2C14E);
    R.poster(g, -13.72, 2.6, -6.6, Math.PI / 2, 1.0, 1.3, 0x5B84C4);
    R.banner(g, -13.72, 3.6, 0.6, Math.PI / 2, 3.4, .95, 0x3FB3A2);
    R.wallShelf(g, -13.62, 3.0, -4.4, Math.PI / 2, 1.8);
    [-9.3, 0, 9.3].forEach((x) => {
      R.striplight(g, x, -6.0, 4.0, 3.6); R.striplight(g, x, -0.4, 4.0, 3.6);
      R.striplight(g, x, 5.2, 4.0, 3.6);
    });
    R.rug(g, 0, -8.4, 5.2, 2.4, 0x4E6E8C, 0xDCE6F0);
    R.plant(g, 13.2, -8.8, 1.05); R.plant(g, -13.2, 9.2, 1.1); R.plant(g, 13.2, 9.2, 1.0);

  },

  /* ══ ③ 기숙사 ══ 14×11. 내 방. 좁아도 침대·책상·옷장 사이는 다녀야 합니다. */
  dorm(g, decor) {
    R.doormat(g, 0, 4.75, 0xC98E4E);
    /* 내가 놓은 가구 — 상점에서 사서 방 꾸미기로 놓은 것들 */
    (decor || []).forEach((d) => decorItem(g, d));

    R.shell(g, 14, 11, 4.2, { floorA: 0xD6A96E, floorB: 0xC49A5E, wall: 0xF6EDDC });
    R.window3(g, 3.0, 2.5, 11, 2.4, 2.1);
    R.window3(g, -3.4, 2.5, 11, 2.0, 2.1);

    R.bed(g, -4.9, -3.1, 0);
    R.wardrobe(g, 4.4, -4.9, 0);
    R.desk(g, 4.6, -1.7, 0, 2.8, 1.1, .78);
    R.chair(g, 4.6, -0.6, 0, IN.wood);
    R.laptop(g, 4.6, .87, -1.6, Math.PI);
    R.lamp(g, 5.8, .87, -1.6);
    R.books(g, 3.5, .87, -1.6, 3);
    R.deskClutter(g, 4.0, .87, -2.1);
    R.shelf(g, -6.6, 3.4, Math.PI / 2, 1.7, 2.0);
    R.fridge(g, 6.2, 3.6, -.5);
    R.coffee(g, 6.2, 1.28, 3.6);
    R.rack(g, -5.0, -0.5, Math.PI / 2);
    R.laundry(g, -6.2, 4.6);
    R.guitar(g, -6.3, 1.2, .3);
    R.mirror(g, -6.72, 2.2, -2.4, Math.PI / 2, .8, 1.7);
    R.lowTable(g, -3.6, 3.6, .15, 1.5, 1.0);
    R.books(g, -3.8, .56, 3.6, 2);
    [[-5.0, 3.0, 0xE8935A], [-2.4, 4.6, 0x63C47C]].forEach(([cx, cz, c]) => {
      box(g, 1.0, .24, 1.0, .11, M(c, .82), cx, .22, cz).castShadow = true;
      box(g, .78, .1, .78, .08, M(c, .68), cx, .35, cz);
    });
    R.bin(g, 2.6, 4.8, 0xE8935A);
    R.board(g, -3.0, 2.7, -5.32, 1.8, 1.2);
    R.poster(g, 0.6, 2.9, -5.32, 0, .9, 1.2, 0xE8695A);
    R.poster(g, -6.12, 2.7, -0.2, Math.PI / 2, .9, 1.2, 0xF2C14E);
    R.wallShelf(g, -1.6, 2.5, -5.32, 0, 2.0);
    R.wallShelf(g, -1.6, 3.2, -5.32, 0, 2.0);
    R.stringLights(g, -3.4, 3.4, -5.2, 4.4, 9);
    R.clock(g, 5.6, 3.3, -5.32, 0, .34);
    R.pendant(g, 0, 0, 3.3, 0xE8C08A);
    R.rug(g, 0, -1.4, 4.2, 3.2, 0x4E8C9E, 0xEAF2F4);
    /* 화분 둘이 z -6.6 — 방(z ±5.5) **바깥** 이었습니다. 안으로 들입니다. */
    R.plant(g, 6.1, -4.7, 1.0); R.plant(g, -6.1, -4.7, .9);

  },

  /* ══ ④ 학생회관 ══ 22×15. 창구 · 식당 · 라운지가 한 층에. */
  union(g) {
    R.doormat(g, 0, 6.5, 0x43A05C);

    R.shell(g, 22, 15, 4.6, { floorA: 0xE8E2D2, floorB: 0xD8D2C0, wall: 0xEFF6EE, under: 0x8A9098 });
    R.window3(g, -7.0, 2.7, 15, 2.2, 2.1);
    R.window3(g, 0, 2.7, 15, 2.2, 2.1);
    R.window3(g, 8.6, 2.7, 15, 2.2, 2.1);

    /* 창구 둘 — 뒤벽 왼쪽 */
    [[-8.6, '안내'], [-4.4, '학생증']].forEach(([x], i) => {
      R.counter(g, x, -5.9, 0, 3.4, [IN.wood, IN.woodDark][i]);
      R.counterTop(g, x, 1.1, -5.7);
      R.chair(g, x, -6.9, 0, 0x9BB4D6);
      R.board(g, x, 3.0, -7.32, 2.6, 1.6);
    });
    /* 배식대 — 뒤벽 오른쪽 */
    R.trayCounter(g, 6.4, -5.9, 0, 5.4);
    R.poster(g, 6.4, 3.2, -7.32, 0, 3.2, 1.1, 0xF2C14E);

    /* 식탁 넷 — 통로를 피해 네 귀퉁이 */
    [[-7.2, -1.2, 0x63C47C], [7.2, -1.2, 0xF2C14E],
     [-7.2, 5.2, 0x7FA8C4], [7.2, 5.2, 0xE8935A]].forEach(([x, z, c]) => R.cafeSet(g, x, z, c));

    /* 라운지 — 앞쪽 가운데 양옆 */
    /* 탁자가 가운데 있으므로 소파 둘은 **서로 마주** 봅니다.
       전 판은 둘 다 ry 0 이라 탁자를 옆에 두고 바깥을 봤습니다. */
    R.sofa(g, -3.6, 6.0, Math.PI / 2, 2.8, 0x9B7BD4);
    R.sofa(g, 3.6, 6.0, -Math.PI / 2, 2.8, 0xE8935A);
    R.lowTable(g, 0, 6.0, 0, 2.0, 1.0);
    R.books(g, -.3, .56, 6.0, 2);

    R.vending(g, 10.0, -6.0, Math.PI / 2);
    R.vending(g, 10.0, -4.0, Math.PI / 2);
    R.cooler(g, -10.3, -1.4, Math.PI / 2);
    R.coffee(g, -10.2, 1.06, -3.6, Math.PI / 2);
    R.lockers(g, -10.4, 5.4, Math.PI / 2, 3, 0x9BC4B4);
    R.aFrame(g, 10.0, 4.0, -1.1, 0x2DD4BF);
    R.banner(g, -10.72, 3.6, -0.4, Math.PI / 2, 3.2, .95, 0x3FB3A2);
    R.clock(g, 10.0, 3.6, -7.32);
    R.bin(g, -2.9, 7.0); R.bin(g, 3.0, 7.0, 0xE8935A);
    [-7.0, 0, 7.0].forEach((x) => R.striplight(g, x, -2.0, 4.0, 3.6));
    [-4.4, 4.4].forEach((x) => R.pendant(g, x, 5.6, 3.7, 0xE8C08A));
    R.rug(g, 0, 6.0, 6.2, 3.0, 0x3E7C8C, 0xE0F0F2);
    R.plant(g, 10.4, 6.3, 1.15); R.plant(g, -10.4, 6.3, 1.0); R.plant(g, 10.4, 0.2, .95);

  },

  /* ══ ⑤ 미니게임관 ══ 20×14. 오락기는 벽으로, 가운데는 비웁니다. */
  arcade(g) {
    R.doormat(g, 0, 6.2, 0x6E5A9E);

    R.shell(g, 20, 14, 4.6, { floorA: 0x5E4E7C, floorB: 0x4E4068, wall: 0x2E2646, under: 0x3A3050 });
    const cols = [0xE8695A, 0x2DD4BF, 0xE0AE3C, 0x9B7BD4, 0xFF7FA8, 0x63C47C];
    /* 오락기 여섯 — 뒤벽 */
    [-8.4, -6.3, -4.2, 4.2, 6.3, 8.4].forEach((x, i) => {
      R.cabinet(g, x, -6.4, 0, cols[i]);
      R.neon(g, '', x, 3.1, -6.92, 0, cols[i], 1.8);
      cyl(g, .34, .3, .12, 14, M(0x2DD4BF, .6), x, .62, -5.0);
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) =>
        cyl(g, .04, .05, .56, 8, M(IN.metal, .45), x + sx * .2, .3, -5.0 + sz * .2));
    });
    /* 인형뽑기 · 경품 — 왼벽 */
    R.claw(g, -8.6, -2.6, .35, 0xFF7FA8);
    R.claw(g, -8.6, -0.4, .12, 0x2DD4BF);
    R.prizeShelf(g, -9.2, 4.2, Math.PI / 2);
    /* 에어하키 · 인생네컷 — 오른쪽 */
    R.airHockey(g, 6.6, -2.0, .08);
    R.photoBooth(g, 7.4, 4.6, .7, 0xFF7FA8);
    /* 리듬 발판 — 앞 왼쪽 */
    R.dancePad(g, -6.4, 4.6, .12);
    /* 교환대 */
    R.counter(g, -3.6, 6.1, 0, 3.0, 0x4E4068);
    R.counterTop(g, -3.6, 1.1, 6.4);
    R.stanchion(g, -5.4, 5.2, -1.8, 5.2);
    R.neon(g, '', -9.6, 3.2, 0.4, Math.PI / 2, 0x2DD4BF, 3.0);
    R.bin(g, 2.9, 6.4, 0x3A3050);
    [-6.0, 0, 6.0].forEach((x) => R.pendant(g, x, -1.0, 3.8, 0xFF7FA8));
    R.rug(g, 0, -1.0, 3.4, 6.4, 0x3E3358, 0x6E5A9E);
    R.plant(g, 9.4, 6.2, 1.05); R.plant(g, -9.4, 6.2, 1.0);

  },

  /* ══ ⑥ 동아리 상점 ══ 20×14. 왼쪽 옷 · 오른쪽 알 · 앞쪽 가구. */
  shop(g) {
    R.doormat(g, 0, 6.2, 0xC4553F);

    R.shell(g, 20, 14, 4.6, { floorA: 0xE0C8AE, floorB: 0xD0B69A, wall: 0xF6E8DC, under: 0x9A7458 });
    R.window3(g, 6.6, 2.7, 14, 2.2, 2.1);
    R.window3(g, -4.6, 2.7, 14, 2.0, 2.1);

    /* ─ 옷 구역(왼쪽) ─ */
    R.rack(g, -8.4, -4.8, 0);
    R.rack(g, -8.4, -2.4, 0);
    R.rack(g, -5.6, -4.8, 0);
    R.mannequin(g, -5.6, -2.6, .5, 0xE8695A, 0x3E5C82);
    R.shoeShelf(g, -9.3, -0.4, Math.PI / 2);
    R.hatWall(g, -7.0, 2.3, -6.92, 0, 5);
    R.mirror(g, -9.72, 2.2, 3.4, Math.PI / 2, .9, 1.9);
    R.curtain(g, -9.0, 1.1, 4.8, .1, 1.4, 2.2, 0x3FB3A2);
    R.counter(g, -6.4, 5.7, 0, 3.0, IN.woodDark);
    R.counterTop(g, -6.4, 1.1, 5.5);

    /* ─ 알 구역(오른쪽) ─ */
    [[5.4, 0xF2D08A], [6.8, 0x9EDCEB], [8.2, 0xF2A0A0]].forEach(([x, c]) => R.eggStand(g, x, -5.2, c));
    [[6.1, 0xC4EBA0], [7.5, 0xE8B8E0]].forEach(([x, c]) => R.eggStand(g, x, -3.2, c));
    R.wallShelf(g, 9.4, 2.6, -1.2, -Math.PI / 2, 2.0);
    R.counter(g, 6.4, 5.7, 0, 3.0, IN.woodDark);
    R.counterTop(g, 6.4, 1.1, 5.5);
    R.displayTable(g, 8.6, -0.6, -.2, 1.8, 'egg');

    /* ─ 가구 구역(앞쪽) ─ */
    R.sofa(g, -5.0, 4.6, Math.PI, 2.6, 0x9B7BD4);
    R.lowTable(g, -5.0, 3.4, 0, 1.6, .9);
    R.lamp(g, -3.8, .56, 3.4);
    R.shelf(g, 4.4, 3.4, 0, 2.0, 2.2);
    R.wardrobe(g, 7.6, 3.6, 0);
    R.chair(g, 5.9, 4.8, .4, 0xE8935A);
    R.displayTable(g, -8.4, 3.8, .15, 1.8, 'cloth');

    R.aFrame(g, 9.2, 5.0, -1.2, 0xE8935A);
    R.banner(g, -9.72, 3.6, -2.0, Math.PI / 2, 3.2, .95, 0xE8935A);
    R.clock(g, 8.6, 3.5, -6.92);
    R.poster(g, 2.0, 3.0, -6.92, 0, 1.1, 1.4, 0x9B7BD4);
    R.bin(g, 3.0, 6.4);
    [-6.0, 0, 6.0].forEach((x) => { R.pendant(g, x, -3.6, 3.7, 0xF2C14E); R.pendant(g, x, 4.4, 3.7, 0xF2C14E); });
    R.rug(g, 0, -1.0, 3.6, 6.0, 0xB05248, 0xF6E0D2);
    R.plant(g, 9.4, 6.2, 1.15); R.plant(g, -9.4, 6.2, 1.0);

  },
};

/* 방마다 이름 — HUD 에 띄웁니다 */
export const ROOM_NAME = {
  library: ['도서관', '백색소음 · 오래 앉는 자리'],
  mainhall: ['본관', '강의실 · 대중음악'],
  dorm: ['기숙사', '내 방 · 1인실'],
  union: ['학생회관', '볼일 보는 곳'],
  arcade: ['미니게임관', '3분만 놀고 가는 곳'],
  shop: ['동아리 상점', '옷 · 가구 · 알'],
};

/* 놓는 가구 — 상점 FURN 목록과 1:1. 유령(미리 보기)과 실물이 같은 코드를 씁니다 */
export function decorItem(g, d) {
  const p = new THREE.Group(); p.position.set(d.x, 0, d.z); p.rotation.y = d.ry || 0; g.add(p);
  const id = d.id;
  if (id === 'plant') R.plant(p, 0, 0, 1.0);
  else if (id === 'rug2') R.rug(p, 0, 0, 2.2, 1.6, 0x9B7BD4, 0xF2ECF6);
  else if (id === 'books2') { R.books(p, -.1, .0, 0, 3); R.books(p, .16, .0, .1, 2); }
  else if (id === 'guitar2') R.guitar(p, 0, 0, .4);
  else if (id === 'lamp2') {
    cyl(p, .16, .2, .05, 12, M(0x3A4150, .5), 0, .03, 0);
    cyl(p, .025, .03, 1.1, 8, M(0x3A4150, .5), 0, .6, 0);
    const sh2 = new THREE.Mesh(new THREE.ConeGeometry(.22, .26, 14, 1, true), M(0xF2C14E, .55));
    sh2.position.y = 1.24; sh2.rotation.x = Math.PI; p.add(sh2);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xFFF2C8, emissive: 0xFFE9A8, emissiveIntensity: .9 }));
    bulb.position.y = 1.18; p.add(bulb);
  } else if (id === 'bear') {
    const br = M(0xC49A6C, .8), brD = M(0xA8804F, .8);
    const e2 = (r, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const m2 = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), br);
      m2.position.set(x, y, z); m2.scale.set(sx, sy, sz); m2.castShadow = true; p.add(m2); return m2;
    };
    e2(.22, 0, .24, 0, 1, 1.05, .9);                       // 몸
    e2(.17, 0, .56, .02);                                   // 머리
    e2(.06, -.12, .68, 0); e2(.06, .12, .68, 0);            // 귀
    e2(.08, -.2, .3, .06); e2(.08, .2, .3, .06);            // 팔
    e2(.09, -.11, .08, .1); e2(.09, .11, .08, .1);          // 다리
    { const mz = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), brD);
      mz.position.set(0, .53, .16); mz.scale.set(1, .8, .7); p.add(mz); }
  }
  /* 여섯 말고는 room.js 의 표에 물어봅니다. 2D 판 기숙사에는 놓을 수 있는
     물건이 스무 가지쯤 있었는데 여기는 여섯이라, 방을 꾸며도 다 같은
     방이 됐습니다. 새 것을 이 if 사슬에 계속 붙이면 이 함수가 천 줄이
     되므로, 짓는 일은 저쪽에 두고 여기서는 넘기기만 합니다. */
  else if (R.buildFurn) R.buildFurn(p, id);
  return p;
};

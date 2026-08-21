/* ══════════════════════════════════════════════════════════
   실내 여섯 — 건물마다 한 방씩. world.html 이 문에 닿으면 이걸 세웁니다.
   interiors.html 은 이 모듈을 한 방씩 크게 찍어 보는 뷰어일 뿐입니다.
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { M, box, cyl, prism } from './parts.js';
import { character, OUTFITS } from './chars.js';
import * as R from './room.js';

const IN = R.IN;

export const ROOMS = {
  /* ① 도서관 — 앉아서 오래 버티는 방. 서가 · 열람석 · 1인 캐럴 · 대출대 */
  library(g) {
    R.shell(g, 16, 13, 4.4, { floorA: 0xC9945C, floorB: 0xB8814A, wall: 0xF2E8D4 });
    [-4.8, -1.6, 1.6].forEach((x) => R.window3(g, x, 2.6, 13, 2.0, 2.0));
    /* 서가 — 뒤벽 · 왼벽 두 줄 */
    [-6.9, -4.8, -2.7, .6, 2.7, 4.8, 6.9].forEach((x) => R.shelf(g, x, -5.7, 0, 1.9, 2.7));
    [-4.0, -1.8, .4, 2.6, 4.8].forEach((z) => R.shelf(g, -6.9, z, Math.PI / 2, 1.9, 2.7));
    /* 서가 섬 하나 — 방 가운데를 비워 두면 창고가 됩니다 */
    [-3.2, -1.1].forEach((z) => R.shelf(g, -3.4, z, Math.PI / 2, 1.8, 2.1));
    /* 열람 탁자 둘 — 여기가 자세 세션 자리입니다 */
    [-1.9, 1.9].forEach((z, k) => {
      R.readTable(g, 1.6, z, 0, 5.6);
      /* 의자는 **탁자를 보고** 놓입니다. 전 판은 둘 다 등을 돌리고 있어서
         앉으면 벽을 보고 앉는 그림이 됐습니다(ry 가 반대였습니다). */
      [-2.0, -.7, .7, 2.0].forEach((dx) => {
        R.chair(g, 1.6 + dx, z - 1.4, 0, IN.wood);
        R.chair(g, 1.6 + dx, z + 1.4, Math.PI, IN.wood);
      });
      [-2.3, 2.3].forEach((dx) => R.lamp(g, 1.6 + dx, .87, z));
      R.books(g, 1.6 - 1.1, .87, z + (k ? .45 : -.45), 3);
      R.books(g, 1.6 + 1.4, .87, z + (k ? -.5 : .5), 2);
      R.laptop(g, 1.6 + .5, .87, z - .55, Math.PI);
      R.laptop(g, 1.6 - 1.7, .87, z + .55, 0);
    });
    /* 1인 캐럴 넉 — 오른쪽 벽면 */
    [-4.4, -2.4, -.4, 1.6].forEach((z) => {
      R.carrel(g, 6.6, z, -Math.PI / 2);
      R.chair(g, 5.5, z, Math.PI / 2, IN.woodLight);
    });
    /* 대출대 · 수레 · 지구본 */
    R.counter(g, -4.2, 4.6, 0, 3.4, IN.woodDark);
    R.counterTop(g, -4.2, 1.1, 4.4);
    R.globe(g, -2.4, 1.06, 4.6);
    R.bookCart(g, -1.0, 3.0, .3);
    R.bookCart(g, 4.6, 4.6, -.4);
    R.books(g, -5.2, 1.14, 4.5, 4);
    /* 쉬는 구석 — 소파 · 낮은 탁자 */
    R.sofa(g, 2.6, 5.3, 0, 2.8, 0x7FA8C4);
    R.lowTable(g, 2.6, 3.9, 0, 1.5, .9);
    R.books(g, 2.4, .56, 3.9, 2);
    /* 벽 · 천장 */
    R.clock(g, 5.6, 3.5, -6.32);
    R.poster(g, -6.72, 2.9, -2.6, Math.PI / 2, 1.0, 1.3, 0x63C47C);
    R.poster(g, -6.72, 2.9, 3.2, Math.PI / 2, 1.0, 1.3, 0xE8935A);
    [-4.0, 1.6, 6.0].forEach((x) => R.pendant(g, x, 0, 3.55));
    R.pendant(g, 1.6, 3.4, 3.55);
    R.rug(g, 1.6, 0, 9.2, 7.4, 0xB08AB0, 0xF2E4E8);
    R.bin(g, -6.0, 5.6);
    R.plant(g, 6.9, 5.4, 1.15); R.plant(g, -6.3, 5.6, 1.0); R.plant(g, 6.9, -5.4, 1.0);
    character(g, '거북이', OUTFITS[0], { x: -2.7, z: 3.3, ry: 2.9, scale: .9 });
    character(g, '기린', OUTFITS[2], { x: 2.3, z: 3.3, ry: .1, scale: .9 });
    character(g, '백조', OUTFITS[4], { x: -4.2, z: 5.7, ry: Math.PI, scale: .9 });
    character(g, '개구리', OUTFITS[3], { x: 5.5, z: -2.4, ry: Math.PI / 2, scale: .9 });
  },

  /* ② 본관 — 강의실. 칠판 · 스크린 · 교탁 · 줄지어 앉는 책상 · 사물함 */
  mainhall(g) {
    R.shell(g, 16, 13, 4.4, { floorA: 0xE8E2D2, floorB: 0xD6CFBC, wall: 0xE6EAF2, under: 0x8A9098 });
    R.blackboard(g, -1.4, 2.3, -6.2, 6.0, 2.2);
    R.projScreen(g, 4.0, 2.6, -6.28, 3.2, 2.0);
    R.window3(g, -5.6, 2.6, 13, 2.0, 2.0);
    R.podium(g, -4.0, -4.2, .2);
    R.desk(g, -.4, -4.4, 0, 2.2, .9, .9);
    R.books(g, -1.0, .96, -4.4, 2);
    R.laptop(g, .3, .96, -4.4);
    /* 강의석 — 세 줄 × 셋. 책상마다 물건이 올라가야 사람 쓰는 방이 됩니다 */
    [-1.6, .9, 3.4].forEach((z, ri) => {
      [-4.6, 0, 4.6].forEach((x, ci) => {
        R.desk(g, x, z, 0, 3.6, 1.1, .78);
        [-1.2, 0, 1.2].forEach((dx) => R.chair(g, x + dx, z + 1.15, Math.PI, 0x9BB4D6));
        R.books(g, x - 1.3, .87, z - .12, 2);
        R.books(g, x + 1.3, .87, z + .1, ((ri + ci) % 2) + 1);
        if ((ri + ci) % 2 === 0) R.laptop(g, x + .5, .87, z - .1);
        if ((ri + ci) % 3 === 1) R.deskClutter(g, x - .3, .87, z);
      });
    });
    /* 뒤·옆 벽 — 사물함 · 게시판 · 시계 · 현수막 */
    R.lockers(g, -6.6, -1.4, Math.PI / 2, 4, 0x8AB4CE);
    R.lockers(g, -6.6, 2.6, Math.PI / 2, 4, 0x8AB4CE);
    R.clock(g, 6.4, 3.5, -6.32);
    R.poster(g, 6.4, 2.2, -6.32, 0, 1.0, 1.3, 0xF2C14E);
    R.banner(g, -7.02, 3.55, 1.0, Math.PI / 2, 3.6, .95, 0x3FB3A2);
    R.radiator(g, -5.6, -6.1, 0, 2.4);
    R.stackChairs(g, 7.0, 4.8, -.4, 5);
    R.stackChairs(g, 7.0, 3.4, -.2, 4, 0xE8935A);
    R.bin(g, -6.1, -5.4, 0x5B84C4);
    /* 뒤쪽 — 빈 바닥을 남기면 강의실이 아니라 체육관이 됩니다 */
    R.bench(g, -4.4, 5.5, 0, 3.4);
    R.bench(g, -.6, 5.5, 0, 3.4);
    R.lockers(g, -6.6, 4.8, Math.PI / 2, 3, 0x9BC4B4);
    R.aFrame(g, 3.0, 5.2, -.4, 0xF2C14E);
    R.cooler(g, -6.4, -3.4, Math.PI / 2);
    R.bin(g, 5.4, 5.4, 0x5E8C6A);
    R.wallShelf(g, -6.62, 3.0, -4.0, Math.PI / 2, 1.8);
    [-4.6, 0, 4.6].forEach((x) => R.striplight(g, x, -1.0, 3.9, 3.2));
    [-4.6, 0, 4.6].forEach((x) => R.striplight(g, x, 3.0, 3.9, 3.2));
    R.plant(g, 7.2, -4.2, 1.05); R.plant(g, 7.2, 5.6, 1.1);
    R.desk(g, 7.0, .4, -Math.PI / 2, 2.6, .9, .78);
    R.books(g, 7.0, .87, -.4, 3); R.laptop(g, 7.0, .87, 1.0, -Math.PI / 2);
    R.bookCart(g, 6.6, -2.4, -.3);
    R.poster(g, -6.72, 2.6, -5.4, Math.PI / 2, .9, 1.2, 0xE8695A);
    R.rug(g, -1.0, -4.9, 6.6, 2.2, 0x4E6E8C, 0xDCE6F0);
    character(g, '알파카', OUTFITS[3], { x: -4.6, z: 2.2, ry: Math.PI, scale: .9 });
    character(g, '햄스터', OUTFITS[1], { x: -2.2, z: -5.0, ry: 0, scale: .9 });
    character(g, '펭귄',   OUTFITS[0], { x: -1.2, z: -.3, ry: Math.PI, scale: .9 });
    character(g, '고슴도치', OUTFITS[5], { x: 5.8, z: 4.6, ry: Math.PI, scale: .9 });
  },

  /* ③ 기숙사 — 내 방. 사는 흔적이 있어야 방입니다 */
  dorm(g) {
    R.shell(g, 12, 10, 4.2, { floorA: 0xD6A96E, floorB: 0xC49A5E, wall: 0xF6EDDC });
    R.window3(g, 2.4, 2.5, 10, 2.4, 2.0);
    R.bed(g, -3.6, -1.4, 0);
    R.wardrobe(g, 4.2, -4.2, 0);
    R.desk(g, .8, 3.0, 0, 2.8, 1.1, .78);
    R.chair(g, .8, 1.9, 0, IN.wood);
    R.laptop(g, .8, .87, 3.1, Math.PI);
    R.lamp(g, 2.0, .87, 3.1);
    R.books(g, -.3, .87, 3.1, 3);
    R.deskClutter(g, .3, .87, 2.6);
    R.shelf(g, -5.4, 3.4, Math.PI / 2, 1.7, 2.0);
    R.wallShelf(g, -5.62, 2.5, -1.0, Math.PI / 2, 1.8);
    R.wallShelf(g, -5.62, 3.3, -1.0, Math.PI / 2, 1.8);
    R.fridge(g, 5.9, -4.2, 0);
    R.coffee(g, 5.9, 1.28, -4.2);
    R.mirror(g, -5.72, 2.2, 1.2, Math.PI / 2, .8, 1.7);
    R.laundry(g, -5.1, -.4);
    R.guitar(g, -5.3, -3.4, .3);
    R.bin(g, 2.8, 4.6, 0xE8935A);
    /* 바닥 자리 — 낮은 탁자에 방석 둘. 여기가 친구 오면 앉는 자리입니다 */
    R.lowTable(g, -1.2, 1.2, .2, 1.5, 1.0);
    R.books(g, -1.4, .56, 1.2, 2);
    [[-2.4, 1.9, 0xE8935A], [.1, .5, 0x63C47C]].forEach(([cx, cz, c]) => {
      box(g, 1.0, .24, 1.0, .11, M(c, .82), cx, .22, cz).castShadow = true;
      box(g, .78, .1, .78, .08, M(c, .68), cx, .35, cz);
    });
    R.bench(g, 4.4, 3.6, 0, 2.2, 0xC08E58);
    R.plant(g, 2.0, -4.6, .8);
    /* 벽 — 이 방을 누가 쓰는지 말하는 자리 */
    R.board(g, -2.2, 2.7, -4.82, 1.8, 1.2);
    R.poster(g, .4, 2.9, -4.82, 0, .9, 1.2, 0xE8695A);
    R.poster(g, -4.0, 2.9, -4.82, 0, .8, 1.1, 0x2DD4BF);
    R.stringLights(g, -3.4, 3.5, -4.7, 4.2, 9);
    R.clock(g, 4.4, 3.4, -4.82, 0, .34);
    R.pendant(g, 0, 0, 3.4, 0xE8C08A);
    R.rug(g, -.2, .2, 5.0, 4.0, 0x4E8C9E, 0xEAF2F4);
    R.plant(g, 5.4, 4.6, 1.1); R.plant(g, -5.2, 4.6, .9);
    /* 옷걸이 · 전신거울 앞 · 빨래 · 스탠드 — 사람이 사는 흔적 */
    R.rack(g, -3.2, 4.4, .2);
    R.shoeShelf(g, -5.6, -1.6, Math.PI / 2);
    R.lowTable(g, 3.4, 1.4, -.3, 1.5, .9);
    R.books(g, 3.3, .56, 1.4, 2);
    R.lamp(g, 4.1, .56, 1.4);
    [[2.6, 2.6, 0x9B7BD4], [4.2, .1, 0x3FB3A2]].forEach(([cx, cz, c]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(.52, 16, 12), M(c, .84));
      m.position.set(cx, .42, cz); m.scale.y = .68;
      m.castShadow = true; m.receiveShadow = true; g.add(m);
      box(g, .8, .12, .8, .1, M(c, .7), cx, .12, cz);
    });
    R.wallShelf(g, 2.0, 2.6, -4.82, 0, 2.0);
    R.poster(g, -5.62, 2.7, -3.2, Math.PI / 2, .9, 1.2, 0xF2C14E);
    character(g, '개구리', OUTFITS[5], { x: .8, z: 1.95, ry: 0, scale: .9 });
  },

  /* ④ 학생회관 — 창구 · 식당 · 라운지가 한 층에 있는 방 */
  union(g) {
    R.shell(g, 16, 12, 4.4, { floorA: 0xE8E2D2, floorB: 0xD8D2C0, wall: 0xEFF6EE, under: 0x8A9098 });
    R.window3(g, -5.4, 2.6, 12, 2.2, 2.0);
    R.window3(g, 5.4, 2.6, 12, 2.2, 2.0);
    /* 창구 둘 — 안내 · 학생증 */
    [-5.6, -1.8].forEach((x, i) => {
      R.counter(g, x, -4.2, 0, 3.2, [IN.wood, IN.woodDark][i]);
      R.counterTop(g, x, 1.1, -4.0);
      R.chair(g, x, -5.3, 0, 0x9BB4D6);
      R.board(g, x, 3.0, -5.82, 2.4, 1.5);
    });
    /* 배식대 — 학생회관이면 밥 먹는 데가 있어야 합니다 */
    R.trayCounter(g, 4.0, -4.4, 0, 5.0);
    R.poster(g, 4.0, 3.1, -5.82, 0, 3.0, 1.0, 0xF2C14E);
    /* 식탁 셋 */
    [[-4.4, -.6], [.4, -.4], [5.0, -.2]].forEach(([x, z], i) =>
      R.cafeSet(g, x, z + .2, [0x63C47C, 0xF2C14E, 0x7FA8C4][i]));
    /* 라운지 */
    R.sofa(g, -3.4, 4.6, 0, 3.0, 0x9B7BD4);
    R.sofa(g, -.2, 4.6, 0, 2.2, 0xE8935A);
    R.lowTable(g, -2.0, 3.0, 0, 2.0, 1.0);
    R.books(g, -2.4, .56, 3.0, 2);
    R.vending(g, 7.0, -5.0, 0);
    R.vending(g, 5.6, -5.0, 0);
    R.cooler(g, 7.1, -2.4, Math.PI / 2);
    R.aFrame(g, 3.2, 4.6, -.5, 0x2DD4BF);
    R.banner(g, -7.02, 3.55, 3.4, Math.PI / 2, 3.4, .95, 0x3FB3A2);
    R.clock(g, 7.0, 3.4, -5.82);
    R.lockers(g, -7.1, 2.0, Math.PI / 2, 3, 0x9BC4B4);
    R.bin(g, 2.0, 5.6); R.bin(g, -6.6, -1.4, 0xE8935A);
    /* 오른쪽이 통째로 비어서 로비가 아니라 창고로 보였습니다 */
    R.cafeSet(g, 5.4, 3.4, 0xE8935A);
    R.bench(g, 2.4, 5.5, 0, 3.0);
    R.coffee(g, 6.6, 1.06, .4, Math.PI / 2);
    R.counter(g, 6.6, .4, Math.PI / 2, 1.8, IN.woodDark);
    R.poster(g, -7.12, 2.2, -1.0, Math.PI / 2, 1.0, 1.3, 0xE8695A);
    [-4.6, 0, 4.6].forEach((x) => R.striplight(g, x, -1.6, 3.9, 3.4));
    [-2.4, 2.4].forEach((x) => R.pendant(g, x, 3.6, 3.55, 0xE8C08A));
    R.plant(g, 7.1, 5.4, 1.15); R.plant(g, -7.0, 5.4, 1.0); R.plant(g, -7.0, -3.0, .95);
    R.rug(g, -1.8, 3.9, 7.2, 3.6, 0x3E7C8C, 0xE0F0F2);
    character(g, '고슴도치', OUTFITS[2], { x: -5.6, z: -5.1, ry: 0, scale: .9 });
    character(g, '펭귄',   OUTFITS[0], { x: -3.2, z: -2.8, ry: Math.PI, scale: .9 });
    character(g, '햄스터', OUTFITS[5], { x: 3.4, z: -2.9, ry: Math.PI, scale: .9 });
    character(g, '백조',   OUTFITS[3], { x: -1.4, z: 3.6, ry: 0, scale: .9 });
    character(g, '기린',   OUTFITS[1], { x: 6.0, z: -2.6, ry: 1.9, scale: .9 });
  },

  /* ⑤ 미니게임관 — 노는 방. 오락기 · 인형뽑기 · 에어하키 · 경품대 */
  arcade(g) {
    R.shell(g, 16, 12, 4.4, { floorA: 0x5E4E7C, floorB: 0x4E4068, wall: 0x2E2646, under: 0x3A3050 });
    const cols = [0xE8695A, 0x2DD4BF, 0xE0AE3C, 0x9B7BD4, 0xFF7FA8];
    /* 오락기 다섯 — 뒤벽 */
    cols.forEach((c, i) => R.cabinet(g, -6.0 + i * 2.5, -4.9, 0, c));
    cols.forEach((c, i) => R.neon(g, '', -6.0 + i * 2.5, 3.0, -5.82, 0, c, 1.9));
    /* 인형뽑기 둘 · 에어하키 · 경품대 */
    R.claw(g, -6.6, 1.4, .5, 0xFF7FA8);
    R.claw(g, -4.6, 1.0, .3, 0x2DD4BF);
    R.airHockey(g, .6, 1.0, .1);
    R.prizeShelf(g, 6.8, -5.4, 0);
    R.prizeShelf(g, -7.2, -2.6, Math.PI / 2);
    /* 교환대 */
    R.counter(g, -3.6, 4.9, 0, 3.2, 0x4E4068);
    R.counterTop(g, -3.6, 1.1, 4.9);
    R.stanchion(g, -5.6, 3.6, -1.6, 3.6);
    /* 스툴 — 오락기 앞 */
    [-6.0, -3.5, -1.0, 1.5, 4.0].forEach((x) => {
      cyl(g, .34, .3, .12, 14, M(0x2DD4BF, .6), x, .62, -3.3);
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) =>
        cyl(g, .04, .05, .56, 8, M(IN.metal, .45), x + sx * .2, .3, -3.3 + sz * .2));
    });
    R.bin(g, 5.6, 5.2, 0x3A3050);
    /* 인생네컷 · 리듬 발판 — 놀 거리가 넷뿐이면 오락실이 아니라 복도입니다 */
    R.photoBooth(g, 5.8, 3.0, .72, 0xFF7FA8);
    R.dancePad(g, 2.8, 4.5, .15);
    R.neon(g, '', -7.2, 3.2, 2.6, Math.PI / 2, 0x2DD4BF, 3.0);
    R.bench(g, -.6, 4.9, 0, 2.6, 0x6E5A9E);
    [-4.0, 0, 4.0].forEach((x) => R.pendant(g, x, 1.6, 3.55, 0xFF7FA8));
    R.plant(g, 7.1, 4.8, 1.05); R.plant(g, -7.1, 4.8, 1.0);
    R.rug(g, .4, 1.0, 8.0, 4.6, 0x3E3358, 0x6E5A9E);
    character(g, '거북이', OUTFITS[1], { x: -3.5, z: -3.8, ry: 0, scale: .9 });
    character(g, '기린',   OUTFITS[3], { x: 1.5, z: -3.8, ry: 0, scale: .9 });
    character(g, '알파카', OUTFITS[0], { x: 2.4, z: 1.0, ry: -Math.PI / 2, scale: .9 });
    character(g, '햄스터', OUTFITS[4], { x: -1.1, z: 1.0, ry: Math.PI / 2, scale: .9 });
  },

  /* ⑥ 동아리 상점 — 파는 방. 옷 · 가구 · 알 세 구역 */
  shop(g) {
    R.shell(g, 16, 12, 4.4, { floorA: 0xE0C8AE, floorB: 0xD0B69A, wall: 0xF6E8DC, under: 0x9A7458 });
    R.window3(g, 5.4, 2.6, 12, 2.2, 2.0);
    /* ─ 옷 구역(왼쪽) ─ */
    R.rack(g, -5.8, -4.0, 0);
    R.rack(g, -3.2, -4.4, .3);
    R.rack(g, -6.6, -1.2, Math.PI / 2);
    R.mannequin(g, -4.4, -1.6, .5, 0xE8695A, 0x3E5C82);
    R.mannequin(g, -2.6, -2.2, -.4, 0xF2C14E, 0x4A4A58);
    R.shoeShelf(g, -6.8, 2.0, Math.PI / 2);
    R.hatWall(g, -3.0, 2.2, -5.82, 0, 5);
    R.curtain(g, -6.4, 1.1, 4.4, .2, 1.4, 2.2, 0x3FB3A2);
    R.mirror(g, -7.12, 2.2, 3.0, Math.PI / 2, .9, 1.9);
    R.counter(g, -4.2, 4.4, Math.PI, 2.8, IN.woodDark);
    R.counterTop(g, -4.2, 1.1, 4.2);
    /* ─ 가구 구역(가운데) ─ */
    R.shelf(g, .4, -5.6, 0, 2.2, 2.4);
    R.sofa(g, .6, -2.2, 0, 2.4, 0x9B7BD4);
    R.lowTable(g, .6, -.8, 0, 1.6, .9);
    R.chair(g, -1.2, -3.6, .5, 0xE8935A);
    R.chair(g, 2.4, -3.4, -.6, 0x63C47C);
    R.lamp(g, .6, .56, -.8);
    R.wardrobe(g, 3.2, -5.2, 0);
    R.bookCart(g, 2.6, -.6, .4);
    R.counter(g, .6, 4.4, Math.PI, 2.8, IN.wood);
    R.counterTop(g, .6, 1.1, 4.2);
    /* ─ 알 구역(오른쪽) ─ */
    [[4.6, 0xF2D08A], [5.8, 0x9EDCEB], [7.0, 0xF2A0A0]].forEach(([x, c]) => R.eggStand(g, x, -4.6, c));
    [[5.2, 0xC4EBA0], [6.4, 0xE8B8E0]].forEach(([x, c]) => R.eggStand(g, x, -2.9, c));
    R.wallShelf(g, 6.9, 2.6, -1.0, -Math.PI / 2, 2.0);
    R.counter(g, 5.6, 4.4, Math.PI, 2.8, IN.woodDark);
    R.counterTop(g, 5.6, 1.1, 4.2);
    R.aFrame(g, 3.0, 2.6, -.5, 0xE8935A);
    R.banner(g, -7.02, 3.55, -3.0, Math.PI / 2, 3.4, .95, 0xE8935A);
    R.clock(g, 6.6, 3.5, -5.82);
    R.poster(g, 1.8, 2.9, -5.82, 0, 1.0, 1.3, 0x9B7BD4);
    R.bin(g, 3.6, 5.4);
    /* 매대 — 손님이 도는 길이 생겨야 가게가 됩니다 */
    R.displayTable(g, -4.0, .4, .1, 2.2, 'cloth');
    R.displayTable(g, -1.6, -.2, -.2, 1.8, 'cloth');
    R.displayTable(g, 4.4, .6, .15, 2.2, 'egg');
    R.bench(g, -1.0, 5.5, 0, 2.6);
    R.stanchion(g, 2.2, 4.0, 2.2, 5.4);
    R.plant(g, 2.6, -2.2, .85);
    [-4.0, .6, 5.2].forEach((x) => R.pendant(g, x, -.4, 3.55, 0xF2C14E));
    [-4.0, .6, 5.2].forEach((x) => R.pendant(g, x, 3.2, 3.55, 0xF2C14E));
    R.plant(g, 7.1, 5.2, 1.15); R.plant(g, -7.1, 5.4, 1.0);
    R.rug(g, .6, 1.9, 10.0, 3.0, 0xB05248, 0xF6E0D2);
    character(g, '알파카', OUTFITS[1], { x: -4.2, z: 3.2, ry: 0, scale: .9 });
    character(g, '햄스터', OUTFITS[3], { x: .6, z: 3.2, ry: 0, scale: .9 });
    character(g, '고슴도치', OUTFITS[0], { x: 5.6, z: 3.2, ry: 0, scale: .9 });
    character(g, '백조',   OUTFITS[5], { x: -2.0, z: 1.4, ry: 2.6, scale: .9 });
    character(g, '거북이', OUTFITS[2], { x: 4.2, z: -1.0, ry: -1.2, scale: .9 });
  },
};


/* 방 크기 — world.html 이 벽·바닥 경계를 만들 때 씁니다.
   shell(g, w, d, h) 의 w · d 와 같아야 합니다. */
export const ROOM_SIZE = {
  library:  { w: 16, d: 13, h: 4.4 },
  mainhall: { w: 16, d: 13, h: 4.4 },
  dorm:     { w: 12, d: 10, h: 4.2 },
  union:    { w: 16, d: 12, h: 4.4 },
  arcade:   { w: 16, d: 12, h: 4.4 },
  shop:     { w: 16, d: 12, h: 4.4 },
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

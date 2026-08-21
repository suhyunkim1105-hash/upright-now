/* ══════════════════════════════════════════════════════════
   캐릭터 — **사람 몸에 동물 얼굴**.
   동물의 숲 주민과 같은 문법입니다. 몸은 여덟 종이 똑같고(옷을 하나만
   만들면 여덟 종이 다 입습니다), 다른 것은 **머리뿐**입니다.
   비율은 2.8등신 — 실물 비례로 만들면 인형이 아니라 모형이 됩니다.
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { M, box, cyl, roundedBox } from './parts.js';

const SK = { ink: 0x3A2E28, white: 0xFFFFFF, blush: 0xF2A0A0 };

function sph(p, r, mat, x, y, z, sx, sy, sz) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat);
  m.position.set(x, y, z);
  if (sx) m.scale.set(sx, sy, sz);
  m.castShadow = true; m.receiveShadow = true; p.add(m); return m;
}
/* 눈 — 검은 알 + 흰 점. 흰 점 하나가 있고 없고가 "살아 있음" 을 가릅니다. */
function eyes(p, y, z, r, gap) {
  [-gap, gap].forEach((dx) => {
    sph(p, r, M(SK.ink, .35), dx, y, z);
    sph(p, r * .34, M(SK.white, .3), dx - r * .28, y + r * .32, z + r * .5);
  });
}

/* ---- 머리 여덟 ----
   종을 가르는 것은 **실루엣**입니다. 색만 바꾸면 여덟이 하나로 보입니다. */
const HEADS = {
  거북이(h, C) {
    sph(h, .52, M(C.skin), 0, 0, 0, 1, .94, .96);
    sph(h, .46, M(C.shell, .8), 0, .1, -.16, 1.02, .86, .8);     // 뒤통수 등딱지결
    box(h, .3, .16, .2, .07, M(C.beak, .6), 0, -.16, .46);        // 부리 같은 입
    box(h, .34, .06, .18, .03, M(0x8E6A46, .6), 0, -.2, .48);
    eyes(h, .12, .44, .105, .19);
    [-.44, .44].forEach((x) => sph(h, .12, M(C.skin), x, -.02, .1, 1, 1.1, .7)); // 볼
  },
  기린(h, C) {
    sph(h, .48, M(C.skin), 0, .02, 0, 1, 1.02, .94);
    box(h, .34, .3, .34, .14, M(C.skin), 0, -.2, .34);            // 주둥이
    /* 콧구멍을 눈만 하게 뒀더니 **눈이 넷** 으로 보였습니다. 작게,
       그리고 주둥이 아래쪽으로 내립니다. */
    sph(h, .036, M(0x8E6A4E, .5), -.075, -.3, .46); sph(h, .036, M(0x8E6A4E, .5), .075, -.3, .46);
    eyes(h, .16, .4, .1, .21);
    [-.17, .17].forEach((x) => {                                   // 뿔 둘
      cyl(h, .055, .07, .26, 8, M(C.skin), x, .56, -.02);
      sph(h, .095, M(C.spot, .6), x, .7, -.02);
    });
    [-.44, .44].forEach((x) => sph(h, .17, M(C.skin), x, .24, -.06, .5, 1, .8)); // 귀
    [[.3, .18, .2], [-.26, .3, .16], [.16, -.02, -.42]]           // 반점
      .forEach(([x, y, z]) => sph(h, .13, M(C.spot, .7), x, y, z, 1, 1, .4).lookAt(x * 4, y * 4, z * 4));
  },
  알파카(h, C) {
    sph(h, .46, M(C.skin), 0, 0, 0, 1, 1.04, .95);
    box(h, .32, .28, .3, .13, M(C.skin), 0, -.2, .34);
    sph(h, .034, M(0xB59878, .5), -.07, -.29, .44); sph(h, .034, M(0xB59878, .5), .07, -.29, .44);
    eyes(h, .14, .4, .1, .2);
    /* 머리 위 곱슬 — 알파카의 정체성 */
    [[0,.52,0,.26],[-.2,.46,.06,.2],[.2,.46,.06,.2],[0,.46,-.2,.19]]
      .forEach(([x,y,z,r]) => sph(h, r, M(C.wool, .95), x, y, z));
    [-.4, .4].forEach((x) => sph(h, .12, M(C.skin), x, .3, -.02, .55, 1.2, .7));
  },
  햄스터(h, C) {
    sph(h, .5, M(C.skin), 0, 0, 0, 1.04, .94, .96);
    box(h, .26, .2, .22, .1, M(C.snout, .7), 0, -.16, .42);
    sph(h, .05, M(0xC08A6A, .5), 0, -.15, .52);
    eyes(h, .1, .43, .1, .19);
    [-.34, .34].forEach((x) => {                                   // 동그란 귀
      sph(h, .17, M(C.skin), x, .38, -.02, 1, 1, .5);
      sph(h, .11, M(C.inner, .7), x, .38, .04, 1, 1, .4);
    });
    [-.4, .4].forEach((x) => sph(h, .13, M(SK.blush, .8), x, -.1, .3, 1, .8, .4));
  },
  고슴도치(h, C) {
    sph(h, .46, M(C.skin), 0, -.02, .02, 1, .96, 1);
    box(h, .26, .2, .28, .1, M(C.snout, .7), 0, -.16, .42);
    sph(h, .048, M(0xA87C5C, .5), 0, -.15, .54);
    eyes(h, .1, .42, .095, .18);
    /* 가시 — 뒤통수에 원뿔 여럿 */
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2, r = .34 + (i % 3) * .04;
      const c = new THREE.Mesh(new THREE.ConeGeometry(.1, .32, 7), M(C.quill, .8));
      c.position.set(Math.cos(a) * r * .8, .3 + (i % 2) * .1, -.14 + Math.sin(a) * r * .5);
      c.rotation.set(-.5 + Math.sin(a) * .3, 0, -Math.cos(a) * .5);
      c.castShadow = true; h.add(c);
    }
    [-.34, .34].forEach((x) => sph(h, .1, M(C.skin), x, .22, .04, .7, 1, .5));
  },
  개구리(h, C) {
    sph(h, .52, M(C.skin), 0, -.04, 0, 1.08, .82, .95);
    /* 눈이 머리 위로 튀어나옵니다 — 개구리의 전부 */
    [-.24, .24].forEach((x) => {
      sph(h, .19, M(C.skin), x, .34, .04);
      sph(h, .13, M(SK.white, .35), x, .4, .1);
      sph(h, .075, M(SK.ink, .35), x, .41, .19);
      sph(h, .028, M(SK.white, .3), x - .03, .45, .24);
    });
    box(h, .5, .06, .16, .03, M(0x2E6B3E, .7), 0, -.2, .44);       // 입
    [-.36, .36].forEach((x) => sph(h, .1, M(C.belly, .7), x, -.06, .34, 1, .8, .5));
  },
  백조(h, C) {
    sph(h, .44, M(C.skin), 0, .02, 0, 1, 1.02, .96);
    box(h, .26, .16, .34, .07, M(C.beak, .55), 0, -.12, .44);      // 주황 부리
    box(h, .12, .1, .1, .04, M(SK.ink, .5), 0, -.06, .28);
    eyes(h, .14, .38, .1, .17);
    /* 머리 깃 */
    [[-.1,.44,-.1],[.1,.44,-.1],[0,.5,-.16]]
      .forEach(([x,y,z]) => sph(h, .1, M(C.skin), x, y, z, .7, 1.2, .7));
  },
  펭귄(h, C) {
    sph(h, .5, M(C.skin), 0, 0, 0, 1, .98, .96);
    sph(h, .42, M(C.belly, .6), 0, -.06, .18, 1, 1, .7);           // 흰 얼굴판
    box(h, .22, .14, .3, .06, M(C.beak, .55), 0, -.14, .46);
    eyes(h, .1, .42, .1, .18);
    [-.36, .36].forEach((x) => sph(h, .1, M(C.skin), x, .16, -.06, .6, 1, .6));
  },
};

/* 종마다 색과 머리 이름. 몸은 전부 같습니다. */
export const SPECIES = {
  거북이:   { skin: 0x7FC98A, shell: 0x4E9E63, beak: 0xF2D08A },
  기린:     { skin: 0xF6D9A0, spot: 0xC98E4E },
  알파카:   { skin: 0xF2E4CE, wool: 0xFFF6E8 },
  햄스터:   { skin: 0xE8B87A, snout: 0xFFF0DC, inner: 0xF2A0A0 },
  고슴도치: { skin: 0xD9B48C, snout: 0xFFF0DC, quill: 0x8E6A4E },
  개구리:   { skin: 0x7FC96A, belly: 0xDCF0C4 },
  백조:     { skin: 0xFFFFFF, beak: 0xF2933C },
  펭귄:     { skin: 0x3E4A5A, belly: 0xFFFFFF, beak: 0xF2933C },
};
/* 옷 — 몸이 같으니 색만 바꾸면 여덟 종이 다 입습니다. 이게 3D 로 오면서
   생긴 가장 큰 이득입니다(2D 때는 종마다 207장을 따로 잘랐습니다). */
export const OUTFITS = [
  { top: 0x2DD4BF, bottom: 0x3E5C82, shoe: 0xFFFFFF },
  { top: 0xE8695A, bottom: 0x4A4A58, shoe: 0xF6E8D2 },
  { top: 0xF2C14E, bottom: 0x5B84C4, shoe: 0x8E6238 },
  { top: 0x9B7BD4, bottom: 0x3A3F4A, shoe: 0xFFFFFF },
  { top: 0xFFFFFF, bottom: 0xC4553F, shoe: 0x3E4A5A },
  { top: 0x63C47C, bottom: 0x6B4A2A, shoe: 0xF2E4CE },
];

/**
 * 캐릭터 한 명.
 *   species  '거북이' 처럼 SPECIES 의 열쇠
 *   fit      OUTFITS 항목
 *   opt      { scale, ry, wave }  wave 는 한쪽 팔을 드는 각도
 */
export function character(parent, species, fit, opt = {}) {
  const C = SPECIES[species];
  const g = new THREE.Group();
  g.position.set(opt.x || 0, 0, opt.z || 0);
  g.rotation.y = opt.ry || 0;
  g.scale.setScalar(opt.scale || 1);
  parent.add(g);

  const skin = M(C.skin), top = M(fit.top, .62), bot = M(fit.bottom, .62), sho = M(fit.shoe, .5);
  const parts = { legs: [], shins: [], arms: [], head: null, torso: null, neck: null };
  /* ---- 다리 · 신발 ----
     전 판은 반지름 .115 짜리 막대 둘에 큰 신발이 붙어 **이쑤시개 위의 구두**
     로 보였습니다. 굵게(.155) · 짧게(.42) 하고 신발을 다리 폭에 맞춥니다. */
  [-.19, .19].forEach((x) => {
    /* 다리는 **넓적다리 + 정강이** 두 마디입니다. 한 마디로 두면 앉을 때
       다리가 통째로 앞으로 뻗어 의자에 걸터앉은 게 아니라 누운 것이 됩니다.
       이 서비스는 **앉아 있는 시간**을 다루므로 앉은 자세가 제대로 나와야
       합니다. 축은 엉덩이(.48)와 무릎(-.24) 둘. */
    const leg = new THREE.Group();
    leg.position.set(x, .48, 0); g.add(leg); parts.legs.push(leg);
    cyl(leg, .155, .162, .26, 14, bot, 0, -.13, 0);               // 넓적다리
    const shin = new THREE.Group();
    shin.position.set(0, -.24, 0); leg.add(shin); parts.shins.push(shin);
    cyl(shin, .148, .158, .26, 14, bot, 0, -.13, 0);              // 정강이
    const kn = new THREE.Mesh(new THREE.SphereGeometry(.155, 10, 8), bot);
    kn.position.y = 0; kn.castShadow = true; leg.add(kn);         // 무릎
    box(shin, .3, .17, .4, .085, sho, 0, -.29, .05);              // 신발
    box(shin, .31, .06, .42, .03, M(0x3A3F4A, .6), 0, -.35, .05); // 밑창
  });
  /* ---- 몸통 — 위가 좁고 아래가 넓은 통. 옷이 여기 한 겹입니다 ---- */
  const t = new THREE.Mesh(roundedBox(.8, .78, .54, .24), top);
  t.position.y = .92; t.castShadow = true; t.receiveShadow = true; g.add(t);
  parts.torso = t;
  box(g, .84, .13, .58, .05, M(fit.bottom, .6), 0, .56, 0);       // 옷단
  box(g, .5, .1, .5, .04, M(fit.top, .5), 0, 1.3, 0);             // 깃
  /* ---- 팔 — 소매(옷색) + 손(피부색) ---- */
  [-1, 1].forEach((s) => {
    const arm = new THREE.Group();
    arm.position.set(s * .46, 1.16, 0);
    /* 손 흔들기는 **바깥쪽으로** 올려야 합니다. 부호가 반대라 팔이
       가슴을 가로질러 몸통 뒤로 숨었습니다. */
    arm.rotation.z = opt.wave && s > 0 ? 2.15 : s * .30;
    arm.rotation.x = opt.wave && s > 0 ? 0 : -.12;
    g.add(arm); parts.arms.push(arm);
    const a = cyl(arm, .115, .115, .42, 12, top, 0, -.21, 0);
    a.castShadow = true;
    sph(arm, .135, skin, 0, -.48, 0);
  });
  /* ---- 머리 ---- */
  const h = new THREE.Group();
  h.position.y = 1.68;
  h.scale.setScalar(1.14);            // 머리가 작으면 인형이 아니라 사람 모형입니다
  g.add(h);
  parts.neck = cyl(g, .14, .16, .14, 10, skin, 0, 1.34, 0);       // 목
  HEADS[species](h, C);
  h.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
  parts.head = h;

  /* ---- 가방 — 대학생이라는 표시. 등에 한 덩이 ---- */
  if (opt.bag !== false) {
    const bc = opt.bag || 0x4A6EA8;
    box(g, .62, .66, .26, .16, M(bc, .7), 0, .98, -.36);
    box(g, .44, .24, .1, .07, M(bc, .55), 0, .78, -.5);            // 앞주머니
    box(g, .3, .06, .08, .02, M(0xE8C06A, .4), 0, .9, -.51);       // 잠금쇠
    [-1, 1].forEach((s) => box(g, .1, .5, .1, .04, M(bc, .6), s * .3, 1.16, -.16));
  }
  g.userData.parts = parts;
  g.userData.base = { armZ: [parts.arms[0].rotation.z, parts.arms[1].rotation.z] };
  return g;
}

/** 걷기 — 다리 둘과 팔 둘을 엇갈리게 흔들고 몸을 살짝 튕깁니다.
    `sp` 0 이면 선 자세로 부드럽게 돌아옵니다. */
export function stride(g, t, sp) {
  const P = g.userData.parts; if (!P) return;
  const A = Math.min(1, sp) * .62;
  const s = Math.sin(t * 9.2) * A;
  const c = Math.cos(t * 9.2) * A;
  P.legs[0].rotation.x = s;
  P.legs[1].rotation.x = -s;
  P.shins[0].rotation.x = Math.max(0, -s) * .9;
  P.shins[1].rotation.x = Math.max(0, s) * .9;
  const b = g.userData.base.armZ;
  P.arms[0].rotation.x = -s * .8; P.arms[0].rotation.z = b[0];
  P.arms[1].rotation.x =  s * .8; P.arms[1].rotation.z = b[1];
  P.torso.position.y = .92 + Math.abs(c) * .05;
  P.torso.rotation.y = s * .12;
  P.head.position.y = 1.68 + Math.abs(c) * .05;
  P.head.rotation.z = -s * .06;
}

/** 앉기 — 넓적다리를 앞으로, 정강이를 아래로. 의자 높이(.48)에 엉덩이가 옵니다. */
export function sit(g, on) {
  const P = g.userData.parts; if (!P) return;
  const a = on ? -1.46 : 0;
  P.legs.forEach((l, i) => { l.rotation.x = a; l.rotation.z = on ? (i ? .06 : -.06) : 0; });
  P.shins.forEach((s) => { s.rotation.x = on ? 1.42 : 0; });
  P.arms.forEach((r, i) => {
    r.rotation.x = on ? -1.0 : -.12;
    r.rotation.z = on ? (i ? .22 : -.22) : g.userData.base.armZ[i];
  });
  P.torso.position.y = .92; P.torso.rotation.y = 0;
  P.head.position.y = 1.68;
  g.userData.sitting = on;
}

/** 무너지는 정도 0~1 — 이 서비스가 실제로 보여 주려는 그림입니다.
    목이 앞으로 나오고 등이 말리고 어깨가 올라옵니다. */
export function slouch(g, k) {
  const P = g.userData.parts; if (!P) return;
  const t = Math.max(0, Math.min(1, k));
  P.torso.rotation.x = t * .34;
  P.torso.position.y = .92 - t * .07;
  P.head.rotation.x = t * .52;
  P.head.position.z = t * .30;
  P.head.position.y = 1.68 - t * .12;
  if (P.neck) { P.neck.rotation.x = t * .42; P.neck.position.z = t * .13; P.neck.position.y = 1.34 - t * .04; }
  P.arms.forEach((r) => { r.position.y = 1.16 - t * .05; });
}

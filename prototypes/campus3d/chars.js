/* ══════════════════════════════════════════════════════════
   캐릭터 — **사람 몸에 동물 얼굴**.

   전 판의 문제를 하나씩 고칩니다.
     · 몸통이 네모여서 인형이 아니라 블록이었습니다 → 아래가 넓은 달걀꼴
     · 팔이 굵기가 일정한 막대에 공 손이었습니다 → 끝으로 갈수록 가늘고 벙어리장갑
     · 주둥이가 **얼굴에 붙인 반창고** 로 보였습니다(네모 상자) → 둥글게 튀어나오게
     · 눈이 작고 멀어서 표정이 없었습니다 → 크게, 흰자·눈동자·빛 세 겹
     · 여덟 종이 멀리서 다 같아 보였습니다 → 종마다 실루엣을 과장
     · 목이 안 보여서 머리가 몸에 얹힌 공이었습니다 → 목 + 옷깃
   비율은 2.6등신. 실물 비례로 만들면 인형이 아니라 모형이 됩니다.
   ══════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { M, box, cyl, roundedBox } from './parts.js';

const SK = { ink: 0x2E2A2E, white: 0xFFFFFF, blush: 0xF4A2A6, gum: 0xE08A94 };

/* 색 섞기 — 0xRRGGBB 둘을 k 비율로 */
function mix(a, b, k) {
  const ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255;
  const br = b >> 16 & 255, bg = b >> 8 & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * k) << 16)
       | (Math.round(ag + (bg - ag) * k) << 8)
       | Math.round(ab + (bb - ab) * k);
}

/* 타원체 — 이 스타일의 기본 덩어리입니다 */
function ell(p, r, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 16), mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  m.castShadow = true; m.receiveShadow = true; p.add(m); return m;
}
/* 눈 — 흰자 · 눈동자 · 빛. 세 겹이 있어야 살아 있는 눈이 됩니다.
   전 판은 검은 알 하나에 흰 점이라 인형 눈이었습니다. */
function eyes(p, y, z, r, gap, opt = {}) {
  const made = [];
  [-gap, gap].forEach((dx, i) => {
    const s = i ? 1 : -1;
    /* 흰자를 크게 두르고 눈꺼풀 선을 얹었더니 **부리부리한 인상** 이
       됐습니다. 이 스타일은 검은 알 하나에 빛 두 점이면 충분합니다. */
    if (opt.white) ell(p, r * 1.1, M(SK.white, .28), dx, y, z - r * .1, 1, 1.04, .6);
    made.push(ell(p, r, M(SK.ink, .3), dx, y, z, .96, 1.04, .62));
    /* 하이라이트는 **크게 하나** — 개구리 눈이 유일하게 합격한 이유가
       이 큰 빛점이었습니다. 작은 점 두 개는 멀리서 사라집니다. */
    ell(p, r * .40, M(SK.white, .2), dx - s * r * .3, y + r * .3, z + r * .42, 1, 1, .55);
    ell(p, r * .15, M(SK.white, .2), dx + s * r * .32, y - r * .34, z + r * .34, 1, 1, .5);
  });
  /* 눈 덩어리를 기억해 둡니다 — 깜빡임이 이 목록의 y 를 눌러서 만듭니다 */
  p.userData.eyeMeshes = (p.userData.eyeMeshes || []).concat(made);
  return made;
}
/* 볼터치 — 두 뺨. 이게 있어야 얼굴에 온기가 돕니다 */
function cheeks(p, x, y, z, r = .1) {
  [-x, x].forEach((dx) => ell(p, r, M(SK.blush, .78), dx, y, z, 1, .68, .3));
}

/* 주둥이 — 둥글게 튀어나오고, 코와 입선이 붙습니다 */
function muzzle(p, col, y, z, w, h, d, nose) {
  ell(p, .5, M(col, .55), 0, y, z, w, h, d);
  if (nose !== false) {
    ell(p, .062, M(SK.ink, .3), 0, y + h * .34, z + d * .48, 1.35, .9, .8);
    const m = new THREE.Mesh(new THREE.TorusGeometry(.085, .019, 6, 14, Math.PI), M(SK.ink, .35));
    m.position.set(0, y + h * .05, z + d * .46); m.rotation.z = Math.PI; p.add(m);
  }
}
/* 웃는 입 — 반원 하나 */
function smile(p, y, z, r) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, r * .17, 6, 16, Math.PI), M(SK.ink, .35));
  m.position.set(0, y, z); m.rotation.z = Math.PI; p.add(m);
}

/* ══ 머리 여덟 ══
   종을 가르는 것은 **실루엣**입니다. 색만 바꾸면 여덟이 하나로 보입니다. */
const HEADS = {
  거북이(h, C) {
    /* 등딱지를 머리에 씌우니 외계인이었습니다. **딱지는 등에 멥니다**
       (몸 만들 때 가방 대신 얹습니다) — 머리는 얼굴만 합니다. */
    ell(h, .5, M(C.skin), 0, -.01, .02, 1.02, .95, .96);
    /* 얼굴판 — 개구리처럼 아래 얼굴을 밝게. 표정이 여기 모입니다 */
    ell(h, .4, M(C.muzzle, .6), 0, -.1, .17, .95, .8, .62);
    eyes(h, .13, .42, .115, .2);
    smile(h, -.16, .47, .1);
    ell(h, .028, M(SK.ink, .3), -.05, -.03, .5, 1, 1, .5);
    ell(h, .028, M(SK.ink, .3), .05, -.03, .5, 1, 1, .5);
    cheeks(h, .3, -.12, .42);
  },
  기린(h, C) {
    ell(h, .48, M(C.skin), 0, .03, 0, 1, 1.02, .93);
    /* 주둥이 — 작게, 색은 얼굴보다 아주 조금만 밝게 */
    ell(h, .5, M(C.snout, .55), 0, -.17, .3, .5, .38, .42);
    ell(h, .05, M(SK.ink, .3), -.07, -.1, .48, 1, .8, .6);
    ell(h, .05, M(SK.ink, .3), .07, -.1, .48, 1, .8, .6);
    smile(h, -.24, .44, .09);
    eyes(h, .14, .4, .112, .2);
    /* 뿔 — 가는 대에 동그란 끝. 기린의 서명입니다 */
    [-.16, .16].forEach((x) => {
      cyl(h, .034, .042, .26, 8, M(C.snout, .6), x, .56, -.02);
      ell(h, .085, M(C.spot, .5), x, .7, -.02);
    });
    [-.44, .44].forEach((x) => ell(h, .15, M(C.skin), x, .24, -.06, .4, .95, .7));
    [-.47, .47].forEach((x) => ell(h, .08, M(C.snout, .6), x, .24, -.02, .35, .7, .5));
    /* 반점 — 정수리 뒤로만 셋. 얼굴 앞은 깨끗하게 */
    [[.24, .34, -.24], [-.26, .28, -.26], [0, .44, -.3]]
      .forEach(([x, y, z]) => { const m = ell(h, .11, M(C.spot, .62), x, y, z, 1, 1, .3);
        m.lookAt(x * 6, y * 6, z * 6); });
    cheeks(h, .3, -.1, .4);
  },
  알파카(h, C) {
    ell(h, .45, M(C.skin), 0, -.02, 0, .96, 1.0, .93);
    /* 양털 — 이마를 덮지 않습니다. 전 판은 눈까지 내려와 푸들이었습니다.
       정수리에 구름 한 줄 + 턱 옆 솜 두 개면 알파카입니다. */
    [[0, .44, .02, .21], [-.2, .4, .04, .17], [.2, .4, .04, .17],
     [-.33, .3, .0, .14], [.33, .3, .0, .14], [0, .4, -.24, .2],
     [-.2, .34, -.22, .16], [.2, .34, -.22, .16]]
      .forEach(([x, y, z, r]) => ell(h, r, M(C.wool, .92), x, y, z));
    [-.4, .4].forEach((x) => ell(h, .12, M(C.wool, .92), x, -.18, .1, .9, 1, .8));
    /* 귀 — 솜 사이로 잎처럼 */
    [-.3, .3].forEach((x) => { const e = ell(h, .1, M(C.skin), x, .52, -.04, .5, 1.15, .5);
      e.rotation.z = -x * .8; });
    ell(h, .5, M(C.snout, .58), 0, -.16, .28, .4, .32, .38);
    ell(h, .045, M(SK.ink, .3), 0, -.08, .44, 1.3, .7, .6);
    smile(h, -.22, .42, .08);
    eyes(h, .12, .38, .106, .19);
    cheeks(h, .28, -.1, .38);
  },
  햄스터(h, C) {
    /* 볼주머니는 **옆으로 붙이는 공이 아니라** 아래 얼굴의 폭입니다.
       머리 자체를 아래가 넓은 꼴로 빚고, 볼은 얼굴 앞에서만 살짝 부풉니다. */
    ell(h, .48, M(C.skin), 0, .05, 0, 1.0, .92, .93);
    ell(h, .42, M(C.skin), 0, -.14, .05, 1.06, .72, .88);          // 아래 얼굴 폭
    [-.24, .24].forEach((x) => ell(h, .17, M(C.snout, .5), x, -.16, .3, 1, .82, .55));
    ell(h, .05, M(SK.ink, .3), 0, .0, .45, 1.2, .8, .6);
    /* 이 두 개 — 햄스터의 서명 */
    box(h, .05, .07, .03, .012, M(SK.white, .25), -.028, -.14, .43);
    box(h, .05, .07, .03, .012, M(SK.white, .25), .028, -.14, .43);
    smile(h, -.06, .44, .07);
    eyes(h, .15, .4, .105, .19);
    [-.3, .3].forEach((x) => {
      ell(h, .14, M(C.skin), x, .42, -.04, 1, 1, .5);
      ell(h, .09, M(C.inner, .6), x, .42, .0, 1, 1, .4);
    });
    cheeks(h, .33, -.1, .35);
  },
  고슴도치(h, C) {
    ell(h, .46, M(C.skin), 0, -.01, .05, 1, .96, .96);
    /* 가시 — 못이 아니라 **머리칼**입니다. 끝이 둥근 물방울을
       뒤통수에 겹쳐 얹으면 밤송이가 아니라 앞머리가 됩니다. */
    const quill = (x, y, z, r, tilt) => {
      const q = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), M(tilt % 2 ? C.quillDark : C.quill, .8));
      q.position.set(x, y, z); q.scale.set(.56, 1.2, .62);
      q.lookAt(x * 3, y * 3 + .9, z * 3 - 1.4);
      q.castShadow = true; h.add(q);
    };
    let i = 0;
    [[0, .44, -.04, .19], [-.2, .42, -.1, .17], [.2, .42, -.1, .17],
     [-.34, .32, -.2, .15], [.34, .32, -.2, .15], [0, .42, -.26, .18],
     [-.18, .34, -.34, .16], [.18, .34, -.34, .16], [0, .26, -.42, .17],
     [-.3, .18, -.38, .15], [.3, .18, -.38, .15], [0, .06, -.46, .15]]
      .forEach(([x, y, z, r]) => quill(x, y, z, r, i++));
    ell(h, .5, M(C.snout, .55), 0, -.16, .28, .44, .34, .4);
    ell(h, .06, M(SK.ink, .3), 0, -.07, .46, 1.1, .85, .7);
    smile(h, -.24, .42, .08);
    eyes(h, .12, .4, .104, .18);
    [-.34, .34].forEach((x) => ell(h, .09, M(C.skin), x, .3, .1, .6, .9, .5));
    cheeks(h, .28, -.12, .38);
  },
  개구리(h, C) {
    ell(h, .52, M(C.skin), 0, -.06, 0, 1.1, .82, .95);
    /* 튀어나온 눈 — **눈동자가 앞을 봐야** 합니다. 전 판은 눈동자가
       위·뒤에 있어서 앞에서 보면 흰 공 두 개였습니다. */
    [-.27, .27].forEach((x) => {
      ell(h, .22, M(C.skin), x, .3, .02);
      ell(h, .17, M(SK.white, .28), x, .32, .12, 1, 1, .8);
      ell(h, .098, M(SK.ink, .3), x, .3, .21, 1, 1.06, .72);
      ell(h, .036, M(SK.white, .22), x - .035, .35, .27);
      ell(h, .018, M(SK.white, .22), x + .04, .25, .26);
    });
    /* 입 — 얼굴을 가로지르는 얇은 선. 흰 턱판은 마스크로 보였습니다 */
    { const m = new THREE.Mesh(new THREE.TorusGeometry(.3, .028, 6, 22, Math.PI * .78), M(0x3E7A34, .4));
      m.position.set(0, -.03, .34); m.rotation.z = Math.PI * 1.11; h.add(m); }
    ell(h, .2, M(C.belly, .66), 0, -.26, .3, 1.0, .3, .42);
    ell(h, .035, M(0x3E7A34, .4), -.075, .1, .44, 1, 1, .6);
    ell(h, .035, M(0x3E7A34, .4), .075, .1, .44, 1, 1, .6);
    [-.42, .42].forEach((x) => ell(h, .1, M(SK.blush, .74), x, -.12, .26, 1, .7, .34));
  },
  백조(h, C) {
    ell(h, .44, M(C.skin), 0, .04, 0, .98, 1.04, .95);
    /* 부리 — 넓적한 주황 부리 + **까만 밑동**. 이 검은 자국이
       오리와 백조를 가릅니다. */
    ell(h, .17, M(C.beak, .5), 0, -.13, .46, .7, .4, .9);
    ell(h, .14, M(C.beakDark, .5), 0, -.18, .45, .6, .26, .8);
    ell(h, .045, M(SK.ink, .32), 0, -.05, .49, 1.4, .5, .5);
    eyes(h, .1, .4, .1, .17);
    /* 정수리 깃 — 뒤로 눕는 세 장. 백조의 우아함은 이 곡선입니다 */
    [[0, .5, -.06, .12], [-.12, .47, -.14, .1], [.12, .47, -.14, .1]]
      .forEach(([x, y, z, r]) => { const f = ell(h, r, M(C.skin), x, y, z, .6, 1.3, .6);
        f.rotation.x = -.6; });
    cheeks(h, .26, -.08, .38, .08);
  },
  펭귄(h, C) {
    ell(h, .48, M(C.skin), 0, .02, 0, 1, .97, .95);
    /* 흰 얼굴판 **하나**가 눈과 입을 다 감쌉니다 — 조각내면 가면이 됩니다 */
    ell(h, .36, M(C.belly, .5), 0, -.02, .26, 1.06, 1.08, .62);
    eyes(h, .12, .49, .1, .17);
    { const bk = new THREE.Mesh(new THREE.ConeGeometry(.075, .18, 10), M(C.beak, .45));
      bk.position.set(0, .0, .54); bk.rotation.x = Math.PI / 2 - .12; bk.castShadow = true; h.add(bk); }
    smile(h, -.15, .52, .07);
    cheeks(h, .26, -.08, .48);
  },
};

/* 종마다 색. 몸은 전부 같습니다 — 그래서 옷 하나면 여덟이 다 입습니다. */
export const SPECIES = {
  거북이:   { skin: 0x8FD4A0, muzzle: 0xD4F0DA, shell: 0x53A468, shellDark: 0x40855A, belly: 0xF2E2B8 },
  기린:     { skin: 0xF6D9A0, snout: 0xFFEBC6, spot: 0xC98E4E },
  알파카:   { skin: 0xF0E2CC, snout: 0xFFF6E8, wool: 0xFFFBF2 },
  햄스터:   { skin: 0xE8B87A, snout: 0xFFF0DC, inner: 0xF4A2A6 },
  고슴도치: { skin: 0xDDBA92, snout: 0xFFF0DC, quill: 0x9A7450, quillDark: 0x7C5B3C },
  개구리:   { skin: 0x7FC96A, belly: 0xE2F2C8 },
  백조:     { skin: 0xFFFFFF, beak: 0xF2933C, beakDark: 0xD9761F },
  펭귄:     { skin: 0x3E4A5A, belly: 0xFFFFFF, beak: 0xF2933C, beakDark: 0xD9761F },
};
/* 옷 — 몸이 같으니 색만 바꾸면 여덟 종이 다 입습니다.
   2D 때는 종마다 207장을 따로 잘랐습니다. */
/* NPC 용 차림 여덟 — 스타일이 섞여 있어야 거리가 옷가게처럼 보입니다 */
export const OUTFITS = [
  { style: 'hoodie', top: 0x2DD4BF, bottom: 0x3E5C82, shoe: 0xFFFFFF },
  { style: 'tee', top: 0xE8695A, bottom: 0x4A4A58, shoe: 0xF6E8D2 },
  { style: 'shirt', top: 0xF7F3E8, bottom: 0x5B84C4, shoe: 0x8E6238 },
  { style: 'hoodie', top: 0x9B7BD4, bottomId: 'trainers', bottom: 0x3A3F4A, shoe: 0xFFFFFF },
  { style: 'varsity', top: 0xC0392B, bottom: 0x3E465A, shoe: 0x3E4A5A },
  { style: 'tee', top: 0x63C47C, bottomId: 'shorts', bottom: 0x6B4A2A, shoe: 0xF2E4CE },
  { style: 'shirt', top: 0xFFE9F0, bottomId: 'slacks', bottom: 0x4A4038, shoesId: 'dress', shoe: 0x3A332C },
  { style: 'varsity', top: 0x2F5AA8, bottom: 0x30384A, shoe: 0xF2F2F2 },
];

/**
 * 캐릭터 한 명.
 *   species  '거북이' 처럼 SPECIES 의 열쇠
 *   fit      OUTFITS 항목
 *   opt      { x, z, ry, scale, wave, bag }
 */
/* ══ 옷 목록 — 2D 월드의 아이템 표(items.json)와 **같은 id** 를 씁니다.
   그래야 서버 구매(world_buy_item)와 착용(world_set_loadout)이
   두 판에서 하나로 이어집니다. ══ */
export const WEAR = {
  top:     [['tee', '반팔티', 0], ['hoodie', '후드티', 60], ['shirt', '셔츠', 50], ['varsity', '과잠', 90]],
  bottom:  [['jeans', '청바지', 0], ['trainers', '트레이닝', 40], ['slacks', '슬랙스', 50], ['shorts', '반바지', 40]],
  shoes:   [['sneakers', '운동화', 0], ['slippers', '슬리퍼', 30], ['dress', '구두', 60]],
  hat:     [['none', '없음', 0], ['cap', '볼캡', 50], ['beanie', '비니', 50], ['grad_cap', '학사모', 90]],
  glasses: [['none', '없음', 0], ['round', '동그란테', 40], ['horn', '뿔테', 40], ['sunglasses', '선글라스', 60]],
  bag:     [['backpack', '백팩', 0], ['tote', '에코백', 50], ['none', '없음', 0]],
};
export const WEAR_FREE = ['tee', 'jeans', 'sneakers', 'none', 'backpack'];
const PALETTE = [0x2DD4BF, 0xE8695A, 0xF2C14E, 0x9B7BD4, 0xF7F4EC, 0x63C47C, 0x5B84C4, 0x3A4150];

/* 옛 형식({top,bottom,shoe,trim})도 그대로 받습니다 — NPC 들이 씁니다 */
export function normalizeLook(fit) {
  if (fit && fit.topId) return fit;
  return {
    topId: fit?.style || 'tee', top: fit?.top ?? 0x2DD4BF,
    bottomId: fit?.bottomId || 'jeans', bottom: fit?.bottom ?? 0x3E5C82,
    shoesId: fit?.shoesId || 'sneakers', shoes: fit?.shoe ?? 0xF2F2F2,
    hatId: 'none', hat: 0xE8695A,
    glassesId: 'none',
    bagId: fit?.bag === false ? 'none' : 'backpack', bagC: 0x4A6EA8,
    trim: fit?.trim,
  };
}

export function character(parent, species, fit, opt = {}) {
  const C = SPECIES[species];
  const L = normalizeLook(fit);
  const g = new THREE.Group();
  g.position.set(opt.x || 0, 0, opt.z || 0);
  g.rotation.y = opt.ry || 0;
  g.scale.setScalar(opt.scale || 1);
  parent.add(g);

  const skin = M(C.skin);
  const topC = L.top, botC = L.bottom, shoC = L.shoes;
  const top = M(topC, .6), bot = M(botC, .6), sho = M(shoC, .48);
  const trim = M(L.trim ?? mix(topC, 0x000000, .18), .55);
  const parts = { legs: [], shins: [], arms: [], head: null, torso: null, neck: null };
  const shortsOn = L.bottomId === 'shorts';
  const shortSleeve = L.topId === 'tee';
  const varsity = L.topId === 'varsity';
  const vBody = 0xF4EDE0;                       // 과잠 몸판 — 크림
  const bodyTop = varsity ? M(vBody, .6) : top;

  /* ── 다리 ── 짧고 굵게. 신발은 앞코가 나와야 신발로 보입니다. */
  [-.17, .17].forEach((x, li) => {
    const leg = new THREE.Group();
    leg.position.set(x, .44, 0); g.add(leg); parts.legs.push(leg);
    cyl(leg, .145, .15, .22, 14, bot, 0, -.11, 0);
    ell(leg, .148, shortsOn ? skin : bot, 0, -.21, 0, 1, .86, 1);      // 무릎
    if (shortsOn) {                                                     // 반바지단
      const hem2 = new THREE.Mesh(new THREE.TorusGeometry(.145, .026, 6, 14), M(mix(botC, 0x000000, .18), .6));
      hem2.rotation.x = Math.PI / 2; hem2.position.y = -.19; leg.add(hem2);
    }
    const shin = new THREE.Group();
    shin.position.set(0, -.22, 0); leg.add(shin); parts.shins.push(shin);
    cyl(shin, .138, .145, .22, 14, shortsOn ? skin : bot, 0, -.11, 0);
    if (L.bottomId === 'trainers') {                                    // 옆줄
      box(leg, .02, .2, .04, .008, M(0xFFF6E6, .6), (li ? 1 : -1) * .148, -.11, 0);
      box(shin, .02, .2, .04, .008, M(0xFFF6E6, .6), (li ? 1 : -1) * .142, -.11, 0);
    }
    if (L.bottomId === 'jeans') {                                       // 밑단 접기
      const roll = new THREE.Mesh(new THREE.TorusGeometry(.138, .03, 6, 14), M(mix(botC, 0xFFFFFF, .25), .62));
      roll.rotation.x = Math.PI / 2; roll.position.y = -.2; shin.add(roll);
    }
    const sh = new THREE.Group(); sh.position.set(0, -.24, 0); shin.add(sh);
    if (L.shoesId === 'slippers') {
      ell(sh, .15, skin, 0, .02, -.02, 1, .8, 1.3);                     // 맨발
      box(sh, .2, .08, .14, .035, sho, 0, .06, .12);                    // 앞끈
      box(sh, .27, .045, .4, .02, M(mix(shoC, 0x000000, .3), .5), 0, -.08, .05);
    } else if (L.shoesId === 'dress') {
      ell(sh, .145, sho, 0, .0, .05, .94, .7, 1.5);
      ell(sh, .12, sho, 0, .015, -.05, .96, .8, 1);
      box(sh, .24, .04, .4, .02, M(0x2A2622, .45), 0, -.08, .05);
    } else {
      ell(sh, .155, sho, 0, .01, .05, 1, .78, 1.5);                     // 운동화
      ell(sh, .13, sho, 0, .02, -.05, 1.02, .84, 1);
      ell(sh, .1, M(0xFFFFFF, .5), 0, .05, .17, 1.1, .7, .8);           // 앞코
      box(sh, .28, .05, .42, .024, M(0xFFFFFF, .55), 0, -.085, .05);
    }
  });

  /* ── 몸통 ── 옆선 하나를 통째로 돌린 회전체입니다. */
  const lathe = (prof, seg = 26) => {
    const pts = prof.map(([y, r]) => new THREE.Vector2(Math.max(.004, r), y));
    const gm = new THREE.LatheGeometry(pts, seg);
    gm.computeVertexNormals();
    return gm;
  };
  const torso = new THREE.Group();
  torso.position.y = .44; g.add(torso); parts.torso = torso;
  {
    const p = new THREE.Mesh(lathe([[-.02, 0], [0, .30], [.06, .345], [.16, .35], [.22, .335]]), bot);
    p.castShadow = p.receiveShadow = true; p.scale.z = .88; torso.add(p);
    const c = new THREE.Mesh(lathe([
      [.14, .0], [.15, .30], [.17, .375], [.26, .385], [.40, .375], [.52, .35],
      [.62, .315], [.70, .265], [.76, .205], [.80, .16], [.82, .10], [.83, .0],
    ]), bodyTop);
    c.castShadow = c.receiveShadow = true; c.scale.z = .9; torso.add(c);
    const hem = new THREE.Mesh(new THREE.TorusGeometry(.372, .034, 8, 26),
      varsity ? M(topC, .55) : trim);
    hem.rotation.x = Math.PI / 2; hem.position.y = .175; hem.scale.z = .9; torso.add(hem);
    const col = new THREE.Mesh(new THREE.TorusGeometry(.17, .036, 8, 22),
      varsity ? M(topC, .55) : trim);
    col.rotation.x = Math.PI / 2; col.position.y = .795; col.scale.z = .9; torso.add(col);

    if (L.topId === 'hoodie') {
      /* 모자 — 목 뒤에 접힌 후드 + 앞주머니 + 끈 두 가닥 */
      const hood = new THREE.Mesh(new THREE.SphereGeometry(.21, 16, 12, 0, Math.PI * 2, 0, Math.PI * .55), top);
      hood.position.set(0, .78, -.2); hood.rotation.x = -1.25;
      hood.scale.set(1.15, 1, .9); hood.castShadow = true; torso.add(hood);
      box(torso, .3, .17, .1, .05, M(mix(topC, 0x000000, .12), .62), 0, .34, .32);
      [-.05, .05].forEach((dx) => {
        cyl(torso, .012, .012, .12, 6, M(0xFFF6E6, .5), dx, .68, .345);
        ell(torso, .02, M(0xFFF6E6, .5), dx, .61, .35);
      });
    } else if (L.topId === 'shirt') {
      /* 옷깃 두 장 + 단추 세 알 */
      [-1, 1].forEach((t) => {
        const lap = new THREE.Mesh(new THREE.ConeGeometry(.075, .16, 4), M(0xFFFDF6, .55));
        lap.position.set(t * .09, .74, .17); lap.rotation.set(.5, 0, t * 2.4);
        lap.scale.set(1, 1, .4); torso.add(lap);
      });
      [.62, .48, .34].forEach((y) => ell(torso, .018, M(0xF0E6D2, .4), 0, y, .375 - (0.62 - y) * .06, 1, 1, .5));
    } else if (varsity) {
      /* 가슴 완장 — 학교 머리글자 자리 */
      box(torso, .12, .12, .03, .02, M(topC, .5), .15, .58, .345);
    }
  }

  /* ── 팔 ── */
  const sleeveMat = varsity ? M(topC, .6) : top;
  [-1, 1].forEach((sgn) => {
    const arm = new THREE.Group();
    arm.position.set(sgn * .33, 1.08, 0);
    arm.rotation.z = opt.wave && sgn > 0 ? 2.15 : sgn * .22;
    arm.rotation.x = -.08;
    g.add(arm); parts.arms.push(arm);
    ell(arm, .115, varsity ? M(vBody, .6) : bodyTop, 0, -.03, 0, 1, 1, 1);
    if (shortSleeve) {
      cyl(arm, .105, .1, .12, 12, bodyTop, 0, -.1, 0).castShadow = true;
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(.096, .02, 6, 16), trim);
      cuff.rotation.x = Math.PI / 2; cuff.position.y = -.17; arm.add(cuff);
      cyl(arm, .095, .085, .2, 12, skin, 0, -.27, 0).castShadow = true;
    } else {
      cyl(arm, .105, .088, .3, 12, sleeveMat, 0, -.19, 0).castShadow = true;
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(.086, .026, 6, 16),
        varsity ? M(vBody, .55) : trim);
      cuff.rotation.x = Math.PI / 2; arm.add(cuff); cuff.position.y = -.34;
    }
    ell(arm, .105, skin, 0, -.42, .012, 1.02, 1.12, .88);
  });

  /* ── 목 · 머리 ── */
  parts.neck = cyl(g, .14, .175, .16, 14, skin, 0, 1.30, -.005);
  const h = new THREE.Group();
  h.position.y = 1.48;
  h.scale.setScalar(1.0);
  g.add(h);
  HEADS[species](h, C);
  h.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
  parts.head = h;
  parts.eyes = h.userData.eyeMeshes || [];
  parts.eyes.forEach((m) => (m.userData.sy = m.scale.y));

  /* ── 모자 — 종마다 정수리 높이가 달라서 한 표로 맞춥니다 ── */
  const HAT_FIT = { 알파카: [.56, -.02, 1.1], 고슴도치: [.52, -.06, 1.05], 개구리: [.5, -.16, 1.05],
    기린: [.46, -.02, 1.0], 백조: [.5, -.04, .95] };
  if (L.hatId && L.hatId !== 'none') {
    const [hy, hz, hs] = HAT_FIT[species] || [.42, 0, 1];
    const hat = new THREE.Group(); hat.position.set(0, hy, hz); hat.scale.setScalar(hs); h.add(hat);
    const hc = M(L.hat, .6), hcD = M(mix(L.hat, 0x000000, .2), .6);
    if (L.hatId === 'cap') {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(.3, 18, 12, 0, Math.PI * 2, 0, Math.PI * .5), hc);
      dome.scale.set(1.05, .8, 1.05); dome.castShadow = true; hat.add(dome);
      ell(hat, .05, hcD, 0, .23, 0);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(.24, .26, .035, 18, 1, false, -Math.PI / 2, Math.PI), hcD);
      brim.position.set(0, .02, .2); brim.scale.set(1, 1, 1.35); hat.add(brim);
    } else if (L.hatId === 'beanie') {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(.31, 18, 12, 0, Math.PI * 2, 0, Math.PI * .55), hc);
      dome.scale.set(1.04, .95, 1.04); dome.castShadow = true; hat.add(dome);
      const fold = new THREE.Mesh(new THREE.TorusGeometry(.29, .055, 8, 20), hcD);
      fold.rotation.x = Math.PI / 2; fold.position.y = .02; fold.scale.set(1.04, 1.04, 1); hat.add(fold);
      ell(hat, .07, hc, 0, .32, 0);
    } else if (L.hatId === 'grad_cap') {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(.28, 16, 10, 0, Math.PI * 2, 0, Math.PI * .45), M(0x2E3440, .55));
      dome.scale.set(1.05, .7, 1.05); hat.add(dome);
      box(hat, .62, .05, .62, .02, M(0x2E3440, .5), 0, .17, 0).rotation.y = Math.PI / 4;
      cyl(hat, .012, .012, .16, 6, M(0xF2C14E, .5), .26, .1, .26).rotation.z = .3;
      ell(hat, .035, M(0xF2C14E, .5), .3, .02, .3);
      ell(hat, .02, M(0xF2C14E, .5), 0, .2, 0);
    }
  }
  /* ── 안경 — 눈 위치를 그대로 읽어서 겁니다. 종마다 눈이 달라도 맞습니다 ── */
  if (L.glassesId && L.glassesId !== 'none' && parts.eyes.length >= 2) {
    const [e0, e1] = parts.eyes;
    const gz = Math.max(e0.position.z, e1.position.z) + .07;
    const gy = (e0.position.y + e1.position.y) / 2;
    const gx = Math.abs(e0.position.x);
    const fr = M(L.glassesId === 'horn' ? 0x5A4632 : 0x2E3440, .45);
    const gl = new THREE.Group(); gl.position.set(0, gy, gz); h.add(gl);
    [-gx, gx].forEach((dx) => {
      if (L.glassesId === 'sunglasses') {
        ell(gl, .105, M(0x23272E, .3), dx, 0, 0, 1.05, 1.0, .3);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(.105, .016, 6, 16), fr);
        rim.position.x = dx; gl.add(rim);
      } else {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(.105, L.glassesId === 'horn' ? .024 : .015, 6, 16), fr);
        rim.position.x = dx; gl.add(rim);
      }
    });
    box(gl, gx * 2 - .19, .022, .02, .01, fr, 0, .02, 0);
    [-1, 1].forEach((t) => box(gl, .16, .02, .02, .01, fr, t * (gx + .13), .02, -.08).rotation.y = t * .5);
  }

  /* ── 등딱지 — 거북이는 가방 대신 딱지를 멥니다. 종의 서명이
     머리가 아니라 **등**에 있으면 얼굴이 자유로워집니다. */
  if (species === '거북이') {
    const b = new THREE.Group(); b.position.set(0, .95, -.26); g.add(b);
    /* 돔 — 축 방향을 잘못 늘리면 옆으로 누운 부침개가 됩니다.
       회전 뒤 기준으로 세로(z)로 길게, 밖(y→-z)으로는 얕게. */
    const dome = new THREE.Mesh(new THREE.SphereGeometry(.33, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), M(C.shell, .7));
    dome.rotation.x = -Math.PI / 2; dome.scale.set(1.12, .74, 1.5);
    dome.castShadow = true; b.add(dome);
    { const rim = new THREE.Mesh(new THREE.TorusGeometry(.3, .055, 10, 22), M(C.shellDark, .66));
      rim.scale.set(1.16, 1.55, 1); b.add(rim); }
    /* 밝은 줄 하나 — 등딱지의 등뼈 */
    { const spine = new THREE.Mesh(new THREE.TorusGeometry(.3, .028, 8, 14, Math.PI), M(C.shellDark, .6));
      spine.position.z = -.005; spine.rotation.z = Math.PI / 2;
      spine.rotation.y = Math.PI / 2; spine.scale.set(1.5, .76, 1); b.add(spine); }
    [-1, 1].forEach((t) => box(b, .07, .42, .05, .025, M(C.shellDark, .6), t * .22, -.02, .22));
  }
  /* ── 가방 ── */
  else if (opt.bag !== false && L.bagId !== 'none') {
    const bc = (typeof opt.bag === 'number' ? opt.bag : null) ?? L.bagC ?? 0x4A6EA8;
    if (L.bagId === 'tote') {
      const b = new THREE.Group(); g.add(b);
      box(b, .3, .34, .1, .04, M(bc, .66), .42, .62, .02).rotation.z = -.06;
      box(b, .26, .05, .08, .02, M(mix(bc, 0x000000, .18), .6), .42, .8, .02);
      const strap = box(b, .05, .5, .03, .01, M(mix(bc, 0x000000, .18), .6), .3, 1.06, .0);
      strap.rotation.z = .5;
    } else {
      const b = new THREE.Group(); b.position.set(0, .92, -.30); g.add(b);
      const bag = new THREE.Mesh(lathe([[-.24, 0], [-.22, .16], [-.1, .21], [.1, .215], [.2, .19], [.24, .0]], 18),
        M(bc, .68));
      bag.rotation.x = Math.PI / 2; bag.scale.set(1, 1, .55);
      bag.castShadow = true; b.add(bag);
      box(b, .22, .05, .07, .02, M(0xE8C06A, .38), 0, -.04, -.13);
      [-1, 1].forEach((t) => box(b, .075, .42, .08, .03, M(bc, .58), t * .25, .2, .21));
    }
  }

  g.userData.parts = parts;
  g.userData.base = { armZ: [parts.arms[0].rotation.z, parts.arms[1].rotation.z] };
  g.userData.noCollide = true;
  return g;
}

/** 걷기 —
    `t` 는 **걸은 거리를 보폭으로 나눈 값** 입니다(초가 아닙니다). 그래야
    빨리 걸을 때 발이 미끄러지지 않습니다. 뒤로 가는 다리는 무릎을 접고,
    몸은 두 배 빠르기로 튀며, 빠를수록 앞으로 기웁니다. */
export function stride(g, t, sp) {
  const P = g.userData.parts; if (!P) return;
  const k = Math.min(1, sp);
  const A = .34 + k * .38;
  const f = t * Math.PI * 2;
  const s = Math.sin(f) * k, c = Math.cos(f);
  P.legs[0].rotation.x = s * A;
  P.legs[1].rotation.x = -s * A;
  P.shins[0].rotation.x = Math.max(0, -s) * A * 1.6;
  P.shins[1].rotation.x = Math.max(0, s) * A * 1.6;
  const b = g.userData.base.armZ;
  P.arms[0].rotation.x = -s * A * .95;
  P.arms[1].rotation.x = s * A * .95;
  P.arms[0].rotation.z = b[0] * (1 - k * .3);
  P.arms[1].rotation.z = b[1] * (1 - k * .3);
  const bob = Math.abs(c) * .06 * k;
  P.torso.position.y = .44 + bob;
  P.torso.rotation.x = k * .11;
  P.torso.rotation.y = s * .12;
  P.torso.rotation.z = 0;
  P.head.position.y = 1.48 + bob * .8;
  P.head.position.z = 0;
  P.head.rotation.x = -k * .07;
  if (!g.userData.looking) P.head.rotation.y *= .82;
  P.head.rotation.z = -s * .05;
  blink(P, t * 1.4 + (g.userData.seed || 0), g.userData.seed || 0);
  if (P.neck) { P.neck.rotation.x = 0; P.neck.position.z = -.005; P.neck.position.y = 1.30; }
}

/** 서 있기 — 숨 쉬고, 가끔 두리번거립니다.
    가만히 선 인형과 서 있는 사람을 가르는 것은 이 미세한 움직임입니다. */
/** 눈 깜빡임 — 4~7초에 한 번, 0.12초. 이게 없으면 인형입니다. */
function blink(P, t, seed) {
  if (!P.eyes || !P.eyes.length) return;
  const period = 4.6 + (seed % 3) * .9;
  const ph = ((t + seed * 1.7) % period) / period;
  const k = ph > .97 ? 1 - Math.abs(ph - .985) / .015 : 0;
  P.eyes.forEach((m) => { m.scale.y = m.userData.sy * (m.userData.faceSy ?? 1) * (1 - k * .9); });
}
/** 시선 — 머리가 목표를 향해 **조금만** 돕니다. 다 돌면 부엉이가 됩니다.
    ax, ay 는 목표 방향(라디안). 안 주면 천천히 정면으로 돌아옵니다. */
export function look(g, ax, ay, k = .35) {
  const P = g.userData.parts; if (!P) return;
  const cl = (v, m) => Math.max(-m, Math.min(m, v));
  P.head.rotation.y += (cl(ax || 0, .7) - P.head.rotation.y) * k;
  P.head.rotation.x += (cl(ay || 0, .34) - P.head.rotation.x) * k;
}

export function idle(g, t, seed = 0) {
  const P = g.userData.parts; if (!P) return;
  const br = Math.sin(t * 1.5 + seed) * .013;
  P.torso.position.y = .44 + br;
  P.torso.rotation.x = 0; P.torso.rotation.y = 0; P.torso.rotation.z = 0;
  P.head.position.y = 1.48 + br;
  P.head.position.z = 0;
  P.head.rotation.x = Math.sin(t * .7 + seed) * .03;
  P.head.rotation.z = 0;
  /* 두리번 — 시선(look)이 따로 돌 때는 건드리지 않습니다 */
  if (!g.userData.looking) {
    const lk = (t * .125 + seed * .37) % 1;
    P.head.rotation.y += ((lk < .16 ? Math.sin(lk / .16 * Math.PI) * .5 * (seed % 2 ? 1 : -1) : 0)
      - P.head.rotation.y) * .12;
  }
  blink(P, t, seed);
  const b = g.userData.base.armZ;
  P.arms.forEach((a, i) => { a.rotation.x = -.1 + br * 2; a.rotation.z = b[i]; });
  P.legs.forEach((l) => { l.rotation.x = 0; l.rotation.z = 0; });
  P.shins.forEach((s) => { s.rotation.x = 0; });
  if (P.neck) { P.neck.rotation.x = 0; P.neck.position.z = -.005; P.neck.position.y = 1.30; }
}

/** 표정 — 자세 상태 다섯을 눈으로 말합니다(2D 판의 FACE_EYE 그대로).
    good 크게 뜸 · warn 반쯤 감김 · bad 실눈 · recover 웃는 눈 · sleep 감음 */
export function face(g, state) {
  const P = g.userData.parts; if (!P || !P.eyes) return;
  const SY = { good: 1, warn: .55, bad: .2, recover: .3, sleep: .08 };
  const k = SY[state] ?? 1;
  P.eyes.forEach((m) => {
    m.userData.faceSy = k;
    m.scale.y = m.userData.sy * k;
    /* 웃는 눈은 살짝 올라갑니다 — 초승달 느낌 */
    m.position.y = (m.userData.y0 ?? (m.userData.y0 = m.position.y))
      + (state === 'recover' ? .022 : 0);
  });
  g.userData.faceState = state;
}

/** 앉기 — 넓적다리를 앞으로, 정강이를 아래로. 의자 높이(.46)에 엉덩이가 옵니다. */
export function sit(g, on) {
  const P = g.userData.parts; if (!P) return;
  P.legs.forEach((l, i) => { l.rotation.x = on ? -1.48 : 0; l.rotation.z = on ? (i ? .06 : -.06) : 0; });
  P.shins.forEach((s) => { s.rotation.x = on ? 1.42 : 0; });
  P.arms.forEach((r, i) => {
    r.rotation.x = on ? -1.0 : -.1;
    r.rotation.z = on ? (i ? .2 : -.2) : g.userData.base.armZ[i];
  });
  P.torso.position.y = .44; P.torso.rotation.y = 0;
  P.head.position.y = 1.48; P.head.rotation.y = 0;
  g.userData.sitting = on;
}

/** 무너지는 정도 0~1 — 이 서비스가 실제로 보여 주려는 그림입니다.
    목이 앞으로 나오고 등이 말리고 어깨가 올라옵니다. */
export function slouch(g, k) {
  const P = g.userData.parts; if (!P) return;
  const t = Math.max(0, Math.min(1, k));
  P.torso.rotation.x = t * .36;
  P.torso.position.y = .44 - t * .06;
  P.head.rotation.x = t * .54;
  P.head.position.z = t * .32;
  P.head.position.y = 1.48 - t * .12;
  if (P.neck) { P.neck.rotation.x = t * .45; P.neck.position.z = -.005 + t * .13; P.neck.position.y = 1.30 - t * .04; }
  P.arms.forEach((r) => { r.position.y = 1.08 - t * .05; });
}

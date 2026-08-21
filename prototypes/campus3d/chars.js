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
    ell(p, r * .32, M(SK.white, .22), dx - s * r * .3, y + r * .34, z + r * .3, 1, 1, .5);
    ell(p, r * .13, M(SK.white, .22), dx + s * r * .28, y - r * .32, z + r * .26, 1, 1, .5);
  });
  /* 눈 덩어리를 기억해 둡니다 — 깜빡임이 이 목록의 y 를 눌러서 만듭니다 */
  p.userData.eyeMeshes = (p.userData.eyeMeshes || []).concat(made);
  return made;
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
    /* 전 판은 초록 공에 큰 검은 눈이라 **외계인** 으로 읽혔습니다.
       거북이로 읽히게 하는 것은 셋입니다 — 뒤로 솟은 등딱지,
       옆으로 넓적한 머리, 그리고 뺨의 고막 자국. */
    ell(h, .5, M(C.skin), 0, -.02, .02, 1.1, .9, .96);
    /* 등딱지 — 머리 뒤에서 **후드처럼** 솟습니다. 정면에서 머리 위와
       양옆 테두리가 함께 보여야 등딱지로 읽힙니다. */
    /* 돔은 **하나만** 씁니다. 두 개를 겹쳤더니 표면이 서로 뚫고 나와
       뒤에서 보면 찢어진 자국(z-fighting)이 생겼습니다. */
    ell(h, .55, M(C.shell, .74), 0, .06, -.25, 1.1, 1.0, .9);
    /* 딱지 조각 — 타원체를 표면에 얹었더니 잎사귀처럼 **삐죽** 튀어나왔습니다.
       납작한 육각 판을 구면에 붙여야 등딱지 무늬로 읽힙니다. */
    const scute = (x, y, z, r) => {
      const v = new THREE.Vector3(x, y, z).normalize();
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 6), M(C.shellDark, .62));
      m.position.set(v.x * .594, .06 + v.y * .540, -.25 + v.z * .486);
      m.lookAt(v.x * 6, .06 + v.y * 6, -.25 + v.z * 6);
      m.rotateZ(Math.PI / 6); h.add(m); return m;
    };
    /* 정수리 정중앙 조각은 뺐습니다 — 옆에서 보면 판의 옆면이 실루엣 위로
       가느다랗게 삐져나와 머리에 금이 간 것처럼 보였습니다. */
    /* 앞에서도 한두 조각은 보여야 합니다 — 정수리 앞쪽에 셋을 더 둡니다 */
    [[0, .86, .52, .15], [-.56, .74, .42, .13], [.56, .74, .42, .13],
     [-.7, .66, -.1, .15], [.7, .66, -.1, .15], [-.98, .1, 0, .15], [.98, .1, 0, .15],
     [0, .34, -1, .15], [-.66, .5, -.8, .15], [.66, .5, -.8, .15], [0, -.3, -1, .15]]
      .forEach(([x, y, z, r]) => scute(x, y, z, r));
    /* 부리 — 노란 판을 겹쳤더니 **뻐드렁니** 였습니다. 얼굴색 그대로
       살짝 내밀고, 가장자리에만 얇은 각질선을 둡니다. */
    ell(h, .23, M(C.muzzle, .5), 0, -.16, .36, 1.05, .62, .78);
    { const b = new THREE.Mesh(new THREE.TorusGeometry(.115, .022, 6, 18, Math.PI * .9), M(C.beakDark, .4));
      b.position.set(0, -.13, .52); b.rotation.z = Math.PI * 1.05; h.add(b); }
    { const m = new THREE.Mesh(new THREE.TorusGeometry(.1, .019, 6, 16, Math.PI * .8), M(SK.ink, .35));
      m.position.set(0, -.14, .53); m.rotation.z = Math.PI * 1.1; h.add(m); }
    ell(h, .028, M(SK.ink, .3), -.05, -.02, .49, 1, 1, .5);
    ell(h, .028, M(SK.ink, .3), .05, -.02, .49, 1, 1, .5);
    /* 눈 — 흰자를 둘러야 검은 알이 **외계인 눈** 으로 보이지 않습니다 */
    eyes(h, .16, .43, .112, .195, { white: 1 });
    /* 고막 자국 — 거북이 뺨에 있는 둥근 판. 종을 알아보게 하는 작은 단서 */
    [-.44, .44].forEach((x) => {
      ell(h, .115, M(C.skin), x, -.02, .06, .68, 1.05, .8);
      ell(h, .07, M(C.shellDark, .6), x * 1.04, -.02, .1, .5, .95, .7);
    });
  },
  기린(h, C) {
    ell(h, .48, M(C.skin), 0, .03, 0, 1, 1.04, .92);
    muzzle(h, C.snout, -.19, .33, .66, .5, .5);
    eyes(h, .17, .38, .108, .2);
    /* 뿔 둘 — 기린의 전부. 길고 확실하게 */
    [-.18, .18].forEach((x) => {
      cyl(h, .052, .075, .3, 8, M(C.skin), x, .58, -.02);
      ell(h, .1, M(C.spot, .55), x, .74, -.02);
    });
    [-.45, .45].forEach((x) => ell(h, .18, M(C.skin), x, .26, -.06, .42, 1.05, .78));
    /* 반점 — 머리 뒤로 흘러내립니다 */
    [[.31, .2, .16], [-.28, .3, .1], [.14, -.04, -.42], [-.2, -.1, -.38], [0, .42, -.28]]
      .forEach(([x, y, z]) => { const m = ell(h, .13, M(C.spot, .68), x, y, z, 1, 1, .32);
        m.lookAt(x * 5, y * 5, z * 5); });
  },
  알파카(h, C) {
    ell(h, .45, M(C.skin), 0, 0, 0, 1, 1.02, .93);
    muzzle(h, C.snout, -.2, .32, .62, .46, .48);
    eyes(h, .14, .37, .104, .19);
    /* 앞머리 곱슬 — 알파카의 정체성. 눈 위로 덮습니다 */
    [[0, .5, .1, .28], [-.24, .44, .14, .22], [.24, .44, .14, .22],
     [0, .46, -.2, .22], [-.16, .56, -.06, .18], [.16, .56, -.06, .18]]
      .forEach(([x, y, z, r]) => ell(h, r, M(C.wool, .92), x, y, z));
    [-.4, .4].forEach((x) => ell(h, .13, M(C.skin), x, .3, -.02, .5, 1.25, .66));
  },
  햄스터(h, C) {
    ell(h, .5, M(C.skin), 0, 0, 0, 1.06, .94, .95);
    muzzle(h, C.snout, -.13, .38, .5, .32, .34);
    eyes(h, .11, .42, .112, .18);
    [-.34, .34].forEach((x) => {
      ell(h, .19, M(C.skin), x, .4, -.02, 1, 1, .42);
      ell(h, .13, M(C.inner, .65), x, .4, .04, 1, 1, .34);
    });
    /* 볼주머니 — 햄스터는 볼이 커야 햄스터입니다 */
    [-.42, .42].forEach((x) => ell(h, .23, M(C.skin), x, -.13, .16, 1, .84, .8));
    [-.44, .44].forEach((x) => ell(h, .12, M(SK.blush, .75), x, -.16, .3, 1, .78, .34));
  },
  고슴도치(h, C) {
    ell(h, .45, M(C.skin), 0, -.02, .04, 1, .96, .98);
    muzzle(h, C.snout, -.14, .38, .46, .3, .34);
    eyes(h, .11, .41, .104, .172);
    /* 가시 — 뒤통수를 덮는 두 겹. 한 겹이면 머리에 꽂은 못으로 보입니다 */
    for (let ring = 0; ring < 2; ring++)
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + ring * .35, r = .3 + ring * .1;
        const c = new THREE.Mesh(new THREE.ConeGeometry(.085 - ring * .012, .34 + ring * .06, 6),
          M(ring ? C.quillDark : C.quill, .78));
        c.position.set(Math.cos(a) * r * .86, .2 + ring * .16 + Math.sin(a) * .16, -.2 + Math.sin(a) * r * .34);
        c.rotation.set(-.55 + Math.sin(a) * .3, 0, -Math.cos(a) * .55);
        c.castShadow = true; h.add(c);
      }
    [-.33, .33].forEach((x) => ell(h, .11, M(C.skin), x, .2, .06, .62, 1.05, .48));
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
    ell(h, .44, M(C.skin), 0, .03, 0, 1, 1.04, .95);
    /* 주황 부리 — 위아래 두 쪽 */
    ell(h, .19, M(C.beak, .5), 0, -.14, .42, .62, .46, 1.5);
    ell(h, .16, M(C.beakDark, .5), 0, -.2, .4, .56, .3, 1.35);
    ell(h, .09, M(SK.ink, .35), 0, -.06, .3, .9, .7, .5);
    eyes(h, .15, .37, .104, .168);
    [[-.11, .46, -.12], [.11, .46, -.12], [0, .53, -.18], [0, .4, -.24]]
      .forEach(([x, y, z]) => ell(h, .11, M(C.skin), x, y, z, .68, 1.25, .68));
  },
  펭귄(h, C) {
    ell(h, .5, M(C.skin), 0, 0, 0, 1, .99, .95);
    ell(h, .43, M(C.belly, .58), 0, -.08, .18, .95, 1.0, .62);
    ell(h, .21, M(C.beak, .5), 0, -.16, .44, .62, .44, 1.35);
    ell(h, .18, M(C.beakDark || 0xD9761F, .5), 0, -.22, .43, .56, .26, 1.2);
    eyes(h, .12, .44, .104, .17);
    [-.36, .36].forEach((x) => ell(h, .11, M(C.skin), x, .16, -.06, .55, 1.05, .58));
    [-.4, .4].forEach((x) => ell(h, .1, M(SK.blush, .78), x, -.12, .3, 1, .7, .3));
  },
};

/* 종마다 색. 몸은 전부 같습니다 — 그래서 옷 하나면 여덟이 다 입습니다. */
export const SPECIES = {
  거북이:   { skin: 0x86CE92, muzzle: 0xA8DCAE, shell: 0x4E9E63, shellDark: 0x3E8A52, beak: 0xF2D08A, beakDark: 0xE0B45C },
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
export const OUTFITS = [
  { top: 0x2DD4BF, bottom: 0x3E5C82, shoe: 0xFFFFFF, trim: 0x1FA898 },
  { top: 0xE8695A, bottom: 0x4A4A58, shoe: 0xF6E8D2, trim: 0xC44E42 },
  { top: 0xF2C14E, bottom: 0x5B84C4, shoe: 0x8E6238, trim: 0xD1A233 },
  { top: 0x9B7BD4, bottom: 0x3A3F4A, shoe: 0xFFFFFF, trim: 0x7B5CB8 },
  { top: 0xFFFFFF, bottom: 0xC4553F, shoe: 0x3E4A5A, trim: 0xE6E0D4 },
  { top: 0x63C47C, bottom: 0x6B4A2A, shoe: 0xF2E4CE, trim: 0x46A160 },
];

/**
 * 캐릭터 한 명.
 *   species  '거북이' 처럼 SPECIES 의 열쇠
 *   fit      OUTFITS 항목
 *   opt      { x, z, ry, scale, wave, bag }
 */
export function character(parent, species, fit, opt = {}) {
  const C = SPECIES[species];
  const g = new THREE.Group();
  g.position.set(opt.x || 0, 0, opt.z || 0);
  g.rotation.y = opt.ry || 0;
  g.scale.setScalar(opt.scale || 1);
  parent.add(g);

  const skin = M(C.skin), top = M(fit.top, .6), bot = M(fit.bottom, .6),
        sho = M(fit.shoe, .48), trim = M(fit.trim || fit.bottom, .55);
  const parts = { legs: [], shins: [], arms: [], head: null, torso: null, neck: null };

  /* ── 다리 ── 짧고 굵게. 신발은 앞코가 나와야 신발로 보입니다. */
  [-.17, .17].forEach((x) => {
    const leg = new THREE.Group();
    leg.position.set(x, .44, 0); g.add(leg); parts.legs.push(leg);
    cyl(leg, .145, .15, .22, 14, bot, 0, -.11, 0);
    ell(leg, .148, bot, 0, -.21, 0, 1, .86, 1);                   // 무릎
    const shin = new THREE.Group();
    shin.position.set(0, -.22, 0); leg.add(shin); parts.shins.push(shin);
    cyl(shin, .138, .145, .22, 14, bot, 0, -.11, 0);
    const sh = new THREE.Group(); sh.position.set(0, -.24, 0); shin.add(sh);
    ell(sh, .155, sho, 0, .01, .05, 1, .78, 1.5);                 // 발등 + 앞코 한 덩이
    ell(sh, .13, sho, 0, .02, -.05, 1.02, .84, 1);                // 뒤꿈치
    box(sh, .28, .05, .42, .024, M(0x33383F, .55), 0, -.085, .05); // 밑창
  });

  /* ── 몸통 ──
     전 판은 **둥근 상자에 띠를 두른 것** 이라 종이 상자로 보였습니다.
     여기서는 옆선을 하나 그려서 통째로 돌립니다(회전체). 엉덩이가 넓고
     어깨로 갈수록 좁아지는 한 덩이 실루엣이 나와야 인형이 됩니다. */
  const lathe = (prof, seg = 26) => {
    const pts = prof.map(([y, r]) => new THREE.Vector2(Math.max(.004, r), y));
    const gm = new THREE.LatheGeometry(pts, seg);
    gm.computeVertexNormals();
    return gm;
  };
  const torso = new THREE.Group();
  torso.position.y = .44; g.add(torso); parts.torso = torso;
  {
    /* 바지 — 엉덩이 */
    const p = new THREE.Mesh(lathe([[-.02, 0], [0, .30], [.06, .345], [.16, .35], [.22, .335]]), bot);
    p.castShadow = p.receiveShadow = true; p.scale.z = .88; torso.add(p);
    /* 윗옷 — 바지 위로 겹쳐 내려와 옷단이 생깁니다 */
    const c = new THREE.Mesh(lathe([
      [.14, .0], [.15, .30], [.17, .375], [.26, .385], [.40, .375], [.52, .35],
      [.62, .315], [.70, .265], [.76, .205], [.80, .16], [.82, .10], [.83, .0],
    ]), top);
    c.castShadow = c.receiveShadow = true; c.scale.z = .9; torso.add(c);
    /* 옷단 · 옷깃 — 두 줄만. 띠를 여러 개 두르면 다시 상자가 됩니다 */
    const hem = new THREE.Mesh(new THREE.TorusGeometry(.372, .034, 8, 26), trim);
    hem.rotation.x = Math.PI / 2; hem.position.y = .175; hem.scale.z = .9; torso.add(hem);
    const col = new THREE.Mesh(new THREE.TorusGeometry(.17, .036, 8, 22), trim);
    col.rotation.x = Math.PI / 2; col.position.y = .795; col.scale.z = .9; torso.add(col);
  }

  /* ── 팔 ── 어깨에서 짧게. 손은 소매에 붙어 있어야 합니다. */
  [-1, 1].forEach((s) => {
    const arm = new THREE.Group();
    arm.position.set(s * .33, 1.08, 0);
    arm.rotation.z = opt.wave && s > 0 ? 2.15 : s * .22;
    arm.rotation.x = -.08;
    g.add(arm); parts.arms.push(arm);
    ell(arm, .115, top, 0, -.03, 0, 1, 1, 1);                     // 어깨
    cyl(arm, .105, .088, .3, 12, top, 0, -.19, 0).castShadow = true;
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(.086, .026, 6, 16), trim);
    cuff.rotation.x = Math.PI / 2; arm.add(cuff); cuff.position.y = -.34;
    ell(arm, .105, skin, 0, -.42, .012, 1.02, 1.12, .88);         // 벙어리장갑
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

  /* ── 가방 ── */
  if (opt.bag !== false) {
    const bc = opt.bag || 0x4A6EA8;
    const b = new THREE.Group(); b.position.set(0, .92, -.30); g.add(b);
    const bag = new THREE.Mesh(lathe([[-.24, 0], [-.22, .16], [-.1, .21], [.1, .215], [.2, .19], [.24, .0]], 18),
      M(bc, .68));
    bag.rotation.x = Math.PI / 2; bag.scale.set(1, 1, .55);
    bag.castShadow = true; b.add(bag);
    box(b, .22, .05, .07, .02, M(0xE8C06A, .38), 0, -.04, -.13);
    [-1, 1].forEach((t) => box(b, .075, .42, .08, .03, M(bc, .58), t * .25, .2, .21));
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
  P.eyes.forEach((m) => { m.scale.y = m.userData.sy * (1 - k * .9); });
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

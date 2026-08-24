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
import { M, roundedBox } from './parts.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

const SK = { ink: 0x2E2A2E, white: 0xFFFFFF, blush: 0xF4A2A6, gum: 0xE08A94 };

/* 픽셀 스프라이트를 **쓰지 않습니다.**

   랜딩에는 그림이 두 벌 있습니다 — 픽셀 시트(char-*.png)와 클레이
   렌더(char-*-3d.webp). 월드의 어휘는 클레이라 픽셀이 들어오면
   그 캐릭터만 다른 세계에서 온 것이 됩니다.

   클레이 렌더를 그대로 붙이는 길도 막혀 있습니다: 넷(개구리·기린·
   펭귄·거북이)뿐이고, 그마저 **앉아서 책을 보는** 포즈에 배경과
   그림자가 구워져 있습니다. 걷고 앉고 감정표현을 하는 캐릭터의
   재료가 아닙니다.

   그래서 클레이 렌더는 **기준**으로 쓰고, 월드에는 같은 재질로 빚은
   3D 판본을 세웁니다. 아래 HEAD_S · 눈 반광 · 볼 크기가 그 렌더를
   옆에 놓고 맞춘 값입니다.

   spriteChar 는 지우지 않고 둡니다 — 픽셀 판 월드를 다시 볼 일이
   생기면 이 한 줄만 true 로 바꿉니다. */
export const SPRITE_ON = false;

/* ══ 맨몸 ══
   랜딩 렌더의 캐릭터는 **옷을 입지 않았습니다.** 털/깃/딱지 그대로인
   덩어리 하나이고, 얼굴에는 검은 점 두 개뿐입니다. 볼터치도 없습니다.

   여기서 옷을 입히고 눈을 키우고 볼을 찍는 것은 "우리식 해석" 인데,
   옮겨야 하는 것은 해석이 아니라 그 그림입니다. 셋 다 끕니다.

   옷 자체를 지우지는 않습니다 — 옷장·염색·상점이 전부 이 구조에
   매달려 있어서, 지우면 그쪽이 통째로 무너집니다. 대신 **살색으로
   덮고** 모자·안경·가방을 끕니다. 형태는 남되 옷으로 안 보입니다. */
export const BARE = true;

/* ══ 비례 ══
   랜딩 3D 에셋과 나란히 놓고 맞췄습니다.

   그쪽 캐릭터는 **머리가 전체의 절반**에 가깝고 팔다리가 뭉툭합니다.
   우리 쪽은 머리가 44% 라 사람에 가까웠고, 그래서 같은 종인데도
   랜딩의 것이 "우리 캐릭터", 월드의 것이 "사람 인형" 으로 갈렸습니다.

   머리 배율만 올리면 목이 늘어나 보이므로 기준 높이를 같이 내립니다.
   HEAD_Y 는 걷기 · 쉬기 · 앉기 · 타기가 모두 쓰는 값이라 상수로
   묶었습니다 — 전에는 여덟 군데에 1.48 이 흩어져 있어서 한 군데만
   고치면 걸을 때와 앉을 때 머리 높이가 달라졌습니다. */
/* 1.17 은 컸습니다 — 몸이 머리에 매달린 것처럼 보였습니다.
   랜딩 렌더는 앉은 자세라 머리 비중이 더 커 보이는 것이고, 선 자세
   기준으로 재면 1.08 이 그 체감입니다. */
/* 몸통 꼭대기가 TORSO_Y + .78 = 1.05 입니다. 머리 반지름이 .44 이므로
   중심을 1.20 에 두면 아래쪽 .32 가 몸에 파묻혀 이음매가 사라집니다. */
export const HEAD_Y = 1.20;
/* 1.17 → 1.08 → 1.0. 키울수록 랜딩과 **멀어졌습니다** — 저쪽은 머리가
   크긴 해도 과장돼 있지 않고, 몸이 작아서 커 보이는 쪽입니다. */
export const HEAD_S = 1.06;

/* ══ 몸 비례 ══
   서 있는 렌더 넷(거북이·기린·펭귄·햄스터)을 재 보면 이렇습니다.

     머리   위에서 45%
     몸통   가운데 40%
     다리   아래 15% — 사실상 발만 보입니다

   우리 것은 다리가 23%, 머리가 33% 라 **사람 비례**였습니다. 그래서
   같은 얼굴을 붙여도 저쪽은 인형, 우리 쪽은 작은 사람으로 보였습니다.

   고치는 곳은 머리가 아니라 **아래쪽**입니다. 머리를 키우면 가분수가
   되지만, 다리를 줄이고 몸통을 내리면 같은 머리가 저절로 커 보입니다 —
   렌더의 머리가 큰 것도 머리를 키워서가 아니라 몸이 작아서입니다.

   몸통 폭도 줄입니다. 저쪽 몸은 머리보다 확실히 좁아 물방울로 떨어지는데,
   우리 것은 어깨가 머리만큼 넓어 사람 실루엣이 났습니다. */
export const LEG_Y = .27;      // 다리 뿌리 = 다리 전체 길이
export const TORSO_Y = .27;    // 몸통 바닥
const TORSO_W = .90;           // 몸통 가로 배율 — 머리보다 좁게
const NECK_Y = 1.10;

/* ── 멀리 있는 사람 (character 의 opt.lod) ──
   아래 접기(fold)가 **그리는 횟수**를 줄입니다. 면 수는 그대로입니다.
   광장 건너편에 점처럼 서 있는 사람까지 공 하나를 삼백 면으로 빚을
   이유는 없어서, opt.lod 를 주면 **면만** 성깁니다. 조각 구성도 실루엣도
   그대로고 뼈대·parts·wear·염색·동작 전부가 똑같이 돕니다 — 가까워지면
   lod 없이 다시 세워 바꿔 끼우기만 하면 됩니다.

   LOD 를 파일 단위 변수로 두는 것은 ell() · HEADS 처럼 모듈 바닥에 있는
   함수들이 opt 를 못 보기 때문입니다. 짓는 동안에는 다른 일이 끼어들지
   않으므로(전부 동기) 안전하고, character() 가 반드시 0 으로 되돌립니다. */
let LOD = 0;
const S = (n, lo = 4) => (LOD ? Math.max(lo, Math.round(n * .55)) : n);

/* ── 형상 곳간 ──
   같은 모양은 **한 번만 빚습니다.** 공 하나가 660 면이고 한 사람이 그런 공을
   서른 개쯤 씁니다. 아홉 명이 서면 같은 크기의 공을 아홉 번 빚어 아홉 벌을
   그래픽카드에 올리는데, 크기가 같으면 그 아홉이 완전히 같은 숫자 묶음입니다.
   열쇠에 LOD 를 섞는 것은 성긴 공과 촘촘한 공이 같은 반지름을 갖기 때문입니다.
   여기 담긴 것은 여러 사람이 같이 보고 있으므로 **아무도 버리면 안 됩니다.**
   접기가 원본을 지울 때 dispose 를 안 부르는 이유가 이것입니다(어차피 굽는
   시점에는 아직 한 번도 안 그려서 그래픽카드에 올라간 것도 없습니다).
   탈것의 kit() 이 예전부터 쓰던 방법과 같습니다. */
const RAW = new Map();
function cached(tag, args, make) {
  const k = tag + args.join(',');
  let g = RAW.get(k);
  if (!g) RAW.set(k, g = make());
  return g;
}
const sphG = (...a) => cached('S', a, () => new THREE.SphereGeometry(...a));
const torG = (...a) => cached('T', a, () => new THREE.TorusGeometry(...a));
const conG = (...a) => cached('C', a, () => new THREE.ConeGeometry(...a));
const cylG = (...a) => cached('Y', a, () => new THREE.CylinderGeometry(...a));
const boxG = (w, h, d, r) => cached('B', [w, h, d, r, LOD], () => roundedBox(w, h, d, r, LOD ? 2 : 4));
const latheG = (pts, seg) => cached('L', [seg].concat(pts.map((v) => v.x + ':' + v.y)),
  () => { const g = new THREE.LatheGeometry(pts, seg); g.computeVertexNormals(); return g; });

/* box · cyl 은 parts.js 것과 하는 일이 같습니다. 여기 따로 두는 것은 위의
   곳간과 LOD 를 지나가게 하기 위해서입니다 — 이름을 그대로 두면 부르는
   스무 곳을 손대지 않아도 됩니다. 탈것은 character() 밖에서 지으므로 LOD 가
   0 이라 여기를 지나가도 예전 그대로 나옵니다. */
function box(p, w, h, d, r, mat, x, y, z) {
  const m = new THREE.Mesh(boxG(w, h, d, r), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  p.add(m); return m;
}
function cyl(p, rt, rb, h, sg, mat, x, y, z) {
  const m = new THREE.Mesh(cylG(rt, rb, h, S(sg, 6)), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  p.add(m); return m;
}

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
  const m = new THREE.Mesh(sphG(r, S(22, 10), S(16, 7)), mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  m.castShadow = true; m.receiveShadow = true; p.add(m); return m;
}
/* 기린 반점을 눕힐 때 쓰는 자리. 아래 HEADS.기린 설명 참고. */
const _look = new THREE.Matrix4(), _lv = new THREE.Vector3(), _lp = new THREE.Vector3();
const UP0 = new THREE.Vector3(0, 1, 0);

/* 눈 — 흰자 · 눈동자 · 빛. 세 겹이 있어야 살아 있는 눈이 됩니다.
   전 판은 검은 알 하나에 흰 점이라 인형 눈이었습니다. */
function eyes(p, y, z, r, gap, opt = {}) {
  const made = [];
  [-gap, gap].forEach((dx, i) => {
    const s = i ? 1 : -1;
    /* 흰자를 크게 두르고 눈꺼풀 선을 얹었더니 **부리부리한 인상** 이
       됐습니다. 이 스타일은 검은 알 하나에 빛 두 점이면 충분합니다. */
    if (opt.white && !BARE) ell(p, r * 1.1, M(SK.white, .28), dx, y, z - r * .1, 1, 1.04, .6);
    /* 거칠기 .3 → .12. 랜딩 에셋의 눈은 **젖은 유리알**이라, 이 반짝임이
       얼굴에서 유일하게 매끄러운 곳입니다. 나머지가 전부 무광 클레이라
       여기만 반들거려도 재질이 갈라지지 않습니다 — 오히려 그 대비가
       눈을 얼굴의 주인공으로 만듭니다. */
    /* 1.1 배 + metalness 를 되돌립니다. 키운 검은 알에 금속성까지 주니
       환경광이 비쳐 **튀어나온 젖은 눈**이 됐습니다 — 랜딩 에셋의 눈은
       크기가 아니라 **빛점 하나**가 만드는 반짝임입니다. 알은 원래
       크기로, 광택은 거칠기만 낮춰서(무광 .3 → 반광 .18) 냅니다. */
    /* 랜딩 렌더의 눈은 **검은 점**입니다. 크고 반들거리는 눈알은 다른
       그림의 문법이라, 배율을 .62 로 되돌리고 반광도 낮춥니다. */
    made.push(ell(p, r * .62, M(SK.ink, .34), dx, y, z, .98, 1.0, .6));
    /* 하이라이트는 **크게 하나** — 개구리 눈이 유일하게 합격한 이유가
       이 큰 빛점이었습니다. 작은 점 두 개는 멀리서 사라집니다. */
    /* 빛점 하나만, 아주 작게. 둘이면 만화 눈이 됩니다. */
    ell(p, r * .13, M(SK.white, .3), dx - s * r * .17, y + r * .18, z + r * .3, 1, 1, .5);
  });
  /* 눈 덩어리를 기억해 둡니다 — 깜빡임이 이 목록의 y 를 눌러서 만듭니다 */
  p.userData.eyeMeshes = (p.userData.eyeMeshes || []).concat(made);
  return made;
}
/* 볼터치 — 두 뺨. 이게 있어야 얼굴에 온기가 돕니다 */
function cheeks(p, x, y, z, r = .1) {
  /* 랜딩 렌더에는 볼터치가 없습니다. 분홍 점 둘이 얼굴을 캐릭터
     상품으로 만드는데, 옮기려는 그림은 그쪽이 아닙니다. */
  if (BARE) return;
  /* 랜딩 쪽 볼은 더 큽니다 — 얼굴 반지름의 4분의 1쯤 되는 분홍 타원.
     작으면 점으로 보이고, 점은 멀리서 사라집니다. */
  /* 1.22 배도 과했습니다 — 큰 볼이 큰 눈과 붙으니 얼굴이 밀집돼
     보였습니다. 랜딩 쪽 볼은 크기보다 **자리**가 낮습니다. 살짝만 키우고
     원래 톤으로. */
  [-x, x].forEach((dx) => ell(p, r * 1.08, M(SK.blush, .8), dx, y, z, 1, .68, .3));
}

/* 주둥이 — 둥글게 튀어나오고, 코와 입선이 붙습니다 */
function muzzle(p, col, y, z, w, h, d, nose) {
  ell(p, .5, M(col, .55), 0, y, z, w, h, d);
  if (nose !== false) {
    ell(p, .062, M(SK.ink, .3), 0, y + h * .34, z + d * .48, 1.35, .9, .8);
    const m = new THREE.Mesh(torG(.085, .019, S(6), S(14, 8), Math.PI), M(SK.ink, .35));
    m.position.set(0, y + h * .05, z + d * .46); m.rotation.z = Math.PI; p.add(m);
  }
}
/* 웃는 입 — 반원 하나 */
function smile(p, y, z, r) {
  const m = new THREE.Mesh(torG(r, r * .17, S(6), S(16, 8), Math.PI), M(SK.ink, .35));
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
    /* 반점 — 정수리 뒤로만 셋. 얼굴 앞은 깨끗하게.
       눕히는 방향을 **머리 기준**으로 잡습니다. 전에는 lookAt 을 그대로 썼는데
       그것은 세계 좌표를 보기 때문에, ell() 이 이미 머리에 붙여 놓은 뒤라
       사람이 어디에 어느 쪽을 보고 얼마만 한 크기로 서 있느냐에 따라 반점이
       조금씩 다르게 누웠습니다. 원점에 한 명 세워 놓고 맞춘 값이라 그때는
       안 보였습니다. 아래 셈은 원점에 선 기린이 갖던 각 그대로고, 이제
       광장 건너편에 서도 같은 얼굴입니다(굽은 머리를 여럿이 나눠 쓸 수 있는
       것도 이 각이 자리에 안 흔들리기 때문입니다). */
    [[.24, .34, -.24], [-.26, .28, -.26], [0, .44, -.3]]
      .forEach(([x, y, z]) => { const m = ell(h, .11, M(C.spot, .62), x, y, z, 1, 1, .3);
        _look.lookAt(_lv.set(x * 6, y * 6, z * 6), _lp.set(x, y + h.position.y, z), UP0);
        m.quaternion.setFromRotationMatrix(_look); });
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
      const q = new THREE.Mesh(sphG(r, S(12, 7), S(10, 6)), M(tilt % 2 ? C.quillDark : C.quill, .8));
      q.position.set(x, y, z); q.scale.set(.56, 1.2, .62);
      /* 이쪽은 머리에 붙이기 **전**이라 lookAt 이 이미 머리 기준입니다 */
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
    { const m = new THREE.Mesh(torG(.3, .028, S(6), S(22, 12), Math.PI * .78), M(0x3E7A34, .4));
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
    { const bk = new THREE.Mesh(conG(.075, .18, S(10, 6)), M(C.beak, .45));
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
 *   opt      { x, z, ry, scale, wave, bag, lod }
 *
 *   opt.lod  0(기본) 온전한 사람 · 1 면만 성긴 사람.
 *            먼 데 서 있는 NPC 용입니다. 조각 구성 · 뼈대 · parts · wear ·
 *            염색 · stride/idle/sit/slouch/look/blink/face/rideOn 이 전부
 *            그대로라, 부르는 쪽은 가까워지면 lod 없이 한 명 더 세워
 *            바꿔 끼우기만 하면 됩니다(둘을 섞어 쓸 일은 없습니다).
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

/* ══ 옷 염색 여덟 ══
   2D 월드의 표 그대로입니다. **여덟뿐인 이유** 가 이 표의 알맹이입니다.
   이 여덟은 여덟 종 털 위에서 전부 옷으로 읽히는 색입니다. 흰색은
   백조·알파카에서, 검정은 펭귄에서, 밝은 초록은 거북이·개구리에서,
   주황은 기린에서 몸과 붙어 버립니다. 그래서 명도를 30~55% 로 모으고
   채도를 낮췄습니다 — 학교 색을 다루는 규칙과 같습니다. 무지개를
   늘어놓으면 고르는 재미보다 어느 게 옷인지 모르는 일이 먼저 옵니다.

   hex 는 **숫자** 입니다. three.js 재질이 숫자를 받으니 그쪽을 본으로
   삼습니다. 색 동그라미를 그리는 것은 DOM 이라 문자열도 필요해서 css 를
   같이 답니다 — 쓰는 곳에서 그때그때 만들게 두면 한쪽만 고치는 날이 옵니다. */
export const TINTS = [
  { id: 'charcoal', name: '숯',   hex: 0x3A3F4A, css: '#3A3F4A' },
  { id: 'mist',     name: '안개', hex: 0xAEB8C4, css: '#AEB8C4' },
  { id: 'navy',     name: '남색', hex: 0x3E5A8C, css: '#3E5A8C' },
  { id: 'teal',     name: '청록', hex: 0x2F6E68, css: '#2F6E68' },
  { id: 'moss',     name: '이끼', hex: 0x5C7043, css: '#5C7043' },
  { id: 'mustard',  name: '겨자', hex: 0xC08A2E, css: '#C08A2E' },
  { id: 'brick',    name: '벽돌', hex: 0xB0503C, css: '#B0503C' },
  { id: 'plum',     name: '자두', hex: 0x7A3E5C, css: '#7A3E5C' },
];
/* 색을 고를 수 **없는** 것들. 과잠은 학교 색이고 학사모는 졸업식 규정이라
   고르는 물건이 아닙니다. 청바지는 데님이고 구두는 가죽입니다. 안경테는
   2D 에서 2px 라 색을 바꿔 봐야 테두리 색과 싸우기만 했는데, 여기서도
   눈 앞의 가는 고리라 사정이 같습니다 — 그래서 안경 칸은 통째로 뺍니다.
   목록은 WEAR 에서 **깎아 내서** 만듭니다. 손으로 적어 두면 옷을 하나
   늘렸을 때 그 옷만 조용히 염색이 안 되는 일이 생깁니다. */
const NO_TINT = ['varsity', 'grad_cap', 'jeans', 'dress', 'none'];
export const TINTABLE = Object.keys(WEAR)
  .filter((slot) => slot !== 'glasses')
  .reduce((a, slot) => a.concat(WEAR[slot].map(([id]) => id)), [])
  .filter((id) => !NO_TINT.includes(id));
const TINT_OK = new Set(TINTABLE);
/* '#3A3F4A' 도 0x3A3F4A 도 받습니다 — 2D 판이 저장해 둔 값이 문자열입니다 */
function hexNum(v) {
  return typeof v === 'string' ? parseInt(v.replace('#', ''), 16) : (v | 0);
}

/* 옛 형식({top,bottom,shoe,trim})도 그대로 받습니다 — NPC 들이 씁니다.
   tint 는 **늘 있어야** 합니다. character() 가 옷마다 L.tint[id] 를 보므로
   비어 있으면 그 자리에서 터집니다. 새 형식으로 들어온 것에는 **받은
   객체에 그대로** 빈 표를 달아 둡니다 — 복사본을 돌려주면 옷장이 고른
   색을 적어 넣을 곳이 사라집니다(SAVE.look 이 바로 그 객체입니다). */
export function normalizeLook(fit) {
  if (fit && fit.topId) { if (!fit.tint) fit.tint = {}; return fit; }
  return {
    topId: fit?.style || 'tee', top: fit?.top ?? 0x2DD4BF,
    bottomId: fit?.bottomId || 'jeans', bottom: fit?.bottom ?? 0x3E5C82,
    shoesId: fit?.shoesId || 'sneakers', shoes: fit?.shoe ?? 0xF2F2F2,
    hatId: 'none', hat: 0xE8695A,
    glassesId: 'none',
    bagId: fit?.bag === false ? 'none' : 'backpack', bagC: 0x4A6EA8,
    trim: fit?.trim,
    tint: fit?.tint || {},
  };
}

/* ══════════════════════════════════════════════════════════
   접기(fold) — 한 마디 안에서 **같이 움직이는** 조각을 한 덩이로 굽습니다.

   한 사람이 메시 쉰다섯이었습니다. 아홉이 서면 그것만 오백 번을 그려서,
   이 월드에서 그림값이 가장 큰 것이 건물도 나무도 아닌 **사람**이었습니다.
   그런데 그 쉰다섯 중 대부분은 서로에 대해 안 움직입니다 — 눈·주둥이·볼은
   머리와 같이 돌고, 등딱지 조각은 등딱지와 같이 돌고, 밑단·옷깃·주머니는
   몸통과 같이 돕니다. 따로 그릴 이유가 없습니다.

   그래서 마디마다(다리·정강이·몸통·팔·머리·모자·안경·가방) **그 마디 안에서만**
   같은 재질을 쓰는 조각을 하나로 굽습니다. 캠퍼스를 굽는 bake.js 와 같은
   방법이고, 다른 점은 굽는 단위가 섬 전체가 아니라 마디 하나라는 것뿐입니다 —
   그래야 굽고 나서도 팔이 따로 흔들립니다.

   굽지 않는 것이 둘 있습니다.
     · 눈동자 — blink() 가 scale.y 를 눌러 감고 face() 가 표정마다 다시 폅니다.
       그래서 눈동자만 머리에 그대로 두고 나머지를 굽습니다. 빛점 두 개는
       원래도 눈동자와 따로 놀던 형제라(감아도 안 따라 감깁니다) 같이 굽습니다.
     · 염색 대상 재질 — applyTint 가 wear[].mats 에 적힌 재질의 색을 덮어씁니다.
       그릇을 **재질 하나 단위**로 가르면 후드 몸판과 조금 어두운 주머니가
       서로 다른 덩이로 남아, 굽기 전과 똑같이 각자 제 색을 받습니다.
   ══════════════════════════════════════════════════════════ */

/** 합칠 수 있게 속성을 맞춥니다 — position · normal · uv 셋만 남깁니다.
    bake.js 에 같은 함수가 있지만 그 파일이 밖으로 내보내지 않습니다.
    캠퍼스를 굽는 규칙과 사람을 굽는 규칙은 같아야 해서 그대로 옮겨 왔습니다. */
function normalize(src) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', src.getAttribute('position').clone());
  if (src.getAttribute('normal')) g.setAttribute('normal', src.getAttribute('normal').clone());
  else { g.computeVertexNormals(); }
  const uv = src.getAttribute('uv');
  g.setAttribute('uv', uv ? uv.clone()
    : new THREE.BufferAttribute(new Float32Array(src.getAttribute('position').count * 2), 2));
  if (src.index) g.setIndex(src.index.clone());
  else {
    const n = g.getAttribute('position').count;
    g.setIndex(Array.from({ length: n }, (_, i) => i));
  }
  return g;
}

/* 구운 형상 곳간 — **모양이 같으면 여럿이 나눠 씁니다.**
   몸꼴은 옷 색과 상관이 없고 머리는 종에만 달렸습니다. 그래서 열쇠를
   "무엇을 어떻게 지었는가"(마디 이름 + 옷 종류 + 종 + lod)로 잡습니다.
   거기에 그 그릇에 들어간 조각들의 **자리 번호**를 붙입니다. 번호까지 붙이는
   이유는, 색이 우연히 겹치면 그릇이 갈라지는 모양 자체가 달라지기 때문입니다 —
   백조는 살색이 흰색이라 반바지에 운동화를 신으면 맨 정강이와 흰 밑창이 한
   그릇에 들어가지만 거북이는 갈라집니다. 번호가 열쇠에 있으면 그 둘이 서로의
   형상을 건네받는 일이 없습니다.
   여기 담긴 형상은 여러 사람이 같이 보고 있으므로 **버리면 안 됩니다.**
   사람을 치울 때는 scene.remove 만 하십시오(index.html 이 그렇게 합니다). */
const FOLD_GEO = new Map();

/* 한 그릇에 넣어도 되는 재질인가.
   색이 **똑같아야** 합니다. 거칠기는 0.06 안쪽이면 같은 것으로 봅니다.
   고슴도치 가시 열둘, 알파카 털 열 덩이는 같은 값을 여러 번 적은 것이라 그냥
   맞아떨어지지만, 같은 검정 잉크를 어떤 자리엔 0.3 어떤 자리엔 0.35 로 적어
   둔 곳이 몇 군데 있습니다. 손으로 적다 생긴 차이지 뜻이 있어 벌린 값이
   아닙니다. 0.06 으로 묶으면 실제로 옮겨지는 것은 눈 빛점 · 신발 밑창 ·
   코와 입선 · 기린 주둥이뿐이고 옮겨 간 폭은 최대 0.05 입니다(전체 면의 6%).
   0.12 까지 늘리면 한 사람이 0.4 조각 더 줄지만 기린 반점이 0.62 에서 0.5 로
   옮겨 가서, 눈에 안 보인다고 잘라 말하기 어려워집니다. 여기서 끊습니다. */
function sameBin(a, b) {
  return a.color.getHex() === b.color.getHex()
    && Math.abs(a.roughness - b.roughness) <= .06
    && (a.metalness || 0) === (b.metalness || 0)
    && !!a.transparent === !!b.transparent && a.opacity === b.opacity && a.side === b.side;
}

/**
 * 한 마디를 굽습니다.
 *   root  이 마디의 그룹(다리·몸통·머리 …). 결과 메시가 여기 붙습니다.
 *   key   형상 곳간 열쇠 — 모양을 결정하는 것만 넣습니다(색은 넣지 않습니다).
 *   o     { dyed 염색 대상 재질들, keep 굽지 않을 메시들, stop 안 들어갈 하위 마디들 }
 * 돌려주는 값은 이 마디가 몇 번 그려지게 됐는가입니다.
 */
function foldPart(root, key, o) {
  const keep = o.keep && o.keep.length ? new Set(o.keep) : null;
  const stop = o.stop ? new Set(o.stop.filter(Boolean)) : null;
  const dyed = o.dyed;
  /* 마디 안을 훑어 (메시, 마디 기준 행렬, 자리 번호) 를 모읍니다. 세계 행렬이
     아니라 **마디 기준** 이어야 굽고 나서도 그 마디만 따로 움직입니다. */
  const found = [];
  let n = 0;
  const walk = (node, m) => {
    node.children.forEach((c) => {
      c.updateMatrix();
      const cm = new THREE.Matrix4().multiplyMatrices(m, c.matrix);
      if (c.isMesh) {
        const i = n++;                              // 번호는 굽지 않는 것도 세어 둡니다
        if (!(keep && keep.has(c))) found.push([c, cm, i]);
      } else if (!(stop && stop.has(c))) walk(c, cm);
    });
  };
  walk(root, new THREE.Matrix4());
  if (!found.length) return 0;

  const bins = [];
  found.forEach(([mesh, mtx, i]) => {
    const mat = mesh.material;
    /* 염색 대상은 **재질 하나하나를 그대로** 갈라 둡니다 — 지금 색이 같아도
       나중에 따로 바뀝니다(후드 몸판과 주머니가 바로 그렇습니다). */
    const lock = !!(dyed && dyed.has(mat));
    /* 그림자 여부는 가릅니다. 합치면 그림자 패스의 그림이 달라집니다. */
    let bin = bins.find((b) => b.cast === mesh.castShadow && b.recv === mesh.receiveShadow
      && ((b.lock || lock) ? b.mat === mat : sameBin(b.mat, mat)));
    if (!bin) bins.push(bin = { mat, lock, cast: mesh.castShadow, recv: mesh.receiveShadow, list: [], ids: [] });
    bin.list.push([mesh, mtx]); bin.ids.push(i);
  });

  const doomed = [];
  bins.forEach((b) => {
    const ck = key + '#' + b.ids.join('.');
    let geo = FOLD_GEO.get(ck);
    if (!geo) {
      const gs = b.list.map(([mesh, mtx]) => normalize(mesh.geometry).applyMatrix4(mtx));
      geo = gs.length === 1 ? gs[0] : mergeGeometries(gs, false);
      /* 못 합치면 **그대로 둡니다.** 반쪽만 붙이면 팔 하나가 사라집니다. */
      if (!geo) { gs.forEach((x) => x.dispose()); return; }
      geo.computeBoundingSphere();
      FOLD_GEO.set(ck, geo);
    }
    const m = new THREE.Mesh(geo, b.mat);
    m.castShadow = b.cast; m.receiveShadow = b.recv;
    m.matrixAutoUpdate = false;                     // 형상에 이미 자리가 구워져 있습니다
    root.add(m);
    b.list.forEach(([mesh]) => doomed.push(mesh));
  });
  /* 원본 메시는 떼어 냅니다. 안 떼면 두 벌이 겹쳐 그려집니다.
     형상은 **버리지 않습니다** — 위 곳간에서 온 것이라 다른 사람이 아직
     쓰고 있습니다. 굽는 시점에는 아직 한 번도 안 그려서 그래픽카드에
     올라간 것이 없으므로, 안 버려도 남는 것은 자바스크립트 쪽 배열뿐이고
     그것도 곳간이 어차피 계속 들고 있는 것들입니다. */
  doomed.forEach((x) => { x.parent && x.parent.remove(x); });
  /* 속이 빈 껍데기 그룹도 치웁니다 — 매 프레임 행렬만 갱신하는 껍데기입니다.
     하위 마디(stop)는 건드리지 않습니다. 스케이트를 신으면 정강이에 부츠가
     붙는 것처럼, 지금 비어 있어도 나중에 뭔가 붙는 자리가 있습니다. */
  const prune = (node) => {
    node.children.slice().forEach((c) => {
      if (c.isMesh || (stop && stop.has(c))) return;
      prune(c);
      if (!c.children.length) node.remove(c);
    });
  };
  prune(root);
  return bins.length;
}

/* ══════════════════════════════════════════════════════════
   랜딩 에셋을 그대로 세웁니다

   랜딩의 캐릭터 여덟은 이미 그려져 있고(prototypes/landing/assets/
   char-*.png), 그것이 이 제품의 캐릭터입니다. 3D 로 다시 빚으면 아무리
   맞춰도 **다른 그림**이 됩니다 — 비례와 재질을 맞춘 뒤에도 랜딩과
   월드를 나란히 놓으면 둘로 보였습니다.

   그래서 다시 빚지 않고 **그 그림을 그대로** 세웁니다. 판 하나에
   에셋을 붙이고 세로축만 카메라를 향해 돌립니다.

   빌보드에서 늘 걸리는 것 셋을 막았습니다.

     **세로축만** 돌립니다. THREE.Sprite 처럼 완전 빌보드로 두면 위에서
     내려다볼 때 캐릭터가 카메라 쪽으로 눕습니다 — 땅에 선 것이 아니라
     바닥에 붙은 스티커가 됩니다.

     **그림자를 안 던집니다.** 투명한 판이 던지는 그림자는 캐릭터 모양이
     아니라 네모입니다. 대신 발밑에 타원 하나를 깝니다.

     **NearestFilter · 톤매핑 끔.** 픽셀 그림은 보간하면 뭉개지고,
     AgX 를 태우면 랜딩과 색이 어긋납니다. "에셋 그대로" 가 요구사항이니
     색 파이프라인을 통과시키지 않습니다.

   걷기·앉기·감정표현은 parts 를 만지는데 판 하나에는 다리도 팔도
   없습니다. 그 함수들이 터지지 않게 **빈 뼈대**를 물려 둡니다 —
   동작은 아무 일도 안 하고, 대신 걸을 때 판이 조금 들썩입니다.
   ══════════════════════════════════════════════════════════ */
const SPRITE_FILE = {
  거북이: 'turtle', 기린: 'giraffe', 알파카: 'alpaca', 햄스터: 'hamster',
  고슴도치: 'hedgehog', 개구리: 'frog', 백조: 'swan', 펭귄: 'penguin',
};
const SPRITE_TEX = new Map();
const _texLoader = new THREE.TextureLoader();
function spriteTex(species) {
  const f = SPRITE_FILE[species] || 'turtle';
  if (SPRITE_TEX.has(f)) return SPRITE_TEX.get(f);
  const t = _texLoader.load('../landing/assets/char-' + f + '.png');
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  SPRITE_TEX.set(f, t);
  return t;
}

const _sp = new THREE.Vector3(), _sq = new THREE.Quaternion(), _se = new THREE.Euler();

function spriteChar(parent, species, opt) {
  const g = new THREE.Group();
  g.position.set(opt.x || 0, 0, opt.z || 0);
  g.rotation.y = opt.ry || 0;
  g.scale.setScalar(opt.scale || 1);
  parent.add(g);

  const H = 1.94, W = H * .56;                    // 에셋 가로세로비
  const board = new THREE.Group();
  board.position.y = H / 2;
  g.add(board);

  const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H),
    new THREE.MeshBasicMaterial({ map: spriteTex(species), transparent: true,
      alphaTest: .5, toneMapped: false }));
  m.castShadow = false; m.receiveShadow = false;
  board.add(m);

  /* 세로축만 카메라를 향합니다.

     훅을 **메시**에 겁니다. 처음에 board(Group)에 걸었더니 캐릭터가
     통째로 안 보였습니다 — three 는 실제로 그리는 것(Mesh·Line·Points)
     에만 onBeforeRender 를 부르고 Group 은 그리지 않으므로 한 번도
     호출되지 않았고, 판이 기본 방향(카메라와 나란한 옆면)으로 남아
     두께 0 인 선이 됐습니다. */
  m.onBeforeRender = function (r, sc, cam) {
    const b = this.parent;
    b.getWorldPosition(_sp);
    const want = Math.atan2(cam.position.x - _sp.x, cam.position.z - _sp.z);
    b.parent.getWorldQuaternion(_sq);
    _se.setFromQuaternion(_sq, 'YXZ');
    b.rotation.y = want - _se.y;
    b.updateMatrixWorld(true);
  };

  /* 발밑 그림자 — 판이 던지는 네모 대신 */
  const sh = new THREE.Mesh(new THREE.CircleGeometry(.42, 18),
    new THREE.MeshBasicMaterial({ color: 0x2A3038, transparent: true, opacity: .22,
      depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = .015; sh.renderOrder = 1;
  g.add(sh);

  /* 빈 뼈대 — stride · idle · 감정표현이 터지지 않게 */
  const dummy = () => { const d = new THREE.Group(); board.add(d); return d; };
  const parts = {
    legs: [dummy(), dummy()], shins: [dummy(), dummy()], arms: [dummy(), dummy()],
    head: dummy(), torso: dummy(), neck: null, eyes: [], wear: {},
    sprite: m, board, H,
  };
  g.userData.parts = parts;
  g.userData.base = { armZ: [0, 0] };
  g.userData.seed = Math.random() * 10;
  g.userData.sprite = true;
  return g;
}

export function character(parent, species, fit, opt = {}) {
  if (SPRITE_ON) return spriteChar(parent, species, opt);
  /* 짓는 동안만 성기게. 끝나면 반드시 되돌립니다 — 안 되돌리면 그다음에
     세우는 사람이 이유 없이 성기게 나옵니다. */
  LOD = opt.lod ? 1 : 0;
  try { return buildChar(parent, species, fit, opt); } finally { LOD = 0; }
}

function buildChar(parent, species, fit, opt) {
  const C = SPECIES[species];
  const L = normalizeLook(fit);
  if (BARE) {
    /* 가장 단순한 차림으로 고정합니다 — 후드 주머니, 과잠 소매,
       트레이닝 옆줄 같은 **덧붙는 조각**이 안 생기는 조합입니다. */
    L.topId = 'tee'; L.bottomId = 'jeans'; L.shoesId = 'sneakers';
    L.hatId = 'none'; L.glassesId = 'none'; L.bagId = 'none';
  }
  const g = new THREE.Group();
  g.position.set(opt.x || 0, 0, opt.z || 0);
  g.rotation.y = opt.ry || 0;
  g.scale.setScalar(opt.scale || 1);
  parent.add(g);

  const skin = M(C.skin);
  /* ── 염색 ──
     2D 에서는 옷 한 장을 픽셀 마스크로 다시 칠했습니다. 여기서는 옷이
     이미 제 메시고 제 재질이라 색 하나만 갈아 끼우면 끝입니다. 대신
     칸마다 **어느 재질이 그 칸의 색을 어떻게 비틀어 쓰는지** 를 같이
     적어 둡니다 — 후드 주머니는 조금 어둡고 청바지 밑단은 조금 밝아서,
     몸판만 바꾸면 그 둘이 옛 색으로 남아 옷이 두 벌로 보입니다. */
  const wear = {};
  const slot = (k, id, base) => (wear[k] = { id, base, mats: [] });
  const dye = (k, mat, of) => { wear[k].mats.push([mat, of || null]); return mat; };
  const paint = (k) => {
    const w = wear[k], t = TINT_OK.has(w.id) ? L.tint[w.id] : null;
    return t == null ? w.base : hexNum(t);
  };
  slot('top', L.topId, L.top);
  slot('bottom', L.bottomId, L.bottom);
  slot('shoes', L.shoesId, L.shoes);
  slot('hat', L.hatId, L.hat);
  /* 가방 색은 opt.bag(숫자)이 이깁니다 — NPC 들이 그렇게 부릅니다 */
  slot('bag', L.bagId, (typeof opt.bag === 'number' ? opt.bag : null) ?? L.bagC ?? 0x4A6EA8);
  let topC = paint('top'), botC = paint('bottom'), shoC = paint('shoes');
  if (BARE) { topC = botC = shoC = C.skin; }
  const top = dye('top', M(topC, .6)), bot = dye('bottom', M(botC, .6)), sho = dye('shoes', M(shoC, .48));
  /* trim 을 따로 준 차림(옛 NPC)은 염색을 안 따릅니다 — 뜻이 있어 준 색입니다 */
  const trim = BARE ? M(C.skin, .6)
    : L.trim != null ? M(L.trim, .55)
    : dye('top', M(mix(topC, 0x000000, .18), .55), (c) => mix(c, 0x000000, .18));
  const parts = { legs: [], shins: [], arms: [], head: null, torso: null, neck: null, wear };
  const shortsOn = L.bottomId === 'shorts';
  const shortSleeve = L.topId === 'tee';
  const varsity = L.topId === 'varsity';
  const vBody = 0xF4EDE0;                       // 과잠 몸판 — 크림
  const bodyTop = varsity ? M(vBody, .6) : top;
  /* 밑단과 옷깃은 언제나 같은 색입니다 — 재질을 둘로 만들 이유가 없습니다 */
  const edge = varsity ? dye('top', M(topC, .55)) : trim;

  /* ══════════════════════════════════════════════════════════
     몸 — 물방울 하나

     여기까지 사람 뼈대(허벅지·정강이·발 / 어깨 있는 몸통 / 소매 달린 팔 /
     목)를 조금씩 줄여 가며 맞추려 했는데, 줄여도 사람이었습니다.
     레퍼런스에는 그 부품들이 **없습니다.**

       · 다리가 없습니다. 바닥에 작은 발 두 개가 붙어 있을 뿐입니다
       · 어깨가 없습니다. 몸이 위로 갈수록 좁아져 머리로 이어집니다
       · 목이 없습니다. 머리가 몸에 그대로 얹혀 파묻힙니다
       · 팔은 몸 옆구리에 붙은 짧은 뭉치입니다

     그래서 부품을 줄이는 대신 **다시 짭니다.** 옆선 하나를 돌린
     회전체가 몸 전체이고, 거기에 발 둘 · 팔 둘 · 머리 하나를 얹습니다.
     bake 와 걷기가 쓰는 parts 이름은 그대로 둡니다 — legs 에 발을,
     arms 에 뭉치를 넣으면 기존 동작이 그대로 돕니다.
     ══════════════════════════════════════════════════════════ */
  const lathe = (prof, seg = 30) =>
    latheG(prof.map(([y, r]) => new THREE.Vector2(Math.max(.004, r), y)), S(seg, 14));

  const torso = new THREE.Group();
  torso.position.y = TORSO_Y; g.add(torso); parts.torso = torso;
  {
    /* 옆선 — 바닥에서 살짝 좁고, 배에서 가장 넓고, 위로 갈수록 좁아집니다.
       위를 완전히 닫지 않는 이유는 머리가 그 위에 파묻히기 때문입니다. */
    const body = new THREE.Mesh(lathe([
      [.00, .00], [.02, .22], [.06, .32], [.14, .40], [.24, .445],
      [.36, .455], [.48, .44], [.58, .40], [.66, .35], [.72, .29], [.76, .22], [.78, .00],
    ]), skin);
    body.castShadow = body.receiveShadow = true;
    body.scale.z = .92;
    torso.add(body);

    /* 배 — 종에 따라 밝은 면이 앞에 있습니다(개구리 · 펭귄 · 거북이) */
    if (C.belly) {
      const b = new THREE.Mesh(sphG(.36, S(22, 11), S(16, 8)), M(C.belly, .72));
      b.position.set(0, .34, .18); b.scale.set(.86, 1.05, .62);
      b.castShadow = false; b.receiveShadow = true; torso.add(b);
    }
    /* 알파카 · 고슴도치 — 몸에도 털이 붙습니다 */
    if (C.wool) {
      const pts = [[-.3, .5, .18], [.3, .5, .18], [0, .62, .2], [-.34, .3, .1], [.34, .3, .1],
                   [0, .2, .3], [-.18, .62, .0], [.18, .62, .0]];
      pts.forEach(([x, y, z], k) => ell(torso, .17 - (k % 3) * .02, M(C.wool, .92), x, y, z));
    }
    if (C.quill) {
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        const r = .40 + (k % 2) * .03, y = .30 + (k % 3) * .13;
        const q = new THREE.Mesh(sphG(.13, S(12, 7), S(10, 6)),
                                 M(k % 2 ? C.quillDark : C.quill, .82));
        q.position.set(Math.sin(a) * r * .9, y, Math.cos(a) * r * -.72 - .08);
        q.scale.set(.8, .8, 1.5);
        q.lookAt(q.position.x * 2, y + .1, q.position.z * 2 - .4);
        q.castShadow = true; torso.add(q);
      }
    }
  }

  /* ── 발 ── 다리가 아니라 발입니다. parts.legs 에 넣어 걷기가 씁니다. */
  [-.20, .20].forEach((x) => {
    const leg = new THREE.Group();
    leg.position.set(x, TORSO_Y + .04, 0); g.add(leg); parts.legs.push(leg);
    const foot = ell(leg, .155, C.beak ? M(C.beak, .5) : skin, 0, -.03, .05, 1.0, .62, 1.35);
    foot.castShadow = true;
    /* 정강이 자리는 비워 둡니다 — 굽힐 관절이 없지만 걷기가 찾습니다 */
    const shin = new THREE.Group(); leg.add(shin); parts.shins.push(shin);
  });

  /* ── 팔 ── 옆구리에 붙은 짧은 뭉치 */
  [-1, 1].forEach((sgn) => {
    const arm = new THREE.Group();
    arm.position.set(sgn * .40, .50, .02);
    arm.rotation.z = opt.wave && sgn > 0 ? 2.15 : sgn * .16;
    g.add(arm); parts.arms.push(arm);
    const a = ell(arm, .135, skin, 0, -.10, 0, .92, 1.45, .92);
    a.castShadow = true;
  });
  g.userData.base = { armZ: [-.16, .16] };

  /* ── 목 · 머리 ── */
  /* 목이 없습니다. 레퍼런스는 머리가 몸 위에 그대로 얹혀 파묻힙니다 —
     목을 그리면 그 순간 사람이 됩니다. */
  parts.neck = null;
  const h = new THREE.Group();
  h.position.y = HEAD_Y;
  h.scale.setScalar(HEAD_S);
  g.add(h);
  HEADS[species](h, C);
  h.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
  parts.head = h;
  parts.eyes = h.userData.eyeMeshes || [];
  parts.eyes.forEach((m) => (m.userData.sy = m.scale.y));

  /* 접을 때 이 넷은 머리·몸과 **따로** 굽습니다 — 아래 접기 자리 참고 */
  let hatG = null, glG = null, carry = null, carryKey = '';

  /* ── 모자 — 종마다 정수리 높이가 달라서 한 표로 맞춥니다 ── */
  const HAT_FIT = { 알파카: [.56, -.02, 1.1], 고슴도치: [.52, -.06, 1.05], 개구리: [.5, -.16, 1.05],
    기린: [.46, -.02, 1.0], 백조: [.5, -.04, .95] };
  if (L.hatId && L.hatId !== 'none') {
    const [hy, hz, hs] = HAT_FIT[species] || [.42, 0, 1];
    const hat = new THREE.Group(); hat.position.set(0, hy, hz); hat.scale.setScalar(hs); h.add(hat);
    hatG = hat;
    const hatC = paint('hat');
    const hc = dye('hat', M(hatC, .6));
    const hcD = dye('hat', M(mix(hatC, 0x000000, .2), .6), (c) => mix(c, 0x000000, .2));
    if (L.hatId === 'cap') {
      const dome = new THREE.Mesh(sphG(.3, S(18, 10), S(12, 7), 0, Math.PI * 2, 0, Math.PI * .5), hc);
      dome.scale.set(1.05, .8, 1.05); dome.castShadow = true; hat.add(dome);
      ell(hat, .05, hcD, 0, .23, 0);
      const brim = new THREE.Mesh(cylG(.24, .26, .035, S(18, 10), 1, false, -Math.PI / 2, Math.PI), hcD);
      brim.position.set(0, .02, .2); brim.scale.set(1, 1, 1.35); hat.add(brim);
    } else if (L.hatId === 'beanie') {
      const dome = new THREE.Mesh(sphG(.31, S(18, 10), S(12, 7), 0, Math.PI * 2, 0, Math.PI * .55), hc);
      dome.scale.set(1.04, .95, 1.04); dome.castShadow = true; hat.add(dome);
      const fold = new THREE.Mesh(torG(.29, .055, S(8), S(20, 10)), hcD);
      fold.rotation.x = Math.PI / 2; fold.position.y = .02; fold.scale.set(1.04, 1.04, 1); hat.add(fold);
      ell(hat, .07, hc, 0, .32, 0);
    } else if (L.hatId === 'grad_cap') {
      const dome = new THREE.Mesh(sphG(.28, S(16, 10), S(10, 6), 0, Math.PI * 2, 0, Math.PI * .45), M(0x2E3440, .55));
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
    glG = gl;
    [-gx, gx].forEach((dx) => {
      if (L.glassesId === 'sunglasses') {
        ell(gl, .105, M(0x23272E, .3), dx, 0, 0, 1.05, 1.0, .3);
        const rim = new THREE.Mesh(torG(.105, .016, S(6), S(16, 8)), fr);
        rim.position.x = dx; gl.add(rim);
      } else {
        const rim = new THREE.Mesh(torG(.105, L.glassesId === 'horn' ? .024 : .015, S(6), S(16, 8)), fr);
        rim.position.x = dx; gl.add(rim);
      }
    });
    box(gl, gx * 2 - .19, .022, .02, .01, fr, 0, .02, 0);
    [-1, 1].forEach((t) => box(gl, .16, .02, .02, .01, fr, t * (gx + .13), .02, -.08).rotation.y = t * .5);
  }

  /* ── 등딱지 — 거북이는 가방 대신 딱지를 멥니다. 종의 서명이
     머리가 아니라 **등**에 있으면 얼굴이 자유로워집니다. */
  if (species === '거북이') {
    /* 머리를 1.17 배로 키우자 커진 뒤통수가 딱지 윗동을 덮었습니다.
       딱지를 조금 내리고 뒤로 물립니다 — 종의 서명이 등에 있으려면
       등에서 **보여야** 합니다. */
    /* 몸이 물방울로 바뀌면서 등이 낮고 좁아졌습니다. 딱지도 따라 내립니다. */
    const b = new THREE.Group(); b.position.set(0, .62, -.24); b.scale.setScalar(.86); g.add(b);
    carry = b; carryKey = 'shell';
    /* 돔 — 축 방향을 잘못 늘리면 옆으로 누운 부침개가 됩니다.
       회전 뒤 기준으로 세로(z)로 길게, 밖(y→-z)으로는 얕게. */
    const dome = new THREE.Mesh(sphG(.33, S(20, 10), S(14, 8), 0, Math.PI * 2, 0, Math.PI / 2), M(C.shell, .7));
    dome.rotation.x = -Math.PI / 2; dome.scale.set(1.12, .74, 1.5);
    dome.castShadow = true; b.add(dome);
    { const rim = new THREE.Mesh(torG(.3, .055, S(10, 6), S(22, 12)), M(C.shellDark, .66));
      rim.scale.set(1.16, 1.55, 1); b.add(rim); }
    /* 밝은 줄 하나 — 등딱지의 등뼈 */
    { const spine = new THREE.Mesh(torG(.3, .028, S(8), S(14, 8), Math.PI), M(C.shellDark, .6));
      spine.position.z = -.005; spine.rotation.z = Math.PI / 2;
      spine.rotation.y = Math.PI / 2; spine.scale.set(1.5, .76, 1); b.add(spine); }
    [-1, 1].forEach((t) => box(b, .07, .42, .05, .025, M(C.shellDark, .6), t * .22, -.02, .22));
  }
  /* ── 가방 ── */
  else if (opt.bag !== false && L.bagId !== 'none') {
    const bc = paint('bag');
    const bcD = dye('bag', M(mix(bc, 0x000000, .18), .6), (c) => mix(c, 0x000000, .18));
    if (L.bagId === 'tote') {
      const b = new THREE.Group(); g.add(b);
      carry = b; carryKey = 'bag|tote';
      box(b, .3, .34, .1, .04, dye('bag', M(bc, .66)), .42, .62, .02).rotation.z = -.06;
      box(b, .26, .05, .08, .02, bcD, .42, .8, .02);
      const strap = box(b, .05, .5, .03, .01, bcD, .3, 1.06, .0);
      strap.rotation.z = .5;
    } else {
      const b = new THREE.Group(); b.position.set(0, .92, -.30); g.add(b);
      carry = b; carryKey = 'bag|pack';
      const bag = new THREE.Mesh(lathe([[-.24, 0], [-.22, .16], [-.1, .21], [.1, .215], [.2, .19], [.24, .0]], 18),
        dye('bag', M(bc, .68)));
      bag.rotation.x = Math.PI / 2; bag.scale.set(1, 1, .55);
      bag.castShadow = true; b.add(bag);
      box(b, .22, .05, .07, .02, M(0xE8C06A, .38), 0, -.04, -.13);
      const st = dye('bag', M(bc, .58));
      [-1, 1].forEach((t) => box(b, .075, .42, .08, .03, st, t * .25, .2, .21));
    }
  }

  /* ── 접기 ── 마디마다, 그 마디 안에서만.
     열쇠에는 **모양을 정하는 것만** 넣습니다. 옷 색·염색·종의 털색은 형상을
     바꾸지 않으므로 넣지 않습니다 — 그래야 같은 종·같은 차림의 사람 아홉이
     형상 한 벌을 나눠 씁니다(머리는 종에만 달려 있어서, 옷을 뭘 입든 같은
     종끼리 통째로 나눠 씁니다).
     다리는 정강이를 빼고 굽습니다(정강이가 따로 접힙니다). 신발은 정강이와
     같이 움직이므로 정강이에 같이 굽습니다. 모자·안경은 머리와 같이 돌지만
     따로 굽습니다 — 같이 구우면 머리 형상 열쇠에 모자 종류가 섞여 들어가
     모자만 다른 사람끼리 머리를 못 나눠 쓰게 됩니다. */
  const dyed = new Set();
  Object.keys(wear).forEach((k) => wear[k].mats.forEach(([m]) => dyed.add(m)));
  const K = LOD ? 'l|' : 'f|';
  parts.legs.forEach((l, i) =>
    foldPart(l, `${K}leg|${L.bottomId}|${i}`, { dyed, stop: [parts.shins[i]] }));
  parts.shins.forEach((sh, i) =>
    foldPart(sh, `${K}shin|${L.bottomId}|${L.shoesId}|${i}`, { dyed }));
  foldPart(parts.torso, `${K}torso|${L.topId}`, { dyed });
  /* 두 팔은 속 조각이 좌우 대칭이 아니라 **똑같습니다**(전부 x=0). 벌리는 것은
     팔 그룹의 각이라, 형상은 한 벌로 둘이 나눠 씁니다. */
  parts.arms.forEach((a) => foldPart(a, `${K}arm|${shortSleeve ? 'short' : 'long'}`, { dyed }));
  foldPart(h, `${K}head|${species}`, { dyed, keep: parts.eyes, stop: [hatG, glG] });
  if (hatG) foldPart(hatG, `${K}hat|${L.hatId}`, { dyed });
  if (glG) foldPart(glG, `${K}glasses|${species}|${L.glassesId}`, { dyed });
  if (carry) foldPart(carry, K + carryKey, { dyed });

  g.userData.parts = parts;
  g.userData.base = { armZ: [parts.arms[0].rotation.z, parts.arms[1].rotation.z] };
  g.userData.noCollide = true;
  return g;
}

/** 이미 세워 둔 캐릭터의 옷 색만 갈아 끼웁니다.
    옷장에서 색을 하나 고를 때마다 뼈대를 다시 세우면(character() 한 번이
    메시 백여 개입니다) 고르는 손이 걸립니다. 여기서는 기억해 둔 재질의
    색만 덮어쓰므로 프레임이 안 끊깁니다.
    look 을 안 주거나 tint 가 비면 **염색을 지웁니다** — 지우는 길을
    따로 만들면 지우기가 안 되는 옷이 하나씩 남습니다. */
export function applyTint(g, look) {
  const P = g && g.userData && g.userData.parts;
  if (!P || !P.wear) return g;
  const T = normalizeLook(look || {}).tint || {};
  Object.keys(P.wear).forEach((k) => {
    const w = P.wear[k];
    const t = TINT_OK.has(w.id) ? T[w.id] : null;
    const c = t == null ? w.base : hexNum(t);
    if (c == null || !isFinite(c)) return;
    w.mats.forEach(([m, of]) => m.color.setHex(of ? of(c) : c));
  });
  return g;
}

/** 걷기 —
    `t` 는 **걸은 거리를 보폭으로 나눈 값** 입니다(초가 아닙니다). 그래야
    빨리 걸을 때 발이 미끄러지지 않습니다. 뒤로 가는 다리는 무릎을 접고,
    몸은 두 배 빠르기로 튀며, 빠를수록 앞으로 기웁니다. */
export function stride(g, t, sp) {
  const P = g.userData.parts; if (!P) return;
  /* 판 하나는 다리가 없으니 걷는 대신 **들썩입니다**. 완전히 가만히
     미끄러지면 얼음판 위를 밀려가는 것으로 보입니다. */
  if (P.sprite) {
    const k = Math.min(1, sp), f = t * Math.PI * 2;
    P.board.position.y = P.H / 2 + Math.abs(Math.sin(f)) * .07 * k;
    P.board.rotation.z = Math.sin(f) * .045 * k;
    return;
  }
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
  P.torso.position.y = TORSO_Y + bob;
  P.torso.rotation.x = k * .11;
  P.torso.rotation.y = s * .12;
  P.torso.rotation.z = 0;
  P.head.position.y = HEAD_Y + bob * .8;
  P.head.position.z = 0;
  P.head.rotation.x = -k * .07;
  if (!g.userData.looking) P.head.rotation.y *= .82;
  P.head.rotation.z = -s * .05;
  blink(P, t * 1.4 + (g.userData.seed || 0), g.userData.seed || 0);
  if (P.neck) { P.neck.rotation.x = 0; P.neck.position.z = -.005; P.neck.position.y = NECK_Y; }
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
  { const P = g.userData.parts;
    if (P && P.sprite) {                       // 숨 쉬듯 아주 조금
      P.board.position.y = P.H / 2 + Math.sin(t * 1.5 + seed) * .015;
      P.board.rotation.z = 0;
      return;
    } }
  const P = g.userData.parts; if (!P) return;
  const br = Math.sin(t * 1.5 + seed) * .013;
  P.torso.position.y = TORSO_Y + br;
  P.torso.rotation.x = 0; P.torso.rotation.y = 0; P.torso.rotation.z = 0;
  P.head.position.y = HEAD_Y + br;
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
  if (P.neck) { P.neck.rotation.x = 0; P.neck.position.z = -.005; P.neck.position.y = NECK_Y; }
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
  P.torso.position.y = TORSO_Y; P.torso.rotation.y = 0;
  P.head.position.y = HEAD_Y; P.head.rotation.y = 0;
  g.userData.sitting = on;
}

/** 무너지는 정도 0~1 — 이 서비스가 실제로 보여 주려는 그림입니다.
    목이 앞으로 나오고 등이 말리고 어깨가 올라옵니다. */
export function slouch(g, k) {
  const P = g.userData.parts; if (!P) return;
  const t = Math.max(0, Math.min(1, k));
  P.torso.rotation.x = t * .36;
  P.torso.position.y = TORSO_Y - t * .06;
  P.head.rotation.x = t * .54;
  P.head.position.z = t * .32;
  P.head.position.y = HEAD_Y - t * .12;
  if (P.neck) { P.neck.rotation.x = t * .45; P.neck.position.z = -.005 + t * .13; P.neck.position.y = NECK_Y - t * .04; }
  P.arms.forEach((r) => { r.position.y = 1.08 - t * .05; });
}

/* ══════════════════════════════════════════════════════════
   탈것 넷 — 2D 월드에서 그대로 옮겨 온 것

   왜 있는가: 존이 일곱이 되면서 광장에서 동아리방까지 걸어가는 데
   스무 걸음이 넘습니다. 지도로 건너뛸 수는 있지만 그건 **월드를
   건너뛰는 것**이라 자주 쓰면 걸어 다닐 이유가 사라집니다. 걷는 것을
   빠르게 만드는 쪽이 맞습니다.

   id · 이름 · 곱은 **손대지 않습니다.** 서버의 아이템 표(world_buy_item ·
   world_set_loadout)가 같은 id 를 쓰고 있어서, 여기서 하나만 바꿔도
   두 판이 갈라집니다. 곱이 2 를 넘으면 한 프레임에 한 칸 넘게 움직여
   벽 검사를 뛰어넘습니다 — 그래서 1.8 이 천장입니다.

   pose 는 **어떻게 타는가** 입니다. 서서 타는 것과 앉아서 타는 것을
   같은 자세로 두면 자전거 위에 사람이 서 있는 것으로 보입니다
   (2D 에서 실제로 받은 지적입니다).

   lift · seatY 는 2D 의 **픽셀** 이었습니다. 그 판 인형은 48px 칸에
   40px 로 서 있었고 이 몸은 1.6m 남짓이니 1px ≈ 0.04m 로 읽었습니다.
     lift  3px → 0.12m   구름이 땅에서 뜨는 높이
     seatY 7px → 0.28m   자전거 안장까지 엉덩이를 올리는 값
     seatY 2px → 0.08m   구름 등마루까지
   0.28 이 맞는 값인지는 이 뼈대로 재 보면 압니다. 앉았을 때 엉덩이가
   0.42 에 있으니 0.28 을 얹으면 안장이 발밑에서 0.83m 에 옵니다 —
   이 키의 몸이 탈 자전거 안장 높이가 그쯤입니다. 픽셀을 눈대중으로
   옮긴 것이 아니라, 2D 에서도 같은 비례로 맞춰 둔 값이라 맞습니다.
   ══════════════════════════════════════════════════════════ */
export const RIDES = {
  'ride-skate': { mult: 1.30, lift: 0,   name: '롤러스케이트', pose: 'stand', seatY: 0 },
  'ride-kick':  { mult: 1.45, lift: 0,   name: '킥보드',       pose: 'stand', seatY: 0 },
  'ride-bike':  { mult: 1.60, lift: 0,   name: '자전거',       pose: 'sit',   seatY: .28 },
  'ride-cloud': { mult: 1.80, lift: .12, name: '구름',         pose: 'sit',   seatY: .08 },
};

/* 이 뼈대는 **신발 바닥이 y=0 이 아닙니다.** 발 타원과 밑창 상자가
   원점보다 0.13 아래로 내려옵니다(밑창이 발 그룹 기준 -0.11, 발 그룹이
   몸 기준 -0.02). 걸을 때는 잔디에 조금 잠기는 것으로 읽혀 문제가
   없었지만, 두께 4cm 짜리 발판 위에 세우면 발이 판을 뚫고 나옵니다.
   그래서 탈것은 전부 **이 바닥선**을 0 으로 놓고 짓고, 탈것 그룹 자체를
   그만큼 내려 답니다. 안에서는 "발밑에서 몇 m" 로만 재면 됩니다. */
const SOLE = -.13;
const TAU = Math.PI * 2;

/* 3D 에서만 필요한 값. RIDES 는 서버와 나눠 쓰는 표라 늘리지 않습니다.
     stand   서서 타는 것의 발판 높이. 2D 에서는 발판이 2px 라 발을 그
             위에 겹쳐 그려도 됐고 그래서 lift 가 0 이었습니다. 여기서는
             같은 발판이 8~14cm 짜리 물건이라 안 올리면 발이 잠깁니다.
     lean    핸들을 잡느라 앞으로 숙이는 정도(slouch 에 넘깁니다).
     wheelR  바퀴 반지름. 굴림 각도가 간 거리 ÷ 반지름 입니다. */
const FIT = {
  'ride-skate': { stand: .14,  lean: .16, wheelR: .05 },
  'ride-kick':  { stand: .085, lean: .26, wheelR: .105 },
  'ride-bike':  { stand: 0,    lean: .28, wheelR: .34 },
  'ride-cloud': { stand: 0,    lean: 0 },
};

/* 넷이 나눠 쓰는 기하와 재질.
   그린 횟수가 줄지는 않습니다 — 메시 하나가 곧 한 번입니다. 대신 탈것을
   바꿀 때마다 토러스를 새로 굽지 않고, 바퀴 여덟 개가 재질 하나를 보므로
   그림자 패스에서 상태가 안 바뀝니다. 색은 2D 그림에서 쓰던 값 그대로
   입니다 — 두 판을 나란히 놓으면 같은 자전거로 보여야 합니다. */
let KIT = null;
function kit() {
  if (KIT) return KIT;
  KIT = {
    tyre: new THREE.TorusGeometry(1, .34, 6, 14),
    hub: new THREE.CylinderGeometry(.58, .58, .38, 10),
    bar: new THREE.CylinderGeometry(1, 1, 1, 7),
    puff: new THREE.SphereGeometry(1, 12, 9),
    disc: new THREE.CircleGeometry(1, 20),
    tyreM: M(0x2A2320, .82), hubM: M(0xB9C2C8, .42),
    teal: M(0x2DD4BF, .5), tealD: M(0x12A592, .55),
    red: M(0xE8695A, .5), redL: M(0xFFA694, .5),
    steel: M(0x5F6874, .4), dark: M(0x2A2320, .5), saddle: M(0x4A3323, .62),
    boot: M(0xF0EBE2, .55), plate: M(0x8A939B, .45),
    cloudW: M(0xFFFFFF, .95), cloudD: M(0xE4EDF4, .95),
    shade: new THREE.MeshBasicMaterial({ color: 0x2A3038, transparent: true,
      opacity: .1, depthWrite: false }),
  };
  return KIT;
}

const UP = new THREE.Vector3(0, 1, 0);
const AB = new THREE.Vector3();
/* 두 점을 잇는 대 하나. 자전거 뼈대는 마디가 아홉이라 좌표를 하나씩
   손으로 돌려 놓으면 한 마디만 어긋나도 바로 티가 납니다. */
function tube(p, mat, ax, ay, az, bx, by, bz, r) {
  AB.set(bx - ax, by - ay, bz - az);
  const len = AB.length() || .001;
  const m = new THREE.Mesh(kit().bar, mat);
  m.scale.set(r, len, r);
  m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  m.quaternion.setFromUnitVectors(UP, AB.divideScalar(len));
  m.castShadow = true; p.add(m); return m;
}
/* 바퀴 하나 — 타이어 고리에 허브 한 장. 굴리는 것은 이 그룹의 x 회전
   입니다. 토러스는 xy 평면에 눕기 때문에 축을 x 로 세워 둬야 앞(+z)으로
   굴러갑니다. 안 세우면 팽이처럼 제자리에서 돕니다. */
function wheel(p, r, x, y, z, into) {
  const K = kit();
  const w = new THREE.Group();
  w.position.set(x, y, z); w.scale.setScalar(r);
  const t = new THREE.Mesh(K.tyre, K.tyreM);
  t.rotation.y = Math.PI / 2; t.castShadow = true; w.add(t);
  const h = new THREE.Mesh(K.hub, K.hubM);
  h.rotation.z = Math.PI / 2; w.add(h);
  p.add(w); if (into) into.push(w);
  return w;
}

/* ---- 자전거 ----
   **안장을 원점 위에** 두고 짭니다. 캐릭터와 같은 자리에 붙이면 엉덩이가
   그대로 안장에 올라가고, 앞뒤로 밀어 맞출 일이 없습니다. */
function bike(G) {
  const K = kit(), W = G.userData.wheels;
  wheel(G, .34, 0, .34, -.46, W);
  wheel(G, .34, 0, .34, .52, W);
  tube(G, K.tealD, 0, .40, .17, 0, .34, -.46, .026);    // 체인스테이
  tube(G, K.tealD, 0, .76, -.02, 0, .34, -.46, .024);   // 시트스테이
  tube(G, K.teal, 0, .40, .17, 0, .78, -.02, .034);     // 시트튜브
  tube(G, K.teal, 0, .40, .17, 0, .70, .42, .036);      // 다운튜브
  tube(G, K.teal, 0, .78, -.02, 0, .76, .40, .032);     // 탑튜브
  tube(G, K.steel, 0, .70, .42, 0, .34, .52, .026);     // 앞포크
  tube(G, K.steel, 0, .66, .42, 0, .90, .40, .026);     // 헤드튜브
  tube(G, K.steel, 0, .90, .40, 0, 1.15, .30, .024);    // 스템
  tube(G, K.steel, 0, .78, -.02, 0, .82, -.03, .022);   // 안장 기둥
  box(G, .16, .05, .28, .02, K.saddle, 0, .84, -.04);   // 안장 — 윗면이 0.83
  /* 핸들 자리는 **손이 닿는 곳**입니다. 팔이 0.42m 밖에 안 되어서
     실물 자전거처럼 앞으로 빼면 손이 핸들 뒤 허공을 쥡니다. */
  box(G, .56, .05, .05, .02, K.dark, 0, 1.18, .29);
  [-1, 1].forEach((s) => { cyl(G, .034, .034, .10, 8, K.saddle, s * .24, 1.18, .29).rotation.z = Math.PI / 2; });
  /* 크랭크가 실물 비례보다 짧습니다(0.07, 실제는 0.17쯤). 이 인형은
     2.6등신이라 엉덩이에서 발바닥까지가 0.45m 뿐이고, 실물 비례로 달면
     페달이 발보다 한 뼘 아래에 생깁니다. 자전거가 정확한 것보다 발이
     페달에 붙어 있는 것이 먼저 눈에 들어옵니다. */
  const crank = new THREE.Group();
  crank.position.set(0, .40, .17); G.add(crank); G.userData.crank = crank;
  cyl(crank, .13, .13, .014, 14, K.dark, 0, 0, 0).rotation.z = Math.PI / 2;   // 체인링
  [-1, 1].forEach((s, i) => {
    const arm = new THREE.Group(); arm.rotation.x = i * Math.PI; crank.add(arm);
    box(arm, .028, .09, .028, .01, K.steel, s * .095, .045, 0);
    const ped = new THREE.Group(); ped.position.set(s * .095, .07, 0); arm.add(ped);
    box(ped, .09, .022, .13, .01, K.dark, 0, 0, 0);
    G.userData.pedals.push(ped);
  });
}

/* ---- 킥보드 ---- 발판이 낮고 기둥이 하나. 자전거와 옆모습이 확실히
   달라야 해서 발판을 길게 빼고 기둥을 앞바퀴 바로 위에 세웁니다. */
function kick(G) {
  const K = kit(), W = G.userData.wheels;
  wheel(G, .105, 0, .105, -.44, W);
  wheel(G, .105, 0, .105, .40, W);
  box(G, .24, .05, .70, .02, K.red, 0, .06, -.02);      // 발판 — 윗면이 0.085
  box(G, .17, .02, .60, .01, K.redL, 0, .088, -.02);    // 2D 의 밝은 한 줄
  box(G, .13, .05, .17, .02, K.dark, 0, .19, -.44);     // 뒷바퀴 덮개 겸 브레이크
  tube(G, K.steel, 0, .05, -.38, 0, .105, -.44, .022);
  tube(G, K.steel, 0, .06, .32, 0, .105, .40, .024);
  tube(G, K.steel, 0, .07, .36, 0, 1.03, .36, .028);    // 기둥
  box(G, .54, .05, .05, .02, K.dark, 0, 1.06, .36);     // 손잡이 — 자전거와 같은 이유로 손 자리에
  [-1, 1].forEach((s) => { cyl(G, .033, .033, .09, 8, K.saddle, s * .23, 1.06, .36).rotation.z = Math.PI / 2; });
}

/* ---- 롤러스케이트 ----
   신발은 이미 있습니다. 부츠를 통째로 다시 만들면 신발 위에 신발이
   겹쳐 발이 두 배로 굵어집니다 — 발목 테와 밑판과 바퀴만 얹으면
   "신발에 채운 것" 으로 읽히고 조각도 그만큼 적습니다. */
function skates(G) {
  const K = kit(), W = G.userData.wheels;
  G.userData.boots = [-1, 1].map((s) => {
    const b = new THREE.Group();
    /* 아직 안 신었을 때 서 있을 자리. 신는 순간 rideOn 이 정강이로 옮깁니다 */
    b.position.set(s * .17, .14, 0);
    b.userData.home = G;
    cyl(b, .148, .156, .10, 12, K.boot, 0, .18, -.01);        // 발목 테
    box(b, .30, .035, .46, .015, K.plate, 0, -.11, .05);      // 밑판
    wheel(b, .05, 0, -.18, -.10, W);
    wheel(b, .05, 0, -.18, .22, W);
    box(b, .10, .05, .05, .02, K.dark, 0, -.14, .30);         // 앞 스토퍼
    G.add(b);
    return b;
  });
}

/* ---- 구름 ---- 넷 중 유일하게 바퀴가 없습니다. 덩이 일곱으로 뭉치되
   아래 셋을 조금 어둡게 두면 뒤집힌 접시가 아니라 부푼 구름이 됩니다.
   그림자는 흐리게 깝니다 — "떠 있다" 를 그림자로도 한 번 더 말합니다.

   **앞뒤로 눌러(sz) 뒤로 물려 놓습니다.** 동글동글하게 두면 앞자락이
   z=0.3 까지 나와서 늘어뜨린 다리가 구름 속에 파묻혔습니다. 앉는 자리는
   엉덩이 밑(z≈-0.16)이면 되고, 그 앞은 비어 있어야 다리가 보입니다. */
function cloud(G) {
  const K = kit();
  const puff = (r, x, y, z, sy, sz, dark) => {
    const m = new THREE.Mesh(K.puff, dark ? K.cloudD : K.cloudW);
    m.position.set(x, y, z); m.scale.set(r, r * sy, r * sz);
    /* 그림자 지도에는 안 올립니다. 딱딱한 구름 그림자가 발밑에 찍히면
       떠 있는 것이 아니라 낮게 나는 물건으로 보입니다 — 아래 흐린 판이
       그 일을 대신합니다. */
    m.castShadow = false; m.receiveShadow = false; G.add(m);
  };
  puff(.48, 0, .26, -.20, .58, .78, true);              // 밑판
  puff(.30, -.36, .24, -.10, .68, .82, true);
  puff(.30, .36, .24, -.10, .68, .82, true);
  puff(.42, 0, .40, -.16, .58, .72, false);             // 등마루 — 꼭대기가 0.644
  puff(.28, -.30, .38, -.34, .74, .80, false);
  puff(.28, .32, .38, -.30, .74, .80, false);
  puff(.26, 0, .34, -.52, .72, .80, false);
  const sh = new THREE.Mesh(K.disc, K.shade);
  sh.rotation.x = -Math.PI / 2; sh.scale.setScalar(.78); sh.renderOrder = 2;
  G.add(sh); G.userData.shade = sh;
}

/**
 * 탈것 하나를 세웁니다. 캐릭터와 **같은 리그**에 붙이세요 — 같이 돌고
 * 같이 움직여야 합니다. 돌려주는 그룹을 rideOn 에 그대로 넘깁니다.
 *   parent  캐릭터를 담은 그룹(playerRig 같은 것)
 *   id      RIDES 의 열쇠
 *   opt     { x, z, ry }
 */
export function ride(parent, id, opt = {}) {
  const R = RIDES[id]; if (!R) return null;
  const G = new THREE.Group();
  G.position.set(opt.x || 0, SOLE + R.lift, opt.z || 0);
  G.rotation.y = opt.ry || 0;
  G.userData.id = id;
  G.userData.wheels = [];
  G.userData.pedals = [];
  parent.add(G);
  if (id === 'ride-bike') bike(G);
  else if (id === 'ride-kick') kick(G);
  else if (id === 'ride-skate') skates(G);
  else cloud(G);
  return G;
}

/* 지금까지 간 거리(m). 굴림은 **시간이 아니라 거리**에 비례해야 합니다 —
   시간으로 돌리면 서 있는데도 바퀴가 계속 돕니다(2D 는 그림이 한 장이라
   이 문제가 없었습니다). sp 는 걷기를 1 로 보는 배수라(index.html 의
   speed 가 6.2×sp) 여기서 한 번 m/s 로 바꿔 둡니다. 틀려도 바퀴가 조금
   빠르거나 느릴 뿐입니다. 한 프레임이 길어져도 0.1초 넘게는 안 굴립니다 —
   탭을 잠깐 접어 뒀다 돌아오면 바퀴가 백 바퀴 튑니다. */
const RIDE_MPS = 6.2;
function rideRoll(G, t, sp) {
  const u = G.userData;
  const dt = u.t0 == null ? 0 : Math.max(0, Math.min(.1, t - u.t0));
  u.t0 = t;
  u.dist = (u.dist || 0) + dt * Math.max(0, sp || 0) * RIDE_MPS;
  return u.dist;
}

/**
 * 타고 가는 한 프레임. stride/idle **대신** 부릅니다(둘을 같이 부르면
 * 다리가 페달을 밟다 말고 걷습니다).
 *   g   character() 가 돌려준 몸
 *   rideGroup  ride() 가 돌려준 탈것
 *   t   초 · sp 걷기를 1 로 보는 속도
 */
export function rideOn(g, rideGroup, id, t, sp) {
  const P = g && g.userData && g.userData.parts; if (!P) return g;
  const R = RIDES[id]; if (!R) return g;
  const F = FIT[id] || {};
  const G = rideGroup && rideGroup.userData.id === id ? rideGroup : null;
  const d = G ? rideRoll(G, t, sp) : 0;
  /* 구름만 위아래로 뜹니다 — 바퀴가 없다는 것을 움직임으로 한 번 더
     말합니다. **사람도 같이 떠야** 합니다. 구름만 뜨고 사람이 제자리면
     구름을 밟고 선 것이 아니라 구름이 발밑을 지나가는 것이 됩니다
     (2D 에서 실제로 그랬습니다). */
  const float = R.lift ? Math.sin(t * 2.2) * .045 : 0;
  if (G) {
    G.position.y = SOLE + R.lift + float;
    /* 그림자는 땅에 붙여 둡니다. 구름을 따라 올라가면 그림자가 아니라
       구름 밑에 붙은 흐린 판이 됩니다. */
    if (G.userData.shade) G.userData.shade.position.y = -(R.lift + float) + .02;
    const a = d / (F.wheelR || .3);
    G.userData.wheels.forEach((w) => { w.rotation.x = a; });
  }
  /* 키 — 앉는 것은 표의 seatY 가, 서는 것은 발판 높이가 올립니다 */
  g.position.y = R.lift + float + (R.pose === 'sit' ? R.seatY : (F.stand || 0));
  g.userData.riding = id;

  /* 자세는 sit() 과 slouch() 로 잡습니다. 여기서 회전값을 직접 흩뿌리면
     팔은 다음 프레임에 idle() 이 base.armZ 로 되돌려 놓고 등은 아무도
     안 되돌려서, 내렸을 때 굽은 채로 남습니다. 팔다리는 sit() 이,
     등·목·머리는 slouch() 가 갖고 있으니 그 둘을 먼저 부르고 그 위에만
     얹습니다. 내릴 때 rideOff 가 같은 둘을 0 으로 부르면 원래대로 옵니다. */
  const hy = P.head.rotation.y;                    // 시선(look)이 만들어 둔 각
  sit(g, R.pose === 'sit');
  /* 앞으로 숙이는 것은 자세가 무너진 것이 아니라 손잡이를 잡느라 숙인
     것입니다. 그래도 등·목·머리·어깨를 한 벌로 움직이는 기계는 이것
     하나뿐이라 그대로 씁니다 — 값을 0.3 아래로 묶어 무너짐과 구별합니다. */
  slouch(g, F.lean || 0);
  /* sit() 은 고개를 정면으로 되돌립니다(세션 자리에서는 그게 맞습니다).
     타고 갈 때는 두리번거려야 하니 시선이 만든 각을 돌려놓습니다. */
  P.head.rotation.y = hy;

  if (id === 'ride-bike') {
    /* 페달 — **다리가 도는 것**이 자전거입니다. sit() 의 90도 무릎을
       그대로 두면 자전거 위에 놓인 의자에 앉아 있는 것으로 보입니다. */
    const ph = d / 2.1 * TAU;                      // 한 바퀴에 2.1m — 실제 기어비 근처
    if (G && G.userData.crank) {
      G.userData.crank.rotation.x = ph;
      /* 페달까지 같이 돌면 발이 페달을 밟은 채 뒤집힙니다. 같은 각을
         반대로 돌려 늘 수평으로 둡니다. */
      G.userData.pedals.forEach((p, i) => { p.rotation.x = -ph - i * Math.PI; });
    }
    /* 위상을 sin 이 아니라 **-cos** 로 잡습니다. sin 으로 뒀더니 발이
       가장 낮은 순간과 페달이 가장 낮은 순간이 4분의 1 바퀴 어긋나
       발이 페달을 밟는 게 아니라 페달 옆을 휘저었습니다. 페달 높이는
       cos 을 따라가므로 다리도 cos 을 따라가야 합니다. */
    P.legs.forEach((l, i) => {
      l.rotation.x = -1.05 - Math.cos(ph + i * Math.PI) * .40;
      l.rotation.z = (i ? .09 : -.09);
    });
    P.shins.forEach((s, i) => { s.rotation.x = .85 + Math.cos(ph + i * Math.PI) * .55; });
    /* 손은 핸들 — 어깨(±0.33)보다 안쪽으로 모아야 핸들 폭에 맞습니다 */
    P.arms.forEach((r, i) => { r.rotation.x = -.75; r.rotation.z = (i ? -1 : 1) * .16; });
  } else if (id === 'ride-cloud') {
    /* 구름에는 페달도 안장도 없어 다리가 할 일이 없습니다. 달랑달랑
       흔들리게 두면 "얹혀 간다" 로 읽힙니다. 등은 폅니다(lean 0) —
       붙잡을 것이 없는데 숙이면 떨어지려는 사람이 됩니다. */
    P.legs.forEach((l, i) => {
      l.rotation.x = -1.24 + Math.sin(t * 1.6 + i * 2.1) * .10;
      l.rotation.z = (i ? .12 : -.12);
    });
    P.shins.forEach((s, i) => { s.rotation.x = 1.02 + Math.sin(t * 1.6 + i * 2.1 + .6) * .18; });
    /* 팔은 그냥 늘어뜨립니다. 뒤로 짚는 자세를 해 봤는데, 이 인형은
       팔이 0.42m 뿐이라 손이 구름에 못 닿고 허공을 짚었습니다 —
       붙잡을 것이 없다는 것은 다리가 흔들리는 것으로 이미 말합니다. */
    P.arms.forEach((r, i) => {
      r.rotation.x = -.05 + Math.sin(t * 1.6 + i * 2.1) * .12;
      r.rotation.z = g.userData.base.armZ[i] * .8;
    });
  } else if (id === 'ride-kick') {
    /* 발은 **앞뒤로** 벌립니다. 나란히 두면 발판 위에 차렷으로 선 것이
       됩니다 — 킥보드는 한 발이 앞, 한 발이 뒤에 있어야 킥보드입니다. */
    P.legs[0].rotation.x = -.22; P.legs[1].rotation.x = .17;
    P.shins[0].rotation.x = .20; P.shins[1].rotation.x = .04;
    P.legs.forEach((l, i) => { l.rotation.z = (i ? 1 : -1) * .05; });
    P.arms.forEach((r, i) => { r.rotation.x = -1.0; r.rotation.z = (i ? -1 : 1) * .14; });
  } else {
    /* 롤러스케이트만 예외입니다 — **신는 것**이라 발을 따라다녀야 합니다.
       한 번만 정강이에 옮겨 붙이면 그 뒤로는 공짜로 따라옵니다. 프레임마다
       발 행렬을 베껴 옮기는 것보다 싸고, 발이 흔들릴 때 한 프레임씩
       뒤처지지도 않습니다.
       그래서 이것 하나만 다리를 움직입니다. 다만 걷는 것이 아니라
       **미는 것**입니다 — 한쪽 발이 바깥으로 밀고 나머지 한쪽은
       미끄러집니다. 2D 에서 "타는데 걷는다" 는 지적을 받은 자리가 여기라,
       무릎을 앞뒤로 접는 stride 와 겹치지 않게 좌우로만 엽니다. */
    if (G && G.userData.boots && g.userData.rideBoots !== G.userData.boots) {
      g.userData.rideBoots = G.userData.boots;
      G.userData.boots.forEach((b, i) => {
        P.shins[i].add(b);                          // add 가 옛 부모에서 알아서 뺍니다
        b.position.set(0, -.26, .02); b.rotation.set(0, 0, 0);
      });
    }
    const ph = d / 1.6 * TAU;                       // 한 번 밀 때마다 1.6m
    P.legs.forEach((l, i) => {
      const q = Math.sin(ph + i * Math.PI);
      l.rotation.x = -q * .14;
      l.rotation.z = (i ? 1 : -1) * (.09 + Math.max(0, q) * .34);
    });
    P.shins.forEach((s, i) => { s.rotation.x = Math.max(0, Math.sin(ph + i * Math.PI)) * .34; });
    P.arms.forEach((r, i) => {
      r.rotation.x = -.34 + Math.sin(ph + i * Math.PI) * .30;
      r.rotation.z = (i ? 1 : -1) * .34;            // 팔을 벌려 균형
    });
    P.torso.rotation.y = Math.sin(ph) * .10;
  }
  /* 눈은 계속 깜빡여야 합니다. stride 도 idle 도 안 도는 동안 이걸
     빼먹으면 타고 가는 사람만 눈을 안 감습니다. */
  blink(P, t, g.userData.seed || 0);
  return g;
}

/** 내리기 — 서 있는 뼈대로 되돌립니다. 이걸 안 부르면 stride/idle 이
    돌아와도 몸이 0.28m 뜬 채 걷고, 스케이트는 정강이에 붙은 채 남습니다.
    되돌리는 것도 sit·slouch 로 합니다 — 켤 때와 끌 때가 같은 기계여야
    한쪽만 고쳐 두는 일이 없습니다. */
export function rideOff(g) {
  const P = g && g.userData && g.userData.parts; if (!P) return g;
  const b = g.userData.rideBoots;
  if (b) {
    b.forEach((x) => { if (x.userData.home) x.userData.home.add(x); });
    g.userData.rideBoots = null;
  }
  sit(g, false);
  slouch(g, 0);
  P.torso.rotation.y = 0; P.torso.rotation.z = 0;
  P.head.rotation.z = 0;
  g.position.y = 0;
  g.userData.riding = null;
  return g;
}

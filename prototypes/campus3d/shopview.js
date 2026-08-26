/* ══════════════════════════════════════════════════════════
   상점 미리 보기 — 파는 것을 **그 물건 그대로** 보여 줍니다.

   지금 상점은 옷도 가구도 탈것도 알도 전부 글자 단추입니다. 색 동그라미
   하나와 그림문자 하나로 "빈백" 과 "서랍장" 을 갈라 보라는 것인데, 스물넷을
   한 판에 늘어놓으면 그림문자가 서로 닮아서 결국 이름을 읽게 됩니다. 2D
   판에서는 물건 그림이 옆에 있었고, 옷은 **입은 그림**이 같이 있었습니다.
   사는 사람이 알고 싶은 것은 이름이 아니라 생김새입니다.

   여기서 하는 일은 셋입니다.
     itemThumb    물건 하나를 칸 하나에 그립니다(한 번만).
     dressPreview 내 캐릭터를 세워 두고, 안 사고도 걸쳐 봅니다.
     disposeAll   판을 접습니다.

   ── 이 파일이 지키는 세 가지 ──

   1. **판(WebGLRenderer)은 하나뿐입니다.**
      가구 창 하나가 스물넷을 한꺼번에 폅니다. 칸마다 판을 만들면 브라우저가
      허락하는 컨텍스트(보통 열여섯)를 그 자리에서 넘겨서, 가장 오래된 것부터
      강제로 잃습니다 — 그 가장 오래된 것이 월드 본판입니다. 창 하나를 열었다고
      섬이 까매집니다. 그래서 안 보이는 판 하나에 그려서 칸으로 **옮겨 담습니다.**

      옮겨 담는 그릇은 칸마다 `<canvas>` 입니다. data URL 도 됩니다만, 스물넷이면
      PNG 를 스물네 번 짜고(주 스레드에서 수 ms 씩) 다시 스물네 번 풉니다.
      `drawImage` 는 그 두 가지가 다 없고, 기기 픽셀을 그대로 옮기므로 더
      또렷합니다. 옷장 미리 보기는 어차피 매 프레임 다시 그려야 해서 캔버스가
      필요한데, 두 길을 하나로 합칠 수 있는 것도 캔버스 쪽입니다.

   2. **보이는 것만 그립니다.**
      이 창들은 이미 3D 월드와 웹캠 자세 추정이 나눠 쓰는 GPU 위에 뜹니다.
      스크롤해서 눈에 들어온 칸만, 그것도 **딱 한 번** 그립니다(IntersectionObserver).
      한 프레임에 몰아 그리면 그 프레임이 길어지므로 시간을 재서 나눠 그립니다.
      옷장 미리 보기만 계속 도는데, 그것도 보일 때만 돌고 초당 프레임을 묶어 둡니다.

   3. **월드와 같은 얼굴이어야 합니다.**
      빛과 톤 매핑은 index.html 의 얼굴 창(pipR)에서 그대로 가져왔습니다.
      다른 값을 새로 고르면 상점 안의 물건만 다른 게임에서 온 것처럼 보입니다.
      바탕은 비웁니다 — 창의 제 바탕색이 비쳐야 창의 일부로 읽힙니다. 대신
      바닥에 옅은 그림자 원반을 하나 깝니다. 이것이 없으면 가구가 떠 있습니다.

   ── 버리는 규칙 ──
   기하는 **안 버립니다.** chars.js 의 곳간(RAW·접기)과 room.js 의 GEOS 는 여러
   사람이 같이 보고 있고, 두 파일이 주석으로 버리지 말라고 못 박아 두었습니다.
   자주 다시 짓는 길(옷장에서 걸쳐 보기)은 기하를 새로 만들지 않고 그 곳간에서
   꺼내 쓰므로, 안 버려도 안 붑니다.
   재질은 M() 이 부를 때마다 새로 만드는 것이라 셈을 해 두었다가 아무도 안 보면
   버립니다. room.js 의 P() 처럼 나눠 쓰는 재질이 섞일 수 있어서, 이 모듈이 만든
   덩이 **둘 이상**이 같은 재질을 보고 있으면 손대지 않습니다. 셈이 어긋나 잘못
   버려도 three 는 다음 그림에서 그 재질을 다시 올릴 뿐이라 화면이 깨지지는
   않습니다 — 버려서 새는 것보다 이쪽이 눈에 안 띄는 잘못입니다.
   ══════════════════════════════════════════════════════════ */

import * as THREE from 'three';
import {
  SPECIES, WEAR, RIDES,
  character, normalizeLook, applyTint, idle, ride, rideOn,
} from './chars.js';
import { eggStand } from './room.js';
import { decorItem } from './rooms.js';

/* ── 값 ── 손댈 일이 생기면 여기만 봅니다 */
const DPR_CAP = 2;          // 기기 픽셀 배수 천장. 3배 화면에서 9배 그리면 안 됩니다
const BUF_CAP = 1536;       // 속판 한 변 천장(기기 픽셀)
const THUMB_FALLBACK = 72;  // 칸 크기를 못 재면 쓰는 값
const BUDGET_MS = 7;        // 한 프레임에 썸네일에 쓸 시간
const CACHE_MAX = 64;       // 지어 둔 물건을 몇 개까지 들고 있을지(품목이 쉰 남짓)
const PREVIEW_FPS = 30;     // 옷장 미리 보기 프레임 천장
const SPIN = 0.5;           // 옷장 미리 보기가 도는 빠르기(라디안/초)

/* 눈이 있는 쪽. 물건은 비스듬히 위에서 봐야 앞면과 옆면이 같이 보여 입체로
   읽힙니다. 옷은 이미 몸을 돌려 놓으므로 거의 정면에서 조금만 내려다봅니다. */
const OFF_ITEM = new THREE.Vector3(0.62, 0.46, 1);
const OFF_WEAR = new THREE.Vector3(0.18, 0.14, 1);
const OFF_HEAD = new THREE.Vector3(0.16, 0.30, 1);
/* 옆구리에 걸리는 물건을 보는 눈. 몸을 돌리면 가방의 넓은 면이 같이
   돌아가서 옆날만 보이므로, 몸은 거의 그대로 두고 눈만 오른쪽으로
   조금 옮깁니다. 많이 돌리면 이번에는 가방이 납작해집니다. */
const OFF_SIDE = new THREE.Vector3(0.40, 0.18, 1);

/* ══ 옷을 입혀 보이는 길 ══ (마네킹)
   몸에 입혀 세우고 그 칸에 해당하는 데를 잘라 봅니다. **상점 칸은 이제 이
   길로 안 갑니다** — 옷 한 장만 띄우는 길이 따로 있습니다(아래 opt.bare).
   여기는 dressPreview 가 쓰는 몸과 "입은 그림"이 필요한 자리에 남겨 둡니다.

   처음에 옷을 몸에 입혀 보인 까닭은 옷 한 장이 혼자 두면 무슨 모양인지
   모를 천 덩어리라서였습니다. 그 걱정 자체는 맞습니다 — 아래 bare 길은
   그것을 골조와 자세와 눈높이로 풉니다. 걱정이 없어서 지운 것이 아니라
   푸는 방법이 따로 있어서 나눈 것이니, 이 길을 지우지 마십시오.

   자르는 상자는 손으로 적습니다. 지은 덩이의 경계 상자를 그대로 쓰면 모자를
   보여 주려는데 발끝까지 들어와서, 모자가 열 픽셀이 됩니다.

   y 값은 chars.js 의 뼈대 좌표입니다(발바닥이 -0.13, 몸통 시작이 0.44,
   목이 1.30, 머리가 1.48). ry 는 몸을 돌려 두는 각도입니다.

   앞뒤 두께(hz)를 좌우 너비(hx)와 따로 적는 것은, 상자를 정육면체로 두면
   **앞면 아래 귀퉁이**가 화면 가장자리를 밀어내서 카메라가 필요 이상으로
   물러서기 때문입니다. 사람은 옆으로 넓고 앞뒤로 얇습니다. 한 값으로
   묶었더니 상의 칸에 머리부터 허벅지까지 다 들어왔습니다. */
const WEAR_VIEW = {
  top:     { y0: 0.54, y1: 1.30, ry: -0.42, off: OFF_WEAR, hx: 0.46, hz: 0.26 },
  bottom:  { y0: -0.12, y1: 0.72, ry: -0.42, off: OFF_WEAR, hx: 0.34, hz: 0.30 },
  shoes:   { y0: -0.18, y1: 0.24, ry: -0.62, off: OFF_HEAD, hx: 0.30, hz: 0.32 },
  /* 모자 칸의 위쪽을 넉넉히 잡는 것은 기린의 뿔과 학사모의 판이 머리보다
     위로 솟기 때문입니다. 딱 맞게 자르면 학사모 귀퉁이가 잘립니다. */
  hat:     { y0: 1.34, y1: 2.14, ry: -0.22, off: OFF_HEAD, hx: 0.38, hz: 0.36 },
  glasses: { y0: 1.32, y1: 1.88, ry: -0.10, off: OFF_WEAR, hx: 0.30, hz: 0.30 },
  bag:     { y0: 0.52, y1: 1.12, ry: Math.PI - 0.25, off: OFF_WEAR, hx: 0.34, hz: 0.30 },
};
/* 칸으로 묶이지 않는 예외. 에코백은 등이 아니라 **옆구리**에 걸립니다 —
   가방 칸이라고 뒤를 보여 주면 빈 등만 나옵니다. */
const WEAR_VIEW_ID = {
  tote: {
    y0: 0.36, y1: 1.06, ry: -0.22, off: OFF_SIDE, hx: 0.29, hz: 0.24, cx: 0.36,
    /* 에코백은 팔 **뒤**에 걸립니다. 재 보니 가방(0.26~0.58)과 팔뚝(0.26~0.55)이
       좌우로도 앞뒤로도 거의 같은 자리라, 어느 쪽에서 봐도 팔이 가방을 덮어
       파란 띠 한 줄만 남았습니다. 카메라를 아무리 돌려도 안 됩니다 — 가려진
       쪽이 움직이지 않으니까요. character() 가 돌려주는 뼈대에서 오른팔을
       잠깐 벌려 둡니다. sit() · idle() 이 하는 일과 같은 일이고, 마네킹은
       걸어 다닐 일이 없으니 이 자세로 서 있어도 됩니다. */
    pose(g) {
      const P = g.userData && g.userData.parts;
      if (!P || !P.arms || !P.arms[1]) return;
      P.arms[1].rotation.z = 0.95;
      P.arms[1].rotation.x = -0.12;
    },
  },
};
/* 옷 칸 ↔ 차림표의 열쇠. index.html 의 LOOK_SLOTS 와 같은 짝입니다 */
const LOOK_KEY = {
  top: ['topId', 'top'], bottom: ['bottomId', 'bottom'], shoes: ['shoesId', 'shoes'],
  hat: ['hatId', 'hat'], glasses: ['glassesId', null], bag: ['bagId', 'bagC'],
};
/* 옷 id 로 칸을 되찾는 표. WEAR 에서 깎아 냅니다 — 손으로 적어 두면 옷을
   하나 늘렸을 때 그 옷만 조용히 안 보입니다. */
const SLOT_OF = {};
Object.keys(WEAR).forEach((s) => WEAR[s].forEach(([id]) => {
  if (id !== 'none' && !(id in SLOT_OF)) SLOT_OF[id] = s;
}));

/* 마네킹 기본 차림. 파는 옷 한 장만 눈에 들어와야 하니 나머지는 조용한
   색으로 깔아 둡니다. 부르는 쪽이 제 차림을 넘기면 그것이 이깁니다 —
   내 색으로 입은 그림이 더 사고 싶은 그림입니다. */
const MANNEQUIN = {
  topId: 'tee', top: 0x2DD4BF, bottomId: 'jeans', bottom: 0x3E5C82,
  shoesId: 'sneakers', shoes: 0xF2F2F2, hatId: 'none', hat: 0xE8695A,
  glassesId: 'none', bagId: 'none', bagC: 0x4A6EA8,
};
/* 마네킹은 **거북이가 아니어야 합니다.** 거북이는 가방 대신 등딱지를 멥니다
   (chars.js 가 그렇게 갈라 둡니다). 거북이로 세우면 가방 칸 두 개가 등딱지
   사진이 됩니다 — 실제로 그렇게 나왔습니다. 기린은 등이 비어 있고 털색이
   연해서 어떤 옷 색을 올려도 옷이 옷으로 읽힙니다. */
const MANNEQUIN_SPECIES = '기린';

/* ══ 옷 한 장만 ══ (opt.bare)

   판 주인이 마네킹을 물렸습니다 — "티셔츠면 티셔츠 하나만 띄우도록 해".
   그래서 몸을 지우고 옷만 남깁니다. 지우는 것이지 **안 짓는 것이
   아닙니다.** 이 파일에는 옷만 따로 짓는 길이 없고, chars.js 의 옷은
   처음부터 몸을 둘러싸며 빚어집니다 — 상의는 옆선 하나를 돌린 회전체고
   소매는 어깨에서 뻗은 원기둥이며 바지는 허벅지 원기둥입니다. 몸을 안
   세우면 그 좌표가 통째로 사라지므로, 몸은 그대로 세워 두고 **안 보이게만**
   합니다. 옷이 기대고 있는 골조라서 그렇습니다. 값은 거의 안 듭니다 —
   안 그리는 메시는 그리는 값이 없고, 어차피 한 번 짓고 곳간에 둡니다.

   ── 무엇이 몸이고 무엇이 옷인가 ──
   손으로 적으면 옷을 하나 늘렸을 때 그 옷만 조용히 몸을 달고 나옵니다.
   그래서 chars.js 가 이미 들고 있는 것에서 알아냅니다.

     · **살색 재질은 하나뿐**이고 그 하나가 목 메시에 그대로 붙어 있습니다.
       목(parts.neck)은 접기를 안 거치는 유일한 몸 조각이라 재질이 살아
       있습니다. 손 · 팔뚝 · 맨정강이 · 무릎 · 슬리퍼의 맨발이 전부 그
       하나를 봅니다 — 그 재질을 보는 덩이만 걷으면 살이 다 사라집니다.
       접기가 살을 옷과 한 덩이로 굽는 일은 없습니다. 옷 재질은 염색
       대상이라 접기가 재질 하나하나를 따로 가둬 두기 때문입니다.
     · 칸마다 **염색 대상 재질 목록**(parts.wear[칸].mats)이 있습니다.
       상의 칸에서 허리춤(하의 재질)을 지우고, 하의 칸에서 상의를 지우는
       데 이것을 씁니다.
     · 모자 · 안경은 머리 밑의 **따로 된 그룹**이고 가방은 몸 밑의 따로 된
       그룹입니다. 그룹째 켜고 나머지를 끕니다. 모자 칸에서는 안경을,
       안경 칸에서는 모자를 벗겨 두므로 머리 밑의 그룹은 늘 하나뿐입니다.

   신발만 이 셋으로 안 갈립니다. 접기가 신발을 정강이 마디에 **같이**
   구웠고(정강이와 같이 움직이니 맞는 결정입니다) 운동화 앞코와 구두
   밑창은 염색 대상이 아니라 목록에도 없습니다. 그래서 하의 칸에서만
   **발목 높이로 자릅니다**(ANKLE). 하의 칸은 신발을 구두로 못 박아 두어서
   신발 조각이 전부 y -0.08 아래에 있고, 바지에서 가장 낮은 것이 청바지
   밑단 접기의 -0.01 입니다. 사이가 0.07 이라 넉넉합니다.

   ── 왜 이래도 옷이 안 무너지는가 ──
   천이 아니라 **굳은 덩이**라서 그렇습니다. 몸을 지워도 상의는 위아래가
   막힌 달걀이고 바지는 원기둥 둘입니다. 대신 두 가지를 손봅니다.
   소매는 벌려 두고(몸에 붙은 소매는 74px 에서 몸통 실루엣에 먹힙니다)
   신발은 좌우로 조금 밀어 둡니다(붙여 두면 한 켤레가 아니라 덩어리
   하나로 보입니다). 자세를 만지는 것은 WEAR_VIEW_ID.tote 가 이미 하던
   일과 같습니다.

   ── 눈이 있는 쪽 ──
   마네킹은 몸을 돌려 세워서 거의 정면에서 봤습니다. 옷 한 장은 정면에서
   보면 납작한 색종이라, 앞면과 옆면이 같이 보이는 **비스듬한 자리**에서
   봅니다(가로 30도 안팎). 높이는 물건마다 다릅니다 — 신발은 위에서
   내려다봐야 두 짝이 갈라지고, 안경은 눈높이여야 두 알이 동그랗습니다. */
const OFF_BARE_TOP   = new THREE.Vector3(0.60, 0.15, 1);
const OFF_BARE_BOT   = new THREE.Vector3(0.56, 0.09, 1);
const OFF_BARE_SHOE  = new THREE.Vector3(0.66, 0.20, 1);
const OFF_BARE_HAT   = new THREE.Vector3(0.54, 0.26, 1);
const OFF_BARE_GLASS = new THREE.Vector3(0.44, 0.10, 1);
const OFF_BARE_BAG   = new THREE.Vector3(0.56, 0.18, 1);
/* 발목 — 이 아래는 신발입니다. 위 머리말의 셈 참고 */
const ANKLE = -0.05;
/* 자세를 만질 때 쓰는 임시 행렬. 만지는 일은 짓는 동안 한 번뿐이라
   하나를 돌려 씁니다 */
const _pose = new THREE.Matrix4();

/** 덩이 하나가 놓인 자리(월드 경계 상자). 형상 경계 상자를 자리로
    옮겨서 잽니다. 돌려주는 상자는 **다음 부름에 덮어씁니다** */
const _mb = new THREE.Box3();
function meshBox(o) {
  const G = o.geometry;
  if (!G) return _mb.makeEmpty();
  if (!G.boundingBox) G.computeBoundingBox();
  return _mb.copy(G.boundingBox).applyMatrix4(o.matrixWorld);
}
const meshLow = (o) => meshBox(o).min.y;
const meshHigh = (o) => meshBox(o).max.y;
/** 조건에 맞는 덩이를 끕니다. 마디 안을 다 훑습니다 */
function hideIf(root, pred) {
  root.traverse((o) => { if (o.isMesh && pred(o)) o.visible = false; });
}
/** 그 칸의 염색 대상 재질들 */
function matSet(P, k) {
  const w = P.wear && P.wear[k];
  return new Set(w ? w.mats.map((m) => m[0]) : []);
}
/** 머리 밑의 딸린 그룹 — 모자 아니면 안경. 둘 중 하나만 달아 둡니다 */
function headSub(P) {
  return P.head && P.head.children.find((c) => !c.isMesh);
}
/** 몸 밑의 딸린 그룹 — 가방(거북이면 등딱지). 아는 마디를 빼서 찾습니다.
    이름으로 찾지 않는 것은 chars.js 가 이름을 안 붙이기 때문입니다. */
function carryOf(P, body) {
  const known = new Set([P.torso, P.head, P.neck].concat(P.legs, P.arms));
  return body.children.find((c) => c && !known.has(c));
}
/** **보이는** 것만으로 경계 상자를 냅니다. Box3.setFromObject 은 꺼 둔
    덩이까지 넣기 때문에, 그것으로 재면 지운 몸이 상자를 그대로 넓혀서
    티셔츠 한 장이 사람 크기 상자 한가운데 점으로 앉습니다. */
const _vb = new THREE.Box3();
function visibleBox(root) {
  const out = new THREE.Box3();
  const walk = (o) => {
    if (!o.visible) return;
    if (o.isMesh && o.geometry) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      out.union(_vb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
    }
    o.children.forEach(walk);
  };
  walk(root);
  return out;
}

/** 보이는 옷 조각만 독립 그룹으로 떼어 냅니다.
    숨긴 캐릭터의 마디 아래에 옷을 둔 채 그리면 부모 visible 상태와 접힌
    행렬의 조합에 따라 카드가 통째로 비는 브라우저가 있었습니다. 월드 행렬을
    그대로 복사한 메시만 새 그룹에 담으면 결과에는 몸도, 숨은 부모도 없습니다. */
function flattenVisible(root) {
  root.updateMatrixWorld(true);
  const flat = new THREE.Group();
  const walk = (o) => {
    if (!o.visible) return;
    if (o.isMesh && o.geometry && o.material) {
      const m = new THREE.Mesh(o.geometry, o.material);
      m.matrixAutoUpdate = false;
      m.matrix.copy(o.matrixWorld);
      m.castShadow = false;
      m.receiveShadow = false;
      flat.add(m);
    }
    o.children.forEach(walk);
  };
  walk(root);
  flat.updateMatrixWorld(true);
  return flat;
}

/* 옷 한 장을 볼 때 나머지 칸을 못 박아 둡니다. 골조는 안 보이지만
   **어디에 있는지**는 정해져 있어야 잘라 내는 규칙이 매번 맞습니다.
   신발 칸에 반바지를 입히는 것은 맨정강이가 살색이 되어 살 규칙 하나로
   같이 걷히기 때문이고, 하의 칸에 구두를 신기는 것은 구두가 발목 아래로
   가장 깊이 내려가 자르는 자리가 가장 넉넉해지기 때문입니다.

   show 는 보일 것만 켜고(부르기 전에 몸의 마디를 전부 꺼 둡니다) **무엇을
   재서 칸에 맞출지**를 돌려줍니다. 거짓을 돌려주면 그 칸은 안 그립니다. */
const BARE = {
  top: {
    off: OFF_BARE_TOP, pad: 0.10,
    fit: { bottomId: 'jeans', shoesId: 'sneakers', hatId: 'none', glassesId: 'none', bagId: 'none' },
    show(P, K, body) {
      P.torso.visible = true;
      /* ponytail: 카드 그림에서 옷 뒤에 크림색 몸통이 남습니다. 74px
         에서는 그 덩이가 옷보다 커서 반팔티·후드티·셔츠·과잠이 거의
         같은 그림으로 보입니다. `o.material === K.skin` 도, 상의 재질만
         남기는 `!matSet(P,'top').has(...)` 도 시험해 봤는데 전자는 아무
         것도 안 지우고 후자는 카드를 통째로 비웁니다 — 몸통 메시가
         P.wear.top 의 재질 목록과 안 맞습니다. chars.js 쪽 골조를 보고
         고쳐야 하는 자리라 지금은 원래대로 둡니다. */
      hideIf(P.torso, (o) => K.bottom.has(o.material));   // 허리춤은 하의입니다
      P.arms.forEach((a, i) => {
        a.visible = true;
        /* 소매를 **크게** 벌립니다. 팔은 기본이 겨드랑이에 붙은 0.22 라,
           몸을 지우고 나면 소매가 몸통 옆선에 먹혀서 74px 에서는 소매가
           있는지조차 안 보입니다 — 종 모양 덩어리 하나가 됩니다. 옷을
           펴 놓고 찍은 사진처럼 벌려야 상의로 읽힙니다. 어깨 관절은
           제자리라 아무리 벌려도 몸통에서 안 떨어집니다. */
        a.rotation.z = (i ? 1 : -1) * 1.02;
        a.rotation.x = -0.20;
        hideIf(a, (o) => o.material === K.skin);          // 팔뚝과 손
      });
      return body;
    },
  },
  bottom: {
    off: OFF_BARE_BOT, pad: 0.10,
    fit: { topId: 'tee', shoesId: 'dress', hatId: 'none', glassesId: 'none', bagId: 'none' },
    show(P, K, body) {
      /* 허리춤만 남깁니다 — 바지는 허리가 있어야 바지로 보입니다 */
      P.torso.visible = true;
      hideIf(P.torso, (o) => !K.bottom.has(o.material));
      P.legs.forEach((l, i) => {
        l.visible = true;
        l.position.x = (i ? 1 : -1) * 0.21;               // 가랑이를 조금 벌립니다
        /* 살(반바지의 무릎과 맨정강이)과 신발을 걷습니다. 트레이닝 옆줄은
           염색 대상이 아니지만 발목 위라 그대로 남습니다. */
        hideIf(l, (o) => o.material === K.skin || meshLow(o) < ANKLE);
      });
      return body;
    },
  },
  shoes: {
    off: OFF_BARE_SHOE, pad: 0.12, ground: 1.0,
    fit: { topId: 'tee', bottomId: 'shorts', hatId: 'none', glassesId: 'none', bagId: 'none' },
    show(P, K, body) {
      P.legs.forEach((l, i) => {
        /* 마디는 켜 두고 그 마디의 덩이만 끕니다 — 신발이 정강이 **밑에**
           달려 있어서, 다리를 통째로 끄면 신발까지 같이 꺼집니다. */
        l.visible = true;
        l.children.forEach((c) => { if (c.isMesh) c.visible = false; });
        /* 나란히 두면 가로로만 긴 상자가 되어, 세로가 74px 인 칸에서
           두 짝이 다 작아집니다. 한 짝을 앞으로 내어 어긋나게 놓으면
           상자가 네모에 가까워지고 앞뒤로 겹쳐서 **한 켤레**로 읽힙니다. */
        l.position.x = (i ? 1 : -1) * 0.15;
        l.position.z = (i ? -1 : 1) * 0.10;
      });
      P.shins.forEach((sh, i) => {
        sh.rotation.y = (i ? 1 : -1) * 0.20;              // 발끝을 조금 벌립니다
        hideIf(sh, (o) => o.material === K.skin);         // 맨정강이와 슬리퍼의 맨발
      });
      return body;
    },
  },
  hat: {
    off: OFF_BARE_HAT, pad: 0.12,
    fit: { glassesId: 'none', bagId: 'none' },
    show(P) { return onlySub(P); },
  },
  glasses: {
    off: OFF_BARE_GLASS, pad: 0.06,
    fit: { hatId: 'none', bagId: 'none' },
    show(P) { return onlySub(P); },
  },
  bag: {
    off: OFF_BARE_BAG, pad: 0.10,
    fit: { hatId: 'none', glassesId: 'none' },
    show(P, K, body) {
      const c = carryOf(P, body);
      if (!c) return false;
      c.visible = true;
      return c;
    },
  },
};
/** 머리 밑에 딸린 그룹 하나만 켭니다(모자 칸이면 모자, 안경 칸이면 안경).
    눈알은 접기에서 빠져 머리 밑에 그대로 남아 있으므로 같이 꺼야 합니다. */
function onlySub(P) {
  const sub = headSub(P);
  if (!sub) return false;                                 // "없음" 을 고른 칸
  P.head.visible = true;
  P.head.children.forEach((c) => { c.visible = (c === sub); });
  return sub;
}

/* 칸으로 안 묶이는 예외 셋. 셋 다 **몸에 걸리는 자세 그대로**라서 몸을
   지우면 어색해지는 것들입니다. 손보는 자리는 셋뿐이고, 손보는 값은 전부
   chars.js 의 뼈대 좌표에서 재 온 것이라 옆에 셈을 적어 둡니다. */
const BARE_ID = {
  backpack: {
    /* 끈 두 가닥이 앞면에 나란해야 배낭입니다. 많이 비틀어 보면 한
       가닥이 실루엣 모서리에 겹쳐 솔기가 되므로, 이 칸만 덜 돌립니다. */
    off: new THREE.Vector3(0.34, 0.22, 1),
    pose(c) {
      /* 어깨끈은 **가장 높이 솟은** 덩이입니다 — 어깨까지 0.41 올라가고
         가방 몸통은 0.12 에서 끝납니다. 둘을 따로 다룹니다.

         몸통은 눕혀 놓은 것을 세웁니다. 접힌 덩이는 제 자리를 행렬에
         구워 두고 그 행렬이 그룹 원점을 기준으로 삼으므로, 원점 둘레로
         돌리면 그 자리에서 섭니다.

         끈은 두 가닥이 한 덩이로 구워져 있어 따로 못 옮깁니다. 대신
         원점 둘레로 **오므려서** 몸통 앞면에 붙입니다. 몸통은 옆선을
         돌린 회전체라 위아래로 갈수록 좁아지는데, 끈은 어깨까지 뻗어
         몸통보다 깁니다 — 가로만 오므리면 끈의 위아래 끝이 좁아진 데서
         실루엣 밖으로 삐져나와 옆에 붙은 날개가 됩니다. 그래서 세로도
         같이 줄여 몸통의 불룩한 가운데에 앉히고, 앞으로 조금 밀어 넣어
         **도드라진 줄**로 만듭니다. 두 가닥이 앞면을 세로로 지나가는
         것 — 그것이 배낭입니다. */
      const lump = c.children.filter((o) => o.isMesh);
      let strap = null, hi = -Infinity;
      lump.forEach((o) => { const t = meshHigh(o); if (t > hi) { hi = t; strap = o; } });
      _pose.makeRotationX(-Math.PI / 2);
      lump.forEach((o) => { if (o !== strap) o.matrix.premultiply(_pose); });
      if (strap) {
        strap.matrix.premultiply(_pose.makeScale(0.55, 0.62, 1));
        strap.matrix.premultiply(_pose.makeTranslation(0, -0.12, -0.10));
      }
    },
  },
  /* 어깨끈은 손잡이에 이어져 있습니다(끈 아래끝과 손잡이가 0.015 차이).
     다만 어깨까지 0.45 를 뻗어서, 그대로 재면 칸의 삼분의 이가 끈이고
     가방은 아래 귀퉁이의 작은 네모가 됩니다. 가방과 손잡이에 칸을 맞추고
     끈은 위로 흘려보냅니다 — 잘린 끈은 어깨에 메는 물건이라는 뜻입니다. */
  tote: { crop(box) { box.max.y = Math.min(box.max.y, 0.95); } },
  /* 슬리퍼는 발등 끈이 **맨발 위에** 얹혀 있습니다. 발을 지우면 끈이
     밑창에서 0.12 떠서, 널빤지 하나와 알약 하나가 됩니다. 끈만 내려
     붙입니다 — 발목 위(발목 금 위쪽)에 남은 덩이가 끈뿐이라 그것으로
     골라냅니다. 접힌 덩이는 자리를 제 행렬에 굽고 있으므로 행렬을
     밀어 줍니다. */
  slippers: {
    /* 슬리퍼는 밑창이 널빤지라 눈높이에서 보면 선 두 개입니다. 위에서
       내려다봐야 밑창의 윤곽이 보이고, 그래야 신발로 읽힙니다. */
    off: new THREE.Vector3(0.60, 0.46, 1),
    pose(node, P) {
      P.shins.forEach((sh) => sh.children.forEach((o) => {
        if (o.isMesh && o.visible && meshLow(o) > ANKLE) {
          o.matrix.premultiply(_pose.makeTranslation(0, -0.085, 0));
        }
      }));
    },
  },
};

/** '#3A3F4A' 도 0x3A3F4A 도 받습니다. 2D 판이 저장해 둔 색이 문자열이라
    그대로 넘어오는 길이 있고, 문자열이 chars.js 의 mix() 로 들어가면
    밑단 색이 NaN 이 됩니다 — 여기서 숫자로 못 박습니다. */
function hexOf(v) {
  if (v == null) return null;
  const n = typeof v === 'string' ? parseInt(v.replace('#', ''), 16) : Number(v);
  return isFinite(n) ? (n | 0) : null;
}

/* ══════════════════════════════════════════════════════════
   1. 판 하나
   ══════════════════════════════════════════════════════════ */

let R = null;               // 단 하나뿐인 WebGLRenderer
let SCENE = null, CAM = null, STAGE = null, SHADOW = null;
let LOST = null;            // 컨텍스트 분실 청취자 — 접을 때 반드시 떼야 합니다
let BW = 0, BH = 0;         // 속판 크기(기기 픽셀)
let DEAD = false;           // WebGL 을 못 쓰면 여기서 조용히 멈춥니다

const dpr = () => Math.min(window.devicePixelRatio || 1, DPR_CAP);

/** 그림자 원반 무늬. 그림자 지도를 켜는 대신 옅은 원 하나를 깝니다 —
    칸 하나에 그림자 패스를 붙이면 값이 두 배가 되는데, 이 크기에서는
    발치에 뭔가 어둡다는 것 말고는 아무도 구분하지 못합니다. */
function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(38,46,56,.40)');
  gr.addColorStop(0.5, 'rgba(38,46,56,.17)');
  gr.addColorStop(1, 'rgba(38,46,56,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 처음 쓸 때 한 번 세웁니다. 못 세우면 DEAD 로 두고 다시는 시도하지
    않습니다 — 판이 없는 기기에서 칸마다 예외를 던지면 창이 통째로 안 뜹니다. */
function boot() {
  if (R || DEAD) return R;
  try {
    const cv = document.createElement('canvas');
    R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    /* 기기 픽셀은 이 파일이 직접 셉니다. setPixelRatio 를 같이 쓰면 배수가
       두 번 곱해져서, 3배 화면에서 속판이 천장을 넘습니다. */
    R.setPixelRatio(1);
    R.setClearColor(0x000000, 0);
    R.toneMapping = THREE.ACESFilmicToneMapping;
    R.toneMappingExposure = 1.08;
    R.outputColorSpace = THREE.SRGBColorSpace;
    R.shadowMap.enabled = false;

    /* 빛은 index.html 의 얼굴 창과 같은 값입니다. 여기서 새 값을 고르면
       상점 안의 옷만 다른 색으로 보입니다. */
    SCENE = new THREE.Scene();
    SCENE.add(new THREE.AmbientLight(0xFFFFFF, 0.95));
    SCENE.add(new THREE.HemisphereLight(0xE8F4FF, 0xF6E6C4, 1.0));
    const key = new THREE.DirectionalLight(0xFFFAF0, 1.5); key.position.set(-3, 5, 6);
    const fil = new THREE.DirectionalLight(0xCFE4F5, 0.6); fil.position.set(4, 2, 3);
    SCENE.add(key, fil);

    STAGE = new THREE.Group();
    SCENE.add(STAGE);

    SHADOW = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: shadowTexture(), transparent: true, depthWrite: false, toneMapped: false,
      }),
    );
    SHADOW.rotation.x = -Math.PI / 2;
    SCENE.add(SHADOW);

    CAM = new THREE.PerspectiveCamera(30, 1, 0.05, 60);

    /* 컨텍스트를 잃으면(다른 탭이 GPU 를 다 먹거나 기기가 자거나) 조용히
       멈춥니다. 돌아오면 보고 있던 옷장만 다시 그립니다 — 스쳐 지나간
       썸네일까지 다 되살릴 이유는 없습니다. */
    const onLost = (e) => { e.preventDefault(); DEAD = true; };
    const onBack = () => {
      DEAD = false;
      PREVIEWS.forEach((p) => { p.built = false; });
      kick();
    };
    cv.addEventListener('webglcontextlost', onLost, false);
    cv.addEventListener('webglcontextrestored', onBack, false);
    LOST = { cv, onLost, onBack };
    return R;
  } catch {
    DEAD = true;
    R = null;
    return null;
  }
}

/** 속판은 **한 번 잡고 늘리기만** 합니다. 칸마다 setSize 를 부르면 그때마다
    그리기 버퍼를 다시 잡아서, 스물넷이면 스물네 번 다시 잡습니다. 대신 큰
    판 한 귀퉁이만 잘라 쓰고(뷰포트·시저) 그 조각을 옮겨 담습니다. */
function ensureBuf(pw, ph) {
  if (pw <= BW && ph <= BH) return;
  BW = Math.min(BUF_CAP, Math.max(BW, pw));
  BH = Math.min(BUF_CAP, Math.max(BH, ph));
  R.setSize(BW, BH, false);
}

/* ══ 카메라 맞추기 ══
   상자 여덟 귀퉁이가 화면 안에 **꼭 맞게** 들어오는 거리를 한 번에 구합니다.
   경계 구(球)로 재면 아령처럼 납작한 것과 캣타워처럼 긴 것이 같은 크기로
   나와서, 작은 물건이 유난히 작게 보입니다. 눈은 늘 상자 가운데를 봅니다. */
const _c = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3();
const _u = new THREE.Vector3(), _p = new THREE.Vector3();
const UPW = new THREE.Vector3(0, 1, 0);
function frame(cam, box, off, pad) {
  box.getCenter(_c);
  _f.copy(off).normalize();                     // 가운데에서 눈이 있는 쪽
  _r.crossVectors(UPW, _f);
  if (_r.lengthSq() < 1e-8) _r.set(1, 0, 0);
  _r.normalize();
  _u.crossVectors(_f, _r).normalize();
  const tv = Math.tan(cam.fov * Math.PI / 360) * (1 - pad);
  const th = tv * cam.aspect;
  let d = 0.001, rad = 0;
  for (let i = 0; i < 8; i++) {
    _p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y,
      i & 4 ? box.max.z : box.min.z).sub(_c);
    rad = Math.max(rad, _p.length());
    /* 눈까지의 깊이가 d - z 이므로, |x| ≤ th·(d-z) 를 d 에 대해 풉니다 */
    const z = _p.dot(_f);
    d = Math.max(d, Math.abs(_p.dot(_r)) / th + z, Math.abs(_p.dot(_u)) / tv + z);
  }
  cam.position.copy(_c).addScaledVector(_f, d);
  cam.lookAt(_c);
  cam.near = Math.max(0.05, d - rad * 1.6);
  cam.far = d + rad * 3;
  cam.updateProjectionMatrix();
}

/** 물건 하나를 속판 한 귀퉁이에 그리고 칸 캔버스로 옮겨 담습니다. */
function paint(cv2, group, box, off, pad, ground) {
  const pw = cv2.width, ph = cv2.height;
  if (!pw || !ph) return false;
  ensureBuf(pw, ph);
  if (pw > BW || ph > BH) return false;         // 천장을 넘는 요청은 조용히 거릅니다

  STAGE.add(group);
  /* 그림자는 물건이 바닥에 서 있을 때만 깝니다. 모자만 잘라 보는 칸에
     발치 그림자를 깔면 허공에 얼룩이 하나 뜹니다.
     ground 는 참·거짓이 아니라 **배수**입니다. 가구는 상자가 곧 물건이라
     넉넉히 퍼뜨려도 되지만, 사람은 상자를 손으로 잡아 두어서 물건보다
     상자가 큽니다 — 같은 배수를 쓰면 발밑에 큰 얼룩이 따로 놉니다. */
  if (ground) {
    const w = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    SHADOW.position.set((box.min.x + box.max.x) / 2, box.min.y + 0.004, (box.min.z + box.max.z) / 2);
    SHADOW.scale.setScalar(Math.max(0.3, w * (typeof ground === 'number' ? ground : 1.9)));
    SHADOW.visible = true;
  } else SHADOW.visible = false;

  CAM.aspect = pw / ph;
  frame(CAM, box, off, pad);

  /* 속판의 **왼쪽 위** 조각을 씁니다. WebGL 은 아래가 0 이라 y 를 뒤집어
     잡아야 2D 캔버스가 그대로 퍼 담을 수 있습니다. */
  R.setViewport(0, BH - ph, pw, ph);
  R.setScissor(0, BH - ph, pw, ph);
  R.setScissorTest(true);
  R.render(SCENE, CAM);
  R.setScissorTest(false);
  STAGE.remove(group);

  /* preserveDrawingBuffer 가 꺼져 있으므로 **같은 작업 안에서** 바로
     퍼 담아야 합니다. 다음 프레임으로 미루면 빈 그림이 옵니다. */
  const x2 = cv2.getContext('2d');
  x2.clearRect(0, 0, pw, ph);
  x2.drawImage(R.domElement, 0, 0, pw, ph, 0, 0, pw, ph);
  return true;
}

/* ══════════════════════════════════════════════════════════
   2. 물건 짓기 — 짓는 코드는 하나도 새로 안 씁니다
   ══════════════════════════════════════════════════════════ */

/* 이 모듈이 시작하기 전에 이미 있던 재질은 남의 것입니다. three 는 재질에
   만들어진 차례대로 번호를 매기므로, 시작할 때 번호를 한 번 찍어 두면 그
   뒤에 생긴 것만 골라낼 수 있습니다. 찍어 보는 재질 하나는 바로 버립니다. */
const MARK = (() => {
  const m = new THREE.MeshBasicMaterial();
  const v = { mat: m.id };
  m.dispose();
  return v;
})();
const OWNED = new Map();    // 재질 → 이 모듈이 지은 덩이 몇 개가 보고 있는지

function claim(group) {
  group.traverse((o) => {
    const m = o.material; if (!m) return;
    (Array.isArray(m) ? m : [m]).forEach((q) => {
      if (q.id > MARK.mat) OWNED.set(q, (OWNED.get(q) || 0) + 1);
    });
  });
}
function release(group) {
  if (!group) return;
  group.traverse((o) => {
    const m = o.material; if (!m) return;
    (Array.isArray(m) ? m : [m]).forEach((q) => {
      const n = (OWNED.get(q) || 0) - 1;
      if (n > 0) { OWNED.set(q, n); return; }
      OWNED.delete(q);
      if (q.id > MARK.mat) q.dispose();
    });
  });
  group.parent?.remove(group);
}

/** 부르는 쪽이 넘긴 차림을 이 모듈이 쓰는 모양으로 폅니다.
    옛 형식({style, top, bottom, shoe})도 받습니다 — NPC 차림표(OUTFITS)가
    그 형식이라, 그것을 그대로 넘기는 쪽이 반드시 생깁니다. normalizeLook 은
    **받은 객체에** 염색표를 달아 두므로 복사본을 넘깁니다. 부르는 쪽의
    SAVE.look 에 이 모듈이 손을 대면 안 됩니다. */
function baseLook(src) {
  if (!src) return Object.assign({}, MANNEQUIN, { tint: {} });
  const L = normalizeLook(Object.assign({}, src));
  const out = Object.assign({}, MANNEQUIN, L);
  out.tint = Object.assign({}, L.tint || {});
  return out;
}

/* 옷은 캐릭터 몸에서 떼어 내되, 허공에는 띄우지 않습니다. 가구 카드처럼
   클레이 전시대 위에 세워 상품 자체의 두께와 앞·옆면이 읽히게 합니다.
   전시대는 장착 대상이 아니고 썸네일 안에서만 존재합니다. */
function addWearDisplay(group, box, slot) {
  const w = Math.max(.42, box.max.x - box.min.x);
  const d = Math.max(.22, box.max.z - box.min.z);
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  const y0 = box.min.y;
  const cream = new THREE.MeshStandardMaterial({ color: 0xEEF4FA, roughness: .72, metalness: .02 });
  const blue = new THREE.MeshStandardMaterial({ color: 0xAFC7DD, roughness: .66, metalness: .03 });
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    group.add(m); return m;
  };
  const base = add(new THREE.CylinderGeometry(w * .68, w * .74, .085, 28), cream, cx, y0 - .11, cz);
  base.scale.z = Math.max(.72, d / Math.max(.2, w) * 1.25);
  add(new THREE.CylinderGeometry(w * .47, w * .53, .045, 28), blue, cx, y0 - .045, cz);
  if (slot === 'top' || slot === 'bottom' || slot === 'bag') {
    const rear = box.min.z - .055;
    const h = Math.max(.45, box.max.y - y0);
    const pole = add(new THREE.CylinderGeometry(.014, .014, h * .88, 10), blue,
      cx, y0 + h * .47, rear);
    const bar = add(new THREE.CylinderGeometry(.014, .014, w * .78, 10), blue,
      cx, box.max.y - h * .08, rear);
    bar.rotation.z = Math.PI / 2;
  } else if (slot === 'hat' || slot === 'glasses') {
    const h = Math.max(.25, box.max.y - y0);
    add(new THREE.CylinderGeometry(.018, .026, h * .58, 10), blue, cx, y0 + h * .25, cz - .04);
  }
  group.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(group);
}

/** 옷 한 장만 세웁니다(opt.bare). 몸은 지어 두되 안 보이게 합니다 —
    위 "옷 한 장만" 머리말에 왜 그래야 하는지 적어 두었습니다. */
function buildBare(id, opt) {
  const slot = opt.slot || SLOT_OF[id];
  const V = BARE[slot];
  const kk = LOOK_KEY[slot];
  if (!V || !kk || !id || id === 'none') return null;
  const X = BARE_ID[id] || {};

  /* 부르는 쪽 차림에서 색만 물려받고, 나머지 칸의 **종류**는 못 박습니다.
     골조가 매번 같은 자리에 있어야 잘라 내는 규칙이 매번 맞습니다. */
  const look = baseLook(opt.look);
  Object.assign(look, V.fit);
  look[kk[0]] = id;
  const col = hexOf(opt.color);
  if (kk[1] && col != null) {
    look[kk[1]] = col;
    /* opt.color 가 **이깁니다.** 안 지우면 부르는 쪽 차림에 남아 있던
       염색이 그 위를 덮어서, 과잠에 학교 색을 넘겨도 옷장에서 고른 색이
       나옵니다. 지우는 표는 baseLook 이 떠 준 복사본이라 안전합니다. */
    if (look.tint) delete look.tint[id];
  }

  const g = new THREE.Group();
  /* 종은 **안 받습니다.** 파는 것은 옷이지 그 옷을 입은 누구가 아니고,
     기린이라야 등이 비어 있어 가방 칸이 등딱지가 안 됩니다.
     lod 는 안 씁니다. 마네킹 칸은 사람 하나에 옷이 한 조각이라 성겨도
     실루엣이 남지만, 여기서는 그 한 조각이 칸을 다 채웁니다 — 성기게
     지으면 동그란테가 팔각형이 되고 반팔티 어깨에 각이 집니다. 한 품목에
     한 번만 짓고 곳간에 두는 길이라 값도 한 번뿐입니다. */
  /* 상품 카드에서는 원본 캐릭터가 아니라 **옷 한 장**을 떼어 냅니다.
     GLB 원본은 몸과 옷이 분리된 골조가 아니므로 P.neck이 없고 카드가 빈
     네모가 됩니다. 여기만 절차형 옷 골조를 강제하고, 오른쪽 입어보기와
     실제 월드 캐릭터는 계속 최신 원본 GLB를 사용합니다. */
  const body = character(g, MANNEQUIN_SPECIES, look, {
    ry: opt.ry ?? X.ry ?? V.ry ?? 0, procedural: true,
  });
  const P = body && body.userData && body.userData.parts;
  if (!P || !P.neck) return null;
  const K = { skin: P.neck.material, bottom: matSet(P, 'bottom') };

  /* 자리를 한 번 굳혀 두어야 발목 높이를 잽니다 */
  g.updateMatrixWorld(true);
  body.children.forEach((c) => { c.visible = false; });
  const node = V.show(P, K, body);
  if (!node) return null;
  if (X.pose) { try { X.pose(node, P, body); } catch { /* 자세는 덤입니다 */ } }
  /* 자세를 만졌으니 다시 굳히고 상자를 냅니다 */
  g.updateMatrixWorld(true);
  const flat = flattenVisible(body);
  let box = visibleBox(flat);
  if (box.isEmpty() || !isFinite(box.min.x)) return null;
  if (X.crop) { try { X.crop(box); } catch { /* 자르기도 덤입니다 */ } }
  box = addWearDisplay(flat, box, slot);
  return { group: flat, box, off: X.off || V.off, pad: Math.max(.08, (X.pad ?? V.pad) - .02), ground: 1.12 };
}

/** 옷 한 장을 마네킹에 입혀 세웁니다. 몸에 걸친 그림이 필요할 때만
    씁니다 — 상점 칸은 opt.bare 로 옷만 봅니다(buildBare). */
function buildWear(id, opt) {
  if (opt.bare) return buildBare(id, opt);
  const slot = opt.slot || SLOT_OF[id];
  const V = WEAR_VIEW_ID[id] || WEAR_VIEW[slot];
  const kk = LOOK_KEY[slot];
  if (!V || !kk) return null;
  const look = baseLook(opt.look);
  look[kk[0]] = id;
  if (kk[1] && opt.color != null) look[kk[1]] = opt.color;
  /* 가방 칸을 보여 주는 게 아니면 가방은 벗깁니다 — 등 뒤 가방이 상의
     밑단을 가려서, 후드티와 셔츠가 같은 그림이 됩니다. 굳이 메고 있는
     그림이 필요하면 opt.keepBag 으로 남길 수 있습니다. */
  if (slot !== 'bag' && !opt.keepBag) look.bagId = 'none';

  const g = new THREE.Group();
  const sp = SPECIES[opt.species] ? opt.species : MANNEQUIN_SPECIES;
  /* lod 1 — 이 크기에서 촘촘한 공과 성긴 공은 구분이 안 갑니다. 조각 구성도
     실루엣도 그대로라 옷은 옷대로 읽힙니다. */
  const body = character(g, sp, look, { ry: V.ry, lod: 1 });
  if (V.pose) { try { V.pose(body); } catch { /* 자세는 덤입니다 */ } }
  /* cx 는 상자를 좌우로 밀어 두는 값입니다. 몸 한가운데에 안 달리는
     물건이 있습니다 — 에코백은 옆구리에 걸리므로, 가운데를 보면 몸만
     크게 나오고 가방은 가장자리에서 잘립니다. */
  const cx = V.cx || 0;
  const box = new THREE.Box3(
    new THREE.Vector3(cx - V.hx, V.y0, -V.hz),
    new THREE.Vector3(cx + V.hx, V.y1, V.hz),
  );
  return { group: g, box, off: V.off, pad: 0.1, ground: V.y0 < 0 ? 1.0 : false };
}

/** 가구 · 탈것 · 알 — 경계 상자는 지은 것에서 그대로 잽니다.
    스물넷이 방석부터 캣타워까지 열 배 차이가 나므로 손으로 적을 수 없습니다. */
function buildProp(kind, id, opt) {
  const g = new THREE.Group();
  if (kind === 'furn') {
    decorItem(g, { id, x: 0, z: 0, ry: opt.ry ?? 0 });
  } else if (kind === 'ride') {
    if (!RIDES[id]) return null;
    const G = ride(g, id, { ry: opt.ry ?? -0.35 });
    if (!G) return null;
    if (opt.rider) {
      const sp = SPECIES[opt.rider] ? opt.rider : MANNEQUIN_SPECIES;
      const body = character(g, sp, Object.assign({}, MANNEQUIN, opt.look || {}),
        { ry: opt.ry ?? -0.35, lod: 1 });
      rideOn(body, G, id, 0, 1);
    }
  } else if (kind === 'egg') {
    eggStand(g, 0, 0, opt.color ?? 0xF2D08A);
    /* 알 가게가 파는 것은 **알**이지 받침이 아닙니다. 지은 것을 그대로 재면
       칸의 절반이 나무 기둥입니다. 알과 받침 접시까지만 잘라 봅니다. */
    return {
      group: g,
      box: new THREE.Box3(new THREE.Vector3(-0.46, 0.0, -0.46),
        new THREE.Vector3(0.46, 1.78, 0.46)),
      off: opt.off || new THREE.Vector3(.48, .32, 1), pad: 0.12, ground: 1.15,
    };
  } else return null;

  const box = new THREE.Box3().setFromObject(g);
  if (!isFinite(box.min.x) || box.isEmpty()) return null;
  /* 바닥이 살짝 음수로 잡히는 것들이 있습니다(탈것은 밑창이 -0.13). 그림자는
     실제로 닿는 데 깔아야 하므로 상자 바닥을 그대로 씁니다. */
  return { group: g, box, off: opt.off || OFF_ITEM, pad: 0.12, ground: 1.9 };
}

function buildItem(kind, id, opt) {
  try {
    return kind === 'wear' ? buildWear(id, opt) : buildProp(kind, id, opt);
  } catch {
    return null;
  }
}

/* 지은 것은 들고 있습니다. 창을 닫았다 다시 열면 같은 스물넷을 또 짓게
   되는데, 캣타워 한 채가 메시 마흔 개입니다. 품목이 쉰 남짓이라 천장을
   예순넷으로 두면 실제로는 한 번씩만 짓고 끝납니다. */
const BUILT = new Map();
function itemKey(kind, id, opt) {
  return [kind, id, opt.species || '', opt.slot || '', opt.color ?? '',
    opt.bare ? 'bare' : '', opt.rider || '', opt.ry ?? '',
    opt.look ? JSON.stringify(opt.look) : ''].join('|');
}
function getItem(kind, id, opt) {
  const k = itemKey(kind, id, opt);
  let it = BUILT.get(k);
  if (it) { BUILT.delete(k); BUILT.set(k, it); return it; }   // 최근 것으로 올립니다
  it = buildItem(kind, id, opt);
  if (!it) return null;
  claim(it.group);
  BUILT.set(k, it);
  while (BUILT.size > CACHE_MAX) {
    const old = BUILT.keys().next().value;
    release(BUILT.get(old).group);
    BUILT.delete(old);
  }
  return it;
}

/* ══════════════════════════════════════════════════════════
   3. 한 프레임 — 썸네일 줄과 옷장 미리 보기가 같은 순환을 나눠 씁니다
   ══════════════════════════════════════════════════════════ */

const QUEUE = [];               // 그릴 차례를 기다리는 칸
const THUMBS = new Set();       // 살아 있는 칸 손잡이 — 접을 때 캔버스를 걷습니다
const PREVIEWS = new Set();     // 살아 있는 옷장 미리 보기
let RAF = 0;

function kick() {
  if (RAF || DEAD) return;
  RAF = requestAnimationFrame(tick);
}

function tick() {
  RAF = 0;
  if (DEAD) return;

  /* 썸네일 먼저. 시간을 재서 나눠 그립니다 — 스물넷을 한 프레임에 몰면
     그 프레임이 200ms 가 되고, 창이 열리는 순간 월드가 한 번 멎습니다.
     적어도 하나는 그립니다(안 그러면 느린 기기에서 영영 안 그려집니다). */
  if (QUEUE.length && boot()) {
    const t0 = performance.now();
    do {
      const job = QUEUE.shift();
      if (job && !job.dead) drawThumb(job);
    } while (QUEUE.length && performance.now() - t0 < BUDGET_MS);
  }

  /* 옷장 미리 보기 — 보이는 것만, 초당 프레임을 묶어서 */
  const now = performance.now();
  PREVIEWS.forEach((p) => {
    if (!p.visible || p.dead) return;
    if (now - p.last < 1000 / PREVIEW_FPS) return;
    p.last = now;
    drawPreview(p, now / 1000);
  });

  if (QUEUE.length || anyLive()) kick();
}
function anyLive() {
  let live = false;
  PREVIEWS.forEach((p) => { if (p.visible && !p.dead) live = true; });
  return live;
}

/* ── 보이는지 지켜보기 ──
   한 번 그린 칸은 곧바로 지켜보기를 그만둡니다. 계속 지켜보면 스크롤할
   때마다 같은 칸이 다시 줄에 섭니다. */
let IO_THUMB = null, IO_VIEW = null;
function ioThumb() {
  if (IO_THUMB || typeof IntersectionObserver !== 'function') return IO_THUMB;
  IO_THUMB = new IntersectionObserver((rows) => {
    rows.forEach((r) => {
      if (!r.isIntersecting) return;
      const job = r.target.__sv3d;
      IO_THUMB.unobserve(r.target);
      if (job && !job.dead && !job.done) { QUEUE.push(job); kick(); }
    });
  }, { rootMargin: '150px' });
  return IO_THUMB;
}
function ioView() {
  if (IO_VIEW || typeof IntersectionObserver !== 'function') return IO_VIEW;
  IO_VIEW = new IntersectionObserver((rows) => {
    rows.forEach((r) => {
      const p = r.target.__sv3dp;
      if (!p) return;
      p.visible = r.isIntersecting;
      if (p.visible) kick();
    });
  }, { rootMargin: '80px' });
  return IO_VIEW;
}

/* ── 칸 캔버스 ──
   CSS 는 하나도 가정하지 않습니다. 칸이 얼마나 큰지는 **그릴 때** 재고,
   못 재면(창이 아직 안 펴졌으면) 정해 둔 값으로 갑니다. */
function ensureCanvas(el, opt) {
  let cv = el.__sv3dcv;
  if (!cv) {
    cv = document.createElement('canvas');
    cv.style.display = 'block';
    cv.style.width = '100%';
    cv.style.height = '100%';
    /* 칸 자체가 단추일 때가 많습니다. 캔버스가 눌림을 가로채면 사는 단추가
       안 눌립니다. */
    cv.style.pointerEvents = 'none';
    el.__sv3dcv = cv;
    el.appendChild(cv);
  }
  const r = el.getBoundingClientRect();
  const w = Math.round(opt.w || r.width || THUMB_FALLBACK);
  const h = Math.round(opt.h || r.height || w);
  const k = dpr();
  const pw = Math.max(1, Math.round(w * k)), ph = Math.max(1, Math.round(h * k));
  if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
  return cv;
}

function drawThumb(job) {
  if (!boot()) return;
  const it = getItem(job.kind, job.id, job.opt);
  if (!it) {
    job.done = true;
    job.el.dataset.renderState = 'error';
    console.warn('[상점 3D] 상품을 만들지 못했습니다', job.kind, job.id);
    return;
  }
  const cv = ensureCanvas(job.el, job.opt);
  const ok = paint(cv, it.group, it.box, job.opt.off || it.off,
    job.opt.pad ?? it.pad, job.opt.ground ?? it.ground);
  job.done = !!ok;
  job.el.dataset.renderState = ok ? 'ready' : 'error';
  if (!ok) console.warn('[상점 3D] 상품을 그리지 못했습니다', job.kind, job.id);
  if (ok && job.opt.onDraw) { try { job.opt.onDraw(job.el); } catch { /* 부르는 쪽 사정 */ } }
}

/* ══════════════════════════════════════════════════════════
   4. 내보내는 것 셋
   ══════════════════════════════════════════════════════════ */

/**
 * 물건 하나를 칸 하나에 그립니다. 눈에 들어올 때 **한 번만** 그립니다.
 *
 *   el    그릴 자리. 이 함수가 안에 `<canvas>` 를 하나 넣고 채웁니다.
 *         칸 크기는 el 의 실제 크기를 따릅니다(CSS 는 부르는 쪽 몫).
 *   kind  'wear' 옷 · 'furn' 가구 · 'ride' 탈것 · 'egg' 알
 *   id    kind 에 맞는 열쇠.
 *           wear  WEAR 의 옷 id ('hoodie', 'grad_cap', 'tote' …)
 *           furn  rooms.js 의 원래 여섯('plant','lamp2','rug2','books2','guitar2','bear')
 *                 과 room.js 의 'fur-…' 열여덟. 곧 상점 FURN 표의 id 그대로입니다.
 *           ride  RIDES 의 열쇠('ride-bike' …)
 *           egg   아무 값이나. 색은 opt.color 로 정합니다.
 *   opt   { w, h        칸 크기(px). 안 주면 el 을 잽니다
 *           species     옷을 입힐 종. 안 주면 기린
 *           look        마네킹 차림. SAVE.look 을 그대로 넘겨도 되고
 *                       OUTFITS 의 옛 형식({style, top, bottom, shoe})도 받습니다.
 *                       넘긴 객체는 **안 건드립니다**
 *           slot        옷 칸을 직접 지정(안 주면 id 로 찾습니다)
 *           bare        옷 **한 장만**. 몸을 안 보이게 하고 그 옷만 띄웁니다.
 *                       상점 칸은 이쪽입니다. species 는 무시합니다(파는 것은
 *                       옷이지 그 옷을 입은 누구가 아닙니다). 안 주면 예전대로
 *                       마네킹에 입혀 그 칸을 잘라 봅니다 — dressPreview 가
 *                       쓰는 몸이 그대로 남아 있습니다
 *           keepBag     옷 칸을 볼 때도 가방을 멘 채로. 기본은 벗김(bare 는 안 씀)
 *           color       알 색 / 옷 색. bare 에서는 부르는 쪽 차림의 색과 염색을
 *                       **이깁니다** — 과잠의 학교 색이 이 길로 들어옵니다.
 *                       학교 표는 index.html 의 SCHOOLS 에 있습니다(여기 안 옮깁니다)
 *           rider       탈것에 태울 종. 안 주면 탈것만
 *           ry          물건을 돌려 두는 각도(라디안)
 *           off         눈이 있는 쪽(THREE.Vector3)
 *           pad         가장자리로 남길 여백(0~1)
 *           ground      발밑 그림자. false 면 안 깔고, 숫자면 그 배수로 퍼뜨립니다
 *           onDraw(el)  다 그린 뒤 한 번 }
 *
 * 상점의 옷 칸은 이렇게 부릅니다. 과잠이면 학교 색을 같이 넘깁니다 —
 * 학교 표(SCHOOLS)는 부르는 쪽에 있고 이 파일은 색만 받습니다.
 *
 *   const sc = SCHOOLS.find((q) => q.name === SAVE.school);
 *   itemThumb(el, 'wear', id, {
 *     bare: true,
 *     slot,                                   // 'top' · 'bottom' · 'shoes' · 'hat' · 'glasses' · 'bag'
 *     look: myLook(),                         // 내 색과 염색을 물려받습니다(없어도 됩니다)
 *     color: id === 'varsity' ? sc?.c : undefined,
 *   }); */
export function itemThumb(el, kind, id, opt = {}) {
  const handle = {
    el, kind, id, opt, dead: false, done: false,
    redraw() { handle.done = false; if (!handle.dead) { QUEUE.push(handle); kick(); } },
    dispose() {
      handle.dead = true;
      THUMBS.delete(handle);
      const i = QUEUE.indexOf(handle); if (i >= 0) QUEUE.splice(i, 1);
      try { if (IO_THUMB) IO_THUMB.unobserve(el); } catch { /* 이미 떠난 칸 */ }
      if (el && el.__sv3dcv) { el.__sv3dcv.remove(); el.__sv3dcv = null; }
      if (el) el.__sv3d = null;
    },
  };
  try {
    if (!el || !el.nodeType) return handle;
    el.__sv3d = handle;
    THUMBS.add(handle);
    if (!boot()) return handle;                 // WebGL 이 없으면 글자만 남습니다
    const io = ioThumb();
    /* IntersectionObserver 가 없는 낡은 브라우저에서는 그냥 줄에 세웁니다 */
    if (io) io.observe(el); else { QUEUE.push(handle); kick(); }
  } catch { /* 절대 밖으로 안 던집니다 */ }
  return handle;
}

/* ══ 옷장 미리 보기 ══

   ctx 는 이렇게 생겼습니다(전부 없어도 됩니다).

     {
       species: '거북이',            // SPECIES 의 열쇠
       look: {                       // index.html 의 SAVE.look 을 그대로 넘기면 됩니다
         topId, top, bottomId, bottom, shoesId, shoes,
         hatId, hat, glassesId, bagId, bagC,
         tint: { hoodie: 0x3E5A8C, … }
       },
       ride: 'ride-bike' | null,     // 타고 있으면 태워서 보여 줍니다
       try:  걸쳐 보기(아래) | null,
       focus: 'top' | 'hat' | … | null,   // 그 칸만 크게. 안 주면 온몸
       spin: true | false | 라디안/초,     // 도는 빠르기. 기본 0.5
       w, h                          // 안 주면 el 을 잽니다
     }

   **걸쳐 보기(try)** 는 사기 전에, 고르기 전에 보는 것입니다. 원래 차림을
   건드리지 않고 그 위에 덮어씁니다 — SAVE.look 을 직접 고쳐 두면 마음이
   바뀌었을 때 되돌릴 것이 없습니다. 네 가지 모양을 다 받습니다.

     handle.tryOn('hoodie')                     옷 id 하나. 칸은 알아서 찾습니다
     handle.tryOn({ slot: 'top', id: 'hoodie', color: 0x2DD4BF })
     handle.tryOn({ tint: { hoodie: 0x3E5A8C } })   염색만 — 다시 안 짓고 색만 갈아 끼웁니다
     handle.tryOn({ species: '펭귄', ride: 'ride-kick' })
     handle.tryOn(null)                         원래 차림으로

   돌려주는 손잡이:
     set(patch)     ctx 를 부분만 갈아 끼웁니다(고른 것을 실제로 적용할 때)
     tryOn(t)       위와 같습니다
     focus(slot)    그 칸으로 천천히 당겨 봅니다. null 이면 온몸
     redraw()       한 프레임 다시
     dispose()      이 미리 보기만 접습니다 */
function mergeLook(base, t) {
  const L = baseLook(base);
  if (!t) return L;
  const spec = typeof t === 'string' ? { id: t } : t;
  if (spec.look) Object.assign(L, spec.look);
  if (spec.id) {
    const slot = spec.slot || SLOT_OF[spec.id];
    const kk = slot && LOOK_KEY[slot];
    if (kk) {
      L[kk[0]] = spec.id;
      if (kk[1] && spec.color != null) L[kk[1]] = spec.color;
    }
  }
  if (spec.tint) L.tint = Object.assign({}, L.tint, spec.tint);
  return L;
}
/* 다시 지어야 하는지. 염색만 달라졌으면 applyTint 로 색만 갈아 끼웁니다 —
   색 하나 고를 때마다 메시 백여 개를 다시 세우면 고르는 손이 걸립니다. */
const LOOK_IDS = ['topId', 'bottomId', 'shoesId', 'hatId', 'glassesId', 'bagId'];
const LOOK_COLS = ['top', 'bottom', 'shoes', 'hat', 'bagC'];
function sameShape(a, b) {
  if (!a || !b) return false;
  return LOOK_IDS.every((k) => a[k] === b[k]) && LOOK_COLS.every((k) => a[k] === b[k]);
}

function previewLook(p) { return mergeLook(p.ctx.look, p.try); }
function previewSpecies(p) {
  const t = typeof p.try === 'object' && p.try ? p.try.species : null;
  const s = t || p.ctx.species;
  return SPECIES[s] ? s : MANNEQUIN_SPECIES;
}
function previewRide(p) {
  const t = typeof p.try === 'object' && p.try ? p.try.ride : undefined;
  const id = t !== undefined ? t : p.ctx.ride;
  return id && RIDES[id] ? id : null;
}

function rebuildPreview(p) {
  release(p.body); p.body = null;
  release(p.rideG); p.rideG = null;
  p.rig.clear();
  const look = previewLook(p);
  const sp = previewSpecies(p);
  const rid = previewRide(p);
  /* **여기는 지금 옷이 안 보입니다.** 월드에서 쓰는 그 캐릭터를 그대로
     세우는데, 원본 네 종(GLB)의 클레이 옷 레이어를 chars.js 에서 걷었기
     때문입니다 — 사람 몸에 맞춘 한 벌이라 네 종 어디에도 안 맞아서,
     기린에서는 옷이 몸 안에 들어가고 거북이에서는 등딱지를 뚫었습니다.

     그래서 지금 입어 보기는 **왼쪽 상품 카드**가 눈이고, 오른쪽은 누가
     입는지를 보여 줍니다. 카드는 절차형 골조에서 옷 한 장만 떼어 내는
     길이라(wearThumb) 그대로 멀쩡합니다.

     오른쪽에도 옷을 보이려면 종마다 옷을 따로 빚어야 합니다. 잠금 해제
     네 종은 절차형이라 지금도 옷이 보입니다. */
  p.body = character(p.rig, sp, look, {});
  p.el.dataset.renderState = p.body ? 'ready' : 'error';
  p.el.dataset.characterSource = p.body?.userData?.characterSource || 'unknown';
  p.el.dataset.species = sp;
  p.el.dataset.outfit = [look.topId, look.bottomId, look.shoesId, look.hatId,
    look.glassesId, look.bagId].filter(Boolean).join(',');
  claim(p.body);
  if (rid) { p.rideG = ride(p.rig, rid, {}); if (p.rideG) claim(p.rideG); }
  p.shape = look;
  p.species = sp;
  p.rideId = rid;
  p.built = true;
}

/* 온몸 상자와 칸 상자. 당길 때는 두 상자를 섞어서 천천히 옮깁니다 —
   툭 끊어 바꾸면 어디를 보고 있었는지 놓칩니다. */
const FULL_BOX = { y0: -0.18, y1: 2.04, hx: 0.52, hz: 0.34, off: OFF_WEAR };
/* 타고 있으면 상자를 넓혀야 합니다. 자전거는 앞뒤로 1.7m 라, 사람 크기
   상자로 잡아 두면 도는 동안 앞바퀴가 칸 밖으로 나갔다 들어옵니다.
   가로세로를 같게 두는 것은 **돌아도 크기가 안 변하게** 하기 위해서입니다 —
   좁게 잡으면 옆을 보일 때만 작아져서 미리 보기가 숨을 쉽니다. */
const RIDE_BOX = { y0: -0.28, y1: 2.04, hx: 0.94, hz: 0.94, off: OFF_WEAR };
function focusBox(slot, riding) {
  const V = slot && WEAR_VIEW[slot];
  if (V) return V;
  return riding ? RIDE_BOX : FULL_BOX;
}
const _b = new THREE.Box3();
const TAU = Math.PI * 2;
function drawPreview(p, t) {
  if (!boot()) return;
  if (!p.built) rebuildPreview(p);

  /* 한 프레임의 움직임. 탈것을 타고 있으면 페달을 밟고 바퀴가 굴러야
     자전거로 보입니다 — 그때는 idle 을 부르지 않습니다(같이 부르면
     다리가 페달을 밟다 말고 걷습니다). */
  if (p.rideId && p.rideG) rideOn(p.body, p.rideG, p.rideId, t, 1);
  else idle(p.body, t, 0.4);

  /* 도는 각은 한 바퀴마다 접습니다. 접지 않으면 창을 켜 둔 채 한나절이
     지났을 때 각이 커져서 소수점이 성겨지고, 도는 것이 덜컹거립니다. */
  /* `spin: 'sway'` — **앞을 보이는 채로** 좌우로만 흔듭니다.
     옷 가게의 "입어보는 중" 칸이 계속 한 방향으로 돌고 있었습니다.
     16초에 한 바퀴라 절반은 캐릭터의 **등**을 보고 있었고, 옷을 눌러
     입혀 놓고도 화면에는 아무 변화가 없는 것처럼 보였습니다 —
     입어 보는 창이 등을 보여 주면 입어 보는 창이 아닙니다. */
  if (p.ctx.spin === 'sway') {
    p.rig.rotation.y = p.turn0 + Math.sin(t * .55) * .42;
  } else {
    const spin = p.ctx.spin === false ? 0 : (typeof p.ctx.spin === 'number' ? p.ctx.spin : SPIN);
    p.rig.rotation.y = (p.turn0 + t * spin) % TAU;
  }

  /* 당기기 — 목표 상자로 천천히 옮겨 갑니다. 툭 끊어 바꾸면 어디를 보고
     있었는지 놓칩니다. 매 프레임 일정 비율씩 좁히는 것이면 충분합니다. */
  const T = focusBox(p.focusSlot, !!p.rideId);
  if (!p.cur) { p.cur = { y0: T.y0, y1: T.y1, hx: T.hx, hz: T.hz }; p.off = T.off.clone(); }
  const a = 0.16;
  p.cur.y0 += (T.y0 - p.cur.y0) * a;
  p.cur.y1 += (T.y1 - p.cur.y1) * a;
  p.cur.hx += (T.hx - p.cur.hx) * a;
  p.cur.hz += (T.hz - p.cur.hz) * a;
  p.off.lerp(T.off, a);

  const cv = ensureCanvas(p.el, p.ctx);
  _b.min.set(-p.cur.hx, p.cur.y0, -p.cur.hz);
  _b.max.set(p.cur.hx, p.cur.y1, p.cur.hz);
  paint(cv, p.rig, _b, p.off, 0.08, p.cur.y0 < 0.1 ? 1.0 : false);
}

/**
 * 내 캐릭터를 세워 두고 천천히 돌립니다. 사기 전에, 고르기 전에 봅니다.
 *   el   그릴 자리. 안에 `<canvas>` 를 하나 넣고 채웁니다.
 *   ctx  위 주석의 모양.
 * 돌려주는 손잡이로 갈아입히고 걸쳐 봅니다. 절대 예외를 안 던집니다.
 */
export function dressPreview(el, ctx = {}) {
  const p = {
    el, ctx: Object.assign({}, ctx), try: ctx.try || null, focusSlot: ctx.focus || null,
    rig: null, body: null, rideG: null, cur: null, off: null,
    built: false, visible: false, dead: false, last: 0, turn0: 0.3,
  };
  const handle = {
    el,
    get ctx() { return p.ctx; },
    set(patch) {
      if (!patch || p.dead) return handle;
      Object.assign(p.ctx, patch);
      if ('try' in patch) p.try = patch.try;
      if ('focus' in patch) p.focusSlot = patch.focus || null;
      mark(p);
      return handle;
    },
    tryOn(t) {
      if (p.dead) return handle;
      p.try = t || null;
      mark(p);
      return handle;
    },
    focus(slot) { p.focusSlot = slot || null; kick(); return handle; },
    redraw() { p.last = 0; kick(); return handle; },
    dispose() {
      p.dead = true;
      PREVIEWS.delete(p);
      try { if (IO_VIEW) IO_VIEW.unobserve(el); } catch { /* 이미 떠난 자리 */ }
      release(p.body); release(p.rideG);
      p.body = p.rideG = null;
      if (el.__sv3dcv) { el.__sv3dcv.remove(); el.__sv3dcv = null; }
      el.__sv3dp = null;
    },
  };
  try {
    if (!el || !el.nodeType) return handle;
    el.__sv3dp = p;
    if (!boot()) return handle;
    p.rig = new THREE.Group();
    p.rig.rotation.y = p.turn0;
    PREVIEWS.add(p);
    const io = ioView();
    if (io) io.observe(el); else p.visible = true;
    /* 지켜보기가 알려 주기 전에 한 프레임이라도 그려 둡니다 — 창이 열리는
       순간 빈 네모가 보이면 안 열린 것으로 보입니다. */
    p.visible = true;
    kick();
  } catch { /* 조용히 */ }
  return handle;
}

/** 걸쳐 본 것이 형상까지 바꾸는지 보고, 색만이면 다시 안 짓습니다 */
function mark(p) {
  if (!p.built) { kick(); return; }
  const look = previewLook(p);
  const sp = previewSpecies(p);
  const rid = previewRide(p);
  if (sp !== p.species || rid !== p.rideId || !sameShape(look, p.shape)) p.built = false;
  else { applyTint(p.body, look); p.shape = look; }
  p.last = 0;
  kick();
}

/**
 * 전부 접습니다. 창을 닫을 때가 아니라 **월드를 떠날 때** 부르세요 —
 * 창을 여닫을 때마다 판을 새로 세우면 여는 값을 매번 다시 냅니다.
 * 이 모듈이 만든 것만 버립니다. 물건 속의 기하는 chars.js · room.js 의
 * 곳간에 있는 남의 것이라 손대지 않습니다(위 머리말 참고).
 */
export function disposeAll() {
  try {
    if (RAF) cancelAnimationFrame(RAF);
    RAF = 0;
    QUEUE.length = 0;
    /* 칸에 넣어 둔 캔버스를 걷습니다. 안 걷으면 판이 사라진 뒤에도 마지막
       그림이 그대로 남아, 접었는데 살아 있는 것처럼 보입니다. 걷고 나면
       부르는 쪽이 넣어 둔 글자만 남습니다 — 그것이 접힌 모습입니다. */
    Array.from(THUMBS).forEach((h) => { try { h.dispose(); } catch { /* 이미 떠난 칸 */ } });
    THUMBS.clear();
    PREVIEWS.forEach((p) => {
      p.dead = true;
      release(p.body); release(p.rideG);
      if (p.el && p.el.__sv3dcv) { p.el.__sv3dcv.remove(); p.el.__sv3dcv = null; }
      if (p.el) p.el.__sv3dp = null;
    });
    PREVIEWS.clear();
    BUILT.forEach((it) => release(it.group));
    BUILT.clear();
    OWNED.clear();
    if (IO_THUMB) { IO_THUMB.disconnect(); IO_THUMB = null; }
    if (IO_VIEW) { IO_VIEW.disconnect(); IO_VIEW = null; }
    if (SHADOW) {
      SHADOW.geometry.dispose();
      if (SHADOW.material.map) SHADOW.material.map.dispose();
      SHADOW.material.dispose();
      SHADOW = null;
    }
    if (R) {
      /* 청취자를 **먼저** 뗍니다. forceContextLoss 가 부르는 그 자리에서
         분실 사건을 던지는 것이 아니라 한 박자 뒤에 던지기 때문에, 떼지
         않으면 접기가 다 끝난 다음에 DEAD 가 켜집니다 — 그러면 창을 다시
         열어도 판이 영영 안 세워지고, 아무 소리 없이 글자만 남습니다.
         실제로 그렇게 됐습니다. */
      if (LOST) {
        LOST.cv.removeEventListener('webglcontextlost', LOST.onLost, false);
        LOST.cv.removeEventListener('webglcontextrestored', LOST.onBack, false);
        LOST = null;
      }
      /* dispose 만으로는 컨텍스트가 안 사라집니다. 열여섯 자리를 다시
         내주려면 강제로 잃게 해야 합니다. */
      R.dispose();
      try { R.forceContextLoss(); } catch { /* 지원 안 하는 기기 */ }
      R = null;
    }
    SCENE = STAGE = CAM = null;
    BW = BH = 0;
    DEAD = false;
  } catch { /* 접는 길에서도 안 던집니다 */ }
}

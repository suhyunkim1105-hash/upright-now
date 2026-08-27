# 메인 화면 본문이 문서화된 본문 계약(500 / 15px)을 따르게 한다

Written against: e1a0a61

## Evidence chain

- Surface: `prototypes/home/index.html` — 레일·상단바·판·마이페이지 다섯 칸 전부
- Problem: `body` 가 `font-variation-settings: 'wght' 420` 이고 `font-size` 를
  지정하지 않아 브라우저 기본값 16px 으로 렌더됩니다. 1440×900 에서 잰
  결과 화면 안 글자 있는 요소 **106개**가 420 으로 그려집니다.
- Design evidence: `prototypes/DESIGN.md` §2 「본문 500 이 하한인 이유」 —
  "취향이 아닙니다. 한국어는 400 대에서 획이 얇아지는 게 아니라
  흐려집니다." 같은 문서 §2 「위계」가 본문을 `15px / 500 / 자간 0 /
  행간 1.55` 로 못 박습니다.
- Owner: `prototypes/onboarding/index.html` `body` 규칙 —
  `font: 500 15px/1.62 'Wanted Sans Variable', …`. 잰 값 15px / 500.
- Scope and affected surfaces: `prototypes/home/index.html` 한 파일.
  온보딩·월드·랜딩은 각자 body 규칙을 이미 갖고 있어 상속받지 않습니다.
- Uncertainty: 행간이 온보딩은 1.62, DESIGN.md 표는 1.55 로 서로 다릅니다.
  코드가 정답이라는 DESIGN.md 머리말에 따라 **1.62** 를 씁니다.

## Design decision

메인의 `body` 를 온보딩과 **바이트 단위로 같은 선언**으로 맞춥니다.
지금은 크기·무게 둘 다 어긋나 있고, 두 화면은 사용자가 연속으로 지나는
경로(온보딩 → 메인)라 그 사이에서 글자 굵기가 바뀌면 서체가 바뀐 것으로
읽힙니다. 값을 새로 정하지 않고 이미 있는 주인을 그대로 씁니다.

## Reuse

- `--ink`, `--bg` — 이미 씁니다. 색은 바꾸지 않습니다.
- Exemplar: `prototypes/onboarding/index.html` 의 `body` 규칙

새 프리미티브는 필요 없습니다.

## Changes

1. `prototypes/home/index.html`
   - Change: `body` 의 `font-variation-settings: 'wght' 420` 을 지우고
     `font: 500 15px/1.62 'Wanted Sans Variable', 'Wanted Sans', system-ui,
     sans-serif;` 한 줄로 바꿉니다(온보딩과 같은 형태).
   - Preserve: `background`, `color`, `margin: 0`,
     `-webkit-font-smoothing: antialiased`.
   - Verify: `getComputedStyle(document.body)` 가 `15px` / `500` 을 돌려주고,
     420 으로 그려지는 요소가 0개.

2. `prototypes/home/index.html`
   - Change: body 기준이 15px 으로 내려가면서 `rem` 을 안 쓰는 이 파일의
     `px` 값은 그대로 유지됩니다. 다만 `font-variation-settings: 'wght' 420`
     을 **명시적으로 다시 적는 규칙이 있는지** 확인하고 있으면 지웁니다.
   - Preserve: 700·800 을 쓰는 곳(버튼·제목·수치)은 이 계획의 대상이
     아닙니다 — `home-heading-type-contract.md` 가 다룹니다.
   - Verify: 파일 안 `'wght' 420` 검색 결과 0건.

## Scope

- Inherit: 메인의 모든 텍스트 — 레일 메뉴 라벨, 상단바 부제, 판 버튼,
  마이페이지 다섯 칸의 줄·안내문, 위저드 다섯 단계, 대기실.
- Verify: 위저드 `.wiz-lede p`, `.pick-text > span`, `.mode > span` 은 자체
  `font-size` 를 갖습니다. body 크기가 16 → 15 로 바뀌어도 이 값들은
  절대 px 이라 안 움직입니다. 렌더로 한 번 확인합니다.
- Exclude: 랜딩(`prototypes/landing/index.html`)은 토스식 타이포를 의도적으로
  쓰기로 한 별도 결정이라 건드리지 않습니다.

## Validation

- Product: 온보딩을 마치고 메인으로 넘어왔을 때 글자 굵기가 바뀌지 않는다.
- Interface: 1280×768 / 1440×900 / 1680×1050 에서 세션 시작 · 대기실 ·
  캐릭터 · 랭킹전 · 마이페이지 다섯 칸 · 위저드 다섯 단계.
  긴 닉네임(20자)과 세션 0개 상태를 함께 본다.
- System: 메인이 온보딩과 같은 body 선언을 쓰는지, 새 토큰을 만들지
  않았는지 확인.
- Repository: `node -e "const s=require('fs').readFileSync('prototypes/home/index.html','utf8');console.log((s.match(/wght' 420/g)||[]).length)"` → `0`

## Stop conditions

- 15px 으로 내렸을 때 마이페이지 표의 숫자 열이 줄바꿈되면 멈추고
  그 표의 `font-size` 를 따로 정합니다 — body 를 되돌리지 않습니다.

## Design documentation

- After acceptance and validation: `prototypes/DESIGN.md` §2 「위계」의
  행간을 1.55 → 1.62 로 고쳐 코드와 맞춥니다. 표와 구현이 갈라진 채로
  두면 다음 사람이 표를 믿습니다.

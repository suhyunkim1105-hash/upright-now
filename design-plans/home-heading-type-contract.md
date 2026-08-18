# 메인 화면 제목이 문서화된 제목 계약(700 / 자간 0)을 따르게 한다

Written against: e1a0a61

## Evidence chain

- Surface: `prototypes/home/index.html` — 브랜드 워드마크, 판 제목, 카드
  제목, 숫자 칸, 위저드 단계 제목, 대기실 제목
- Problem: 전역 규칙 `h1, h2, h3, h4 { font-variation-settings: 'wght' 800;
  letter-spacing: -.02em; }` 이 걸려 있고 `.gate h2` 가 `-.05em` 으로 더
  조입니다. 1440×900 에서 잰 결과 **800 으로 그려지는 요소 31개**,
  **음수 자간이 걸린 요소 15개**(−0.32 / −0.38 / −0.44 / −0.6 / −1.05 /
  −1.36 / −1.6 / −4.05px)입니다.
- Design evidence: `prototypes/DESIGN.md` §2 「자간을 0 으로 둔 이유」 —
  "토스식(자간 −0.02em, 무게 800, 32px)은 글자를 덩어리로 뭉쳐 부드럽게
  만드는 방식입니다. **여기서는 반대로 갑니다.** 자간을 0 으로 두면 글자가
  각자 서고, 제목을 800 이 아니라 700 으로 낮추면 본문과의 낙차가 줄어
  화면이 차분해집니다. 크기로 소리치지 않습니다." 같은 문서 §2 「위계」가
  제목을 `26px / 700 / 자간 0 / 행간 1.40` 으로 적습니다.
- Owner: `prototypes/onboarding/index.html` `.card h2` —
  `font-size: 26px; font-weight: 700; letter-spacing: 0; line-height: 1.4`.
  잰 값 26px / 700 / normal.
- Scope and affected surfaces: `prototypes/home/index.html` 한 파일.
- Uncertainty: DESIGN.md 가 정한 26px 은 온보딩 카드 제목의 크기입니다.
  메인의 판 제목은 화면 절반을 쓰는 히어로라 크기 자체는 이 계약의
  대상이 아닙니다. **무게와 자간만** 맞춥니다.

## Design decision

전역 제목 규칙에서 `letter-spacing: -.02em` 을 지우고 무게를 800 → 700 으로
내립니다. `.gate h2` 의 `-.05em`, `.brand b` 의 `-.03em`, `.stat b` 의
`-.035em`, `.seatslider-head b` 의 `-.04em`, `.dial-sum-big` 의 `-.03em`,
`.mint-code` 의 `.14em`, `.codeval` 의 `.1em` 중 **자간 0 규칙의 예외로
남길 것은 둘뿐**입니다 — `.mint-code` 와 `.codeval` 은 여섯 자리 코드를
한 글자씩 읽게 하려고 **벌리는** 값이고, 이는 뭉치는 토스식과 반대
방향이라 문서가 반대하는 대상이 아닙니다. 나머지 음수 자간은 전부
제거합니다.

이 결정이 근본 문제를 푸는 이유: 지금 메인은 색·여백·모서리 토큰을
온보딩에서 그대로 가져왔는데 **타이포만 랜딩(토스식)에서 가져왔습니다.**
그래서 같은 청록·같은 여백 위에 다른 성격의 글자가 얹혀 있습니다.
DESIGN.md 는 이 둘 중 어느 쪽이 제품 화면의 기준인지 명시적으로 정해
두었고, 메인은 제품 화면입니다.

## Reuse

- `prototypes/onboarding/index.html` `.card h2` 의 무게·자간 값
- Exemplar: 같은 파일 `.whoami .nm` — 17px / 800 / `-.01em` 을 쓰는 곳이
  하나 있으나 이는 닉네임 표시용 예외이고 제목이 아닙니다. 따라가지
  않습니다.

새 프리미티브는 필요 없습니다.

## Changes

1. `prototypes/home/index.html`
   - Change: `h1, h2, h3, h4 { margin: 0; font-variation-settings: 'wght' 800;
     letter-spacing: -.02em; }` 을
     `h1, h2, h3, h4 { margin: 0; font-variation-settings: 'wght' 700;
     letter-spacing: 0; }` 로 바꿉니다.
   - Preserve: `margin: 0`.
   - Verify: 상단바 제목·카드 제목이 700 / normal 로 렌더.

2. `prototypes/home/index.html`
   - Change: `.gate h2` 의 `letter-spacing: -.05em` 을 `0` 으로,
     `.brand b` 의 `-.03em` · `.stat b` 의 `-.035em` ·
     `.seatslider-head b` 의 `-.04em` · `.dial-sum-big` 의 `-.03em` ·
     `.wiz-lede h3` 의 `-.035em` 을 각각 삭제합니다.
   - Preserve: `.mint-code` 의 `.14em` 과 `.codeval` 의 `.1em` — 코드를
     한 글자씩 읽히려고 **벌린** 값이라 문서가 막는 방향이 아닙니다.
     `.navitem` 이 쓰는 `letter-spacing: .04em`(있으면)도 같은 이유로 유지.
   - Verify: 음수 자간이 걸린 요소 0개.

3. `prototypes/home/index.html`
   - Change: `.gate h2` 는 무게를 800 으로 되돌려 둡니다 —
     `font-variation-settings: 'wght' 800`.
   - Preserve: 판 제목은 화면 절반을 쓰는 유일한 자리이고, 700 으로
     내리면 44~88px 에서 획이 가늘어 판이 비어 보입니다. DESIGN.md 가
     막는 것은 "제목과 본문의 낙차를 무게로 벌리는 것" 이고, 여기서는
     **크기**가 이미 낙차를 만들고 있으므로 무게를 낮출 이유가 없습니다.
   - Verify: 판 제목만 800, 나머지 제목은 700.

## Scope

- Inherit: 상단바 `h1`, 카드 `h2`, 위저드 `h3`, 대기실 `h2`, 발급 화면 `h3`.
- Verify: `.stat b` 는 `h` 태그가 아니라 `b` 라 전역 규칙을 안 받습니다.
  자체 `letter-spacing` 만 지우면 됩니다. `.gate h2` 는 전역 규칙과
  자체 규칙 둘 다 받으므로 순서를 확인합니다.
- Exclude: 랜딩. 토스 골격을 의도적으로 이식한 별도 결정입니다.

## Validation

- Product: 온보딩 7장 → 메인으로 넘어올 때 제목의 성격이 안 바뀐다.
- Interface: 1280×768 / 1440×900 / 1680×1050 에서 다섯 화면 + 위저드
  다섯 단계 + 코드 발급 + 대기실. 발급 코드 여섯 자가 여전히 한 글자씩
  떨어져 읽히는지 특히 확인.
- System: 메인에 남은 음수 자간이 0건인지, 새 규칙을 만들지 않았는지.
- Repository: `node -e "const s=require('fs').readFileSync('prototypes/home/index.html','utf8');console.log((s.match(/letter-spacing:\s*-/g)||[]).length)"` → `0`

## Stop conditions

- 판 제목을 자간 0 으로 풀었을 때 88px 에서 글자 사이가 벌어져 보이면
  멈춥니다. 그 경우 **크기를 줄이고** 자간 0 을 유지합니다 — 자간을
  되돌리지 않습니다. DESIGN.md 가 막는 것이 정확히 그 손입니다.

## Design documentation

- After acceptance and validation: `prototypes/DESIGN.md` §2 에 한 줄
  추가 — "히어로 제목(화면 절반을 쓰는 판)은 800 을 씁니다. 크기가 이미
  낙차를 만들기 때문이고, 자간 0 은 그대로입니다."

# 랭킹전 히어로의 아이브로우·부제에 스타일을 되돌린다

Written against: e1a0a61

## Evidence chain

- Surface: `prototypes/home/index.html` → 레일 `랭킹전` → `#v-league` 첫 판
- Problem: 판 안 `<span class="gkind">이번 시즌</span>` 과
  `<p class="gsub">학교끼리 앉은 시간을 겨룹니다…</p>` 가 **아무 규칙도
  안 받습니다.** 1440×900 에서 잰 값이 둘 다 `16px / 'wght' 420 /
  opacity 1` — 곧 body 기본값입니다. 원래 값은 아이브로우
  `12px / 800 / 자간 .04em / opacity .72`, 부제 `14px / 행간 1.55 /
  opacity .8` 였습니다.
- Design evidence: 같은 파일 `.gate` 조합의 다른 사용처(세션 시작 두 판)와
  비교했을 때 판 안 위계가 무너진 것이 **한 화면 안의 직접적 모순**입니다.
  아이브로우가 제목보다 작고 흐려야 아이브로우인데, 지금은 부제와 같은
  크기·같은 무게·같은 불투명도로 나란히 서서 세 줄이 한 덩어리로 읽힙니다.
- Owner: `prototypes/home/index.html` 자신. `.gate .gkind` 와 `.gate .gsub`
  규칙이 커밋 `e1a0a61`에서 삭제됐습니다 — 세션 시작 두 판에서 해당
  요소를 걷어내면서 규칙까지 같이 지웠고, 랭킹전 판이 여전히 그 클래스를
  쓰고 있다는 것을 놓쳤습니다.
- Scope and affected surfaces: `#v-league` 의 판 하나. 다른 화면에는
  `.gkind` / `.gsub` 사용처가 없습니다.
- Uncertainty: 없음. 삭제 전 값이 같은 파일의 git 이력에 있습니다.

## Design decision

지운 두 규칙을 되돌립니다. 클래스를 마크업에서 걷어내는 쪽은 택하지
않습니다 — 랭킹전 판은 제목 넉 자만으로 성립하지 않고("가을 시즌" 은
그것만으로 무슨 화면인지 안 말합니다), 시즌 규칙 설명이 이 판의 내용
자체입니다. 세션 시작 판에서 설명을 걷어낸 것은 그 판이 **버튼**이기
때문이고, 랭킹전 판은 버튼이 아니라 **머리말**입니다.

## Reuse

- 삭제 전 이 파일에 있던 `.gate .gkind` / `.gate .gsub` 선언
- Exemplar: `prototypes/home/index.html` 커밋 `39d5be1`

새 프리미티브는 필요 없습니다.

## Changes

1. `prototypes/home/index.html`
   - Change: `.gate-teal` 선언 바로 위에 두 규칙을 되돌립니다.
     ```
     .gate .gkind {
       display: inline-flex; align-items: center; gap: 6px;
       font-size: 12px; font-variation-settings: 'wght' 800;
       letter-spacing: .04em; opacity: .72;
     }
     .gate .gsub { font-size: 14px; line-height: 1.55; opacity: .8; max-width: 42ch; }
     ```
   - Preserve: 세션 시작 두 판은 이 클래스를 안 쓰므로 영향 없음.
   - Verify: 랭킹전 아이브로우 12px / 800, 부제 14px, 둘 다 opacity < 1.

2. `prototypes/home/index.html`
   - Change: 같은 판의 인라인 `style="min-height:166px"` 을 지우고
     `.gate` 의 `min-height: 180px` 를 그대로 받게 합니다.
   - Preserve: 랭킹전 판은 `#v-start` 처럼 화면을 반씩 나누지 않으므로
     `.gate` 기본 높이로 충분합니다.
   - Verify: 판 높이가 180 이상이고 안쪽 세 줄이 안 잘림.

## Scope

- Inherit: `#v-league` 첫 판.
- Verify: 세션 시작 두 판 — 클래스를 안 쓰므로 안 바뀌어야 합니다.
- Exclude: 랭킹전 판의 문구·순위표·내 기여 카드.

## Validation

- Product: 랭킹전을 처음 여는 사람이 "이번 시즌 / 가을 시즌 / 규칙" 을
  세 층으로 읽는다.
- Interface: 1280×768 / 1440×900 / 1680×1050 에서 랭킹전 화면.
- System: `.gkind` / `.gsub` 를 쓰는 곳이 이 판 하나뿐인지 확인하고,
  하나뿐이라면 규칙을 `#v-league` 로 좁힐지 판단 — 지금은 `.gate` 조합의
  일부이므로 `.gate` 아래 두는 것이 맞습니다.
- Repository: `node -e "const s=require('fs').readFileSync('prototypes/home/index.html','utf8');console.log(/\.gate \.gkind/.test(s), /\.gate \.gsub/.test(s))"` → `true true`

## Stop conditions

- 되돌린 뒤에도 세 줄이 한 덩어리로 읽히면 멈추고, 아이브로우와 제목
  사이 여백을 계단(`--sp-sm` / `--sp-md`)에서 고릅니다. 불투명도를 더
  낮추지 않습니다 — 이미 .72 이고 청록 위에서 대비가 떨어집니다.

## Design documentation

- After acceptance and validation: 없음. 되돌리는 변경이라 새로 기록할
  결정이 없습니다.

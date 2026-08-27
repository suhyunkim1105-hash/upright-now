# 거북이 등껍질 슬라이드 퍼즐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 맵의 마지막 미니게임 슬롯에 3×3 거북이 등껍질 슬라이드 퍼즐을 추가한다.

**Architecture:** 기존 단일 파일 프로토타입 구조를 유지한다. `gateC`와 `PANELS`에 `shellSlide` 패널을 연결하고, 전용 상태·렌더링·입력·타이머 함수로 게임을 격리한다. 완성 배열에서 빈칸의 합법적인 이동을 반복해 항상 풀 수 있는 보드를 만든다.

**Tech Stack:** Vanilla JavaScript, HTML, inline CSS, 기존 delegated event handling.

## Global Constraints

- 퍼즐은 3×3, 8개 타일과 빈칸 1개로 고정한다.
- 제한 시간은 60초, 성공 보상은 `earn(5, '거북이 등껍질 퍼즐 성공')`으로 한 번만 지급한다.
- 외부 런타임 라이브러리와 네트워크 요청을 추가하지 않는다.
- 기존 미니게임 클릭, 스페이스바, 패널 닫기 동작을 회귀시키지 않는다.

---

### Task 1: 퍼즐 상태와 이동 로직

**Files:** `prototypes/openworld/index.html`

- [ ] `SHELL_SLIDE` 상태에 `active`, `timer`, `timerId`, `board`, `blank`, `moves`, `rewarded`를 추가한다.
- [ ] `shellSlideNeighbors(blank)`로 3×3 빈칸의 상하좌우 이웃 인덱스를 계산한다.
- [ ] `shellSlideShuffle()`은 `[0,1,2,3,4,5,6,7,8]`에서 시작해 합법적인 이동을 80회 반복하고 직전 이동을 즉시 되돌리지 않는다.
- [ ] `shellSlideIsSolved()`는 보드가 `[0,1,2,3,4,5,6,7,8]`인지 검사한다.
- [ ] `moveShellSlide(indexOrDirection)`은 인접 타일만 이동시키고 합법적인 이동일 때만 이동 횟수를 증가시킨다.
- [ ] `<script>` 추출 후 `new Function`으로 문법 검사를 실행한다.
- [ ] 상태 로직을 `feat: add shell puzzle state logic` 커밋으로 저장한다.

### Task 2: 패널과 맵 연결

**Files:** `prototypes/openworld/index.html`

- [ ] `shellSlideHtml()`에 3×3 보드, 60초 타이머, 이동 횟수, `aria-live` 안내, 다시 시작 버튼을 추가한다.
- [ ] 타일은 `button[data-shell-index]`로 렌더링하고 등껍질 조각처럼 보이는 CSS를 적용한다.
- [ ] `gateC`와 맵 오브젝트 이름을 `거북이 등껍질 퍼즐`로 바꾼다.
- [ ] `PANELS.shellSlide`를 추가하고 `openPanel`에서 `startShellSlide()`를 실행한다.
- [ ] 패널 delegated click handler에서 타일과 다시 시작 버튼을 generic close 처리보다 먼저 처리한다.
- [ ] 패널이 열려 있을 때 방향키 입력을 가로채 `moveShellSlide`로 전달하고 스페이스바로 패널이 닫히지 않게 한다.
- [ ] `startShellSlide()`는 기존 타이머를 정리하고 HTML·상태를 초기화한 뒤 새 타이머를 시작한다.
- [ ] `renderShellSlide()`는 보드·타이머·이동 횟수·메시지만 갱신한다.
- [ ] 브라우저에서 새 게이트 진입, 타일 클릭, 방향키, 다시 시작을 확인한다.
- [ ] 패널 연결을 `feat: connect turtle shell puzzle panel` 커밋으로 저장한다.

### Task 3: 성공/실패와 회귀 검증

**Files:** `prototypes/openworld/index.html`

- [ ] `finishShellSlide(success)`에서 타이머를 정리하고 성공 시 `성공!`, 완성 등껍질, `+5P`를 한 번만 표시한다.
- [ ] 60초가 되면 실패 메시지를 표시하고 타일 입력을 무시한다.
- [ ] 성공·실패 후에는 다시 시작과 닫기만 가능하게 한다.
- [ ] `prefers-reduced-motion: reduce`에서 타일 이동 애니메이션을 끈다.
- [ ] 재시작 시 보드·타이머·이동 횟수·보상·타이머 interval이 모두 초기화되는지 확인한다.
- [ ] `git diff --check`, JS 문법 검사, 브라우저 콘솔 오류 검사를 실행한다.
- [ ] 최종 변경을 `feat: finish turtle shell slide puzzle` 커밋으로 저장한다.

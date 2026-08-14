# 거북이 등껍질 슬라이드 퍼즐 설계

## 목표

오픈월드 맵의 마지막 미니게임 슬롯(`gateC`)을 거북이 등껍질 슬라이드 퍼즐로 교체한다. 플레이어가 제한 시간 안에 조각을 맞춰 거북이 그림을 완성하면 성공 처리와 포인트 보상을 제공한다.

## 사용자 경험

- 맵의 `Ex 3` 게이트 이름을 `거북이 등껍질 퍼즐`로 변경한다.
- 퍼즐은 3×3 격자이며 8개 타일과 빈칸 1개로 구성한다.
- 타일을 클릭하면 빈칸과 인접한 경우에만 이동한다.
- 키보드 방향키로도 같은 이동을 할 수 있다.
- 퍼즐 시작 때 완성 상태에서 유효한 이동을 반복해 섞어 항상 풀 수 있는 상태를 만든다.
- 제한 시간은 60초이며, 성공 조건은 8개 타일이 원래 순서로 돌아오는 것이다.
- 성공 시 퍼즐 영역에 `성공!`과 완성된 거북이 등껍질을 보여주고 `+5P`를 한 번만 지급한다.
- 실패 시 안내 문구와 `다시 시작` 버튼을 제공한다.
- 퍼즐 타일과 버튼을 클릭해도 미니게임 패널이 닫히거나 맵으로 이동하지 않는다.

## 구현 방식

- 기존 단일 파일 프로토타입 구조를 유지하며 `prototypes/openworld/index.html` 안에 퍼즐 상태, 렌더링, 입력, 타이머 로직을 추가한다.
- 기존 `PANELS`, `openPanel`, delegated click handler 패턴에 `shellSlide` 패널을 연결한다.
- 타일은 CSS grid와 기존 프로젝트 자산을 활용해 등껍질 조각처럼 보이도록 렌더링한다. 외부 네트워크 요청이나 런타임 라이브러리 의존성은 추가하지 않는다.
- 슬라이드 이동 및 solvability 생성은 MIT License로 공개된 [muthuspark/javascript-games](https://github.com/muthuspark/javascript-games)의 Sliding Puzzle 구현을 참고한다. 코드는 프로젝트 구조에 맞게 독립적으로 작성하고, 원 저장소의 라이선스와 출처를 이 문서에 기록한다.

## 상태와 인터페이스

```js
const SHELL_SLIDE = {
  active: false,
  timer: 60,
  board: [],
  blank: 8,
  moves: 0,
  rewarded: false,
};

function shellSlideHtml() {}
function startShellSlide() {}
function renderShellSlide() {}
function moveShellSlide(indexOrDirection) {}
function finishShellSlide(success) {}
```

`renderShellSlide`는 `#shell-slide-board`, `#shell-slide-time`, `#shell-slide-moves`, `#shell-slide-message`만 갱신한다. `startShellSlide`는 기존 타이머를 정리하고 패널 HTML을 재생성해 다시 시작 시 이전 이벤트나 상태가 남지 않게 한다.

## 오류 및 접근성

- 인접하지 않은 타일 클릭은 아무 동작도 하지 않는다.
- 이미 성공하거나 시간 초과한 뒤에는 타일 클릭과 방향키 입력을 무시한다.
- 타이머는 게임 종료 시 반드시 정리한다.
- 타일 버튼에 순서와 방향을 알 수 있는 `aria-label`을 제공한다.
- 모션 감소 설정에서는 타일 이동 애니메이션을 즉시 전환한다.
- 게임 패널 외부의 기존 키 입력 처리보다 퍼즐 입력을 먼저 처리해 스페이스/방향키가 패널을 닫지 않게 한다.

## 검증 기준

- 완성 상태에서 섞인 보드가 생성되고 항상 풀 수 있다.
- 인접 타일 클릭과 방향키 이동이 동일하게 동작한다.
- 60초 만료 시 실패 상태가 되고 타이머가 멈춘다.
- 정답 배열 완성 시 성공 화면과 `+5P`가 한 번만 표시된다.
- 다시 시작 시 보드, 타이머, 이동 횟수, 보상 상태가 초기화된다.
- 기존 세 미니게임과 맵/패널 닫기 동작에 회귀가 없다.
- `<script>` 문법 검사, `git diff --check`, 브라우저 콘솔 오류 검사를 통과한다.

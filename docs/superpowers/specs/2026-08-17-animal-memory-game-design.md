# 동물 기억력 카드 게임 설계

## 목표

현재 동물 찾기 챌린지가 연결된 `(32, 7)` 게이트를 약 2~3분 동안 즐길 수 있는 4×4 동물 기억력 카드 맞추기 게임으로 교체한다.

## 범위

- 기존 `animalFind` 패널 키와 맵 위치를 유지한다.
- 거북이, 기린, 펭귄, 햄스터, 개구리, 고슴도치, 알파카, 백조를 각각 2장씩 사용한다.
- 총 16장을 Fisher–Yates 방식으로 섞고 4×4 Grid로 표시한다.
- 시작 시 2초 동안 모든 카드를 공개한 뒤 플레이를 시작한다.
- 같은 카드 두 장은 matched 상태로 유지하고, 다른 카드 두 장은 700ms 후 다시 뒤집는다.
- `READY`, `PREVIEW`, `PLAYING`, `CHECKING`, `GAME_OVER` 상태로 입력을 제어한다.
- Preview와 카드 비교 중에는 추가 선택을 차단한다.
- 시간, Move, 점수, Combo, 최대 Combo를 표시한다.
- 모든 짝을 맞추면 타이머를 정지하고 결과 화면을 표시한다.
- 최고 점수, 최단 시간, 최소 Move만 localStorage에 저장한다.
- 새 프레임워크, 게임 엔진, 외부 이미지 URL, 새 dependency는 추가하지 않는다.

## 구조

### 엔진

`prototypes/openworld/animal-find-engine.mjs`를 카드 게임 전용 순수 모듈로 교체한다.

엔진은 다음 책임만 가진다.

- 동물 원본 데이터와 카드 인스턴스 생성
- 셔플
- 카드 선택 가능 여부 판정
- 두 카드 비교
- Match 성공·실패 상태 변경
- Move·점수·Combo 계산
- Preview 및 플레이 타이머에 필요한 상태 계산
- 게임 완료 판정

엔진은 DOM, `window`, `localStorage`, 타이머 API에 직접 의존하지 않는다.

### UI 연결

`prototypes/openworld/index.html`의 기존 동물 찾기 UI·핸들러를 기억력 카드 UI·핸들러로 교체한다.

- 시작 화면에서 게임 시작 버튼을 제공한다.
- 카드 하나는 `<button>`으로 렌더링한다.
- `pointerdown`을 우선 사용하고 기존 click fallback을 유지한다.
- 엔진 상태가 `PREVIEW`, `CHECKING`, `GAME_OVER`이면 입력을 무시한다.
- 재시작 시 기존 interval과 timeout을 정리하고 새 게임 상태를 생성한다.
- 패널을 닫을 때 타이머를 정리한다.

### 카드 표현

현재 프로젝트에 이미 있는 동물 데이터와 이모지를 사용한다. 나중에 이미지가 제공되면 동물 데이터의 표시 필드만 교체할 수 있도록 `animalId`와 표시 값을 분리한다.

- 뒷면: 서비스 색상에 맞는 단색·간단한 패턴
- 앞면: 동물 이모지와 동물 이름의 접근성 라벨
- `rotateY(180deg)` 기반 CSS Flip 애니메이션
- Match 성공 시 짧은 scale/glow
- 실패 시 짧은 shake 후 자동으로 뒷면 복귀

## 게임 상태 흐름

```text
READY
  └─ 시작 → PREVIEW
PREVIEW
  └─ 2초 경과 → PLAYING
PLAYING
  ├─ 첫 카드 선택 → PLAYING
  └─ 두 번째 카드 선택 → CHECKING
CHECKING
  ├─ 일치 → PLAYING 또는 GAME_OVER
  └─ 불일치, 700ms → PLAYING
GAME_OVER
  └─ 다시 하기 → PREVIEW
```

`CHECKING`에서는 Move를 1 증가시키고, 두 번째 선택 직후 추가 입력을 받지 않는다. 같은 카드 두 번 선택, 이미 맞춘 카드 선택, 존재하지 않는 카드 선택은 엔진에서 무시한다.

## 점수 규칙

점수 상수는 엔진 설정 객체에 둔다.

- 기본 Match: 100점
- Combo 보너스: `Math.min(combo - 1, 3) * 20`
- 실패 시 Combo: 0
- Move: 두 장을 정상적으로 비교했을 때 1 증가
- 게임 완료: 마지막 Match 처리 후 즉시 종료

## 저장 규칙

저장 키는 `girin.animalMemory.highScore`, `girin.animalMemory.bestTimeMs`, `girin.animalMemory.bestMoves`로 분리한다. 저장 실패(Private Mode 등)는 게임 진행을 막지 않는다.

## 테스트 범위

`scripts/animal-find-engine.test.mjs`를 다음 동작 중심으로 교체한다.

- 16장 생성, 각 동물 2장
- 셔플 결과가 매 게임 달라질 수 있음
- Preview 종료 전 입력 차단
- 첫 카드 선택 후 두 번째 카드 선택
- 같은 카드 Match 유지
- 다른 카드 CHECKING 및 복귀 대상 처리
- 같은 카드 재선택·완료 카드·CHECKING 중 세 번째 카드 무시
- Move, Score, Combo, Max Combo 계산
- 마지막 Match 후 GAME_OVER
- 재시작 가능한 초기 상태 생성

`scripts/animal-find.test.mjs`는 HTML 연결 상태를 검사해 `animalFind` 패널, 카드 버튼, 시작·재시작 핸들러, 엔진 모듈 연결이 유지되는지 확인한다.

## 검증

- `node --test scripts/animal-find-engine.test.mjs scripts/animal-find.test.mjs`
- `node`의 inline script 문법 검사
- `git diff --check`
- `npm run typecheck`
- `npm run build`

기존 Match-3, 기린 목 펴기, 다른 맵 기능은 건드리지 않는다.

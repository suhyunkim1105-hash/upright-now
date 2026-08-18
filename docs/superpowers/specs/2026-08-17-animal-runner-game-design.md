# 동물 달리기 미니게임 설계

## 목표

기존 오픈월드의 기린 목 펴기 미니게임 자리를 약 3분 동안 플레이할 수 있는 Phaser 기반 동물 달리기 게임으로 교체한다. 사용자가 현재 선택한 동물 캐릭터로 장애물을 피하고 코인을 모으며, 종료 시 결과를 기존 서비스에 반환한다.

## 현재 프로젝트 맥락

- 메인 서비스는 React 19, TypeScript, Vite, Zustand를 사용한다.
- 오픈월드는 React 라우트가 아니라 `prototypes/openworld/index.html` 기반의 독립 프로토타입이다.
- 빌드 후 `scripts/copy-prototypes.mjs`가 오픈월드 폴더 전체를 `dist/prototypes/openworld`로 복사한다.
- 현재 미니게임 관문과 패널은 `prototypes/openworld/index.html` 안에서 관리한다.
- 현재 사용자 캐릭터는 `ROOM.character`에 저장되고, `window.GIRIN_CHAR.mine()`이 착용 아이템이 합성된 캐릭터 캔버스를 제공한다.

## 선택한 접근

Phaser를 npm dependency로 추가하고, 오픈월드 패널에서 Phaser 게임을 mount/unmount한다. 게임 결과 화면과 서비스 보상 연결은 기존 HTML 패널 흐름을 사용하고, 실제 게임 루프와 물리 처리는 Phaser Scene에 맡긴다.

Phaser를 CDN으로 불러오지 않는다. 기존 빌드와 로컬 개발 환경에서 의존성을 고정하고, 외부 네트워크 상태에 따라 게임이 달라지지 않도록 한다. 대신 오픈월드를 `file://`로 직접 여는 방식은 중단하고 Vite 개발 서버 또는 빌드 결과의 HTTP 경로에서 확인한다.

## 파일 구조

### 추가

- `prototypes/openworld/animal-runner-engine.mjs`
  - Phaser와 무관한 설정·계산 로직
  - 난이도, 점수, 코인, 충돌 패널티, 무적시간, 종료 결과 계산
  - 테스트 가능한 순수 함수와 상태 생성 함수 제공
- `prototypes/openworld/animal-runner-game.mjs`
  - Phaser `RunnerScene`
  - Canvas 생성, 플레이어, 바닥, 장애물, 코인, HUD, 모바일 입력
  - 게임 lifecycle인 `mount`, `restart`, `destroy` 제공
- `scripts/animal-runner-engine.test.mjs`
  - 순수 엔진 테스트
- `docs/superpowers/plans/2026-08-17-animal-runner-game.md`
  - 구현 단계별 작업 계획

### 수정

- `package.json`
  - `phaser` dependency 추가
- `package-lock.json`
  - npm dependency lock 갱신
- `prototypes/openworld/index.html`
  - 기린 목 펴기 관문을 동물 달리기 관문으로 교체
  - Phaser 게임 패널 mount/unmount
  - `ROOM.character` 및 `GIRIN_CHAR.mine()`을 게임에 전달
  - 결과 표시와 기존 `gameReward()` 연결
  - 패널 닫기 시 게임 destroy
- `scripts/animal-runner.test.mjs`
  - 관문 이름, 패널 연결, 결과 전달, lifecycle 연결에 대한 정적 wiring 테스트

## 게임 상태와 lifecycle

상태는 `READY`, `COUNTDOWN`, `PLAYING`, `GAME_OVER`로 구분한다.

1. 패널을 열면 READY 화면을 보여준다.
2. 시작 버튼을 누르면 Phaser 인스턴스를 만들고 3, 2, 1, GO 카운트다운을 진행한다.
3. COUNTDOWN 동안 입력과 spawn을 막는다.
4. PLAYING에서 180초 타이머, 물리, spawn, 입력을 활성화한다.
5. 180초가 되면 GAME_OVER로 전환하고 spawn·입력·물리·타이머를 중지한다.
6. 결과를 부모 콜백에 한 번만 전달한다.
7. 다시 하기는 기존 Phaser 인스턴스를 재사용해 상태를 초기화한다.
8. 패널 닫기나 컴포넌트 종료는 `destroy()`를 호출해 이벤트, 타이머, Phaser Canvas를 모두 정리한다.

## 캐릭터 전달

게임은 캐릭터 이름과 렌더링 소스를 분리한다.

```js
mountAnimalRunner({
  container,
  character: {
    id: 'turtle',
    name: '거북이',
    image: window.GIRIN_CHAR.mine(),
  },
  onGameComplete(result),
})
```

캐릭터 이미지가 준비되지 않았거나 `GIRIN_CHAR.mine()`을 사용할 수 없는 경우에는 동물별 색상과 이모지 placeholder로 fallback한다. 모든 동물은 같은 물리값을 사용하고 외형만 다르게 한다.

## 러너 규칙

- 기준 플레이 시간은 180초다.
- 플레이어는 화면 왼쪽 영역에 고정하고 월드 오브젝트를 왼쪽으로 이동시킨다.
- 좌우 이동 범위는 화면 너비의 10%~50%로 제한한다.
- 바닥에 있을 때만 점프한다.
- 장애물은 낮은 돌·통나무와 높은 바위·나무 두 종류부터 시작한다.
- 장애물 spawn 간격에는 최소 안전 간격을 둔다.
- 코인은 일렬·곡선·점프 위치 패턴 중 하나로 생성한다.
- 코인 획득은 한 번만 처리한다.
- 장애물 충돌 시 즉시 종료하지 않고 점수 `-200`, 약 1초 감속, 1초 무적을 적용한다.
- 코인 기본 점수는 `100`, 생존 점수는 초당 `10`으로 둔다.
- 60초 이후 월드 속도 10%, 120초 이후 20% 증가한다.
- 코인 연속 획득 수를 combo로 표시하고 장애물 충돌 시 초기화한다.

## Phaser mount 방식

`animal-runner-game.mjs`는 Phaser를 모듈로 import하고, 컨테이너 내부에 하나의 게임 Canvas만 생성한다. 기존 패널의 닫기·다시 하기 동작이 게임 lifecycle을 소유한다. `index.html`의 전역 이벤트 위임은 러너 Canvas 내부 입력을 가로채지 않고, 모바일 버튼만 게임 API를 통해 전달한다.

## 결과와 보상

게임 종료 결과는 다음 shape으로 한 번만 반환한다.

```js
{
  score: number,
  coins: number,
  hitCount: number,
  maxCombo: number,
  playTime: number,
}
```

게임은 XP나 사용자 DB를 직접 변경하지 않는다. 기존 서비스 보상 통로인 `gameReward()`만 호출하고, 부모 서비스가 향후 score를 XP로 변환할 수 있도록 callback 경계를 유지한다.

## 모바일과 데스크톱

- Phaser Scale은 세로형 기준 해상도 `390 x 700`을 사용하고 화면에 맞춰 FIT한다.
- Canvas는 패널의 max-width를 넘지 않는다.
- 모바일 하단에 충분히 큰 좌·우·점프 버튼을 둔다.
- 게임 영역에는 `touch-action: none`을 적용해 페이지 스크롤과 입력을 분리한다.
- 데스크톱은 키보드 `A/D`, `←/→`, `Space`, `↑`를 지원한다.
- 키보드 이벤트는 게임이 PLAYING일 때만 처리한다.

## 테스트와 검증

- 엔진 단위 테스트: 상태 전환, 점프 제한, 코인 중복 방지, 충돌 무적, 난이도 단계, 180초 종료, 재시작 초기화
- wiring 테스트: 교체된 관문·패널, Phaser mount/destroy, 결과 callback 연결
- 실행 검증: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`
- 브라우저 검증: 시작 카운트다운, 키보드·터치 입력, 코인 획득, 장애물 충돌, 결과 화면, 다시 하기, 패널 닫기 후 재진입
- 180초 실제 대기 대신 엔진의 시간 주입 테스트로 종료 경계를 검증한다.

## 범위 제외

스테이지, 보스, 아이템, 상점, 캐릭터 능력치, 랭킹, 멀티플레이, 광고, 결제, 외부 이미지·사운드는 이번 구현에 포함하지 않는다.


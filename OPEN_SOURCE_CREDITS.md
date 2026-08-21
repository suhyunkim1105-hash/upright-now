# 미니게임 오픈소스 출처

두 미니게임은 원본 프로젝트의 이미지나 UI를 복사하지 않고, MIT 라이선스로 공개된 게임의 기본 로직 패턴을 현재 서비스에 맞게 독립적으로 재작성해 사용합니다.

## 동물 기억력 카드

- 원본: [kubowania/memory-game](https://github.com/kubowania/memory-game)
- 저작권: Copyright (c) 2020 Ania Kubow
- 라이선스: MIT License
- 적용한 아이디어: 카드 배열 생성, 셔플, 두 장 선택 후 일치 여부 판정

## 동물 매칭 퍼즐

- 원본: [Ghamza-Jd/Match-3](https://github.com/Ghamza-Jd/Match-3)
- 라이선스: MIT License
- 적용한 아이디어: 초기 매치 방지, 유효한 이동이 항상 존재하도록 보드 생성, 교환 후 매치 판정

원본 저장소의 이미지, 스프라이트, Cocos Creator 프리팹, UI는 포함하지 않습니다. 현재 서비스의 동물 데이터, 화면, 점수, 애니메이션, 입력 잠금, 모바일 대응은 이 프로젝트에서 별도로 구현했습니다.

MIT License 전문은 각 원본 저장소의 `LICENSE` 또는 README에서 확인할 수 있습니다.

## 3D 월드(campus3d) — 통째로 쓰는 오픈 소스

이 셋은 패턴 차용이 아니라 **코드를 그대로** 들여온 것입니다.

### 물리 엔진 — 동물 합치기(수박게임 방식)

- 원본: [liabru/matter-js](https://github.com/liabru/matter-js) 0.20.0
- 라이선스: MIT License
- 파일: `prototypes/campus3d/vendor/matter.min.js` (npm `matter-js` 배포 빌드 그대로)
- 게임 규칙(동물 여덟 단계, 합치기 점수, 선 넘김 판정)은 이 프로젝트가 작성

### 2048 규칙

- 원본: [winsonwq/2048term](https://github.com/winsonwq/2048term) (npm `2048@0.2.2`)
- 저작권: Wang Qiu
- 라이선스: MIT License
- 파일: `prototypes/campus3d/vendor/2048-logic.js` — `row_calc.js`·`table_calc.js` 를
  ESM 으로 감쌌을 뿐 **규칙 코드는 한 줄도 고치지 않았습니다.** 원본에 mocha 시험 포함

### Phaser — 동물 러너

- 원본: [phaserjs/phaser](https://github.com/phaserjs/phaser)
- 라이선스: MIT License
- 파일: `prototypes/openworld/vendor/phaser.esm.min.js` (러너를 열 때만 동적 import)

### 욕설 필터

- 원본: [Tanat05/korcen.ts](https://github.com/Tanat05/korcen.ts)
- 라이선스: Apache License 2.0
- 파일: `prototypes/shared/korcen.js` — 3D 월드 채팅도 같은 사전을 씁니다

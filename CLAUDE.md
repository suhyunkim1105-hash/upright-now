# CLAUDE.md — AI 코딩 도구용 안내

이 저장소에서 작업하기 전에 아래 문서를 **순서대로** 읽으세요.

1. [AGENTS.md](AGENTS.md) — 제품 불변조건·구현 규칙·금지 사항
2. [docs/TEAM_START.md](docs/TEAM_START.md) — 현재 수치·폴더 지도·협업 규칙
3. [docs/14_DATA_PRIVACY_SECURITY.md](docs/14_DATA_PRIVACY_SECURITY.md) — 개인정보 원칙

## 절대 어기면 안 되는 것

1. **의료 판정 금지** — 진단·치료·통증 위험도를 말하지 않습니다.
2. **자세 점수 금지** — 점수·등급·정상/비정상 표시를 만들지 않습니다.
   대신 회복 성공·감지 가능 시간·출석·XP 를 씁니다.
3. **카메라 영상 저장·전송 금지** — 영상·프레임·랜드마크 좌표·개인 기준은
   어떤 서버에도 보내지 않습니다. 분석은 브라우저 안에서 끝냅니다.
4. **`src/constants/posture.ts` 임계값 임의 변경 금지** — 판정 시간이 바뀌면
   보상·게임 밸런스가 전부 흔들립니다. 바꾸려면 먼저 상의하세요.
5. **`main` 직접 push 금지** — 브랜치를 만들어 작업하고 PR 로 합칩니다.

## 작업을 마치기 전에 실행

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm run test
```

```bash
npm run build
```

`npm run test:e2e` 는 처음 한 번 `npx playwright install chromium` 이 필요합니다.

## 숫자가 헷갈릴 때

**`src/constants/` 안의 코드가 언제나 정답입니다.**
`docs/archive/` 문서는 초기 기획 기록이라 지금 값과 다릅니다.
정리된 현재 값은 [docs/TEAM_START.md](docs/TEAM_START.md) §4 에 있습니다.

## 담당 영역

| 담당 | 영역 | 주요 폴더 |
|---|---|---|
| 수현 | 2인 친구 방 | `src/features/rooms/` |
| 연우 | 캠퍼스 (학교 테마·영토전) | `src/features/campus/` |
| 민철 | 자세 판정·캘리브레이션·PIP | `src/features/posture-engine/`, `calibration/`, `pip/` |

남의 담당 폴더를 고쳐야 하면 먼저 이야기해 주세요.
공용 폴더(`game/`, `modes/`, `sessions/`, `constants/`)는 특히 충돌하기 쉽습니다.

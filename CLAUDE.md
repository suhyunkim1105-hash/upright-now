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
| 수현 | 친구 방(최대 10인) | `src/features/rooms/` |
| 연우 | 캠퍼스 (학교 테마·영토전) | `src/features/campus/` |
| 민철 | 자세 판정·캘리브레이션·PIP | `src/features/posture-engine/`, `calibration/`, `pip/` |

남의 담당 폴더를 고쳐야 하면 먼저 이야기해 주세요.
공용 폴더(`game/`, `modes/`, `sessions/`, `constants/`)는 특히 충돌하기 쉽습니다.

## `src/` 밖에도 코드가 있습니다

| 폴더 | 무엇 |
|---|---|
| `api/` | Vercel 서버 함수. **AI 세션 회고가 여기서만 돕니다** — 키가 프론트에 없어야 하므로 |
| `supabase/migrations/` | 방·캠퍼스 테이블과 RLS. 실행은 되돌리기 어려우니 확인받고 |
| `prototypes/room-flow/` | 화면·흐름 프로토타입. 빌드에 안 들어가고 `src/` 와 서체만 공유 |
| `public/fonts/wanted-sans/` | Wanted Sans Variable, 유니코드 구간별 92 subset |
| `e2e/` | Playwright. dev 서버 3대(5283/5284/5285)를 자동으로 띄웁니다 |

## 알아 두면 시간 아끼는 것

**세션 기록은 기기를 떠나지 않습니다.** `SessionSummary` 는 결과 화면과 AI
회고에서만 쓰이고 어디에도 저장되지 않습니다. 게임 진행도만 `localStorage`
에 남습니다. 그래서 **지금은 리텐션·코호트를 계산할 수 없습니다.**

**AI 회고는 켜져 있지 않습니다.** `VITE_ENABLE_AI_REPORT`, `AI_REPORT_ENABLED`,
`GEMINI_API_KEY` 셋이 모두 있어야 돕니다. 키는 Vercel 대시보드에만 넣습니다.
로컬·E2E 는 `AI_REPORT_MOCK=true` 로 고정 응답을 씁니다.

**단위 테스트가 통과해도 화면이 깨질 수 있습니다.** 레일이 사라지고 캐릭터가
안 뜬 회귀가 단위 테스트를 전부 통과하고 E2E 에서만 잡힌 적이 있습니다.
화면·흐름을 바꿨으면 `npm run test:e2e` 까지 돌립니다.

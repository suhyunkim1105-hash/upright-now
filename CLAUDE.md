# CLAUDE.md — AI 코딩 도구용 안내

이 저장소에서 작업하기 전에 아래 문서를 **순서대로** 읽으세요.

1. [AGENTS.md](AGENTS.md) — 제품 불변조건·구현 규칙·금지 사항
2. [prototypes/DESIGN.md](prototypes/DESIGN.md) — 색·서체·여백·모션의 근거
3. [docs/14_DATA_PRIVACY_SECURITY.md](docs/14_DATA_PRIVACY_SECURITY.md) — 개인정보 원칙

## 제품은 `prototypes/` 입니다

2026-08-21 에 **React 본서비스(`src/`)를 폐기했습니다.** 7월에 React 로 먼저
만들었고 8월부터 프로토타입으로 옮겨 왔는데, 한동안 둘이 같은 저장소·같은
배포에 나란히 살아 있었습니다. 제품 하나에 구현이 두 벌이면 값이 조용히
갈라집니다 — 실제로 자세 엔진이 그렇게 갈라져 있었습니다(React `lite`,
프로토타입 `full`).

| 폴더 | 무엇 |
|---|---|
| `prototypes/landing/` | 랜딩. 배포본의 `/` 가 이 파일입니다 |
| `prototypes/onboarding/` | 알 고르기 → 학교 인증 → 자세 기준 10초 |
| `prototypes/home/` | 메인. 세션 시작 · 캐릭터 · 랭킹전 · 마이페이지 |
| `prototypes/openworld/` | 픽셀 캠퍼스. 앉으면 자세를 봅니다 |
| `prototypes/shared/` | **여러 화면이 함께 쓰는 것** — 아래 참고 |
| `prototypes/room-flow/` | 라임 시절 옛 셸. 방 만들기 마법사 참고본이라 **지우지 마세요** |
| `api/` | Vercel 서버 함수. 날씨·AI 회고. `api/_shared/` 에 계약 타입 |
| `supabase/` | 표·RLS·RPC. 실행은 되돌리기 어려우니 확인받고 |
| `public/fonts/` | Wanted Sans Variable, 유니코드 구간별 92 subset |

프로토타입은 **단일 HTML** 입니다. 빌드 없이 브라우저로 그냥 엽니다.

## 절대 어기면 안 되는 것

1. **의료 판정 금지** — 진단·치료·통증 위험도를 말하지 않습니다.
2. **자세 점수 금지** — 점수·등급·정상/비정상 표시를 만들지 않습니다.
   대신 회복 성공·감지 가능 시간·출석·코인을 씁니다.
3. **카메라 영상 저장·전송 금지** — 영상·프레임·랜드마크 좌표·개인 기준은
   어떤 서버에도 보내지 않습니다. 분석은 브라우저 안에서 끝냅니다.
4. **`prototypes/shared/posture.js` 의 임계값 임의 변경 금지** — 판정 시간이
   바뀌면 보상·게임 밸런스가 전부 흔들립니다. 바꾸려면 먼저 상의하세요.
5. **`main` 직접 push 금지** — 브랜치를 만들어 작업하고 PR 로 합칩니다.

## 웹캠은 한 파일입니다

**자세를 보는 코드는 `prototypes/shared/posture.js` 하나입니다.** 월드·온보딩·
메인이 같은 것을 부릅니다.

한동안 월드와 온보딩에 같은 328줄이 각각 들어 있었습니다. 글자 하나까지
같았지만 그건 우연이고, 한쪽만 고치면 갈라집니다. **온보딩에서 잡은 기준을
월드가 그대로 읽으므로**, 두 곳의 계산이 다르면 기준이 어긋난 채로 판정이
돕니다 — 화면에는 아무 증상이 없고 숫자만 틀립니다.

모델은 `pose_landmarker_full` 이고 라이브러리는 `tasks-vision@0.10.35` 에
묶여 있습니다. 왜 그 조합인지는 그 파일 머리말에 실측값과 함께 있습니다.

## 작업을 마치기 전에 실행

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run build
```

메인 화면을 고쳤으면 하나 더 — 판 배경·호버·타이포 계약·초점 링·axe·
가로 넘침을 세 폭에서 잽니다.

```bash
npm run check:home
```

이 검사에는 서버가 필요합니다.

```bash
npx http-server . -p 8177 -c-1
```

## 알아 두면 시간 아끼는 것

**세션 기록은 기기를 떠나지 않습니다.** `localStorage` 의 `girin.sessions` ·
`girin.baseline` · `girin.room` · `girin.reward` 넷이 전부입니다. 그래서
**지금은 리텐션·코호트를 계산할 수 없습니다.**

**AI 회고는 켜져 있지 않습니다.** `AI_REPORT_ENABLED`, `GEMINI_API_KEY` 가
있어야 돕니다. 키는 Vercel 대시보드에만 넣습니다.

**단위 테스트가 통과해도 화면이 깨질 수 있습니다.** 이 저장소에서 세 번
났습니다 — 주석을 안 닫아 판 배경이 통째로 사라졌고, 클래스를 지워 한
화면만 평문이 됐고, 애니메이션 `fill` 이 `transform` 을 붙들어 호버가
죽었습니다. 셋 다 JS 에러도 콘솔 경고도 없었고, **계산된 값을 재서** 잡혔습니다.
`npm run check:home` 이 그 셋을 검사합니다.

## 되돌리기 어려운 작업

아래는 실행 전에 사용자 확인을 받습니다.

- `main` 병합, 원격 push, PR 머지
- Vercel 배포 (`npx vercel deploy` — 반드시 클라우드 빌드)
- Supabase 마이그레이션 실행
- 추적되지 않는 파일의 대량 삭제

# OVERNIGHT QA AUDIT — UpRight Now

> 독립 QA 감사 · 2026-07-26 · 브랜치 `audit/overnight-qa` (base `44f4a92`)
> 대상: 현재 main 코드 + Production <https://upright-now.vercel.app>
> 코드는 수정하지 않았습니다. 이 문서만 추가합니다.

## 0. 감사 범위와 방법

| 항목 | 내용 |
|---|---|
| 코드 리뷰 | `src/**` 전 파일 정독 + `docs/00~21`, `README.md`, `docs/AI_HANDOFF.md`, `supabase/schema.sql` 교차 검증 |
| 자동 검증 | `npm run lint` · `typecheck` · `test` · `test:e2e` · `build` |
| Production 검증 | Playwright(headless Chromium)로 실제 Production 도메인에 접속해 라우트·레이아웃·localStorage·네트워크 요청을 직접 측정 |
| **검증하지 않은 것** | **실제 웹캠 영상·MediaPipe 추론·실제 2인 동시 접속.** 이 환경에는 카메라가 없습니다. 카메라가 필요한 항목은 §5 "사용자가 직접 확인해야 하는 항목"으로 분리했고, 본문에서 "실기기 확인 필요"로 표시했습니다. |

### 자동 검증 결과

```
npm run lint       ✅ 통과 (0 warning)
npm run typecheck  ✅ 통과
npm run build      ✅ 통과 (7.47s, dist 375kB / gzip 117kB)
npm run test:e2e   ✅ 67 passed · 1 skipped (room-live: Supabase env 없음 → 자동 skip)
npm run test       ⚠️ 168 passed · 5 failed  → ISSUE-16 참조
                      (QaLab.spec.tsx 5건, 전부 "Test timed out in 5000ms".
                       `--testTimeout=60000` 로 재실행하면 7/7 통과 → 로직 결함이 아니라
                       기본 타임아웃이 이 머신의 렌더 속도를 못 견디는 것)
```

### Production 실측 요약

- 모든 라우트 200, 알 수 없는 URL·`/lab`·경로 조작(`/session/../etc`)은 모두 `/` 로 리다이렉트 → **404·빈 화면 없음** ✅
- `window.__upright` 미설치 ✅ · QA Lab 라우트 미등록 ✅
- 1440×1000 / 1280×800 12개 화면 전부 **가로 스크롤 0px, main 내부 요소 뷰포트 이탈 0건** ✅
- `/session/demo` 진입~세션 시작 중 네트워크 요청 4건, **전부 same-origin, POST 0건, 오프-오리진 0건** ✅

---

## 1. 발견한 문제

전체 22건 · **P0 3건 · P1 8건 · P2 11건**

---

### ISSUE-01 · P0 · 스트레칭 완료 보상 무한 반복 (보상 경제 붕괴)

- **기능**: 스트레칭 완주 보상 / 중복 보상 (검사항목 10·11·18)
- **URL**: <https://upright-now.vercel.app/stretch>

**재현 순서**

1. 사이드바 또는 대시보드 빠른 메뉴에서 `스트레칭` 진입 (세션 불필요, 로그인 불필요)
2. 타이머(30~45초)를 **기다리지 않고** 즉시 `완료` 클릭
3. `한 동작 더` 클릭
4. 2~3을 반복

**기대 결과**
한 번의 스트레칭 완주에 대해 보상 1회. 동작을 끝까지 수행하지 않으면(중도 이탈) 보상 없음.

**실제 결과 (Production 실측)**
클릭 1회당 **+20 XP / +20 P가 무제한 적립**되고 `localStorage` 에 그대로 영속화됩니다.
5회 클릭 ≈ 7초 만에 XP 0→100, 포인트 0→100 (과잠 1벌 가격) 도달을 실측했습니다.

```
클릭1 → {xp:20,  points:20}
클릭2 → {xp:40,  points:40}
클릭3 → {xp:60,  points:60}
클릭4 → {xp:80,  points:80}
클릭5 → {xp:100, points:100}   ← 경과 시간 총 7초, 실제 스트레칭 0초
```

**의심 파일과 함수**

- `src/app/routes/Stretch.tsx` `finish()` (L75-95) — `remaining` 을 전혀 보지 않고 즉시 `applyReward` 호출
- `src/app/routes/Stretch.tsx` `pickAnother()` (L57-65) — `newAttempt()` 로 **새 보상 id를 발급**하므로 `applyReward` 의 id 중복 차단이 무력화됨
- `src/app/routes/Stretch.tsx` `restart()` (L67-73) — 동일 문제

**기존 테스트가 놓친 이유**
`src/features/game/rewards.spec.ts:61` 은 *"같은 id"* 를 두 번 넣어 차단되는 것만 확인합니다. 실제 결함은 UI가 **매번 새 id를 만들어 준다**는 점이라 순수 함수 테스트로는 절대 잡히지 않습니다. `Stretch.tsx` 에는 단위 테스트가 없고, e2e에도 스트레칭 보상 시나리오가 없습니다.

**권장 수정**

1. `finish()` 진입 조건에 실제 진행 검사 추가 — 예: `if (remaining > 0) return`, 또는 `완료` 버튼을 `remaining === 0` 일 때만 노출/활성화
2. 보상 id를 시도(attempt)가 아니라 **`{sessionId}-{routineId}-{날짜}` 같은 자연키**로 바꿔 `한 동작 더` 반복이 새 id를 만들지 못하게 함
3. 세션 밖 독립 스트레칭에는 1일 보상 상한(예: 3회)을 두기

**회귀 위험**: 낮음. `Stretch.tsx` 단독 변경. 다만 `건너뛰기 불이익 없음`(docs/09) 원칙은 유지해야 하므로, 미완주 시 **보상 미지급**과 **벌점 부과**를 혼동하지 말 것.

---

### ISSUE-02 · P0 · 세션 중 스트레칭으로 진입하면 진행 중인 세션이 소멸

- **기능**: 활성 세션 중 스트레칭 후 동일 세션 복귀 (검사항목 8·18)
- **URL**: `/session/{id}` → `/stretch/demo` → `/result/demo`

**재현 순서**

1. `/session/setup` 에서 `25분 집중 시작`
2. 세션 화면(`/session/s-1785010473010`)에서 몇 분 진행
3. 오른쪽 제어 카드의 `스트레칭 예약` 클릭
4. 스트레칭 화면에서 `건너뛰기`(또는 완료 후 `결과 보기`) 클릭

**기대 결과**
스트레칭이 끝나면 **원래 세션(`/session/s-...`)으로 복귀**하고 타이머가 이어집니다.

**실제 결과 (Production 실측)**

- 스트레칭 화면의 버튼은 `잠시 멈춤 · 다시 시작 · 다른 동작 · 완료 · 건너뛰기` 5개뿐. **세션으로 돌아가는 버튼이 존재하지 않습니다.**
- `건너뛰기` → `/result/demo` 로 이동. URL의 세션 id가 실제 세션 id가 아니라 하드코딩된 `demo` 입니다.
- 도착한 결과 화면은 **"여기까지의 기록을 정리했어요 · 중도 종료"** 배지를 띄웁니다.
- 그런데 원래 세션은 `finalizeSession` 이 호출된 적이 없어 **`status: 'running'` 인 채로 얼어붙고, 기록도 남지 않습니다**(`upright-now:sessions` 항목 수 0 실측).
- 즉 사용자는 "25분 세션을 진행하다 잠깐 스트레칭했을 뿐"인데 세션이 사라지고, 화면은 하지도 않은 "중도 종료"를 통보합니다.

**의심 파일과 함수**

- `src/app/routes/Session.tsx` L332-337 — `navigate(ROUTES.stretch())` 가 인자 없이 호출되어 항상 `/stretch/demo`
- `src/app/routes/Stretch.tsx` L147-153 — 유일한 출구가 `navigate(ROUTES.result())` = `/result/demo` 고정. 복귀 대상(from) 개념 자체가 없음
- `src/constants/routes.ts` L10-11 — `stretch`/`result` 의 기본 인자 `'demo'`
- `src/app/routes/Result.tsx` — `useParams` 를 아예 쓰지 않아 URL의 `:sessionId` 가 무시되고 항상 전역 스토어를 그림 (ISSUE-11 참조)

**기존 테스트가 놓친 이유**
e2e는 `/session/demo → 완료 → 결과 보기` 만 확인합니다(`e2e/screens.spec.ts:110`). "세션 진행 중 → 스트레칭 → 복귀" 라는 **화면 간 왕복 시나리오가 테스트에 아예 없습니다.** 단위 테스트도 `Stretch.tsx` 를 다루지 않습니다.

**권장 수정**

1. `Session.tsx` → `navigate(ROUTES.stretch(sessionId), { state: { from: 'session' } })`
2. `Stretch.tsx` 에 복귀 버튼 추가 — `from === 'session'` 이면 `세션으로 돌아가기` → `/session/{sessionId}`, 아니면 현행 동작
3. 세션이 `running` 인 동안에는 `/result/*` 진입 시 결과가 아니라 세션으로 리다이렉트

**회귀 위험**: 중간. `ROUTES.result()`/`ROUTES.stretch()` 기본 인자에 의존하는 e2e 경로(`/stretch/demo`, `/result/demo`)가 여러 곳에 있어 함께 손봐야 합니다.

---

### ISSUE-03 · P0 · 캘리브레이션 없이 세션이 시작되고 완주 보상까지 지급

- **기능**: 캘리브레이션 없는 일반 세션 차단 / 카메라 권한 (검사항목 3·5)
- **URL**: <https://upright-now.vercel.app/session/demo> · `/session/setup`

**재현 순서**

1. 브라우저 데이터를 지운 새 사용자로 `/session/demo` 직접 진입 (또는 `/session/setup` → 시작)
2. `이 세션 시작하기` 클릭

**기대 결과**
개인 기준이 등록되지 않았으면 세션을 시작할 수 없거나, 최소한 `기준 등록` 으로 유도해야 합니다(검사항목 7 "캘리브레이션 없는 일반 세션 차단").

**실제 결과 (Production 실측)**

- **아무 차단도 없이 세션이 시작**됩니다. `hasCalibration` 은 미설정 상태였습니다.
- `useRealCamera = camera && hasCalibration && !isDemo` 가 false이므로 **`<video>` 요소조차 생성되지 않고**(실측 `videoElementPresent: 0`) 카메라 권한도 요청되지 않습니다.
- 자세 상태는 25분 내내 `unstable` 로 고정되고, 화면에는 **"⚠ 측정 어려움 / 측정 상태 불안정"** 과 함께
  **"측정하기 어려운 상태예요. 카메라 위치와 조명을 확인해 주세요."** 가 표시됩니다.
  → 원인은 "기준 미등록"인데 사용자에게는 "카메라 위치·조명 문제"라고 잘못 안내합니다.
- 그럼에도 타이머는 정상 진행하고, 25분 후 `finalizeSession('timer')` 가 실행되어
  **+100 XP / +100 P · 출석 기록 · `shopUnlocked = true`** 가 모두 지급됩니다.
- 자세 감지가 0초도 동작하지 않은 세션이 정상 완주로 집계됩니다.

**의심 파일과 함수**

- `src/app/routes/SessionSetup.tsx` `startSession()` (L28-44) — `hasCalibration` 을 읽어 배지만 표시하고(`L154`) 시작 버튼은 무조건 활성
- `src/app/routes/Session.tsx` L63 — 기준이 없으면 카메라를 끄기만 하고 세션은 그대로 진행
- `src/app/router/AppRoutes.tsx` L30-31 — `/session/*` 에 가드 라우트 없음
- `src/constants/copy.ts` `POSTURE_COPY.unstable` — 원인과 무관한 안내 문구
- `src/features/sessions/finalizeSession.ts` L47-64 — 감지 가능 시간(`detectableMs`)이 0이어도 완주 보상 지급

**기존 테스트가 놓친 이유**
`finalizeSession.spec.ts` 는 `seedSession()` 으로 **`detectableMs = elapsedMs` 를 강제 주입**한 뒤 완주를 검증합니다. 즉 "감지가 한 순간도 되지 않은 세션" 이라는 상태를 테스트가 만들어 본 적이 없습니다. e2e도 전부 `?demo=1`(= `hasCalibration: true` 강제)로 돌기 때문에 미등록 사용자 경로를 밟지 않습니다.

**권장 수정**

1. `SessionSetup` 시작 버튼: `hasCalibration === false` 면 비활성 + `기준 등록하기` CTA로 대체 (데모는 예외)
2. `/session/:id` 라우트 가드: 기준 없음 & 데모 아님 → `/calibration` 리다이렉트
3. `finalizeSession`: `detectableMs === 0` 인 세션은 완주 보상·출석에서 제외 (기록은 유지)
4. `POSTURE_COPY.unstable` 을 원인별로 분기 — 기준 미등록 / 카메라 미허용 / 조명 문제

**회귀 위험**: 중간. `?demo=1` 경로와 QA Lab이 기준 없이 세션을 시작하는 데 의존하고 있어(`e2e/*.spec.ts` 다수) 데모 예외를 정확히 열어 두어야 e2e가 깨지지 않습니다.

---

### ISSUE-04 · P1 · 브라우저 뒤로가기·내부 이동이 진행 중인 세션을 경고 없이 폐기

- **기능**: 브라우저 뒤로가기 중 세션 보호 / 내부 이전 버튼 (검사항목 7)
- **URL**: `/session/{id}` → 뒤로가기

**재현 순서**

1. `/session/setup` → `25분 집중 시작`
2. 세션 진행 중 브라우저 **뒤로가기** 버튼

**기대 결과**
"세션이 진행 중입니다. 종료할까요?" 같은 확인 또는 세션 유지·복귀 안내.

**실제 결과 (Production 실측)**

- 확인 다이얼로그 **없음** (`beforeunload`·`blocker` 미구현)
- 즉시 `/session/setup` 으로 빠져나가고, 1초 틱 인터벌이 언마운트되어 **타이머가 조용히 멈춥니다**
- `finalizeSession` 이 호출되지 않아 **세션 기록 0건** (실측)
- `sessionStore.status` 는 `'running'` 인 채로 남아, 이후 대시보드/PiP/결과 화면이 "진행 중"이라는 잘못된 전제로 렌더됩니다
- 세션 화면에는 **웹앱 내부 "이전" 버튼이 아예 없습니다.** `AppShell chrome="focus"` 가 사이드바까지 숨기므로(`AppShell.tsx` L18-24) 세션 중 이동 수단은 브라우저 뒤로가기뿐입니다.

**의심 파일과 함수**

- `src/app/routes/Session.tsx` — `useBlocker`/`beforeunload` 부재, cleanup에서 `finalizeSession` 미호출 (L77, L87)
- `src/components/layout/AppShell.tsx` L18-24 — focus 모드에 뒤로가기/홈 링크 없음

**기존 테스트가 놓친 이유**
e2e는 `page.goto()` 로 매번 새로 진입할 뿐 `page.goBack()` 을 한 번도 호출하지 않습니다. 언마운트 시 세션 상태를 검증하는 테스트가 없습니다.

**권장 수정**

1. react-router `useBlocker` 로 `status === 'running'` 일 때 이탈 확인
2. 확인 시 `finalizeSession('manual')` 을 태워 기록을 남기고 상태를 정리
3. `AppShell chrome="focus"` 에 최소한의 `← 나가기` 컨트롤 추가

**회귀 위험**: 중간. blocker는 `MemoryRouter` 기반 단위 테스트와 상호작용하므로 QaLab.spec 계열 렌더 테스트를 함께 확인해야 합니다.

---

### ISSUE-05 · P1 · 데모 모드가 실제 사용자의 닉네임·XP를 덮어쓰고, 빠져나올 방법이 없음

- **기능**: 데모 데이터와 실제 사용자 데이터 혼합 (검사항목 18·22)
- **URL**: <https://upright-now.vercel.app/camera>

**재현 순서**

1. 실제 사용자 상태를 만든다 (닉네임 `수현`, XP 350, 포인트 120, 완료 세션 2회, 기준 미등록)
2. 대시보드 `지금 집중 시작` → 기준이 없으므로 `/camera` 로 이동
3. `카메라 없이 3분 데모` 클릭

**기대 결과**
데모를 보더라도 사용자의 정체성과 진행도가 화면에서 바뀌지 않거나, 최소한 "데모를 종료하고 내 계정으로 돌아가기" 수단이 있어야 합니다.

**실제 결과 (Production 실측)**

- 클릭 즉시 닉네임이 **`데모 기린`** 으로, 캐릭터가 **`Lv.3 빼꼼 거부기린`(XP 700)** 으로 바뀝니다. 화면 어디에도 `수현` 이 남지 않습니다.
- `hasCalibration` 이 `true` 로 강제됩니다(실제로는 미등록).
- **데모를 종료하는 UI가 존재하지 않습니다** (`데모 종료`/`데모 끄기` 버튼 없음 실측). `disableDemo()` 는 테스트 코드에서만 호출됩니다.
- 이후 이 탭에서 하는 모든 세션은 `isDemo === true` 로 취급되어 **기록·출석·상점 해제가 전부 무효화**됩니다. 사용자는 25분을 진행하고도 아무것도 남지 않습니다.
- 디스크(`localStorage`)의 실제 데이터는 보존되므로(persist가 데모를 차단) **새로고침해야만** 원래 계정으로 돌아옵니다.

**의심 파일과 함수**

- `src/features/demo/demoMode.ts` `enableDemo()` (L36-48) — 기존 값을 백업하지 않고 `setState` 로 덮어씀
- `src/app/routes/CameraIntro.tsx` `startDemo()` (L34-38) — 온보딩 완료 사용자에게도 노출
- `src/components/layout/SidebarNavigation.tsx` L35-39 — `데모` 배지는 표시하지만 해제 수단 없음

**기존 테스트가 놓친 이유**
`demoMode.spec.ts` 는 `enableDemo()` 직후 값이 데모 값인지, `persist.spec.ts` 는 데모 값이 저장되지 않는지만 봅니다. **"실제 데이터가 이미 있는 사용자가 데모에 진입하는" 시작 상태를 아무 테스트도 만들지 않습니다.**

**권장 수정**

1. `SidebarNavigation` 의 `데모` 배지를 클릭 가능하게 만들고 `disableDemo()` 연결
2. `enableDemo()` 가 이전 상태를 스냅샷하고 `disableDemo()` 가 복원 (현재는 `reset()` 이라 실제 데이터도 날림 — 이 부분도 함께 고쳐야 함)
3. 온보딩을 마친 사용자(`hasOnboarded === true`)에게는 `/camera` 의 데모 버튼을 숨기거나 확인 모달 추가

**회귀 위험**: 중간. `disableDemo()` 가 현재 `useProgressionStore.reset()` 을 호출하므로 복원 로직으로 바꾸면 `QaLab.spec.tsx`·`persist.spec.ts` 의 `beforeEach` 가 영향을 받습니다.

---

### ISSUE-06 · P1 · 대시보드 "오늘 집중" 시간이 하드코딩된 `0:00`

- **기능**: 대시보드 오늘 집중 시간 (검사항목 6)
- **URL**: <https://upright-now.vercel.app/>

**재현 순서**: 세션을 진행·종료한 뒤 대시보드로 이동, 오른쪽 레일 `오늘의 기록` 확인

**기대 결과**: 오늘 누적 집중 시간이 표시됩니다.

**실제 결과**: 언제나 `0:00`. 실측에서도 세션 후 `0:00` 그대로였습니다.

```tsx
// src/app/routes/LandingDashboard.tsx:60
<StatTile label="집중" value="0:00" tone="surface" />
```

값이 계산되지 않고 문자열 리터럴로 박혀 있습니다. 바로 옆 `콤보`·`포인트` 는 실제 스토어 값을 쓰고 있어 사용자는 이 값도 실제라고 오인합니다.

**의심 파일과 함수**: `src/app/routes/LandingDashboard.tsx` L59-63

**기존 테스트가 놓친 이유**: 대시보드 테스트(`QaLab.spec.tsx` "대시보드" describe)는 세션 길이 라디오와 캐릭터 레벨만 검사합니다. 레일 통계값을 확인하는 단언이 없습니다.

**권장 수정**: `useSessionHistoryStore` 의 `summaries` 를 오늘 날짜로 필터해 `elapsedMs` 합계를 `formatDuration` 으로 표시. (`History.tsx` L14 에 이미 동일한 집계 코드가 있습니다.)

**회귀 위험**: 낮음.

---

### ISSUE-07 · P1 · "최근 세션 누적 시간"을 세션 수 × 25분으로 조작해서 표시

- **기능**: 중단 세션의 실제 집중 시간 / 사용자 지정 세션 시간 (검사항목 17)
- **URL**: <https://upright-now.vercel.app/> (완료 세션 1회 이상)

```tsx
// src/app/routes/LandingDashboard.tsx:259
{`완료한 세션 ${completedSessions}회 · 누적 ${formatDuration(completedSessions * 1500000)}`}
```

**기대 결과**: 실제 누적 집중 시간.

**실제 결과**: 세션 길이와 무관하게 **1회 = 25분(1,500,000ms)으로 고정 환산**합니다.

- 15분 세션 4회 → 실제 60분인데 화면은 **100분**
- 50분 세션 2회 → 실제 100분인데 화면은 **50분**
- 80% 시점(20분)에 수동 완주한 세션도 25분으로 계산

**의심 파일과 함수**: `src/app/routes/LandingDashboard.tsx` L246-262

**기존 테스트가 놓친 이유**: 이 문자열을 검증하는 테스트가 없습니다. `SESSION_LENGTHS` 는 15/25/50/3분을 지원하지만 대시보드 집계는 25분만 가정합니다.

**권장 수정**: `summaries.filter(s => s.status === 'completed').reduce((a, s) => a + s.elapsedMs, 0)` 사용.

**회귀 위험**: 낮음.

---

### ISSUE-08 · P1 · 친구 방 반응 3종이 세션 중 상대 화면에 표시되지 않음

- **기능**: 반응 3종 동기화 / 두 캐릭터 표시 (검사항목 16)
- **URL**: `/room/{code}` → `/session/room-{code}`

**재현 순서**

1. A가 방 생성, B가 코드로 입장
2. 둘 다 `준비 완료`, A(방장)가 `세션 시작`
3. 양쪽이 `/session/room-XXXXXX` 로 이동
4. 한쪽이 `조금만 더` / `같이 리셋하자` / `나도 완료했어` 를 보냄

**기대 결과**
docs/08 §12: *"세션 중 화면 구석에 짧게 표시하고, 반복 스팸을 제한합니다."*
docs/08 §2: 두 사람이 함께한다는 감각 — 상대 캐릭터가 보여야 합니다.

**실제 결과 (코드 확인)**

- **반응 UI(보내기·표시)는 `Room.tsx` 대기실에만 존재합니다.** 세션이 시작되면 `Room.tsx` 는 즉시 `/session/room-CODE` 로 이동(`Room.tsx` L43-55)하고 언마운트되므로, 세션 중에는 반응을 **보낼 수도 볼 수도 없습니다.**
- 수신 측도 마찬가지입니다. `handleEvent()` 의 `reaction_sent` 분기는 `addReaction()` 만 하고 **`lastFriendEvent` 를 설정하지 않은 채 early return** 합니다(`roomService.ts` L68-73). `Session.tsx` 는 `lastFriendEvent` 만 토스트로 띄우므로(L114-118) **반응은 어떤 경로로도 세션 화면에 도달하지 않습니다.**
- **상대 캐릭터도 세션 중에는 보이지 않습니다.** `Session.tsx` 는 자기 캐릭터 1개와 공동 보스 HP만 렌더합니다. 참가자 카드는 대기실 전용입니다.
- 결과적으로 세션 중 "함께한다"는 신호는 공동 보스 HP 숫자와 회복/완주 토스트뿐입니다.

**의심 파일과 함수**

- `src/features/rooms/roomService.ts` `handleEvent()` L68-73 (early return)
- `src/app/routes/Session.tsx` L105-126 (반응·참가자 UI 부재)
- `src/app/routes/Room.tsx` L43-55, L230-249

**기존 테스트가 놓친 이유**
`rooms.spec.ts` 는 `sanitizeRoomEvent` 와 기린 싱크 **순수 로직**만 검증합니다. `e2e/room-live.spec.ts` 는 생성→입장→준비→시작→HP→기린 싱크→금지 payload 까지만 확인하고 **반응 표시와 상대 캐릭터 렌더는 단언하지 않습니다.** 게다가 이 스펙은 Supabase env가 없으면 자동 skip 되어 CI에서 사실상 실행되지 않습니다(이번 실행에서도 skip).

**권장 수정**

1. `handleEvent()` 의 `reaction_sent` 분기에서 `lastFriendEvent`(또는 전용 `lastReaction`) 설정
2. `Session.tsx` 에 `isRoomSession` 일 때 반응 버튼 3종 + 상대 캐릭터 미니 카드 추가
3. `room-live.spec.ts` 에 "A가 보낸 반응이 B 세션 화면에 보인다" 단언 추가

**회귀 위험**: 낮음~중간. 반응 스팸 제한(docs/08 §12)을 함께 넣어야 합니다.

---

### ISSUE-09 · P1 · arbiter가 단 한 프레임의 흔들림에도 bad 5초 카운트를 전부 리셋 (회복 기회 미발생 위험)

- **기능**: 5초 자세 이탈 후 회복 기회 (검사항목 4·5) — **실기기 확인 필요**
- **URL**: `/session/{id}` (카메라 사용 중)

**분석**

`arbiterStep()` 은 후보 상태가 바뀌면 경과 시간을 **버립니다**.

```ts
// src/features/posture-engine/classify.ts:195
if (state.candidate !== target) {
  return { ...state, candidate: target, candidateSince: now }  // ← 누적치 소멸
}
```

`voteBad` 와 `voteWarning` 은 조건이 다릅니다.

```ts
voteWarning = primaryExceedCount >= 1
voteBad     = (primaryExceedCount >= 1 && primary+aux >= 2) || (maxPrimary > 1.8 && qualityGood)
```

즉 이탈 특징이 2개 → 1개 → 2개로 한 프레임만 출렁여도 target이 `bad → warning → bad` 로 바뀌며 **5초 카운트가 0으로 돌아갑니다.** 12fps 기준 **연속 60프레임 동안 단 한 프레임의 예외도 없이** `voteBad` 가 유지되어야 bad가 확정되고, 그래야만 회복 기회가 열립니다(`postureMachine.ts` L86).

MediaPipe 랜드마크는 프레임 단위 지터가 있고, 특히 `deviation` 이 임계 1.0 근처일 때 특징 개수는 쉽게 오갑니다. 실기기에서 **회복 기회가 거의 열리지 않는(= 게임 루프 전체가 죽는) 위험**이 있습니다.

노트북 사용자는 엉덩이가 화면 밖이라 `quality === 'limited'` 가 고정되므로(`useLiveClassifier.ts` L155-156) `maxPrimary > 1.8` 우회로도 막혀 있어, 사실상 "특징 2개 동시 이탈 60프레임 연속"만이 유일한 경로입니다.

**기대 결과**: 자세 이탈이 5초 지속되면 회복 기회가 열립니다.
**실제 결과**: 합성 데이터(고정 입력)에서는 열리지만, 지터가 있는 실제 입력에서는 열리지 않을 수 있습니다. **이 환경에서는 카메라가 없어 실측하지 못했습니다.**

**의심 파일과 함수**: `src/features/posture-engine/classify.ts` `arbiterStep()` L178-204, `computeVotes()` L119-123

**기존 테스트가 놓친 이유**
`classify.spec.ts:176` 의 *"한 프레임 튐으로는 상태가 바뀌지 않는다"* 는 **good 중 bad 한 프레임**만 검사합니다. 그 반대 방향, 즉 **bad 지속 중 warning 한 프레임이 끼어드는 경우**는 테스트가 없습니다. 모든 arbiter 테스트가 같은 vote 객체를 반복 입력하는 무지터 시퀀스입니다.

**권장 수정**

1. 후보 상태가 바뀔 때 경과를 0으로 버리지 말고 **감쇠(decay)** 시키거나, `bad↔warning` 은 같은 "이탈 계열"로 묶어 카운트를 승계
2. 또는 최근 N프레임 다수결(예: 최근 2초 중 70% 이상이 `voteBad`)로 확정
3. `classify.spec.ts` 에 지터 시퀀스 테스트 추가: `[BAD,0][BAD,2000][WARN,2100][BAD,2200]...[BAD,5200]` → bad 확정 기대

**회귀 위험**: **높음.** 자세 판정의 심장부이며 `AI_HANDOFF.md` 가 "승인된 상태 — 필요 없이 재설계 금지"로 지정한 영역입니다. 코어 개발 Claude와 충돌 가능성이 가장 큰 항목이므로 §6 참조.

---

### ISSUE-10 · P1 · 편안한 자세의 오탐 여지 — tolerance 바닥값이 매우 좁음

- **기능**: 편안한 자세가 warning/bad/unstable로 오판될 가능성 (검사항목 4) — **실기기 확인 필요**

**분석**

캘리브레이션 중 가만히 앉아 있으면 MAD가 0에 수렴하므로 tolerance는 사실상 `FLOOR` 값이 됩니다.

| 특징 | FLOOR | 어깨너비 0.35 기준 정규화 좌표 | 화면 비율 |
|---|---|---|---|
| `shoulderTiltRatio` | 0.06 | 0.021 | 세로 약 2% |
| `lateralOffsetRatio` | 0.07 | 0.025 | 가로 약 2.5% |
| `faceScaleRatio` | 0.05 | — | 눈 간격 5% 변화 |
| `headHeightRatio` | 0.08 | — | 눈–어깨 거리 8% 변화 |

`voteBad` 는 **주 특징 2개가 동시에 1.0을 넘으면** 성립합니다. 공부 중 매우 흔한 다음 자세들이 두 특징을 동시에 건드립니다.

- **한쪽 팔꿈치를 괴고 앉기** → `shoulderTiltRatio`(어깨 높이차) + `lateralOffsetRatio`(코가 어깨 중앙에서 이탈) 동시 상승
- **옆의 책·노트를 보려고 상체를 살짝 트는 자세** → 위와 동일 (yaw 0.7 미만이라 `severeRotation` 필터에 걸리지 않음)
- **의자를 앞으로 당겨 앉기** → `faceScaleRatio` + `headHeightRatio` 동시 상승 (다만 어깨너비 20% 이상 변하면 "카메라 거리 확인"이 먼저 뜸)

즉 **자세가 나빠진 게 아니라 비대칭이 되었을 뿐인데 bad로 판정될 수 있습니다.** `gentle` 민감도(×1.4)로도 tolerance는 어깨너비의 8.4%에 불과합니다.

또한 캘리브레이션 자세가 조금이라도 비대칭이었다면 방향성 편차(`DIRECTION`) 특성상 **대칭으로 고쳐 앉는 것이 "개선"으로 인식되지 않습니다**(`shoulderTiltRatio` 는 절댓값이라 0 방향은 이탈이 아니므로 이 경우는 안전하나, `lateralOffsetRatio` 도 절댓값이라 동일).

**기대 결과**: 편안하고 지속 가능한 자세는 good 유지.
**실제 결과**: 합성 데이터 테스트는 통과하나, 실제 편안한 비대칭 자세의 오탐 가능성이 구조적으로 존재합니다. **카메라가 없어 실측하지 못했습니다.**

**의심 파일과 함수**: `src/features/posture-engine/classify.ts` `FLOOR` L35-42, `SENSITIVITY_MULT` L47-51, `computeVotes()` L119-123

**기존 테스트가 놓친 이유**
`classify.spec.ts` 의 픽스처(`testFixtures.ts`)는 완벽히 좌우 대칭인 합성 랜드마크입니다. **"편안하지만 비대칭인 자세"** 픽스처가 없어 이 시나리오가 한 번도 평가되지 않았습니다. `AI_HANDOFF.md` 자체가 "실카메라 임계값은 합성 데이터 기준 — 실기기 튜닝 필요"라고 인정하고 있습니다.

**권장 수정**

1. `shoulderTiltRatio` 와 `lateralOffsetRatio` 를 **같은 "비대칭" 계열로 묶어 둘이 함께 오를 때 표를 1장으로 계산** (현재는 상관관계가 큰 두 특징이 서로를 증폭)
2. `faceScaleRatio`/`headHeightRatio` 도 동일하게 "전후 거리" 계열로 묶기
3. 실기기 로그로 FLOOR 재보정 (P95 기준)

**회귀 위험**: **높음.** ISSUE-09와 같은 이유로 코어 개발 Claude와 충돌 가능. §6 참조.

---

### ISSUE-11 · P1 · `/result/:sessionId` · `/session/:sessionId` 의 URL 파라미터가 무시되어 없던 결과가 만들어짐

- **기능**: 잘못된 직접 URL / 빈 화면 (검사항목 19)
- **URL**: <https://upright-now.vercel.app/result/demo> · `/result/아무거나`

**재현 순서**: 새 탭에서 `/result/anything` 직접 접속

**기대 결과**: 해당 세션 기록이 없으면 "기록을 찾을 수 없어요" 또는 대시보드 리다이렉트.

**실제 결과 (Production 실측)**

- 200 응답 후 **"여기까지의 기록을 정리했어요 · 중도 종료"** 배지와 함께
  보스 HP `1000 / 1000`, 세션 시간 `0초`, 회복 `0 / 0` 인 **가짜 결과 화면**이 그려집니다.
- `Result.tsx` 는 `useParams` 를 전혀 사용하지 않고 전역 `useSessionStore` 를 그립니다. 즉 URL의 세션 id는 **완전히 장식**이며, 새로고침하면 스토어가 초기화되어 존재하지 않는 "중도 종료" 세션이 표시됩니다.
- `/session/아무거나` 도 동일하게 항상 새 idle 세션 화면을 그립니다.
- (긍정) 라우트 자체는 `*` → `/` 리다이렉트가 정상 동작해 **진짜 404·빈 화면은 없습니다.**

**의심 파일과 함수**: `src/app/routes/Result.tsx` (전체 — `useParams` 미사용), `src/app/routes/Session.tsx` L44

**기존 테스트가 놓친 이유**
`e2e/routes.spec.ts` 는 "404가 없다"만 검사합니다. **화면에 표시된 내용이 URL과 일치하는지는 검사하지 않습니다.** 오히려 `/result/demo` 를 무조건 유효한 화면으로 전제하고 있습니다(`copy.spec.ts:87`).

**권장 수정**

1. `Result.tsx` 에서 `useParams().sessionId` 로 `sessionHistoryStore` 를 조회, 없으면 EmptyState 또는 `/history` 리다이렉트
2. `SessionSummary` 에 `sessionId` 필드를 추가해 조회 키로 사용 (현재는 `sum-{timestamp}-{random}` 이라 세션 id로 찾을 수 없음)

**회귀 위험**: 중간. `SessionSummary` 스키마 변경 시 `local.ts` 마이그레이션(v2→v3)이 필요합니다.

---

### ISSUE-12 · P2 · 세션 재시작 시 완주 XP가 조용히 사라짐 (잠금 해제 누락)

- **기능**: 중복 sessionId 집계 / 중복 보상 (검사항목 18)

**분석 (코드 레벨 — end-to-end 재현은 미확인)**

`sessionStore.start()` → `releaseSessionLocks(sessionId)` 는 두 가지를 풉니다.

- `finalizeSession.ts` L26 → `finalizedSessionIds` 삭제 ✅
- `rewards.ts` L44 → `recoveryCountBySession` 삭제 ✅
- **`rewards.ts` 의 `appliedIds` 는 풀지 않습니다** ❌

`finalizeSession` 은 완주 보상 id로 `session-complete-xp-${sessionId}` 를 씁니다. 따라서 **같은 sessionId로 세션을 다시 완주하면**

- `gameStore.sessionCompleted` 는 `reset()` 으로 보스가 새로 만들어져 **피해 100 정상 적용**
- `completeSessionMark` 도 정상 실행 (완료 수 +1, 출석 기록)
- 그러나 `applyReward` 는 `appliedIds` 에 이미 있어 **XP·포인트 0 지급**

화면에는 "세션 완주"가 정상으로 보이는데 보상만 빠지는 **불일치**가 생깁니다.

**도달 경로**: `SessionSetup` 은 `s-${Date.now()}` 로 매번 새 id를 만들어 일반 경로에서는 재현이 어렵습니다. 실제 위험 구간은 **친구 방**으로, 세션 id가 `room-${code}`(`Room.tsx` L52)라 같은 방 코드로 재입장하면 충돌합니다. 새로고침하면 모듈 스코프 `Set` 이 비워져 증상이 사라지므로 **재현이 간헐적**입니다. 이 점 때문에 P2로 분류했습니다.

**기존 테스트가 놓친 이유** — 이 결함을 정확히 겨냥한 테스트가 있는데 **단언이 빠져 있습니다.**

```ts
// src/features/sessions/finalizeSession.spec.ts:87
it('세션을 다시 시작하면 종료 잠금이 풀린다', () => {
  seedSession(1_500_000); finalizeSession('timer')
  useSessionStore.getState().start('s-test')
  seedSession(1_500_000); finalizeSession('timer')
  expect(useProgressionStore.getState().completedSessions).toBe(2)  // ← 이것만 검사
  // expect(xp).toBe(200) 이 없음. 실제 값은 100.
})
```

`completedSessions` 는 `completeSessionMark` 가 담당하므로 통과하고, XP를 담당하는 `applyReward` 는 검사되지 않습니다.

**권장 수정**

1. `rewards.ts` 의 `registerSessionLockRelease` 콜백에서 `appliedIds` 중 해당 sessionId 접두사 항목도 제거, 또는 완주 보상 id에 시도 회차를 포함
2. 위 테스트에 `expect(useProgressionStore.getState().xp).toBe(200)` 추가

**회귀 위험**: 낮음.

---

### ISSUE-13 · P2 · 친구 방을 나가도 서버 상태가 정리되지 않아 방이 영구히 점유됨

- **기능**: 친구 방 생성·입장 (검사항목 14)

`leaveRoom()`(`roomService.ts` L395-403)은 채널 구독만 해제하고 **DB에 아무것도 쓰지 않습니다.**

- `room_members` 행이 남아 인원수가 계속 2 → 다른 사람이 `join_room` 하면 `'room is full'`
- `rooms.status` 가 `'waiting'` 인 채로 영구 방치 (`ended_at` 미기록)
- docs/08 §9 *"방 종료 | ended_at 기록 후 채널 해제"*, *"방장 이탈 | 상대에게 방장 이전"* 둘 다 미구현
- 방 코드 재사용/정리(TTL) 로직이 없어 `rooms` 테이블이 단조 증가

**의심 파일**: `src/features/rooms/roomService.ts` `leaveRoom()`, `supabase/schema.sql`(leave RPC 부재)
**기존 테스트가 놓친 이유**: `room-live.spec.ts` 는 나가기 이후 상태를 검증하지 않고, env 없으면 skip 됩니다.
**권장 수정**: `leave_room(p_room_id)` RPC 추가 — 멤버 삭제 + 마지막 1인이면 `status='closed', ended_at=now()` + 호스트 이탈 시 role 이전.
**회귀 위험**: 낮음(신규 RPC). 단 `supabase/schema.sql` 은 이번 감사에서 수정 금지 대상입니다.

---

### ISSUE-14 · P2 · RLS가 방장에게 `boss_hp` 직접 수정을 허용 (docs/08 §10 위반)

```sql
-- supabase/schema.sql:262
create policy rooms_update_host on public.rooms
for update to authenticated
using (host_user_id = auth.uid()) with check (host_user_id = auth.uid());
```

컬럼 제한이 없어 방장은 `boss_hp`·`boss_max_hp`·`shield` 를 임의 값으로 UPDATE할 수 있습니다. docs/08 §10은 *"클라이언트가 임의로 최종 HP를 덮어쓰지 않습니다"* 라고 명시하고, `apply_room_damage` RPC는 `p_damage <= 250` 상한까지 검증하는데 **정책이 그 옆문을 열어 둔 셈**입니다. 실제로 `startRoomSession()` 은 이 정책으로 `status`/`started_at` 을 직접 UPDATE 합니다.

또한 `startRoomSession()` 은 **두 명 모두 ready 인지 서버에서 검증하지 않습니다.** 코드 주석도 *"확인은 UI 가 담당합니다"* 라고 적혀 있어, 버튼 `disabled` 만이 유일한 방어선입니다(docs/16 §2 "두 사람 준비 전 시작 불가").

**권장 수정**: 정책을 `status`/`started_at`/`ended_at` 만 허용하도록 좁히고(트리거로 다른 컬럼 변경 거부), 시작을 `start_room_session()` RPC로 옮겨 서버에서 ready 2명을 검증.
**회귀 위험**: 중간. `startRoomSession()` 도 함께 바꿔야 합니다.

---

### ISSUE-15 · P2 · Production에서 잘못된 방 코드 접속 시 콘솔 에러 노출

- **URL**: <https://upright-now.vercel.app/room/ABC123>

존재하지 않는 코드로 `/room/{code}` 에 접속하면 화면에는 정상적으로 *"방을 찾지 못했어요. 코드를 다시 확인해 주세요."* 가 뜨지만, **브라우저 콘솔에 에러가 남습니다.**

```
[error] Failed to load resource: the server responded with a status of 400 ()
```

`join_room` RPC의 `raise exception 'room not found'` 가 HTTP 400으로 내려오면서 발생합니다. 사용자 흐름은 정상 복구되므로 P2이나, 검사항목 23(console.error) 기준 **Production에서 확인된 유일한 콘솔 에러**입니다.

**참고 — 코드베이스 전수 검사 결과 (검사항목 23)**

```
console.error : 0건
console.warn  : 1건  src/lib/mediapipe/loader.ts:33 (GPU→CPU 폴백 안내, 의도된 로그)
console.log   : 0건
TODO / FIXME / HACK / XXX : 0건
```

**권장 수정**: "코드 없음"은 예외가 아니라 정상 결과값(`null`)으로 돌려주도록 RPC 시그니처 변경, 또는 클라이언트에서 예상된 400을 조용히 처리.

---

### ISSUE-16 · P2 · `npm run test` 가 기본 설정에서 5건 실패 (AI_HANDOFF 의 "173/173" 과 불일치)

```
Test Files  1 failed | 23 passed (24)
     Tests  5 failed | 168 passed (173)
FAIL src/app/routes/QaLab.spec.tsx  — 5건 전부 "Test timed out in 5000ms"
```

동일 파일을 `npx vitest run src/app/routes/QaLab.spec.tsx --testTimeout=60000` 로 재실행하면 **7/7 통과**합니다. 따라서 **로직 결함이 아니라 테스트 견고성 문제**입니다. `renderAt('/')` 가 App 전체(캐릭터 SVG·라우터·Provider)를 렌더하는데 vitest 기본 5초 안에 끝나지 못합니다. 이번 실행에서 environment 준비에만 1,120초가 소요됐습니다.

`docs/AI_HANDOFF.md` L13·L86 은 "unit 173/173"을 조건 없이 단언하지만, **다른 성능의 머신·CI에서는 재현되지 않습니다.** docs/16 §3 "출시 차단 조건"에 "테스트 실패"가 포함되어 있어 기록해 둡니다.

**권장 수정**: `vite.config.ts` 의 vitest 설정에 `testTimeout: 20000` 명시, 또는 `QaLab.spec.tsx` 를 App 전체 렌더가 아닌 라우트 단위 렌더로 축소.
**회귀 위험**: 없음(테스트 설정만 변경).

---

### ISSUE-17 · P2 · Profiles 화면 문구와 실제 기능 불일치 2건

- **URL**: <https://upright-now.vercel.app/profiles>

1. **"나중에 설정에서 바꿀 수 있어요"** (`Profiles.tsx` L24)
   → **설정 화면(`/settings`)에는 학습 프로필 항목이 없습니다.** 실제 변경 수단은 `/session/setup` 의 `학습 프로필` 세그먼트뿐입니다. 사용자는 설정에서 찾다가 못 찾습니다.
   (검사항목 2 "모드 선택과 재변경"은 **경로만 다를 뿐 재변경 자체는 가능**합니다.)

2. **"장소 기준: 등록 전"** (`Profiles.tsx` L55)
   → 하드코딩된 문자열이라 캘리브레이션을 마친 뒤에도 영원히 "등록 전"으로 보입니다. `hasCalibration` 을 읽지 않습니다.

3. **내부 우선순위 라벨 `P1` 노출** (`Profiles.tsx` L85) — "내 모드" 카드에 개발 백로그 표기인 `P1` 배지가 사용자 화면에 그대로 보입니다. `e2e/copy.spec.ts` 의 내부 문구 필터는 `/Phase\s*\d/i` 만 잡아 `P1` 을 통과시킵니다.

**권장 수정**: (1) Settings에 학습 프로필 섹션 추가 또는 문구를 "세션 설정에서"로 수정 (2) `hasCalibration` 바인딩 (3) `P1` 배지를 "준비 중"으로 교체 + `copy.spec.ts` 금지 패턴에 `/^P\d$/` 추가.
**회귀 위험**: 낮음.

---

### ISSUE-18 · P2 · 자리 비움 안내의 "계속하기" 버튼이 자세 상태를 직접 good으로 주입

```tsx
// src/app/routes/Session.tsx:224
<Button onClick={() => usePostureStore.getState().setPostureState('good')}>계속하기</Button>
```

사용자가 실제로 돌아왔는지와 무관하게 **UI 버튼이 자세 판정을 조작**합니다. 회복 기회가 열려 있는 동안 누르면 `goodHeldMs` 누적이 시작되어(`postureMachine.ts` L97) 보상 판정에 관여할 수 있습니다.

실제 카메라가 켜져 있으면 다음 프레임(약 83ms 후)에 분류기가 값을 덮어쓰므로 영향은 순간적입니다. 그러나 **캘리브레이션 없이 세션을 돌리는 경우(ISSUE-03)에는 분류기가 아예 돌지 않아 주입한 `good` 이 그대로 유지**됩니다. QA용 상태 주입 경로가 운영 화면에 남은 형태입니다.

**권장 수정**: 버튼은 `session.awayMs` 관련 프롬프트 닫기와 `resume()` 만 수행하고, 자세 상태는 분류기에만 맡기기.
**회귀 위험**: 낮음.

---

### ISSUE-19 · P2 · 죽은 플래그·상수와 환경변수 이름 불일치

| 항목 | 상태 |
|---|---|
| `featureFlags.pictureInPicture` | 정의만 있고 **참조 0건**. `openPip()` 은 플래그를 확인하지 않아 `VITE_ENABLE_PIP=false` 여도 PiP가 열립니다 |
| `featureFlags.realtimeRoom` | 정의·테스트만 있고 실사용 0건 |
| `featureFlags.optionalSlouchCalibration` | 항상 `false` 하드코딩, 참조 0건 |
| `ATTENDANCE_MIN_MS` (10분) | `constants/session.ts:32` 에 정의되어 있으나 **참조 0건**. docs/07 §10 "출석 최소 진행 시간"이 코드에 반영되지 않음 |
| `DAMAGE.bothCompleted` · `REWARD.roomCompleted` | 참조 0건 (docs/08 §9 "둘 다 완료 → 최종 합동 공격" 미구현) |
| `.env.example` | `VITE_SUPABASE_PUBLISHABLE_KEY` 사용 · `README.md`/`AI_HANDOFF.md` 는 `VITE_SUPABASE_ANON_KEY` 안내 (코드는 둘 다 허용하나 문서가 엇갈림) |
| Realtime 채널 | docs/08 §13 은 **private channel** 요구, 실제는 표준 채널 (`roomService.ts` L152-156 에 사유 주석 있음, `AI_HANDOFF.md` 도 인지) |

**권장 수정**: 미사용 플래그·상수 제거하거나 실제로 연결. `.env.example` 의 키 이름을 문서와 통일.
**회귀 위험**: 낮음.

---

### ISSUE-20 · P2 · 성장 화면 `recentXp` 의 React key 충돌 가능성

```tsx
// src/app/routes/Growth.tsx:76
{recentXp.map((record) => (<li key={record.at}>
```

`record.at` 은 `Date.now()` 입니다(`progressionStore.ts` L67). 같은 밀리초에 두 보상이 적립되면(예: `finalizeSession` 이 완주 보상 직후 목표 보상을 처리하거나, 회복 성공과 완주가 겹칠 때) **중복 key** 가 발생해 React 경고 및 렌더 이상이 생길 수 있습니다.

**권장 수정**: `logXpGain` 에서 단조 증가 시퀀스 id를 함께 저장하고 그것을 key로 사용.
**회귀 위험**: 낮음. 단 `XpGainRecord` 스키마 변경 시 저장된 데이터 호환을 고려해야 합니다.

---

### ISSUE-21 · P2 · 스트레칭의 친구 방 반영 조건이 다른 이벤트와 불일치

```ts
// Stretch.tsx:91        if (useRoomStore.getState().roomId)   ← roomId 만 확인
// finalizeSession.ts:51  if (useRoomStore.getState().phase === 'running')
// PostureGameBridge.tsx:58 if (useRoomStore.getState().phase === 'running')
```

스트레칭만 `phase` 를 보지 않습니다. 방 **대기실 상태(`waiting`)** 나 세션 종료 후에도 `reportStretchComplete()` 가 호출되어 공동 방어막(+15)이 올라갑니다. ISSUE-01의 무한 반복과 결합하면 **대기실에서 방어막을 무제한으로 쌓을 수 있습니다**(서버 상한은 `p_amount <= 50` 뿐, 호출 횟수 제한 없음).

**권장 수정**: `phase === 'running'` 조건으로 통일.
**회귀 위험**: 낮음.

---

### ISSUE-22 · P2 · 시각·레이아웃 (1440×1000 / 1280×800)

Production 실측 결과 **두 해상도 모두 가로 스크롤 0px, `main` 내부 요소의 뷰포트 이탈 0건**으로 심각한 레이아웃 깨짐은 없습니다. 아래는 경미한 관찰입니다.

| 화면 | 해상도 | 관찰 | 확인 방법 |
|---|---|---|---|
| `/session/setup` | 1440×1000 · 1280×800 | `scrollHeight 1007px` 로 세로 스크롤이 생깁니다(각각 7px·207px). **다만 주 CTA(`25분 집중 시작`)는 두 해상도 모두 `y=578` 로 첫 화면 안에 있어 실사용 문제는 아닙니다.** 다른 화면은 모두 뷰포트 내 | Production 실측 |
| `/session/{id}` (세션 중) | 공통 | 카메라 미리보기가 `fixed bottom-3 right-3` (96×128px), PiP 폴백 미니 위젯도 `fixed right-4 bottom-4` (200px 폭, `MiniPostureWidget.tsx` L29) → **둘 다 표시되는 조건(카메라 사용 중 + PiP 차단)에서 우하단에서 서로 겹칩니다** | 코드 확인 (해당 상태를 만들려면 카메라가 필요해 실측 못 함) |
| 첫 방문 대시보드 | 공통 | 온보딩 전인데 사이드바에 이미 `익명의 기린 / Lv.1 뽀각 거북` 이 표시됨 | Production 실측 |

**기존 테스트가 놓친 이유**: `e2e/responsive.spec.ts` 는 **모든 케이스를 `?demo=1` 로 실행**합니다(L28). 즉 Lv.3 데모 사용자·채워진 상태의 레이아웃만 검증되고, **실제 신규 사용자(Lv.1, 기록 없음, EmptyState) 레이아웃은 한 번도 측정되지 않았습니다.** 또한 PiP 폴백이 켜진 상태의 세션 화면 레이아웃 테스트가 없습니다.

**권장 수정**: 미니 위젯 위치를 `bottom-32` 등으로 분리. responsive 스펙에 비-데모 케이스 추가.
**회귀 위험**: 낮음.

---

## 2. 검사항목별 결과

| # | 검사 항목 | 결과 | 근거 |
|---|---|---|---|
| 1 | 신규 사용자 온보딩 | ✅ | `/` → 닉네임 → 프로필 → 카메라 안내 흐름 정상 (Production 실측) |
| 2 | 닉네임 저장 | ✅ | `normalizeNickname` 12자 제한·제어문자 제거·localStorage 영속 |
| 3 | 도서관·내 공간·팀플 선택 | ✅ | `/profiles` 3종 정상 |
| 4 | 모드 재선택 | ⚠️ | 가능하지만 **설정이 아니라 세션 설정 화면**에서만 → ISSUE-17 |
| 5 | 카메라 권한 | ⚪ | 권한 요청은 CTA 이후에만 호출되도록 구현 확인. **실기기 미확인** |
| 6 | 5초 캘리브레이션 | ⚪ | 워밍업 1초 + 유효 40표본 로직 확인. **실기기 미확인** |
| 7 | 캘리브레이션 없는 세션 차단 | ❌ | **ISSUE-03 (P0)** |
| 8 | 편안한 자세 오탐 | ⚠️ | **ISSUE-10 (P1)** — 구조적 위험 확인, 실기기 미확인 |
| 9 | 귀·엉덩이 미검출 처리 | ✅ | 선택 랜드마크로 분리되어 `limited` 로 판정 지속 (`classify.spec.ts` 검증) |
| 10 | 개인 세션 시작·중단·완료 | ⚠️ | 시작·완료 정상, **중단 경로에 ISSUE-02·04** |
| 11 | 5초 이탈 후 회복 기회 | ⚠️ | **ISSUE-09 (P1)** — 실기기 미확인 |
| 12 | 5초 복귀 후 회복 보상 | ⚪ | 로직·단위테스트 정상. **실기기 미확인** |
| 13 | 대시보드 오늘 집중 시간 | ❌ | **ISSUE-06 (P1)** — 하드코딩 `0:00` |
| 14 | 중단 세션의 실제 집중 시간 | ❌ | **ISSUE-07 (P1)** — 25분 고정 환산 |
| 15 | 중복 sessionId 집계 | ⚠️ | **ISSUE-12 (P2)** |
| 16 | 웹앱 내부 이전 버튼 | ❌ | 세션·결과·스트레칭 화면에 내부 뒤로가기 없음 → ISSUE-04 |
| 17 | 뒤로가기 중 세션 보호 | ❌ | **ISSUE-04 (P1)** |
| 18 | 세션 중 스트레칭 후 복귀 | ❌ | **ISSUE-02 (P0)** |
| 19 | 결과에서 시작한 스트레칭 복귀 | ❌ | 동일 원인 (항상 `/result/demo`) → ISSUE-02 |
| 20 | 메뉴에서 독립 스트레칭 | ✅ | 동작함. 세션 기록을 만들지 않음(실측 `sessions` 0건) ✅ |
| 21 | 스트레칭 중도 이탈 보상 | ❌ | **ISSUE-01 (P0)** — `완료` 클릭만으로 0초에 전액 지급 |
| 22 | 스트레칭 완주 보상 1회 | ❌ | **ISSUE-01 (P0)** — 무한 반복 |
| 23 | PIP 열기·닫기·동기화 | ✅ | 같은 JS 컨텍스트 store 공유, 실패 시 인페이지 폴백, PiP 실패가 세션을 끊지 않음. e2e 통과 |
| 24 | 캐릭터 성장·XP·포인트 | ✅ | XP 파생 6단계, 자세 악화로 감소하는 경로 없음 |
| 25 | 상점 구매·장착·새로고침 복원 | ✅ | 중복 구매·포인트 부족 차단, `inventory`/`equipped` 영속 확인 |
| 26 | 설정·데이터 초기화 | ✅ | 확인 모달 + 네임스페이스 전량 삭제 + 재저장 방지 이중 `clearLocal()` |
| 27 | 친구 방 생성·코드 입장 | ⚪ | 코드·RPC·에러 문구 정상. **2인 동시 접속 미확인** · 나가기 정리 누락(ISSUE-13) |
| 28 | 초대 참가자 카메라·기준 가드 | ❌ | `Room.tsx` 에 가드 없음. 기준 없는 참가자도 그대로 세션 진입 → ISSUE-03과 동일 근본 원인 |
| 29 | 두 참가자 준비 전 시작 차단 | ⚠️ | 버튼 `disabled` 만. 서버 검증 없음 → ISSUE-14 |
| 30 | 공동 괴물 HP 동기화 | ⚪ | RPC 원자성·`event_id` 중복 차단·3초 폴링 구현 확인. **실측 미확인** |
| 31 | 상대 캐릭터가 양쪽에 보이는지 | ❌ | 세션 중에는 안 보임 → **ISSUE-08 (P1)** |
| 32 | 반응 3종이 상대 화면에 표시 | ❌ | 세션 중 도달 경로 없음 → **ISSUE-08 (P1)** |
| 33 | 재연결·혼자 모드 전환 | ⚪ | 30초 재시도 → `offline` 구현 확인. **실측 미확인** |
| 34 | 프레임·랜드마크·bad 전송 여부 | ✅ | `sanitizeRoomEvent` 화이트리스트 + 단위테스트. Production `/session/demo` 네트워크 **오프-오리진 0건·POST 0건 실측** |
| 35 | 잘못된 URL·404·빈 화면 | ⚠️ | 진짜 404·빈 화면 없음 ✅. 다만 없는 세션이 가짜 결과로 렌더 → ISSUE-11 |
| 36 | 1440×1000 · 1280×800 | ✅ | 가로 스크롤 0px, 요소 이탈 0건 실측. 경미 사항 ISSUE-22 |
| 37 | 문구와 실제 기능 불일치 | ❌ | ISSUE-03(unstable 문구)·06·07·17 |
| 38 | 데모 데이터와 실제 데이터 혼합 | ❌ | **ISSUE-05 (P1)** |
| 39 | 중복 보상 | ❌ | **ISSUE-01 (P0)** · ISSUE-12 · ISSUE-21 |
| 40 | console.error / warn / TODO | ✅ | 코드 내 error 0 · warn 1(의도) · TODO 0. Production 콘솔 에러 1건 → ISSUE-15 |

범례 — ✅ 정상 · ⚠️ 부분 문제 · ❌ 문제 · ⚪ **카메라·2인 접속이 필요해 이 환경에서 검증 불가**

---

## 3. 요약 표

### 3.1 출시 차단 오류 (P0)

| # | 제목 | 영향 |
|---|---|---|
| ISSUE-01 | 스트레칭 완료 보상 무한 반복 | 7초에 100 XP/100 P. 보상 경제·상점 잠금 설계 전부 무의미. docs/16 §3 "한 회복 중복 보상" 위반 |
| ISSUE-02 | 세션 중 스트레칭 시 세션 소멸 | 25분 학습이 기록 없이 사라지고 "중도 종료"로 오통보. 제품 신뢰 직결 |
| ISSUE-03 | 캘리브레이션 없이 세션 시작·완주 보상 | 자세 감지 0초 세션이 완주로 집계 + 출석 + 상점 해제. 제품 핵심 가치가 조용히 무효화 |

### 3.2 높은 우선순위 오류 (P1)

| # | 제목 |
|---|---|
| ISSUE-04 | 뒤로가기·내부 이동이 진행 중 세션을 경고 없이 폐기 (내부 이전 버튼 부재 포함) |
| ISSUE-05 | 데모 모드가 실제 사용자 정체성·진행도를 덮어쓰고 탈출 불가 |
| ISSUE-06 | 대시보드 "오늘 집중" 하드코딩 `0:00` |
| ISSUE-07 | "누적" 시간을 세션 수 × 25분으로 조작 표시 |
| ISSUE-08 | 친구 방 반응 3종·상대 캐릭터가 세션 중 표시되지 않음 (docs/08 §12 위반) |
| ISSUE-09 | arbiter가 한 프레임 흔들림에 bad 5초 카운트를 전부 리셋 (회복 기회 미발생 위험) |
| ISSUE-10 | tolerance 바닥값이 좁아 편안한 비대칭 자세가 bad로 오탐될 여지 |
| ISSUE-11 | `/result/:sessionId` 파라미터 무시 → 없던 "중도 종료" 결과 생성 |

### 3.3 시각 오류

| 위치 | 내용 | 심각도 |
|---|---|---|
| `/session/setup` | 두 해상도 모두 207px/7px 세로 스크롤 발생 (주 CTA는 첫 화면 안 — 경미) | P2 |
| `/session/{id}` | PiP 폴백 미니 위젯과 카메라 미리보기가 같은 우하단에서 겹침 (코드 확인) | P2 |
| `/profiles` | 내부 백로그 라벨 `P1` 배지 노출 | P2 |
| `/profiles` | "장소 기준: 등록 전" 이 캘리브레이션 후에도 고정 | P2 |
| `/` 첫 방문 | 온보딩 전인데 사이드바에 `익명의 기린 / Lv.1` 표시 | P2 |
| 전반 | **1440×1000·1280×800 가로 스크롤·요소 이탈은 0건 (문제 없음)** | — |

### 3.4 문서와 코드 불일치

| 문서 | 문서 내용 | 코드 실제 |
|---|---|---|
| `AI_HANDOFF.md` L13·86 | "unit 173/173 통과" | 기본 설정 실행 시 168/173 (타임아웃 5건, ISSUE-16) |
| `docs/08` §12 | "응원 3종을 세션 중 화면 구석에 표시" | 세션 중 전송·표시 경로 없음 (ISSUE-08) |
| `docs/08` §9 | "방장 이탈 → 방장 이전", "방 종료 → ended_at 기록" | 미구현 (ISSUE-13) |
| `docs/08` §10 | "클라이언트가 임의로 HP를 덮어쓰지 않음" | RLS가 방장의 직접 UPDATE 허용 (ISSUE-14) |
| `docs/08` §13 | "private Realtime channel" | 표준(비 private) 채널 — `AI_HANDOFF.md` 도 인지 |
| `docs/07` §10 | 출석 최소 진행 시간 10분 | `ATTENDANCE_MIN_MS` 참조 0건 (ISSUE-19) |
| `Profiles.tsx` | "나중에 설정에서 바꿀 수 있어요" | 설정 화면에 학습 프로필 항목 없음 (ISSUE-17) |
| `README.md` / `AI_HANDOFF.md` | `VITE_SUPABASE_ANON_KEY` | `.env.example` 은 `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `docs/06`·`AI_HANDOFF` | "이탈 시작 → 회복 기회 = 총 5초" | 무지터 입력에서만 성립 (ISSUE-09) |

### 3.5 테스트 누락

| 영역 | 누락 내용 |
|---|---|
| 스트레칭 | `Stretch.tsx` 단위 테스트 0건. 보상 지급 조건·`한 동작 더` 반복 시나리오 미검증 (→ ISSUE-01) |
| 화면 왕복 | 세션→스트레칭→세션, 세션→결과→재시작 등 **화면 간 왕복 e2e 전무** (→ ISSUE-02) |
| 뒤로가기 | `page.goBack()` 호출 0건. 언마운트 시 세션 상태 검증 없음 (→ ISSUE-04) |
| 캘리브레이션 가드 | `hasCalibration === false` 상태로 세션을 시작하는 테스트 없음. `seedSession` 이 `detectableMs` 를 강제 주입 (→ ISSUE-03) |
| 데모 오염 | "실제 데이터가 있는 사용자가 데모 진입" 시작 상태 미구성 (→ ISSUE-05) |
| 보상 잠금 | `finalizeSession.spec.ts:87` 이 `completedSessions` 만 단언하고 XP를 단언하지 않음 (→ ISSUE-12) |
| arbiter | bad 지속 중 한 프레임 warning이 끼는 지터 시퀀스 미검증 (→ ISSUE-09) |
| 자세 픽스처 | `testFixtures.ts` 가 완전 대칭 합성 랜드마크뿐. 비대칭 편안 자세 케이스 없음 (→ ISSUE-10) |
| 레이아웃 | `responsive.spec.ts` 가 전부 `?demo=1`. **신규 사용자(Lv.1·EmptyState) 레이아웃 미측정** (→ ISSUE-22) |
| 대시보드 집계 | "오늘 집중"·"누적" 값을 검증하는 단언 없음 (→ ISSUE-06·07) |
| 친구 방 | `room-live.spec.ts` 는 Supabase env 없으면 skip → CI에서 사실상 미실행. 반응 표시·나가기 정리 미검증 |
| 라우팅 | "404가 없다"만 검사, **URL과 화면 내용의 일치는 미검사** (→ ISSUE-11) |

### 3.6 사용자가 직접 확인해야 하는 항목 (이 감사에서 검증 불가)

카메라·2인 동시 접속이 필요해 **실제로 테스트하지 않았습니다.** 실기기에서 확인해 주세요.

1. **정면 편안한 자세 30초 이상 good 유지** — ISSUE-10의 오탐 여부를 가르는 핵심 확인
2. **한쪽 팔꿈치를 괴거나 옆 책을 보는 자세에서 bad가 뜨는지** — ISSUE-10 직접 재현
3. **앞으로 숙여 5초 → 회복 기회 토스트가 실제로 뜨는지** — ISSUE-09 직접 재현. 뜨지 않으면 P0로 격상
4. **회복 기회 중 5초 복귀 → +30 XP 지급** 및 세션당 5회 상한 동작
5. **귀 가림·엉덩이 화면 밖 상태에서 측정이 `limited` 로 계속되는지**
6. **카메라 권한 거부·다른 앱 점유·카메라 없음** 3가지 오류 문구와 복구 경로
7. **캘리브레이션 5초 완료율** — 40표본을 12초 안에 못 모으는 빈도
8. **PiP 자동 열림 (Chrome/Edge 116+)** 및 PiP 창 안 일시정지·닫기
9. **두 기기·두 브라우저 친구 방** — 준비→시작→공동 HP 동기화→기린 싱크→재연결
10. **친구 방 세션 중 네트워크 탭 실측** — 이번 감사는 `/session/demo` 단독 세션에서만 오프-오리진 0건을 확인했습니다. Supabase 채널이 붙은 상태의 payload는 직접 확인이 필요합니다
11. **접근성** (docs/16): 키보드 탐색·포커스 링·200% 확대·감소된 모션

---

## 4. 권장 수정 순서

| 순서 | 이슈 | 이유 |
|---|---|---|
| 1 | ISSUE-01 | 가장 작은 수정으로 가장 큰 위험 제거 (`Stretch.tsx` 단독) |
| 2 | ISSUE-02 | 사용자 데이터 손실. 라우팅 인자만 고치면 대부분 해결 |
| 3 | ISSUE-03 | 가드 추가. 단 데모 예외를 정확히 열어야 e2e 유지 |
| 4 | ISSUE-04 | ISSUE-02와 같은 "세션 생명주기" 묶음이라 함께 처리 |
| 5 | ISSUE-06·07·17 | 표시 전용 수정, 위험 없음 |
| 6 | ISSUE-05·11·12 | 상태·라우팅 정리 |
| 7 | ISSUE-08 | 친구 방 UX 완성 |
| 8 | ISSUE-09·10 | **실기기 데이터 확보 후에만 착수** (§6 참조) |
| 9 | 나머지 P2 | |

---

## 5. 코어 개발 Claude의 변경과 충돌할 가능성이 있는 부분

이 감사는 코어 개발과 **독립적으로** 수행되었습니다. 아래는 병합 시 충돌·중복 작업이 예상되는 지점입니다.

| 위험도 | 영역 | 내용 |
|---|---|---|
| 🔴 높음 | **자세 엔진** (`classify.ts` · `postureMachine.ts` · `useLiveClassifier.ts`) | ISSUE-09·10 이 여기를 건드립니다. `AI_HANDOFF.md` L30-31 은 이 영역을 **"승인된 상태 — 필요 없이 재설계 금지"** 로 못박고 있습니다. 코어 쪽이 실기기 튜닝(알려진 이슈 #1)을 이미 진행 중일 가능성이 큽니다. **먼저 실기기 로그를 공유하고 합의한 뒤에만 수정하세요.** 임계값은 반드시 `constants/posture.ts`·`classify.ts` 의 상수 위치에서만 바꿔야 합니다(AGENTS.md §6) |
| 🔴 높음 | **보상 경로** (`rewards.ts` · `finalizeSession.ts`) | ISSUE-01·12·21 이 모두 `applyReward` 의 id 정책을 건드립니다. "보상 단일 진입점"은 코어의 핵심 설계 원칙이라 id 규칙을 양쪽이 각자 바꾸면 **중복 지급 또는 전면 미지급**이라는 정반대 결함이 생길 수 있습니다. **id 생성 규칙 변경은 반드시 한쪽만** 하세요 |
| 🟡 중간 | **라우팅** (`constants/routes.ts` · `AppRoutes.tsx`) | ISSUE-02·03·11 이 `ROUTES.stretch()`/`result()` 기본 인자와 가드 라우트를 바꿉니다. `/stretch/demo`·`/result/demo` 를 하드코딩한 곳이 e2e 3개(`app-routes.ts`·`copy.spec.ts`·`responsive.spec.ts`)와 소스 4개(`Session.tsx`·`Stretch.tsx`·`LandingDashboard.tsx`·`QaLabPanel.tsx`)에 걸쳐 있어, 코어가 같은 파일을 수정 중이면 e2e가 양쪽에서 깨집니다 |
| 🟡 중간 | **친구 방** (`roomService.ts` · `Room.tsx` · `Session.tsx`) | ISSUE-08·13·14. 커밋 `f8ac621 feat: enable realtime friend room` 이 가장 최근 기능 작업이라 **코어가 계속 손대고 있을 확률이 높은 영역**입니다. `supabase/schema.sql` 변경(ISSUE-13·14)은 Production DB 마이그레이션을 동반하므로 반드시 코어와 조율하세요 |
| 🟡 중간 | **데모 모드** (`demoMode.ts`) | ISSUE-05의 수정(`disableDemo` 를 reset→복원으로 변경)은 `QaLab.spec.tsx`·`persist.spec.ts`·`finalizeSession.spec.ts` 의 `beforeEach` 가 의존하는 동작을 바꿉니다. 테스트 유틸을 함께 고쳐야 합니다 |
| 🟢 낮음 | `LandingDashboard.tsx` · `Profiles.tsx` · `Growth.tsx` | ISSUE-06·07·17·20. 표시 전용이라 충돌해도 해결이 쉽습니다 |
| 🟢 낮음 | 테스트·설정 (`vite.config.ts` vitest 옵션, spec 추가) | ISSUE-16 및 §3.5의 누락 테스트. 순수 추가라 충돌 위험이 낮습니다 |

**병합 권장 방식** — 이 브랜치는 문서만 담고 있어 코드 충돌이 없습니다. 위 이슈를 코어 브랜치에 옮길 때는 §4 순서대로 **작은 단위로 나누어** 반영하고, 🔴 항목은 코어와 합의 전까지 착수하지 마세요.

---

## 6. 부록 — 검증 환경

```
브랜치      audit/overnight-qa (base 44f4a92 "chore: finalize UpRight Now MVP release")
Node        v22.19.0
OS          Windows 11 Home 26200
브라우저    Playwright Chromium (headless)
Production  https://upright-now.vercel.app  (VITE_ENABLE_CAMERA=on, friendRoom=on, QA Lab=off 로 관측)
로컬 e2e    자체 서버 포트 5273, room-live 는 Supabase env 부재로 skip
```

실제 키·토큰·환경변수 **값**은 이 문서에 기록하지 않았습니다. 변수 **이름**만 언급합니다.

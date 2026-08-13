# AGENTS.md — AI 코딩 에이전트 구현 계약

## 0. 프로젝트 목적

**장시간 PC 앞에 앉아 있는 대학생이, 자기 자세가 무너진 순간을 알아차리고 다시
돌아오는 습관을 만드는 웹 앱입니다.**

- 웹캠으로 **사용자가 직접 등록한 기준 자세 대비 변화**를 브라우저 안에서만 판단합니다.
- 자세가 무너지면 캐릭터가 알리고, 돌아오면 보상합니다. **회복이 이 제품의 핵심 행동**입니다.
- 집중 세션·캐릭터 성장·친구 방·캠퍼스 영토전은 그 행동을 반복하게 만드는 장치입니다.
- 의료 진단이 아니라 **습관 형성 피드백**입니다.

| 항목 | 값 |
|---|---|
| 운영 | https://upright-now.vercel.app |
| 저장소 | https://github.com/suhyunkim1105-hash/upright-now |
| 대상 | 하루 4시간 이상 PC 를 쓰는 대학생 |
| 플랫폼 | 데스크톱 웹 (Chrome·Edge 116+) |

이 문서는 Claude Code·Codex가 UpRight Now를 구현할 때 제품 방향, 개인정보 경계, 화면 디자인을 임의로 바꾸지 않도록 하는 최상위 작업 계약입니다.

## 1. Source of truth

아래 순서로 문서를 우선합니다.

1. `AGENTS.md`
2. [`docs/TEAM_START.md`](docs/TEAM_START.md) — 현재 기준 값·폴더 지도·협업 규칙
3. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — 시스템 구조·데이터 흐름·환경변수·배포
4. [`docs/CODEX_HANDOFF.md`](docs/CODEX_HANDOFF.md) — 지금 상태·남은 일·바로 시작할 다음 단계
5. [`docs/14_DATA_PRIVACY_SECURITY.md`](docs/14_DATA_PRIVACY_SECURITY.md) — 개인정보 처리 원칙
6. [`docs/22_PRODUCT_SPEC_V2.md`](docs/22_PRODUCT_SPEC_V2.md) — 다음 개정 방향 (구현 전)
7. [`docs/DECISIONS.md`](docs/DECISIONS.md) — 결정·검토한 대안·재검토 조건
8. [`docs/21_RESEARCH_BASIS.md`](docs/21_RESEARCH_BASIS.md) — 자세 판정 근거 조사
9. [`docs/AI_HANDOFF.md`](docs/AI_HANDOFF.md) — 자세 파이프라인 기술 상세
10. `docs/archive/` — 초기 기획 문서 (02_PRD · 03_USER_FLOW · 05_SCREEN_SPEC · 06_POSTURE_ENGINE_SPEC · 07_GAME_SYSTEM_SPEC · 08_SOCIAL_ROOM_SPEC · 12_DESIGN_SYSTEM · 15_TECHNICAL_ARCHITECTURE)
11. 현재 코드와 테스트

`docs/archive/` 문서의 수치는 초기 기획 시점 값입니다.
숫자가 다르면 코드(`src/constants/`)와 `docs/TEAM_START.md` 가 우선입니다.

이 패키지 이전의 `기린이 되자!`, `Zarafa`, 30분 세션, 3단계 성장, 자세 바통 중심 문서는 구현 기준이 아닙니다.

## 1.5 기술 스택

| 층 | 사용 |
|---|---|
| 프레임워크 | React 19 · TypeScript `strict` · Vite 8 |
| 스타일 | Tailwind CSS 4 (`@theme` 토큰) |
| 상태 | Zustand · react-router-dom 7 |
| 자세 추정 | MediaPipe Tasks Vision — Pose Landmarker |
| 보조 진단 | TF.js MoveNet + WASM (`?postureDebug=1` 전용) |
| 서버 | Supabase — Postgres · Realtime · 익명 인증 |
| AI | Google GenAI (Gemini) + Zod + Langfuse |
| 테스트 | Vitest · Testing Library · Playwright · axe-core |
| 문서화 | Storybook · 린터 oxlint |
| 폰트 | Wanted Sans Variable (OFL-1.1, 자체 호스팅) |
| 배포 | Vercel |

버전과 상세는 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §2 에 있습니다.

### 1.1 새 Codex 워크스페이스 인수인계 문서

다른 OpenAI 계정이나 새 Codex 워크스페이스에서 이어서 작업할 때는 아래 문서를 먼저 읽습니다.

1. `docs/CODEX_HANDOFF.md` - 현재 완료·진행·남은 작업과 바로 시작할 다음 단계
2. `docs/ARCHITECTURE.md` - 앱 구조, 데이터 흐름, 환경변수, 배포 구조
3. `docs/DECISIONS.md` - 최근 의사결정, 대안, 재검토 항목

그 다음 `docs/TEAM_START.md`, `docs/AI_HANDOFF.md`, `docs/20_DECISION_LOG.md`를 참고합니다. `docs/AI_HANDOFF.md`와 `docs/20_DECISION_LOG.md`는 더 긴 과거 기록이므로, 최신 상태 판단은 위 3개 문서와 현재 Git 상태를 우선합니다.

새 환경에서 첫 작업을 시작하기 전에는 반드시 아래를 확인합니다.

```bash
git status --short --branch
git log --oneline -12
git worktree list
```

특히 `.worktrees/campus-pixel-world`가 있으면 픽셀 월드 작업물이 별도 worktree에 있을 수 있습니다. 커밋되지 않은 파일은 원격 저장소에 자동 저장되지 않으므로, 계정 이전 전에 커밋·푸시하거나 별도 백업해야 합니다.

## 2. 제품 불변조건

### 2.1 제품 우선순위

- 자세 관리가 1순위입니다.
- 스터디 게임은 반복 사용을 돕는 2순위입니다.
- 게임 화면보다 자세 기준·상태·회복 흐름을 먼저 구현합니다.
- 자세 기능을 제거하면 제품 정체성이 사라져야 합니다.

### 2.2 자세 처리

- 사용자가 등록한 개인 기준 대비 상대 변화만 판단합니다.
- 의료적 정상 자세, 거북목, CVA, 통증 원인을 판정하지 않습니다.
- 실제 집중 여부를 자세나 눈으로 추론하지 않습니다.
- 한 프레임만으로 상태를 변경하지 않습니다.
- `good`, `warning`, `bad`, `away`, `unstable` 상태를 사용합니다.
- `away`와 `unstable`에서는 회복 시간과 보상 판정을 멈춥니다.

### 2.3 개인정보

- 카메라 영상·사진·스냅샷·프레임을 저장하거나 전송하지 않습니다.
- 프레임별 랜드마크 원본을 영구 저장하지 않습니다.
- 친구 방에는 닉네임·참가 상태·게임 이벤트만 전송합니다.
- 자세 좌표·`bad` 상태·나쁜 자세 시간·건강 정보를 친구에게 공개하지 않습니다.
- API 키를 코드에 하드코딩하지 않습니다.

### 2.4 표현

사용 금지:

- `거북목으로 진단됐어요`
- `정상 자세가 아닙니다`
- `목 건강 점수 72점`
- `통증을 예방합니다`
- `AI가 집중하지 않는 것을 감지했어요`

권장:

- `처음 등록한 자세 기준에서 조금 벗어났어요`
- `편안한 기준으로 가볍게 돌아와 보세요`
- `자세를 회복했어요`
- `측정하기 어려운 상태예요`
- `오래 앉아 있던 흐름을 잠깐 리셋해 볼까요?`

### 2.5 캐릭터

- 실제 실시간 3D 모델을 사용하지 않습니다.
- 기준 이미지와 일치하는 WebP·WebM 에셋을 사용합니다.
- 장기 성장 단계와 세션 중 현재 자세 상태를 분리합니다.
- **자세가 흐트러졌다고 캐릭터가 이전 레벨로 퇴화하지 않습니다.**
  레벨은 XP 에서 파생되므로, 이는 곧 **XP 가 줄지 않는다**는 뜻입니다
  ([`docs/DECISIONS.md`](docs/DECISIONS.md) C-01).

## 3. 구현 순서

> **Phase 1~5 는 v1.1.0 (2026-07-28) 기준으로 모두 완료됐습니다.**
> 아래 목록은 초기에 어떤 순서로 만들었는지 남긴 **기록**이며,
> 지금은 기능 추가·개선 단계입니다. 새 작업을 Phase 로 나눌 필요는 없습니다.
>
> 지금 무엇이 되어 있고 무엇이 안 되어 있는지는
> `docs/TEAM_START.md` §9 "지금 안 되는 것 / 미완료" 를 보세요.

### Phase 1 — 흐름과 디자인

- React·Vite·TypeScript 골격
- 라우트와 디자인 토큰
- 닉네임·학습 프로필
- QA Lab 상태 주입
- 세션 타이머
- 캐릭터·몬스터 목업
- 결과·성장·상점 목업

### Phase 2 — 자세 엔진

- 카메라 권한
- MediaPipe 로딩
- 5초 캘리브레이션
- 상태 머신
- 회복 이벤트
- 감지 품질과 복구

### Phase 3 — 게임과 스트레칭

- 데미지·XP·포인트
- 캐릭터 상태 전환
- 스트레칭 가중 랜덤
- 출석과 기록

### Phase 4 — 실제 2인 방

- Supabase 익명 사용자
- 방 생성·입장
- Presence
- Broadcast
- 공동 보스와 합동 공격
- 재연결과 혼자 모드 전환

### Phase 5 — 상점과 배포

- 과잠·백팩 구매·장착
- Vercel 환경 변수
- E2E QA
- Production build

(당시 원칙: 한 Phase의 핵심 테스트가 실패한 상태에서 다음 Phase로 넘어가지
않는다.) 지금은 Phase 구분이 끝났으므로, **작업을 합치기 전에
`npm run lint` · `typecheck` · `test` 가 통과해야 한다**는 규칙으로 이어집니다.

## 4. 권장 타입

```ts
type PostureState = "good" | "warning" | "bad" | "away" | "unstable";

type SessionStatus =
  | "idle"
  | "preparing"
  | "running"
  | "paused"
  | "resting"
  | "completed"
  | "aborted";

type LearningProfileKind = "library" | "home" | "team" | "custom";

type CharacterStage = 1 | 2 | 3 | 4 | 5 | 6;

type RoomMemberState = "ready" | "focusing" | "resting" | "away" | "completed";
```

## 5. 코드 구조

아래는 **실제 폴더 구조**입니다(v1.1.0 기준). 더 자세한 설명은
`docs/TEAM_START.md` §3 폴더 지도를 보세요.

```text
src/
├─ app/               라우팅·앱 껍데기
│  ├─ routes/         화면 23개 (Shop.tsx·Campus.tsx 등)
│  ├─ router/
│  ├─ providers/      ToastProvider 등
│  └─ App.tsx
├─ components/        화면 조각
│  ├─ ui/             버튼·카드·배지 등 공통 요소
│  ├─ layout/         AppShell·사이드바
│  ├─ dashboard/      대시보드 카드
│  ├─ character/      캐릭터·장착 아이템 렌더
│  ├─ posture/        자세 상태 배지
│  ├─ session/        세션 화면 조각
│  ├─ game/           괴물·보스 체력바·협동 아레나
│  ├─ stretch/        스트레칭 카드
│  ├─ room/           친구 방 조각
│  └─ campus/         학교 선택·지도·범례 (연우)
├─ features/          기능별 로직
│  ├─ posture-engine/ 랜드마크 → 자세 상태 판정 (민철)
│  ├─ calibration/    5초 개인 기준 등록 (민철)
│  ├─ pip/            PIP 미니 위젯 (민철)
│  ├─ rooms/          2인 친구 방·실시간 동기화 (수현)
│  ├─ campus/         학교 테마·96 영토전 (연우)
│  ├─ sessions/       집중 세션 타이머·완주 판정
│  ├─ game/           회복 공격·괴물 진행도·보상 지급
│  ├─ progression/    XP·포인트·캐릭터 단계·상점 보유/장착
│  ├─ modes/          도서관·내 공간·팀플·내 모드
│  ├─ stretch/        스트레칭 6종 추천
│  ├─ sound/          Web Audio 합성음·사운드 팩
│  ├─ onboarding/     닉네임·첫 방문 흐름
│  ├─ settings/       설정·전체 데이터 초기화
│  ├─ demo/           카메라 없이 보는 데모 모드
│  ├─ persistence/    브라우저 저장소 관리
│  └─ qa-lab/         /lab 개발자 테스트 화면
├─ lib/
│  ├─ mediapipe/      Pose Landmarker 로더
│  ├─ storage/        localStorage 래퍼·마이그레이션
│  ├─ supabase/       클라이언트·익명 인증
│  ├─ feature-flags/  환경 변수 → 기능 스위치
│  ├─ a11y/           감소된 모션 등 접근성 훅
│  ├─ time/           시간 포맷·KST 처리
│  └─ validation/     입력 검증
├─ constants/         숫자·문구 단일 출처 (posture·game·session·storeItems 등)
├─ assets/
├─ types/
└─ test/
```

- **상점 전용 features 폴더는 없습니다.** 화면은 `app/routes/Shop.tsx`,
  아이템 목록은 `constants/storeItems.ts` 입니다.
- 담당 표기가 없는 폴더는 공용입니다. 남의 담당 폴더를 고쳐야 하면
  먼저 이야기해 주세요(`docs/TEAM_START.md` §7).

## 6. 구현 규칙

- TypeScript `strict`를 사용합니다.
- 상태 전이는 UI 컴포넌트와 분리합니다.
- 시간 임계값은 상수 파일에서 관리합니다.
- 로컬 저장 스키마 버전을 둡니다.
- 3D 렌더 이미지는 `CharacterViewport` 한 컴포넌트에서 교체합니다.
- 캐릭터·과잠·백팩 레이어의 좌표 규격을 고정합니다.
- `prefers-reduced-motion`을 지원합니다.
- 색만으로 자세 상태를 전달하지 않습니다.
- 카메라가 없어도 QA Lab으로 핵심 흐름을 검증할 수 있어야 합니다.
- 실제 구현되지 않은 기능을 `실시간`, `AI`, `완료`로 표시하지 않습니다.

### 6.1 단일 진입점 — 우회하지 않습니다

이 코드베이스는 **같은 일을 하는 곳을 한 군데로 모으는 것**에 기대고 있습니다.

| 하는 일 | 유일한 통로 | 우회하면 |
|---|---|---|
| 지속 시간 세기 | `features/posture-engine/` `arbiterStep` | 판정이 두 번 일어남 |
| XP·포인트 지급 | `features/game/rewards.ts` `applyReward` | 중복 지급 방지가 깨짐 |
| 세션 종료 확정 | `features/sessions/finalizeSession.ts` | 중도 종료에도 보상이 나감 |
| 캐릭터 표시 | `components/character/CharacterViewport` | 화면마다 다른 캐릭터 |
| 소리 재생 | `features/sound/soundEngine.ts` | 음량·중복 제어가 깨짐 |
| 캠퍼스 기여 | `features/campus/recordContribution.ts` | eventId 중복 차단이 깨짐 |
| 색·폰트 토큰 | `src/index.css` `@theme` | 화면마다 색이 달라짐 |

### 6.2 디자인 토큰

- 색은 `bg-pink`·`text-ink` 처럼 **토큰 이름으로만** 씁니다. 화면에서 색값을 직접 쓰지 않습니다.
- 배색 비율: 아이보리 60% / 검정·초록·중립 30% / 강조색 10%.
- 폰트 가변 축은 **400~1000** 입니다. `font-weight: 300` 은 조용히 400 으로 잘립니다.

### 6.3 기능 플래그

미완성 기능은 `src/lib/feature-flags/flags.ts` 의 플래그로 격리합니다.
**플래그가 꺼져 있으면 라우트 자체를 등록하지 않습니다.** 주소로 직접 들어와도
홈으로 보냅니다.

### 6.4 요구사항 ID

[`docs/22_PRODUCT_SPEC_V2.md`](docs/22_PRODUCT_SPEC_V2.md) 의 `FR-XXX-NN` 을
커밋 메시지·PR 설명·테스트 이름에 그대로 씁니다.

```
feat: 세션 만들기를 5단계로 나눔 (FR-SES-01, FR-SES-02)
```

```ts
test('FR-SES-05 — 세션 만들기에 과목·목표 입력이 없다', async ({ page }) => { … })
```

## 7. Supabase 규칙

- 사용자 화면에는 회원가입을 요구하지 않습니다.
- 친구 방 진입 시 `signInAnonymously()`를 사용합니다.
- Presence는 준비·집중·자리 비움처럼 느리게 바뀌는 상태에 사용합니다.
- Broadcast는 회복·스트레칭·응원처럼 순간 이벤트에 사용합니다.
- 허용 이벤트 스키마 밖의 데이터는 전송하지 않습니다.
- RLS를 활성화하고 방 멤버만 private channel에 접근하도록 합니다.
- 서비스 역할 키를 프론트엔드에 넣지 않습니다.
- **DB 구조 변경은 반드시 `supabase/migrations/` 에 SQL 파일로 남깁니다.**
  대시보드에서 직접 클릭해 바꾸면 기록이 남지 않아 다른 사람 환경에 반영되지 않습니다.
  파일 이름은 `날짜_내용.sql` 형식입니다.

## 8. 실행·빌드·테스트

### 8.1 처음 받았다면

```bash
npm install
```

```bash
cp .env.example .env.local
```

Supabase 두 줄만 채웁니다. 나머지 기능 스위치는 이미 `true` 입니다.
변수 목록과 용도는 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §7 에 있습니다.
**`VITE_` 접두어가 붙은 값은 번들에 그대로 들어갑니다. 비밀 값을 넣지 않습니다.**

```bash
npx playwright install chromium
```

### 8.2 개발 중

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 (보통 http://localhost:5173) |
| `npm run storybook` | 컴포넌트 문서 (6006) |
| `npm run preview` | 빌드 결과 로컬 확인 (4173) |
| `npm run assets:verify` | 승인 에셋 112건 존재·무결성 |
| `npm run ai:eval` | AI 리포트 프롬프트 회귀 평가 |

### 8.3 작업 완료 전 — 넷 다 통과해야 합니다

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

### 8.4 화면·흐름을 바꿨으면 E2E 까지

```bash
npm run test:e2e
```

dev 서버 3대(5283 캠퍼스 OFF / 5284 캠퍼스 ON / 5285 카메라)를 자동으로 띄웁니다.
몇 분 걸립니다. `room-live.spec.ts` 는 Supabase env 가 없으면 자동으로 건너뜁니다.

**E2E 를 건너뛰지 마세요.** 2026-08-04 에 잡은 회귀 2건(대시보드 우측 레일 소실,
성장 화면 캐릭터 이미지 0개)은 **단위 테스트를 모두 통과**했고 E2E 에서만
걸렸습니다. `toBeInTheDocument` 는 통과하고 `toBeVisible` 만 실패하는 종류의
결함이라 E2E 밖에서는 보이지 않습니다.

### 8.5 Playwright로 검증하는 경로

- 첫 방문 → 닉네임 → 프로필 → 캘리브레이션 → 3분 데모
- bad → good 회복 → 공격
- away·unstable
- 스트레칭 건너뛰기
- 결과·출석·포인트
- 상점 구매·장착
- 2개 브라우저의 친구 방

## 8.6 작업 시 주의사항

### 혼자 판단해서 고치지 않는 파일

| 파일 | 왜 |
|---|---|
| `src/constants/posture.ts` | 판정 시간이 바뀌면 보상·게임 밸런스가 전부 흔들립니다. **아직 실제 카메라로 검증되지 않은 값**이라 특히 조심합니다 |
| `src/constants/game.ts` | 보상·피해량·캐릭터 XP·괴물 체력. 기존 사용자의 성장 속도가 갑자기 달라집니다 |
| `src/features/game/rewards.ts` | XP·포인트를 지급하는 유일한 통로 |
| `src/features/posture-engine/` | 시간을 세는 주체가 한 곳뿐인데 다른 곳에서 또 세면 판정이 두 번 일어납니다 |
| `src/features/sessions/finalizeSession.ts` | 우회하면 중도 종료에도 보상이 나갑니다 |
| `src/features/progression/growth.ts` | 레벨이 XP 에서 파생되는 구조. 깨지면 전 화면이 어긋납니다 |

### 되돌리기 어려운 작업 — 실행 전 확인받습니다

- `main` 병합, 원격 push, PR 머지 (**`main` 직접 push 금지**)
- Vercel 배포 — **반드시 `npx vercel deploy`(클라우드 빌드).** 환경변수가 sensitive 라
  `vercel pull` 은 플레이스홀더만 받고, 로컬 prebuilt 를 올리면 깨진 번들이 배포됩니다
- Supabase 마이그레이션 실행
- 추적되지 않는 파일의 대량 삭제

### 함정

1. **Vitest 워커** — `vite.config.ts` 의 `fileParallelism: false` 와
   `scripts/run-tests.mjs` 가드를 지우지 마세요. 병렬 실행 시 수집 파일 수가 매번
   달라지는데 종료 코드는 0 이었습니다.
2. **PiP 는 사용자 제스처 안에서** — `openPip()` 를 click 핸들러 밖에서 부르면 차단됩니다.
3. **MediaPipe 는 CDN 에서 받습니다** — 오프라인·차단 환경에서 자세 감지가 안 됩니다.
   `public/mediapipe/` 사본은 현재 **코드가 참조하지 않습니다**
   ([`docs/CODEX_HANDOFF.md`](docs/CODEX_HANDOFF.md) §7.2).
4. **PowerShell 커밋** — 큰따옴표가 든 메시지를 `-m` 으로 넘기면 인자가 쪼개집니다.
   `-F <파일>` 을 쓰세요.

## 9. 작업 보고 형식

```text
변경한 내용:
수정한 파일:
직접 확인할 URL 또는 경로:
테스트 결과:
남은 위험:
관련 문서 업데이트:
```

## 10. 금지 사항

- 팀 요청 없는 로그인·결제·광고 추가
- 평균 자세 점수·CVA 점수 표시
- 카메라 데이터 네트워크 전송
- 얼굴 이미지 샘플 커밋
- 실제 학교 공식 로고 무단 사용
- 초대 코드로 입장하지 않은 방(랜덤 참여)에서의 자유 채팅
- 신고·차단·길이 제한 없는 자유 채팅 (C-02 · `FR-CHAT-01`~`06`)
- 한 번에 전체 앱을 재작성
- 테스트 실패 상태를 완료로 보고

# ARCHITECTURE

마지막 갱신: 2026-08-11

이 문서는 UpRight Now의 현재 시스템 구조를 설명합니다. 실제 서비스 URL, Supabase 프로젝트 URL, API 키, 토큰 값은 기록하지 않습니다.

## 1. 전체 구조

```text
Browser SPA
  React 19 + Vite + TypeScript
  ├─ 라우트와 화면
  ├─ 자세 감지와 세션 진행
  ├─ 성장·상점·캠퍼스 UI
  └─ Supabase 클라이언트

Local device
  ├─ getUserMedia camera
  ├─ MediaPipe Pose Landmarker
  └─ localStorage based persistence

Supabase
  ├─ Auth: 익명 사용자, 학교 이메일 링크 인증
  ├─ Postgres: 방, 캠퍼스, 성장 보상 데이터
  ├─ RLS/RPC: 검증된 쓰기 경로
  └─ Realtime: 친구 방, 캠퍼스 갱신

Vercel
  ├─ Static SPA hosting
  ├─ /api/ai-report server function
  └─ Environment Variables
```

## 2. 주요 기술 스택

- React 19
- TypeScript strict
- Vite
- React Router
- Tailwind CSS v4
- Zustand
- Supabase JS
- MediaPipe Tasks Vision
- Vitest, Testing Library, Playwright
- Vercel
- 선택 기능: Gemini/Genkit/Langfuse 기반 AI 세션 회고
- 진행 중인 픽셀 월드: Phaser 3, 별도 worktree에서 작업 중

## 3. 주요 디렉터리와 역할

```text
src/
├─ app/
│  ├─ routes/          페이지 단위 화면
│  ├─ router/          라우트 등록
│  └─ providers/       전역 provider
├─ components/
│  ├─ ui/              공통 UI
│  ├─ layout/          AppShell, 사이드바
│  ├─ session/         세션 UI 조각
│  ├─ character/       캐릭터 렌더링
│  ├─ room/            친구 방 UI
│  └─ campus/          캠퍼스 지도, 학교 선택, 인증 UI
├─ features/
│  ├─ posture-engine/  자세 상태 판정
│  ├─ calibration/     개인 기준 자세 등록
│  ├─ sessions/        집중 세션 상태
│  ├─ game/            회복 공격, 보상 연결
│  ├─ progression/     XP, 포인트, 성장, 아이템
│  ├─ rooms/           친구 방 실시간 로직
│  ├─ campus/          학교, 인증, 기여도, 영토전
│  ├─ persistence/     localStorage 래퍼
│  └─ qa-lab/          개발용 테스트 화면
├─ lib/
│  ├─ supabase/        Supabase client, auth callback
│  ├─ feature-flags/   환경변수 기반 기능 스위치
│  ├─ mediapipe/       Pose Landmarker loader
│  └─ storage/         저장소 추상화
├─ constants/          제품 상수와 라우트 상수
├─ assets/             승인된 정적 에셋
└─ test/               테스트 셋업

supabase/
├─ schema.sql
├─ migrations/
└─ manual/

docs/
├─ CODEX_HANDOFF.md
├─ ARCHITECTURE.md
├─ DECISIONS.md
├─ TEAM_START.md
├─ AI_HANDOFF.md
├─ 20_DECISION_LOG.md
└─ superpowers/
```

## 4. 주요 컴포넌트와 역할

### 라우팅

- `src/app/router/AppRoutes.tsx`
  - SPA 라우트를 등록합니다.
  - 캠퍼스 라우트는 `featureFlags.campusTerritory`가 켜져 있을 때만 등록됩니다.
  - QA Lab은 운영에서 기본 비활성입니다.

### Supabase 연결

- `src/lib/supabase/client.ts`
  - `VITE_SUPABASE_URL`과 publishable/anon key가 없으면 `null`을 반환합니다.
  - 이메일 링크 인증 후 `consumeAuthCallback()`으로 PKCE code를 세션으로 교환합니다.
  - 익명 사용자는 `ensureAnonymousUser()`로 생성합니다.
  - 카메라 프레임, 자세 좌표, 랜드마크 원본을 전송하지 않는 것이 핵심 원칙입니다.

### 캠퍼스

- `src/app/routes/Campus.tsx`
  - 캠퍼스 메인 화면입니다.
  - 학교 인증, 시즌 요약, 기여도, 지도, 소식을 보여줍니다.
- `src/components/campus/SchoolPicker.tsx`
  - 검색형 학교 선택 UI입니다.
  - 지역 선택 후 대학 검색 UX를 목표로 합니다.
- `src/components/campus/SchoolVerification.tsx`
  - 학교 이메일 인증 UI입니다.
  - Supabase Auth 이메일 링크를 사용합니다.
- `src/components/campus/TerritoryMap.tsx`
  - 캠퍼스 영토 지도입니다.
  - 현재는 서울 25개 자치구 기반 프로토타입입니다.
- `src/features/campus/`
  - 학교 목록, 커스텀 학교 저장, 기여도 계산, 영토 소유권, Supabase repository, outbox를 포함합니다.

### 성장·보상

- `src/features/progression/`
  - 로컬 성장 상태와 아이템 보유/장착을 관리합니다.
- `supabase/migrations/20260804_growth_reward_foundation.sql`
- `supabase/migrations/20260804_growth_balance_rules.sql`
- `supabase/migrations/20260805_progression_dynamic_session_rewards.sql`
- `supabase/migrations/20260806_progression_streak_rewards.sql`
  - 서버 기준 성장 보상 원장과 규칙을 정의합니다.

### 픽셀 월드

- 설계 문서: `docs/superpowers/specs/2026-08-11-campus-pixel-world-design.md`
- 구현 계획: `docs/superpowers/plans/2026-08-11-campus-pixel-world-plan.md`
- 작성 시점 구현 흔적: `.worktrees/campus-pixel-world/`

픽셀 월드는 React 페이지 안에 Phaser 캔버스를 마운트하는 방식입니다. 초기 범위는 로컬 단일 플레이어 기숙사 방입니다.

## 5. 데이터 흐름

### 자세 세션

```text
Camera
  → MediaPipe Pose Landmarker
  → posture-engine 상태 판정
  → session state
  → 회복 이벤트
  → game/progression reward
  → localStorage 또는 Supabase RPC
```

영상 프레임과 랜드마크 원본은 서버로 보내지 않습니다.

### 친구 방

```text
User action
  → Supabase anonymous auth
  → room membership
  → Presence for state
  → Broadcast for instant events
  → UI sync
```

친구에게 공개되는 것은 닉네임, 참가 상태, 게임 이벤트 수준입니다.

### 학교 인증

```text
학교 선택
  → 학교 도메인 확인
  → Supabase Auth email OTP/magic link
  → redirect back to app
  → consumeAuthCallback()
  → campus_verify_school RPC
  → verified membership
```

인증 성공 후에만 캠퍼스 기여와 점령 쓰기가 가능해야 합니다.

### 캠퍼스 기여와 영토

```text
세션 완료/회복/스트레칭
  → CampusContributionBridge
  → campus contribution RPC
  → campus season standings
  → district territory read RPC
  → TerritoryMap render
```

학교 점수, 시즌 점수, 영토 상태는 Supabase의 `campus_*` 테이블과 RPC가 기준입니다.

### 성장 보상

```text
세션 이벤트
  → event_id 생성
  → progression reward RPC
  → reward rules lookup
  → reward event ledger
  → progression balance update
  → Growth UI
```

클라이언트는 XP·포인트 금액을 보내지 않습니다. 서버가 규칙 테이블로 결정합니다.

## 6. 외부 API 및 인프라 의존성

### Supabase

용도:

- Auth: 익명 로그인, 학교 이메일 링크 인증
- Postgres: 친구 방, 캠퍼스, 성장 보상
- Realtime: 친구 방과 캠퍼스 갱신
- SQL Editor: migration 직접 적용

주의:

- 새 프로젝트를 만들면 `supabase/schema.sql`과 `supabase/migrations/`를 순서대로 적용해야 합니다.
- Supabase Auth URL Configuration은 배포 주소마다 다시 설정해야 합니다.
- Custom SMTP는 Supabase 기본 발송 제한을 피하기 위해 필요할 수 있습니다.

### Vercel

용도:

- SPA 정적 배포
- 환경변수 관리
- `/api/ai-report` 서버 함수 실행

주의:

- GitHub main에 push하면 연결된 Vercel 프로젝트가 자동 배포할 수 있습니다.
- 환경변수를 바꾸면 redeploy가 필요합니다.
- 팀원 프로젝트와 개인 프로젝트는 서로 다른 Supabase 환경변수를 가질 수 있습니다.

### GitHub

용도:

- 원격 저장소
- main 브랜치 배포 트리거
- PR 기반 협업

주의:

- 로컬 커밋은 push 전까지 GitHub에 저장되지 않습니다.
- worktree의 미커밋 파일은 다른 계정으로 자동 이전되지 않습니다.

## 7. 환경변수 목록

| 이름 | 위치 | 용도 | 값 기록 여부 |
| --- | --- | --- | --- |
| `VITE_SUPABASE_URL` | client/Vercel | Supabase 프로젝트 URL | 실제 값 기록 금지 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client/Vercel | Supabase publishable key | 실제 값 기록 금지 |
| `VITE_SUPABASE_ANON_KEY` | client/Vercel | 구버전 호환 anon key | 실제 값 기록 금지 |
| `VITE_ENABLE_CAMERA` | client | 실제 카메라 감지 on/off | `true` 또는 `false` |
| `VITE_ENABLE_FRIEND_ROOM` | client | 친구 방 on/off | `true` 또는 `false` |
| `VITE_ENABLE_REALTIME` | client | Supabase Realtime on/off | `true` 또는 `false` |
| `VITE_ENABLE_PIP` | client | PIP 미니 위젯 on/off | `true` 또는 `false` |
| `VITE_ENABLE_CAMPUS_THEME` | client | 학교 테마 색상 on/off | `true` 또는 `false` |
| `VITE_ENABLE_CAMPUS_TERRITORY` | client | 캠퍼스 라우트와 영토전 on/off | `true` 또는 `false` |
| `VITE_ENABLE_CAMPUS_SUPABASE` | client | 캠퍼스 저장소 Supabase 사용 | `true` 또는 `false` |
| `VITE_ENABLE_AI_REPORT` | client | AI 회고 UI 노출 | `true` 또는 `false` |
| `AI_REPORT_ENABLED` | server | AI 회고 서버 함수 활성화 | `true` 또는 `false` |
| `AI_REPORT_MOCK` | local server | Vite dev에서 mock 회고 사용 | 선택 |
| `GEMINI_API_KEY` | server | Gemini API 호출 | 실제 값 기록 금지 |
| `LANGFUSE_PUBLIC_KEY` | server | AI 관찰성 public key | 실제 값 기록 금지 |
| `LANGFUSE_SECRET_KEY` | server | AI 관찰성 secret key | 실제 값 기록 금지 |
| `LANGFUSE_BASE_URL` | server | Langfuse endpoint | 실제 값 기록 금지 |
| `VITE_ENABLE_QA_LAB` | client | QA Lab 라우트 on/off | 운영 기본 false 권장 |

## 8. 배포 구조

```text
GitHub main
  → Vercel project
  → production deployment
  → Supabase project selected by Vercel env vars
```

배포 시 확인:

1. Vercel Project Settings의 Environment Variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`가 들어 있는지 확인합니다.
2. 환경변수 변경 후 redeploy합니다.
3. Supabase Authentication URL Configuration의 Site URL을 현재 production URL로 설정합니다.
4. Redirect URLs에 production URL, `/campus`, 필요한 preview/local URL을 추가합니다.
5. Supabase Email Template은 기본 `{{ .ConfirmationURL }}` 링크를 사용하는지 확인합니다.

## 9. 새 환경에서 실행·빌드·테스트

```bash
npm install
cp .env.example .env.local
npm run dev
npm run typecheck
npm run test
npm run build
```

로컬 실행 주소는 Vite가 출력하는 값을 따릅니다. Supabase 인증을 로컬에서 테스트하려면 해당 로컬 주소도 Supabase Redirect URLs에 추가해야 합니다.

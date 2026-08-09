# ARCHITECTURE — UpRight Now 시스템 구조

> 마지막 갱신: 2026-08-04 · 브랜치 `feat/wanted-sans-font`
>
> 이 문서는 **지금 코드에 있는 것**만 적습니다. 계획은
> [`22_PRODUCT_SPEC_V2.md`](22_PRODUCT_SPEC_V2.md) 에 있습니다.
> 수치가 다르면 `src/constants/` 가 정답입니다.

---

## 1. 한 장 요약

```
┌─────────────────────────── 브라우저 (여기서 거의 모든 것이 끝납니다) ───────────────────────────┐
│                                                                                              │
│  웹캠 ──► usePoseDetection ──► analyzeLandmarks ──► computeVotes ──► arbiterStep             │
│  (getUserMedia)   12fps          코어/보조 지표      방향성 편차      ★ 지속시간의 유일한 소유자  │
│                                                          │                                   │
│                                                          ▼                                   │
│                                              postureStore (good/warning/bad/away/unstable)   │
│                                                          │                                   │
│                          ┌───────────────────────────────┼───────────────────────────┐       │
│                          ▼                               ▼                           ▼       │
│                   postureMachine                  PostureGameBridge          PipWidget       │
│                  (회복 창 30s)                   ├─ gameStore (전투)          (별도 창)      │
│                          │                       ├─ applyReward (XP·포인트)                  │
│                          ▼                       └─ roomService.reportRecovery               │
│                    finalizeSession                                                           │
│                          │                                                                   │
│                          ▼                                                                   │
│                 localStorage (upright-now:*)                                                 │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
        │                              │                                  │
        │ 닉네임·상태·게임 이벤트만     │ 비식별 집계 8개만                │ WASM·모델 (읽기)
        ▼                              ▼                                  ▼
   Supabase                    Vercel Function                     jsDelivr CDN
   (Realtime · RPC · RLS)      /api/ai-report → Gemini            storage.googleapis.com
                                       │
                                       ▼
                                   Langfuse (원문 없음)
```

**카메라 영상·프레임·랜드마크 좌표·개인 자세 기준은 이 그림에서 브라우저 밖으로
나가는 화살표가 하나도 없습니다.** 이것이 이 아키텍처의 첫 번째 제약입니다.

---

## 2. 기술 스택

| 층 | 사용 | 버전 |
|---|---|---|
| 런타임 | 브라우저 (Chrome·Edge 116+) | — |
| 프레임워크 | React | 19.2 |
| 언어 | TypeScript `strict` | 5.9 |
| 번들러 | Vite (rolldown) | 8.1 |
| 스타일 | Tailwind CSS 4 + `@theme` 토큰 | 4.3 |
| 상태 | Zustand | 5.0 |
| 라우팅 | react-router-dom | 7.18 |
| 자세 추정 | MediaPipe Tasks Vision — Pose Landmarker | 0.10.35 |
| 보조 진단 | TF.js MoveNet + WASM backend | 4.22 |
| 3D | three.js (랜딩 히어로만) | 0.185 |
| 서버 | Supabase (Postgres · Realtime · 익명 인증) | JS SDK 2.110 |
| AI | Google GenAI (Gemini) + Genkit + Zod | — |
| 관찰 | Langfuse (원문 없이 메타데이터만) | 5.9 |
| 단위 테스트 | Vitest + Testing Library + jsdom | 4.1 |
| E2E | Playwright (chromium) + axe-core | 1.61 |
| 컴포넌트 문서 | Storybook | 10.5 |
| 린터 | oxlint | 1.75 |
| 프롬프트 회귀 | promptfoo | 0.121 |
| 폰트 | Wanted Sans Variable (OFL-1.1, 자체 호스팅) | 1.0.3 |
| 배포 | Vercel | — |

---

## 3. 디렉터리 구조

```
upright-now/
├─ api/                      Vercel Serverless Function (AI 리포트 한 개)
│  ├─ ai-report.ts             엔트리 — Node IncomingMessage ↔ Web Request 변환
│  ├─ ai-report-handler.ts     요청 검증·응답 조립 (dev 서버와 공유)
│  └─ ai-report-service.ts     Gemini 호출 + Zod 이중 검증
├─ e2e/                      Playwright 스펙 13개
├─ promptfoo/               AI 리포트 프롬프트 회귀 평가
├─ public/
│  ├─ assets/                 승인 에셋 — 캐릭터 6단계·괴물 3종×4단계·상점 레이어·스트레칭·캠퍼스
│  ├─ fonts/wanted-sans/      Wanted Sans Variable 92 subset + OFL
│  ├─ icons/
│  └─ mediapipe/              ⚠ 41MB — 코드가 참조하지 않습니다 (§8)
├─ scripts/                  에셋 변환, 테스트 수집 가드
├─ src/
│  ├─ app/
│  │  ├─ router/AppRoutes.tsx      라우트 등록 (플래그 꺼진 기능은 등록 자체를 안 함)
│  │  ├─ providers/                PostureGameBridge · ToastProvider
│  │  └─ routes/                   화면 컴포넌트
│  ├─ assets/manifest/             캐릭터 에셋 해석 (stage × 상태 → 파일 경로 + 폴백)
│  ├─ components/                  ui · character · posture · session · game · room · campus · layout
│  ├─ constants/                   ★ 모든 수치·문구의 단일 출처
│  ├─ features/                    도메인 로직 (§4)
│  ├─ lib/                         a11y · feature-flags · mediapipe · storage · supabase · time · validation
│  ├─ test/setup.ts
│  └─ types/
├─ supabase/
│  ├─ schema.sql                   최초 구조 (친구 방)
│  ├─ migrations/                  ★ DB 변경은 반드시 여기에 SQL 파일로
│  └─ manual/                      1회성 정리 SQL
├─ tools/                    승인 에셋 가져오기·검증
└─ docs/                     이 문서들
```

경로 별칭은 `@` → `src/` 하나뿐입니다 (`vite.config.ts`).

---

## 4. 주요 컴포넌트와 역할

### 4.1 `src/features/` — 도메인 로직

| 폴더 | 역할 | 건드리기 전 상의 |
|---|---|---|
| `posture-engine/` | 랜드마크 → 자세 상태 5종. **지속 시간을 세는 유일한 주체** | ★ |
| `calibration/` | 5초 개인 기준 등록, 프레이밍 게이트, 다중 프로필 | ★ |
| `sessions/` | 세션 타이머·완주 판정·`finalizeSession` | ★ |
| `game/` | 회복 공격·괴물 체력·`applyReward` (보상 단일 통로) | ★ |
| `progression/` | XP·포인트·캐릭터 단계·상점 보유/장착 | ★ |
| `rooms/` | 방 서비스·Presence·Broadcast·기린 싱크·이벤트 검증 | |
| `campus/` | 학교 테마·96 영토·기여도·시즌·학교 인증 | |
| `modes/` | 도서관·내 공간·팀플 + 내 모드 3개. 유효 설정 공급 | |
| `stretch/` | 모드별 가중 랜덤 추천 | |
| `pip/` | Document PiP 컨트롤러 + 위젯 | |
| `ai-report/` | 집계 계약·프롬프트·결과 카드 | |
| `sound/` | Web Audio 합성음 단일 출처 | |
| `onboarding/` `settings/` `persistence/` `demo/` `qa-lab/` | 보조 | |

★ 표시는 [`TEAM_START.md`](TEAM_START.md) §6 의 "혼자 판단해서 고치지 않는" 목록입니다.

### 4.2 단일 진입점 규칙

이 아키텍처는 **같은 일을 하는 곳을 한 군데로 모으는 것**에 기대고 있습니다.

| 하는 일 | 유일한 통로 | 우회하면 |
|---|---|---|
| 지속 시간 세기 | `posture-engine/arbiterStep` | 판정이 두 번 일어남 |
| XP·포인트 지급 | `game/rewards.ts` `applyReward` | 중복 지급 방지가 깨짐 |
| 세션 종료 확정 | `sessions/finalizeSession` | 중도 종료에도 보상이 나감 |
| 캐릭터 표시 | `components/character/CharacterViewport` | 화면마다 다른 캐릭터가 나옴 |
| 소리 재생 | `sound/soundEngine` | 음량·중복 제어가 깨짐 |
| 캠퍼스 기여 | `campus/recordContribution` | eventId 중복 차단이 깨짐 |
| 색·폰트 토큰 | `src/index.css` `@theme` | 화면마다 색이 달라짐 |

---

## 5. 데이터 흐름

### 5.1 자세 판정 (브라우저 안에서만)

```
카메라 → usePoseDetection (12fps, numPoses 2)
       → analyzeLandmarks   코어 = 코·눈 + 양어깨 / 보조 = 귀·엉덩이·z
       → computeVotes       개인 기준 대비 방향성 편차, MAD tolerance, z 는 보조
       → arbiterStep        warning 1.5s · bad 5s · good 2s  ← 시간의 유일한 소유자
       → postureStore.setInstant
       → postureMachine     확정 bad 진입 시 "즉시" 회복 기회 (여기서 5초를 다시 세지 않음)
       → 회복 창 30s · good 5s 유지 → 성공 → 냉각 20s
       → PostureGameBridge  → gameStore + applyReward + roomService.reportRecovery
```

`away`·`unstable` 에서는 **모든 타이머가 동결**됩니다.

### 5.2 로컬 저장 (`localStorage`)

네임스페이스 `upright-now`, 스키마 버전 **2**.

| 키 | 담는 것 |
|---|---|
| `upright-now:user` | 닉네임·온보딩 여부·소리·PiP·응원 문구 |
| `upright-now:progression` | XP·포인트·출석·보유/장착 아이템·최근 XP 5건 |
| `upright-now:calibration` | 개인 기준 **요약 통계만**. 원본 좌표·프레임 없음 |
| `upright-now:sessions` | 세션 기록 + AI 회고 |

v1 → v2 마이그레이션은 데모 시드만 초기화하고 획득 데이터를 보존합니다.
전체 초기화는 `features/settings/dataReset.ts` 한 곳입니다.

### 5.3 친구 방 (Supabase)

```
익명 로그인 (signInAnonymously)
  → create_room / join_room RPC → 초대 코드
  → Presence : 준비·집중·자리 비움처럼 느리게 바뀌는 상태
  → Broadcast: 회복·스트레칭·응원처럼 순간 이벤트
  → apply_room_damage / apply_room_shield RPC (event_id 중복 차단, 원자적)
  → rooms.boss_hp 가 최종 기준
```

`sanitizeRoomEvent` 가 **영상·프레임·랜드마크·좌표·`bad` 상태 전송을 차단**합니다.
30초 재연결, presence 메타는 `participantId` 로 dedupe(최신 우선)합니다.

### 5.4 AI 세션 회고

```
결과 화면에서 사용자가 요청
  → POST /api/ai-report  (비식별 집계 8개)
  → Zod 검증 → Gemini → Zod 재검증
  → 결과를 세션 기록에 저장 (updateSummary)
  → Langfuse 에는 모델·스키마·성공 여부·지연 시간만
```

**전송하는 8개** — `plannedMinutes` · `elapsedMinutes` · `detectableMinutes` ·
`awayMinutes` · `recoveryOpportunities` · `recoveries` · `bestCombo` · `status`.

**전송하지 않는 것** — 카메라 원본·스냅샷·좌표·자세 상태·나쁜 자세 지속 시간·
목표 문구·식별자·건강 정보.

---

## 6. 외부 의존성

| 대상 | 용도 | 없으면 |
|---|---|---|
| **Supabase** | 친구 방·캠퍼스 라이브 저장소, 익명 인증 | 혼자 모드 전 기능 정상. 방·캠퍼스 라이브만 비활성 |
| **jsDelivr CDN** | MediaPipe WASM (`@mediapipe/tasks-vision@0.10.35/wasm`) | **카메라 자세 감지 불가** |
| **storage.googleapis.com** | `pose_landmarker_lite.task` 모델 | **카메라 자세 감지 불가** |
| **Vercel Functions** | `/api/ai-report` | AI 회고만 비활성. 로컬 결과 요약은 그대로 |
| **Google Gemini** | AI 회고 생성 | 위와 동일 |
| **Langfuse** | 운영 관찰 (선택) | 관찰만 안 됨 |

> **CDN 두 곳이 자세 감지의 단일 장애점입니다.** 저장소에 `public/mediapipe/`
> (41MB) 로 같은 파일이 들어 있지만 **코드가 참조하지 않습니다.** §8 참고.

---

## 7. 환경변수

**실제 값은 이 문서에 적지 않습니다.** 로컬은 `.env.example` 을 `.env.local` 로
복사해 채우고, 운영은 Vercel 대시보드에서 설정합니다.

### 7.1 클라이언트 (`VITE_` 접두어 — 번들에 포함되어 공개됨)

| 변수 | 용도 | 로컬 기본 |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 주소 | 비어 있음 (팀에서 받기) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase 공개 키. `VITE_SUPABASE_ANON_KEY` 도 같은 뜻 | 비어 있음 |
| `VITE_ENABLE_CAMERA` | 실제 웹캠 자세 감지 | `true` |
| `VITE_ENABLE_FRIEND_ROOM` | 방 만들기·입장 | `true` |
| `VITE_ENABLE_REALTIME` | 방 실시간 동기화 (친구 방이 켜져야 의미 있음) | `true` |
| `VITE_ENABLE_PIP` | PiP 미니 위젯 자동 열기 | `true` |
| `VITE_ENABLE_CAMPUS_THEME` | 학교 테마 색 | `true` |
| `VITE_ENABLE_CAMPUS_TERRITORY` | 캠퍼스 영토전 화면 | `true` |
| `VITE_ENABLE_CAMPUS_SUPABASE` | 캠퍼스를 라이브 DB 로. `false` 면 mock | `true` |
| `VITE_ENABLE_QA_LAB` | `/lab` 개발자 도구 | dev 는 자동 `true` |
| `VITE_ENABLE_AI_REPORT` | 결과 화면의 AI 회고 노출 | `false` |

**`VITE_` 접두어가 붙은 값은 번들에 그대로 들어갑니다.** 비밀 값을 넣지 않습니다.

### 7.2 서버 전용 (`VITE_` 를 붙이면 안 됨)

| 변수 | 용도 | 어디에 |
|---|---|---|
| `AI_REPORT_ENABLED` | 서버 함수의 AI 회고 호출 허용 | Vercel |
| `GEMINI_API_KEY` | Gemini 키 | Vercel (**절대 프론트 금지**) |
| `LANGFUSE_PUBLIC_KEY` | 관찰 (선택) | Vercel |
| `LANGFUSE_SECRET_KEY` | 관찰 (선택) | Vercel |
| `LANGFUSE_BASE_URL` | 관찰 (선택) | Vercel |
| `AI_REPORT_MOCK` | dev·E2E 에서 고정 응답 | 로컬·CI 만 |

AI 회고가 실제로 동작하려면 `VITE_ENABLE_AI_REPORT=true` + `AI_REPORT_ENABLED=true`
+ `GEMINI_API_KEY` **셋 다** 필요합니다.

### 7.3 운영 현재 상태 (2026-08-04 기준)

`.env.production` 은 **저장소 안의 기본값**이고, Vercel 대시보드 값이 이를 덮어씁니다.
`.env.production` 은 카메라·친구 방·Realtime·캠퍼스·QA Lab 을 모두 `false` 로 둡니다.

Vercel Production 에 실제로 설정된 것: Supabase URL·키, `VITE_ENABLE_CAMERA`,
`VITE_ENABLE_FRIEND_ROOM`, `VITE_ENABLE_REALTIME`, `VITE_ENABLE_CAMPUS_THEME`,
`VITE_ENABLE_CAMPUS_TERRITORY`, `VITE_ENABLE_CAMPUS_SUPABASE`, `VITE_ENABLE_QA_LAB=false`.
**`VITE_ENABLE_PIP` 이 빠져 있어 운영에서 PiP 자동 열기가 꺼져 있습니다.**

---

## 8. 배포

| 항목 | 값 |
|---|---|
| 호스팅 | Vercel |
| 운영 | https://upright-now.vercel.app |
| 저장소 | https://github.com/suhyunkim1105-hash/upright-now |
| 라우팅 | `vercel.json` — 모든 경로를 `/index.html` 로 rewrite (SPA) |
| 서버 함수 | `api/ai-report.ts` (`maxDuration` 15초) |
| 빌드 | `tsc -b --force && vite build` |

### 배포 명령

```bash
npx vercel deploy
```

**반드시 클라우드 빌드를 씁니다.** Vercel 환경변수가 sensitive 라 `vercel pull` 은
`[SENSITIVE]` 플레이스홀더만 받습니다. 로컬 prebuilt 를 올리면 깨진 번들이 배포됩니다.
`.vercelignore` 가 로컬 개인 파일 업로드를 막습니다.

### 빌드 산출물에서 확인이 필요한 것

`public/fonts/` 의 Zarafa 시절 잔재(Gowun·IBMPlex·Pretendard, 4.2MB)는
참조 없음을 확인하고 삭제했습니다(2026-08-09). 아래는 남은 것입니다.

| 경로 | 크기 | 상태 |
|---|---|---|
| `public/mediapipe/` | **41.3 MB** | 코드가 CDN 을 쓰므로 **참조되지 않음** |
| `public/assets/` | 16.9 MB | 캐릭터·괴물·상점·스트레칭 — 실제 사용 |
| `public/fonts/wanted-sans/` | 2.2 MB | 실제 사용 (subset 이라 실제 전송은 100~300KB) |

`public/` 은 그대로 `dist/` 로 복사되므로, 위 41.3MB 가 배포마다 함께 나갑니다.
**지우기 전에 결정이 필요합니다** — MediaPipe 로컬 사본은 CDN 장애 대비
폴백으로 쓸 수 있습니다. 쓸 거면 `lib/mediapipe/loader.ts` 를 로컬 우선으로 바꾸고,
안 쓸 거면 지웁니다. 지금은 **둘 다 아닌 상태**입니다.

---

## 9. 테스트 구조

| 종류 | 도구 | 규모 | 특이사항 |
|---|---|---|---|
| 단위·컴포넌트 | Vitest + jsdom | 67 파일 / 526개 | `fileParallelism: false` (§10) |
| E2E | Playwright chromium | 13 스펙 / 97개 | dev 서버 3대 자동 기동 |
| 접근성 | axe-core (E2E 안) | — | |
| 프롬프트 회귀 | promptfoo | 고정 집계 케이스 | `npm run ai:eval` |
| 에셋 무결성 | `tools/verify-approved-assets.mjs` | 112 검사 | `npm run assets:verify` |

E2E 는 서버 3대를 씁니다.

| 포트 | 플래그 | 검사 |
|---|---|---|
| 5283 | 캠퍼스 OFF | 기존 화면 회귀 + OFF 회귀 |
| 5284 | 캠퍼스 ON (mock) | 캠퍼스 테마·영토전 |
| 5285 | 카메라 ON | 카메라 진단 (별도 project) |

`room-live.spec.ts` 는 `.env.local` 에 Supabase 값이 없으면 자동으로 건너뜁니다.

---

## 10. 알아 둘 함정

1. **Vitest 워커.** 이 개발 머신에서 병렬 워커가 죽으면서 수집 파일 수가 매번
   달라졌는데도 종료 코드가 0 이었습니다. `fileParallelism: false` 로 순차 실행하고,
   `scripts/run-tests.mjs` 가 수집 개수와 디스크 spec 개수를 대조해 다르면 실패시킵니다.
   더 빠른 머신으로 옮겨도 **이 가드는 남겨 두세요.**
2. **PostgREST 스키마 캐시.** 직접 RPC 목록 반영이 늦을 수 있습니다. 앱은
   `is_room_member` 를 직접 호출하지 않고 `cleanup_stale_members` 내부 게이트를 씁니다.
3. **Realtime RLS.** 자체 스크립트로 검증할 때는 `realtime.setAuth(token)` 이 필요합니다.
   표준 앱 클라이언트는 자동입니다.
4. **기린 싱크 event_id.** 두 회복 uuid 의 XOR 파생 id 를 씁니다. 원본 id 를 재사용하면
   중복 차단과 충돌합니다.
5. **PiP 는 사용자 제스처 안에서.** `openPip()` 를 click 핸들러 밖에서 부르면 차단됩니다.
6. **Wanted Sans 가변 축은 400~1000.** `font-weight: 300` 은 조용히 400 으로 잘립니다.

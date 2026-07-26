# 🌿 PREVIEW_BRANCHES — main 에 병합되지 않은 작업

| 항목 | 내용 |
|---|---|
| 기준일 | 2026-07-26 |
| 기준 브랜치 | `main` · 커밋 `44f4a92` · 태그 `v1.0.0-mvp` |
| 이 문서의 역할 | **`main` 밖에 있는 구현**을 "Preview 구현, main 미병합"으로 분리해 기록 |

> ## ⚠️ 읽기 전에
>
> - `README.md` · `CURRENT_PRODUCT_SPEC.md` · `FEATURE_STATUS.md` 는 **`main` 44f4a92 만** 설명합니다.
> - 이 문서의 기능은 **Production 에 없고**, `main` 의 기능 목록·완료 현황에 포함되지 않습니다.
> - 여기 적힌 상태는 **Preview 구현**이며, `완료` 가 아닙니다.
> - 병합·배포 판단은 팀이 합니다. 이 문서는 판단 근거만 제공합니다.

---

## 1. 브랜치 현황

`main`(`44f4a92`) 기준으로 앞서 있는 브랜치는 4개입니다.

| 브랜치 | tip (문서 작성 시각) | main 대비 | 이 문서에서 다루는 범위 |
|---|---|---|---|
| `fix/core-session-flow` | `4d8fa6c` | **3 커밋 · 72 파일** | ✅ 아래 §2 에서 상세히 (검증은 `02a430e` 기준) |
| `feat/v1.1-deadline-experience` | `b832878` | 1 커밋 | 목록만 — **내용 미검토** |
| `feat/campus-territory-prototype` | `e7e83fc` | 1 커밋 | 목록만 — **내용 미검토** |
| `audit/overnight-qa` | `aa256f6` | 1 커밋 (문서) | 목록만 — **내용 미검토** |
| `docs/overnight-cleanup` | — | 문서 전용 | 이 문서가 속한 브랜치 |

> - `feat/v1.1-deadline-experience` · `feat/campus-territory-prototype` · `audit/overnight-qa` 는
>   **내용을 확인하지 않았습니다.** 존재 사실만 기록합니다. 추측으로 기능을 적지 않습니다.
> - **브랜치는 계속 움직입니다.** 위 tip 은 문서 작성 시각의 값이며, 지금 값은
>   `git log --oneline 44f4a92..<브랜치>` 로 직접 확인하세요.

---

## 2. `fix/core-session-flow` — Preview 구현, main 미병합

### 2.1 정체

| 항목 | 값 |
|---|---|
| 브랜치 | `fix/core-session-flow` |
| **검증한 커밋** | **`02a430e`** — `feat: connect modes calibration and co-op readiness` (2026-07-26) |
| 선행 커밋 | `c209ffb` — `fix: repair posture session navigation and dashboard sync` (2026-07-25) |
| 이후 커밋 | `4d8fa6c` — `chore: add idempotent room duration range migration` (2026-07-26 14:54) |
| 현재 tip | `4d8fa6c` · main 대비 3 커밋 · 72 파일 · +2450 / −352 |
| 상태 | **Preview 구현 · main 미병합 · Production 미반영** |

> - 아래 §2.2 의 검증 결과는 **`02a430e` 시점**의 것입니다.
>   그 뒤 `4d8fa6c` 가 추가되었고, 이 커밋은 **`supabase/` 파일만** 바꿉니다(§2.8 B-1 참고).
>   `src/` 는 그대로이므로 lint·typecheck·unit·e2e·build 결과는 유효하다고 보지만,
>   **현재 tip 에서 다시 실행하지는 않았습니다.**
> - `02a430e` 단독으로는 적용할 수 없습니다. `c209ffb` 가 선행 커밋이라 **브랜치 단위로만** 병합 가능합니다.

### 2.2 이 저장소에서 실제로 실행한 검증

`main` 을 건드리지 않기 위해 **분리된 임시 worktree(detached HEAD `02a430e`)** 에서 실행했습니다.

| 검사 | 결과 |
|---|---|
| `npm run lint` | ✅ 오류 0건 (스타일 경고 6건) |
| `npm run typecheck` | ✅ 통과 |
| `npm run test` (Vitest) | ✅ **테스트 파일 27개 · 193개 전부 통과 / 실패 0** |
| `npm run test:e2e` (Playwright chromium) | ✅ **68개 중 67개 통과 · 1개 skip** (skip = `room-live.spec.ts`, Supabase env 없음) |
| `npm run build` | ✅ 성공 |
| 실제 카메라 동작 | ❌ **실행하지 않음** — 웹캠 필요 |
| 2인 실기기 친구 방 | ❌ **실행하지 않음** — 두 대의 기기 + Supabase env 필요 |
| Supabase V1.2 마이그레이션 적용 | ❌ **실행하지 않음** — 라이브 DB 변경이라 손대지 않음 |

**참고 — `main` 44f4a92 의 같은 검사**: unit 24파일/173개 통과 · e2e 67통과+1skip · build 성공.
즉 브랜치는 **단위 테스트 20개가 늘었고 전부 통과**하며, e2e 개수는 동일합니다.

> ⚠️ 위 결과는 **자동 검사만** 통과했다는 뜻입니다.
> 실카메라 자세 판정과 2인 실기기 친구 방은 확인하지 않았으므로 **`완료` 가 아닙니다.**
> 실행하지 않은 항목은 "통과"로 간주하지 않습니다.

### 2.3 추가되는 기능 — 학습 모드 시스템

`src/features/modes/modeStore.ts` (신규)

- 기본 3모드(도서관 · 내 공간 · 팀플) + **내 모드 최대 3개** CRUD
- 모드가 바꾸는 것: **소리 기본값 · 연출 강도(low/default/rich) · 스트레칭 추천 성향 · 친구 기능 · 괴물 테마**
- 모드가 바꾸지 **않는** 것: **자세 판정 임계값 · XP · 기록 · 성장** (코드 주석과 테스트에 명시)
- 모드별 자세 기준(캘리브레이션 프로필) 연결 지원
- 화면: `/profiles` 가 모드 관리 화면으로 확장, `/session/setup` · `/` 에서 모드 선택·표시

### 2.4 추가되는 기능 — 모드별 마감 괴물

`MONSTER_THEMES` 가 단일 출처입니다.

| 모드 | 괴물 | id |
|---|---|---|
| 도서관 | 책더미 괴물 **북몽이** | `bookmong` |
| 내 공간 | 늘어짐 괴물 **늘몽이** | `neulmong` |
| 팀플 | 팀플 괴물 **꼬몽이** | `komong` |

친구 방 세션은 모드와 무관하게 항상 꼬몽이입니다.

> `main` 의 마감괴수 `D-DAY` 를 대체하는 방향입니다. **`main` 에서는 여전히 D-DAY 1종입니다.**

### 2.5 추가되는 기능 — 캘리브레이션 v3 · 다중 자세 기준

**완료 조건이 4개 전부 충족으로 바뀝니다** (`main` v2 는 시간 + 표본 2개 조건):

1. 카메라·프레이밍 확인 **1.5초** 연속 유지
2. 표본 수집 실제 벽시계 **5.0초** 경과
3. 유효 표본 **40개** 이상
4. **1초 버킷 5칸 각각에 유효 표본 1개 이상**

→ 빠른 프레임 40장이 5초 전에 모여도 완료되지 않습니다.
타임아웃은 12초 → **20초**. 화면은 3단계(확인 → 유지 → 저장)로 표시됩니다.

**다중 프로필**: `profiles[]` + `activeProfileId` 로 여러 자세 기준을 저장·선택·이름변경·삭제할 수 있습니다.
기존 단일 프로필 저장형을 읽어 마이그레이션합니다. 저장 내용은 여전히 **요약 통계뿐**이고 원본 좌표·프레임은 저장하지 않습니다.

### 2.6 추가되는 기능 — 그 밖

| 영역 | 내용 |
|---|---|
| **세션 중 회복 휴식** | `beginRest` / `endRest` — 스트레칭 동안 타이머·자세 판정을 멈추고 **같은 세션으로 복귀**. 스트레칭이 세션을 끝내지 않음 |
| **스트레칭 복귀 경로** | 출발지(active-session / result / standalone)별로 돌아갈 곳이 달라짐. `main` 의 `/result/demo` 고정 이동 문제를 해결 |
| **오늘의 집중 시간** | `todayFocus.ts` 신규 — 세션 기록에서 실제 합산. `main` 의 `0:00` 하드코딩과 `세션 수 × 25분` 추정을 대체 |
| **사용자 지정 세션 길이** | 집중 5~120분(5분 단위) · 회복 휴식 0~30분 |
| **친구 방 준비 게이트** | 카메라 · 자세 기준 · 모델 · 사용자 준비 **4가지가 모두 충족**되어야 시작 가능. 항목별 체크 배지 표시 |
| **친구 방 공동 화면** | `CoopArena.tsx` 신규 — [내 캐릭터][공동 괴물+HP][친구 캐릭터]. 친구 회복 시 친구 캐릭터가 공격 |
| **친구 방 장착 아이템 공유** | presence 에 `jacketId` · `backpackId` 추가 |
| **친구 방 재접속** | `sessionStorage` 기반 — 새로고침 시 `join_room` 을 다시 부르지 않고 재구독 |
| **응원 스팸 제한** | 5초에 1회 |
| **회복 공격 연출** | 3.2초 시퀀스(충전 → 에너지 이동 → 피격 → 보상). 모달이 아니라 조작을 막지 않음 |
| **세션 이탈 가드** | 활성 세션에서 뒤로가기·새로고침 시 확인. 우회 시 기록을 남기고 종료 |
| **용어 변경** | `리셋` → **`회복 휴식`** (전 화면) |
| **자세 엔진 조정** | `classify.ts` · `features.ts` · `useLiveClassifier.ts` · `usePoseDetection.ts` 변경 — **수치 변경 내용은 이 문서에서 검증하지 않았습니다** |

### 2.7 브랜치의 테스트

브랜치에는 `main` 에 없는 단위 테스트 3개가 추가되어 있습니다.

| 파일 | 검증 대상 |
|---|---|
| `src/features/modes/modeStore.spec.ts` | 내 모드 CRUD · 최대 3개 제한 · 모드 변경이 XP·기록을 건드리지 않음 |
| `src/features/sessions/sessionRest.spec.ts` | `beginRest` 중 타이머 정지 · `endRest` 후 재개 · 요약에 원본 sessionId·시작 시각 기록 |
| `src/features/sessions/todayFocus.spec.ts` | 오늘 집중 시간 집계 · 같은 sessionId 중복 제거 · 어제 세션 제외 · 시간 포맷 |

브랜치 전체 단위 테스트는 **27파일 · 193개 전부 통과**입니다(§2.2).
`main` 대비 파일 3개 · 테스트 20개가 늘었습니다.

브랜치의 e2e 파일 목록은 `main` 과 동일하고(7개), `room-live.spec.ts` 는 내용이 크게 보강되었지만
**Supabase env 가 없어 이번 실행에서는 skip 되었습니다.**

### 2.8 병합 전 반드시 확인할 것

| # | 항목 | 이유 |
|---|---|---|
| B-1 | **Supabase 수동 마이그레이션** | `rooms.duration_seconds` 제약을 IN-목록에서 `between 180 and 7200` 범위로 바꿔야 합니다. **SQL Editor 에서 직접 실행하기 전까지 라이브 방은 사용자 지정 길이를 거부합니다.** 검증 시점(`02a430e`)에는 `supabase/schema.sql` 하단 블록이었고, 이후 `4d8fa6c` 에서 **멱등 마이그레이션 파일** `supabase/migrations/20260726_expand_room_duration.sql` 로 분리되었습니다 |
| B-2 | **자세 엔진 수치 변경 검증** | `classify.ts` · `features.ts` 가 바뀌었습니다. 실기기 오탐 재검증이 필요합니다 |
| B-3 | **실카메라·2인 실기기 미검증** | 자동 검사는 전부 통과했지만 웹캠·2인 검증은 하지 않았습니다. `QA_CHECKLIST.md` §3 · §10 을 브랜치에서 다시 돌려야 합니다 |
| B-4 | **`room-live` e2e 가 skip 됨** | Supabase env 가 없어 실행되지 않았습니다. 친구 방 변경이 큰 브랜치이므로 env 를 넣고 반드시 돌려야 합니다 |
| B-5 | **로컬 저장 스키마 변경** | 캘리브레이션이 `profile` 단일 → `profiles[]` 로 바뀝니다. 기존 사용자 데이터 마이그레이션 경로 확인 필요 |
| B-6 | **용어 변경 파급** | `리셋` → `회복 휴식` 이 문서·카피 전반에 영향을 줍니다 |

### 2.9 `main` 문서와의 대응 관계

`FEATURE_STATUS.md` 에서 **`main` 기준 미해결**로 적힌 항목 중 일부는 이 브랜치에 이미 대응 구현이 있습니다.
**병합 전까지 `main` 문서의 상태는 바뀌지 않습니다.**

| `FEATURE_STATUS.md` 의 main 기준 문제 | 이 브랜치의 대응 |
|---|---|
| 대시보드 `오늘의 기록 · 집중` 이 `0:00` 고정 | `todayFocus.selectTodayFocus` 로 실제 합산 |
| 누적 시간이 `완료 세션 수 × 25분` | `selectTotalFocusMs` 로 실제 `elapsedMs` 합 |
| 스트레칭 종료가 `/result/demo` 로 이동 | 출발지별 복귀 경로 |
| 모드별 괴물 미구현 | `MONSTER_THEMES` 3종 |
| 프로필별 소리·연출 분기 없음 | `ActiveModeConfig.soundDefault` · `ambient` |
| 장소별 다중 기준 프로필 없음 | `profiles[]` + `activeProfileId` |
| 2분 리셋 구간 타이머 없음 | `beginRest` / `endRest` |
| 친구 방 응원 스팸 제한 없음 | 5초 쿨다운 |

---

## 3. 이 문서를 갱신하는 방법

1. 브랜치가 `main` 에 병합되면 → 해당 항목을 이 문서에서 지우고
   `FEATURE_STATUS.md` · `CURRENT_PRODUCT_SPEC.md` 를 **새 `main` 커밋 기준으로** 다시 씁니다.
2. 새 미병합 브랜치가 생기면 → §1 표에 tip 커밋과 함께 추가합니다.
3. 내용을 확인하지 않은 브랜치는 **"내용 미검토"로 남겨 둡니다.** 추측해서 기능을 적지 않습니다.

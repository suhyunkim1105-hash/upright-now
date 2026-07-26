# 📚 DOCS_INDEX — UpRight Now 문서 분류

| 항목 | 내용 |
|---|---|
| 프로젝트 | UpRight Now |
| 이 문서의 역할 | 저장소 안팎의 문서를 "지금 무엇을 믿어야 하는가" 기준으로 분류 |
| 기준일 | 2026-07-26 |
| 기준 커밋 | `44f4a92` · 태그 `v1.0.0-mvp` |
| 기준 브랜치 | `main` (문서 작업은 `docs/overnight-cleanup`) |
| 미병합 브랜치 | 4개 존재 → [`PREVIEW_BRANCHES.md`](./PREVIEW_BRANCHES.md) |

> ## 📌 기준 고정
>
> **`현재 단일 기준` 으로 분류된 모든 문서는 `main` 브랜치 커밋 `44f4a92` 만을 설명합니다.**
> `main` 에 병합되지 않은 브랜치의 기능은 그 문서들에 **들어 있지 않습니다.**
> 미병합 브랜치는 [`PREVIEW_BRANCHES.md`](./PREVIEW_BRANCHES.md) 에서 **"Preview 구현, main 미병합"** 으로 따로 관리합니다.

## 읽는 규칙

1. **코드와 테스트가 최종 기준입니다.** 문서와 코드가 다르면 코드가 맞습니다.
   단, "어느 코드인가"는 항상 **`main`** 입니다. 브랜치 코드는 `main` 문서의 근거가 되지 않습니다.
2. 문서끼리 충돌하면 아래 순서로 우선합니다.
   `README.md` → `docs/CURRENT_PRODUCT_SPEC.md` → `AGENTS.md` → `docs/06~15` 기술 명세 → 나머지
3. **오래된 구현 기준**으로 분류된 문서는 삭제하지 않습니다. 역사·의도 기록으로 남기되,
   "현재 이렇게 동작한다"의 근거로 인용하지 않습니다.
4. 수치(시간·XP·HP·가격)를 문서에서 옮겨 적기 전에 `src/constants/` 에서 확인하세요.

---

## 1. ✅ 현재 단일 기준

지금 제품이 무엇인지 설명할 때 **이 문서들만** 인용합니다.

| 문서 | 역할 | 상태 |
|---|---|---|
| [`README.md`](../README.md) | 저장소 최상단 요약 · 실행 · 환경 변수 · 알려진 한계 | 2026-07-26 갱신 |
| [`docs/CURRENT_PRODUCT_SPEC.md`](./CURRENT_PRODUCT_SPEC.md) | 현재 구현된 제품 전체 명세 (문제 정의 → 데이터 구조 → 테스트 기준) | 신규 |
| [`docs/FEATURE_STATUS.md`](./FEATURE_STATUS.md) | 기능별 완료/부분/Preview/미구현 · 화면 경로 · 테스트 · 알려진 오류 | 신규 |
| [`docs/ROADMAP.md`](./ROADMAP.md) | Now / Next / Later / Experimental | 신규 |
| [`docs/QA_CHECKLIST.md`](./QA_CHECKLIST.md) | 사용자가 직접 손으로 확인하는 체크리스트 | 신규 |
| [`docs/PREVIEW_BRANCHES.md`](./PREVIEW_BRANCHES.md) | **main 미병합 브랜치** 현황 — Preview 구현으로 분리 기록 | 신규 |
| [`docs/NOTION_PROJECT_PAGE.md`](./NOTION_PROJECT_PAGE.md) | Notion 붙여넣기용 프로젝트 소개 페이지 | 신규 |
| [`docs/DOCS_INDEX.md`](./DOCS_INDEX.md) | 이 문서 | 신규 |
| [`docs/AI_HANDOFF.md`](./AI_HANDOFF.md) | 다음 작업자·AI 에이전트 인수인계 (파이프라인·보상·플래그 요약) | 유지 |
| [`AGENTS.md`](../AGENTS.md) | AI 코딩 에이전트 구현 계약 — 제품 불변조건·개인정보 경계·금지 표현 | 유지 (§1 우선순위 목록만 이 인덱스로 대체) |

---

## 2. 🔧 기술 명세

구현의 **의도와 규격**을 담은 문서입니다. 대부분 코드와 일치하지만,
아래 표의 "코드와 다른 점"에 적힌 항목은 코드가 최종 기준입니다.

| 문서 | 다루는 범위 | 코드와 다른 점 |
|---|---|---|
| [`04_IA.md`](./04_IA.md) | 라우트·정보 구조·사이드바 | 라우트·사이드바 순서 일치. 단 코드에는 `/stretch` (파라미터 없는 경로)도 있고, §2 의 `공동 결과` 화면은 미구현 |
| [`05_SCREEN_SPEC.md`](./05_SCREEN_SPEC.md) | 화면별 요소·상태·인터랙션 | 대체로 일치. 세부 문구는 `src/constants/copy.ts` 가 기준 |
| [`06_POSTURE_ENGINE_SPEC.md`](./06_POSTURE_ENGINE_SPEC.md) | 캘리브레이션·자세 상태·회복 판정 | **v2 로 재설계됨.** 지속 시간 소유권은 `classify.ts` 의 arbiter 가 유일하게 가지며, `postureMachine` 은 확정 bad 진입 시 5초를 다시 세지 않음 |
| [`07_GAME_SYSTEM_SPEC.md`](./07_GAME_SYSTEM_SPEC.md) | 성장·보스·XP·포인트·악용 방지 | 수치는 `src/constants/game.ts` 가 기준 (개인 보스 HP 1000 / 방 2000) |
| [`08_SOCIAL_ROOM_SPEC.md`](./08_SOCIAL_ROOM_SPEC.md) | 2인 방·Supabase 이벤트 | private 채널 대신 표준 채널 사용(§13과 다름). 방장 이전·늦은 입장 처리는 미구현 |
| [`09_STRETCH_SYSTEM_SPEC.md`](./09_STRETCH_SYSTEM_SPEC.md) | 스트레칭 6종·모드별 가중 랜덤 | 일치. 모션 영상 대신 SVG 도식 사용 |
| [`10_CHARACTER_ASSET_SPEC.md`](./10_CHARACTER_ASSET_SPEC.md) | 6단계 캐릭터·WebP/WebM 규격 | WebM 모션 미보유. Lv.2/4/5/6 은 idle 만 존재 |
| [`11_STORE_CUSTOMIZATION_SPEC.md`](./11_STORE_CUSTOMIZATION_SPEC.md) | 과잠·백팩 상점·장착 규칙 | 이미지 레이어 대신 색 리본·아이콘 배지로 표시 |
| [`12_DESIGN_SYSTEM.md`](./12_DESIGN_SYSTEM.md) | 컬러·타이포·레이아웃·컴포넌트 | 일치 (`src/index.css`, `src/components/ui/`) |
| [`13_UX_COPY.md`](./13_UX_COPY.md) | 실제 화면 문구 | `src/constants/copy.ts` 가 단일 소스 |
| [`14_DATA_PRIVACY_SECURITY.md`](./14_DATA_PRIVACY_SECURITY.md) | 로컬·서버 데이터 경계와 보안 | 원칙은 그대로 지켜짐. 다만 §10 의 `Realtime private channel` 은 미적용(표준 채널), `최근 스트레칭` 은 저장하지 않고 메모리에만 유지 |
| [`15_TECHNICAL_ARCHITECTURE.md`](./15_TECHNICAL_ARCHITECTURE.md) | 모듈·스택·데이터 흐름 | **미채택**: Dexie/IndexedDB(→ localStorage v2) · Zod(→ 자체 `sanitizeRoomEvent`) · Motion 라이브러리. `features/profiles`·`features/store` 폴더는 없고 각각 `onboarding`·`progression` 에 흡수. 플래그에 `camera`·`friendRoom` 추가됨. §7 의 private 채널은 표준 채널로 대체 |
| [`17_VERCEL_DEPLOYMENT.md`](./17_VERCEL_DEPLOYMENT.md) | GitHub·환경 변수·배포 | 배포 설정 일치. §5 환경 변수 목록에 `VITE_ENABLE_CAMERA` · `VITE_ENABLE_FRIEND_ROOM` 이 빠져 있음. 실제 값은 Vercel 대시보드 |
| [`supabase/README.md`](../supabase/README.md) | 친구 방 백엔드 적용 순서 | 일치 |
| [`supabase/schema.sql`](../supabase/schema.sql) | 방 테이블·RLS·RPC | **실행 기준.** 문서보다 이 파일이 우선 |

---

## 3. 📎 참고 자료

배경·의도·근거를 담은 자료입니다. 구현 판단의 근거로는 쓰지 않습니다.

| 문서 | 역할 |
|---|---|
| [`01_PRODUCT_BRIEF.md`](./01_PRODUCT_BRIEF.md) | 문제·사용자·가치·차별화 가설 |
| [`02_PRD.md`](./02_PRD.md) | 기능 요구사항과 P0/P1/P2 우선순위 (구현 전 계획) |
| [`03_USER_FLOW.md`](./03_USER_FLOW.md) | 행동·상태·예외 복구 흐름 |
| [`16_ACCEPTANCE_TESTS.md`](./16_ACCEPTANCE_TESTS.md) | 완료 기준·QA 시나리오·출시 차단 조건 (실행 체크리스트는 `QA_CHECKLIST.md`) |
| [`18_ASSET_MANIFEST.md`](./18_ASSET_MANIFEST.md) | 필요한 이미지·모션·사운드 목록 (대부분 미제작 — 제작 요청서로 사용) |
| [`20_DECISION_LOG.md`](./20_DECISION_LOG.md) | 확정 결정 D-001~D-014 과 근거 |
| [`21_RESEARCH_BASIS.md`](./21_RESEARCH_BASIS.md) | 문제 정의 근거 요약 + 연구가 증명하지 않는 것 |
| [`CAMPUS_THEME_AND_TERRITORY_CONCEPT.md`](./CAMPUS_THEME_AND_TERRITORY_CONCEPT.md) | 캠퍼스 테마·영토전 **기획안** (코드 미구현 · 승인 전) |
| [`references/README.md`](../references/README.md) | 캐릭터·대시보드 시각 레퍼런스 사용 지침 |
| `references/character-growth-final.jpeg` | 6단계 캐릭터 디자인 기준 이미지 |
| `references/dashboard-ui-concept.png` | 대시보드 구조·색상 기준 이미지 |

---

## 4. ⚠️ 오래된 구현 기준 — 현재 구현 기준 아님

**삭제하지 않습니다.** 다만 "지금 제품이 이렇게 동작한다"의 근거로 인용하지 않습니다.

### 4.1 이 저장소 밖

| 대상 | 왜 기준이 아닌가 |
|---|---|
| `기린이 되자!` 문서 일체 | UpRight Now 이전 이름·이전 기획. 30분 세션·3단계 성장·자세 바통 중심 |
| `Zarafa` 문서 일체 | 같은 계열의 이전 기획 |
| `C:\Users\수현\Desktop\거부기탈출` 프로젝트 | 별도 프로젝트. **읽기 전용 참고이며 수정 금지.** 이 저장소의 구현 기준이 아님 |

현재 기준과 어긋나는 대표 항목: 30분 세션(→ 25분), 3단계 성장(→ 6단계),
자세 바통·자세 점수 중심(→ 개인 기준 대비 변화 + 회복 행동 보상), 다인원 방(→ 최대 2명).

### 4.2 이 저장소 안 — 구현 이전 단계 문서

| 문서 | 왜 기준이 아닌가 | 대체 문서 |
|---|---|---|
| [`00_DOC_INDEX.md`](./00_DOC_INDEX.md) | 구현 전(2026-07-24) 문서 목록. 신규 문서가 빠져 있음 | 이 `DOCS_INDEX.md` |
| [`19_IMPLEMENTATION_PLAN.md`](./19_IMPLEMENTATION_PLAN.md) | Phase 1~6 구현 순서 계획. **모든 Phase 종료됨.** Dexie 등 채택되지 않은 선택 포함 | `FEATURE_STATUS.md` · `ROADMAP.md` |
| [`HANDOFF_PACKAGE_README.md`](./HANDOFF_PACKAGE_README.md) | 구현 시작 전 인수인계 패키지 안내. "가장 먼저 할 작업"이 이미 완료됨. 권장 기술표가 실제 스택과 다름(Dexie·Motion) | `README.md` · `AI_HANDOFF.md` |
| [`CLAUDE_CODE_MASTER_PROMPT.md`](../CLAUDE_CODE_MASTER_PROMPT.md) | 최초 구현 지시 프롬프트. 1회성 | `AGENTS.md` |

---

## 5. 🗄️ 아카이브

기록으로 보관하는 산출물입니다. 현재 화면과 다를 수 있습니다.

| 경로 | 내용 | 주의 |
|---|---|---|
| `artifacts/phase-1-screens/` | Phase 1 목업 스크린샷 10장 | 카메라·상점·친구 방 이전 상태 |
| `artifacts/phase-1-6-screens/` | Phase 1.6 화면 스크린샷 9장 (1440·1280) | 최신 히어로 레이아웃 이전 |
| `artifacts/character-assets/` | 캐릭터 에셋 검수 스크린샷 8장 | 검수용 |
| `templates/.env.example`, `templates/vercel.json` | 초기 배포 템플릿 | 실사용본은 저장소 루트의 `.env.example` · `vercel.json` |
| `public/assets/characters/SOURCE.md`, `generated.json` | 캐릭터 에셋 변환 기록 | `scripts/convert-characters.mjs` 산출물 |

---

## 6. 대상별 읽기 순서

**처음 오는 사람 / 발표·소개**
`README.md` → `NOTION_PROJECT_PAGE.md` → `CURRENT_PRODUCT_SPEC.md` → `01_PRODUCT_BRIEF.md`

**이어서 개발하는 사람**
`README.md` → `AGENTS.md` → `AI_HANDOFF.md` → `FEATURE_STATUS.md` → `15_TECHNICAL_ARCHITECTURE.md` → 코드

**자세 엔진을 만지는 사람**
`AGENTS.md §2.2` → `CURRENT_PRODUCT_SPEC.md §6~8` → `06_POSTURE_ENGINE_SPEC.md` → `src/features/posture-engine/`

**친구 방을 만지는 사람**
`CURRENT_PRODUCT_SPEC.md §10` → `08_SOCIAL_ROOM_SPEC.md` → `supabase/schema.sql` → `src/features/rooms/`

**QA·검수하는 사람**
`QA_CHECKLIST.md` → `FEATURE_STATUS.md` → `16_ACCEPTANCE_TESTS.md`

**기획·다음 단계를 정하는 사람**
`ROADMAP.md` → `CAMPUS_THEME_AND_TERRITORY_CONCEPT.md` → `20_DECISION_LOG.md`

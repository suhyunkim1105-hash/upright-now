# CODEX_HANDOFF — 작업 인수인계

> 작성: 2026-08-04 · 브랜치 `feat/wanted-sans-font` (`4863dc5`)
>
> **다음 작업자가 이 문서 하나로 이어받을 수 있게** 쓴 문서입니다.
> 자세 판정 파이프라인의 기술 상세는 [`AI_HANDOFF.md`](AI_HANDOFF.md),
> 시스템 구조는 [`ARCHITECTURE.md`](ARCHITECTURE.md),
> 앞으로 만들 것은 [`22_PRODUCT_SPEC_V2.md`](22_PRODUCT_SPEC_V2.md) 에 있습니다.

---

## 1. 지금 어디까지 왔는가

| 항목 | 값 |
|---|---|
| 운영 | https://upright-now.vercel.app (`main` · 태그 `v1.1.0`) |
| 작업 브랜치 | `feat/wanted-sans-font` |
| 열린 PR | [#8](https://github.com/suhyunkim1105-hash/upright-now/pull/8) — `feat/pip-camera-preview` → `main`. Ready for review · MERGEABLE |
| 최근 게이트 | lint 0 · typecheck 통과 · unit **526/526** · e2e **96 통과 1 skip** · build 통과 |

### 브랜치 관계

```
main (v1.1.0)
 └─ feat/pip-camera-preview        ← PR #8. main 병합 대기
     └─ docs/product-spec-v2         스펙 문서
         └─ feat/wanted-sans-font    결정 반영 + 폰트 + IA + 프로토타입  ← 지금 여기
```

**스택 브랜치입니다.** `feat/wanted-sans-font` 는 아래 셋을 전부 포함합니다.
PR 을 어떻게 나눌지는 아직 정하지 않았습니다 (§6-1).

---

## 2. 완료된 작업

### 2.1 v1.1.0 까지 (운영 중)

카메라 자세 감지 · 5초 캘리브레이션 · 회복 게임 · 세션/기록 · 성장 · 상점 ·
설정 · 스트레칭 6종 · PIP 미니 위젯 · 친구 방(최대 10인·상시방·중간 입장·리액션) ·
모드 시스템(기본 3 + 내 모드 3) · 경제 v2 · 개인 괴물 4단계 · 캠퍼스 테마·96 영토전 ·
사운드 팩 · 승인 에셋 112건.

### 2.2 이번 작업 구간 (2026-08-04)

| 커밋 | 내용 |
|---|---|
| `9cd7ab0` | **회귀 2건 수정** — 대시보드 우측 레일과 성장 화면 캐릭터 이미지 (§2.3) |
| `4b74005` | 폐지된 Zarafa 랜딩을 제품에서 분리. **dist 127MB → 65MB** |
| `12555c6` | `origin/main` 병합 (23 커밋). 충돌 2건 해결 |
| `8fb5a1d` | V2 제품 스펙 신설 — 회의 결정을 코드와 42개 항목 대조 |
| `80044a5` | 불변조건 충돌 4건 결정 반영 (C-01~C-04) |
| `2676a33` | **Wanted Sans Variable 도입** (자체 호스팅, OFL-1.1) |
| `4856ec7` | 폰트 교체 후 QA 스크린샷 갱신 |
| `4863dc5` | **IA 확정** — 좌측 레일 4탭, 방 만들기 통합, Zoom 톤 프로토타입 |

### 2.3 잡아낸 회귀 2건 — 왜 중요한가

둘 다 디자인 패스 커밋 `c62a10e` 에서 들어왔고, **E2E 가 아니었으면 못 잡았습니다.**

| 파일 | 증상 |
|---|---|
| `src/components/layout/AppShell.tsx` | 우측 레일이 `xl:flex` → `2xl:flex` 로 바뀌면서 **지원 폭 1280·1440 에서 레일과 캠퍼스 카드가 통째로 사라짐** |
| `src/components/character/GrowthTimeline.tsx` | `CharacterViewport` 가 빠지고 번호 노드만 남아 **성장 화면에 승인 캐릭터 이미지가 0개** |

**교훈** — 화면을 바꾸는 작업일수록 `npm run test:e2e` 를 돌려야 합니다.
단위 테스트는 둘 다 통과했습니다. `toBeInTheDocument` 는 통과하고
`toBeVisible` 만 실패하는 종류의 결함이라 E2E 밖에서 안 보입니다.

---

## 3. 진행 중인 작업

> **이 문서는 2026-08-06 시점입니다.** 다음 날 `prototypes/room-flow/` 에
> 방 만들기 5단계·대기실·마이페이지 재편·설정 화면·세션 시계·AI 회고 연동이
> **화면 레벨로 먼저 확정**됐습니다. 아래 표의 "코드 착수 전" 항목들은 그
> 프로토타입을 참고해서 이식하는 작업입니다 — 화면 구조를 다시 설계하지
> 마세요. 무엇이 왜 그렇게 됐는지는
> [`prototypes/room-flow/CHANGELOG-2026-08-07.html`](../../prototypes/room-flow/CHANGELOG-2026-08-07.html) 에 있습니다.

| 항목 | 상태 | 막고 있는 것 |
|---|---|---|
| PR #8 병합 | Ready for review, MERGEABLE, Vercel 프리뷰 통과 | 팀 리뷰 |
| V2 화면 개편 | 스펙·IA·**프로토타입(화면 레벨) 까지 완료**. `src/` 코드 이식 전 | §6-1 디자인 톤 결정 |
| Zoom 톤 검토 | 프로토타입 `docs/prototypes/zoom-tone-v1.html` | 같은 결정 |

---

## 4. 남은 작업과 우선순위

`22_PRODUCT_SPEC_V2.md` §3.2 의 순서입니다. 회의에서 정한 순서와 다릅니다 —
캐릭터가 다섯 화면의 공통 의존성이고, 지도가 가장 불확실하기 때문입니다.

| 단계 | 내용 | 담당 | 선행 조건 |
|---|---|---|---|
| **0** | 상점 비활성화 · 좌측 레일 4탭 · 마이페이지 신설 · 설정 축소 | 프론트 | 디자인 톤 결정 |
| **1** | 성장 시스템 — 15레벨 · XP 곡선 · 주간 회복 지수 | 프론트 | 만렙 XP 결정 |
| **2** | 방 만들기 10단계 흐름 + 스트레칭 전/후 게이트 | 프론트 | 단계 0 |
| **3** | PIP 2단계 — 자세 색·아이콘·화면 숨기기 | 민철 | 없음. **지금 시작 가능** |
| **4** | 방 시스템 — 초대 코드 상시 노출 · 캐릭터 표시 · 자유 채팅 | 수현 | 없음. **지금 시작 가능** |
| **5** | AI 리포트 마이페이지 축적 | 프론트 | 단계 0 |
| **6** | 캠퍼스 서울 지도 재설계 | 연우 | 지도 서비스 결정 |

**단계 3·4 는 아무것도 기다리지 않습니다.** 디자인 톤 결정이 늦어지면 여기부터 하세요.

---

## 5. 주요 기술적 의사결정

전체 목록과 검토한 대안은 [`DECISIONS.md`](DECISIONS.md) 에 있습니다.
이번 구간에서 새로 내린 것만 아래에 정리합니다.

| ID | 결정 | 이유 |
|---|---|---|
| C-01 | **XP 는 감소하지 않는다.** 주간 회복 지수를 따로 만든다 | 레벨이 XP 파생이라 XP 감소 = 레벨 퇴화. 불변조건 위반이고, 카메라를 켜 두는 제품에서 "감시와 처벌" 인상은 이탈로 직결 |
| C-02 | **초대 코드 방에서만 자유 채팅.** 신고·차단·80자 제한 필수 | 익명 로그인이라 제재할 계정이 없음. 서로 아는 사이로 범위를 좁혀 위험을 낮춤 |
| C-03 | **학교 로고 대신 자체 엠블럼** (학교 색 + 자체 도형) | 대학 로고는 상표. 허가 없이 경쟁형 서비스에 쓸 수 없음 |
| C-04 | 민감도 설정 UI 만 제거. **내부 값은 `default` 유지** | `ISSUE-009` — 임계값을 조였을 때 정상 미세 흔들림까지 실패로 처리한 이력. 실기기 검증 전에는 올리지 않음 |
| IA | **좌측 레일 유지.** 하단 탭 아님 | 웹캠·PiP·장시간 PC 작업이 전제인 데스크톱 제품 |
| IA | 홈·집중 세션·친구 방 → **방 만들기** 하나 | 혼자와 함께의 차이는 방 종류일 뿐. 진입점이 셋일 이유가 없음 |
| 폰트 | **Wanted Sans 자체 호스팅.** CDN 아님 | 네트워크가 막힌 환경에서도 같은 화면. 폰트 호스트에 세션 정보가 새지 않음 |
| 폰트 | npm 패키지 대신 `public/` 배치 | npm 은 unpacked 48MB 에 otf/ttf 까지 딸려 옴. subset woff2 만 필요 |
| Zarafa | 삭제 대신 `../zarafa-archive/` 로 이동 | 되돌릴 수 있게. `web/` 소스에서 재빌드도 가능 |

---

## 6. 결정이 필요한 것

### 6-1. 디자인 톤 — **가장 급함**

`docs/20_DECISION_LOG.md` 의 `D-006` 은 *Playful Pastel Dashboard × Cozy Campus
Island* 이고, 승인 에셋 112건이 그 톤으로 제작됐습니다. Zoom 톤은 반대 축입니다.

| 안 | 내용 | 비용 |
|---|---|---|
| **A (추천)** | 껍데기(레일·툴바·버튼·카드)만 Zoom 톤. 캐릭터 자리는 따뜻하게 | 에셋 재제작 없음. `D-006` 에 단서 추가 |
| B | 전면 교체 | 에셋 112건 재제작. `D-006` 개정 |
| C | 파스텔 유지 | 없음 |

A 라면 `src/index.css` 의 `@theme` 블록 하나 교체로 대부분 끝납니다.
화면 코드가 전부 토큰 이름(`bg-pink`·`text-ink`)만 쓰고 있기 때문입니다.

### 6-2. 나머지 5건

| 항목 | 선택지 | 막는 작업 |
|---|---|---|
| 만렙 누적 XP | 13,000 (약 10주) / 10,000 (약 8주) | 단계 1 |
| 잎사귀 포인트의 쓰임 | 상점 복귀까지 보류 / 캠퍼스 기여 전환 / 삭제 | 경제 전반 |
| 지도 서비스 | Mapbox / Google / Cesium / VWorld | 단계 6 |
| 구역 단위 | 자치구 25 / 대학 반경 / 육각 그리드 | 단계 6 |
| 랜덤 참여 범위 | 전체 공개방 / 같은 학교끼리 / 보류 | 단계 4 |

### 6-3. PR 을 어떻게 나눌지

현재 `feat/wanted-sans-font` 는 스펙 문서·폰트·IA·프로토타입을 다 담고 있습니다.
PR #8 병합 후 하나로 낼지, 문서와 폰트를 쪼갤지 정해야 합니다.

---

## 7. 알려진 문제

### 7.1 차단은 아니지만 중요

| # | 문제 | 상태 |
|---|---|---|
| **R-01** | **실카메라 자세 판정 임계값이 검증되지 않았습니다.** 전부 합성 데이터 기준 | 미해결. 사람 5~8명 · 카메라 3대 이상 관찰 필요 |
| R-02 | 온보딩 튜토리얼 없음. 처음 온 사용자가 뭘 해야 할지 모름 | 미구현 |
| R-03 | 캐릭터 Lv.2/4/5/6 자세별 컷, `away` 전용 컷 없음 | 에셋 미보유 |
| R-04 | 운영에 `VITE_ENABLE_PIP` 미설정 → PiP 자동 열기 꺼짐 | Vercel 환경변수 추가하면 끝 |
| R-05 | AI 회고 운영 비활성 (서버 키·비용 한도 미결) | 결정 필요 |
| R-06 | 모바일 375px 에서 사이드바 캐릭터가 약 14px 가로 오버플로 | 데스크톱 우선이라 보류 |
| R-07 | 모션 WebM 미보유. 정적 WebP + CSS 로 대체 | 보류 |

**R-01 이 어떤 기능 개발보다 우선합니다.** 자세 판정이 틀리면 성장도 영토전도
의미가 없습니다. 기능 개발과 **병행**해서 관찰을 시작하세요.

### 7.2 빌드에 딸려 오는 무거운 파일

| 경로 | 크기 | 상태 |
|---|---|---|
| `public/mediapipe/` | **41.3 MB** | git 추적 중. **코드가 참조하지 않음** — 로더는 jsDelivr CDN 을 씁니다 |
| ~~`public/fonts/*.woff2` (Gowun·IBMPlex·Pretendard)~~ | ~~4.2 MB~~ | **삭제됨(2026-08-09).** 참조 없음 확인 후 지웠고 `npm run build` 통과 확인함 |

`public/` 은 그대로 `dist/` 로 복사되므로 배포마다 함께 나갑니다.
**MediaPipe 사본은 지우기 전에 결정이 필요합니다** — CDN 두 곳이 지금 자세 감지의
단일 장애점이라, 이 사본을 폴백으로 쓰는 편이 나을 수 있습니다.

| 안 | 할 일 |
|---|---|
| 폴백으로 쓴다 | `src/lib/mediapipe/loader.ts` 를 로컬 우선 + CDN 폴백으로 |
| 안 쓴다 | `public/mediapipe/` 삭제 |
| 지금 | **둘 다 아닌 상태.** 41MB 를 옮기기만 하고 안 씁니다 |

### 7.3 환경 관련

| # | 문제 |
|---|---|
| E-01 | Vitest 병렬 워커가 이 개발 머신에서 죽으면서 수집 파일 수가 매번 달랐습니다. `fileParallelism: false` + `scripts/run-tests.mjs` 가드로 막아 뒀습니다. **가드는 남겨 두세요.** |
| E-02 | PowerShell 에서 `git commit -m` 에 큰따옴표가 든 메시지를 넘기면 인자가 쪼개집니다. `-F <파일>` 을 쓰세요. |

---

## 8. 바로 시작할 수 있는 다음 단계

### 8.1 처음 받았다면

```bash
cd upright-now
```

```bash
npm install
```

```bash
cp .env.example .env.local
```

`.env.local` 의 Supabase 두 줄만 채웁니다. 나머지 스위치는 이미 `true` 입니다.

```bash
npx playwright install chromium
```

```bash
npm run dev
```

### 8.2 지금 바로 할 수 있는 일 — 결정을 안 기다립니다

**① 운영 PiP 켜기 (R-04) — 5분**
Vercel Production 환경변수에 `VITE_ENABLE_PIP=true` 추가 후 재배포.

**② 폰트 잔재 정리 — 10분**
`public/fonts/` 의 Gowun·IBMPlex·Pretendard woff2 와 OFL txt 삭제.
참조가 없으니 `npm run build` 만 통과하면 됩니다.

**③ PIP 2단계 (단계 3) — 관련 파일**

| 파일 | 할 일 |
|---|---|
| `src/features/pip/PipWidget.tsx` | 자세 상태 색 + **아이콘** 표시 (`FR-PIP-02` — 색만으로 전달 금지) |
| `src/features/pip/pipStore.ts` | 카메라 표시 토글 상태 |
| `src/features/pip/pipController.tsx` | 창 생성·복귀 |
| `e2e/pip.spec.ts` | 수용 기준을 테스트 이름에 `FR-PIP-02` 로 |

**④ 방 시스템 (단계 4) — 관련 파일**

| 파일 | 할 일 |
|---|---|
| `src/app/routes/Session.tsx` | 세션 중에도 초대 코드 상시 노출 (`FR-ROOM-01`) |
| `src/features/rooms/roomStore.ts` | 참가자 표시를 캐릭터 + 학교 색으로 |
| `src/components/room/` | 참가자 타일 컴포넌트 |
| `src/features/rooms/roomEvents.ts` | 자유 채팅 도입 시 `sanitizeRoomEvent` 확장 (C-02 · `FR-CHAT-01`~`06`) |

### 8.3 디자인 톤이 A 로 정해지면

```
src/index.css  @theme 블록의 색 토큰 교체
   ↓
npm run test:e2e   ← 반드시. 폭별 오버플로 검사가 여기 있습니다
   ↓
artifacts/ 스크린샷 갱신 커밋
```

화면 코드는 손대지 않습니다. 토큰 이름만 쓰고 있기 때문입니다.

### 8.4 작업을 마치기 전 반드시

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

화면·흐름을 바꿨으면 E2E 까지. 몇 분 걸립니다.

```bash
npm run test:e2e
```

---

## 9. 관련 파일 빠른 찾기

| 찾는 것 | 경로 |
|---|---|
| 제품 불변조건·금지 사항 | `AGENTS.md` |
| 현재 수치·협업 규칙 | `docs/TEAM_START.md` |
| 시스템 구조·환경변수·배포 | `docs/ARCHITECTURE.md` |
| 자세 판정 파이프라인 상세 | `docs/AI_HANDOFF.md` |
| 앞으로 만들 것 | `docs/22_PRODUCT_SPEC_V2.md` |
| 결정 기록과 대안 | `docs/DECISIONS.md` |
| 개인정보 원칙 | `docs/14_DATA_PRIVACY_SECURITY.md` |
| Zoom 톤 프로토타입 | `docs/prototypes/zoom-tone-v1.html` |
| **모든 수치** | `src/constants/` |
| 자세 임계값 | `src/constants/posture.ts` |
| 보상·괴물·캐릭터 단계 | `src/constants/game.ts` |
| 세션 길이 | `src/constants/session.ts` |
| 방 인원 | `src/constants/rooms.ts` |
| 학교·캠퍼스 문구 | `src/constants/campus.ts` |
| 화면 문구 | `src/constants/copy.ts` |
| 디자인 토큰 | `src/index.css` `@theme` |
| 기능 플래그 | `src/lib/feature-flags/flags.ts` |
| 보상 단일 통로 | `src/features/game/rewards.ts` |
| 세션 종료 단일 통로 | `src/features/sessions/finalizeSession.ts` |
| DB 변경 | `supabase/migrations/` |

# FEATURE_STATUS — 기능별 구현 현황

| 항목 | 내용 |
|---|---|
| 기준일 | 2026-07-26 |
| 기준 커밋 | `44f4a92` · 태그 `v1.0.0-mvp` |
| Production | https://upright-now.vercel.app |
| 검증 결과 | lint 오류 0 · typecheck 통과 · unit **173/173** · e2e **67 통과 + 1 skip** · build 성공 |

> 표의 `테스트` 열 괄호 숫자는 그 파일의 실행 테스트 개수입니다.

## 상태 정의

| 상태 | 의미 |
|---|---|
| **완료** | 실제 동작하고 테스트로 보호됩니다. 문서와 코드가 일치합니다. |
| **부분 완료** | 핵심 경로는 동작하지만 명세의 일부가 빠져 있습니다. |
| **Preview** | 코드는 있으나 Production 기본값에서 꺼져 있거나 개발 환경에서만 열립니다. |
| **미구현** | 상수·타입·문서만 있고 동작하지 않습니다. |

> Production 에서 실제로 켜지는 기능 플래그는 **Vercel 환경 변수**가 결정합니다.
> 저장소의 `.env.production` 은 전부 `false` 인 안전 기본값입니다.

---

## 1. 온보딩 · 진입

| 기능 | 상태 | 화면 경로 | 테스트 | 알려진 오류 | 다음 작업 |
|---|---|---|---|---|---|
| 닉네임 (최대 12자, 로컬 저장) | 완료 | `/onboarding/name`, `/settings` | `onboarding/userStore.spec.ts`, e2e `screens` | 없음 | — |
| 학습 프로필 선택 3종 | 부분 완료 | `/profiles`, `/session/setup` | e2e `screens` | 프로필이 실제로 바꾸는 것은 **스트레칭 가중치뿐**. 소리·연출·위젯 크기 분기 없음 | 프로필별 소리·연출 분기 |
| 카메라 안내 (권한 지연 요청) | 완료 | `/camera` | e2e `routes`, `copy` | 없음 | — |
| 3분 데모 (카메라 없이 전 흐름) | 완료 | `/` → `/session/setup` | `demo/demoMode.spec.ts` | 없음 | — |
| 첫 방문 사용법 안내 | 미구현 | — | — | 온보딩 카드 외에 튜토리얼 없음 | 3~4단계 코치마크 |

---

## 2. 자세 엔진

| 기능 | 상태 | 화면 경로 | 테스트 | 알려진 오류 | 다음 작업 |
|---|---|---|---|---|---|
| MediaPipe Pose 추론 (~12fps, numPoses 2) | 완료 | `/calibration`, `/session/:id` | `posture-engine/*.spec.ts` | 카메라 플래그가 꺼져 있으면 동작하지 않음 | — |
| 5초 캘리브레이션 v2 (median + MAD) | 완료 | `/calibration` | `calibration/collect.spec.ts` (8) | 없음 | — |
| 자세 상태 5종 + 품질 3종 | 완료 | `/session/:id` | `classify.spec.ts` (15) | 실기기 임계값 미검증 | 실카메라 튜닝 |
| 방향성 편차 + MAD tolerance 판정 | 완료 | — | `classify.spec.ts` | tolerance 바닥값·yaw 0.7 은 **합성 데이터 기준** | 실기기 데이터로 재보정 |
| arbiter 지속 시간 확정 (1.5s/5s/2s) | 완료 | — | `classify.spec.ts` | 없음 | — |
| 회복 사이클 (30s 창 · good 5s · 냉각 20s) | 완료 | `/session/:id` | `postureMachine.spec.ts` (10) | 없음 | — |
| away·unstable 타이머 동결 | 완료 | `/session/:id` | `postureMachine.spec.ts` | 없음 | — |
| 카메라 거리 변화 안내 (20% · 2초) | 완료 | `/session/:id` | 수동 확인 필요 | 자동 테스트 없음 | e2e 시나리오 추가 |
| 두 명 이상 인식 → unstable | 완료 | `/session/:id` | 수동 확인 필요 | — | — |
| 비디오 정지(1.5s) → unavailable | 완료 | `/session/:id` | 수동 확인 필요 | — | — |
| 선택형 흐트러짐 자세 등록 | 미구현 | — | — | `optionalSlouchCalibration` 플래그가 `false` 로 하드코딩 | 필요 시 설계부터 |
| 기준 프로필 여러 개 저장·이름 지정 | 미구현 | — | — | 프로필 1개만 저장, 이름은 `기본 자세` 고정 | 장소별 다중 기준 |

---

## 3. 집중 세션

| 기능 | 상태 | 화면 경로 | 테스트 | 알려진 오류 | 다음 작업 |
|---|---|---|---|---|---|
| 세션 길이 4종 (25/15/50/3분) | 완료 | `/session/setup`, `/` | `sessionMachine.spec.ts` | 없음 | — |
| 시간 3분할 집계 (세션/감지 가능/자리 비움) | 완료 | `/session/:id`, `/result/:id` | `sessionMachine.spec.ts` (9) | 없음 | — |
| 일시정지 · 이어서 하기 | 완료 | `/session/:id`, PiP | `sessionMachine.spec.ts` | 없음 | — |
| 자리 비움 60초 안내 (계속/일시정지/종료) | 완료 | `/session/:id` | 수동 확인 필요 | `계속하기` 가 자세 상태를 강제로 `good` 으로 설정 | 실제 재측정 대기로 변경 |
| 완주 인정 80% 규칙 | 완료 | — | `finalizeSession.spec.ts` (6) | 없음 | — |
| 단일 종료 진입점 (중복 종료·보상 차단) | 완료 | — | `finalizeSession.spec.ts` | 없음 | — |
| 2분 리셋 자동 연결 | 부분 완료 | `/session/:id` → `/stretch` | e2e `screens` | 완료 후 버튼으로만 이동. `restSec` 값은 저장되지만 리셋 타이머로 쓰이지 않음 | 리셋 구간 타이머 구현 |
| 과목·목표 입력 | 완료 | `/session/setup` | e2e `screens` | 없음 | — |

---

## 4. 게임 · 보상

| 기능 | 상태 | 화면 경로 | 테스트 | 알려진 오류 | 다음 작업 |
|---|---|---|---|---|---|
| 마감괴수 D-DAY (개인 HP 1000, 3단계) | 완료 | `/session/:id`, `/result/:id` | `damage.spec.ts`, `gameStore.spec.ts` | 보스 전용 이미지 에셋 없음(텍스트·바로 표현) | 보스 단계별 에셋 |
| 회복 → 특수 공격 (−40) | 완료 | `/session/:id` | `gameStore.spec.ts` (6) | 없음 | — |
| 완주 → 기본 공격 (−100) | 완료 | `/session/:id` | `finalizeSession.spec.ts` | 없음 | — |
| XP·잎사귀 단일 진입점 `applyReward` | 완료 | — | `rewards.spec.ts` (7) | 없음 | — |
| 동일 이벤트 id 중복 차단 | 완료 | — | `rewards.spec.ts`, `damage.spec.ts` | 없음 | — |
| 세션당 회복 XP 5회 상한 | 완료 | `/session/:id` | `rewards.spec.ts` | 없음 | — |
| 목표 완료 자기보고 보너스 | 완료 | `/result/:id` | e2e `screens` | 없음 | — |
| 콤보 · 가장 빠른 회복 | 완료 | `/session/:id`, `/result/:id` | `gameStore.spec.ts` | 없음 | — |
| 모드별(도서관/내 공간/팀플) 다른 괴물 | 미구현 | — | — | 보스 1종 고정 | 로드맵 Next |
| 둘 다 완주 시 최종 필살기 | 미구현 | — | — | `DAMAGE.bothCompleted = 150` 상수만 존재하고 호출되지 않음 | 친구 방 결과 화면과 함께 |
| 목표 완료의 보스 피해 | 미구현 | `/result/:id` | — | 목표 완료는 XP·잎사귀만 지급. `DAMAGE.goalCompleted = 30` 은 사용되지 않음 | 지급 여부 결정 후 연결 또는 상수 제거 |

---

## 5. 캐릭터 성장

| 기능 | 상태 | 화면 경로 | 테스트 | 알려진 오류 | 다음 작업 |
|---|---|---|---|---|---|
| 6단계 성장 (XP 파생, 하락 없음) | 완료 | `/growth`, `/`, 전 화면 | `growth.spec.ts` (15) | 없음 | — |
| 성장 타임라인 UI | 완료 | `/`, `/growth`, `/result/:id` | e2e `screens` | 없음 | — |
| 최근 획득 XP 5건 | 완료 | `/growth` | — | 자동 테스트 없음 | 단위 테스트 추가 |
| 세션 중 표현 상태 분리 | 완료 | `/session/:id` | `characterAssetManifest.spec.ts` (9) | 없음 | — |
| 상태별 캐릭터 이미지 | **부분 완료** | `/session/:id` | `character-assets.spec.ts` | **Lv.2/4/5/6 은 idle 만 존재.** warning·slouch·recover·attack 은 Lv.1·Lv.3 만 있고 나머지는 idle 로 폴백 | 4개 단계 × 4개 상태 에셋 제작 |
| 에셋 실패 폴백 (이미지 → idle → SVG) | 완료 | 전 화면 | `characterAssetManifest.spec.ts` | 없음 | — |
| 모션(WebM) 연출 | 미구현 | — | — | 파일 없음 | `18_ASSET_MANIFEST.md` 기준 제작 |

---

## 6. 상점

| 기능 | 상태 | 화면 경로 | 테스트 | 알려진 오류 | 다음 작업 |
|---|---|---|---|---|---|
| 첫 완주 후 잠금 해제 | 완료 | `/shop` | `shop.spec.ts` (7) | 없음 | — |
| 과잠 4종 · 백팩 3종 구매 | 완료 | `/shop` | `shop.spec.ts` | 없음 | — |
| 장착 · 해제 (각 1개) | 완료 | `/shop` | `shop.spec.ts` | 없음 | — |
| 중복 구매 · 포인트 부족 차단 | 완료 | — | `shop.spec.ts` | 없음 | — |
| 새로고침 후 유지 | 완료 | `/shop` | `persist.spec.ts` (4) | 없음 | — |
| 실제 의상 이미지 레이어 | **미구현** | `/shop`, `/growth` | — | 색 리본 + 아이콘 배지로만 표시 | 단계별 과잠·백팩 이미지 |
| 세션 설정 화면 캐릭터에 장착 반영 | 부분 완료 | `/session/setup` | — | 우측 미리보기가 `과잠·백팩 미장착` 으로 고정 표시 | `CharacterWithGear` 로 교체 |

---

## 7. 스트레칭

| 기능 | 상태 | 화면 경로 | 테스트 | 알려진 오류 | 다음 작업 |
|---|---|---|---|---|---|
| 6종 동작 | 완료 | `/stretch` | `recommend.spec.ts` (2) | 없음 | — |
| 모드별 가중 랜덤 · 직전 동작 제외 | 완료 | `/stretch` | `recommend.spec.ts` | 없음 | — |
| 일시정지 · 다시 · 다른 동작 · 건너뛰기 | 완료 | `/stretch` | e2e `screens` | 없음 | — |
| 완료 보상 (+20/+20, 시도별 1회) | 완료 | `/stretch` | `rewards.spec.ts` | 없음 | — |
| 안전 문구 | 완료 | `/stretch` | e2e `copy` | 없음 | — |
| 동작 도식 | 부분 완료 | `/stretch` | — | SVG 도식만. 3D 이미지·영상 없음 | 3D 스트레칭 이미지 |
| 종료 후 이동 경로 | **부분 완료** | `/stretch` | — | `건너뛰기`·`결과 보기` 가 `/result/demo` 로 이동 — 현재 세션 id 를 유지하지 않음 | 세션 id 전달 |

---

## 8. 기록 · 결과

| 기능 | 상태 | 화면 경로 | 테스트 | 알려진 오류 | 다음 작업 |
|---|---|---|---|---|---|
| 결과 화면 지표 (자세 점수 없음) | 완료 | `/result/:id` | e2e `screens`, `copy` | 친구 방 세션이어도 **개인 보스**만 표시 | 공동 결과 화면 |
| 세션 기록 목록 | 완료 | `/history` | `persist.spec.ts` | 없음 | — |
| 주간 출석 캘린더 | 완료 | `/`, `/history` | — | — | — |
| 출석 인정 조건 | **부분 완료** | `/history` | — | 구현은 **완주 세션만** 출석. 계획(FR-013)의 "10분 이상 진행" 미구현. `ATTENDANCE_MIN_MS` 상수 미사용, `markAttendance` 미호출 | 조건 확정 후 구현 또는 문서 정정 |
| 대시보드 오늘의 기록 | **부분 완료** | `/` | — | `집중` 값이 `0:00` 으로 하드코딩 | 오늘 날짜 기준 합산 |
| 대시보드 최근 세션 누적 | **부분 완료** | `/` | — | `완료 세션 수 × 25분` 으로 계산 — 15/50분 세션이 왜곡됨 | `sessionHistoryStore` 합산으로 교체 |
| 결과 공유 카드 | 미구현 | — | — | — | 로드맵 Later |

---

## 9. 설정 · 데이터

| 기능 | 상태 | 화면 경로 | 테스트 | 알려진 오류 | 다음 작업 |
|---|---|---|---|---|---|
| 감지 민감도 3단계 | 완료 | `/settings` | `classify.spec.ts` | 없음 | — |
| 소리 on/off | 부분 완료 | `/settings`, `/session/:id` | — | 토글 상태는 저장되나 **실제 사운드 파일이 없음** | 알림음 에셋 |
| PiP 자동 열기 토글 | 완료 | `/settings` | `pip.spec.tsx` (10) | 없음 | — |
| 카메라 확인 (장치 이름) | 완료 | `/settings` | 수동 확인 필요 | — | — |
| 개인 자세 기준 상태·재등록 | 완료 | `/settings` | — | — | — |
| 전체 데이터 초기화 | 완료 | `/settings` | `dataReset.spec.ts` | 없음 | — |
| localStorage v2 + 마이그레이션 | 완료 | — | `local.spec.ts` (8), `persist.spec.ts` | 없음 | — |
| 데모 값 저장 차단 | 완료 | — | `demoMode.spec.ts` (10) | 없음 | — |

---

## 10. PIP

| 기능 | 상태 | 화면 경로 | 테스트 | 알려진 오류 | 다음 작업 |
|---|---|---|---|---|---|
| Document PiP 미니 위젯 | 완료 | `/session/:id` | `pip.spec.tsx`, e2e `pip` | Chrome/Edge 116+ 에서만. 수동 확인 필요 | — |
| 미지원·차단 시 화면 안 위젯 폴백 | 완료 | `/session/:id` | `pip.spec.tsx` | 없음 | — |
| 세션 종료 시 자동 닫힘 | 완료 | `/session/:id` | `pip.spec.tsx` | 없음 | — |
| 카메라 영상 미포함 | 완료 | — | `pip.spec.tsx` | 없음 | — |
| `VITE_ENABLE_PIP` 플래그 연결 | **미구현** | — | `flags.spec.ts` | 플래그는 파싱되지만 **어디에서도 PiP 를 게이트하지 않음** — 값과 무관하게 동작 | 플래그 제거 또는 실제 연결 |
| 새로고침 후 PiP 복원 | 미구현 | — | — | 의도된 동작 | — |

---

## 11. 친구 방

| 기능 | 상태 | 화면 경로 | 테스트 | 알려진 오류 | 다음 작업 |
|---|---|---|---|---|---|
| 익명 인증 (회원가입 없음) | 완료 | `/room/new` | `room-live.spec.ts` | Supabase env 필요 | — |
| 방 생성 · 6자리 코드 · 초대 링크 | 완료 | `/room/new`, `/room/:code` | `rooms.spec.ts` (8) | 없음 | — |
| 최대 2명 · 준비 · 방장 시작 | 완료 | `/room/:code` | `room-live.spec.ts` | 없음 | — |
| Presence (준비/집중/자리비움) | 완료 | `/room/:code` | `room-live.spec.ts` | `participantId` dedupe 로 최신 메타만 유지 | — |
| Broadcast 성공 이벤트 | 완료 | `/session/:id` | `rooms.spec.ts` | 없음 | — |
| payload 검증 (금지 필드 차단) | 완료 | — | `rooms.spec.ts`, `room-live.spec.ts` | 없음 | — |
| 공동 보스 HP (DB 원자적 RPC) | 완료 | `/room/:code`, `/session/:id` | `room-live.spec.ts` | 없음 | — |
| 기린 싱크 (10초 · XOR 파생 id) | 완료 | `/session/:id` | `rooms.spec.ts`, `room-live.spec.ts` | 없음 | — |
| 스트레칭 공동 방어막 | 완료 | `/stretch` | `room-live.spec.ts` | 방어막이 보스 피해를 실제로 상쇄하지는 않음(표시용 누적) | 방어막 사용처 정의 |
| 응원 3종 | 완료 | `/room/:code` | e2e `screens` | 세션 화면에서는 보낼 수 없고 대기실에서만 가능. 스팸 제한 없음 | 세션 중 응원 · 쿨다운 |
| 30초 재연결 → 혼자 모드 | 완료 | `/room/:code` | 수동 확인 필요 | — | — |
| 방장 이탈 시 권한 이전 | 미구현 | — | — | 명세(`08 §9`)에 있으나 코드 없음 | — |
| running 상태 늦은 입장 처리 | 부분 완료 | `/room/new` | — | RPC 가 `room is not waiting` 으로 거절만 함 | 안내 문구 개선 |
| 공동 결과 화면 | 미구현 | — | — | 결과는 개인 보스만 표시 | 로드맵 Next |
| private Realtime 채널 | 미구현 | — | — | `realtime.messages` RLS 정책 부재로 표준 채널 사용 | 정책 추가 후 전환 |
| `VITE_ENABLE_REALTIME` 플래그 연결 | **미구현** | — | `flags.spec.ts` | 플래그는 계산되지만 **어디에서도 사용되지 않음** | 플래그 제거 또는 연결 |

---

## 12. 개발 도구

| 기능 | 상태 | 화면 경로 | 테스트 | 알려진 오류 | 다음 작업 |
|---|---|---|---|---|---|
| QA Lab 상태 주입 | Preview | `/lab` | `QaLab.spec.tsx` (7) | 운영 빌드에서는 라우트 자체가 등록되지 않음(의도) | — |
| Posture Debug 계기판 | Preview | `/lab`, `/calibration?postureDebug=1` | `QaLabHidden.spec.tsx` (3) | — | — |
| `window.__upright` dev API | Preview | 전 화면 | `qa-lab/devApi.ts` | QA Lab 플래그 필요 | — |

---

## 13. 접근성 · 반응형

| 기능 | 상태 | 화면 경로 | 테스트 | 알려진 오류 | 다음 작업 |
|---|---|---|---|---|---|
| 색 외 텍스트·아이콘 상태 표시 | 완료 | 전 화면 | e2e `copy` | 없음 | — |
| `prefers-reduced-motion` | 완료 | 전 화면 | `useReducedMotion.ts` | 자동 테스트 없음 | — |
| 1440 / 1280 레이아웃 | 완료 | 전 화면 | e2e `responsive.spec.ts` (두 뷰포트 × 주요 경로) | 없음 | — |
| 모바일 레이아웃 | 미구현 | — | — | 데스크톱 우선. 좁은 화면 미검증 | 로드맵 Later |
| 키보드 탐색 · 포커스 링 | 부분 완료 | 전 화면 | 수동 확인 필요 | 자동 검증 없음 | a11y 자동 점검 도입 |
| 200% 확대 | 부분 완료 | 전 화면 | 수동 확인 필요 | 자동 검증 없음 | — |

---

## 14. 캠퍼스 확장 (기획만)

| 기능 | 상태 | 화면 경로 | 테스트 | 알려진 오류 | 다음 작업 |
|---|---|---|---|---|---|
| 학교 선택 · 상징색 테마 | 미구현 | — | — | 기획만 존재 | [`CAMPUS_THEME_AND_TERRITORY_CONCEPT.md`](./CAMPUS_THEME_AND_TERRITORY_CONCEPT.md) §14 팀 결정 |
| 프로필 학교 배지 | 미구현 | — | — | 동 | 동 |
| 캠퍼스 협동전 · 영토전 | 미구현 | — | — | 동 | 동 |
| 대학 인증 | 미구현 | — | — | 동 | 동 |
| 시험기간·도서관 배경 | 미구현 | — | — | 동 | 동 |

---

## 15. 요약

| 구분 | 개수(대략) |
|---|---|
| 완료 | 50 |
| 부분 완료 | 14 |
| Preview | 3 |
| 미구현 | 17 |

**가장 먼저 손봐야 할 것 (영향도 순)**

1. 실카메라 임계값 튜닝 — 오탐이 나면 제품 신뢰가 무너집니다.
2. Lv.2/4/5/6 상태 에셋 — 성장의 체감이 약합니다.
3. 출석 인정 조건 확정 — 기획과 구현이 명백히 다릅니다.
4. 대시보드 집계 오류 2건(`0:00` 하드코딩, 25분 가정) — 사용자가 바로 보는 숫자입니다.
5. 스트레칭 종료 후 `/result/demo` 이동 — 결과가 비어 보입니다.
6. 미사용 플래그 2개 정리 — 문서와 코드의 불일치 원인입니다.

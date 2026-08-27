# AI_HANDOFF — 자세 판정·보상 기술 인수인계

> **작업 상태·남은 일·다음 단계는 [`CODEX_HANDOFF.md`](CODEX_HANDOFF.md) 로 옮겼습니다.**
> 이 문서는 **자세 판정 파이프라인과 보상 경로의 기술 상세**를 다룹니다.
> 시스템 구조·환경변수·배포는 [`ARCHITECTURE.md`](ARCHITECTURE.md) 를 보세요.
> 아래 "현재 상태 요약"은 v1.1.0 시점 기록이며, 최신 상태는 `CODEX_HANDOFF.md` §1 입니다.

> 마지막 갱신: 2026-07-28 · v1.1.0 릴리스 (main · 태그 `v1.1.0` · 커밋 `adc9c9b`)
>
> 이 문서의 수치는 **코드가 단일 기준**입니다. 값을 인용할 때는 반드시
> `src/constants/*` 와 `src/features/game/rewards.ts` 를 다시 확인하세요.

## 현재 상태 요약

- **Production**: https://upright-now.vercel.app
- **GitHub**: https://github.com/suhyunkim1105-hash/upright-now (main)
- 릴리스 태그: `v1.1.0` (main, adc9c9b) · RC 기록 `v1.1.0-rc.1` / `v1.1.0-rc.2`
- v1.0 구현: 카메라 자세 감지 · 캘리브레이션 · 회복 게임 · 세션/기록 ·
  성장 · 상점 · 설정 · 스트레칭 6종 · PIP 미니 위젯 · 친구 방(최대 10인)
- **v1.1 추가**:
  - **모드 시스템** — 기본 3종(도서관·내 공간·팀플) + 내 모드 최대 3개.
    소리 팩·연출·스트레칭 종류·괴물 테마·친구 기능·기준 프로필 연결
  - **경제 v2** — 세션 완주 보상을 길이별로 차등, 회복 25/5 등 재조정
  - **개인 괴물 4단계 장기 진행도** — 세션 간 HP 유지, 4단계 처치 후 순환
  - **유효 집중 공격** — 감지 가능 집중 5분마다 자동 피해(자세를 무너뜨리지
    않아도 진행)
  - **캠퍼스 테마·영토전** — 96 영토, 라이브 Supabase + Realtime
  - **사운드 팩** — Web Audio 합성음, 모드별 팩 선택
  - **세션 직접 설정** — 집중 5~120분 / 회복 휴식 0~30분
  - **승인 에셋 통합** — 캐릭터 6단계·괴물 3종 4phase·상점 레이어·스트레칭·지도
- 전체 테스트(v1.1.0 기준): lint 에러 0 · typecheck 통과 · **unit 415/415** ·
  **e2e 94/94**(라이브 room 포함) · assets:verify 112검사 missing 0 broken 0 ·
  build 통과
- 기존 프로젝트 `C:\Users\수현\Desktop\거부기탈출` 은 읽기 전용 참고. 수정 금지.

## 자세 판정 파이프라인 (시간 소유권 주의)

```
카메라 → usePoseDetection(12fps, numPoses 2)
→ analyzeLandmarks (core=코/눈+양어깨, optional=귀/엉덩이/z)
→ computeVotes (방향성 편차 / MAD tolerance / z 는 보조)
→ arbiterStep (★ 지속시간의 유일한 소유자: warning 1.5s · bad 5s · good 2s)
→ postureStore.setInstant → postureMachine (확정 bad 진입 "즉시" 회복 기회.
                                            여기서 5초를 다시 세지 않는다)
→ 회복 창 30s · good 5s → 성공 · 냉각 20s
→ PostureGameBridge → gameStore(전투) + applyReward(보상) + 친구방 reportRecovery
```

- 이탈 시작 → 회복 기회 = 총 5초. away/unstable 은 모든 타이머 동결.
- posture engine·calibration·recovery 타이밍·applyReward·finalize 구조는
  승인된 상태 — 필요 없이 재설계 금지.

## 보상 (단일 진입점 · 경제 v2)

- `features/game/rewards.ts` `applyReward({id, sessionId, type})` 만 XP/포인트 적립
  + `recentXp` 최근 5개 기록
- 행동 보상 (`constants/game.ts` `REWARD`):
  회복 성공 **XP 25 · 5P** (세션당 XP 보상 5회 상한 `MAX_REWARDED_RECOVERIES`) ·
  스트레칭 완료 **10 · 10P** · 목표 완료 **15 · 10P** ·
  친구 공동 완주 보너스 **20 · 10P**
- 세션 완주는 **길이별** (`sessionCompletionReward(plannedMin)`):

  | 계획 길이 | XP | 포인트 |
  |---|---|---|
  | 5분 미만 | 0 | 0 |
  | 5~14분 | 20 | 10 |
  | 15~29분 | 60 | 30 |
  | 30~49분 | 80 | 40 |
  | 50분 이상 | 120 | 60 |

  (`REWARD.sessionCompleted` 60/30 은 15~29분 구간 기본값 — 실제 지급은 위 함수)
- 종료는 `finalizeSession` 만: 완료 인정 = 타이머 종료 또는 `COMPLETION_RATIO`
  0.8 이상. 중도 종료 = 기록만, 보상·출석 0. 출석 인정 최소 10분
  (`ATTENDANCE_MIN_MS`).

## 괴물 (개인 4단계 + 공동)

- 피해량 `constants/game.ts` `DAMAGE`: 회복 **40** · 세션 완주 **100** ·
  기린 싱크 **60** · 양측 완주 **150** · 목표 완료 **30** ·
  유효 집중 **20**(`FOCUS_ATTACK_INTERVAL_MS` 5분마다)
- 개인 괴물 `MONSTER_PHASE_HP` = **600 / 900 / 1300 / 1800**.
  `monsterProgress` 가 세션 간 HP·phase 를 보존하고, `monsterBridge` 가
  세션 시작 시 gameStore 보스에 로드 → 피해를 진행도에 반영 → 처치 시 진화
  (4단계 처치 후 1단계로 순환). 데모·1분 점검·친구 방 세션은 진행도 미반영.
- `BOSS_MAX_HP` 1000 은 gameStore 초기·reset 기본값(및 QA Lab 기준)일 뿐이며,
  개인 세션의 실제 표시 HP 는 위 phase HP 로 교체됩니다.
- 친구 방 공동 괴물은 `ROOM_BOSS_MAX_HP` **2000** (아래 친구 방 절 참조).

## 상점·성장 (Gate 1)

- `constants/storeItems.ts`: 과잠 4종 각 **240P**(네이비·버건디·포레스트·코랄) ·
  백팩 3종 각 **180P**(새내기·도서관·팀플) ·
  특별 아이템 **황금 과잠 400P · 은하 백팩 350P**(`SPECIAL_ITEMS`, 같은 배열에 push)
- progressionStore: `purchaseItem(중복·부족 차단)` · `equipItem(과잠/백팩 각 1개)`
- 잠금: 첫 정상 세션 완료(`shopUnlocked`) 전에는 상점 잠김
- `CharacterWithGear` 가 stage 별 승인 레이어를 실제로 겹칩니다
  (백팩 back → 캐릭터 → 과잠 → 백팩 front, 특별 아이템은 mask+gradient).
  상점 카드는 구매 전에도 착용 미리보기를 렌더하며 store 를 변경하지 않습니다.
  이미지 로드 실패 시에만 기존 색 리본·아이콘 배지로 폴백합니다.
- 성장 단계는 XP 파생(`xpToStage`) — stage 별도 저장 금지.
  필요 XP: 뽀각 거북 **0** · 꿈틀 거북 **250** · 빼꼼 거부기린 **600** ·
  반듯 거부기린 **1000** · 쭉쭉 기린 **1500** · 우뚝 기린 **2200**

## 세션·모드

- 프리셋 길이 (`constants/session.ts`): 25분+2분(기본) · 15분+1분 ·
  50분+5분 · 3분 데모+1분. 직접 설정은 집중 5~120분(5분 단위) ·
  회복 휴식 0~30분 (`clampCustomFocusMin` / `clampCustomRestMin`).
- 모드 (`features/modes/modeStore.ts`) — 기본 3종은 아래 설정이 고정입니다.

  | 모드 | 소리 팩 | 연출 | 스트레칭 | 괴물 | 친구 기능 |
  |---|---|---|---|---|---|
  | 도서관 | silent | low | seated | 북몽이 | 없음 |
  | 내 공간 | soft | rich | full | 늘몽이 | 없음 |
  | 팀플 | social | default | mixed | 꼬몽이 | 있음 |

  내 모드는 최대 **3개** (`MAX_CUSTOM_MODES`), 위 항목 + 기준 프로필 연결 ·
  길이(focusMin/restMin)를 직접 지정합니다.

## 친구 방 (라이브 검증 완료 — Production 활성)

- `features/rooms/`: roomService(익명 인증·RPC·Presence·Broadcast·30s 재연결) ·
  roomStore · giraffeSync(10s 창, 이벤트 재사용 금지) · roomEvents(payload 검증)
- 공동 보스 HP 2000, 회복 -40 · 완주 -100 · 기린 싱크 -60 · 스트레칭 방어막 +15
- HP 는 DB `rooms.boss_hp` 가 최종 기준, `apply_room_damage`/`apply_room_shield`
  RPC 로만 원자적 변경 (event_id 중복 차단)
- 전송 금지: 영상·프레임·랜드마크·좌표·bad 상태 — `sanitizeRoomEvent` 가 차단
- **활성화 절차 (env 만 넣으면 끝)**:
  1. Supabase 프로젝트 생성 → Authentication 에서 Anonymous Sign-Ins 켜기
  2. SQL Editor 에서 `supabase/schema.sql` 전체 실행 (boss 2000·shield 포함)
  3. Vercel(Production) + 로컬 `.env.local` 에 env 3개:
     `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` · `VITE_ENABLE_FRIEND_ROOM=true`
  4. 라이브 2인 검증: `npx playwright test e2e/room-live.spec.ts`
     (두 독립 컨텍스트로 생성→입장→준비→시작→HP 동기화→기린 싱크→금지 payload 0건을
      자동 검증. env 없으면 자동 skip)
- env 없이도 혼자 모드 전 기능 정상 (테스트로 보장)

## 저장 (localStorage v2)

- `upright-now:{user,progression,calibration,sessions}` · 데모 값 저장 금지
- v1→v2 마이그레이션: 데모 시드만 초기화, 획득 데이터 보존
- 전체 초기화: `features/settings/dataReset.ts` (설정 화면, 확인 모달)

## 플래그·도구

- Production env (2026-07-28 실제 상태): `VITE_SUPABASE_URL` ·
  `VITE_SUPABASE_ANON_KEY` · `VITE_ENABLE_CAMERA` · `VITE_ENABLE_FRIEND_ROOM` ·
  `VITE_ENABLE_REALTIME` · `VITE_ENABLE_CAMPUS_THEME` ·
  `VITE_ENABLE_CAMPUS_TERRITORY` · `VITE_ENABLE_CAMPUS_SUPABASE` ·
  `VITE_ENABLE_QA_LAB=false` — **`VITE_ENABLE_PIP` 만 미설정**이라
  운영에서 PIP 자동 열기가 꺼져 있습니다(코드 기본값 false).
- Preview: `VITE_ENABLE_QA_LAB=true` 로 /lab(상태 주입 + Posture Debug 계기판),
  `/calibration?postureDebug=1` 오버레이, `window.__upright`
- 배포는 **반드시 `npx vercel deploy`(클라우드 빌드)**. env 가 sensitive 라
  `vercel pull` 은 `[SENSITIVE]` 플레이스홀더만 받으므로 로컬 prebuilt 를
  올리면 깨진 번들이 배포됩니다.

## 검증

```
npm run lint / typecheck / test / test:e2e / build
npm run assets:verify   # 승인 에셋 112건 존재·무결성
```
unit 415 + e2e 94 통과(라이브 2인 room 포함). e2e 는 이중 dev 서버 —
5283(캠퍼스 OFF 회귀) / 5284(캠퍼스 ON).

## 실카메라 수동 확인 필요 (Claude 환경에서는 검증 불가)

- 정면 편안한 자세 30초 good 유지
- 귀 가림·엉덩이 화면 밖에서도 측정 지속(limited)
- 앞으로 숙여 5초 → 회복 기회, 복귀 5초 → 보상
- PIP 자동 열림(Chrome 116+)
- 두 브라우저 실기기 친구 방

## 알려진 비차단 이슈 / 다음 작업

1. 실카메라 임계값(tolerance 바닥값·yaw 0.7)은 합성 데이터 기준 — 실기기 튜닝 필요
2. 친구 방 실환경 노트: presence 메타는 participantId 로 dedupe(최신 우선), 기린 싱크 피해는 두 회복 uuid 의 XOR 파생 id 사용(원본 id 재사용 시 dedup 충돌), realtime.messages RLS 정책이 없어 표준(비 private) 채널 사용 — 정책 추가 시 private 전환 가능
3. `VITE_ENABLE_PIP` 가 Production 에 없어 운영에서 PIP 자동 열기가 꺼져 있음
   (켜려면 Vercel Production 에 `VITE_ENABLE_PIP=true` 추가 후 재배포)
4. 모바일 375px 에서 사이드바 캐릭터 figure 가 약 14px 가로 오버플로
   (지원 폭 768/1280/1440 은 정상 — 데스크톱 우선 제품이라 보류)
5. 모션 WebM 미보유(정적 WebP + CSS 연출로 대체) · Lv.2/4/5/6 전용 상태 컷 없음
6. recovery_started 토스트 카피("돌아오는 중이에요") 검토

## fix/core-session-flow — 모드·캘리브레이션·협동 흐름 (2026-07-26)

### 확정: 모드별 마감 괴물
- 도서관 모드 = 책더미 괴물 **북몽이** (`bookmong`)
- 내 공간 모드 = 늘어짐 괴물 **늘몽이** (`neulmong`)
- 팀플 모드 = 팀플 괴물 **꼬몽이** (`komong`) — 친구 방 세션은 항상 꼬몽이
- 매핑은 `src/features/modes/modeStore.ts` 의 `MONSTER_THEMES` 가 단일 출처.
- 모드(기본 3종 + 내 모드 최대 3개)는 소리 기본값·연출 강도·스트레칭 추천·
  친구 기능·괴물 테마만 바꾼다. **자세 판정 임계값·XP·기록·성장은 모드와
  무관하며, 모드 변경 시 절대 초기화되지 않는다.**

### 보류: 캠퍼스 테마 (별도 스프린트)
다음 항목은 이번 범위에서 구현하지 않고 별도 스프린트로 미룬다:
학교 선택, 학교 상징색, 프로필 배지, 과잠·백팩 아이템, 시험기간·도서관 배경,
결과 공유 카드. 구현하더라도 **캠퍼스 테마는 자세 판정·보상·난이도를
절대 바꾸지 않는다** (표시 전용).

### 캘리브레이션 v3 완료 조건 (전부 충족해야 완료)
카메라·프레이밍 체크 1.5초 → 실시간 벽시계 5.0초 안정 + 유효 표본 ≥40 +
1초 버킷 5칸 각각에 유효 표본 ≥1. 빠른 프레임 40장이 5초 전에 모여도
완료되지 않는다 (`src/features/calibration/collect.spec.ts` 로 증명).
프로필은 다중 저장(`profiles[]` + `activeProfileId`)이며 요약 통계만 담고
원본 좌표·프레임은 저장하지 않는다.

### Supabase 수동 마이그레이션 필요 (라이브 DB)
`supabase/migrations/20260726_expand_room_duration.sql` 전체를 SQL Editor 에서
실행 — rooms.duration_seconds CHECK 와 create_room 의 duration 검증을
IN-목록에서 `between 180 and 7200` 범위로 변경한다 (멱등 — 여러 번 실행 안전,
rollback SQL 은 파일 하단 주석). 실행 전까지 라이브 방은 15/25/50분 외
사용자 지정 길이를 거부한다.

## fix/core-session-flow — 모드 실연결·사운드·프레이밍 게이트 (2026-07-26 추가)

- **모드 = 단일 유효 설정**: `useEffectiveModeConfig`(=useActiveModeConfig)가
  soundPack(silent/soft/social)·ambient(low/default/rich)·stretch(seated/mixed/full)·
  friendFeatures·monsterTheme·연결 자세 기준·내 모드 기본 시간을 공급한다.
  자세 판정 임계값은 모드와 무관 (불변).
- **사운드**: `src/features/sound/soundEngine.ts` 가 Web Audio 합성음의 단일
  출처. `SOUND_MANIFEST` 의 `file: null` 자리를 채우면 실제 음원으로 교체
  가능(호출부 불변). 전역 소리 OFF > 팩 필터 > 사용자 제스처(AudioContext)
  > 250ms 중복 방지 순. 트리거는 `soundTriggers.ts` 한 곳에서 구독.
- **캘리브레이션 프레이밍 게이트**: `framingGate.ts` — 눈선·어깨선 roll 18°,
  눈-어깨 수직 관계, safe area. 의료 기준이 아니라 "안정적인 기준 등록
  프레이밍 조건". hard invalid 는 표본 전체 폐기 + 1.5초 프레이밍부터 재시작.
  세션 판정 임계값은 건드리지 않음.
- **Preview 환경**: Vercel Preview 에 VITE_ENABLE_FRIEND_ROOM/REALTIME/CAMERA
  =true + Supabase URL/ANON_KEY 등록됨 (Production 미변경).

## integration/v1.1-all-features — 통합 Release Candidate (2026-07-27)

- **구성**: fix/core-session-flow(fe7d86d, 코어 전체) + feat/campus-territory-prototype
  (346e272, 캠퍼스 테마·영토전 프로토타입) 를 `--no-ff` 병합.
  (당시 상세 기록이던 `docs/INTEGRATION_STATUS.md` 는 릴리스 후 정리했습니다.
  필요하면 git 이력에서 볼 수 있습니다.)
- **충돌 원칙**: 코어 우선 + 캠퍼스 기능 전부 보존(union). 병합 직후 잡은
  결함: Stretch attemptIdRef 컴파일 오류(P0), 캠퍼스 기여 브리지의
  감지 0초/sticky room 오지급(P1 2건), 전체 초기화의 모드 스토어 누락(P1),
  캠퍼스 스펙 2건의 결과 화면 가드 미반영(P1) — 모두 수정 커밋됨.
- **캠퍼스 계약**: 캠퍼스는 표시·기여 전용. 자세 판정·XP(applyReward)·보상
  경로를 절대 건드리지 않는다. 기여는 recordCampusContribution 단일 진입 +
  eventId 중복 차단. mock 저장소는 서버 역할이라 로컬 초기화 후에도 eventId
  기억(중복 적립 방지) — 의도된 동작.
- **e2e**: 이중 dev 서버 — 5283(캠퍼스 OFF, 기존 회귀·OFF 회귀) /
  5284(캠퍼스 ON, mock). room-live 는 5283 + .env.local Supabase 로 라이브 검증.
- **Preview 플래그**: 카메라·친구방·Realtime·캠퍼스 테마/영토전 ON,
  campus Supabase OFF(mock), QA Lab OFF. Production 미변경.
- main 병합·Production 배포·campus SQL 실행은 모두 사용자 승인 대기.

## v1.1.0-rc.1 — RELEASE FREEZE (2026-07-27)

- **라이브 SQL 4건 적용 완료** (사용자가 직접 실행, 재실행 금지):
  20260726_expand_room_duration · 20260726_room_lifecycle_security ·
  20260727_campus_realtime_v2 · 20260727_room_presence_cleanup.
  활성 시즌 season-15, Preview 는 CAMPUS_SUPABASE=true(라이브).
- **PostgREST 캐시 주의**: 직접 RPC 목록 반영은 schema cache 상태에 따라
  늦을 수 있음. 앱은 `is_room_member` 를 직접 RPC 로 호출하지 않으며,
  `cleanup_stale_members` 내부 게이트로 정상 동작 확인됨.
- **Realtime 검증**: campus_territories/…_events postgres_changes 라이브
  수신 확인. 구독 클라이언트는 인증 JWT 필요(RLS) — 표준 앱 클라이언트는
  자동. 자체 스크립트로 검증할 땐 `realtime.setAuth(token)` 필수.
- **배포**: Vercel env 가 sensitive 라 `vercel pull` 은 [SENSITIVE]
  플레이스홀더만 받음 → 로컬 prebuilt 금지, 항상 `npx vercel deploy`
  (클라우드 빌드). `.vercelignore` 가 로컬 개인 파일 업로드를 차단.
- **당시 미해결 항목**: Production env 에 캠퍼스·Realtime 플래그 미설정,
  실카메라 임계값 실기기 미검증, 스모크 테스트 데이터 정리 SQL 실행.
  (이후 진행 상황은 `docs/TEAM_START.md` §9 가 최신 기준입니다.)
- main 병합·Production 배포는 v1.1.0-rc.1 수동 검증 승인 후.

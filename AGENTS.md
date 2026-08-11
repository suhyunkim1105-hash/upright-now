# AGENTS.md — AI 코딩 에이전트 구현 계약

## 0. 문서 목적

이 문서는 Claude Code·Codex가 UpRight Now를 구현할 때 제품 방향, 개인정보 경계, 화면 디자인을 임의로 바꾸지 않도록 하는 최상위 작업 계약입니다.

## 1. Source of truth

아래 순서로 문서를 우선합니다.

1. `AGENTS.md`
2. `docs/TEAM_START.md` (현재 기준 값·폴더 지도·협업 규칙)
3. `docs/archive/02_PRD.md`
4. `docs/archive/03_USER_FLOW.md`
5. `docs/archive/06_POSTURE_ENGINE_SPEC.md`
6. `docs/archive/07_GAME_SYSTEM_SPEC.md`
7. `docs/archive/08_SOCIAL_ROOM_SPEC.md`
8. `docs/14_DATA_PRIVACY_SECURITY.md`
9. `docs/archive/05_SCREEN_SPEC.md`
10. `docs/archive/12_DESIGN_SYSTEM.md`
11. `docs/archive/15_TECHNICAL_ARCHITECTURE.md`
12. 현재 코드와 테스트

`docs/archive/` 문서의 수치는 초기 기획 시점 값입니다.
숫자가 다르면 코드(`src/constants/`)와 `docs/TEAM_START.md` 가 우선입니다.

이 패키지 이전의 `기린이 되자!`, `Zarafa`, 30분 세션, 3단계 성장, 자세 바통 중심 문서는 구현 기준이 아닙니다.

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
- 자세가 흐트러졌다고 캐릭터가 이전 레벨로 퇴화하지 않습니다.

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

## 7. Supabase 규칙

- 사용자 화면에는 회원가입을 요구하지 않습니다.
- 친구 방 진입 시 `signInAnonymously()`를 사용합니다.
- Presence는 준비·집중·자리 비움처럼 느리게 바뀌는 상태에 사용합니다.
- Broadcast는 회복·스트레칭·응원처럼 순간 이벤트에 사용합니다.
- 허용 이벤트 스키마 밖의 데이터는 전송하지 않습니다.
- RLS를 활성화하고 방 멤버만 private channel에 접근하도록 합니다.
- 서비스 역할 키를 프론트엔드에 넣지 않습니다.

## 8. 빌드와 테스트

작업 완료 전 아래를 실행합니다.

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

가능하면 Playwright로 아래 경로를 검증합니다.

- 첫 방문 → 닉네임 → 프로필 → 캘리브레이션 → 3분 데모
- bad → good 회복 → 공격
- away·unstable
- 스트레칭 건너뛰기
- 결과·출석·포인트
- 상점 구매·장착
- 2개 브라우저의 친구 방

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
- 자유 채팅 추가
- 한 번에 전체 앱을 재작성
- 테스트 실패 상태를 완료로 보고

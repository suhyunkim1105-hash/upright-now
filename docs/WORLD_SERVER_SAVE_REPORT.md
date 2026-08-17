# 야간 작업 보고 — 세션 기록 서버 저장 + 코인 단일화

**브랜치** `feat/world-server-save` (기반: `feat/girin-campus-openworld`)
**날짜** 2026-08-16
**커밋** `dd6d0e3` — 8개 파일, +731 / −17

---

## 1. 테이블 구조

마이그레이션 파일: `supabase/migrations/20260816_world_sessions_and_coins.sql`
**실제 프로젝트(`upright-now`, obwzfoiplcjzrewdmlyw)에 적용까지 마쳤습니다.**

### `world_sessions` — 세션 1회 = 1행

| 열 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | **클라이언트가 만듭니다.** 재전송해도 행이 두 번 안 생기게 |
| `user_key` | uuid | `auth.uid()` 기본값 |
| `school` | text | 최대 80자로 잘라 저장 |
| `seated_minutes` | int | 0~1440 체크 |
| `campus_minutes` | int | 0~1440 체크 |
| `recoveries` | int | 0~1440 체크 |
| `started_at` / `ended_at` | timestamptz | `ended_at >= started_at` 체크 |
| `created_at` | timestamptz | |

인덱스: `(user_key, started_at desc)` — 스트릭 계산과 마이페이지 조회가 이걸 씁니다.

### `world_coins` — 사용자당 1행

| 열 | 타입 | 비고 |
|---|---|---|
| `user_key` | uuid PK | |
| `balance` | int | `>= 0` 체크 |
| `daily_earned` | int | KST 날짜가 바뀌면 0부터 |
| `last_earned_date` | date | |
| `claimed_milestones` | int[] | 받은 출석 마일스톤. **없으면 스트릭 유지 중 매일 다시 받습니다** |
| `minigame_date` / `minigame_done` | date / text[] | 게임별 하루 1회 판정 |

### RLS — 읽기만 열고 쓰기는 아예 안 엽니다

```sql
create policy world_sessions_select_own ... using (user_key = (select auth.uid()));
create policy world_coins_select_own    ... using (user_key = (select auth.uid()));
revoke insert, update, delete on ... from anon, authenticated;
```

**쓰기 정책을 만들지 않은 것이 핵심입니다.** 정책이 없으면 REST 로
`PATCH /world_coins?...{"balance":999999}` 를 보내도 403 입니다. 쓰기는
`security definer` 함수 두 개만 합니다.

- `world_finish_session(...)` — 세션 행 insert + 완주·회복·출석 코인 지급
- `world_earn_minigame(game)` — 게임별 하루 1회 +10
- `world__grant(user, amount)` — 하루 상한 300을 적용하는 내부 헬퍼
  (`authenticated` 에서 execute 회수 — 클라이언트가 직접 못 부릅니다)

미니게임 이름은 함수 안에 못박았습니다(`neck|escape|egg-catch|egg-merge|stack`).
아무 문자열이나 받으면 "게임"을 무한히 만들어 상한까지 긁어 갈 수 있습니다.

---

## 2. 민철님 브랜치(`feat/girin-session-retro`)와 겹친 부분

작업 전 `git log`/`git diff` 로 확인한 결과, **그쪽 구조를 그대로 따랐습니다.**

| 항목 | 처리 |
|---|---|
| `prototypes/shared/config.example.js` | 민철님 파일을 **그대로 복사**했습니다(내용 동일). 두 브랜치가 병합될 때 충돌이 나지 않습니다 |
| `.gitignore` 의 `prototypes/shared/config.js` | 민철님과 **같은 줄**을 추가했습니다 (`artifact.html` 줄까지 동일하게) |
| Supabase 접근 방식 | 민철님 `shared/school-auth.js` 와 같이 **SDK 없이 fetch 로 REST 직접 호출**. 프로토타입은 빌드가 없어 CDN SDK 를 끌어오면 단일 HTML 전제가 깨집니다 |
| 로그인 세션 | 민철님이 쓰는 `localStorage['girin.session']` 을 **먼저** 읽습니다. 학교 이메일 로그인이 살아 있으면 그 토큰을 쓰고, 없을 때만 익명 로그인을 만듭니다 — 그래야 한 사람의 기록이 한 uid 로 모입니다 |
| `prototypes/openworld/index.html` | **양쪽 다 고칩니다.** 민철님은 세션·회고 UI, 저는 코인·저장 배선입니다. 병합 시 충돌 예상 지점은 아래 참조 |

### 병합 시 충돌 예상 지점 (`index.html`)

민철님 브랜치는 이 파일을 5059줄 규모로 크게 고쳤습니다. 제가 손댄 곳은
**모두 코인·저장 관련 함수 주변**입니다.

1. `const COIN = {...}` — `perMinigame`, `dailyCap` 두 줄 추가
2. `function earn()` — 하루 상한 적용
3. `applyServerBalance()` / `earnMinigame()` — 새 함수 2개 (`spend()` 바로 뒤)
4. 미니게임 5곳의 `earn(5, ...)` → `earnMinigame('<id>', ...)`
5. `endSession()` — `WORLD_SAVE.finishSession()` 호출 블록 추가
6. 코인 패널 표 — 미니게임·하루 상한 행 2개 추가
7. 파일 끝 `<script src="../shared/config.js">` + `<script src="save.js">`

민철님 브랜치의 `endSession()` 은 `RW.session` 리셋과 회고 패널을 다루는데
제 추가분(서버 전송)은 **`girin.sessions` 저장 직후**에 들어가므로, 두 변경은
같은 함수 안에서 줄이 겹칠 수 있습니다. **병합 시 제 블록을 민철님 구조
안으로 옮기면 됩니다** — 의존하는 것은 `SESSION.seatedMs`, `LIVE.recoveries`,
`ROOM.school` 셋뿐입니다.

민철님이 새로 만든 회고 코인(`award('retro', ...)`, 세션당 3P)은
**제가 건드리지 않았습니다.** 연우안에 없는 항목이라 판단을 미뤘습니다 —
아래 §4 참조.

---

## 3. 검증 결과

### 서버 (REST 직접 호출, 익명 계정 2개로)

```
PASS  세션 저장+지급 (32분·회복7 → 완주40 + 회복 min(7,5)×5=25 = 65)
PASS  재전송 멱등 (같은 id → duplicate:true, +0)
PASS  world_sessions 에 행 1개 (school·분·횟수 그대로)
PASS  미니게임 neck +10 → 잔액 75
PASS  미니게임 neck 같은 날 두 번째 +0
PASS  허용 목록 밖 게임 이름은 거절 (unknown game)
PASS  RLS: B 계정이 보는 world_sessions = 0행
PASS  RLS: B 계정이 보는 world_coins = 0행
PASS  비로그인 anon 키로는 0행
PASS  잔액 직접 PATCH → 403
PASS  조작 시도 후에도 잔액 그대로
PASS  하루 상한 300 에서 정지
                                            13 pass / 0 fail
```

### 브라우저 (localhost:8166, 실제 Supabase 연결)

```
PASS  save.js 부팅 → 익명 로그인 생성, configured:true
PASS  17분 세션 종료 → 서버가 30(로컬 낙관) → 40(서버 정정)으로 교정
PASS  새로고침 후 코인 유지 (ROOM.coins 40, 화면 칩 "40")
PASS  오프라인(fetch 차단) 세션 → 큐에 1건 적재
PASS  온라인 복귀 후 flush → 큐 0건, 잔액 50 반영
PASS  미니게임 첫 호출 +10 / 같은 날 두 번째 0, 서버·로컬 모두 60
```

### 코인 규칙 (`src/constants/coin.ts`)

```
vitest run src/constants/coin.spec.ts   →  Test Files 1 passed / Tests 6 passed
```

규칙 함수 직접 평가로도 교차 확인: **21 pass / 0 fail**.

### lint

`oxlint` — **오류 0**. 초기에 제 `save.js` 에서 나온 2건(no-shadow, eqeqeq)은
고쳤습니다.

### 돌리지 못한 검사

`npm run typecheck` / `build` — **환경 문제로 불가**.
작업 중 디스크가 가득 차(0바이트) `npm ci` 가 ENOSPC 로 중단됐습니다.
정리 후 8GB 를 회수했지만, 그 사이 원본 트리의 `node_modules` 가 다른
프로세스에 의해 재설치되면서 `.bin/tsc` 심(shim)이 사라진 상태입니다.

typecheck 를 처음 돌렸을 때 나온 오류는 전부 `TS2307 Cannot find module`
(zod·@google/genai·@langfuse/client·genkit) 이었습니다 — **설치 누락이지
제 변경 때문이 아닙니다.** 제가 만든 `coin.ts`·`coin.spec.ts` 는 오류 목록에
등장하지 않았고, vitest 가 같은 파일을 TS 로 변환해 통과시켰습니다.

전체 유닛 스위트(`npm run test`)는 **의도적으로 중단했습니다.** 디스크가
다시 0에 가까워지고 있었고, `src` 안에서 `coin.ts` 를 import 하는 파일이
`coin.spec.ts` 하나뿐이라(확인함) 나머지 spec 은 제 변경의 영향을 받지
않습니다. 디스크를 지키는 쪽을 택했습니다.

> `npm ci` 가 끝난 환경에서 `npm run typecheck && npm run test && npm run build`
> 를 한 번 확인해 주세요. 제가 설치 중 만든 1.5GB 부분 설치본과 npm 캐시는
> 지웠습니다(디스크 0 → 8GB 회수). 검사에 쓴 `node_modules` 정션도
> 제거해 원본 트리는 건드리지 않은 상태입니다.

---

## 4. 결정한 기본값 (질문 대신 정한 것들)

| # | 사안 | 정한 것 | 이유 |
|---|---|---|---|
| 1 | `user_key` 의 정체 | `auth.uid()` (익명 로그인 또는 학교 이메일 로그인) | "익명키"를 클라이언트가 만든 임의 문자열로 두면 RLS 가 아무것도 못 막습니다. 남의 키를 넣으면 남의 행이 보입니다. `rooms` 가 이미 익명 로그인을 쓰고 있어 방식도 일관됩니다 |
| 2 | 코인 지급 주체 | **서버가 계산**, 로컬은 표시만 | 지시대로입니다. 로컬 `earn()` 은 즉시 반응용(낙관적 표시)으로 남기고, 서버 응답이 오면 그 값으로 덮어씁니다 |
| 3 | 오프라인 재전송의 중복 방지 | 세션 `id` 를 **클라이언트가 uuid 로 생성** | 서버가 id 를 만들면 재전송이 새 행이 됩니다. `on conflict (id) do nothing` + `if not found` 로 두 번째 요청은 지급 없이 잔액만 돌려줍니다 |
| 4 | 하루 상한 300의 적용 위치 | `world__grant()` 한 곳 | 지급 경로가 셋(완주·회복 / 마일스톤 / 미니게임)이라 각자 세면 어긋납니다 |
| 5 | 날짜 경계 | 전부 **KST**(`now() at time zone 'Asia/Seoul'`) | 프로토타입이 이미 `kstDateKey()` 로 KST 를 씁니다 |
| 6 | 완주 구간 상한 | 120분 초과도 **60P** | "50-120분 60P" 라 120분 초과가 지시에 없습니다. 0으로 떨어뜨리면 오래 앉을수록 손해라 이상합니다 |
| 7 | "오늘 목표 +10" / "공동 완주 +10" | **`coin.ts` 에 값만 정의, 지급 배선은 안 함** | 월드에 "오늘 목표"·"공동 완주" 기능 자체가 아직 없습니다. 없는 기능에 지급 코드를 미리 넣지 않았습니다 |
| 8 | 출석 스트릭 계산 | 서버가 `world_sessions` 를 **역순 60일까지** 조회 | 마일스톤이 60일까지뿐이라 그 뒤는 셀 이유가 없습니다. 로컬 `girin.attend` 는 표시용으로 남습니다 |
| 9 | 미니게임 코인 | 게임별 하루 1회 **+10** (기존 세션당 1회 +5에서 변경) | 지시(§3)대로입니다. 화면 문구도 "+5P" 고정에서 실제 지급액으로 바꿨고, 이미 받은 날은 "오늘 몫은 이미 받았어요"로 표시합니다 |
| 10 | 민철님의 회고 코인(+3) | **건드리지 않음** | 연우안 목록에 없는 항목입니다. 지우는 것도 남기는 것도 결정이라, 남의 브랜치의 새 기능이므로 민철님·연우님이 정할 일로 뒀습니다 |
| 11 | `src/constants/coin.ts` 의 기존 함수 | `dailyCoins`·`daysToAfford`·`perMinute`·`firstSessionOfDay` **삭제** | 분당 적립과 첫 세션 보너스가 연우안에 없습니다. `src` 안에서 이 파일을 import 하는 곳은 `coin.spec.ts` 뿐이라(확인함) 지워도 깨지는 곳이 없습니다 |

> **main 병합 시 `coin.ts`·`coin.spec.ts` 는 "양쪽 추가" 충돌이 납니다.**
> 기반 브랜치(`feat/girin-campus-openworld`)에는 이 파일이 없고 `main` 에는
> 있기 때문입니다. **제 쪽 내용을 채택하면 됩니다** — 두 파일이 짝이라
> 함께 바뀌어야 하고, main 의 `coin.spec.ts` 는 제가 지운 함수들
> (`dailyCoins`·`daysToAfford`)을 import 하므로 한쪽만 남기면 깨집니다.
| 12 | 격리 작업 방식 | `.claude/worktrees/` 에 **별도 worktree** | 작업 중 원본 트리에 제가 만들지 않은 변경이 실시간으로 들어왔습니다(말풍선·튜토리얼·이름표 hover 등). 그대로 커밋하면 남의 WIP 가 섞입니다 |

---

## 5. 남은 일 / 주의

1. **`npm ci` 후 test·build 확인** — 디스크 여유 확보 필요 (§3).
2. **`prototypes/shared/config.js` 는 각자 만들어야 합니다.**
   `config.example.js` 를 복사하고 Supabase 대시보드의 URL·anon 키를 넣으세요.
   `.gitignore` 에 있어 커밋되지 않습니다. `file://` 로 열면 CORS 로 막히니
   http 로 띄워야 합니다(`.claude/launch.json` 의 `openworld-worldsave`, 8166 포트).
3. **민철님 브랜치와 병합 시** `index.html` 의 `endSession()` 주변을 확인해
   주세요 (§2).
4. **`src/` 의 나머지는 손대지 않았습니다.** 마이페이지·설정·초대코드·학교인증
   모두 그대로입니다. `src/constants/coin.ts`·`coin.spec.ts` 두 파일이 전부입니다.
5. **카메라 관련은 변한 것이 없습니다.** 서버로 나가는 것은 분 단위 합계와
   횟수, 학교 이름뿐입니다. 프레임·랜드마크 좌표·개인 기준은 아무것도
   전송하지 않습니다.

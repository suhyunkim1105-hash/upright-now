# TEAM_START — 팀원 시작 안내서

UpRight Now 저장소를 처음 받았다면 **이 문서 하나만 읽으면 시작할 수 있습니다.**

> 이 문서의 숫자는 모두 코드에서 확인한 실제 값입니다(2026-07-28 기준).
> 숫자가 헷갈리면 언제나 `src/constants/` 안의 코드가 정답입니다.
> 초기 기획 문서는 `docs/archive/` 로 옮겨 두었고, 그 문서의 숫자는
> 지금과 다릅니다.

---

## 1. 5분 안에 실행하기

### 필요한 프로그램

| 프로그램 | 버전 | 확인 방법 |
|---|---|---|
| Node.js | 20 이상 (권장 22) | `node -v` |
| npm | Node.js 에 함께 설치됨 | `npm -v` |
| Git | 아무 최신 버전 | `git --version` |
| 브라우저 | Chrome 또는 Edge 116+ | 카메라·PIP 기능에 필요 |

### 명령어

```bash
npm install
```

```bash
npm run dev
```

`npm run dev` 를 실행하면 터미널에 주소가 뜹니다 (보통 http://localhost:5173).
브라우저에서 그 주소를 열면 앱이 뜹니다.

### 자주 쓰는 명령어

| 명령어 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 실행 (코드 고치면 화면이 바로 바뀜) |
| `npm run lint` | 코드 스타일 검사 (oxlint) |
| `npm run typecheck` | 타입 오류 검사 |
| `npm run test` | 단위 테스트 (Vitest) |
| `npm run test:e2e` | 브라우저 자동 테스트 (Playwright, 몇 분 걸림) |
| `npm run build` | 배포용 빌드 — 합치기 전에 이게 통과해야 함 |
| `npm run preview` | 빌드 결과를 로컬에서 확인 |
| `npm run assets:verify` | 이미지 파일이 다 있는지 검사 |

### e2e 테스트를 처음 돌리기 전에 한 번만

`npm install` 만으로는 `npm run test:e2e` 가 실패합니다.
Playwright 가 쓸 브라우저를 따로 받아야 합니다. **한 번만** 실행하면 됩니다.

```bash
npx playwright install chromium
```

이걸 건너뛰면 "browser executable doesn't exist" 같은 브라우저를 찾을 수 없다는
오류가 납니다. 이 저장소는 chromium 프로젝트 하나만 쓰기 때문에
(`playwright.config.ts`) chromium 만 받으면 충분합니다.

---

## 2. 환경 변수 (.env.local)

저장소 최상위에 **`.env.local`** 이라는 파일을 직접 만들어야 합니다.
이 파일은 Git 에 올라가지 않습니다(각자 기기에만 있음).

가장 쉬운 방법은 이미 있는 예시 파일을 복사하는 것입니다.

```bash
cp .env.example .env.local
```

**복사한 `.env.local` 은 기능 스위치가 이미 전부 `true` 로 채워져 있습니다.**
Supabase 두 줄만 채우면 바로 개발을 시작할 수 있습니다.

| 변수 이름 | 로컬에서 넣을 값 | 설명 |
|---|---|---|
| `VITE_SUPABASE_URL` | **수현에게 개인 메시지로 요청** (비어 있음) | Supabase 프로젝트 주소 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | **수현에게 개인 메시지로 요청** (비어 있음) | Supabase 공개 키 (`VITE_SUPABASE_ANON_KEY` 라는 이름으로 넣어도 똑같이 인식됩니다 — Vercel 운영 환경은 이 이름을 씁니다) |
| `VITE_ENABLE_CAMERA` | `true` | 실제 웹캠으로 자세 감지 |
| `VITE_ENABLE_FRIEND_ROOM` | `true` | 친구 방(최대 10인) |
| `VITE_ENABLE_REALTIME` | `true` | 실시간 동기화 (친구 방이 켜져 있어야 의미 있음) |
| `VITE_ENABLE_PIP` | `true` | PIP 미니 위젯 자동 열기 |
| `VITE_ENABLE_AI_REPORT` | `false` | 결과 화면의 사용자 요청형 AI 세션 회고 노출 |
| `AI_REPORT_ENABLED` | `false` | Vercel 서버 함수의 AI 회고 호출 허용 (VITE_ 금지) |
| `GEMINI_API_KEY` | 팀의 Vercel 관리자에게 요청 | Gemini 서버 전용 키 (절대 프론트에 넣지 않음) |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` | 선택 | 원문 없는 AI 성공·지연 관찰용 서버 키 |
| `VITE_ENABLE_CAMPUS_THEME` | `true` | 학교 테마 색 |
| `VITE_ENABLE_CAMPUS_TERRITORY` | `true` | 캠퍼스 영토전 화면 |
| `VITE_ENABLE_CAMPUS_SUPABASE` | `true` (서버 연결) / `false` (혼자 테스트) | `false` 면 가짜 데이터로 동작해 서버 없이도 화면을 볼 수 있습니다 |
| `VITE_ENABLE_QA_LAB` | `true` | `/lab` 개발자용 테스트 화면 |

**정리하면:** Supabase 주소와 키 2개만 수현에게 받아 채우면 끝입니다.
나머지는 손대지 않아도 됩니다. 값을 바꾼 뒤에는 `npm run dev` 를 껐다 켜야 반영됩니다.

Supabase 값이 없어도 혼자 모드(자세 감지·세션·성장·상점·스트레칭)는 정상 동작합니다.
친구 방과 캠퍼스 라이브 저장소만 동작하지 않습니다.
캠퍼스 화면을 서버 없이 보고 싶다면 `VITE_ENABLE_CAMPUS_SUPABASE=false` 로 바꾸면
가짜 데이터로 확인할 수 있습니다.

AI 세션 회고만 예외입니다. `VITE_ENABLE_AI_REPORT`, `AI_REPORT_ENABLED`,
`GEMINI_API_KEY` 가 모두 있어야 동작하고 서버 비용이 나가므로, 팀의 Vercel
관리자와 합의하기 전에는 `false` 로 둡니다.

### 운영(Production) 환경은 다릅니다

운영 사이트(https://upright-now.vercel.app)의 변수는 Vercel 에 따로 설정돼 있습니다.
현재 **`VITE_ENABLE_PIP` 만 운영에 설정돼 있지 않아서, 운영에서는 PIP 미니 위젯
자동 열기만 꺼져 있습니다.** 나머지 기능(카메라·친구 방·실시간·캠퍼스)은 켜져 있습니다.
켜려면 Vercel Production 환경 변수에 `VITE_ENABLE_PIP=true` 를 추가하고 다시 배포해야 합니다.

---

## 3. 폴더 지도

### 최상위

| 폴더 | 내용 |
|---|---|
| `src/` | 실제 앱 코드 |
| `public/assets/` | 이미지 파일 (캐릭터·괴물·상점·스트레칭·캠퍼스 지도) |
| `supabase/` | 데이터베이스 구조 파일 |
| `e2e/` | 브라우저 자동 테스트 |
| `docs/` | 문서 (이 파일이 있는 곳) |
| `artifacts/` | 테스트 기준 이미지 — 손대지 마세요 |
| `tools/` | 이미지 검증·가져오기 스크립트 |
| `references/` | 초기 컨셉 참고 이미지 |

### src/ 안쪽

| 폴더 | 담당 |
|---|---|
| `src/app/` | 화면(라우트)과 앱 전체 껍데기 |
| `src/components/` | 화면 조각 (버튼·카드·캐릭터·지도 등) |
| `src/constants/` | **숫자와 문구가 모여 있는 곳** — 값을 바꾸려면 여기 |
| `src/features/` | 기능별 로직 (아래 표) |
| `src/lib/` | 공통 도구 (저장소·Supabase 연결·기능 스위치) |
| `src/index.css` | **디자인 색·폰트 토큰 (여기 한 곳만 고치면 전체 색이 바뀝니다)** |

### src/features/ 안쪽 — 누가 어디를 보면 되는지

| 폴더 | 하는 일 | 주 담당 |
|---|---|---|
| `posture-engine/` | 카메라 랜드마크 → 자세 상태(good/warning/bad/away/unstable) 판정 | 민철 |
| `calibration/` | 5초 개인 기준 등록 | 민철 |
| `pip/` | PIP 미니 위젯 | 민철 |
| `game/` | 회복 공격·괴물 체력·보상 지급 | 공통 |
| `modes/` | 도서관·내 공간·팀플·내 모드 설정 | 공통 |
| `sessions/` | 집중 세션 타이머·완주 판정 | 공통 |
| `progression/` | XP·포인트·캐릭터 단계·상점 보유/장착 | 공통 |
| `stretch/` | 스트레칭 6종 추천 | 공통 |
| `sound/` | 소리(Web Audio 합성음) | 공통 |
| `rooms/` | 친구 방(최대 10인, 실시간 동기화·공동 괴물) | 수현 |
| `campus/` | 캠퍼스 학교 테마·96 영토전 | 연우 |
| `onboarding/` | 닉네임·첫 방문 흐름 | 공통 |
| `settings/` | 설정 화면·전체 데이터 초기화 | 공통 |
| `demo/` | 카메라 없이 보는 데모 모드 | 공통 |
| `persistence/` | 브라우저 저장소 관리 | 공통 |
| `qa-lab/` | `/lab` 개발자 테스트 화면 | 공통 |

> 상점 화면은 `src/app/routes/Shop.tsx`, 상점 아이템 목록은
> `src/constants/storeItems.ts` 에 있습니다 (별도 features 폴더 없음).

### public/assets/

| 폴더 | 내용 |
|---|---|
| `characters/` | 캐릭터 6단계 이미지 |
| `monsters/` | 괴물 3종 × 4단계 이미지 |
| `store/` | 과잠·백팩 레이어 이미지 |
| `stretch/` | 스트레칭 6종 카드 이미지 |
| `campus/` | 캠퍼스 지도 배경 |

### supabase/

| 파일·폴더 | 내용 |
|---|---|
| `schema.sql` | 최초 데이터베이스 구조 (친구 방) |
| `migrations/` | **DB 구조 변경 파일** — 구조를 바꿀 땐 반드시 여기에 SQL 파일로 남깁니다 |
| `manual/` | 한 번만 실행하는 정리용 SQL |

---

## 4. 현재 게임 수치 (코드에서 확인한 실제 값)

### 자세 판정 시간 — `src/constants/posture.ts`

| 항목 | 값 |
|---|---|
| 이탈 지속 → 회복 기회 시작 | 5초 (`BAD_HOLD_MS`) |
| 회복 기회 창 | 30초 (`RECOVERY_WINDOW_MS`) |
| 기준 자세 유지 → 회복 성공 | 5초 (`GOOD_RECOVERY_HOLD_MS`) |
| 회복 후 냉각 | 20초 (`RECOVERY_COOLDOWN_MS`) |
| 소리 안내 단계 상승 | 15초 (`AUDIO_ESCALATION_MS`) |
| 자리 비움 안내 | 60초 (`AWAY_PROMPT_MS`) |
| 세션당 XP 보상 회복 횟수 | 최대 5회 (`MAX_REWARDED_RECOVERIES`) |

`away`(자리 비움)·`unstable`(측정 어려움) 상태에서는 판정과 보상이 **멈춥니다**.

### 자세 상태 5종과 화면 문구 — `src/constants/copy.ts`

| 상태 | 화면 표시 | 문구 |
|---|---|---|
| `good` | 편안함 (초록) | 편안한 기준에 가까워요. |
| `warning` | 변화 감지 (노랑) | 자세가 조금 달라지고 있어요. |
| `bad` | 회복 기회 (코랄) | 처음 등록한 기준으로 가볍게 돌아와 볼까요? |
| `away` | 자리 비움 (회색) | 잠시 자리를 비웠어요. 돌아오면 측정을 이어갈게요. |
| `unstable` | 측정 어려움 (회색) | 측정하기 어려운 상태예요. 카메라 위치와 조명을 확인해 주세요. |

### 보상 — `src/constants/game.ts` `REWARD`

| 행동 | XP | 잎사귀 포인트 |
|---|---|---|
| 자세 회복 성공 | 25 | 5 |
| 스트레칭 완료 | 10 | 10 |
| 목표 완료 | 15 | 10 |
| 친구와 공동 완주 (보너스) | 20 | 10 |

### 세션 완주 보상 — 계획한 길이에 따라 다름

| 계획 길이 | XP | 포인트 |
|---|---|---|
| 5분 미만 | 0 | 0 |
| 5~14분 | 20 | 10 |
| 15~29분 | 60 | 30 |
| 30~49분 | 80 | 40 |
| 50분 이상 | 120 | 60 |

### 괴물 피해량 — `src/constants/game.ts` `DAMAGE`

| 행동 | 피해 |
|---|---|
| 자세 회복 성공 | 40 |
| 유효 집중 5분마다 (자동) | 20 |
| 세션 완주 | 100 |
| 목표 완료 | 30 |
| 기린 싱크 (두 사람 회복이 겹칠 때) | 60 |
| 두 사람 모두 완주 | 150 |

### 괴물 체력

| 구분 | 체력 |
|---|---|
| 개인 괴물 1단계 | 600 |
| 개인 괴물 2단계 | 900 |
| 개인 괴물 3단계 | 1300 |
| 개인 괴물 4단계 | 1800 |
| 친구 방 공동 괴물 | 2000 |

개인 괴물 체력은 **세션이 끝나도 이어집니다.** 4단계를 처치하면 다시 1단계로 돌아갑니다.
모드마다 괴물이 다릅니다 (도서관=북몽이, 내 공간=늘몽이, 팀플·친구 방=꼬몽이).

### 세션 길이 — `src/constants/session.ts`

| 선택지 | 집중 | 회복 휴식 |
|---|---|---|
| 기본 | 25분 | 2분 |
| 짧게 | 15분 | 1분 |
| 길게 | 50분 | 5분 |
| 데모 | 3분 | 1분 |
| 직접 설정 | 5~120분 (5분 단위) | 0~30분 |

- 계획 시간의 **80% 이상** 진행하면 완주로 인정합니다.
- **10분 이상** 진행하면 출석으로 인정합니다.

### 캐릭터 6단계 — `src/constants/game.ts`

| 단계 | 이름 | 필요 XP |
|---|---|---|
| 1 | 뽀각 거북 | 0 |
| 2 | 꿈틀 거북 | 250 |
| 3 | 빼꼼 거부기린 | 600 |
| 4 | 반듯 거부기린 | 1000 |
| 5 | 쭉쭉 기린 | 1500 |
| 6 | 우뚝 기린 | 2200 |

### 상점 가격 — `src/constants/storeItems.ts`

| 아이템 | 가격 |
|---|---|
| 네이비 과잠 | 240P |
| 버건디 과잠 | 240P |
| 포레스트 과잠 | 240P |
| 코랄 과잠 | 240P |
| 새내기 백팩 | 180P |
| 도서관 백팩 | 180P |
| 팀플 백팩 | 180P |
| 황금 과잠 (특별) | 400P |
| 은하 백팩 (특별) | 350P |

첫 세션을 완주해야 상점이 열립니다. 과잠 1개 + 백팩 1개를 동시에 장착할 수 있습니다.

### 모드 — `src/features/modes/modeStore.ts`

| 모드 | 소리 | 화면 연출 | 스트레칭 | 괴물 | 친구 기능 |
|---|---|---|---|---|---|
| 도서관 | 무음 | 작게 | 앉아서 | 북몽이 | 없음 |
| 내 공간 | 부드러운 알림 | 풍부하게 | 전신 | 늘몽이 | 없음 |
| 팀플 | 협동 알림 | 기본 | 혼합 | 꼬몽이 | 있음 |

**내 모드는 최대 3개**까지 만들 수 있습니다 (`MAX_CUSTOM_MODES`).
내 모드에서는 위 항목 + 자세 기준 프로필 + 세션 길이를 직접 지정합니다.

---

## 5. 디자인

### 색을 바꾸려면 `src/index.css` 한 곳만 고치면 전체가 바뀝니다

색·폰트·모서리·그림자가 전부 `src/index.css` 의 `@theme` 블록에 변수로 들어 있습니다.
화면 코드는 `bg-pink`, `text-ink` 처럼 이름으로만 쓰기 때문에,
여기 값 하나를 바꾸면 앱 전체에 적용됩니다. 개별 화면에서 색을 직접 쓰지 마세요.

### 색 토큰

| 변수 | 값 | 용도 |
|---|---|---|
| `--color-canvas` | `#fbf7ec` | 전체 배경 (아이보리) |
| `--color-surface` | `#ffffff` | 카드 배경 |
| `--color-ink` | `#171717` | 기본 글자색 |
| `--color-ink-soft` | `#6f6a62` | 보조 설명 글자 |
| `--color-line` | `#e7e0d4` | 테두리·구분선 |
| `--color-pink` | `#f45b8d` | **세션·회복·주요 버튼(CTA)** |
| `--color-pink-soft` | `#fce1ea` | 핑크 연한 배경 |
| `--color-yellow` | `#f2c94c` | **포인트·출석·보상** |
| `--color-yellow-soft` | `#fff0b8` | 노랑 연한 배경 |
| `--color-blue` | `#5f8ff7` | **기록·성장·친구** |
| `--color-blue-soft` | `#dde9ff` | 파랑 연한 배경 |
| `--color-green` | `#315e43` | **캐릭터·프라이버시·좋은 자세** |
| `--color-green-soft` | `#e4eedb` | 초록 연한 배경 |
| `--color-coral` | `#ff6464` | **강조·회복 기회 알림** |
| `--color-warning` | `#d7a62a` | 경고 텍스트 |
| `--color-muted` | `#85817b` | 비활성·자리 비움 |

### 배색 비율 원칙

**아이보리 60% / 검정·초록·중립 30% / 핑크·노랑·파랑·코랄 10%**

색은 장식이 아니라 역할입니다. 핑크가 화면에 여러 개 있으면
"어디를 눌러야 하는지" 신호가 사라집니다. 강조색은 아껴 쓰세요.

### 폰트·모서리·그림자

| 항목 | 값 |
|---|---|
| 폰트 | **Wanted Sans Variable** (저장소에 포함, OFL-1.1). 없으면 Pretendard → Inter → 시스템 폰트 순 |
| 카드 모서리 | `--radius-card` `1.25rem` |
| 큰 카드 모서리 | `--radius-card-lg` `1.75rem` |
| 카드 그림자 | `--shadow-card` — 낮고 넓게 |
| 강조 글로우 | `--shadow-glow-pink` / `-coral` / `-green` |

한국어가 단어 중간에서 잘리지 않도록 `word-break: keep-all` 이 전역 적용돼 있습니다.

### 폰트

**Wanted Sans Variable** 을 저장소에 직접 담아 씁니다 (`public/fonts/wanted-sans/`).
외부 CDN을 쓰지 않으므로 네트워크가 막힌 환경에서도 같은 화면이 나옵니다.

| 항목 | 값 |
|---|---|
| 라이선스 | SIL Open Font License 1.1 — `public/fonts/wanted-sans/OFL.txt` |
| 출처 | https://github.com/wanteddev/wanted-sans (v1.0.3) |
| 형식 | 가변 폰트 woff2, 유니코드 구간별 92개 subset |
| 가변 축 | `font-weight` **400~1000**. 400 보다 얇은 값은 400 으로 잘립니다 |
| 로딩 | `index.html` 의 stylesheet 링크. `font-display: swap` |

**subset 으로 잘려 있어서** 브라우저는 화면에 실제로 쓰인 글자가 속한 조각만
내려받습니다. 전체 2.2MB 이지만 한 화면에서 실제로 오가는 양은 보통 100~300KB 입니다.
라틴(`split.90`)과 자주 쓰는 한글(`split.88`)은 `preload` 로 미리 받습니다.

**`font-weight: 300` 같은 값을 쓰지 마세요.** 이 폰트에는 400 미만이 없습니다.

> 이 값들을 왜 이렇게 정했는지(설계 의도)는
> [docs/archive/12_DESIGN_SYSTEM.md](archive/12_DESIGN_SYSTEM.md) 에 있습니다.
> 단, 그 문서의 숫자는 초기 기획 시점 값이라 위 표와 다를 수 있습니다.

---

## 6. 건드리기 전에 상의할 것

아래 파일은 **혼자 판단해서 고치지 말고 먼저 이야기해 주세요.**
한 줄만 바꿔도 앱 전체 느낌이나 밸런스가 흔들립니다.

| 파일 | 왜 위험한가 |
|---|---|
| `src/constants/posture.ts` | 자세 판정 임계값. 5초를 3초로 줄이면 회복 기회가 쏟아져서 보상·게임 밸런스가 전부 무너집니다. 아직 실제 카메라로 검증되지 않은 값이라 특히 조심해야 합니다. |
| `src/constants/game.ts` | 보상·피해량·캐릭터 단계 XP·괴물 체력. 여기 숫자가 바뀌면 기존 사용자의 성장 속도가 갑자기 달라집니다. |
| `src/features/game/rewards.ts` | XP·포인트를 지급하는 **유일한 통로**. 다른 곳에서 직접 지급하면 중복 지급 방지가 깨집니다. |
| `src/features/posture-engine/` | 자세 상태 머신. 시간(몇 초 유지했는지)을 세는 주체가 한 곳뿐인데, 다른 곳에서 또 세면 판정이 두 번 일어납니다. |
| `src/features/sessions/finalizeSession.ts` | 세션 종료·완주 인정·보상 확정. 여기를 우회하면 중도 종료에도 보상이 나갑니다. |

---

## 7. 협업 규칙

### 브랜치

- **`main` 에 직접 push 하지 않습니다.**
- 작업할 때 브랜치를 새로 만듭니다.

```bash
git checkout main
git pull origin main
git checkout -b feat/내-작업-이름
```

- 작업이 끝나면 push 하고 GitHub 에서 Pull Request 를 엽니다.

```bash
git push origin feat/내-작업-이름
```

### 합치기 전 확인

아래 3개가 전부 통과해야 합칩니다.

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm run test
```

### DB 구조를 바꿀 때

**Supabase 대시보드에서 직접 클릭해서 테이블을 바꾸지 마세요.**
그렇게 하면 기록이 남지 않아서 다른 사람 환경에 반영되지 않고,
나중에 왜 이렇게 됐는지 아무도 모릅니다.

반드시 `supabase/migrations/` 에 SQL 파일로 남기세요.
파일 이름은 `날짜_내용.sql` 형식입니다 (예: `20260801_add_room_tags.sql`).

### 담당 영역

| 담당 | 영역 | 주요 폴더 |
|---|---|---|
| 수현 | 친구 방 (최대 10인 실시간) | `src/features/rooms/` |
| 연우 | 캠퍼스 (학교 테마·영토전) | `src/features/campus/` |
| 민철 | 자세 판정·PIP·TTS·리포트 | `src/features/posture-engine/`, `calibration/`, `pip/` |

**남의 영역 파일을 고쳐야 하면 먼저 이야기해 주세요.**
공통 폴더(`game/`, `modes/`, `sessions/`, `constants/`)는 서로 부딪히기 쉬우니
작업 전에 한마디 남기면 좋습니다.

---

## 8. Supabase 안내

### 하나의 프로젝트에 두 기능이 함께 있습니다

친구 방과 캠퍼스는 **같은 Supabase 프로젝트** 안에서 테이블만 나뉘어 있습니다.

| 기능 | 테이블 |
|---|---|
| 친구 방 | `rooms`, `room_members` |
| 캠퍼스 | `campus_schools`, `campus_memberships`, `campus_seasons`, `campus_territories`, `campus_contributions`, `campus_territory_events`, `campus_school_directory_entries` |

### 마이그레이션 파일

| 파일 | 대상 | 라이브 적용 |
|---|---|---|
| `schema.sql` | 친구 방 (최초 구조) | 적용됨 |
| `migrations/20260726_expand_room_duration.sql` | 친구 방 (세션 길이 확장) | 적용됨 |
| `migrations/20260726_room_lifecycle_security.sql` | 친구 방 (방 생명주기·보안) | 적용됨 |
| `migrations/20260727_room_presence_cleanup.sql` | 친구 방 (생존 신호·유령 참가자 정리) | 적용됨 |
| `migrations/20260727_campus_realtime_v2.sql` | 캠퍼스 (기본 구조) | 적용됨 |
| `migrations/20260727_campus_final_grid_realtime.sql` | 캠퍼스 (96 영토·학교 디렉터리·실시간) | 적용됨 |
| `manual/20260727_rc2_smoke_cleanup.sql` | 검증용 테스트 데이터 정리 (1회용) | 필요할 때 실행 |

### 캠퍼스 작업자(연우)는 개인 서버를 따로 만드는 편이 좋습니다

본 서버에서 실험하면 다른 사람 데이터에 영향이 갑니다. 대신:

1. [supabase.com](https://supabase.com) 에서 **본인 프로젝트를 무료로 새로 만듭니다.**
2. Authentication → Providers 에서 **Anonymous Sign-Ins 를 켭니다.**
3. SQL Editor 에서 `supabase/` 안의 SQL 을 순서대로 실행합니다.
   (`schema.sql` → `migrations/` 안의 파일들을 날짜 순서로)
4. Project Settings → API 에서 URL 과 anon key 를 복사해 본인 `.env.local` 에 넣습니다.

이렇게 하면 **본 서버와 똑같은 구조의 개인 서버**가 생겨서 마음껏 실험할 수 있습니다.

작업이 끝나면 **SQL 파일만** `supabase/migrations/` 에 커밋해서 넘겨주세요.
수현이 본 서버에 그 파일을 실행하면 동일하게 반영됩니다.
(테이블을 손으로 만들면 넘길 것이 없어집니다 — 그래서 SQL 파일이 중요합니다.)

---

## 9. 지금 안 되는 것 / 미완료

이건 버그가 아니라 **아직 안 한 일**입니다. 알고 시작하세요.

| 항목 | 상태 |
|---|---|
| 운영 `VITE_ENABLE_PIP` | 미설정 — 운영에서 PIP 자동 열기가 꺼져 있음 |
| 운영 AI 세션 회고 | Vercel 서버 키·비용 한도·Preview 검증 전까지 비활성 |
| 실카메라 자세 판정 임계값 | **미검증** — 합성 데이터 기준으로만 맞춰 둔 값. 실제 사람·카메라로 확인 필요 |
| 온보딩 튜토리얼 | 미구현 — 처음 온 사용자에게 사용법을 알려주는 안내가 없음 |
| 캐릭터 Lv.2/4/5/6 자세별 이미지 | 미보유 — 해당 단계는 기본 이미지로 대체 중 |
| `away` (자리 비움) 전용 이미지 | 미보유 |

---

## 10. 더 알고 싶다면

| 문서 | 내용 |
|---|---|
| [AGENTS.md](../AGENTS.md) | 제품 불변조건·구현 규칙·금지 사항 (AI 도구도 이 문서를 따릅니다) |
| [CLAUDE.md](../CLAUDE.md) | AI 코딩 도구용 짧은 안내 — 읽을 순서·금지 5줄·담당 표 |
| [docs/AI_HANDOFF.md](AI_HANDOFF.md) | 기술 상세 인수인계 — 자세 판정 파이프라인, 데이터 흐름 |
| [docs/14_DATA_PRIVACY_SECURITY.md](14_DATA_PRIVACY_SECURITY.md) | 개인정보 처리 원칙 — **꼭 읽어 주세요** |
| [docs/DECISIONS.md](DECISIONS.md) | 왜 이렇게 결정했는지 — 검토한 대안과 재검토 조건까지 |
| [docs/ARCHITECTURE.md](ARCHITECTURE.md) | 시스템 구조·데이터 흐름·환경변수·배포 |
| [docs/CODEX_HANDOFF.md](CODEX_HANDOFF.md) | 작업 인수인계 — 지금 상태, 남은 일, 바로 시작할 다음 단계 |
| [docs/21_RESEARCH_BASIS.md](21_RESEARCH_BASIS.md) | 자세 판정 근거 조사 — CVA 지표를 쓰지 않는 이유, 개인 기준 방식을 택한 배경 (자세 작업 시 참고) |
| [docs/22_PRODUCT_SPEC_V2.md](22_PRODUCT_SPEC_V2.md) | **다음 개정 방향** — 2026-08-04 기획 회의 정리. 현재 코드와의 차이, 불변조건 충돌 4건, 미결 10건 |
| [docs/archive/](archive/) | 초기 기획 문서 (숫자는 현재와 다름) |

### 이것만은 지켜 주세요 — 개인정보

카메라 영상·사진·프레임·랜드마크 좌표·개인 자세 기준은
**어떤 서버에도 보내지 않습니다.** 분석은 전부 브라우저 안에서 끝납니다.
친구 방에는 닉네임·진행 상태·성공 이벤트만 나갑니다.
이 원칙을 깨는 코드는 리뷰에서 막습니다.

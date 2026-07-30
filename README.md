# UpRight Now

노트북 공부 중 흐트러진 자세를 조용히 알아차리고, 회복할 때마다
거북이 캐릭터가 기린으로 성장하는 자세 회복 스터디 웹앱.

**Production**: https://upright-now.vercel.app

> 🧭 **팀원이라면 [docs/TEAM_START.md](docs/TEAM_START.md) 부터 보세요.**
> 설치·환경 변수·폴더 지도·현재 게임 수치·협업 규칙이 한 문서에 정리돼 있습니다.

## 릴리스 상태 (2026-07-22~28)

| 구분 | 내용 |
|---|---|
| 현재 릴리스 | `main` · 태그 **`v1.1.0`** (커밋 `adc9c9b`) — 모드 시스템·경제 v2·개인 괴물 4단계·캠퍼스 테마/영토전(라이브 Supabase)·사운드 팩·세션 직접 설정·승인 에셋 |
| 이전 안정판 | 태그 `v1.0.0-mvp` — 개인 세션 + 2인 친구 방 (캠퍼스 없음) |
| RC 기록 | `v1.1.0-rc.1` · `v1.1.0-rc.2` (검증 이력용 태그) |

### 운영에서 켜져 있는 것 / 꺼져 있는 것

v1.1.0 은 main 에 병합·배포됐지만, **기능 노출은 Vercel Production
환경변수로 결정**됩니다. 2026-07-28 기준 실제 설정:

- 켜짐: `VITE_ENABLE_CAMERA` · `VITE_ENABLE_FRIEND_ROOM` ·
  `VITE_ENABLE_REALTIME` · `VITE_ENABLE_CAMPUS_THEME` ·
  `VITE_ENABLE_CAMPUS_TERRITORY` · `VITE_ENABLE_CAMPUS_SUPABASE`
  (+ `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`)
- 꺼짐(의도): `VITE_ENABLE_QA_LAB=false`
- **미설정: `VITE_ENABLE_PIP`** → PIP 미니 위젯 자동 열기가 운영에서
  비활성입니다. 켜려면 Vercel Production 에 `VITE_ENABLE_PIP=true` 를
  추가하고 재배포하세요.

환경변수를 바꾼 뒤에는 반드시 클라우드 빌드(`npx vercel deploy --prod`)로
재배포해야 번들에 반영됩니다.

### 알려진 한계

- **실카메라 임계값 미검증** — 판정 지터·프레이밍 게이트 18° 는 실기기
  확인 전까지 조정 금지
- **학교 인증 미도입** — 캠퍼스 학교 선택은 자율 신고이며 재학 인증이 없음
  (화면에 비공식 고지 노출)
- **카메라 원본 미저장** — 영상·프레임·랜드마크·자세 좌표는 어떤 서버에도
  전송하지 않음 (아래 개인정보 처리 원칙)

팀 시작 안내는 [docs/TEAM_START.md](docs/TEAM_START.md),
코드 기준 수치는 [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md) 를 보세요.

## 구현된 핵심 기능

- **온디바이스 자세 감지** — MediaPipe Pose Landmarker(브라우저 내 추론),
  5초 개인 기준 캘리브레이션, 개인 기준 대비 상대 변화만 판정
- **회복 게임** — 이탈 5초 지속 → 회복 기회(30초 창) → 기준 복귀 5초 → 특수 공격
  (괴물 -40 · XP +25 · 잎사귀 +5, 세션당 XP 보상 상한 5회, 냉각 20초)
- **집중 세션** — 25분 기본(15/50분·3분 데모), 직접 설정 5~120분,
  80% 이상 진행 시 완주 인정. 완주 보상은 길이별(5분 미만 0 → 50분 이상 XP 120·60P)
- **모드 시스템** — 도서관·내 공간·팀플 기본 3종 + 내 모드 최대 3개
  (소리 팩·연출·스트레칭·괴물·친구 기능·기준 프로필 연결)
- **모드별 괴물** — 북몽이·늘몽이·꼬몽이, 4단계 진행도(600/900/1300/1800)가
  세션 간 유지되고 유효 집중 5분마다 자동 공격
- **성장·상점** — XP 파생 6단계(뽀각 거북 → 우뚝 기린), 잎사귀로 과잠 4종(240P)·
  백팩 3종(180P)·특별 아이템(황금 과잠 400P·은하 백팩 350P) 구매/장착,
  첫 완주 후 상점 해제
- **캠퍼스 테마·영토전** — 학교 선택(프리셋 + 직접 등록), 96 영토 지도,
  기여·점령·경합, 시즌 순위. 프리셋 학교는 이메일 OTP 인증을 마친 학생만 참여할 수 있고, 실시간 영토전 소식을 표시합니다.
- **기록·설정** — 세션 요약·주간 출석, 민감도·소리·닉네임·전체 데이터 초기화
- **스트레칭 6종** — 모드별 가중 랜덤, 건너뛰기 불이익 없음
- **PIP 미니 위젯** — Document Picture-in-Picture(Chrome/Edge 116+),
  설정에서 자동 열기 토글. 미지원·차단 시 화면 안 미니 위젯으로 자동 대체,
  PIP 실패·닫힘이 세션을 중단시키지 않음
- **2인 친구 방** — Supabase 익명 인증 + Realtime, 6자리 코드 입장,
  공동 괴물(꼬몽이, HP 2000), 기린 싱크 합동 공격, 스트레칭 방어막, 반응 3종

## 개인정보 처리 원칙

- 모든 영상 분석은 브라우저 안에서만 수행합니다.
- 카메라 영상·사진·프레임·랜드마크 원본은 저장·전송하지 않습니다.
- 로컬에는 개인 기준 **요약값**과 세션 집계만 저장합니다.
- 친구 방에는 닉네임·진행 상태·성공 이벤트만 전송합니다
  (bad 상태·자세 좌표·개인 기준은 전송 금지, 코드 레벨에서 차단).
- 의료 진단·치료를 제공하지 않습니다.

## 로컬 실행

```bash
npm install
npm run dev        # http://localhost:5173
```

## 테스트

```bash
npm run lint
npm run typecheck
npm run test       # Vitest 단위 테스트
npm run test:e2e   # Playwright (자체 서버, 포트 5273)
npm run build
```

친구 방 라이브 검증(두 브라우저 컨텍스트, Supabase 필요):

```bash
npx playwright test e2e/room-live.spec.ts
```

## 환경 변수 (이름만 — 값은 Vercel·.env.local 에)

| 이름 | 용도 |
|---|---|
| `VITE_ENABLE_CAMERA` | 실제 웹캠 자세 감지 on/off |
| `VITE_ENABLE_PIP` | PIP 미니 위젯 자동 열기 on/off (현재 Production 미설정 = off) |
| `VITE_ENABLE_FRIEND_ROOM` | 2인 친구 방 on/off |
| `VITE_ENABLE_REALTIME` | Supabase Realtime 구독 on/off |
| `VITE_ENABLE_CAMPUS_THEME` | 캠퍼스 학교 테마 on/off (v1.1) |
| `VITE_ENABLE_CAMPUS_TERRITORY` | 캠퍼스 영토전 on/off (v1.1) |
| `VITE_ENABLE_CAMPUS_SUPABASE` | 캠퍼스 라이브 저장소 (off = mock) |
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable key |
| `VITE_ENABLE_QA_LAB` | 개발용 QA Lab (운영 기본 off) |

친구 방 백엔드는 `supabase/schema.sql` 로 구성합니다
(RLS + RPC 원자적 보스 HP, Anonymous Sign-Ins 필요).
이후 변경은 `supabase/migrations/` 의 마이그레이션 5건으로 적용하며,
캠퍼스 영토전(96 영토·학교 디렉터리·Realtime)은
`20260727_campus_final_grid_realtime.sql` 이 최종 기준입니다.

## 친구 방 구조

```
익명 로그인 → create_room/join_room RPC (RLS)
→ Realtime Presence(준비·집중·자리비움) + Broadcast(회복·완료·응원)
→ 보스 HP 는 DB 가 최종 기준: apply_room_damage RPC (event_id 중복 차단)
→ 기린 싱크: 10초 내 양쪽 회복 → XOR 파생 id 로 1회만 -60
연결 끊김 → 30초 재시도 → 실패 시 혼자 모드(개인 세션 유지)
```

## 문서

- 팀 시작 안내: [docs/TEAM_START.md](docs/TEAM_START.md)
- 인수인계: [docs/AI_HANDOFF.md](docs/AI_HANDOFF.md)
- 기획·스펙 원문(초기 기록): [docs/archive/](docs/archive/)

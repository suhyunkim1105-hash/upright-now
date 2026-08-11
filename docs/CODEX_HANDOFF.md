# CODEX_HANDOFF

마지막 갱신: 2026-08-11

이 문서는 다른 OpenAI 계정이나 새 Codex 워크스페이스에서 UpRight Now 작업을 이어받기 위한 현재 기준 인수인계 문서입니다. 실제 API 키, Supabase URL, Vercel URL 같은 민감값은 기록하지 않습니다. 값은 각 서비스 대시보드와 `.env.local`에서 다시 설정합니다.

## 1. 현재 프로젝트 요약

UpRight Now는 웹캠 기반 자세 회복 습관 앱입니다. 사용자는 개인 기준 자세를 등록하고, 집중 세션 중 자세가 흐트러졌을 때 회복하면 XP·포인트·캠퍼스 기여도를 얻습니다. 최근에는 학교 인증, 캠퍼스 랭킹·영토전, 성장 보상 DB, 픽셀 메타버스 캠퍼스 방향으로 확장 중입니다.

현재 큰 흐름은 두 갈래입니다.

- 기존 앱: 자세 감지, 집중 세션, 친구 방, 성장·상점, 캠퍼스 인증·기여·영토전
- 다음 방향: 픽셀 게임 느낌의 캠퍼스 월드, 학교 랭킹전, NPC·상점·친구 방·채팅 확장

## 2. 현재 Git 상태 체크포인트

작성 시점에 확인한 상태입니다. 새 환경에서는 반드시 다시 확인하세요.

- 메인 작업 위치: `/Users/yeonwoo/Documents/New project/upright-now`
- 기본 브랜치: `main`
- 작성 시점 `main`은 `origin/main`보다 3커밋 앞서 있었습니다.
- 최근 커밋에는 서울 자치구 지도 정렬 수정, 픽셀 월드 설계 문서, `.worktrees` ignore 작업이 포함되어 있었습니다.
- 별도 worktree가 존재했습니다.
  - 경로: `.worktrees/campus-pixel-world`
  - 브랜치: `codex/campus-pixel-world`
  - 상태: Phaser 기반 픽셀 월드 구현 파일이 커밋되지 않은 상태

새 계정으로 옮기기 전에는 `main`과 `.worktrees/campus-pixel-world`를 모두 확인해야 합니다. 특히 worktree의 미커밋 파일은 GitHub에 자동으로 올라가지 않습니다.

## 3. 완료된 작업

### 기본 앱

- React, Vite, TypeScript 기반 SPA 구조
- 앱 라우팅과 주요 화면: 홈, 온보딩, 카메라, 캘리브레이션, 세션, 결과, 기록, 성장, 상점, 설정
- MediaPipe 기반 자세 감지 구조
- 카메라 없이 확인 가능한 QA Lab
- 로컬 저장소 기반 프로필·세션·성장·상점 흐름
- Vercel SPA 배포용 rewrite 설정

### 친구 방

- Supabase 기반 익명 사용자 생성
- 방 생성·입장·Presence·Broadcast 구조
- 여러 room lifecycle 관련 migration
- 카메라 프레임·랜드마크·자세 좌표를 저장하거나 전송하지 않는 원칙 유지

### 캠퍼스

- 학교 선택 UI
- 학교별 테마 색상 반영
- 검색형 학교 선택 UX로 전환
- 목록에 없는 학교를 사용자가 추가하면 공용 학교 목록에 반영하는 방향의 구조
- Supabase Auth 이메일 링크 기반 학교 인증
- 인증된 학생만 캠퍼스 기여·점령 가능하도록 설계
- 캠퍼스 시즌, 학교 도메인, 학교 디렉터리, 기여도, 영토전 관련 migration
- 서울 25개 자치구 기반 영토전 프로토타입
- 기여도가 쌓이면 학교 색상으로 구역이 표시되는 방향으로 전환

### 성장·보상 DB

- 성장 XP와 포인트를 서버 원장으로 다루는 설계 문서 작성
- `progression_balances`, `progression_reward_rules`, `progression_reward_events` 기반으로 보상 기록을 관리하는 방향 확정
- 이벤트별 XP·포인트 지급 기준, 한도, 멱등성 원칙 정리
- 학교별 참여 인원 보정점수 설계

### 픽셀 월드

- 제품 방향을 “픽셀 메타버스 + 싸이월드 미니홈피 감성”으로 재정의하는 설계 문서 작성
- `/campus/world`를 별도 라우트로 추가하는 구현 계획 작성
- Phaser를 React 안에 마운트하는 방식 선택
- 기숙사 개인 공간, 거북이·기린 아바타, 이동·충돌·앉기 모션을 1차 범위로 정함
- 이 구현은 작성 시점에 별도 worktree에서 진행 중이며, main에 완전히 통합된 상태가 아닐 수 있습니다.

## 4. 진행 중인 작업

### 서울 자치구 지도 정확도

현재 지도는 “실제 행정경계와 비슷한 시각적 프로토타입” 수준입니다. 사용자는 행정구역 모양에 맞게 학교가 구를 점령하는 방식을 원합니다.

현재 문제:

- 임시 외곽선이나 단순화한 polygon이 실제 서울 지도와 완벽히 일치하지 않았습니다.
- 지도 배경 이미지와 오버레이가 따로 노는 문제가 있었습니다.
- 장기적으로는 정적 이미지 위에 손으로 맞춘 polygon보다 공식 GeoJSON 또는 검증된 SVG 경계 데이터를 쓰는 편이 안전합니다.

### 픽셀 메타버스 캠퍼스

별도 worktree에서 `/campus/world` 구현을 시작한 흔적이 있습니다. 새 작업자는 먼저 해당 worktree 상태를 확인해야 합니다.

확인할 파일 예:

- `.worktrees/campus-pixel-world/package.json`
- `.worktrees/campus-pixel-world/src/app/routes/CampusWorld.tsx`
- `.worktrees/campus-pixel-world/src/components/campus/world/`
- `.worktrees/campus-pixel-world/src/features/campus/world/`

## 5. 남은 작업과 우선순위

### P0 - 계정 이전과 작업 보존

1. `main`의 앞선 커밋을 GitHub에 푸시했는지 확인합니다.
2. `.worktrees/campus-pixel-world`의 미커밋 작업을 커밋·푸시하거나 별도 백업합니다.
3. 새 계정에서 GitHub, Vercel, Supabase 접근 권한을 다시 연결합니다.
4. `.env.local`은 커밋하지 말고 새 환경에서 다시 만듭니다.

### P1 - Supabase와 배포 환경 안정화

1. Supabase SQL migration 적용 순서 점검
2. Vercel 환경변수와 Supabase Auth URL Configuration 정합성 확인
3. 이메일 인증 링크가 배포 사이트로 돌아오고 `consumeAuthCallback()`이 세션을 정상 확정하는지 확인
4. 캠퍼스 인증 RPC와 영토 RPC가 새 Supabase 프로젝트에서 모두 존재하는지 확인

### P2 - 캠퍼스 지도/랭킹

1. 서울 자치구 경계 데이터를 검증 가능한 소스로 교체합니다.
2. 학교 위치 또는 선택 구역과 자치구 매핑을 DB로 관리합니다.
3. 사용자가 점령할 자치구를 선택하고, 학교 점수가 더 높으면 소유권이 바뀌는 RPC를 완성합니다.
4. 학교별 참여 인원 보정점수를 랭킹에 반영합니다.

### P3 - 성장·보상 서버 연결

1. 세션 종료, 자세 회복, 스트레칭, 목표 완료 이벤트를 서버 RPC로 지급합니다.
2. 클라이언트가 XP·포인트 숫자를 보내지 않게 유지합니다.
3. 성장 화면이 서버 잔액과 최근 원장을 읽도록 전환합니다.
4. 운영 전 기존 로컬 데이터 이관 정책을 결정합니다.

### P4 - 픽셀 월드

1. `/campus/world` 라우트와 Phaser mount를 main에 안전하게 합칩니다.
2. 기숙사 맵, 이동, 충돌, 앉기 모션을 먼저 완성합니다.
3. 캐릭터 에셋은 직접 제작 또는 명확한 라이선스가 있는 에셋만 사용합니다.
4. 이후 친구 방문, 자유 채팅, 학생회관 NPC, 명예의 전당, 상점, BGM을 단계적으로 추가합니다.

## 6. 주요 기술적 의사결정

- 카메라 프레임·랜드마크 원본은 저장하거나 전송하지 않습니다.
- Supabase service role key는 프론트엔드에 넣지 않습니다.
- 학교 인증은 Supabase Auth 이메일 링크와 학교 도메인 whitelist를 사용합니다.
- 캠퍼스 기여·점령은 로컬 저장소가 아니라 Supabase migration/RPC를 기준으로 관리합니다.
- 성장 보상은 클라이언트 숫자를 믿지 않고 서버 규칙 테이블과 원장으로 계산합니다.
- 픽셀 월드는 기존 `/campus`를 갈아엎지 않고 별도 `/campus/world`에서 시작합니다.

## 7. 알려진 오류와 해결되지 않은 문제

### Supabase 이메일 인증

증상:

- 메일은 오지만 localhost로 돌아가거나 인증 실패로 표시됨
- `/auth/v1/otp`가 429로 실패
- `campus_verify_school` RPC 404

확인할 것:

- Vercel 환경변수 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Supabase Authentication URL Configuration의 Site URL과 Redirect URLs
- 새 Vercel 주소가 Supabase Redirect URLs에 들어갔는지
- 필요한 migration이 새 Supabase 프로젝트에 전부 적용됐는지
- Supabase Rate Limits, Custom SMTP 설정

### SQL migration 적용 순서

일부 migration은 앞 단계 테이블 또는 함수가 있어야 실행됩니다. 예를 들어 `progression_reward_rules`가 없다는 오류는 foundation migration보다 balance/rules migration을 먼저 실행했을 때 발생할 수 있습니다.

권장:

1. `supabase/schema.sql`
2. 기존 방·캠퍼스 migration
3. 학교 인증 migration
4. 성장 foundation migration
5. 성장 balance/rules migration
6. 자치구 영토 관련 migration

실제 적용 전에는 `supabase/README.md`와 각 migration 상단 주석을 확인합니다.

### 지도 정확도

현재 자치구 지도는 제품 감성용 프로토타입입니다. 실제 서울 행정경계를 정확히 반영하려면 공식 또는 라이선스가 명확한 GeoJSON/SVG 데이터로 교체해야 합니다.

### 테스트

`npm run test`는 `scripts/run-tests.mjs`를 통해 spec 파일 수집 누락을 감지합니다. 머신 성능이나 jsdom 이슈로 오래 걸릴 수 있습니다. 완료 보고 전에는 최소한 관련 focused test와 `npm run typecheck`, 가능하면 `npm run build`를 실행합니다.

## 8. 다음 작업자가 바로 시작할 단계

새 계정에서 이어받으면 아래 순서로 시작하세요.

```bash
cd "/Users/yeonwoo/Documents/New project/upright-now"
git status --short --branch
git worktree list
npm install
cp .env.example .env.local
npm run typecheck
npm run build
```

그 다음:

1. `.env.local`에 본인 Supabase 프로젝트의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`를 넣습니다.
2. Supabase SQL Editor에서 필요한 migration이 모두 적용됐는지 확인합니다.
3. Vercel 프로젝트의 환경변수도 동일하게 설정합니다.
4. Supabase Auth의 Site URL과 Redirect URLs에 현재 배포 주소를 추가합니다.
5. `/campus` 인증, 기여도, 지도 표시를 확인합니다.
6. 픽셀 월드 작업을 이어갈 경우 `.worktrees/campus-pixel-world` 상태를 먼저 보존합니다.

## 9. 관련 파일 경로

- 최상위 작업 계약: `AGENTS.md`
- 새 계정 인수인계: `docs/CODEX_HANDOFF.md`
- 시스템 구조: `docs/ARCHITECTURE.md`
- 결정 기록: `docs/DECISIONS.md`
- 오래된 상세 인수인계: `docs/AI_HANDOFF.md`
- 오래된 상세 결정 로그: `docs/20_DECISION_LOG.md`
- 팀 시작 가이드: `docs/TEAM_START.md`
- 환경변수 예시: `.env.example`
- Vercel SPA 설정: `vercel.json`
- 라우팅: `src/app/router/AppRoutes.tsx`
- Supabase 클라이언트: `src/lib/supabase/client.ts`
- 기능 플래그: `src/lib/feature-flags/flags.ts`
- 캠퍼스 화면: `src/app/routes/Campus.tsx`
- 캠퍼스 지도: `src/components/campus/TerritoryMap.tsx`
- 캠퍼스 로직: `src/features/campus/`
- 성장 보상 문서: `docs/specs/growth-reward-db.md`, `docs/specs/growth-balance-spec.md`
- Supabase migration: `supabase/migrations/`
- 픽셀 월드 설계: `docs/superpowers/specs/2026-08-11-campus-pixel-world-design.md`
- 픽셀 월드 계획: `docs/superpowers/plans/2026-08-11-campus-pixel-world-plan.md`

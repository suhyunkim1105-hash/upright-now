# Supabase 설정

이 폴더는 Deskfit의 실제 2인 친구 방과 캠퍼스 영토전을 위한 Supabase 스키마입니다.

## 적용 순서

1. Supabase 프로젝트를 만듭니다.
2. Authentication에서 Anonymous Sign-Ins를 활성화합니다.
3. 캠퍼스 이메일 인증을 쓸 경우 Authentication의 Email provider와 Email OTP를 활성화하고, 운영 사이트 URL을 Redirect URLs에 등록합니다.
4. SQL Editor에서 `schema.sql`을 실행합니다.
5. 아래 migration을 순서대로 실행합니다: `20260726_expand_room_duration.sql`, `20260726_room_lifecycle_security.sql`, `20260727_room_presence_cleanup.sql`, `20260727_campus_realtime_v2.sql`, `20260727_campus_final_grid_realtime.sql`, `20260730_campus_school_verification.sql`.
6. Realtime에서 `rooms`, `room_members` 테이블 변경을 사용할 경우 publication 설정을 확인합니다.
7. Project URL과 Publishable key를 Vercel 환경 변수에 입력합니다.
8. 서로 다른 두 브라우저에서 방 생성·입장을 확인합니다.

## 환경 변수

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

## 주의

- 이 스키마는 2인 프로토타입 기준입니다.
- 운영 전 RLS·rate limit·CAPTCHA·익명 사용자 정리 정책을 다시 검토합니다.
- 카메라·랜드마크·자세 좌표를 테이블이나 Broadcast payload에 넣지 않습니다.
- 서비스 역할 키를 프론트엔드에 넣지 않습니다.
- `20260730_campus_school_verification.sql`은 학교 이메일의 OTP 인증이 끝난 뒤, 인증한 학교와 같은 캠퍼스 기여·점령만 허용합니다. 원본 이메일은 Supabase Auth에만 보관하고 앱 테이블에는 저장하지 않습니다.

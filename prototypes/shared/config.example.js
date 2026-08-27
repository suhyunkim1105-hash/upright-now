/* 이 파일을 같은 폴더에 config.js 로 복사하고 두 줄을 채우세요.
 *
 *   Supabase 대시보드 -> Project Settings -> API
 *     Project URL        -> url
 *     anon / publishable -> anonKey
 *
 * anon 키는 브라우저에 나가라고 만든 공개 키입니다. 여기 넣어도 됩니다.
 * service_role(= secret) 키는 절대 넣지 마세요. 그 키는 RLS 를 통째로
 * 무시하므로 브라우저에 닿는 순간 데이터베이스 전체가 열립니다.
 *
 * config.js 는 .gitignore 에 있습니다. 채운 파일은 커밋되지 않습니다.
 */
window.GIRIN_SUPABASE = {
  url: '',
  anonKey: '',
  /* 메일에 찍히는 인증번호의 길이. GoTrue 의 mailer_otp_length 와 같아야
     합니다 — 다르면 화면이 칸을 다 못 채워 확인 버튼이 안 열립니다.
     프로젝트 쪽 값은 scripts/apply-auth-email.mjs 가 넣습니다. */
  otpLength: 8,
};

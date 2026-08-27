/* 배포본에서도 서버에 붙도록 **이 파일은 커밋합니다.**
 *
 * anon 키를 숨기는 것은 뜻이 없습니다 — 브라우저로 내려가는 키라
 * 개발자도구만 열면 보입니다. 이 열쇠를 안전하게 만드는 것은 비밀이
 * 아니라 RLS 입니다: anon 역할에는 실행 권한이 하나도 없고, 표는
 * 자기 행만 읽고 쓰며, 코인·구매는 security definer 함수 안에서만
 * 움직입니다. 실측으로 anon 의 직접 쓰기 6종이 전부 거절됩니다.
 *
 * 값을 바꾸려면 아래 두 줄만 고칩니다.
 *
 *   Supabase 대시보드 -> Project Settings -> API
 *     Project URL        -> url
 *     anon / publishable -> anonKey
 *
 * anon 키는 브라우저에 나가라고 만든 공개 키입니다. 여기 넣어도 됩니다.
 * service_role(= secret) 키는 절대 넣지 마세요. 그 키는 RLS 를 통째로
 * 무시하므로 브라우저에 닿는 순간 데이터베이스 전체가 열립니다.
 *
 * service_role(= secret) 키를 여기에 넣는 순간 이 규칙이 전부 무너집니다.
 * 이 파일이 커밋되므로 더더욱 안 됩니다.
 */
window.GIRIN_SUPABASE = {
  url: 'https://bxvmrztewydugkdoympf.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4dm1yenRld3lkdWdrZG95bXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzODc0OTEsImV4cCI6MjEwMDk2MzQ5MX0.RqwUE4uN5s7N7YEjAm0Tvbnx94afe1qhpJ7_atpinmI',

  /* 메일에 찍히는 인증번호의 길이.
   *
   * **GoTrue 의 `mailer_otp_length` 와 같은 값이어야 합니다.** 화면이
   * 여덟 칸을 그려 놓고 서버가 여섯 자리를 보내면, 사용자는 칸을 다 못
   * 채워서 확인 버튼을 영원히 못 누릅니다. 반대도 마찬가지입니다.
   *
   * 프로젝트 쪽 값은 대시보드가 아니라 저장소에서 넣습니다 —
   *
   *   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=... \
   *     node scripts/apply-auth-email.mjs --otp-length 8
   *
   * 그 스크립트가 메일 본문과 이 길이를 같이 넣고 다시 읽어서 확인합니다.
   * 길이를 바꾸면 **두 곳을 같이** 고쳐야 합니다.
   */
  otpLength: 8,
};

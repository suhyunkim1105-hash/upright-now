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
  anonKey: 'sb_publishable_MVhrA6NV6YlH9KriLpgItA_Za_ptUhp',
};

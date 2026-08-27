/* 인증 메일 템플릿을 Supabase 프로젝트에 밀어 넣습니다.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=xxxx node scripts/apply-auth-email.mjs
 *   (미리보기만: --dry-run)
 *
 * 왜 스크립트인가
 * ---------------
 * 호스팅 프로젝트의 메일 본문은 마이그레이션에 안 들어갑니다. 대시보드에만
 * 있고, 대시보드에는 되돌릴 이력이 없습니다. 그래서 저장소의 HTML 을
 * 원본으로 두고 여기서 밀어 넣습니다 — 다음 사람이 "지금 뭐가 들어가
 * 있는지" 를 git 에서 볼 수 있게.
 *
 * 왜 두 벌인가
 * ------------
 * 계정이 없는 주소는 가입 경로를 타서 **Confirm signup** 이 나가고, 계정이
 * 있으면 **Magic Link** 가 나갑니다. 한쪽만 고치면 신규 사용자는 그대로
 * 링크를 받습니다. 우리가 잡으려는 사람이 정확히 그쪽입니다.
 *
 * 토큰
 * ----
 * SUPABASE_ACCESS_TOKEN 은 개인 액세스 토큰(sbp_...)입니다. 대시보드
 * Account → Access Tokens 에서 발급합니다. **저장소에 넣지 마세요.**
 * 이 스크립트는 토큰을 출력하지 않습니다.
 */
import { readFileSync } from 'node:fs';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;
const DRY = process.argv.includes('--dry-run');

/* 번호 길이. 기본은 8 입니다.
 *
 * **화면과 같은 값이어야 합니다** — `prototypes/shared/config.js` 의
 * `otpLength`. 여기만 8 로 올리면 화면은 여섯 칸을 그려 놓고 메일은
 * 여덟 자리를 보내고, 사용자는 칸을 다 못 채워 확인 버튼을 못 누릅니다.
 * 반대로 화면만 올리면 여덟 칸 중 두 칸이 영원히 빕니다.
 *
 *   node scripts/apply-auth-email.mjs --otp-length 6
 */
const OTP_LENGTH = (() => {
  const i = process.argv.indexOf('--otp-length');
  const raw = i >= 0 ? Number(process.argv[i + 1]) : 8;
  if (!Number.isInteger(raw) || raw < 6 || raw > 10) {
    console.error('--otp-length 는 6 이상 10 이하의 정수여야 합니다 (GoTrue 제한).');
    process.exit(1);
  }
  return raw;
})();

if (!TOKEN || !REF) {
  console.error(`
필요한 환경변수가 없습니다.

  SUPABASE_ACCESS_TOKEN   대시보드 → Account → Access Tokens 에서 발급 (sbp_...)
  SUPABASE_PROJECT_REF    프로젝트 주소의 /project/<여기> 부분

예:
  SUPABASE_ACCESS_TOKEN=sbp_xxx SUPABASE_PROJECT_REF=abcd node scripts/apply-auth-email.mjs
`);
  process.exit(1);
}

/* 토큰이 헤더에 들어갈 수 있는 글자인지 먼저 봅니다.
 *
 * **가려진 값을 붙여 넣는 일이 실제로 있었습니다.** 화면에 `sbp_a702••••e41a`
 * 로 표시된 것을 그대로 복사하면 가운데 점(U+2022)이 진짜 문자로 들어옵니다.
 * 그대로 두면 node 가 fetch 안쪽에서 이렇게 던집니다 —
 *
 *   TypeError: Cannot convert argument to a ByteString because the character
 *   at index 15 has a value of 8226 which is greater than 255.
 *
 * 스택도 안 나오고 무엇이 잘못됐는지도 안 적혀 있어서, 이 줄 하나가 없으면
 * 사람이 한참을 헤맵니다. 헤더는 ASCII 만 받으므로 여기서 걸러 냅니다. */
const badChar = [...TOKEN].find((c) => c.charCodeAt(0) > 126 || c.charCodeAt(0) < 32);
if (badChar) {
  console.error(`
토큰에 쓸 수 없는 글자가 있습니다: ${JSON.stringify(badChar)} (U+${badChar.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')})

화면에 가려져 보이던 값(sbp_a702••••e41a 처럼 점이 섞인 것)을 그대로
복사하면 이렇게 됩니다. 점은 표시용이지 토큰이 아닙니다.

대시보드 Account -> Access Tokens 에서 **복사 버튼**으로 받으세요.
발급 창을 닫았으면 다시 볼 수 없으니 새로 발급하고 옛 것은 폐기하세요.
`);
  process.exit(1);
}
if (!/^sbp_/.test(TOKEN)) {
  console.error('토큰이 sbp_ 로 시작하지 않습니다. 개인 액세스 토큰이 맞는지 보세요 — anon 키나 service_role 키가 아닙니다.');
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${REF}/config/auth`;
const HEAD = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

/** 응답에 토큰이 섞여 나오지 않도록, 우리가 보는 키만 골라 찍습니다. */
const WATCH = [
  'mailer_subjects_confirmation',
  'mailer_templates_confirmation_content',
  'mailer_subjects_magic_link',
  'mailer_templates_magic_link_content',
  'mailer_otp_exp',
  'mailer_otp_length',
  'smtp_host',
  'smtp_sender_name',
  'rate_limit_email_sent',
];

async function getConfig() {
  const res = await fetch(API, { headers: HEAD });
  if (!res.ok) {
    throw new Error(
      `설정을 못 읽었습니다 (${res.status}). 토큰이 이 프로젝트의 조직에 대한 권한을 ` +
        `가지고 있는지, REF 가 맞는지 보세요.\n${(await res.text()).slice(0, 400)}`,
    );
  }
  return res.json();
}

const before = await getConfig();

/* API 의 키 이름은 판본에 따라 바뀝니다. 짐작해서 PATCH 하면 서버가 조용히
   무시하고 200 을 돌려줄 수 있으므로, 먼저 실제 응답에 있는지 봅니다. */
const missing = ['mailer_templates_confirmation_content', 'mailer_templates_magic_link_content']
  .filter((k) => !(k in before));
if (missing.length) {
  console.error(`
이 프로젝트의 설정 응답에 다음 키가 없습니다: ${missing.join(', ')}

API 판본이 달라졌을 수 있습니다. 아래는 응답에 실제로 있는 mailer/smtp 키입니다.
이 목록에 맞게 이 스크립트의 PAYLOAD 를 고치거나, 대시보드에서 직접 넣으세요.

${Object.keys(before).filter((k) => /^(mailer|smtp)/.test(k)).join('\n')}
`);
  process.exit(1);
}

const body = (f) => readFileSync(`supabase/email-templates/${f}`, 'utf8');
const SUBJECT = 'Deskfit 인증번호 {{ .Token }}';

const PAYLOAD = {
  mailer_subjects_confirmation: SUBJECT,
  mailer_templates_confirmation_content: body('confirm-signup.html'),
  mailer_subjects_magic_link: SUBJECT,
  mailer_templates_magic_link_content: body('magic-link.html'),
  /* 본문이 "1시간 안에" 라고 말합니다. 화면과 메일이 다른 시간을 말하면
     사용자는 만료를 자기 잘못으로 읽습니다. */
  mailer_otp_exp: 3600,
  mailer_otp_length: OTP_LENGTH,
};

for (const [k, v] of Object.entries(PAYLOAD)) {
  if (typeof v === 'string' && v.includes('{{ .Token }}') === false && k.includes('templates')) {
    console.error(`${k} 에 {{ .Token }} 이 없습니다. 그대로 넣으면 번호가 안 찍힙니다.`);
    process.exit(1);
  }
}

if (DRY) {
  console.log('--dry-run — 아무것도 바꾸지 않았습니다.\n');
  console.log('지금 값:');
  for (const k of WATCH) {
    const v = before[k];
    console.log(`  ${k.padEnd(40)} ${typeof v === 'string' && v.length > 60 ? v.slice(0, 57) + '…' : v}`);
  }
  console.log(`\n넣을 값: 제목 2개, 본문 2개, mailer_otp_exp=3600, mailer_otp_length=${OTP_LENGTH}`);
  process.exit(0);
}

const res = await fetch(API, { method: 'PATCH', headers: HEAD, body: JSON.stringify(PAYLOAD) });
if (!res.ok) {
  console.error(`PATCH 실패 (${res.status})\n${(await res.text()).slice(0, 600)}`);
  process.exit(1);
}

/* 200 이 들어갔다는 뜻은 아닙니다. 다시 읽어서 확인합니다. */
const after = await getConfig();
const problems = [];
for (const key of ['mailer_templates_confirmation_content', 'mailer_templates_magic_link_content']) {
  const v = after[key] || '';
  if (!v.includes('{{ .Token }}')) problems.push(`${key} 에 {{ .Token }} 이 없습니다`);
  if (/<a\s|ConfirmationURL/.test(v)) problems.push(`${key} 에 링크가 남아 있습니다`);
}
if (after.mailer_otp_length !== OTP_LENGTH) problems.push(`mailer_otp_length 가 ${after.mailer_otp_length} 입니다 (넣으려던 값은 ${OTP_LENGTH})`);
if (after.mailer_otp_exp !== 3600) problems.push(`mailer_otp_exp 가 ${after.mailer_otp_exp} 입니다 (본문은 1시간이라고 말합니다)`);

if (problems.length) {
  console.error('넣었는데 확인에서 걸렸습니다:\n  - ' + problems.join('\n  - '));
  process.exit(1);
}

console.log('메일 템플릿 두 벌 적용 완료 — Confirm signup · Magic Link');
console.log(`  제목        ${after.mailer_subjects_confirmation}`);
console.log(`  번호 길이    ${after.mailer_otp_length}`);
console.log(`  만료        ${after.mailer_otp_exp}초`);

if (!after.smtp_host) {
  console.warn(`
경고 — 커스텀 SMTP 가 없습니다.

Supabase 기본 SMTP 는 **시간당 2통** 입니다. 테스트용이라 그렇습니다.
발표나 데모에서 세 번째 사람부터 429 로 막힙니다. Resend 같은 발신
서비스를 붙이세요 — 대시보드 Project Settings → Authentication → SMTP.
`);
}

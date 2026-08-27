# 인증 메일 템플릿

온보딩의 학교 인증은 **번호**를 받아 원래 탭에 되돌려 입력하는 방식입니다.
그런데 메일에는 번호가 아니라 로그인 **링크**가 옵니다. 이 폴더는 그것을 고칩니다.

## 왜 링크가 오는가

번호가 없는 게 아닙니다. GoTrue 는 인증 메일 한 통마다 링크와 번호를
**둘 다** 만듭니다. 어느 쪽을 보여 줄지는 오직 메일 본문 템플릿이 정합니다.

Supabase 의 기본 템플릿은 링크만 찍습니다.

```html
<h2>Confirm your signup</h2>
<p>Follow this link to confirm your user:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your mail</a></p>
```

번호를 보여 주려면 본문에 `{{ .Token }}` 이 있어야 합니다. 우리 프로젝트는
템플릿을 한 번도 안 건드려서 기본값 그대로였고, 그래서 코드는 번호를
기다리는데 메일은 링크를 주는 상태였습니다.

이 설정은 마이그레이션에 안 들어갑니다 — 호스팅 프로젝트의 메일 본문은
대시보드(또는 Management API)에만 있습니다. 그래서 **저장소가 원본이고
대시보드가 사본**입니다. 고칠 일이 생기면 이 폴더의 HTML 을 고치고 다시
밀어 넣으세요. 대시보드에서 직접 고치면 git 에 아무 자국이 안 남습니다.

## 왜 링크를 아예 없애는가

메일 앱의 링크는 **앱 내장 브라우저**에서 열립니다. 세션이 온보딩을 띄운
브라우저가 아니라 그 안에 생기고, 사용자는 로그인을 마쳤는데 로그인이 안 된
화면을 보게 됩니다. 번호는 원래 탭으로 돌아오므로 그런 일이 없습니다.
링크를 남겨 두면 사람은 눌리는 쪽을 누릅니다.

리디렉트 URL 을 관리할 필요도 없어져서 로컬과 배포가 같은 코드로 돕니다.

## 어떻게 넣는가

```bash
SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=... node scripts/apply-auth-email.mjs
```

`--dry-run` 을 붙이면 지금 값만 보여 주고 아무것도 안 바꿉니다. 토큰은
대시보드 **Account → Access Tokens** 에서 발급하고, **저장소에 넣지 마세요.**

스크립트가 제목·본문 두 벌과 `mailer_otp_length` **8**, `mailer_otp_exp` 3600 을
넣고, **다시 읽어서** `{{ .Token }}` 이 들어갔는지 확인합니다. API 가 200 을
돌려줬다고 값이 들어간 것은 아니라서 그렇습니다.

### 자릿수는 두 곳에 있습니다

`mailer_otp_length` 를 바꾸면 **화면 쪽도 같이** 바꿔야 합니다 —
`prototypes/shared/config.js` 의 `otpLength`. 둘이 다르면 조용히 막힙니다:
메일에는 여덟 자리가 오는데 화면이 여섯 칸을 그리면, 사용자는 칸을 다
채울 수 없어 확인 버튼을 영원히 못 누릅니다. 반대면 두 칸이 계속 빕니다.

```bash
node scripts/apply-auth-email.mjs --otp-length 6
```

기본값은 8 입니다. GoTrue 가 받는 범위는 6~10 입니다.

손으로 넣으려면 대시보드 **Authentication → Emails**:

| 템플릿 | 언제 오는가 | 파일 |
|---|---|---|
| **Confirm signup** | 그 주소의 **첫** 인증. 계정이 이때 만들어집니다 | `confirm-signup.html` |
| **Magic Link** | 계정이 이미 있는 사람의 다음 로그인 | `magic-link.html` |

제목은 둘 다:

```
Deskfit 인증번호 {{ .Token }}
```

제목에 번호를 넣으면 메일을 열지 않고 알림만 보고 입력할 수 있습니다.

**둘 다 고쳐야 합니다.** 하나만 고치면 반쪽이 됩니다 — 처음 들어오는 사람은
전부 Confirm signup 을 받고, 그 사람들이 우리가 지금 잡으려는 사용자입니다.
탭마다 저장 버튼이 따로입니다.

## 만료 시간

본문에 "1시간" 이라고 적혀 있습니다. 대시보드의
**Authentication → Sign In / Providers → Email → Email OTP Expiration**
과 같은 값이어야 합니다(기본 3600초 = 1시간). 그 값을 바꾸면 본문도 같이
고치세요 — 화면과 메일이 다른 시간을 말하면 만료를 사용자 잘못으로 읽습니다.

## 기본 SMTP 로는 시간당 2통입니다

발신이 `noreply@mail.app.supabase.io` 면 Supabase 내장 발신이고, 프로젝트
전체에서 **시간당 약 2통** 입니다. 문서에도 테스트용이라고 적혀 있습니다.
발표에서 세 번째 사람은 조용히 429 를 받습니다.

**Project Settings → Authentication → SMTP Settings** 에서 진짜 발신을
붙이세요. Resend 무료 한도(월 3천통 정도)면 충분합니다.

## 확인

넣은 뒤 학교 주소로 한 번 받아 봅니다. 번호가 `otpLength` 만큼 보이고 링크가 없으면
된 것입니다. 코드는 이미 `/auth/v1/otp` 로 보내고 `/auth/v1/verify` 로
확인하고 있어서 고칠 것이 없습니다 — `prototypes/shared/school-auth.js`.

전체 인수인계 절차는 [docs/HANDOFF_school_email_auth.md](../../docs/HANDOFF_school_email_auth.md) 에 있습니다.

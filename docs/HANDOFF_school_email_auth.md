# Handoff — make school email verification actually work

Copy everything inside the fenced block below into Claude Code (or do it by
hand — it is written so a person can follow it too). It is written for whoever
holds **owner access to the Supabase project and push access to this repo**.

Nothing in this repository needs a code change. The whole job is Supabase
configuration, plus one script run that lives in this repo.

---

````
You have owner access to the Supabase project behind Deskfit and push access to
the repo. Onboarding's school-email step is broken in a specific way. Fix it.

## What is wrong

Onboarding asks the user for a six-digit code. The mail that arrives says
"Your sign-in link — follow the link below to sign in" and contains a link.
There is no code anywhere in it.

The client is not the problem. `prototypes/shared/school-auth.js` already POSTs
to `/auth/v1/otp` and verifies with `/auth/v1/verify` (`type: "email"`), and
`prototypes/onboarding/index.html` already renders a six-box code input, a
60-second resend cooldown and the error states. Read them before changing
anything; you will find nothing to fix there.

The problem is server-side. GoTrue mints BOTH a magic link and a six-digit token
for every one of these mails. Which one the reader sees is decided entirely by
the email body template. This project never touched its templates, so they are
still Supabase's defaults, which print only `{{ .ConfirmationURL }}`. The token
has been in every mail all along with nothing rendering it.

## What done looks like

1. A student enters a `.ac.kr` address in onboarding and presses 인증 메일 받기.
2. Within a few seconds a mail arrives whose body matches
   `supabase/email-templates/confirm-signup.html` — a teal header band reading
   메일 인증, a six-digit code in a rounded mint box, three lines of guidance,
   and **no link at all**.
3. The subject line is `Deskfit 인증번호 <the code>`.
4. Typing that code into onboarding advances the flow to the camera step, and
   `localStorage['girin.session']` holds an access token.
5. A second, different address gets a different code. Requesting again gets a
   new code. Codes are not shared or reused.
6. More than two people can do this in the same hour.

Point 6 is not padding. It is the one that will bite you at a demo — see step 3.

## Step 0 — confirm you are on the right project

`prototypes/shared/config.js` names the project the deployed app talks to. Read
the `url` field and take the subdomain — that is the project ref. Confirm your
Supabase account can open that project's dashboard. If you get "You do not have
access to this project", stop: you are signed into the wrong account, and
nothing below will work.

Committing that anon key is deliberate; the file explains why. Do not move it
and do not ever put the service_role key there.

## Step 1 — put both templates in place

There are two templates, and the one that matters most is the easy one to miss.
An address with no account yet goes down the signup path, so it receives
**Confirm signup**, not Magic Link. Fixing only Magic Link leaves every new user
exactly where they are today.

The repo holds both bodies. They are the source of truth; the dashboard is a
copy. Edit the files, not the dashboard, so the next person can see in git what
is deployed.

    supabase/email-templates/confirm-signup.html
    supabase/email-templates/magic-link.html
    supabase/email-templates/README.md

Apply them with the script in this repo. Generate a personal access token at
Supabase → Account → Access Tokens. Keep it in your shell only — it must never
reach the repo, a commit message, or a chat window.

    SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=... node scripts/apply-auth-email.mjs --dry-run
    SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=... node scripts/apply-auth-email.mjs

The script sets both subjects, both bodies, `mailer_otp_length` 8 (override with
`--otp-length N`, 6–10) and `mailer_otp_exp` 3600, then reads the config back and
fails if `{{ .Token }}` is missing or a link survived. A 200 from the API does not
prove the value landed, which is why it re-reads.

The code length lives in two places and they must agree: this script's
`--otp-length` and `otpLength` in `prototypes/shared/config.js`. If they differ the
screens fail silently — the mail carries eight digits while the form draws six
boxes, so the user can never fill it and the verify button never unlocks.

If the script reports that the Management API no longer has those keys, it
prints the key names the API actually returned. Update the payload to match, or
fall back to the dashboard: Authentication → Emails → Confirm signup and Magic
Link, paste each file into the message body, set both subjects to
`Deskfit 인증번호 {{ .Token }}`, and save each tab separately.

Do not leave a link in either body. A link in a mail opens in the mail app's own
in-app browser, so the session is created there instead of in the tab the user
started from, and they end up looking at a screen that says they are not signed
in. That is why this flow uses codes.

## Step 2 — check the OTP settings agree with the copy

Authentication → Sign In / Providers → Email:

  - Email OTP Expiration — 3600 seconds. The mail body says "1시간 안에".
    If you change one, change the other. A screen and a mail quoting different
    deadlines makes the user think expiry was their fault.
  - Email OTP Length — 6. The onboarding input has exactly six boxes.

The script sets both, but confirm them in the UI; these are the values a future
person is most likely to change without knowing what depends on them.

## Step 3 — replace the default SMTP

Check the sender address on a test mail. If it is `noreply@mail.app.supabase.io`
you are on Supabase's built-in service, which is **capped at about two emails
per hour for the whole project** and is documented as testing-only. Three people
verifying at a demo means the third one silently gets a 429.

Set up a real sender: Project Settings → Authentication → SMTP Settings. Resend
is free at roughly 3,000 mails a month and is enough. You will need to verify a
sending domain; if you do not own one yet, say so and stop here rather than
shipping a launch that dies on the third user.

While you are there, raise the email rate limit from its default so the cap is
the provider's, not Supabase's.

## Step 4 — confirm the signup guard is registered

`supabase/migrations/20260813_school_email_signup_guard.sql` defines
`public.hook_restrict_signup_to_schools`, which rejects any address that is not
`.ac.kr` or in the `school_email_domains` exception table. It only runs if it is
registered as a hook — the migration cannot do that itself.

Authentication → Hooks → Before User Created → Postgres →
`public.hook_restrict_signup_to_schools`.

Verify it is on. The browser also refuses non-school addresses, but that check
is decoration; anyone can call the auth endpoint directly. Test it: request a
code for a `@gmail.com` address and confirm the request is refused and no mail
is sent.

Also confirm the migrations in `supabase/migrations/` have actually been applied
to this project. If `school_email_domains` does not exist, they have not.

## Step 5 — test it end to end, on the deployed site

Local `file://` will not work: the origin is `null` and Supabase rejects it on
CORS. `school-auth.js` detects this and falls back to a simulated flow that
accepts any code except `000000`, so a local pass proves nothing. Use the
deployed URL, or `npx http-server . -p 8177 -c-1` and browsing over http://localhost:8177.

  1. Open onboarding, pick an egg, name it, reach the email step.
  2. Enter a real `.ac.kr` address you can read mail for.
  3. Confirm the mail matches the template: teal band, six digits, no link.
  4. Enter the code. The flow must advance to the camera step.
  5. In DevTools, confirm `localStorage['girin.session']` has an
     `access_token` and the right `email`.
  6. Repeat with a second address. The two codes must differ.
  7. Request a code twice for the same address. The second must supersede the
     first, and the resend button must be disabled for 60 seconds in between.
  8. Enter a wrong code and confirm the error reads
     "번호가 맞지 않아요" rather than raw English from the server.

Report the actual result of each of these eight, including the sender address
you saw in step 3. If any of them fails, stop and say which — do not work around
it.

## Do not touch

  - `prototypes/shared/school-auth.js` and the onboarding step markup. They are
    already correct. If you believe otherwise, say what you observed before
    editing.
  - The `.ac.kr` rule, in either the client or `is_school_email`. They are
    deliberately the same rule in two places; changing one is how they drift,
    and the drift is always toward permissive.
  - The anon key in `prototypes/shared/config.js`.
  - Redirect URLs and Site URL. This flow uses codes, not links, so they are
    irrelevant here. Do not spend time on them.

## If it still sends a link

  - The subject changed but the body did not — you saved one dashboard tab and
    not the other. Each template tab saves separately.
  - The body is right but the mail is still a link — you fixed Magic Link and
    the test address had no account, so it received Confirm signup. Fix both.
  - Nothing changed at all — the PATCH went to a different project. Check the
    ref against `config.js`.
  - Mail never arrives — check Authentication → Logs, then the two-per-hour cap
    in step 3.

Start by reading `supabase/email-templates/README.md` and
`prototypes/shared/school-auth.js`, then work through the steps in order and
report what you find at each one.
````

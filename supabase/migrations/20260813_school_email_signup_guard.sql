-- ============================================================================
-- 20260813_school_email_signup_guard.sql
--
-- Only Korean university email addresses may create an account.
--
-- The browser already refuses non-school addresses before it asks for a code,
-- but that check is decoration: anyone can call the auth endpoint directly.
-- This is the check that actually holds, and it runs before the user row is
-- written, so a rejected address never becomes an account and never receives
-- a mail.
--
-- `.ac.kr` is not a vanity suffix in Korea. KISA only issues it to accredited
-- educational institutions, which makes the suffix itself a usable gate --
-- far better than maintaining a list of every university in the country.
-- Schools that legitimately sit outside it (Sungkyunkwan uses skku.edu) go in
-- the exception table, so adding one is a migration rather than a code change.
--
-- Raw email addresses stay in auth.users. Nothing here copies them into a
-- public table.
-- ============================================================================

create table if not exists public.school_email_domains (
  email_domain text primary key,
  school_name  text not null,
  note         text,
  created_at   timestamptz not null default now(),
  check (email_domain = lower(email_domain) and email_domain !~ '[[:space:]@]')
);

comment on table public.school_email_domains is
  'Schools accepted despite not ending in .ac.kr. Everything under .ac.kr is '
  'accepted without an entry here.';

insert into public.school_email_domains (email_domain, school_name, note) values
  ('skku.edu', '성균관대학교', '.ac.kr 을 쓰지 않습니다')
on conflict (email_domain) do update
  set school_name = excluded.school_name, note = excluded.note;

-- Nobody but the auth admin reads this. It is not secret, but it is also not
-- the client's business, and an unnecessary grant is an unnecessary decision.
revoke all on public.school_email_domains from anon, authenticated;

/**
 * Is this address allowed to open an account?
 *
 * Split out from the hook so it can be tested with a plain select, and so the
 * session-verification path can reuse the exact same rule. Two copies of an
 * authorization rule drift, and the drift is always in the permissive
 * direction.
 */
create or replace function public.is_school_email(p_email text)
returns boolean
language sql
stable
set search_path = public
as $fn$
  with d as (
    select split_part(lower(trim(p_email)), '@', 2) as domain
  )
  select
    d.domain <> ''
    and (
      -- `%.ac.kr` requires the dot, so a lookalike such as `notac.kr` fails.
      d.domain = 'ac.kr'
      or d.domain like '%.ac.kr'
      or exists (select 1 from public.school_email_domains s
                  where s.email_domain = d.domain)
    )
  from d;
$fn$;

comment on function public.is_school_email(text) is
  'True when the address belongs to an accredited Korean university.';

/**
 * before-user-created hook.
 *
 * Returning an empty object lets the signup through; returning an error object
 * stops it. 403 rather than 400 -- the request was well formed, the address
 * just is not allowed, and a client showing a generic "bad request" for that
 * would be telling the user the wrong thing.
 */
create or replace function public.hook_restrict_signup_to_schools(event jsonb)
returns jsonb
language plpgsql
set search_path = public
as $fn$
declare
  v_email text := event -> 'user' ->> 'email';
begin
  -- Anonymous sign-in carries no address. This hook has no opinion on it;
  -- whether anonymous users are allowed at all is a dashboard setting.
  if v_email is null or v_email = '' then
    return '{}'::jsonb;
  end if;

  if not public.is_school_email(v_email) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        -- Reaches the user as-is, so it is written for the user.
        'message', '학교 이메일이 아닙니다. ac.kr 로 끝나는 주소가 필요합니다.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$fn$;

-- The auth service calls this as supabase_auth_admin. No one else may.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_restrict_signup_to_schools(jsonb)
  to supabase_auth_admin;
revoke execute on function public.hook_restrict_signup_to_schools(jsonb)
  from authenticated, anon, public;

-- The hook body reads these while running as supabase_auth_admin.
grant execute on function public.is_school_email(text) to supabase_auth_admin;
grant select on public.school_email_domains to supabase_auth_admin;
revoke execute on function public.is_school_email(text) from anon, public;

-- ----------------------------------------------------------------------------
-- After running this migration, register the hook in the dashboard:
--   Authentication -> Hooks -> Before User Created
--     -> Postgres -> public.hook_restrict_signup_to_schools
-- Until it is registered the function exists but nothing calls it, and any
-- address can sign up.
--
-- Check it without sending mail:
--   select public.is_school_email('hong@mju.ac.kr');   -- t
--   select public.is_school_email('a@cs.snu.ac.kr');   -- t  (학과 서브도메인)
--   select public.is_school_email('a@skku.edu');       -- t  (예외 표)
--   select public.is_school_email('a@gmail.com');      -- f
--   select public.is_school_email('a@notac.kr');       -- f
-- ----------------------------------------------------------------------------

-- ============================================================================
-- 20260730_campus_school_verification.sql
-- Run after schema.sql and the existing campus migrations.
-- This migration gates campus membership and contribution writes by a verified
-- Supabase Auth email at a reviewed preset-school domain. Raw emails stay in
-- auth.users and are never copied into public tables.
-- ============================================================================

create table if not exists public.campus_school_domains (
  school_id text primary key references public.campus_schools(id) on delete cascade,
  email_domain text not null unique,
  created_at timestamptz not null default now(),
  check (email_domain = lower(email_domain) and email_domain !~ '[[:space:]@]')
);

-- Reviewed preset-school domains. Add or change domains only through a migration.
insert into public.campus_school_domains (school_id, email_domain)
values
  ('snu', 'snu.ac.kr'),
  ('yonsei', 'yonsei.ac.kr'),
  ('korea', 'korea.ac.kr'),
  ('sogang', 'sogang.ac.kr'),
  ('skku', 'skku.edu'),
  ('hanyang', 'hanyang.ac.kr'),
  ('cau', 'cau.ac.kr'),
  ('khu', 'khu.ac.kr'),
  ('hufs', 'hufs.ac.kr'),
  ('uos', 'uos.ac.kr')
on conflict (school_id) do update set email_domain = excluded.email_domain;

create table if not exists public.campus_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school_id text not null references public.campus_schools(id),
  email_domain text not null,
  verified_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email_domain = lower(email_domain) and email_domain !~ '[[:space:]@]')
);

alter table public.campus_verifications enable row level security;

drop policy if exists campus_verifications_select_self on public.campus_verifications;
create policy campus_verifications_select_self
  on public.campus_verifications for select to authenticated
  using (user_id = auth.uid());

revoke all on public.campus_school_domains from anon, authenticated;
revoke insert, update, delete on public.campus_verifications from anon, authenticated;
revoke all on public.campus_verifications from anon;

create or replace function public.campus_my_verification()
returns table (school_id text, email_domain text, verified_at timestamptz)
language sql stable security definer set search_path = public as $fn$
  select v.school_id, v.email_domain, v.verified_at
    from public.campus_verifications v
   where v.user_id = auth.uid();
$fn$;

create or replace function public.campus_verify_school(p_school_id text)
returns table (verified boolean, reason text)
language plpgsql security definer set search_path = public, auth as $fn$
declare
  v_email text;
  v_domain text;
  v_allowed_school text;
begin
  if auth.uid() is null then
    return query select false, 'authentication_required'::text;
    return;
  end if;

  select lower(u.email)
    into v_email
    from auth.users u
   where u.id = auth.uid()
     and u.email_confirmed_at is not null;

  if v_email is null or position('@' in v_email) = 0 then
    return query select false, 'email_not_verified'::text;
    return;
  end if;

  v_domain := split_part(v_email, '@', 2);
  select d.school_id
    into v_allowed_school
    from public.campus_school_domains d
   where d.email_domain = v_domain;

  if v_allowed_school is distinct from p_school_id then
    return query select false, 'domain_mismatch'::text;
    return;
  end if;

  insert into public.campus_verifications (user_id, school_id, email_domain)
  values (auth.uid(), p_school_id, v_domain)
  on conflict (user_id) do update
    set school_id = excluded.school_id,
        email_domain = excluded.email_domain,
        verified_at = now(),
        updated_at = now();

  return query select true, 'verified'::text;
end; $fn$;

create or replace function public.campus_require_verified_school(p_school_id text)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not exists (
    select 1
      from public.campus_verifications v
     where v.user_id = auth.uid()
       and v.school_id = p_school_id
  ) then
    raise exception 'school_verification_required';
  end if;
end; $fn$;

-- Preserve the prior implementations behind private names, then replace the
-- client-facing RPCs with authorization wrappers. The guards are server-side,
-- so modified browser requests cannot bypass them.
do $do$
begin
  if to_regprocedure('public.select_campus_school(text)') is not null
     and to_regprocedure('public.select_campus_school_unverified(text)') is null then
    alter function public.select_campus_school(text)
      rename to select_campus_school_unverified;
  end if;

  if to_regprocedure('public.apply_campus_contribution(text,text,text,text)') is not null
     and to_regprocedure('public.apply_campus_contribution_unverified(text,text,text,text)') is null then
    alter function public.apply_campus_contribution(text,text,text,text)
      rename to apply_campus_contribution_unverified;
  end if;
end; $do$;

create or replace function public.select_campus_school(p_school_id text)
returns jsonb language plpgsql security definer set search_path = public as $fn$
begin
  perform public.campus_require_verified_school(p_school_id);
  return public.select_campus_school_unverified(p_school_id);
end; $fn$;

create or replace function public.apply_campus_contribution(
  p_event_id text,
  p_territory_id text,
  p_session_id text,
  p_kind text
) returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_school_id text;
begin
  select school_id into v_school_id
    from public.campus_memberships
   where user_id = auth.uid();

  if v_school_id is null then
    return jsonb_build_object('result', 'no_membership', 'eventId', p_event_id, 'serverTime', now());
  end if;

  perform public.campus_require_verified_school(v_school_id);
  return public.apply_campus_contribution_unverified(
    p_event_id, p_territory_id, p_session_id, p_kind
  );
end; $fn$;

revoke all on function public.select_campus_school_unverified(text)
  from public, anon, authenticated;
revoke all on function public.apply_campus_contribution_unverified(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.campus_my_verification() to authenticated;
grant execute on function public.campus_verify_school(text) to authenticated;
grant execute on function public.select_campus_school(text) to authenticated;
grant execute on function public.apply_campus_contribution(text, text, text, text)
  to authenticated;


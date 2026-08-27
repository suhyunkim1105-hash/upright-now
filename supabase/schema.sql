-- Deskfit: Supabase prototype schema for two-person rooms.
-- Review and test policies before production use.

create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  subject text,
  goal text,
  duration_seconds integer not null default 1500
    check (duration_seconds in (180, 900, 1500, 3000)),
  status text not null default 'waiting'
    check (status in ('waiting', 'running', 'resting', 'completed', 'closed')),
  boss_hp integer not null default 2000 check (boss_hp >= 0),
  boss_max_hp integer not null default 2000 check (boss_max_hp > 0),
  shield integer not null default 0 check (shield >= 0),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 12),
  role text not null default 'member' check (role in ('host', 'member')),
  state text not null default 'joining'
    check (state in ('joining', 'ready', 'focusing', 'resting', 'away', 'completed')),
  character_stage integer not null default 1 check (character_stage between 1 and 6),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.room_events_processed (
  event_id uuid primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (
    event_type in ('recovery_earned', 'stretch_completed', 'session_completed', 'giraffe_sync')
  ),
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();

drop trigger if exists room_members_set_updated_at on public.room_members;
create trigger room_members_set_updated_at
before update on public.room_members
for each row execute function public.set_updated_at();

create or replace function public.is_room_member(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_members
    where room_id = target_room_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_room_host(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rooms
    where id = target_room_id
      and host_user_id = auth.uid()
  );
$$;

create or replace function public.create_room(
  p_code text,
  p_nickname text,
  p_subject text default null,
  p_goal text default null,
  p_duration_seconds integer default 1500
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_code !~ '^[A-Z0-9]{6}$' then
    raise exception 'invalid room code';
  end if;

  if char_length(trim(p_nickname)) < 1 or char_length(trim(p_nickname)) > 12 then
    raise exception 'invalid nickname';
  end if;

  if p_duration_seconds not in (180, 900, 1500, 3000) then
    raise exception 'invalid duration';
  end if;

  insert into public.rooms (
    code, host_user_id, subject, goal, duration_seconds
  ) values (
    p_code, auth.uid(), nullif(trim(p_subject), ''), nullif(trim(p_goal), ''), p_duration_seconds
  ) returning id into v_room_id;

  insert into public.room_members (
    room_id, user_id, nickname, role, state
  ) values (
    v_room_id, auth.uid(), trim(p_nickname), 'host', 'ready'
  );

  return v_room_id;
end;
$$;

create or replace function public.join_room(
  p_code text,
  p_nickname text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms%rowtype;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if char_length(trim(p_nickname)) < 1 or char_length(trim(p_nickname)) > 12 then
    raise exception 'invalid nickname';
  end if;

  select * into v_room
  from public.rooms
  where code = upper(p_code)
  for update;

  if not found then
    raise exception 'room not found';
  end if;

  if v_room.status <> 'waiting' then
    raise exception 'room is not waiting';
  end if;

  select count(*) into v_count
  from public.room_members
  where room_id = v_room.id;

  if v_count >= 2 then
    raise exception 'room is full';
  end if;

  insert into public.room_members (
    room_id, user_id, nickname, role, state
  ) values (
    v_room.id, auth.uid(), trim(p_nickname), 'member', 'joining'
  )
  on conflict (room_id, user_id)
  do update set nickname = excluded.nickname, updated_at = now();

  return v_room.id;
end;
$$;

create or replace function public.apply_room_damage(
  p_room_id uuid,
  p_event_id uuid,
  p_event_type text,
  p_damage integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hp integer;
  v_inserted integer;
begin
  if not public.is_room_member(p_room_id) then
    raise exception 'not a room member';
  end if;

  if p_event_type not in ('recovery_earned', 'session_completed', 'giraffe_sync') then
    raise exception 'invalid event type';
  end if;

  if p_damage < 0 or p_damage > 250 then
    raise exception 'invalid damage';
  end if;

  insert into public.room_events_processed (
    event_id, room_id, user_id, event_type
  ) values (
    p_event_id, p_room_id, auth.uid(), p_event_type
  ) on conflict do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select boss_hp into v_hp from public.rooms where id = p_room_id;
    return v_hp;
  end if;

  update public.rooms
  set boss_hp = greatest(0, boss_hp - p_damage)
  where id = p_room_id
  returning boss_hp into v_hp;

  return v_hp;
end;
$$;

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_events_processed enable row level security;

-- Room members can read their room.
drop policy if exists rooms_select_member on public.rooms;
create policy rooms_select_member
on public.rooms
for select
to authenticated
using (public.is_room_member(id) or host_user_id = auth.uid());

-- The host can update room lifecycle fields. Damage should use RPC.
drop policy if exists rooms_update_host on public.rooms;
create policy rooms_update_host
on public.rooms
for update
to authenticated
using (host_user_id = auth.uid())
with check (host_user_id = auth.uid());

-- Members can see other members in the same room.
drop policy if exists room_members_select_member on public.room_members;
create policy room_members_select_member
on public.room_members
for select
to authenticated
using (public.is_room_member(room_id));

-- A member can update only their own presence row.
drop policy if exists room_members_update_self on public.room_members;
create policy room_members_update_self
on public.room_members
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Inserts are performed through create_room/join_room RPC.
-- Processed event rows are readable only by room members.
drop policy if exists room_events_select_member on public.room_events_processed;
create policy room_events_select_member
on public.room_events_processed
for select
to authenticated
using (public.is_room_member(room_id));

grant execute on function public.create_room(text, text, text, text, integer) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;
grant execute on function public.apply_room_damage(uuid, uuid, text, integer) to authenticated;

-- 스트레칭 완료 → 공동 방어막 +15 (원자적, event_id 중복 차단)
create or replace function public.apply_room_shield(
  p_room_id uuid,
  p_event_id uuid,
  p_amount integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shield integer;
  v_inserted integer;
begin
  if not public.is_room_member(p_room_id) then
    raise exception 'not a room member';
  end if;

  if p_amount < 0 or p_amount > 50 then
    raise exception 'invalid shield amount';
  end if;

  insert into public.room_events_processed (
    event_id, room_id, user_id, event_type
  ) values (
    p_event_id, p_room_id, auth.uid(), 'stretch_completed'
  ) on conflict do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select shield into v_shield from public.rooms where id = p_room_id;
    return v_shield;
  end if;

  update public.rooms
  set shield = shield + p_amount
  where id = p_room_id
  returning shield into v_shield;

  return v_shield;
end;
$$;

grant execute on function public.apply_room_shield(uuid, uuid, integer) to authenticated;

-- V1.2: 사용자 지정 세션 길이(180~7200초)는 별도 마이그레이션으로 적용합니다.
-- 라이브 DB 적용: supabase/migrations/20260726_expand_room_duration.sql 전체를
-- Supabase SQL Editor 에 붙여넣어 실행 (멱등 — 여러 번 실행해도 안전).

-- =============================================================================
-- Darts Tournament — Supabase schema (idempotent: safe to re-run)
-- Run once in Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Security model
--   * The browser only ever holds the public anon key.
--   * Anyone may READ tournament snapshots / dart logs (guests are read-only).
--   * Nobody may WRITE tables directly: every write goes through SECURITY DEFINER
--     RPCs that require a session token issued by admin_login / scorer_login.
--   * Credentials are bcrypt-hashed (pgcrypto) in a table the anon role cannot read.
--   * Rotating the Scorer PIN bumps pin_version and revokes every scorer session.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables
create table if not exists public.tournaments (
  id               text primary key check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  state            jsonb       not null,
  version          bigint      not null default 1,
  updated_at_ms    bigint      not null default (extract(epoch from now()) * 1000)::bigint,
  origin_client_id text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Tiny row mirrored on every save; clients subscribe to it via postgres_changes
-- as a reliable catch-up signal (the full snapshot can be large).
create table if not exists public.tournament_heads (
  id               text primary key references public.tournaments(id) on delete cascade,
  version          bigint not null,
  updated_at_ms    bigint not null,
  origin_client_id text
);

create table if not exists public.tournament_secrets (
  tournament_id       text primary key references public.tournaments(id) on delete cascade,
  admin_username      text not null,
  admin_password_hash text not null,
  scorer_pin_hash     text not null,
  pin_version         integer not null default 1
);

create table if not exists public.tournament_sessions (
  token         uuid primary key default gen_random_uuid(),
  tournament_id text not null references public.tournaments(id) on delete cascade,
  role          text not null check (role in ('admin', 'scorer')),
  pin_version   integer,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '24 hours'
);
create index if not exists tournament_sessions_tournament_idx on public.tournament_sessions (tournament_id);

create table if not exists public.dart_throws (
  tournament_id text   not null references public.tournaments(id) on delete cascade,
  id            text   not null,
  match_id      text   not null,
  thrown_at_ms  bigint not null,
  payload       jsonb  not null,
  created_at    timestamptz not null default now(),
  primary key (tournament_id, id)
);
create index if not exists dart_throws_match_idx on public.dart_throws (tournament_id, match_id);

-- ---------------------------------------------------------------- row level security
alter table public.tournaments         enable row level security;
alter table public.tournament_heads    enable row level security;
alter table public.tournament_secrets  enable row level security;
alter table public.tournament_sessions enable row level security;
alter table public.dart_throws         enable row level security;

drop policy if exists "public read tournaments" on public.tournaments;
create policy "public read tournaments" on public.tournaments for select to anon, authenticated using (true);

drop policy if exists "public read heads" on public.tournament_heads;
create policy "public read heads" on public.tournament_heads for select to anon, authenticated using (true);

drop policy if exists "public read throws" on public.dart_throws;
create policy "public read throws" on public.dart_throws for select to anon, authenticated using (true);

-- secrets & sessions: RLS on with NO policies => invisible to anon/authenticated.
revoke all on public.tournament_secrets  from anon, authenticated;
revoke all on public.tournament_sessions from anon, authenticated;
revoke insert, update, delete on public.tournaments, public.tournament_heads, public.dart_throws from anon, authenticated;
grant select on public.tournaments, public.tournament_heads, public.dart_throws to anon, authenticated;

-- ---------------------------------------------------------------- realtime publication
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tournament_heads'
  ) then
    alter publication supabase_realtime add table public.tournament_heads;
  end if;
end $$;

-- ---------------------------------------------------------------- helpers
-- Returns the session row if the token is valid for this tournament (scorer tokens
-- additionally require the current pin_version => instant kickout after rotation).
create or replace function public._session_for(p_token text, p_id text)
returns public.tournament_sessions
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s public.tournament_sessions;
  current_pin integer;
begin
  begin
    select * into s from public.tournament_sessions
     where token = p_token::uuid and tournament_id = p_id and expires_at > now();
  exception when invalid_text_representation then
    return null;
  end;
  if s.token is null then
    return null;
  end if;
  if s.role = 'scorer' then
    select pin_version into current_pin from public.tournament_secrets where tournament_id = p_id;
    if current_pin is distinct from s.pin_version then
      return null;
    end if;
  end if;
  return s;
end $$;

-- ---------------------------------------------------------------- RPCs
-- Create a tournament with admin credentials + scorer PIN. Returns an admin session token.
create or replace function public.create_tournament(
  p_id text, p_admin_username text, p_admin_password text, p_scorer_pin text, p_state jsonb, p_client_id text default null
) returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  tok uuid;
begin
  if exists (select 1 from public.tournament_secrets where tournament_id = p_id) then
    raise exception 'tournament_exists' using errcode = 'P0001';
  end if;
  if coalesce(length(trim(p_admin_username)), 0) < 3 then
    raise exception 'invalid_username' using errcode = 'P0001';
  end if;
  if coalesce(length(p_admin_password), 0) < 6 then
    raise exception 'weak_password' using errcode = 'P0001';
  end if;
  if p_scorer_pin !~ '^[0-9]{4}$' then
    raise exception 'invalid_pin' using errcode = 'P0001';
  end if;

  insert into public.tournaments (id, state, version, updated_at_ms, origin_client_id)
  values (p_id, p_state, 1, now_ms, p_client_id)
  on conflict (id) do update set state = excluded.state, version = 1, updated_at_ms = excluded.updated_at_ms,
    origin_client_id = excluded.origin_client_id, updated_at = now();

  insert into public.tournament_heads (id, version, updated_at_ms, origin_client_id)
  values (p_id, 1, now_ms, p_client_id)
  on conflict (id) do update set version = 1, updated_at_ms = excluded.updated_at_ms, origin_client_id = excluded.origin_client_id;

  insert into public.tournament_secrets (tournament_id, admin_username, admin_password_hash, scorer_pin_hash, pin_version)
  values (p_id, trim(p_admin_username), crypt(p_admin_password, gen_salt('bf', 10)), crypt(p_scorer_pin, gen_salt('bf', 8)), 1);

  insert into public.tournament_sessions (tournament_id, role) values (p_id, 'admin') returning token into tok;
  return tok::text;
end $$;

-- Admin login: returns a session token, or raises 'invalid_credentials'.
create or replace function public.admin_login(p_id text, p_username text, p_password text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  sec public.tournament_secrets;
  tok uuid;
begin
  select * into sec from public.tournament_secrets where tournament_id = p_id;
  if sec.tournament_id is null
     or sec.admin_username <> trim(p_username)
     or sec.admin_password_hash <> crypt(p_password, sec.admin_password_hash) then
    perform pg_sleep(0.6); -- slow down brute force
    raise exception 'invalid_credentials' using errcode = 'P0001';
  end if;
  delete from public.tournament_sessions where tournament_id = p_id and expires_at <= now();
  insert into public.tournament_sessions (tournament_id, role) values (p_id, 'admin') returning token into tok;
  return tok::text;
end $$;

-- Scorer login with the 4-digit PIN: returns { token, pinVersion } or raises 'invalid_pin'.
create or replace function public.scorer_login(p_id text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  sec public.tournament_secrets;
  tok uuid;
begin
  select * into sec from public.tournament_secrets where tournament_id = p_id;
  if sec.tournament_id is null or sec.scorer_pin_hash <> crypt(p_pin, sec.scorer_pin_hash) then
    perform pg_sleep(0.6);
    raise exception 'invalid_pin' using errcode = 'P0001';
  end if;
  insert into public.tournament_sessions (tournament_id, role, pin_version)
  values (p_id, 'scorer', sec.pin_version) returning token into tok;
  return jsonb_build_object('token', tok::text, 'pinVersion', sec.pin_version);
end $$;

-- Check a stored session (e.g. after refresh). Returns { valid, role, pinVersion }.
create or replace function public.validate_session(p_token text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s public.tournament_sessions;
begin
  s := public._session_for(p_token, p_id);
  if s.token is null then
    return jsonb_build_object('valid', false);
  end if;
  return jsonb_build_object('valid', true, 'role', s.role, 'pinVersion', s.pin_version);
end $$;

-- Admin only: set a new Scorer PIN, bump pin_version, revoke all scorer sessions.
create or replace function public.rotate_scorer_pin(p_token text, p_id text, p_new_pin text)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s public.tournament_sessions;
  new_version integer;
begin
  s := public._session_for(p_token, p_id);
  if s.token is null or s.role <> 'admin' then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  if p_new_pin !~ '^[0-9]{4}$' then
    raise exception 'invalid_pin' using errcode = 'P0001';
  end if;
  update public.tournament_secrets
     set scorer_pin_hash = crypt(p_new_pin, gen_salt('bf', 8)), pin_version = pin_version + 1
   where tournament_id = p_id
  returning pin_version into new_version;
  delete from public.tournament_sessions where tournament_id = p_id and role = 'scorer';
  return new_version;
end $$;

-- Admin only: change admin username / password.
create or replace function public.update_admin_credentials(p_token text, p_id text, p_username text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s public.tournament_sessions;
begin
  s := public._session_for(p_token, p_id);
  if s.token is null or s.role <> 'admin' then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  if coalesce(length(trim(p_username)), 0) < 3 or coalesce(length(p_password), 0) < 6 then
    raise exception 'invalid_credentials_format' using errcode = 'P0001';
  end if;
  update public.tournament_secrets
     set admin_username = trim(p_username), admin_password_hash = crypt(p_password, gen_salt('bf', 10))
   where tournament_id = p_id;
  return true;
end $$;

-- Admin/scorer: persist a full snapshot if strictly newer. Returns { ok, version, reason? }.
create or replace function public.save_tournament_state(
  p_token text, p_id text, p_state jsonb, p_version bigint, p_updated_at_ms bigint, p_client_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s public.tournament_sessions;
  current_version bigint;
begin
  s := public._session_for(p_token, p_id);
  if s.token is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  select version into current_version from public.tournaments where id = p_id for update;
  if current_version is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if p_version <= current_version then
    return jsonb_build_object('ok', false, 'reason', 'stale_version', 'version', current_version);
  end if;

  update public.tournaments
     set state = p_state, version = p_version, updated_at_ms = p_updated_at_ms,
         origin_client_id = p_client_id, updated_at = now()
   where id = p_id;
  update public.tournament_heads
     set version = p_version, updated_at_ms = p_updated_at_ms, origin_client_id = p_client_id
   where id = p_id;
  return jsonb_build_object('ok', true, 'version', p_version);
end $$;

-- Admin/scorer: upsert dart throw log rows (array of DartThrow JSON objects).
create or replace function public.append_dart_throws(p_token text, p_id text, p_throws jsonb)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s public.tournament_sessions;
  n integer;
begin
  s := public._session_for(p_token, p_id);
  if s.token is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  insert into public.dart_throws (tournament_id, id, match_id, thrown_at_ms, payload)
  select p_id, t->>'id', t->>'matchId', coalesce((t->>'timestamp')::bigint, 0), t
    from jsonb_array_elements(p_throws) as t
   where t ? 'id' and t ? 'matchId'
  on conflict (tournament_id, id) do update
    set payload = excluded.payload, match_id = excluded.match_id, thrown_at_ms = excluded.thrown_at_ms;
  get diagnostics n = row_count;
  return n;
end $$;

-- Admin only: wipe a tournament completely (state, logs, credentials, sessions).
create or replace function public.delete_tournament(p_token text, p_id text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s public.tournament_sessions;
begin
  s := public._session_for(p_token, p_id);
  if s.token is null or s.role <> 'admin' then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  delete from public.tournaments where id = p_id;
  return true;
end $$;

-- ---------------------------------------------------------------- function grants
revoke all on function public._session_for(text, text) from public, anon, authenticated;
grant execute on function public.create_tournament(text, text, text, text, jsonb, text) to anon, authenticated;
grant execute on function public.admin_login(text, text, text)                         to anon, authenticated;
grant execute on function public.scorer_login(text, text)                              to anon, authenticated;
grant execute on function public.validate_session(text, text)                          to anon, authenticated;
grant execute on function public.rotate_scorer_pin(text, text, text)                   to anon, authenticated;
grant execute on function public.update_admin_credentials(text, text, text, text)      to anon, authenticated;
grant execute on function public.save_tournament_state(text, text, jsonb, bigint, bigint, text) to anon, authenticated;
grant execute on function public.append_dart_throws(text, text, jsonb)                 to anon, authenticated;
grant execute on function public.delete_tournament(text, text)                         to anon, authenticated;

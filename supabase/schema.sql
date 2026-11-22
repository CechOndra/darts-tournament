-- =============================================================================
-- Darts Tournament — Supabase schema v2 (idempotent: safe to re-run, upgrades v1)
-- Run in Supabase Dashboard -> SQL Editor -> New query -> paste all -> Run.
--
-- Security model
--   * The browser only ever holds the public publishable/anon key.
--   * Anyone may READ tournament snapshots, the tournament directory and dart logs.
--   * Nobody may WRITE tables directly: every write goes through SECURITY DEFINER
--     RPCs that require a session token.
--   * ONE host (admin) account for the whole app, claimed once in /#/admin.
--     Host sessions may manage every tournament.
--   * Each tournament has its own 4-digit Scorer PIN. Rotating it bumps
--     pin_version and revokes all scorer sessions of that tournament.
--   * Credentials are bcrypt-hashed (pgcrypto) in tables the anon role cannot read.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tables
create table if not exists public.tournaments (
  id               text primary key check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  name             text        not null default 'Tournament',
  archived         boolean     not null default false,
  state            jsonb       not null,
  version          bigint      not null default 1,
  updated_at_ms    bigint      not null default (extract(epoch from now()) * 1000)::bigint,
  origin_client_id text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
-- v1 -> v2 upgrade
alter table public.tournaments add column if not exists name text not null default 'Tournament';
alter table public.tournaments add column if not exists archived boolean not null default false;

-- Tiny row mirrored on every save; clients subscribe via postgres_changes as a catch-up signal.
create table if not exists public.tournament_heads (
  id               text primary key references public.tournaments(id) on delete cascade,
  version          bigint not null,
  updated_at_ms    bigint not null,
  origin_client_id text
);

-- Single-row app settings: which tournament every stage / scorer / guest device follows.
create table if not exists public.app_settings (
  id                   boolean primary key default true check (id),
  active_tournament_id text references public.tournaments(id) on delete set null,
  updated_at           timestamptz not null default now()
);
insert into public.app_settings (id) values (true) on conflict (id) do nothing;

-- Single-row host account.
create table if not exists public.app_host (
  id            boolean primary key default true check (id),
  username      text not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create table if not exists public.tournament_secrets (
  tournament_id   text primary key references public.tournaments(id) on delete cascade,
  scorer_pin_hash text not null,
  pin_version     integer not null default 1
);
-- v1 -> v2 upgrade: per-tournament admin credentials replaced by the host account
alter table public.tournament_secrets drop column if exists admin_username;
alter table public.tournament_secrets drop column if exists admin_password_hash;

create table if not exists public.tournament_sessions (
  token         uuid primary key default gen_random_uuid(),
  tournament_id text references public.tournaments(id) on delete cascade, -- null for host sessions
  role          text not null check (role in ('admin', 'scorer')),
  pin_version   integer,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '24 hours'
);
alter table public.tournament_sessions alter column tournament_id drop not null;
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
alter table public.app_settings        enable row level security;
alter table public.app_host            enable row level security;
alter table public.tournament_secrets  enable row level security;
alter table public.tournament_sessions enable row level security;
alter table public.dart_throws         enable row level security;

drop policy if exists "public read tournaments" on public.tournaments;
create policy "public read tournaments" on public.tournaments for select to anon, authenticated using (true);

drop policy if exists "public read heads" on public.tournament_heads;
create policy "public read heads" on public.tournament_heads for select to anon, authenticated using (true);

drop policy if exists "public read app settings" on public.app_settings;
create policy "public read app settings" on public.app_settings for select to anon, authenticated using (true);

drop policy if exists "public read throws" on public.dart_throws;
create policy "public read throws" on public.dart_throws for select to anon, authenticated using (true);

-- host, secrets & sessions: RLS on with NO policies => invisible to anon/authenticated.
revoke all on public.app_host            from anon, authenticated;
revoke all on public.tournament_secrets  from anon, authenticated;
revoke all on public.tournament_sessions from anon, authenticated;
revoke insert, update, delete on public.tournaments, public.tournament_heads, public.app_settings, public.dart_throws
  from anon, authenticated;
grant select on public.tournaments, public.tournament_heads, public.app_settings, public.dart_throws to anon, authenticated;

-- ---------------------------------------------------------------- realtime publication
do $$
declare
  t text;
begin
  foreach t in array array['tournament_heads', 'app_settings'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- drop v1 functions
drop function if exists public.create_tournament(text, text, text, text, jsonb, text);
drop function if exists public.admin_login(text, text, text);
drop function if exists public.update_admin_credentials(text, text, text, text);

-- ---------------------------------------------------------------- helpers
-- Valid, unexpired host session (or null).
create or replace function public._host_session(p_token text)
returns public.tournament_sessions
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s public.tournament_sessions;
begin
  begin
    select * into s from public.tournament_sessions
     where token = p_token::uuid and role = 'admin' and expires_at > now();
  exception when invalid_text_representation then
    return null;
  end;
  if s.token is null then
    return null;
  end if;
  return s;
end $$;

-- Session allowed to write tournament p_id: any host session, or a scorer session of
-- that tournament whose pin_version is current (=> instant kickout after rotation).
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
    select * into s from public.tournament_sessions where token = p_token::uuid and expires_at > now();
  exception when invalid_text_representation then
    return null;
  end;
  if s.token is null then
    return null;
  end if;
  if s.role = 'admin' then
    return s;
  end if;
  if s.tournament_id is distinct from p_id then
    return null;
  end if;
  select pin_version into current_pin from public.tournament_secrets where tournament_id = p_id;
  if current_pin is distinct from s.pin_version then
    return null;
  end if;
  return s;
end $$;

-- ---------------------------------------------------------------- host account RPCs
create or replace function public.host_status()
returns jsonb
language sql
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object('claimed', exists (select 1 from public.app_host));
$$;

-- First visitor of /#/admin claims the host account. Returns a host session token.
create or replace function public.claim_host(p_username text, p_password text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  tok uuid;
begin
  if exists (select 1 from public.app_host) then
    raise exception 'host_already_claimed' using errcode = 'P0001';
  end if;
  if coalesce(length(trim(p_username)), 0) < 3 then
    raise exception 'invalid_username' using errcode = 'P0001';
  end if;
  if coalesce(length(p_password), 0) < 6 then
    raise exception 'weak_password' using errcode = 'P0001';
  end if;
  insert into public.app_host (id, username, password_hash)
  values (true, trim(p_username), crypt(p_password, gen_salt('bf', 10)));
  insert into public.tournament_sessions (role) values ('admin') returning token into tok;
  return tok::text;
end $$;

create or replace function public.host_login(p_username text, p_password text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  h public.app_host;
  tok uuid;
begin
  select * into h from public.app_host where id;
  if h.username is null
     or lower(h.username) <> lower(trim(p_username))
     or h.password_hash <> crypt(p_password, h.password_hash) then
    perform pg_sleep(0.6); -- slow down brute force
    raise exception 'invalid_credentials' using errcode = 'P0001';
  end if;
  delete from public.tournament_sessions where expires_at <= now();
  insert into public.tournament_sessions (role) values ('admin') returning token into tok;
  return tok::text;
end $$;

create or replace function public.update_host_credentials(p_token text, p_username text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if (public._host_session(p_token)).token is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  if coalesce(length(trim(p_username)), 0) < 3 or coalesce(length(p_password), 0) < 6 then
    raise exception 'invalid_credentials_format' using errcode = 'P0001';
  end if;
  update public.app_host set username = trim(p_username), password_hash = crypt(p_password, gen_salt('bf', 10)) where id;
  delete from public.tournament_sessions where role = 'admin' and token <> p_token::uuid;
  return true;
end $$;

-- Un-claim the host account (keeps tournaments). Lets the next /#/admin visitor claim it again.
create or replace function public.release_host(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if (public._host_session(p_token)).token is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  delete from public.app_host where id; -- WHERE required by Supabase safeupdate
  delete from public.tournament_sessions where role = 'admin';
  return true;
end $$;

-- End a session (Lock Session button).
create or replace function public.logout(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.tournament_sessions where token::text = p_token;
  return true;
end $$;

-- ---------------------------------------------------------------- tournament RPCs
create or replace function public.create_tournament(
  p_token text, p_id text, p_name text, p_scorer_pin text, p_state jsonb, p_client_id text default null
) returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if (public._host_session(p_token)).token is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.tournaments where id = p_id) then
    raise exception 'tournament_exists' using errcode = 'P0001';
  end if;
  if p_scorer_pin !~ '^[0-9]{4}$' then
    raise exception 'invalid_pin' using errcode = 'P0001';
  end if;
  insert into public.tournaments (id, name, state, version, updated_at_ms, origin_client_id)
  values (p_id, coalesce(nullif(trim(p_name), ''), 'Tournament'), p_state, 1, now_ms, p_client_id);
  insert into public.tournament_heads (id, version, updated_at_ms, origin_client_id)
  values (p_id, 1, now_ms, p_client_id);
  insert into public.tournament_secrets (tournament_id, scorer_pin_hash, pin_version)
  values (p_id, crypt(p_scorer_pin, gen_salt('bf', 8)), 1);
  return true;
end $$;

create or replace function public.update_tournament_meta(p_token text, p_id text, p_name text, p_archived boolean)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if (public._host_session(p_token)).token is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  update public.tournaments
     set name = coalesce(nullif(trim(p_name), ''), name),
         archived = coalesce(p_archived, archived),
         updated_at = now()
   where id = p_id;
  if p_archived then
    update public.app_settings set active_tournament_id = null, updated_at = now()
     where id and active_tournament_id = p_id;
  end if;
  return true;
end $$;

-- Choose which tournament every stage / scorer / guest device follows (null = none).
create or replace function public.set_active_tournament(p_token text, p_id text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if (public._host_session(p_token)).token is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  if p_id is not null and not exists (select 1 from public.tournaments where id = p_id) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  update public.app_settings set active_tournament_id = p_id, updated_at = now() where id;
  if p_id is not null then
    update public.tournaments set archived = false where id = p_id;
  end if;
  return true;
end $$;

-- Wipe a tournament completely (state, logs, PIN, sessions).
create or replace function public.delete_tournament(p_token text, p_id text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if (public._host_session(p_token)).token is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  delete from public.tournaments where id = p_id;
  return true;
end $$;

-- Scorer login with the tournament's 4-digit PIN: returns { token, pinVersion } or raises 'invalid_pin'.
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
  if p_id is null then
    s := public._host_session(p_token);
  else
    s := public._session_for(p_token, p_id);
  end if;
  if s.token is null then
    return jsonb_build_object('valid', false);
  end if;
  return jsonb_build_object('valid', true, 'role', s.role, 'pinVersion', s.pin_version);
end $$;

-- Host only: set a new Scorer PIN, bump pin_version, revoke that tournament's scorer sessions.
create or replace function public.rotate_scorer_pin(p_token text, p_id text, p_new_pin text)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_version integer;
begin
  if (public._host_session(p_token)).token is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  if p_new_pin !~ '^[0-9]{4}$' then
    raise exception 'invalid_pin' using errcode = 'P0001';
  end if;
  update public.tournament_secrets
     set scorer_pin_hash = crypt(p_new_pin, gen_salt('bf', 8)), pin_version = pin_version + 1
   where tournament_id = p_id
  returning pin_version into new_version;
  if new_version is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  delete from public.tournament_sessions where tournament_id = p_id and role = 'scorer';
  return new_version;
end $$;

-- Host/scorer: persist a full snapshot if strictly newer. Returns { ok, version, reason? }.
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
         origin_client_id = p_client_id, updated_at = now(),
         name = coalesce(nullif(trim(p_state #>> '{meta,name}'), ''), name)
   where id = p_id;
  update public.tournament_heads
     set version = p_version, updated_at_ms = p_updated_at_ms, origin_client_id = p_client_id
   where id = p_id;
  return jsonb_build_object('ok', true, 'version', p_version);
end $$;

-- Host/scorer: upsert dart throw log rows (array of DartThrow JSON objects).
create or replace function public.append_dart_throws(p_token text, p_id text, p_throws jsonb)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  n integer;
begin
  if (public._session_for(p_token, p_id)).token is null then
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

-- ---------------------------------------------------------------- function grants
revoke all on function public._host_session(text)        from public, anon, authenticated;
revoke all on function public._session_for(text, text)   from public, anon, authenticated;
grant execute on function public.host_status()                                         to anon, authenticated;
grant execute on function public.claim_host(text, text)                                to anon, authenticated;
grant execute on function public.host_login(text, text)                                to anon, authenticated;
grant execute on function public.update_host_credentials(text, text, text)             to anon, authenticated;
grant execute on function public.release_host(text)                                    to anon, authenticated;
grant execute on function public.logout(text)                                          to anon, authenticated;
grant execute on function public.create_tournament(text, text, text, text, jsonb, text) to anon, authenticated;
grant execute on function public.update_tournament_meta(text, text, text, boolean)     to anon, authenticated;
grant execute on function public.set_active_tournament(text, text)                     to anon, authenticated;
grant execute on function public.delete_tournament(text, text)                         to anon, authenticated;
grant execute on function public.scorer_login(text, text)                              to anon, authenticated;
grant execute on function public.validate_session(text, text)                          to anon, authenticated;
grant execute on function public.rotate_scorer_pin(text, text, text)                   to anon, authenticated;
grant execute on function public.save_tournament_state(text, text, jsonb, bigint, bigint, text) to anon, authenticated;
grant execute on function public.append_dart_throws(text, text, jsonb)                 to anon, authenticated;

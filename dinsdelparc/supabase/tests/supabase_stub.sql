-- Minimal emulation of the Supabase platform objects the migrations depend on.
-- ONLY for local CI testing with plain PostgreSQL. Never run against a real project.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;
grant usage on schema auth, storage, extensions to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  last_sign_in_at timestamptz
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$$;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text not null, owner uuid, metadata jsonb, created_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
create or replace function storage.extension(name text) returns text language sql immutable as $$
  select lower(reverse(split_part(reverse(name), '.', 1)))
$$;

-- =============================================================================
-- DinsDelParc · 0001 · Foundations
-- Extensions, enums, utility functions, RBAC (roles / permissions), profiles.
-- DinsDelParc is an independent project with no affiliation to PortAventura World.
-- =============================================================================

-- Deny by default: every table created from now on needs an explicit grant
-- (Supabase grants everything to anon/authenticated by default).
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.app_role as enum (
  'superadmin', 'admin', 'content_manager', 'moderator', 'editor', 'verified_user', 'user'
);

-- Where a piece of reference data comes from. Nothing is shown as "verified"
-- unless an editor has checked it against a reliable source.
create type public.data_origin as enum ('verified', 'pending_verification', 'demo', 'community');

create type public.operational_status as enum ('open', 'temporarily_closed', 'permanently_closed', 'unknown');

-- official: authorised integration (none exists today) · admin: DinsDelParc staff
-- community: aggregated user reports · estimate: computed estimate
create type public.info_source as enum ('official', 'admin', 'community', 'estimate');

create type public.moderation_status as enum ('visible', 'pending_review', 'hidden', 'removed');

create type public.publish_status as enum ('draft', 'published', 'archived');

create type public.intensity_level as enum ('low', 'moderate', 'high', 'extreme');

create type public.poi_kind as enum (
  'attraction', 'restaurant', 'shop', 'show', 'service', 'toilet', 'first_aid', 'entrance', 'other'
);

-- -----------------------------------------------------------------------------
-- Utility functions
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Immutable wrapper so unaccent can be used in indexes.
create or replace function public.normalize_text(p text) returns text
language sql immutable parallel safe
set search_path = public, extensions as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p, '')));
$$;

-- Validates an i18n jsonb object: only ca/es/en string keys, each <= p_max chars.
create or replace function public.is_valid_i18n(p jsonb, p_max int default 10000) returns boolean
language sql immutable as $$
  select p is not null
     and jsonb_typeof(p) = 'object'
     and not exists (
       select 1 from jsonb_each(p) e
       where e.key not in ('ca', 'es', 'en')
          or jsonb_typeof(e.value) <> 'string'
          or length(e.value #>> '{}') > p_max
     );
$$;

-- Returns the text in the requested locale with fallback ca → es → en.
create or replace function public.i18n(p jsonb, p_locale text default 'ca') returns text
language sql immutable as $$
  select coalesce(p ->> p_locale, p ->> 'ca', p ->> 'es', p ->> 'en');
$$;

-- -----------------------------------------------------------------------------
-- RBAC
-- -----------------------------------------------------------------------------
create table public.roles (
  id public.app_role primary key,
  rank smallint not null unique check (rank between 0 and 100),
  name_i18n jsonb not null check (public.is_valid_i18n(name_i18n, 80)),
  description_i18n jsonb not null default '{}' check (public.is_valid_i18n(description_i18n, 500))
);

create table public.permissions (
  id text primary key check (id ~ '^[a-z_]+\.[a-z_]+$'),
  description text not null
);

create table public.role_permissions (
  role public.app_role not null references public.roles(id) on delete cascade,
  permission_id text not null references public.permissions(id) on delete cascade,
  primary key (role, permission_id)
);

insert into public.roles (id, rank, name_i18n) values
  ('superadmin',      100, '{"ca":"Superadministrador","es":"Superadministrador","en":"Super administrator"}'),
  ('admin',            80, '{"ca":"Administrador","es":"Administrador","en":"Administrator"}'),
  ('content_manager',  60, '{"ca":"Responsable de continguts","es":"Responsable de contenidos","en":"Content manager"}'),
  ('moderator',        50, '{"ca":"Moderador","es":"Moderador","en":"Moderator"}'),
  ('editor',           40, '{"ca":"Editor","es":"Editor","en":"Editor"}'),
  ('verified_user',    20, '{"ca":"Usuari verificat","es":"Usuario verificado","en":"Verified user"}'),
  ('user',             10, '{"ca":"Usuari estàndard","es":"Usuario estándar","en":"Standard user"}');

insert into public.permissions (id, description) values
  ('community.participate', 'Create posts, comments, forum topics, replies, reviews and reactions'),
  ('operations.report',     'Report observed waiting times'),
  ('dashboard.view',        'Access the administration panel dashboard'),
  ('content.edit',          'Create and edit reference content (drafts)'),
  ('content.publish',       'Publish, unpublish and verify reference content'),
  ('content.delete',        'Delete reference content'),
  ('content.feature',       'Manage featured content and announcements'),
  ('operations.validate',   'Approve or reject waiting time reports'),
  ('operations.manage',     'Set attraction status and staff waiting times'),
  ('community.moderate',    'Hide, restore or remove community content'),
  ('reports.manage',        'Review and resolve user reports'),
  ('forum.manage',          'Pin, lock and move forum topics'),
  ('users.view',            'View user administrative data'),
  ('users.suspend',         'Suspend and reinstate accounts of lower rank'),
  ('users.manage_roles',    'Grant and revoke roles of lower rank'),
  ('badges.award',          'Award and revoke badges'),
  ('settings.manage',       'Change application settings and moderation terms'),
  ('audit.view',            'Read the audit log');

insert into public.role_permissions (role, permission_id)
select r.role::public.app_role, p.perm from (values
  ('user',            array['community.participate','operations.report']),
  ('verified_user',   array['community.participate','operations.report']),
  ('editor',          array['community.participate','operations.report','dashboard.view','content.edit']),
  ('moderator',       array['community.participate','operations.report','dashboard.view','operations.validate',
                            'community.moderate','reports.manage','forum.manage','users.view','users.suspend']),
  ('content_manager', array['community.participate','operations.report','dashboard.view','content.edit','content.publish',
                            'content.delete','content.feature','operations.validate','operations.manage','badges.award']),
  ('admin',           array['community.participate','operations.report','dashboard.view','content.edit','content.publish',
                            'content.delete','content.feature','operations.validate','operations.manage','community.moderate',
                            'reports.manage','forum.manage','users.view','users.suspend','users.manage_roles','badges.award',
                            'settings.manage','audit.view']),
  ('superadmin',      array['community.participate','operations.report','dashboard.view','content.edit','content.publish',
                            'content.delete','content.feature','operations.validate','operations.manage','community.moderate',
                            'reports.manage','forum.manage','users.view','users.suspend','users.manage_roles','badges.award',
                            'settings.manage','audit.view'])
) as r(role, perms), unnest(r.perms) as p(perm);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null references public.roles(id),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
create index user_roles_role_idx on public.user_roles(role);

-- Suspensions are kept apart from the public profile.
create table public.user_moderation (
  user_id uuid primary key references auth.users(id) on delete cascade,
  suspended_until timestamptz,
  reason text check (length(reason) <= 1000),
  suspended_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function public.is_suspended(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_moderation m
    where m.user_id = p_user and m.suspended_until is not null and m.suspended_until > now()
  );
$$;

create or replace function public.user_rank(p_user uuid) returns smallint
language sql stable security definer set search_path = public as $$
  select coalesce(max(r.rank), 0)::smallint
  from public.user_roles ur join public.roles r on r.id = ur.role
  where ur.user_id = p_user;
$$;

create or replace function public.has_permission(p_permission text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and not public.is_suspended(auth.uid())
     and exists (
       select 1 from public.user_roles ur
       join public.role_permissions rp on rp.role = ur.role
       where ur.user_id = auth.uid() and rp.permission_id = p_permission
     );
$$;

create or replace function public.is_email_verified() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null);
$$;

-- Authenticated, not suspended, e-mail verified and holding community.participate.
create or replace function public.can_participate() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_permission('community.participate') and public.is_email_verified();
$$;

create or replace function public.my_permissions() returns setof text
language sql stable security definer set search_path = public as $$
  select distinct rp.permission_id
  from public.user_roles ur join public.role_permissions rp on rp.role = ur.role
  where ur.user_id = auth.uid() and not public.is_suspended(auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- Profiles (public) and user_settings (private)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,24}$'),
  display_name text check (length(display_name) between 1 and 60),
  avatar_path text check (length(avatar_path) <= 300),
  bio text check (length(bio) <= 400),
  favourite_park_slug text check (length(favourite_park_slug) <= 60),
  show_favorites boolean not null default true,
  show_stats boolean not null default true,
  xp integer not null default 0 check (xp >= 0),
  level smallint not null default 1 check (level >= 1),
  posts_count integer not null default 0,
  followers_count integer not null default 0,
  following_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_username_trgm on public.profiles using gin (public.normalize_text(username) extensions.gin_trgm_ops);
create index profiles_display_name_trgm on public.profiles using gin (public.normalize_text(display_name) extensions.gin_trgm_ops);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locale text not null default 'ca' check (locale in ('ca', 'es', 'en')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  onboarding_completed boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

-- RGPD: append-only consent ledger.
create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('terms', 'privacy', 'marketing', 'push', 'analytics')),
  version text not null check (length(version) <= 20),
  granted boolean not null,
  created_at timestamptz not null default now()
);
create index consents_user_idx on public.consents(user_id, kind, created_at desc);

-- Generic per-user rate limiting, used by triggers on user-generated content.
create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_events_lookup on public.rate_limit_events(user_id, action, created_at desc);

create or replace function public.assert_rate_limit(p_action text, p_max int, p_window interval) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    return; -- service role / maintenance jobs are not rate limited
  end if;
  select count(*) into v_count from public.rate_limit_events
   where user_id = auth.uid() and action = p_action and created_at > now() - p_window;
  if v_count >= p_max then
    raise exception 'rate_limited' using errcode = 'P0001', hint = p_action;
  end if;
  insert into public.rate_limit_events(user_id, action) values (auth.uid(), p_action);
end;
$$;

-- -----------------------------------------------------------------------------
-- Sign-up hook: profile, settings, default role and initial consents.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_username text;
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_locale text := coalesce(nullif(v_meta ->> 'locale', ''), 'ca');
begin
  v_username := lower(regexp_replace(coalesce(v_meta ->> 'username', ''), '[^a-zA-Z0-9_.]', '', 'g'));
  if length(v_username) < 3 or length(v_username) > 24
     or exists (select 1 from public.profiles where username = v_username) then
    v_username := 'visitant_' || substr(replace(new.id::text, '-', ''), 1, 10);
  end if;
  if v_locale not in ('ca', 'es', 'en') then v_locale := 'ca'; end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, v_username, nullif(left(trim(coalesce(v_meta ->> 'display_name', '')), 60), ''));

  insert into public.user_settings (user_id, locale) values (new.id, v_locale);
  insert into public.user_roles (user_id, role) values (new.id, 'user');

  if v_meta ? 'terms_version' then
    insert into public.consents (user_id, kind, version, granted)
    values (new.id, 'terms', left(v_meta ->> 'terms_version', 20), true),
           (new.id, 'privacy', left(v_meta ->> 'terms_version', 20), true);
  end if;
  if (v_meta ->> 'marketing_consent')::boolean is true then
    insert into public.consents (user_id, kind, version, granted)
    values (new.id, 'marketing', left(coalesce(v_meta ->> 'terms_version', '1'), 20), true);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_moderation enable row level security;
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.consents enable row level security;
alter table public.rate_limit_events enable row level security;

create policy roles_read on public.roles for select using (true);
create policy permissions_read on public.permissions for select using (true);
create policy role_permissions_read on public.role_permissions for select using (true);

-- Roles are public (they back public badges such as "Moderator"); writes only via admin_set_role().
create policy user_roles_read on public.user_roles for select using (true);

create policy user_moderation_read on public.user_moderation for select
  using (user_id = auth.uid() or public.has_permission('users.view'));

create policy profiles_read on public.profiles for select using (true);
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid() and not public.is_suspended(auth.uid()))
  with check (id = auth.uid());

create policy user_settings_own on public.user_settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy consents_own_read on public.consents for select using (user_id = auth.uid());
create policy consents_own_insert on public.consents for insert with check (user_id = auth.uid());

-- rate_limit_events: no policies → no direct client access.

-- -----------------------------------------------------------------------------
-- Grants. Column-level grants stop users from editing counters, xp or level.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;

grant select on public.roles, public.permissions, public.role_permissions, public.user_roles, public.profiles to anon, authenticated;
grant select on public.user_moderation to authenticated;
grant update (username, display_name, avatar_path, bio, favourite_park_slug, show_favorites, show_stats)
  on public.profiles to authenticated;
grant select, insert, update on public.user_settings to authenticated;
grant select, insert on public.consents to authenticated;

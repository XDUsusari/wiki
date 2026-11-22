-- =============================================================================
-- DinsDelParc · 0002 · Reference content
-- Parks, themed areas, locations, attractions, restaurants, shops, shows,
-- services, schedules, announcements, featured content, settings, audit log.
-- Every reference row carries data_origin + verification metadata so the apps
-- can tell verified facts apart from data pending verification or demo data.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Audit log (written by triggers and admin functions)
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (length(action) <= 80),
  entity_type text not null check (length(entity_type) <= 60),
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  note text check (length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs(created_at desc);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc);

create or replace function public.write_audit(
  p_action text, p_entity_type text, p_entity_id text,
  p_before jsonb default null, p_after jsonb default null, p_note text default null
) returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data, note)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_before, p_after, p_note);
$$;
revoke execute on function public.write_audit(text, text, text, jsonb, jsonb, text) from public, anon, authenticated;

-- Generic row audit trigger for staff-managed tables.
create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and tg_table_name = 'attractions'
     and (to_jsonb(new) - array['rating_avg','rating_count','updated_at'])
       = (to_jsonb(old) - array['rating_avg','rating_count','updated_at']) then
    return new;
  end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    auth.uid(), lower(tg_op), tg_table_name,
    (select coalesce(j ->> 'id', j ->> 'key') from (select case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end as j) x),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

-- Rating counter refreshes on attractions are ignored by the guard and the audit trigger.
-- Fills verified_at / verified_by and enforces that only publishers can verify or publish.
create or replace function public.guard_reference_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and tg_table_name = 'attractions'
     and (to_jsonb(new) - array['rating_avg','rating_count','updated_at'])
       = (to_jsonb(old) - array['rating_avg','rating_count','updated_at']) then
    return new;
  end if;
  if auth.uid() is not null then
    if (tg_op = 'INSERT' and (new.is_published or new.data_origin = 'verified'))
       or (tg_op = 'UPDATE' and (new.is_published is distinct from old.is_published
                                 or (new.data_origin = 'verified' and old.data_origin is distinct from 'verified'))) then
      if not public.has_permission('content.publish') then
        raise exception 'forbidden: content.publish required' using errcode = '42501';
      end if;
    end if;
    -- An edit by someone who cannot verify sends verified data back to review.
    if tg_op = 'UPDATE' and old.data_origin = 'verified' and new.data_origin = 'verified'
       and not public.has_permission('content.publish') then
      new.data_origin := 'pending_verification';
    end if;
  end if;
  if new.data_origin = 'verified' and (tg_op = 'INSERT' or old.data_origin is distinct from 'verified') then
    new.verified_at := now();
    new.verified_by := auth.uid();
  elsif new.data_origin <> 'verified' then
    new.verified_at := null;
    new.verified_by := null;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Parks & areas
-- -----------------------------------------------------------------------------
create table public.parks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null check (length(name) between 2 and 120),
  kind text not null check (kind in ('theme_park', 'water_park')),
  accent_color text not null default '#0B3D91' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  tagline_i18n jsonb not null default '{}' check (public.is_valid_i18n(tagline_i18n, 160)),
  description_i18n jsonb not null default '{}' check (public.is_valid_i18n(description_i18n, 5000)),
  season_i18n jsonb not null default '{}' check (public.is_valid_i18n(season_i18n, 1000)),
  official_url text check (official_url ~ '^https://'),
  hero_image_path text,
  image_credit text check (length(image_credit) <= 200),
  sort_order smallint not null default 0,
  data_origin public.data_origin not null default 'pending_verification',
  source_url text check (source_url ~ '^https?://'),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.themed_areas (
  id uuid primary key default gen_random_uuid(),
  park_id uuid not null references public.parks(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null check (length(name) between 2 and 120),
  accent_color text not null default '#1E88E5' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  description_i18n jsonb not null default '{}' check (public.is_valid_i18n(description_i18n, 5000)),
  hero_image_path text,
  image_credit text check (length(image_credit) <= 200),
  sort_order smallint not null default 0,
  data_origin public.data_origin not null default 'pending_verification',
  source_url text check (source_url ~ '^https?://'),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (park_id, slug)
);
create index themed_areas_park_idx on public.themed_areas(park_id, sort_order);

-- Points on the map. Coordinates are optional: nothing is plotted unless set,
-- and coords_verified tells the app whether to show a "not verified" notice.
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  park_id uuid not null references public.parks(id) on delete cascade,
  area_id uuid references public.themed_areas(id) on delete set null,
  kind public.poi_kind not null,
  name text not null check (length(name) between 2 and 120),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  coords_verified boolean not null default false,
  coords_source text check (length(coords_source) <= 300),
  description_i18n jsonb not null default '{}' check (public.is_valid_i18n(description_i18n, 1000)),
  is_published boolean not null default false,
  data_origin public.data_origin not null default 'pending_verification',
  source_url text check (source_url ~ '^https?://'),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null))
);
create index locations_park_idx on public.locations(park_id, kind);

-- -----------------------------------------------------------------------------
-- Attractions
-- -----------------------------------------------------------------------------
create table public.attractions (
  id uuid primary key default gen_random_uuid(),
  park_id uuid not null references public.parks(id) on delete cascade,
  area_id uuid references public.themed_areas(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  slug text not null check (slug ~ '^[a-z0-9-]{2,80}$'),
  name text not null check (length(name) between 2 and 120),
  attraction_type text not null default 'other' check (attraction_type in (
    'roller_coaster', 'water_ride', 'drop_tower', 'flat_ride', 'family', 'kids', 'dark_ride',
    'simulator', 'slide', 'pool', 'walkthrough', 'other')),
  intensity public.intensity_level,
  description_i18n jsonb not null default '{}' check (public.is_valid_i18n(description_i18n, 5000)),
  -- Safety data: only fill from an official/reliable source, then mark verified.
  min_height_cm smallint check (min_height_cm between 50 and 220),
  min_height_accompanied_cm smallint check (min_height_accompanied_cm between 50 and 220),
  max_height_cm smallint check (max_height_cm between 50 and 230),
  duration_seconds integer check (duration_seconds between 10 and 7200),
  restrictions_i18n jsonb not null default '{}' check (public.is_valid_i18n(restrictions_i18n, 3000)),
  accessibility_i18n jsonb not null default '{}' check (public.is_valid_i18n(accessibility_i18n, 3000)),
  opened_year smallint check (opened_year between 1900 and 2100),
  hero_image_path text,
  image_credit text check (length(image_credit) <= 200),
  image_license text check (length(image_license) <= 100),
  rating_avg numeric(3,2) not null default 0,
  rating_count integer not null default 0,
  sort_order smallint not null default 0,
  data_origin public.data_origin not null default 'pending_verification',
  source_url text check (source_url ~ '^https?://'),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  is_published boolean not null default false,
  search_text text generated always as (public.normalize_text(name)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (park_id, slug)
);
create index attractions_park_idx on public.attractions(park_id, area_id);
create index attractions_search_trgm on public.attractions using gin (search_text extensions.gin_trgm_ops);

-- Shared definition for restaurants / shops / shows / park_services.
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  park_id uuid not null references public.parks(id) on delete cascade,
  area_id uuid references public.themed_areas(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  slug text not null check (slug ~ '^[a-z0-9-]{2,80}$'),
  name text not null check (length(name) between 2 and 120),
  cuisine text check (length(cuisine) <= 80),
  service_type text not null default 'other' check (service_type in ('table', 'buffet', 'quick', 'snack', 'other')),
  price_range smallint check (price_range between 1 and 4),
  description_i18n jsonb not null default '{}' check (public.is_valid_i18n(description_i18n, 3000)),
  dietary_i18n jsonb not null default '{}' check (public.is_valid_i18n(dietary_i18n, 1000)),
  hero_image_path text,
  image_credit text check (length(image_credit) <= 200),
  data_origin public.data_origin not null default 'pending_verification',
  source_url text check (source_url ~ '^https?://'),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  is_published boolean not null default false,
  search_text text generated always as (public.normalize_text(name)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (park_id, slug)
);
create index restaurants_search_trgm on public.restaurants using gin (search_text extensions.gin_trgm_ops);

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  park_id uuid not null references public.parks(id) on delete cascade,
  area_id uuid references public.themed_areas(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  slug text not null check (slug ~ '^[a-z0-9-]{2,80}$'),
  name text not null check (length(name) between 2 and 120),
  description_i18n jsonb not null default '{}' check (public.is_valid_i18n(description_i18n, 3000)),
  hero_image_path text,
  image_credit text check (length(image_credit) <= 200),
  data_origin public.data_origin not null default 'pending_verification',
  source_url text check (source_url ~ '^https?://'),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  is_published boolean not null default false,
  search_text text generated always as (public.normalize_text(name)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (park_id, slug)
);
create index shops_search_trgm on public.shops using gin (search_text extensions.gin_trgm_ops);

create table public.shows (
  id uuid primary key default gen_random_uuid(),
  park_id uuid not null references public.parks(id) on delete cascade,
  area_id uuid references public.themed_areas(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  slug text not null check (slug ~ '^[a-z0-9-]{2,80}$'),
  name text not null check (length(name) between 2 and 120),
  description_i18n jsonb not null default '{}' check (public.is_valid_i18n(description_i18n, 3000)),
  duration_seconds integer check (duration_seconds between 60 and 14400),
  season_i18n jsonb not null default '{}' check (public.is_valid_i18n(season_i18n, 500)),
  hero_image_path text,
  image_credit text check (length(image_credit) <= 200),
  data_origin public.data_origin not null default 'pending_verification',
  source_url text check (source_url ~ '^https?://'),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  is_published boolean not null default false,
  search_text text generated always as (public.normalize_text(name)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (park_id, slug)
);
create index shows_search_trgm on public.shows using gin (search_text extensions.gin_trgm_ops);

-- Verified show sessions (only when published by a reliable source).
create table public.show_sessions (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  session_date date not null,
  starts_at time not null,
  data_origin public.data_origin not null default 'pending_verification',
  source_url text check (source_url ~ '^https?://'),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (show_id, session_date, starts_at)
);

create table public.park_services (
  id uuid primary key default gen_random_uuid(),
  park_id uuid not null references public.parks(id) on delete cascade,
  area_id uuid references public.themed_areas(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  slug text not null check (slug ~ '^[a-z0-9-]{2,80}$'),
  name text not null check (length(name) between 2 and 120),
  service_type text not null default 'other' check (service_type in (
    'toilets', 'first_aid', 'lockers', 'guest_services', 'baby_care', 'accessibility',
    'atm', 'photo', 'rental', 'lost_found', 'parking', 'other')),
  description_i18n jsonb not null default '{}' check (public.is_valid_i18n(description_i18n, 2000)),
  data_origin public.data_origin not null default 'pending_verification',
  source_url text check (source_url ~ '^https?://'),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (park_id, slug)
);

-- Opening hours. Only staff enter them, citing the source; never inferred.
create table public.park_schedules (
  id uuid primary key default gen_random_uuid(),
  park_id uuid not null references public.parks(id) on delete cascade,
  schedule_date date not null,
  is_closed boolean not null default false,
  opens_at time,
  closes_at time,
  note_i18n jsonb not null default '{}' check (public.is_valid_i18n(note_i18n, 500)),
  data_origin public.data_origin not null default 'pending_verification',
  source_url text check (source_url ~ '^https?://'),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (park_id, schedule_date),
  check (is_closed or (opens_at is not null and closes_at is not null))
);

-- -----------------------------------------------------------------------------
-- News, notices, incidents and featured content
-- -----------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  park_id uuid references public.parks(id) on delete cascade,
  attraction_id uuid references public.attractions(id) on delete set null,
  kind text not null default 'news' check (kind in ('news', 'notice', 'incident')),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title_i18n jsonb not null check (public.is_valid_i18n(title_i18n, 160) and title_i18n <> '{}'),
  body_i18n jsonb not null default '{}' check (public.is_valid_i18n(body_i18n, 8000)),
  source_url text check (source_url ~ '^https?://'),
  data_origin public.data_origin not null default 'pending_verification',
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index announcements_active_idx on public.announcements(is_published, starts_at desc);

create table public.featured_items (
  id uuid primary key default gen_random_uuid(),
  target_kind text not null check (target_kind in ('attraction', 'show', 'restaurant', 'park', 'area', 'announcement', 'post', 'forum_topic', 'url')),
  target_id uuid,
  target_url text check (target_url ~ '^https://'),
  title_i18n jsonb not null check (public.is_valid_i18n(title_i18n, 120) and title_i18n <> '{}'),
  subtitle_i18n jsonb not null default '{}' check (public.is_valid_i18n(subtitle_i18n, 240)),
  section text not null default 'discover' check (section in ('discover', 'news', 'community', 'recommendation')),
  accent_color text check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order smallint not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_published boolean not null default false,
  data_origin public.data_origin not null default 'pending_verification',
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((target_kind = 'url') = (target_url is not null)),
  check (target_kind = 'url' or target_id is not null)
);

create table public.app_settings (
  key text primary key check (key ~ '^[a-z0-9_.]{2,80}$'),
  value jsonb not null,
  is_public boolean not null default false,
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Triggers, RLS and grants for every reference table
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['parks','themed_areas','locations','attractions','restaurants','shops','shows',
                           'show_sessions','park_services','park_schedules','announcements','featured_items'] loop
    execute format('create trigger %1$s_updated_at before update on public.%1$I for each row execute function public.set_updated_at()', t);
    execute format('create trigger %1$s_guard before insert or update on public.%1$I for each row execute function public.guard_reference_row()', t);
    execute format('create trigger %1$s_audit after insert or update or delete on public.%1$I for each row execute function public.audit_row_change()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy %1$s_public_read on public.%1$I for select
                     using (is_published or public.has_permission('content.edit'))$p$, t);
    execute format($p$create policy %1$s_staff_insert on public.%1$I for insert
                     with check (public.has_permission('content.edit'))$p$, t);
    execute format($p$create policy %1$s_staff_update on public.%1$I for update
                     using (public.has_permission('content.edit')) with check (public.has_permission('content.edit'))$p$, t);
    execute format($p$create policy %1$s_staff_delete on public.%1$I for delete
                     using (public.has_permission('content.delete'))$p$, t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Announcements and featured items need content.feature, not just content.edit.
drop policy announcements_staff_insert on public.announcements;
drop policy announcements_staff_update on public.announcements;
drop policy featured_items_staff_insert on public.featured_items;
drop policy featured_items_staff_update on public.featured_items;
create policy announcements_staff_insert on public.announcements for insert with check (public.has_permission('content.feature'));
create policy announcements_staff_update on public.announcements for update
  using (public.has_permission('content.feature')) with check (public.has_permission('content.feature'));
create policy featured_items_staff_insert on public.featured_items for insert with check (public.has_permission('content.feature'));
create policy featured_items_staff_update on public.featured_items for update
  using (public.has_permission('content.feature')) with check (public.has_permission('content.feature'));

-- Hide announcements outside their window from the public.
drop policy announcements_public_read on public.announcements;
create policy announcements_public_read on public.announcements for select using (
  (is_published and starts_at <= now() and (ends_at is null or ends_at > now()))
  or public.has_permission('content.edit')
);
drop policy featured_items_public_read on public.featured_items;
create policy featured_items_public_read on public.featured_items for select using (
  (is_published and starts_at <= now() and (ends_at is null or ends_at > now()))
  or public.has_permission('content.edit')
);

alter table public.app_settings enable row level security;
alter table public.audit_logs enable row level security;
create policy app_settings_read on public.app_settings for select using (is_public or public.has_permission('settings.manage'));
create policy app_settings_write on public.app_settings for all
  using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));
create policy audit_logs_read on public.audit_logs for select using (public.has_permission('audit.view'));
create trigger app_settings_audit after insert or update or delete on public.app_settings
  for each row execute function public.audit_row_change();

grant select on public.app_settings to anon, authenticated;
grant insert, update, delete on public.app_settings to authenticated;
grant select on public.audit_logs to authenticated;

-- Joves Nacionalistes · esquema inicial
-- Totes les taules tenen Row Level Security (RLS). Només els membres ACTIUS
-- (aprovats per un coordinador) poden llegir el contingut de la intranet.

create extension if not exists pgcrypto;

-- ───────────────────────── Tipus ─────────────────────────
create type public.user_role as enum ('membre', 'coordinador', 'admin');
create type public.member_status as enum ('pendent', 'actiu', 'suspes');
create type public.post_kind as enum ('noticia', 'avis');
create type public.report_status as enum ('obert', 'resolt');

-- ───────────────────────── Perfils ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  birthdate date not null,
  comarca text,
  bio text check (char_length(bio) <= 500),
  role public.user_role not null default 'membre',
  status public.member_status not null default 'pendent',
  privacy_accepted_at timestamptz not null,
  rules_accepted_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Funcions auxiliars (security definer per evitar recursió amb RLS)
create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'actiu');
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'actiu' and role in ('coordinador', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'actiu' and role = 'admin');
$$;

-- Crea el perfil quan algú es registra. Bloqueja menors de 18 anys
-- i registres sense consentiment explícit (RGPD art. 9: opinió política).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  bd date;
begin
  bd := nullif(new.raw_user_meta_data ->> 'birthdate', '')::date;
  if bd is null or bd > (current_date - interval '18 years')::date then
    raise exception 'Cal tenir 18 anys o més per registrar-se';
  end if;
  if coalesce((new.raw_user_meta_data ->> 'privacy_accepted')::boolean, false) is not true
     or coalesce((new.raw_user_meta_data ->> 'rules_accepted')::boolean, false) is not true then
    raise exception 'Cal acceptar la política de privacitat i les normes';
  end if;

  insert into public.profiles (id, display_name, birthdate, comarca, privacy_accepted_at, rules_accepted_at)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Membre'),
    bd,
    nullif(new.raw_user_meta_data ->> 'comarca', ''),
    now(),
    now()
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

-- La data de naixement NO és visible per l'API: només es pot llegir
-- amb la funció my_profile_export() (dret d'accés del propi usuari).
revoke all on public.profiles from anon, authenticated;
grant select (id, display_name, comarca, bio, role, status, created_at) on public.profiles to authenticated;
grant update (display_name, comarca, bio) on public.profiles to authenticated;

create policy "perfils: lectura pròpia o membres actius"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_active_member());

create policy "perfils: editar el propi"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Canvis d'estat i de rol, només via funció
create or replace function public.set_member_status(target uuid, new_status public.member_status)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'No autoritzat'; end if;
  if target = auth.uid() then raise exception 'No pots canviar el teu propi estat'; end if;
  if (select role from public.profiles where id = target) = 'admin' and not public.is_admin() then
    raise exception 'Només un admin pot modificar un altre admin';
  end if;
  update public.profiles set status = new_status where id = target;
end;
$$;

create or replace function public.set_member_role(target uuid, new_role public.user_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'No autoritzat'; end if;
  if target = auth.uid() then raise exception 'No pots canviar el teu propi rol'; end if;
  update public.profiles set role = new_role where id = target;
end;
$$;

-- ───────────────────────── Notícies i avisos ─────────────────────────
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles (id) on delete set null,
  kind public.post_kind not null default 'noticia',
  title text not null check (char_length(title) between 3 and 160),
  body text not null check (char_length(body) between 1 and 20000),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index posts_created_idx on public.posts (pinned desc, created_at desc);
alter table public.posts enable row level security;

create policy "posts: lectura membres" on public.posts for select to authenticated using (public.is_active_member());
create policy "posts: crear staff" on public.posts for insert to authenticated with check (public.is_staff() and author_id = auth.uid());
create policy "posts: editar staff" on public.posts for update to authenticated using (public.is_staff());
create policy "posts: esborrar staff" on public.posts for delete to authenticated using (public.is_staff());

-- ───────────────────────── Esdeveniments ─────────────────────────
create table public.events (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(title) between 3 and 160),
  description text not null default '' check (char_length(description) <= 10000),
  location text not null default '',
  comarca text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity int check (capacity is null or capacity > 0),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index events_starts_idx on public.events (starts_at);
alter table public.events enable row level security;

create policy "events: lectura membres" on public.events for select to authenticated using (public.is_active_member());
create policy "events: crear staff" on public.events for insert to authenticated with check (public.is_staff() and created_by = auth.uid());
create policy "events: editar staff" on public.events for update to authenticated using (public.is_staff());
create policy "events: esborrar staff" on public.events for delete to authenticated using (public.is_staff());

create table public.event_registrations (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  checked_in_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_registrations enable row level security;

create policy "inscripcions: veure les pròpies o staff" on public.event_registrations for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy "inscripcions: inscriure's" on public.event_registrations for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_member() and checked_in_at is null);
create policy "inscripcions: desinscriure's" on public.event_registrations for delete to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy "inscripcions: check-in staff" on public.event_registrations for update to authenticated
  using (public.is_staff());

-- Control d'aforament
create or replace function public.check_event_capacity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  cap int;
  starts timestamptz;
begin
  select capacity, starts_at into cap, starts from public.events where id = new.event_id for update;
  if starts < now() then raise exception 'Aquest esdeveniment ja ha començat'; end if;
  if cap is not null and (select count(*) from public.event_registrations where event_id = new.event_id) >= cap then
    raise exception 'Esdeveniment complet';
  end if;
  return new;
end;
$$;
create trigger event_capacity before insert on public.event_registrations
  for each row execute function public.check_event_capacity();

create or replace function public.event_registration_count(eid uuid)
returns int language sql stable security definer set search_path = '' as $$
  select case when public.is_active_member()
    then (select count(*)::int from public.event_registrations where event_id = eid)
    else 0 end;
$$;

-- ───────────────────────── Fòrum / xat ─────────────────────────
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 2 and 60),
  description text not null default '',
  staff_only_post boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.channels enable row level security;

create policy "canals: lectura membres" on public.channels for select to authenticated using (public.is_active_member());
create policy "canals: gestió admin" on public.channels for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.messages (
  id bigint generated always as identity primary key,
  channel_id uuid not null references public.channels (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_channel_idx on public.messages (channel_id, created_at desc);
alter table public.messages enable row level security;

create policy "missatges: lectura membres" on public.messages for select to authenticated using (public.is_active_member());
create policy "missatges: publicar" on public.messages for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_active_member()
    and (public.is_staff() or not exists (
      select 1 from public.channels c where c.id = channel_id and c.staff_only_post
    ))
  );
create policy "missatges: esborrar propi o staff" on public.messages for delete to authenticated
  using (author_id = auth.uid() or public.is_staff());

-- Límit anti-spam: màxim 10 missatges per minut
create or replace function public.rate_limit_messages()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.messages
      where author_id = new.author_id and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'Massa missatges seguits. Espera un moment.';
  end if;
  return new;
end;
$$;
create trigger messages_rate_limit before insert on public.messages
  for each row execute function public.rate_limit_messages();

-- Temps real per al xat
alter publication supabase_realtime add table public.messages;

-- ───────────────────────── Moderació ─────────────────────────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  message_id bigint references public.messages (id) on delete set null,
  message_snapshot text not null,
  reporter_id uuid references public.profiles (id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 500),
  status public.report_status not null default 'obert',
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;

-- La còpia del missatge la fa el servidor (no el client), per evitar falsificacions
create or replace function public.fill_report_snapshot()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select body into new.message_snapshot from public.messages where id = new.message_id;
  if new.message_snapshot is null then raise exception 'Missatge inexistent'; end if;
  new.status := 'obert';
  return new;
end;
$$;
create trigger reports_snapshot before insert on public.reports
  for each row execute function public.fill_report_snapshot();

create policy "denúncies: crear" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.is_active_member());
create policy "denúncies: veure staff" on public.reports for select to authenticated using (public.is_staff());
create policy "denúncies: resoldre staff" on public.reports for update to authenticated using (public.is_staff());

-- ───────────────────────── Dret d'accés (RGPD art. 15) ─────────────────────────
create or replace function public.my_profile_export()
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(p) from public.profiles p where p.id = auth.uid();
$$;

-- ───────────────────────── Dades inicials ─────────────────────────
insert into public.channels (slug, name, description, staff_only_post) values
  ('anuncis', 'Anuncis', 'Comunicats de la coordinació', true),
  ('general', 'General', 'Conversa oberta entre membres', false),
  ('propostes', 'Propostes', 'Idees i propostes d''activitats', false);

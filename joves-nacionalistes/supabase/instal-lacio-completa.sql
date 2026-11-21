-- ═══════════════════════════════════════════════════════════════
-- Joves Nacionalistes · INSTAL·LACIÓ COMPLETA DE LA BASE DE DADES
-- Enganxa TOT aquest fitxer al SQL Editor de Supabase i prem «Run».
-- Només s'ha d'executar UNA vegada, en un projecte nou.
-- (Generat a partir de supabase/migrations/0001, 0002 i 0003.)
-- ═══════════════════════════════════════════════════════════════


-- ─────────── 0001_init.sql ───────────
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


-- ─────────── 0002_access.sql ───────────
-- Millores d'accés: obligar a canviar la contrasenya (comptes creats per un admin, com «root»)

alter table public.profiles
  add column must_change_password boolean not null default false;

-- L'usuari pot llegir aquest camp del seu perfil, però no modificar-lo
-- (només el servidor el posa a false després d'un canvi de contrasenya real).
grant select (must_change_password) on public.profiles to authenticated;


-- ─────────── 0003_modules.sql ───────────
-- Joves Nacionalistes · mòduls: voluntariat, mapa, formació, enquestes, propostes, documents i directori

-- ───────────────────────── Directori ─────────────────────────
alter table public.profiles
  add column directory_visible boolean not null default true,
  add column responsibility text check (char_length(responsibility) <= 80);

grant select (directory_visible, responsibility) on public.profiles to authenticated;
grant update (directory_visible) on public.profiles to authenticated;

create or replace function public.set_member_responsibility(target uuid, value text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'No autoritzat'; end if;
  update public.profiles set responsibility = nullif(trim(value), '') where id = target;
end;
$$;

-- ───────────────────────── Voluntariat i campanyes ─────────────────────────
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 5000),
  comarca text,
  starts_on date not null,
  ends_on date not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table public.volunteer_shifts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  location text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  slots int not null check (slots > 0),
  check (ends_at > starts_at)
);
create index volunteer_shifts_campaign_idx on public.volunteer_shifts (campaign_id, starts_at);

create table public.shift_signups (
  shift_id uuid not null references public.volunteer_shifts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shift_id, user_id)
);

alter table public.campaigns enable row level security;
alter table public.volunteer_shifts enable row level security;
alter table public.shift_signups enable row level security;

create policy "campanyes: lectura" on public.campaigns for select to authenticated using (public.is_active_member());
create policy "campanyes: gestió" on public.campaigns for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "torns: lectura" on public.volunteer_shifts for select to authenticated using (public.is_active_member());
create policy "torns: gestió" on public.volunteer_shifts for all to authenticated using (public.is_staff()) with check (public.is_staff());
-- Els voluntaris poden veure qui més s'ha apuntat a un torn
create policy "apuntats: lectura" on public.shift_signups for select to authenticated using (public.is_active_member());
create policy "apuntats: apuntar-se" on public.shift_signups for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_member());
create policy "apuntats: desapuntar-se" on public.shift_signups for delete to authenticated
  using (user_id = auth.uid() or public.is_staff());

create or replace function public.check_shift_slots()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  s record;
begin
  select slots, starts_at into s from public.volunteer_shifts where id = new.shift_id for update;
  if s.starts_at < now() then raise exception 'Aquest torn ja ha començat'; end if;
  if (select count(*) from public.shift_signups where shift_id = new.shift_id) >= s.slots then
    raise exception 'Aquest torn ja està complet';
  end if;
  return new;
end;
$$;
create trigger shift_slots before insert on public.shift_signups
  for each row execute function public.check_shift_slots();

-- ───────────────────────── Mapa ─────────────────────────
create type public.map_point_kind as enum ('seu', 'punt_trobada', 'campanya', 'activitat');

create table public.map_points (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  kind public.map_point_kind not null,
  municipality text not null,
  address text not null default '',
  description text not null default '' check (char_length(description) <= 1000),
  lat double precision not null check (lat between 41.2 and 41.6),
  lng double precision not null check (lng between 1.9 and 2.4),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.map_points enable row level security;
create policy "mapa: lectura" on public.map_points for select to authenticated using (public.is_active_member());
create policy "mapa: gestió" on public.map_points for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ───────────────────────── Formació ─────────────────────────
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '',
  level text not null default 'Inicial',
  position int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  position int not null default 0,
  title text not null check (char_length(title) between 3 and 120),
  body text not null default '' check (char_length(body) <= 50000),
  duration_min int check (duration_min > 0)
);
create index lessons_course_idx on public.lessons (course_id, position);

create table public.lesson_progress (
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (lesson_id, user_id)
);

alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_progress enable row level security;

create policy "cursos: lectura" on public.courses for select to authenticated
  using (public.is_active_member() and (published or public.is_staff()));
create policy "cursos: gestió" on public.courses for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "lliçons: lectura" on public.lessons for select to authenticated
  using (public.is_active_member() and exists (
    select 1 from public.courses c where c.id = course_id and (c.published or public.is_staff())));
create policy "lliçons: gestió" on public.lessons for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "progrés: propi" on public.lesson_progress for select to authenticated using (user_id = auth.uid());
create policy "progrés: marcar" on public.lesson_progress for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_member());
create policy "progrés: desmarcar" on public.lesson_progress for delete to authenticated using (user_id = auth.uid());

-- ───────────────────────── Enquestes i consultes ─────────────────────────
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 5 and 200),
  description text not null default '',
  closes_at timestamptz not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  position int not null default 0
);

-- Vot secret: ningú (ni la coordinació) pot llegir el vot d'una altra persona.
create table public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

create policy "enquestes: lectura" on public.polls for select to authenticated using (public.is_active_member());
create policy "enquestes: gestió" on public.polls for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "opcions: lectura" on public.poll_options for select to authenticated using (public.is_active_member());
create policy "opcions: gestió" on public.poll_options for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "vots: el meu" on public.poll_votes for select to authenticated using (user_id = auth.uid());
create policy "vots: votar" on public.poll_votes for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_member());

create or replace function public.check_poll_vote()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select closes_at from public.polls where id = new.poll_id) < now() then
    raise exception 'Aquesta consulta ja està tancada';
  end if;
  if not exists (select 1 from public.poll_options where id = new.option_id and poll_id = new.poll_id) then
    raise exception 'Opció no vàlida';
  end if;
  return new;
end;
$$;
create trigger poll_vote_check before insert on public.poll_votes
  for each row execute function public.check_poll_vote();

-- Resultats agregats. Visibles quan has votat o quan la consulta s'ha tancat.
create or replace function public.poll_results(pid uuid)
returns table (option_id uuid, votes int) language sql stable security definer set search_path = '' as $$
  select o.id, count(v.user_id)::int
  from public.poll_options o
  left join public.poll_votes v on v.option_id = o.id
  where o.poll_id = pid
    and public.is_active_member()
    and (
      exists (select 1 from public.poll_votes mv where mv.poll_id = pid and mv.user_id = auth.uid())
      or (select closes_at from public.polls where id = pid) < now()
      or public.is_staff()
    )
  group by o.id;
$$;

create or replace function public.poll_voter_count(pid uuid)
returns int language sql stable security definer set search_path = '' as $$
  select case when public.is_active_member()
    then (select count(*)::int from public.poll_votes where poll_id = pid) else 0 end;
$$;

-- ───────────────────────── Bústia de propostes ─────────────────────────
create type public.proposal_status as enum ('nova', 'en_estudi', 'acceptada', 'descartada');

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(title) between 5 and 140),
  body text not null check (char_length(body) between 10 and 5000),
  category text not null default 'Altres',
  status public.proposal_status not null default 'nova',
  response text check (char_length(response) <= 2000),
  created_at timestamptz not null default now()
);

create table public.proposal_supports (
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (proposal_id, user_id)
);

alter table public.proposals enable row level security;
alter table public.proposal_supports enable row level security;

create policy "propostes: lectura" on public.proposals for select to authenticated using (public.is_active_member());
create policy "propostes: enviar" on public.proposals for insert to authenticated
  with check (author_id = auth.uid() and public.is_active_member() and status = 'nova' and response is null);
create policy "propostes: respondre" on public.proposals for update to authenticated using (public.is_staff());
create policy "propostes: esborrar" on public.proposals for delete to authenticated
  using ((author_id = auth.uid() and status = 'nova') or public.is_staff());

create policy "suports: lectura" on public.proposal_supports for select to authenticated using (public.is_active_member());
create policy "suports: donar" on public.proposal_supports for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_member());
create policy "suports: retirar" on public.proposal_supports for delete to authenticated using (user_id = auth.uid());

-- ───────────────────────── Documents ─────────────────────────
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  description text not null default '',
  category text not null default 'General',
  file_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20 * 1024 * 1024),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.documents enable row level security;
create policy "documents: lectura" on public.documents for select to authenticated using (public.is_active_member());
create policy "documents: gestió" on public.documents for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Bucket privat: només membres actius poden descarregar, només la coordinació pot pujar o esborrar
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 20971520)
on conflict (id) do nothing;

create policy "documents: descarregar" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_active_member());
create policy "documents: pujar" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.is_staff());
create policy "documents: esborrar fitxer" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.is_staff());


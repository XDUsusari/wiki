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


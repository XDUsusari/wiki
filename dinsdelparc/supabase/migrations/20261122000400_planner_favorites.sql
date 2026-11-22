-- =============================================================================
-- DinsDelParc · 0004 · Visit planner, favourites and attraction reviews
-- =============================================================================

create table public.itineraries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (length(trim(title)) between 1 and 80),
  visit_date date,
  party_size smallint not null default 1 check (party_size between 1 and 30),
  park_ids uuid[] not null default '{}',
  notes text check (length(notes) <= 2000),
  preferences jsonb not null default '{}' check (jsonb_typeof(preferences) = 'object' and length(preferences::text) <= 4000),
  client_id text check (length(client_id) <= 64), -- offline-created plans: idempotent sync key
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index itineraries_user_idx on public.itineraries(user_id, visit_date desc nulls last);
create trigger itineraries_updated_at before update on public.itineraries
  for each row execute function public.set_updated_at();

create table public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  item_kind text not null check (item_kind in ('attraction', 'show', 'restaurant', 'custom')),
  attraction_id uuid references public.attractions(id) on delete cascade,
  show_id uuid references public.shows(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  custom_title text check (length(custom_title) between 1 and 80),
  priority text not null default 'want' check (priority in ('must', 'want', 'maybe')),
  position integer not null default 0,
  planned_time time,
  is_completed boolean not null default false,
  completed_at timestamptz,
  notes text check (length(notes) <= 500),
  client_id text check (length(client_id) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (item_kind = 'attraction' and attraction_id is not null and num_nonnulls(show_id, restaurant_id, custom_title) = 0) or
    (item_kind = 'show' and show_id is not null and num_nonnulls(attraction_id, restaurant_id, custom_title) = 0) or
    (item_kind = 'restaurant' and restaurant_id is not null and num_nonnulls(attraction_id, show_id, custom_title) = 0) or
    (item_kind = 'custom' and custom_title is not null and num_nonnulls(attraction_id, show_id, restaurant_id) = 0)
  ),
  unique (itinerary_id, client_id)
);
create index itinerary_items_itinerary_idx on public.itinerary_items(itinerary_id, position);
create trigger itinerary_items_updated_at before update on public.itinerary_items
  for each row execute function public.set_updated_at();

create or replace function public.itinerary_item_completed() returns trigger
language plpgsql as $$
begin
  if new.is_completed and (tg_op = 'INSERT' or not old.is_completed) then
    new.completed_at := coalesce(new.completed_at, now());
  elsif not new.is_completed then
    new.completed_at := null;
  end if;
  return new;
end;
$$;
create trigger itinerary_items_completed before insert or update on public.itinerary_items
  for each row execute function public.itinerary_item_completed();

create or replace function public.owns_itinerary(p_itinerary uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.itineraries i where i.id = p_itinerary and i.user_id = auth.uid());
$$;

-- Limit: 50 plans and 120 items per plan per user.
create or replace function public.limit_itineraries() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'itineraries' then
    if (select count(*) from public.itineraries where user_id = new.user_id) >= 50 then
      raise exception 'limit_reached' using errcode = 'P0001';
    end if;
  else
    if (select count(*) from public.itinerary_items where itinerary_id = new.itinerary_id) >= 120 then
      raise exception 'limit_reached' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
create trigger itineraries_limit before insert on public.itineraries for each row execute function public.limit_itineraries();
create trigger itinerary_items_limit before insert on public.itinerary_items for each row execute function public.limit_itineraries();

-- -----------------------------------------------------------------------------
-- Favourites (one FK column per target kind keeps referential integrity)
-- -----------------------------------------------------------------------------
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  attraction_id uuid references public.attractions(id) on delete cascade,
  show_id uuid references public.shows(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  shop_id uuid references public.shops(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(attraction_id, show_id, restaurant_id, shop_id) = 1)
);
create unique index favorites_unique_attraction on public.favorites(user_id, attraction_id) where attraction_id is not null;
create unique index favorites_unique_show on public.favorites(user_id, show_id) where show_id is not null;
create unique index favorites_unique_restaurant on public.favorites(user_id, restaurant_id) where restaurant_id is not null;
create unique index favorites_unique_shop on public.favorites(user_id, shop_id) where shop_id is not null;

-- -----------------------------------------------------------------------------
-- Attraction reviews
-- -----------------------------------------------------------------------------
create table public.attraction_reviews (
  id uuid primary key default gen_random_uuid(),
  attraction_id uuid not null references public.attractions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  rating smallint not null check (rating between 1 and 5),
  body text check (length(trim(body)) between 1 and 2000),
  moderation_status public.moderation_status not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attraction_id, user_id)
);
create index attraction_reviews_attraction_idx on public.attraction_reviews(attraction_id, created_at desc);
create trigger attraction_reviews_updated_at before update on public.attraction_reviews
  for each row execute function public.set_updated_at();

create or replace function public.refresh_attraction_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id uuid := coalesce(new.attraction_id, old.attraction_id);
begin
  update public.attractions a set
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.attraction_reviews r
                            where r.attraction_id = v_id and r.moderation_status = 'visible'), 0),
    rating_count = (select count(*) from public.attraction_reviews r
                     where r.attraction_id = v_id and r.moderation_status = 'visible')
  where a.id = v_id;
  return null;
end;
$$;
create trigger attraction_reviews_rating after insert or update or delete on public.attraction_reviews
  for each row execute function public.refresh_attraction_rating();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.itineraries enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.favorites enable row level security;
alter table public.attraction_reviews enable row level security;

create policy itineraries_own on public.itineraries for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy itinerary_items_own on public.itinerary_items for all
  using (public.owns_itinerary(itinerary_id)) with check (public.owns_itinerary(itinerary_id));

create policy favorites_read on public.favorites for select using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = favorites.user_id and p.show_favorites)
);
create policy favorites_insert on public.favorites for insert with check (user_id = auth.uid() and auth.uid() is not null);
create policy favorites_delete on public.favorites for delete using (user_id = auth.uid());

create policy reviews_read on public.attraction_reviews for select using (
  moderation_status = 'visible' or user_id = auth.uid() or public.has_permission('community.moderate')
);
create policy reviews_insert on public.attraction_reviews for insert with check (user_id = auth.uid() and public.can_participate());
create policy reviews_update on public.attraction_reviews for update
  using (user_id = auth.uid() and public.can_participate()) with check (user_id = auth.uid());
create policy reviews_delete on public.attraction_reviews for delete using (user_id = auth.uid());

grant select, insert, update, delete on public.itineraries, public.itinerary_items to authenticated;
grant select on public.favorites to anon, authenticated;
grant insert (attraction_id, show_id, restaurant_id, shop_id) on public.favorites to authenticated;
grant delete on public.favorites to authenticated;
grant select on public.attraction_reviews to anon, authenticated;
grant insert (attraction_id, rating, body) on public.attraction_reviews to authenticated;
grant delete on public.attraction_reviews to authenticated;
grant update (rating, body) on public.attraction_reviews to authenticated;

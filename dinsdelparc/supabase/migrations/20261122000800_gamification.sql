-- =============================================================================
-- DinsDelParc · 0008 · Gamification: XP, levels, badges, achievements and
-- challenges. Anti-spam: daily XP caps per action, XP only for visible
-- content, XP withdrawn when content is hidden/removed or a report rejected.
-- Level formula (mirrored in packages/shared/src/domain/gamification.ts):
--   level = floor(sqrt(xp / 50)) + 1
-- =============================================================================

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name_i18n jsonb not null check (public.is_valid_i18n(name_i18n, 80) and name_i18n <> '{}'),
  description_i18n jsonb not null default '{}' check (public.is_valid_i18n(description_i18n, 400)),
  icon text not null default 'ribbon-outline' check (length(icon) <= 60),
  color text not null default '#1E88E5' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_manual boolean not null default false, -- awarded by staff only
  created_at timestamptz not null default now()
);

create table public.user_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  awarded_by uuid references auth.users(id) on delete set null,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name_i18n jsonb not null check (public.is_valid_i18n(name_i18n, 80) and name_i18n <> '{}'),
  description_i18n jsonb not null default '{}' check (public.is_valid_i18n(description_i18n, 400)),
  icon text not null default 'trophy-outline' check (length(icon) <= 60),
  metric text not null check (metric in ('posts', 'photos', 'wait_reports', 'reviews', 'forum_posts', 'history_posts',
                                         'visits', 'parks_visited', 'coasters_ridden', 'pap_areas_visited', 'account_age_days')),
  threshold integer not null check (threshold > 0),
  xp_reward integer not null default 0 check (xp_reward between 0 and 1000),
  badge_id uuid references public.badges(id) on delete set null,
  is_challenge boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  progress integer not null default 0,
  unlocked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('post', 'comment', 'forum_topic', 'forum_reply', 'wait_report', 'review',
                                     'visit_item', 'achievement', 'staff_adjustment')),
  xp integer not null check (xp between -1000 and 1000),
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index xp_events_user_idx on public.xp_events(user_id, kind, created_at desc);
create unique index xp_events_unique_ref on public.xp_events(user_id, kind, ref_id) where ref_id is not null;

create or replace function public.level_for_xp(p_xp integer) returns smallint
language sql immutable as $$ select (floor(sqrt(greatest(p_xp, 0) / 50.0)) + 1)::smallint $$;

create or replace function public.recompute_xp(p_user uuid) returns void
language sql security definer set search_path = public as $$
  update public.profiles set
    xp = greatest(0, coalesce((select sum(xp) from public.xp_events where user_id = p_user), 0)),
    level = public.level_for_xp(greatest(0, coalesce((select sum(xp) from public.xp_events where user_id = p_user), 0))::int)
  where id = p_user;
$$;

-- XP values and daily caps per action.
create or replace function public.award_xp(p_user uuid, p_kind text, p_ref uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_xp int := case p_kind when 'post' then 10 when 'comment' then 2 when 'forum_topic' then 8 when 'forum_reply' then 3
                          when 'wait_report' then 3 when 'review' then 5 when 'visit_item' then 2 else 0 end;
  v_cap int := case p_kind when 'post' then 3 when 'comment' then 10 when 'forum_topic' then 3 when 'forum_reply' then 10
                           when 'wait_report' then 10 when 'review' then 5 when 'visit_item' then 30 else 0 end;
begin
  if p_user is null or v_xp = 0 then return; end if;
  if (select count(*) from public.xp_events
       where user_id = p_user and kind = p_kind and created_at > date_trunc('day', now())) >= v_cap then
    return;
  end if;
  insert into public.xp_events(user_id, kind, xp, ref_id) values (p_user, p_kind, v_xp, p_ref)
  on conflict do nothing;
  perform public.recompute_xp(p_user);
  perform public.evaluate_achievements(p_user);
end;
$$;

create or replace function public.revoke_xp(p_kind text, p_ref uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  delete from public.xp_events where kind = p_kind and ref_id = p_ref returning user_id into v_user;
  if v_user is not null then perform public.recompute_xp(v_user); end if;
end;
$$;

create or replace function public.achievement_metric(p_user uuid, p_metric text) returns integer
language plpgsql stable security definer set search_path = public as $$
begin
  return case p_metric
    when 'posts' then (select count(*) from public.posts where author_id = p_user and moderation_status = 'visible')
    when 'photos' then (select count(*) from public.post_images i join public.posts p on p.id = i.post_id
                         where p.author_id = p_user and i.moderation_status = 'visible' and p.moderation_status = 'visible')
    when 'wait_reports' then (select count(*) from public.waiting_time_reports
                               where user_id = p_user and status in ('pending', 'approved', 'expired') and not is_anomalous)
    when 'reviews' then (select count(*) from public.attraction_reviews where user_id = p_user and moderation_status = 'visible')
    when 'forum_posts' then (select count(*) from public.forum_topics where author_id = p_user and moderation_status = 'visible')
                          + (select count(*) from public.forum_replies where author_id = p_user and moderation_status = 'visible')
    when 'history_posts' then (select count(*) from public.posts
                                where author_id = p_user and category = 'history' and moderation_status = 'visible')
    when 'visits' then (select count(distinct i.id) from public.itineraries i
                         join public.itinerary_items it on it.itinerary_id = i.id
                        where i.user_id = p_user and it.is_completed)
    when 'parks_visited' then (select count(distinct a.park_id) from public.itineraries i
                                join public.itinerary_items it on it.itinerary_id = i.id and it.is_completed
                                join public.attractions a on a.id = it.attraction_id
                               where i.user_id = p_user)
    when 'coasters_ridden' then (select count(distinct a.id) from public.itineraries i
                                  join public.itinerary_items it on it.itinerary_id = i.id and it.is_completed
                                  join public.attractions a on a.id = it.attraction_id and a.attraction_type = 'roller_coaster'
                                 where i.user_id = p_user)
    when 'pap_areas_visited' then (select count(distinct a.area_id) from public.itineraries i
                                    join public.itinerary_items it on it.itinerary_id = i.id and it.is_completed
                                    join public.attractions a on a.id = it.attraction_id
                                    join public.parks pk on pk.id = a.park_id and pk.slug = 'portaventura-park'
                                   where i.user_id = p_user and a.area_id is not null)
    when 'account_age_days' then (select floor(extract(epoch from now() - created_at) / 86400)::int
                                    from public.profiles where id = p_user)
    else 0 end;
end;
$$;

create or replace function public.evaluate_achievements(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_a public.achievements;
  v_progress int;
  v_was_unlocked boolean;
begin
  for v_a in select * from public.achievements
              where is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()) loop
    select unlocked_at is not null into v_was_unlocked from public.user_achievements
     where user_id = p_user and achievement_id = v_a.id;
    if coalesce(v_was_unlocked, false) then continue; end if;

    v_progress := least(public.achievement_metric(p_user, v_a.metric), v_a.threshold);
    insert into public.user_achievements(user_id, achievement_id, progress, unlocked_at, updated_at)
    values (p_user, v_a.id, v_progress, case when v_progress >= v_a.threshold then now() end, now())
    on conflict (user_id, achievement_id) do update
      set progress = excluded.progress, unlocked_at = excluded.unlocked_at, updated_at = now();

    if v_progress >= v_a.threshold then
      if v_a.xp_reward > 0 then
        insert into public.xp_events(user_id, kind, xp, ref_id) values (p_user, 'achievement', v_a.xp_reward, v_a.id)
        on conflict do nothing;
        perform public.recompute_xp(p_user);
      end if;
      if v_a.badge_id is not null then
        insert into public.user_badges(user_id, badge_id) values (p_user, v_a.badge_id) on conflict do nothing;
      end if;
      perform public.notify(p_user, 'achievement', null, 'achievement', v_a.id,
                            jsonb_build_object('slug', v_a.slug, 'name', v_a.name_i18n));
    end if;
  end loop;
end;
$$;

-- Users may refresh their own achievements (e.g. account age based ones).
create or replace function public.refresh_my_achievements() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  perform public.assert_rate_limit('refresh_achievements', 10, interval '1 hour');
  perform public.evaluate_achievements(auth.uid());
end;
$$;

-- -----------------------------------------------------------------------------
-- Hooks from community / operations / planner tables
-- -----------------------------------------------------------------------------
create or replace function public.gamification_hook() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_kind text := case tg_table_name when 'posts' then 'post' when 'comments' then 'comment'
                   when 'forum_topics' then 'forum_topic' when 'forum_replies' then 'forum_reply'
                   when 'waiting_time_reports' then 'wait_report' when 'attraction_reviews' then 'review'
                   when 'itinerary_items' then 'visit_item' end;
  v_user uuid;
  v_ok boolean;
begin
  if tg_op = 'DELETE' then
    perform public.revoke_xp(v_kind, old.id);
    return null;
  end if;
  if tg_table_name = 'waiting_time_reports' then
    -- Expiry is neutral; rejection or flagging withdraws XP; approval of a flagged report grants it.
    if (to_jsonb(new) ->> 'status') in ('rejected', 'flagged') then
      perform public.revoke_xp(v_kind, new.id);
    elsif (to_jsonb(new) ->> 'status') in ('pending', 'approved')
          and (tg_op = 'INSERT' or (to_jsonb(old) ->> 'status') in ('flagged', 'rejected')) then
      perform public.award_xp((to_jsonb(new) ->> 'user_id')::uuid, v_kind, new.id);
    end if;
    return null;
  end if;
  v_user := case tg_table_name
    when 'attraction_reviews' then (to_jsonb(new) ->> 'user_id')::uuid
    when 'itinerary_items' then (select i.user_id from public.itineraries i where i.id = (to_jsonb(new) ->> 'itinerary_id')::uuid)
    else (to_jsonb(new) ->> 'author_id')::uuid end;
  v_ok := case tg_table_name
    when 'itinerary_items' then (to_jsonb(new) ->> 'is_completed')::boolean
    else (to_jsonb(new) ->> 'moderation_status') = 'visible' end;
  if v_ok then
    perform public.award_xp(v_user, v_kind, new.id);
  elsif tg_op = 'UPDATE' then
    perform public.revoke_xp(v_kind, new.id);
  end if;
  return null;
end;
$$;

create trigger posts_xp after insert or update of moderation_status or delete on public.posts
  for each row execute function public.gamification_hook();
create trigger comments_xp after insert or update of moderation_status or delete on public.comments
  for each row execute function public.gamification_hook();
create trigger forum_topics_xp after insert or update of moderation_status or delete on public.forum_topics
  for each row execute function public.gamification_hook();
create trigger forum_replies_xp after insert or update of moderation_status or delete on public.forum_replies
  for each row execute function public.gamification_hook();
create trigger waiting_time_reports_xp after insert or update of status, is_anomalous on public.waiting_time_reports
  for each row execute function public.gamification_hook();
create trigger attraction_reviews_xp after insert or update of moderation_status or delete on public.attraction_reviews
  for each row execute function public.gamification_hook();
create trigger itinerary_items_xp after insert or update of is_completed or delete on public.itinerary_items
  for each row execute function public.gamification_hook();

-- Reviews: rate limit + text screening (reviews have no moderation_note column).
create or replace function public.guard_review() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user not in ('authenticated', 'anon') or auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    perform public.assert_rate_limit('review', 10, interval '1 hour');
    new.moderation_status := 'visible';
  else
    new.moderation_status := old.moderation_status;
  end if;
  if public.screen_text(new.body) = 'block' then
    raise exception 'content_blocked' using errcode = 'P0001';
  elsif public.screen_text(new.body) = 'review' or public.looks_like_spam(new.body) then
    new.moderation_status := 'pending_review';
  end if;
  return new;
end;
$$;
create trigger attraction_reviews_guard before insert or update on public.attraction_reviews
  for each row execute function public.guard_review();

create or replace function public.admin_award_badge(p_user uuid, p_badge uuid, p_award boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('badges.award') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_award then
    insert into public.user_badges(user_id, badge_id, awarded_by) values (p_user, p_badge, auth.uid()) on conflict do nothing;
    perform public.notify(p_user, 'badge', null, 'badge', p_badge, '{}');
  else
    delete from public.user_badges where user_id = p_user and badge_id = p_badge;
  end if;
  perform public.write_audit(case when p_award then 'award_badge' else 'revoke_badge' end, 'user_badges', p_user::text,
                             null, jsonb_build_object('badge', p_badge));
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.xp_events enable row level security;

create policy badges_read on public.badges for select using (true);
create policy badges_staff on public.badges for all
  using (public.has_permission('badges.award')) with check (public.has_permission('badges.award'));
create policy user_badges_read on public.user_badges for select using (true);
create policy achievements_read on public.achievements for select using (is_active or public.has_permission('badges.award'));
create policy achievements_staff on public.achievements for all
  using (public.has_permission('badges.award')) with check (public.has_permission('badges.award'));
create policy user_achievements_read on public.user_achievements for select using (
  user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = user_achievements.user_id and p.show_stats)
);
create policy xp_events_own on public.xp_events for select using (user_id = auth.uid());

grant select on public.badges, public.user_badges, public.achievements, public.user_achievements to anon, authenticated;
grant insert, update, delete on public.badges, public.achievements to authenticated;
grant select on public.xp_events to authenticated;

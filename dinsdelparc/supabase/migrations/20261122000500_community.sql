-- =============================================================================
-- DinsDelParc · 0005 · Community: notifications, posts, images, comments,
-- reactions, follows, blocks, automatic content screening.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Notifications (text is rendered client-side from `type` + `data`, so it is
-- always shown in the reader's language).
-- -----------------------------------------------------------------------------
create type public.notification_type as enum (
  'follow', 'reaction', 'comment', 'reply', 'mention', 'forum_reply', 'news',
  'moderation', 'plan', 'park_info', 'achievement', 'badge', 'report_resolved'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.notification_type not null,
  actor_id uuid references public.profiles(id) on delete cascade,
  entity_type text check (entity_type in ('post', 'comment', 'forum_topic', 'forum_reply', 'profile', 'attraction',
                                          'park', 'announcement', 'itinerary', 'achievement', 'badge', 'report')),
  entity_id uuid,
  data jsonb not null default '{}' check (jsonb_typeof(data) = 'object' and length(data::text) <= 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id, created_at desc);
create index notifications_unread_idx on public.notifications(user_id) where read_at is null;

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean not null default false,
  social boolean not null default true,       -- follow, reaction
  replies boolean not null default true,      -- comment, reply, forum_reply
  mentions boolean not null default true,
  news boolean not null default true,
  park_info boolean not null default true,
  plans boolean not null default true,
  achievements boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger notification_preferences_updated_at before update on public.notification_preferences
  for each row execute function public.set_updated_at();

create table public.push_tokens (
  token text primary key check (length(token) between 10 and 300),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens(user_id);

-- Blocks are declared here because notify() depends on them.
create table public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks(blocked_id);

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks
                  where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

-- Used by read policies (anon has no access to blocks).
create or replace function public.is_blocked_by_me(p_author uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = p_author);
$$;

create or replace function public.notify(
  p_user uuid, p_type public.notification_type, p_actor uuid,
  p_entity_type text default null, p_entity_id uuid default null, p_data jsonb default '{}'
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_pref public.notification_preferences;
begin
  if p_user is null or p_user = p_actor then return; end if;
  if p_actor is not null and public.is_blocked_between(p_user, p_actor) then return; end if;
  select * into v_pref from public.notification_preferences where user_id = p_user;
  if found then
    if (p_type in ('follow', 'reaction') and not v_pref.social)
       or (p_type in ('comment', 'reply', 'forum_reply') and not v_pref.replies)
       or (p_type = 'mention' and not v_pref.mentions)
       or (p_type = 'news' and not v_pref.news)
       or (p_type = 'park_info' and not v_pref.park_info)
       or (p_type = 'plan' and not v_pref.plans)
       or (p_type in ('achievement', 'badge') and not v_pref.achievements) then
      return; -- moderation and report notices cannot be muted
    end if;
  end if;
  -- Collapse duplicate reactions/follows from the same actor within an hour.
  if p_type in ('reaction', 'follow') and exists (
      select 1 from public.notifications n
       where n.user_id = p_user and n.type = p_type and n.actor_id is not distinct from p_actor
         and n.entity_id is not distinct from p_entity_id and n.created_at > now() - interval '1 hour') then
    return;
  end if;
  insert into public.notifications(user_id, type, actor_id, entity_type, entity_id, data)
  values (p_user, p_type, p_actor, p_entity_type, p_entity_id, coalesce(p_data, '{}'));
end;
$$;
revoke execute on function public.notify(uuid, public.notification_type, uuid, text, uuid, jsonb) from public, anon, authenticated;

-- Notifies every @username mentioned in a text (max 5 per text).
create or replace function public.notify_mentions(
  p_text text, p_actor uuid, p_entity_type text, p_entity_id uuid, p_data jsonb default '{}'
) returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  for v_user in
    select p.id from public.profiles p
     where p.username in (
       select distinct lower(m[1]) from regexp_matches(coalesce(p_text, ''), '@([A-Za-z0-9_.]{3,24})', 'g') as m limit 5)
  loop
    perform public.notify(v_user, 'mention', p_actor, p_entity_type, p_entity_id, p_data);
  end loop;
end;
$$;
revoke execute on function public.notify_mentions(text, uuid, text, uuid, jsonb) from public, anon, authenticated;

-- Default preferences for new users.
create or replace function public.handle_new_user_prefs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notification_preferences(user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger on_profile_created_prefs after insert on public.profiles
  for each row execute function public.handle_new_user_prefs();

-- -----------------------------------------------------------------------------
-- Automatic screening of user text against staff-managed terms.
-- 'block' rejects the text; 'review' publishes it as pending_review and
-- opens a system report for moderators.
-- -----------------------------------------------------------------------------
create table public.moderation_terms (
  term text primary key check (length(term) between 2 and 60 and term = lower(term)),
  action text not null default 'review' check (action in ('review', 'block')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create or replace function public.screen_text(p_text text) returns text
language sql stable security definer set search_path = public as $$
  select t.action from public.moderation_terms t
   where public.normalize_text(p_text) ~ ('(^|[^a-z0-9])' || regexp_replace(public.normalize_text(t.term), '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '([^a-z0-9]|$)')
   order by case t.action when 'block' then 0 else 1 end
   limit 1;
$$;

-- Heuristic spam signals: too many links or a long run of the same character.
create or replace function public.looks_like_spam(p_text text) returns boolean
language sql immutable as $$
  select (select count(*) from regexp_matches(coalesce(p_text, ''), 'https?://', 'g')) > 3
      or coalesce(p_text, '') ~ '(.)\1{14,}';
$$;

-- -----------------------------------------------------------------------------
-- Posts
-- -----------------------------------------------------------------------------
create type public.post_category as enum (
  'news', 'experiences', 'attractions', 'photos', 'collecting', 'history', 'events', 'debates', 'trivia'
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  category public.post_category not null,
  body text not null check (length(trim(body)) between 1 and 5000),
  park_id uuid references public.parks(id) on delete set null,
  attraction_id uuid references public.attractions(id) on delete set null,
  moderation_status public.moderation_status not null default 'visible',
  moderation_note text,
  is_featured boolean not null default false,
  comment_count integer not null default 0,
  reaction_count integer not null default 0,
  search_text text generated always as (public.normalize_text(body)) stored,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index posts_feed_idx on public.posts(created_at desc) where moderation_status = 'visible';
create index posts_author_idx on public.posts(author_id, created_at desc);
create index posts_category_idx on public.posts(category, created_at desc);
create index posts_search_trgm on public.posts using gin (search_text extensions.gin_trgm_ops);

create table public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  storage_path text not null check (storage_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}\.(jpg|jpeg|png|webp)$'),
  width integer check (width between 1 and 10000),
  height integer check (height between 1 and 10000),
  alt_text text check (length(alt_text) <= 300),
  position smallint not null default 0 check (position between 0 and 3),
  moderation_status public.moderation_status not null default 'visible',
  created_at timestamptz not null default now(),
  unique (post_id, position)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  moderation_status public.moderation_status not null default 'visible',
  moderation_note text,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index comments_post_idx on public.comments(post_id, created_at);

create type public.reaction_kind as enum ('like', 'love', 'wow', 'fun');

create table public.reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind public.reaction_kind not null default 'like',
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_idx on public.follows(following_id);

-- -----------------------------------------------------------------------------
-- Shared guard for user-generated text (posts, comments, forum topics/replies)
-- -----------------------------------------------------------------------------
-- SECURITY INVOKER on purpose: current_user tells a direct client write
-- ('authenticated') apart from a trusted SECURITY DEFINER moderation function.
create or replace function public.guard_user_text() returns trigger
language plpgsql set search_path = public as $$
declare
  v_text text;
  v_screen text;
  v_limit int;
begin
  if current_user not in ('authenticated', 'anon') or auth.uid() is null then
    return new; -- service role, migrations or moderation functions
  end if;
  v_text := coalesce(to_jsonb(new) ->> 'title', '') || ' ' || coalesce(to_jsonb(new) ->> 'body', '');

  if tg_op = 'INSERT' then
    v_limit := case tg_table_name when 'posts' then 10 when 'forum_topics' then 5 else 40 end;
    perform public.assert_rate_limit(tg_table_name, v_limit, interval '1 hour');
    new.moderation_status := 'visible';
    new.moderation_note := null;
  else
    -- Authors can edit, but never change moderation fields themselves.
    new.moderation_status := old.moderation_status;
    new.moderation_note := old.moderation_note;
    if (to_jsonb(new) ->> 'body') is distinct from (to_jsonb(old) ->> 'body')
       or (to_jsonb(new) ->> 'title') is distinct from (to_jsonb(old) ->> 'title') then
      new.edited_at := now();
    end if;
  end if;

  v_screen := public.screen_text(v_text);
  if v_screen = 'block' then
    raise exception 'content_blocked' using errcode = 'P0001';
  elsif v_screen = 'review' or public.looks_like_spam(v_text) then
    new.moderation_status := 'pending_review';
    new.moderation_note := 'automatic screening';
  end if;
  return new;
end;
$$;

create trigger posts_guard before insert or update on public.posts
  for each row execute function public.guard_user_text();
create trigger comments_guard before insert or update on public.comments
  for each row execute function public.guard_user_text();

-- Comments cannot be added to hidden posts or across a block.
create or replace function public.check_comment_target() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_post record;
begin
  select author_id, moderation_status into v_post from public.posts where id = new.post_id;
  if not found or v_post.moderation_status <> 'visible' then
    raise exception 'post_unavailable' using errcode = '22023';
  end if;
  if public.is_blocked_between(new.author_id, v_post.author_id) then
    raise exception 'blocked' using errcode = '42501';
  end if;
  if new.parent_id is not null and not exists (
      select 1 from public.comments c where c.id = new.parent_id and c.post_id = new.post_id and c.parent_id is null) then
    raise exception 'invalid_parent' using errcode = '22023'; -- only one level of nesting
  end if;
  return new;
end;
$$;
create trigger comments_target before insert on public.comments
  for each row execute function public.check_comment_target();

create or replace function public.check_follow_target() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_blocked_between(new.follower_id, new.following_id) then
    raise exception 'blocked' using errcode = '42501';
  end if;
  perform public.assert_rate_limit('follow', 100, interval '1 hour');
  return new;
end;
$$;
create trigger follows_target before insert on public.follows
  for each row execute function public.check_follow_target();

-- Blocking removes follows in both directions.
create or replace function public.after_block() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.follows
   where (follower_id = new.blocker_id and following_id = new.blocked_id)
      or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return null;
end;
$$;
create trigger blocks_after after insert on public.blocks for each row execute function public.after_block();

-- -----------------------------------------------------------------------------
-- Counters and notifications
-- -----------------------------------------------------------------------------
create or replace function public.post_counters() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'comments' then
    update public.posts p set comment_count = (
      select count(*) from public.comments c where c.post_id = p.id and c.moderation_status = 'visible')
     where p.id = coalesce(new.post_id, old.post_id);
  elsif tg_table_name = 'reactions' then
    update public.posts p set reaction_count = (select count(*) from public.reactions r where r.post_id = p.id)
     where p.id = coalesce(new.post_id, old.post_id);
  elsif tg_table_name = 'posts' then
    update public.profiles pr set posts_count = (
      select count(*) from public.posts p where p.author_id = pr.id and p.moderation_status = 'visible')
     where pr.id = coalesce(new.author_id, old.author_id);
  elsif tg_table_name = 'follows' then
    update public.profiles pr set followers_count = (select count(*) from public.follows f where f.following_id = pr.id)
     where pr.id = coalesce(new.following_id, old.following_id);
    update public.profiles pr set following_count = (select count(*) from public.follows f where f.follower_id = pr.id)
     where pr.id = coalesce(new.follower_id, old.follower_id);
  end if;
  return null;
end;
$$;
create trigger comments_counters after insert or update of moderation_status or delete on public.comments
  for each row execute function public.post_counters();
create trigger reactions_counters after insert or delete on public.reactions
  for each row execute function public.post_counters();
create trigger posts_counters after insert or update of moderation_status or delete on public.posts
  for each row execute function public.post_counters();
create trigger follows_counters after insert or delete on public.follows
  for each row execute function public.post_counters();

create or replace function public.community_notifications() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_post_author uuid;
  v_parent_author uuid;
begin
  if tg_table_name = 'comments' then
    if new.moderation_status <> 'visible' then return null; end if;
    select author_id into v_post_author from public.posts where id = new.post_id;
    if new.parent_id is not null then
      select author_id into v_parent_author from public.comments where id = new.parent_id;
      perform public.notify(v_parent_author, 'reply', new.author_id, 'post', new.post_id, jsonb_build_object('comment_id', new.id));
    end if;
    if v_post_author is distinct from v_parent_author then
      perform public.notify(v_post_author, 'comment', new.author_id, 'post', new.post_id, jsonb_build_object('comment_id', new.id));
    end if;
    perform public.notify_mentions(new.body, new.author_id, 'post', new.post_id);
  elsif tg_table_name = 'posts' then
    if new.moderation_status = 'visible' then
      perform public.notify_mentions(new.body, new.author_id, 'post', new.id);
    end if;
  elsif tg_table_name = 'reactions' then
    select author_id into v_post_author from public.posts where id = new.post_id;
    perform public.notify(v_post_author, 'reaction', new.user_id, 'post', new.post_id, jsonb_build_object('kind', new.kind));
  elsif tg_table_name = 'follows' then
    perform public.notify(new.following_id, 'follow', new.follower_id, 'profile', new.follower_id);
  end if;
  return null;
end;
$$;
create trigger comments_notify after insert on public.comments for each row execute function public.community_notifications();
create trigger posts_notify after insert on public.posts for each row execute function public.community_notifications();
create trigger reactions_notify after insert on public.reactions for each row execute function public.community_notifications();
create trigger follows_notify after insert on public.follows for each row execute function public.community_notifications();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_tokens enable row level security;
alter table public.blocks enable row level security;
alter table public.moderation_terms enable row level security;
alter table public.posts enable row level security;
alter table public.post_images enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.follows enable row level security;

create policy notifications_own_read on public.notifications for select using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_own_delete on public.notifications for delete using (user_id = auth.uid());

create policy notification_prefs_own on public.notification_preferences for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy push_tokens_own on public.push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy blocks_own on public.blocks for select using (blocker_id = auth.uid());
create policy blocks_insert on public.blocks for insert with check (blocker_id = auth.uid());
create policy blocks_delete on public.blocks for delete using (blocker_id = auth.uid());

create policy moderation_terms_staff on public.moderation_terms for all
  using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));

create policy posts_read on public.posts for select using (
  (moderation_status = 'visible' and not public.is_blocked_by_me(posts.author_id))
  or author_id = auth.uid()
  or public.has_permission('community.moderate')
);
create policy posts_insert on public.posts for insert with check (author_id = auth.uid() and public.can_participate());
create policy posts_update on public.posts for update
  using (author_id = auth.uid() and public.can_participate() and moderation_status <> 'removed')
  with check (author_id = auth.uid());
create policy posts_delete on public.posts for delete using (author_id = auth.uid());

create policy post_images_read on public.post_images for select using (
  exists (select 1 from public.posts p where p.id = post_images.post_id)
  and (moderation_status = 'visible'
       or exists (select 1 from public.posts p where p.id = post_images.post_id and p.author_id = auth.uid())
       or public.has_permission('community.moderate'))
);
create policy post_images_insert on public.post_images for insert with check (
  public.can_participate()
  and exists (select 1 from public.posts p where p.id = post_images.post_id and p.author_id = auth.uid())
  and split_part(storage_path, '/', 1) = auth.uid()::text
);
create policy post_images_delete on public.post_images for delete using (
  exists (select 1 from public.posts p where p.id = post_images.post_id and p.author_id = auth.uid())
);

create policy comments_read on public.comments for select using (
  (moderation_status = 'visible'
   and exists (select 1 from public.posts p where p.id = comments.post_id)
   and not public.is_blocked_by_me(comments.author_id))
  or author_id = auth.uid()
  or public.has_permission('community.moderate')
);
create policy comments_insert on public.comments for insert with check (author_id = auth.uid() and public.can_participate());
create policy comments_update on public.comments for update
  using (author_id = auth.uid() and public.can_participate() and moderation_status <> 'removed')
  with check (author_id = auth.uid());
create policy comments_delete on public.comments for delete using (author_id = auth.uid());

create policy reactions_read on public.reactions for select using (true);
create policy reactions_insert on public.reactions for insert with check (
  user_id = auth.uid() and public.can_participate()
  and exists (select 1 from public.posts p where p.id = reactions.post_id and p.moderation_status = 'visible'
              and not public.is_blocked_between(p.author_id, auth.uid()))
);
create policy reactions_update on public.reactions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reactions_delete on public.reactions for delete using (user_id = auth.uid());

create policy follows_read on public.follows for select using (true);
create policy follows_insert on public.follows for insert with check (follower_id = auth.uid() and not public.is_suspended(auth.uid()));
create policy follows_delete on public.follows for delete using (follower_id = auth.uid());

grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select, delete on public.push_tokens to authenticated;
grant insert (token, platform), update (last_seen_at, platform) on public.push_tokens to authenticated;
grant select, delete on public.blocks to authenticated;
grant insert (blocked_id) on public.blocks to authenticated;
grant select, insert, update, delete on public.moderation_terms to authenticated;
grant select on public.posts, public.post_images, public.comments, public.reactions, public.follows to anon, authenticated;
grant delete on public.posts, public.post_images, public.comments to authenticated;
grant insert (category, body, park_id, attraction_id) on public.posts to authenticated;
grant insert (post_id, storage_path, width, height, alt_text, position) on public.post_images to authenticated;
grant insert (post_id, parent_id, body) on public.comments to authenticated;
grant update (body, category, park_id, attraction_id) on public.posts to authenticated;
grant update (body) on public.comments to authenticated;
grant delete on public.reactions, public.follows to authenticated;
grant insert (post_id, kind) on public.reactions to authenticated;
grant insert (following_id) on public.follows to authenticated;
grant update (kind) on public.reactions to authenticated;

-- =============================================================================
-- DinsDelParc · 0006 · Forum: categories, topics, replies (with quotes),
-- bookmarks and subscriptions.
-- =============================================================================

create table public.forum_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name_i18n jsonb not null check (public.is_valid_i18n(name_i18n, 80) and name_i18n <> '{}'),
  description_i18n jsonb not null default '{}' check (public.is_valid_i18n(description_i18n, 400)),
  icon text not null default 'chatbubbles-outline' check (length(icon) <= 60),
  park_id uuid references public.parks(id) on delete set null,
  sort_order smallint not null default 0,
  is_locked boolean not null default false,       -- only staff can open topics
  topic_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.forum_topics (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.forum_categories(id) on delete restrict,
  author_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (length(trim(title)) between 5 and 140),
  body text not null check (length(trim(body)) between 1 and 10000),
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  moderation_status public.moderation_status not null default 'visible',
  moderation_note text,
  reply_count integer not null default 0,
  last_activity_at timestamptz not null default now(),
  search_text text generated always as (public.normalize_text(title || ' ' || body)) stored,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index forum_topics_category_idx on public.forum_topics(category_id, is_pinned desc, last_activity_at desc);
create index forum_topics_author_idx on public.forum_topics(author_id, created_at desc);
create index forum_topics_search_trgm on public.forum_topics using gin (search_text extensions.gin_trgm_ops);

create table public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.forum_topics(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  quoted_reply_id uuid references public.forum_replies(id) on delete set null,
  body text not null check (length(trim(body)) between 1 and 10000),
  moderation_status public.moderation_status not null default 'visible',
  moderation_note text,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index forum_replies_topic_idx on public.forum_replies(topic_id, created_at);

create table public.forum_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  topic_id uuid not null references public.forum_topics(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create table public.forum_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  topic_id uuid not null references public.forum_topics(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create trigger forum_topics_guard before insert or update on public.forum_topics
  for each row execute function public.guard_user_text();
create trigger forum_replies_guard before insert or update on public.forum_replies
  for each row execute function public.guard_user_text();

-- Authors may not pin/lock themselves (column grants also prevent it).
create or replace function public.check_forum_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_cat record;
  v_topic record;
begin
  if tg_table_name = 'forum_topics' then
    select is_locked into v_cat from public.forum_categories where id = new.category_id;
    if not found then raise exception 'category_not_found' using errcode = '22023'; end if;
    if v_cat.is_locked and not public.has_permission('forum.manage') then
      raise exception 'category_locked' using errcode = '42501';
    end if;
    if tg_op = 'INSERT' then
      new.is_pinned := false; new.is_locked := false; new.reply_count := 0; new.last_activity_at := now();
    end if;
  else
    select is_locked, moderation_status, author_id into v_topic from public.forum_topics where id = new.topic_id;
    if not found or v_topic.moderation_status <> 'visible' then
      raise exception 'topic_unavailable' using errcode = '22023';
    end if;
    if v_topic.is_locked and not public.has_permission('forum.manage') then
      raise exception 'topic_locked' using errcode = '42501';
    end if;
    if new.quoted_reply_id is not null and not exists (
        select 1 from public.forum_replies r where r.id = new.quoted_reply_id and r.topic_id = new.topic_id) then
      raise exception 'invalid_quote' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
create trigger forum_topics_check before insert on public.forum_topics for each row execute function public.check_forum_write();
create trigger forum_replies_check before insert on public.forum_replies for each row execute function public.check_forum_write();

create or replace function public.forum_after_write() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_sub uuid;
  v_quoted_author uuid;
  v_topic_id uuid;
  v_category_id uuid;
begin
  if tg_table_name = 'forum_topics' then
    v_category_id := coalesce(new.category_id, old.category_id);
    update public.forum_categories c set topic_count = (
      select count(*) from public.forum_topics t where t.category_id = c.id and t.moderation_status = 'visible')
     where c.id = v_category_id;
    if tg_op = 'INSERT' then
      insert into public.forum_subscriptions(user_id, topic_id) values (new.author_id, new.id) on conflict do nothing;
      if new.moderation_status = 'visible' then
        perform public.notify_mentions(new.body, new.author_id, 'forum_topic', new.id);
      end if;
    end if;
    return null;
  end if;

  v_topic_id := coalesce(new.topic_id, old.topic_id);
  update public.forum_topics t set
    reply_count = (select count(*) from public.forum_replies r where r.topic_id = t.id and r.moderation_status = 'visible'),
    last_activity_at = greatest(t.created_at, coalesce((select max(r.created_at) from public.forum_replies r
                                                         where r.topic_id = t.id and r.moderation_status = 'visible'), t.created_at))
   where t.id = v_topic_id;

  if tg_op = 'INSERT' and new.moderation_status = 'visible' then
    insert into public.forum_subscriptions(user_id, topic_id) values (new.author_id, new.topic_id) on conflict do nothing;
    if new.quoted_reply_id is not null then
      select author_id into v_quoted_author from public.forum_replies where id = new.quoted_reply_id;
      perform public.notify(v_quoted_author, 'mention', new.author_id, 'forum_topic', new.topic_id,
                            jsonb_build_object('reply_id', new.id, 'quoted', true));
    end if;
    for v_sub in select s.user_id from public.forum_subscriptions s
                  where s.topic_id = new.topic_id and s.user_id <> new.author_id
                    and s.user_id is distinct from v_quoted_author
                  limit 500 loop
      perform public.notify(v_sub, 'forum_reply', new.author_id, 'forum_topic', new.topic_id, jsonb_build_object('reply_id', new.id));
    end loop;
    perform public.notify_mentions(new.body, new.author_id, 'forum_topic', new.topic_id, jsonb_build_object('reply_id', new.id));
  end if;
  return null;
end;
$$;
create trigger forum_topics_after after insert or update of moderation_status or delete on public.forum_topics
  for each row execute function public.forum_after_write();
create trigger forum_replies_after after insert or update of moderation_status or delete on public.forum_replies
  for each row execute function public.forum_after_write();

create or replace function public.forum_set_flags(p_topic uuid, p_pinned boolean default null, p_locked boolean default null,
                                                  p_category uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_before jsonb;
begin
  if not public.has_permission('forum.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select to_jsonb(t) into v_before from public.forum_topics t where id = p_topic;
  if v_before is null then raise exception 'not_found' using errcode = '22023'; end if;
  update public.forum_topics set
    is_pinned = coalesce(p_pinned, is_pinned),
    is_locked = coalesce(p_locked, is_locked),
    category_id = coalesce(p_category, category_id)
   where id = p_topic;
  perform public.write_audit('forum_set_flags', 'forum_topics', p_topic::text, v_before,
                             jsonb_build_object('pinned', p_pinned, 'locked', p_locked, 'category', p_category));
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.forum_categories enable row level security;
alter table public.forum_topics enable row level security;
alter table public.forum_replies enable row level security;
alter table public.forum_bookmarks enable row level security;
alter table public.forum_subscriptions enable row level security;

create policy forum_categories_read on public.forum_categories for select using (true);
create policy forum_categories_staff on public.forum_categories for all
  using (public.has_permission('forum.manage')) with check (public.has_permission('forum.manage'));

create policy forum_topics_read on public.forum_topics for select using (
  (moderation_status = 'visible' and not public.is_blocked_by_me(forum_topics.author_id))
  or author_id = auth.uid() or public.has_permission('community.moderate')
);
create policy forum_topics_insert on public.forum_topics for insert with check (author_id = auth.uid() and public.can_participate());
create policy forum_topics_update on public.forum_topics for update
  using (author_id = auth.uid() and public.can_participate() and not is_locked and moderation_status <> 'removed')
  with check (author_id = auth.uid());
create policy forum_topics_delete on public.forum_topics for delete using (author_id = auth.uid() and reply_count = 0);

create policy forum_replies_read on public.forum_replies for select using (
  (moderation_status = 'visible'
   and exists (select 1 from public.forum_topics t where t.id = forum_replies.topic_id)
   and not public.is_blocked_by_me(forum_replies.author_id))
  or author_id = auth.uid() or public.has_permission('community.moderate')
);
create policy forum_replies_insert on public.forum_replies for insert with check (author_id = auth.uid() and public.can_participate());
create policy forum_replies_update on public.forum_replies for update
  using (author_id = auth.uid() and public.can_participate() and moderation_status <> 'removed')
  with check (author_id = auth.uid());
create policy forum_replies_delete on public.forum_replies for delete using (author_id = auth.uid());

create policy forum_bookmarks_own on public.forum_bookmarks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy forum_subscriptions_own on public.forum_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.forum_categories, public.forum_topics, public.forum_replies to anon, authenticated;
grant insert, update, delete on public.forum_categories to authenticated;
grant delete on public.forum_topics, public.forum_replies to authenticated;
grant insert (category_id, title, body) on public.forum_topics to authenticated;
grant insert (topic_id, quoted_reply_id, body) on public.forum_replies to authenticated;
grant update (title, body) on public.forum_topics to authenticated;
grant update (body) on public.forum_replies to authenticated;
grant select, delete on public.forum_bookmarks, public.forum_subscriptions to authenticated;
grant insert (topic_id) on public.forum_bookmarks, public.forum_subscriptions to authenticated;

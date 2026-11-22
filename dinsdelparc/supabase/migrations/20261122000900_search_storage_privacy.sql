-- =============================================================================
-- DinsDelParc · 0009 · Global search, Storage buckets & policies, RGPD
-- (data export), admin dashboard / user listing.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Global search. SECURITY INVOKER: every branch is filtered by RLS, so users
-- only find what they are allowed to read.
-- -----------------------------------------------------------------------------
create or replace function public.search_all(p_query text, p_kinds text[] default null, p_limit int default 30)
returns table (kind text, id uuid, title text, subtitle text, slug text, park_slug text, score real)
language plpgsql stable set search_path = public, extensions as $$
declare
  v_q text := public.normalize_text(left(trim(coalesce(p_query, '')), 80));
  v_like text;
  v_limit int := least(greatest(coalesce(p_limit, 30), 1), 50);
begin
  if length(v_q) < 2 then return; end if;
  v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query
  select * from (
    select 'park'::text, p.id, p.name, null::text, p.slug, p.slug,
           (similarity(public.normalize_text(p.name), v_q) + case when public.normalize_text(p.name) like v_like then 0.6 else 0 end)::real
      from public.parks p
     where (p_kinds is null or 'park' = any(p_kinds)) and p.is_published
       and (public.normalize_text(p.name) like v_like or similarity(public.normalize_text(p.name), v_q) > 0.25)
    union all
    select 'area', a.id, a.name, p.name, a.slug, p.slug,
           (similarity(public.normalize_text(a.name), v_q) + case when public.normalize_text(a.name) like v_like then 0.5 else 0 end)::real
      from public.themed_areas a join public.parks p on p.id = a.park_id
     where (p_kinds is null or 'area' = any(p_kinds)) and a.is_published
       and (public.normalize_text(a.name) like v_like or similarity(public.normalize_text(a.name), v_q) > 0.25)
    union all
    select 'attraction', x.id, x.name, p.name, x.slug, p.slug,
           (similarity(x.search_text, v_q) + case when x.search_text like v_like then 0.5 else 0 end + 0.05)::real
      from public.attractions x join public.parks p on p.id = x.park_id
     where (p_kinds is null or 'attraction' = any(p_kinds)) and x.is_published
       and (x.search_text like v_like or similarity(x.search_text, v_q) > 0.25)
    union all
    select 'restaurant', x.id, x.name, p.name, x.slug, p.slug,
           (similarity(x.search_text, v_q) + case when x.search_text like v_like then 0.45 else 0 end)::real
      from public.restaurants x join public.parks p on p.id = x.park_id
     where (p_kinds is null or 'restaurant' = any(p_kinds)) and x.is_published
       and (x.search_text like v_like or similarity(x.search_text, v_q) > 0.25)
    union all
    select 'shop', x.id, x.name, p.name, x.slug, p.slug,
           (similarity(x.search_text, v_q) + case when x.search_text like v_like then 0.4 else 0 end)::real
      from public.shops x join public.parks p on p.id = x.park_id
     where (p_kinds is null or 'shop' = any(p_kinds)) and x.is_published
       and (x.search_text like v_like or similarity(x.search_text, v_q) > 0.25)
    union all
    select 'show', x.id, x.name, p.name, x.slug, p.slug,
           (similarity(x.search_text, v_q) + case when x.search_text like v_like then 0.45 else 0 end)::real
      from public.shows x join public.parks p on p.id = x.park_id
     where (p_kinds is null or 'show' = any(p_kinds)) and x.is_published
       and (x.search_text like v_like or similarity(x.search_text, v_q) > 0.25)
    union all
    select 'user', pr.id, coalesce(pr.display_name, pr.username), '@' || pr.username, pr.username, null,
           (greatest(similarity(public.normalize_text(pr.username), v_q), similarity(public.normalize_text(pr.display_name), v_q))
            + case when public.normalize_text(pr.username) like v_like then 0.3 else 0 end)::real
      from public.profiles pr
     where (p_kinds is null or 'user' = any(p_kinds))
       and (public.normalize_text(pr.username) like v_like or public.normalize_text(pr.display_name) like v_like)
    union all
    select 'post', x.id, left(x.body, 120), x.category::text, null, null,
           (0.2 + similarity(x.search_text, v_q) * 0.5)::real
      from public.posts x
     where (p_kinds is null or 'post' = any(p_kinds)) and x.moderation_status = 'visible' and x.search_text like v_like
    union all
    select 'forum_topic', x.id, x.title, null, null, null,
           (0.25 + similarity(x.search_text, v_q) * 0.5 + case when public.normalize_text(x.title) like v_like then 0.3 else 0 end)::real
      from public.forum_topics x
     where (p_kinds is null or 'forum_topic' = any(p_kinds)) and x.moderation_status = 'visible' and x.search_text like v_like
  ) r(kind, id, title, subtitle, slug, park_slug, score)
  order by r.score desc, r.title
  limit v_limit;
end;
$$;

-- -----------------------------------------------------------------------------
-- Storage buckets. Uploads are restricted by size and MIME type at bucket
-- level and by folder ownership (<user_id>/<file>) in policies.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('post-images', 'post-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('content', 'content', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create policy "dinsdelparc avatars read" on storage.objects for select using (bucket_id = 'avatars');
create policy "dinsdelparc avatars write own" on storage.objects for insert to authenticated with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  and storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp') and not public.is_suspended(auth.uid())
);
create policy "dinsdelparc avatars update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "dinsdelparc avatars delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "dinsdelparc post images read" on storage.objects for select using (bucket_id = 'post-images');
create policy "dinsdelparc post images write own" on storage.objects for insert to authenticated with check (
  bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text
  and storage.extension(name) in ('jpg', 'jpeg', 'png', 'webp') and public.can_participate()
);
create policy "dinsdelparc post images delete own or moderator" on storage.objects for delete to authenticated using (
  bucket_id = 'post-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_permission('community.moderate'))
);

create policy "dinsdelparc content read" on storage.objects for select using (bucket_id = 'content');
create policy "dinsdelparc content staff write" on storage.objects for insert to authenticated
  with check (bucket_id = 'content' and public.has_permission('content.edit'));
create policy "dinsdelparc content staff update" on storage.objects for update to authenticated
  using (bucket_id = 'content' and public.has_permission('content.edit'));
create policy "dinsdelparc content staff delete" on storage.objects for delete to authenticated
  using (bucket_id = 'content' and public.has_permission('content.delete'));

-- -----------------------------------------------------------------------------
-- RGPD: portable export of everything linked to the caller.
-- -----------------------------------------------------------------------------
create or replace function public.export_my_data() returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  perform public.assert_rate_limit('export_data', 5, interval '1 day');
  return jsonb_build_object(
    'generated_at', now(),
    'notice', 'DinsDelParc personal data export (RGPD art. 15 and 20)',
    'account', (select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at,
                                          'email_confirmed_at', u.email_confirmed_at, 'last_sign_in_at', u.last_sign_in_at)
                  from auth.users u where u.id = v_uid),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'settings', (select to_jsonb(s) from public.user_settings s where s.user_id = v_uid),
    'notification_preferences', (select to_jsonb(n) from public.notification_preferences n where n.user_id = v_uid),
    'roles', (select coalesce(jsonb_agg(r.role), '[]') from public.user_roles r where r.user_id = v_uid),
    'consents', (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at), '[]') from public.consents c where c.user_id = v_uid),
    'itineraries', (select coalesce(jsonb_agg(to_jsonb(i) || jsonb_build_object('items',
                      (select coalesce(jsonb_agg(to_jsonb(it) order by it.position), '[]') from public.itinerary_items it where it.itinerary_id = i.id))), '[]')
                      from public.itineraries i where i.user_id = v_uid),
    'favorites', (select coalesce(jsonb_agg(to_jsonb(f)), '[]') from public.favorites f where f.user_id = v_uid),
    'posts', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from public.posts p where p.author_id = v_uid),
    'post_images', (select coalesce(jsonb_agg(to_jsonb(i)), '[]') from public.post_images i
                      join public.posts p on p.id = i.post_id where p.author_id = v_uid),
    'comments', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.comments c where c.author_id = v_uid),
    'reactions', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.reactions r where r.user_id = v_uid),
    'reviews', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.attraction_reviews r where r.user_id = v_uid),
    'forum_topics', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.forum_topics t where t.author_id = v_uid),
    'forum_replies', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.forum_replies r where r.author_id = v_uid),
    'follows', (select coalesce(jsonb_agg(to_jsonb(f)), '[]') from public.follows f where f.follower_id = v_uid),
    'blocks', (select coalesce(jsonb_agg(to_jsonb(b)), '[]') from public.blocks b where b.blocker_id = v_uid),
    'wait_reports', (select coalesce(jsonb_agg(to_jsonb(w)), '[]') from public.waiting_time_reports w where w.user_id = v_uid),
    'reports_filed', (select coalesce(jsonb_agg(jsonb_build_object('target_type', r.target_type, 'reason', r.reason,
                                                                    'state', r.state, 'created_at', r.created_at)), '[]')
                        from public.reports r where r.reporter_id = v_uid),
    'badges', (select coalesce(jsonb_agg(to_jsonb(b)), '[]') from public.user_badges b where b.user_id = v_uid),
    'achievements', (select coalesce(jsonb_agg(to_jsonb(a)), '[]') from public.user_achievements a where a.user_id = v_uid),
    'xp_events', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.xp_events x where x.user_id = v_uid),
    'notifications', (select coalesce(jsonb_agg(to_jsonb(n)), '[]') from public.notifications n where n.user_id = v_uid),
    'push_tokens', (select coalesce(jsonb_agg(jsonb_build_object('platform', t.platform, 'created_at', t.created_at)), '[]')
                      from public.push_tokens t where t.user_id = v_uid)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Admin dashboard & user listing (e-mail lives in auth.users, so these are
-- SECURITY DEFINER and check permissions explicitly).
-- -----------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats() returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.has_permission('dashboard.view') then raise exception 'forbidden' using errcode = '42501'; end if;
  return jsonb_build_object(
    'users_total', (select count(*) from public.profiles),
    'users_new_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'users_active_7d', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'users_suspended', (select count(*) from public.user_moderation where suspended_until > now()),
    'posts_total', (select count(*) from public.posts),
    'posts_7d', (select count(*) from public.posts where created_at > now() - interval '7 days'),
    'comments_total', (select count(*) from public.comments),
    'forum_topics_total', (select count(*) from public.forum_topics),
    'forum_replies_total', (select count(*) from public.forum_replies),
    'reports_open', (select count(*) from public.reports where state in ('open', 'reviewing')),
    'pending_review_items', (select count(*) from public.posts where moderation_status = 'pending_review')
                          + (select count(*) from public.comments where moderation_status = 'pending_review')
                          + (select count(*) from public.forum_topics where moderation_status = 'pending_review')
                          + (select count(*) from public.forum_replies where moderation_status = 'pending_review'),
    'attractions_total', (select count(*) from public.attractions),
    'attractions_published', (select count(*) from public.attractions where is_published),
    'attractions_pending_verification', (select count(*) from public.attractions where data_origin <> 'verified'),
    'wait_reports_24h', (select count(*) from public.waiting_time_reports where created_at > now() - interval '24 hours'),
    'wait_reports_flagged', (select count(*) from public.waiting_time_reports where status = 'flagged'),
    'stale_schedules', (select count(*) from public.park_schedules where schedule_date < current_date and is_published),
    'activity_14d', (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'posts', d.posts, 'replies', d.replies,
                                                                  'reports', d.reports) order by d.day), '[]')
                       from (select g.day::date as day,
                                    (select count(*) from public.posts p where p.created_at::date = g.day::date) as posts,
                                    (select count(*) from public.forum_replies r where r.created_at::date = g.day::date) as replies,
                                    (select count(*) from public.waiting_time_reports w where w.created_at::date = g.day::date) as reports
                               from generate_series(current_date - 13, current_date, interval '1 day') g(day)) d)
  );
end;
$$;

create or replace function public.admin_list_users(p_search text default null, p_limit int default 50, p_offset int default 0)
returns table (id uuid, username text, display_name text, email text, email_confirmed boolean, created_at timestamptz,
               last_sign_in_at timestamptz, roles public.app_role[], suspended_until timestamptz, posts_count int, xp int)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.has_permission('users.view') then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select p.id, p.username, p.display_name, u.email::text, u.email_confirmed_at is not null, p.created_at, u.last_sign_in_at,
         array(select ur.role from public.user_roles ur join public.roles r on r.id = ur.role
                where ur.user_id = p.id order by r.rank desc),
         m.suspended_until, p.posts_count, p.xp
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.user_moderation m on m.user_id = p.id
   where p_search is null or p_search = ''
      or public.normalize_text(p.username) like '%' || public.normalize_text(p_search) || '%'
      or public.normalize_text(p.display_name) like '%' || public.normalize_text(p_search) || '%'
      or lower(u.email) like '%' || lower(p_search) || '%'
   order by p.created_at desc
   limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end;
$$;

-- -----------------------------------------------------------------------------
-- Function execution grants: definer helpers that must not be called directly.
-- -----------------------------------------------------------------------------
revoke execute on function public.award_xp(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.revoke_xp(text, uuid) from public, anon, authenticated;
revoke execute on function public.recompute_xp(uuid) from public, anon, authenticated;
revoke execute on function public.evaluate_achievements(uuid) from public, anon, authenticated;
revoke execute on function public.achievement_metric(uuid, text) from public, anon, authenticated;
-- assert_rate_limit stays callable: invoker triggers use it and it can only limit the caller.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.user_rank(uuid) from public, anon;
grant execute on function public.user_rank(uuid) to authenticated;

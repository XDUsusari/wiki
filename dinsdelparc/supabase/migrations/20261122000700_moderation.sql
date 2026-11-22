-- =============================================================================
-- DinsDelParc · 0007 · Reports (user flags & incorrect-information notices),
-- moderation actions, user administration (roles, suspensions).
-- =============================================================================

create type public.report_target as enum (
  'post', 'comment', 'post_image', 'forum_topic', 'forum_reply', 'review', 'profile',
  'attraction_info', 'park_info', 'wait_report'
);
create type public.report_reason as enum (
  'spam', 'harassment', 'hate', 'inappropriate', 'violence', 'misinformation', 'copyright',
  'privacy', 'incorrect_info', 'other'
);
create type public.report_state as enum ('open', 'reviewing', 'resolved', 'dismissed');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null default auth.uid(), -- null = automatic
  target_type public.report_target not null,
  target_id uuid not null,
  reason public.report_reason not null,
  details text check (length(details) <= 2000),
  state public.report_state not null default 'open',
  resolution_note text check (length(resolution_note) <= 2000),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_queue_idx on public.reports(state, created_at);
create index reports_target_idx on public.reports(target_type, target_id);
create unique index reports_one_open_per_reporter on public.reports(reporter_id, target_type, target_id)
  where state in ('open', 'reviewing') and reporter_id is not null;

-- SECURITY INVOKER: users can only report what RLS lets them see, and
-- system reports (inserted by definer triggers) keep reporter_id = null.
create or replace function public.validate_report() returns trigger
language plpgsql set search_path = public as $$
declare v_exists boolean;
begin
  if current_user in ('authenticated', 'anon') then
    new.reporter_id := auth.uid();
    new.state := 'open';
    new.resolution_note := null; new.resolved_by := null; new.resolved_at := null;
    perform public.assert_rate_limit('report', 20, interval '1 hour');
  end if;
  v_exists := case new.target_type
    when 'post' then exists (select 1 from public.posts where id = new.target_id)
    when 'comment' then exists (select 1 from public.comments where id = new.target_id)
    when 'post_image' then exists (select 1 from public.post_images where id = new.target_id)
    when 'forum_topic' then exists (select 1 from public.forum_topics where id = new.target_id)
    when 'forum_reply' then exists (select 1 from public.forum_replies where id = new.target_id)
    when 'review' then exists (select 1 from public.attraction_reviews where id = new.target_id)
    when 'profile' then exists (select 1 from public.profiles where id = new.target_id)
    when 'attraction_info' then exists (select 1 from public.attractions where id = new.target_id)
    when 'park_info' then exists (select 1 from public.parks where id = new.target_id)
    when 'wait_report' then exists (select 1 from public.waiting_time_reports where id = new.target_id)
  end;
  if not v_exists then raise exception 'target_not_found' using errcode = '22023'; end if;
  return new;
end;
$$;
create trigger reports_validate before insert on public.reports for each row execute function public.validate_report();

-- Automatic screening opens a system report so moderators see the item.
create or replace function public.report_pending_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.moderation_status = 'pending_review'
     and (tg_op = 'INSERT' or old.moderation_status is distinct from 'pending_review') then
    insert into public.reports(reporter_id, target_type, target_id, reason, details)
    values (null,
            (case tg_table_name when 'posts' then 'post' when 'comments' then 'comment'
                                when 'forum_topics' then 'forum_topic' else 'forum_reply' end)::public.report_target,
            new.id, 'other', 'automatic screening');
  end if;
  return null;
end;
$$;
create trigger posts_auto_report after insert or update of moderation_status on public.posts
  for each row execute function public.report_pending_review();
create trigger comments_auto_report after insert or update of moderation_status on public.comments
  for each row execute function public.report_pending_review();
create trigger forum_topics_auto_report after insert or update of moderation_status on public.forum_topics
  for each row execute function public.report_pending_review();
create trigger forum_replies_auto_report after insert or update of moderation_status on public.forum_replies
  for each row execute function public.report_pending_review();

-- -----------------------------------------------------------------------------
-- Moderation of any user-generated item.
-- -----------------------------------------------------------------------------
create or replace function public.moderate_content(
  p_target public.report_target, p_id uuid, p_status public.moderation_status, p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_before jsonb;
  v_author uuid;
  v_table text;
begin
  if not public.has_permission('community.moderate') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  v_table := case p_target
    when 'post' then 'posts' when 'comment' then 'comments' when 'post_image' then 'post_images'
    when 'forum_topic' then 'forum_topics' when 'forum_reply' then 'forum_replies'
    when 'review' then 'attraction_reviews' else null end;
  if v_table is null then raise exception 'unsupported_target' using errcode = '22023'; end if;

  execute format('select to_jsonb(t) from public.%I t where id = $1', v_table) into v_before using p_id;
  if v_before is null then raise exception 'not_found' using errcode = '22023'; end if;

  if v_table in ('posts', 'comments', 'forum_topics', 'forum_replies') then
    execute format('update public.%I set moderation_status = $1, moderation_note = $2 where id = $3', v_table)
      using p_status, left(p_note, 1000), p_id;
  else
    execute format('update public.%I set moderation_status = $1 where id = $2', v_table) using p_status, p_id;
  end if;

  v_author := coalesce((v_before ->> 'author_id')::uuid, (v_before ->> 'user_id')::uuid);
  if v_table = 'post_images' then
    select author_id into v_author from public.posts where id = (v_before ->> 'post_id')::uuid;
  end if;
  if p_status in ('hidden', 'removed') then
    perform public.notify(v_author, 'moderation', null, null, p_id,
                          jsonb_build_object('target', p_target, 'status', p_status, 'note', left(p_note, 300)));
  end if;
  perform public.write_audit('moderate', v_table, p_id::text, v_before, jsonb_build_object('status', p_status), p_note);
end;
$$;

create or replace function public.resolve_report(p_report uuid, p_state public.report_state, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_report public.reports;
begin
  if not public.has_permission('reports.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_state not in ('reviewing', 'resolved', 'dismissed') then
    raise exception 'invalid_state' using errcode = '22023';
  end if;
  update public.reports set state = p_state, resolution_note = left(p_note, 2000),
         resolved_by = case when p_state = 'reviewing' then null else auth.uid() end,
         resolved_at = case when p_state = 'reviewing' then null else now() end
   where id = p_report returning * into v_report;
  if not found then raise exception 'not_found' using errcode = '22023'; end if;
  if p_state in ('resolved', 'dismissed') then
    perform public.notify(v_report.reporter_id, 'report_resolved', null, 'report', v_report.id,
                          jsonb_build_object('state', p_state, 'target', v_report.target_type));
  end if;
  perform public.write_audit('resolve_report', 'reports', p_report::text, null,
                             jsonb_build_object('state', p_state), p_note);
end;
$$;

-- -----------------------------------------------------------------------------
-- User administration. Staff can only act on users of strictly lower rank and
-- can only grant roles strictly below their own (superadmin excepted).
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_role(p_user uuid, p_role public.app_role, p_grant boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_my_rank smallint := public.user_rank(auth.uid());
  v_role_rank smallint;
  v_is_super boolean := exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'superadmin');
begin
  if not public.has_permission('users.manage_roles') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select rank into v_role_rank from public.roles where id = p_role;
  if p_user = auth.uid() then raise exception 'cannot_change_own_roles' using errcode = '42501'; end if;
  if not v_is_super and (v_role_rank >= v_my_rank or public.user_rank(p_user) >= v_my_rank) then
    raise exception 'insufficient_rank' using errcode = '42501';
  end if;
  if p_role = 'user' and not p_grant then raise exception 'cannot_remove_base_role' using errcode = '22023'; end if;

  if p_grant then
    insert into public.user_roles(user_id, role, granted_by) values (p_user, p_role, auth.uid()) on conflict do nothing;
  else
    delete from public.user_roles where user_id = p_user and role = p_role;
  end if;
  perform public.write_audit(case when p_grant then 'grant_role' else 'revoke_role' end, 'user_roles', p_user::text,
                             null, jsonb_build_object('role', p_role));
end;
$$;

create or replace function public.admin_suspend_user(p_user uuid, p_until timestamptz, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('users.suspend') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user = auth.uid() or public.user_rank(p_user) >= public.user_rank(auth.uid()) then
    raise exception 'insufficient_rank' using errcode = '42501';
  end if;
  if p_until is not null and p_until <= now() then
    raise exception 'invalid_until' using errcode = '22023';
  end if;
  insert into public.user_moderation(user_id, suspended_until, reason, suspended_by, updated_at)
  values (p_user, p_until, left(p_reason, 1000), auth.uid(), now())
  on conflict (user_id) do update set suspended_until = excluded.suspended_until, reason = excluded.reason,
                                      suspended_by = excluded.suspended_by, updated_at = now();
  delete from public.push_tokens where user_id = p_user and p_until is not null;
  perform public.notify(p_user, 'moderation', null, 'profile', p_user,
                        jsonb_build_object('suspended_until', p_until, 'note', left(p_reason, 300)));
  perform public.write_audit(case when p_until is null then 'reinstate_user' else 'suspend_user' end,
                             'profiles', p_user::text, null, jsonb_build_object('until', p_until), p_reason);
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.reports enable row level security;
create policy reports_read on public.reports for select
  using (reporter_id = auth.uid() or public.has_permission('reports.manage'));
create policy reports_insert on public.reports for insert
  with check (auth.uid() is not null and reporter_id = auth.uid() and not public.is_suspended(auth.uid()));

grant select on public.reports to authenticated;
grant insert (target_type, target_id, reason, details) on public.reports to authenticated;

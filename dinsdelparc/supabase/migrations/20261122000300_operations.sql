-- =============================================================================
-- DinsDelParc · 0003 · Operational information
-- Attraction status history, waiting times (staff / aggregated community) and
-- community waiting-time reports with validation, de-duplication, anomaly
-- detection, automatic expiry and moderation.
--
-- There is NO official real-time feed from PortAventura World. The 'official'
-- source value is reserved for a future authorised integration and can only
-- be written with the service role.
-- =============================================================================

create type public.wait_report_status as enum ('pending', 'approved', 'rejected', 'flagged', 'expired');

create table public.attraction_status (
  id uuid primary key default gen_random_uuid(),
  attraction_id uuid not null references public.attractions(id) on delete cascade,
  status public.operational_status not null,
  note_i18n jsonb not null default '{}' check (public.is_valid_i18n(note_i18n, 500)),
  source public.info_source not null default 'admin',
  source_url text check (source_url ~ '^https?://'),
  set_by uuid references auth.users(id) on delete set null default auth.uid(),
  valid_until timestamptz,
  created_at timestamptz not null default now()
);
create index attraction_status_latest_idx on public.attraction_status(attraction_id, created_at desc);

create table public.waiting_times (
  id uuid primary key default gen_random_uuid(),
  attraction_id uuid not null references public.attractions(id) on delete cascade,
  minutes smallint not null check (minutes between 0 and 300),
  source public.info_source not null,
  reliability numeric(3,2) not null check (reliability between 0 and 1),
  sample_size integer not null default 1 check (sample_size >= 0),
  computed_at timestamptz not null default now(),
  valid_until timestamptz not null,
  set_by uuid references auth.users(id) on delete set null,
  check (valid_until >= computed_at)
);
create index waiting_times_latest_idx on public.waiting_times(attraction_id, computed_at desc);

create table public.waiting_time_reports (
  id uuid primary key default gen_random_uuid(),
  attraction_id uuid not null references public.attractions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  minutes smallint not null check (minutes between 0 and 300),
  observed_at timestamptz not null default now(),
  status public.wait_report_status not null default 'pending',
  is_anomalous boolean not null default false,
  anomaly_reason text,
  expires_at timestamptz not null default now() + interval '45 minutes',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index wait_reports_active_idx on public.waiting_time_reports(attraction_id, expires_at desc);
create index wait_reports_user_idx on public.waiting_time_reports(user_id, created_at desc);
create index wait_reports_queue_idx on public.waiting_time_reports(status, created_at desc);

-- Tunables (also exposed to the apps through app_settings 'operations.*').
create or replace function public.wait_report_ttl() returns interval language sql immutable as $$ select interval '45 minutes' $$;

-- -----------------------------------------------------------------------------
-- Validation trigger for community reports
-- -----------------------------------------------------------------------------
create or replace function public.validate_wait_report() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_attraction record;
  v_status public.operational_status;
  v_median numeric;
  v_mad numeric;
  v_count int;
  v_threshold numeric;
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
    new.status := 'pending';
    new.is_anomalous := false;
    new.anomaly_reason := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  new.created_at := now();

  if new.observed_at > now() + interval '2 minutes' then
    raise exception 'invalid_observed_at' using errcode = '22023';
  end if;
  if new.observed_at < now() - interval '30 minutes' then
    raise exception 'report_too_old' using errcode = '22023';
  end if;
  new.expires_at := new.observed_at + public.wait_report_ttl();

  select a.id, a.is_published into v_attraction from public.attractions a where a.id = new.attraction_id;
  if not found or not v_attraction.is_published then
    raise exception 'attraction_not_found' using errcode = '22023';
  end if;

  select s.status into v_status from public.attraction_status s
   where s.attraction_id = new.attraction_id and (s.valid_until is null or s.valid_until > now())
   order by s.created_at desc limit 1;
  if v_status = 'permanently_closed' then
    raise exception 'attraction_closed' using errcode = '22023';
  end if;

  -- One report per user and attraction every 10 minutes; 20 per hour overall.
  if exists (select 1 from public.waiting_time_reports r
              where r.user_id = new.user_id and r.attraction_id = new.attraction_id
                and r.created_at > now() - interval '10 minutes') then
    raise exception 'duplicate_report' using errcode = '23505';
  end if;
  perform public.assert_rate_limit('wait_report', 20, interval '1 hour');

  -- Anomaly detection: robust z-score against the active reports (median / MAD).
  select count(*), percentile_cont(0.5) within group (order by r.minutes)
    into v_count, v_median
    from public.waiting_time_reports r
   where r.attraction_id = new.attraction_id and r.expires_at > now()
     and r.status in ('pending', 'approved') and not r.is_anomalous;

  if v_count >= 3 then
    select percentile_cont(0.5) within group (order by abs(r.minutes - v_median)) into v_mad
      from public.waiting_time_reports r
     where r.attraction_id = new.attraction_id and r.expires_at > now()
       and r.status in ('pending', 'approved') and not r.is_anomalous;
    v_threshold := greatest(20, 3 * 1.4826 * coalesce(v_mad, 0));
    if abs(new.minutes - v_median) > v_threshold then
      new.is_anomalous := true;
      new.anomaly_reason := format('deviation %s min from median %s (threshold %s)',
                                   round(abs(new.minutes - v_median)), round(v_median), round(v_threshold));
    end if;
  end if;

  if v_status = 'temporarily_closed' and new.minutes > 0 then
    new.is_anomalous := true;
    new.anomaly_reason := 'attraction marked as temporarily closed';
  end if;

  if new.is_anomalous then
    new.status := 'flagged';
  elsif public.user_rank(new.user_id) >= 20 and auth.uid() is not null then
    new.status := 'approved'; -- verified users and staff are trusted
  end if;
  return new;
end;
$$;

create trigger waiting_time_reports_validate before insert on public.waiting_time_reports
  for each row execute function public.validate_wait_report();

-- -----------------------------------------------------------------------------
-- Aggregation: recompute the community waiting time for one attraction.
-- -----------------------------------------------------------------------------
create or replace function public.refresh_waiting_time(p_attraction uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_n int;
  v_median numeric;
  v_p25 numeric;
  v_p75 numeric;
  v_trusted int;
  v_newest timestamptz;
  v_spread numeric;
  v_reliability numeric;
begin
  select count(*),
         percentile_cont(0.5) within group (order by minutes),
         percentile_cont(0.25) within group (order by minutes),
         percentile_cont(0.75) within group (order by minutes),
         count(*) filter (where status = 'approved'),
         max(expires_at)
    into v_n, v_median, v_p25, v_p75, v_trusted, v_newest
    from public.waiting_time_reports
   where attraction_id = p_attraction and expires_at > now()
     and status in ('pending', 'approved') and not is_anomalous;

  if v_n = 0 then
    -- Close any still-valid community value so stale data is never shown.
    update public.waiting_times set valid_until = greatest(computed_at, now())
     where attraction_id = p_attraction and source = 'community' and valid_until > now();
    return;
  end if;

  v_spread := (v_p75 - v_p25) / greatest(v_median, 10);
  v_reliability := least(1, 0.30 + 0.12 * v_n + 0.05 * v_trusted) * (1 - least(0.5, v_spread * 0.5));
  v_reliability := round(greatest(0.05, least(1, v_reliability)), 2);

  update public.waiting_times set valid_until = greatest(computed_at, now())
   where attraction_id = p_attraction and source = 'community' and valid_until > now();

  insert into public.waiting_times(attraction_id, minutes, source, reliability, sample_size, computed_at, valid_until)
  values (p_attraction, round(v_median)::smallint, 'community', v_reliability, v_n, now(),
          least(v_newest, now() + interval '30 minutes'));
end;
$$;
revoke execute on function public.refresh_waiting_time(uuid) from public, anon, authenticated;

create or replace function public.after_wait_report_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.refresh_waiting_time(coalesce(new.attraction_id, old.attraction_id));
  return null;
end;
$$;
create trigger waiting_time_reports_refresh after insert or update or delete on public.waiting_time_reports
  for each row execute function public.after_wait_report_change();

-- Maintenance job (scheduled with pg_cron when available, see below).
create or replace function public.expire_wait_reports() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  with expired as (
    update public.waiting_time_reports set status = 'expired'
     where status in ('pending', 'approved', 'flagged') and expires_at <= now()
    returning 1
  ) select count(*) into v_count from expired;
  delete from public.rate_limit_events where created_at < now() - interval '2 days';
  return v_count;
end;
$$;
revoke execute on function public.expire_wait_reports() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('dinsdelparc-expire-wait-reports', '*/10 * * * *', 'select public.expire_wait_reports()');
  end if;
exception when others then
  raise notice 'pg_cron not scheduled: %', sqlerrm;
end $$;

-- -----------------------------------------------------------------------------
-- Live view: latest valid status + best valid waiting time per attraction.
-- Priority: official > admin > community. Expired values are never returned.
-- -----------------------------------------------------------------------------
create view public.attraction_live_status with (security_invoker = true) as
select
  a.id as attraction_id,
  a.park_id,
  a.area_id,
  coalesce(s.status, 'unknown'::public.operational_status) as status,
  s.note_i18n as status_note_i18n,
  s.source as status_source,
  s.created_at as status_updated_at,
  case when coalesce(s.status, 'unknown') in ('temporarily_closed', 'permanently_closed') then null else w.minutes end as wait_minutes,
  w.source as wait_source,
  w.reliability as wait_reliability,
  w.sample_size as wait_sample_size,
  w.computed_at as wait_updated_at,
  w.valid_until as wait_valid_until
from public.attractions a
left join lateral (
  select st.status, st.note_i18n, st.source, st.created_at
    from public.attraction_status st
   where st.attraction_id = a.id and (st.valid_until is null or st.valid_until > now())
   order by st.created_at desc limit 1
) s on true
left join lateral (
  select wt.minutes, wt.source, wt.reliability, wt.sample_size, wt.computed_at, wt.valid_until
    from public.waiting_times wt
   where wt.attraction_id = a.id and wt.valid_until > now()
   order by case wt.source when 'official' then 0 when 'admin' then 1 when 'community' then 2 else 3 end,
            wt.computed_at desc
   limit 1
) w on true;

-- Anonymised community history (15-minute buckets) for an attraction.
create or replace function public.attraction_wait_history(p_attraction uuid, p_hours int default 6)
returns table (bucket timestamptz, median_minutes numeric, reports integer)
language sql stable security definer set search_path = public as $$
  select to_timestamp(floor(extract(epoch from r.observed_at) / 900) * 900) as bucket,
         round(percentile_cont(0.5) within group (order by r.minutes)::numeric, 0),
         count(*)::int
    from public.waiting_time_reports r
    join public.attractions a on a.id = r.attraction_id and a.is_published
   where r.attraction_id = p_attraction
     and r.observed_at > now() - make_interval(hours => least(greatest(p_hours, 1), 48))
     and r.status in ('pending', 'approved', 'expired') and not r.is_anomalous
   group by 1 order by 1;
$$;

-- -----------------------------------------------------------------------------
-- Staff operations
-- -----------------------------------------------------------------------------
create or replace function public.set_attraction_status(
  p_attraction uuid, p_status public.operational_status, p_note jsonb default '{}',
  p_valid_hours int default null, p_source_url text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_permission('operations.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.attraction_status(attraction_id, status, note_i18n, source, source_url, set_by, valid_until)
  values (p_attraction, p_status, coalesce(p_note, '{}'), 'admin', p_source_url, auth.uid(),
          case when p_valid_hours is null then null else now() + make_interval(hours => p_valid_hours) end)
  returning id into v_id;
  perform public.write_audit('set_status', 'attractions', p_attraction::text, null,
                             jsonb_build_object('status', p_status, 'note', p_note));
  return v_id;
end;
$$;

create or replace function public.set_staff_wait_time(p_attraction uuid, p_minutes int, p_valid_minutes int default 30)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.has_permission('operations.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_minutes not between 0 and 300 or p_valid_minutes not between 5 and 180 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  insert into public.waiting_times(attraction_id, minutes, source, reliability, sample_size, valid_until, set_by)
  values (p_attraction, p_minutes, 'admin', 0.9, 1, now() + make_interval(mins => p_valid_minutes), auth.uid())
  returning id into v_id;
  perform public.write_audit('set_wait_time', 'attractions', p_attraction::text, null,
                             jsonb_build_object('minutes', p_minutes, 'valid_minutes', p_valid_minutes));
  return v_id;
end;
$$;

create or replace function public.review_wait_report(p_report uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_before jsonb;
begin
  if not public.has_permission('operations.validate') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select to_jsonb(r) into v_before from public.waiting_time_reports r where r.id = p_report;
  if v_before is null then raise exception 'not_found' using errcode = '22023'; end if;
  update public.waiting_time_reports
     set status = case when p_approve then 'approved'::public.wait_report_status else 'rejected'::public.wait_report_status end,
         is_anomalous = case when p_approve then false else is_anomalous end,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_report;
  perform public.write_audit(case when p_approve then 'approve_wait_report' else 'reject_wait_report' end,
                             'waiting_time_reports', p_report::text, v_before, null);
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.attraction_status enable row level security;
alter table public.waiting_times enable row level security;
alter table public.waiting_time_reports enable row level security;

create policy attraction_status_read on public.attraction_status for select using (true);
create policy waiting_times_read on public.waiting_times for select using (true);

create policy wait_reports_read on public.waiting_time_reports for select
  using (user_id = auth.uid() or public.has_permission('operations.validate'));
create policy wait_reports_insert on public.waiting_time_reports for insert
  with check (user_id = auth.uid() and public.has_permission('operations.report') and public.is_email_verified());

grant select on public.attraction_status, public.waiting_times to anon, authenticated;
grant select on public.waiting_time_reports to authenticated;
grant insert (attraction_id, minutes, observed_at) on public.waiting_time_reports to authenticated;
grant select on public.attraction_live_status to anon, authenticated;

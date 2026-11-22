-- Waiting times: validation, de-duplication, anomaly detection, aggregation,
-- precedence, expiry and moderation.
\set ON_ERROR_STOP 1
select tests.create_user('r1') as r1 \gset
select tests.create_user('r2') as r2 \gset
select tests.create_user('r3') as r3 \gset
select tests.create_user('r4') as r4 \gset
select tests.create_user('r5') as r5 \gset
select tests.create_user('opsmod') as opsmod \gset
select tests.create_user('opsmgr') as opsmgr \gset
insert into public.user_roles(user_id, role) values (:'opsmod', 'moderator'), (:'opsmgr', 'content_manager'), (:'r5', 'verified_user');
select id as dk from public.attractions where slug = 'dragon-khan' \gset

select tests.login(null);
select tests.assert((select status from public.attraction_live_status where attraction_id = :'dk') = 'unknown', 'status unknown without data');
select tests.assert((select wait_minutes from public.attraction_live_status where attraction_id = :'dk') is null, 'no wait time without data');
select tests.assert_raises(format($$insert into public.waiting_time_reports(attraction_id, minutes) values (%L, 10)$$, :'dk'), 'permission denied', 'anon cannot report');
reset role;

select tests.login(:'r1');
insert into public.waiting_time_reports(attraction_id, minutes) values (:'dk', 30);
select tests.assert_raises(format($$insert into public.waiting_time_reports(attraction_id, minutes) values (%L, 35)$$, :'dk'), 'duplicate_report', 'duplicate within 10 minutes rejected');
select tests.assert_raises(format($$insert into public.waiting_time_reports(attraction_id, minutes) values (%L, 400)$$,
  (select id from public.attractions where slug = 'stampida')), 'check constraint', 'out-of-range minutes rejected');
select tests.assert_raises(format($$insert into public.waiting_time_reports(attraction_id, minutes, observed_at) values (%L, 20, now() - interval '2 hours')$$,
  (select id from public.attractions where slug = 'stampida')), 'report_too_old', 'old observations rejected');
select tests.assert_raises(format($$insert into public.waiting_time_reports(attraction_id, minutes, status) values (%L, 20, 'approved')$$,
  (select id from public.attractions where slug = 'shambhala')), 'permission denied', 'cannot self-approve (column not granted)');
reset role;

select tests.assert((select wait_source from public.attraction_live_status where attraction_id = :'dk') = 'community', 'community value published');
select tests.assert((select wait_minutes from public.attraction_live_status where attraction_id = :'dk') = 30, 'single report value');
select tests.assert((select wait_reliability from public.attraction_live_status where attraction_id = :'dk') < 0.5, 'single report has low reliability');

select tests.login(:'r2'); insert into public.waiting_time_reports(attraction_id, minutes) values (:'dk', 35); reset role;
select tests.login(:'r3'); insert into public.waiting_time_reports(attraction_id, minutes) values (:'dk', 40); reset role;
select tests.assert((select wait_minutes from public.attraction_live_status where attraction_id = :'dk') = 35, 'median of three reports');
select tests.assert((select wait_sample_size from public.attraction_live_status where attraction_id = :'dk') = 3, 'sample size tracked');

select tests.login(:'r4'); insert into public.waiting_time_reports(attraction_id, minutes) values (:'dk', 180) returning id as outlier \gset
reset role;
select tests.assert((select status from public.waiting_time_reports where id = :'outlier') = 'flagged', 'outlier flagged');
select tests.assert((select is_anomalous from public.waiting_time_reports where id = :'outlier'), 'outlier marked anomalous');
select tests.assert((select wait_minutes from public.attraction_live_status where attraction_id = :'dk') = 35, 'outlier ignored in aggregate');

select tests.login(:'r5'); insert into public.waiting_time_reports(attraction_id, minutes) values (:'dk', 38) returning id as trusted \gset
reset role;
select tests.assert((select status from public.waiting_time_reports where id = :'trusted') = 'approved', 'verified user auto-approved');

-- Privacy: users see only their own raw reports
select tests.login(:'r2');
select tests.assert(tests.count_rows($$select 1 from public.waiting_time_reports$$) = 1, 'user sees only own reports');
select tests.assert(tests.count_rows(format($$select 1 from public.attraction_wait_history(%L, 6)$$, :'dk')) >= 1, 'anonymised history available');
reset role;

-- Moderation of reports
select tests.login(:'r1');
select tests.assert_raises(format($$select public.review_wait_report(%L, true)$$, :'outlier'), 'forbidden', 'users cannot review reports');
reset role;
select tests.login(:'opsmod');
select tests.assert(tests.count_rows($$select 1 from public.waiting_time_reports where status = 'flagged'$$) >= 1, 'moderator sees flagged queue');
select public.review_wait_report(:'outlier', false);
reset role;
select tests.assert((select status from public.waiting_time_reports where id = :'outlier') = 'rejected', 'report rejected');

-- Staff value takes precedence over community value
select tests.login(:'opsmod');
select tests.assert_raises(format($$select public.set_staff_wait_time(%L, 15, 30)$$, :'dk'), 'forbidden', 'moderator cannot set staff time');
reset role;
select tests.login(:'opsmgr');
select public.set_staff_wait_time(:'dk', 15, 30);
reset role;
select tests.assert((select wait_source from public.attraction_live_status where attraction_id = :'dk') = 'admin', 'staff value has precedence');
select tests.assert((select wait_minutes from public.attraction_live_status where attraction_id = :'dk') = 15, 'staff minutes shown');

-- Temporarily closed: wait hidden, new positive reports flagged
select tests.login(:'opsmgr');
select public.set_attraction_status(:'dk', 'temporarily_closed', '{"ca":"Revisió tècnica"}', 2);
reset role;
select tests.assert((select status from public.attraction_live_status where attraction_id = :'dk') = 'temporarily_closed', 'status updated');
select tests.assert((select wait_minutes from public.attraction_live_status where attraction_id = :'dk') is null, 'no wait shown while closed');
update public.rate_limit_events set created_at = created_at - interval '1 hour';
update public.waiting_time_reports set created_at = created_at - interval '15 minutes';
select tests.login(:'r2'); insert into public.waiting_time_reports(attraction_id, minutes) values (:'dk', 20) returning id as closedrep \gset
reset role;
select tests.assert((select anomaly_reason from public.waiting_time_reports where id = :'closedrep') like '%temporarily closed%', 'report on closed attraction flagged');

-- Expiry: stale data is never presented as current
delete from public.attraction_status where attraction_id = :'dk';
delete from public.waiting_times where attraction_id = :'dk' and source = 'admin';
update public.waiting_time_reports set observed_at = now() - interval '50 minutes', expires_at = now() - interval '5 minutes'
 where attraction_id = :'dk';
select public.refresh_waiting_time(:'dk');
select tests.assert((select wait_minutes from public.attraction_live_status where attraction_id = :'dk') is null, 'expired reports produce no value');
select tests.assert(public.expire_wait_reports() >= 3, 'maintenance job expires reports');
select tests.assert(not exists(select 1 from public.waiting_time_reports where attraction_id = :'dk' and status in ('pending','approved')), 'no active reports remain');

-- Permanently closed attractions reject reports
select tests.login(:'opsmgr');
select public.set_attraction_status((select id from public.attractions where slug = 'tomahawk'), 'permanently_closed');
reset role;
select tests.login(:'r3');
select tests.assert_raises(format($$insert into public.waiting_time_reports(attraction_id, minutes) values (%L, 5)$$,
  (select id from public.attractions where slug = 'tomahawk')), 'attraction_closed', 'permanently closed rejects reports');
reset role;
delete from public.attraction_status where attraction_id = (select id from public.attractions where slug = 'tomahawk');
select tests.assert(exists(select 1 from public.audit_logs where action = 'set_status'), 'status changes audited');

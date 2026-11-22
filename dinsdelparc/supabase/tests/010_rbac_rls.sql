-- RBAC, RLS, column privileges, content guards, moderation, suspensions.
\set ON_ERROR_STOP 1
select tests.create_user('alice') as alice \gset
select tests.create_user('bob') as bob \gset
select tests.create_user('moda') as moda \gset
select tests.create_user('adminu') as adminu \gset
select tests.create_user('editora') as editora \gset
select tests.create_user('manager') as manager \gset
select tests.create_user('noverif', false) as noverif \gset
insert into public.user_roles(user_id, role) values
  (:'moda', 'moderator'), (:'adminu', 'admin'), (:'editora', 'editor'), (:'manager', 'content_manager');

-- Sign-up hook
select tests.assert((select username from public.profiles where id = :'alice') = 'alice', 'profile created with username');
select tests.assert(exists(select 1 from public.user_roles where user_id = :'alice' and role = 'user'), 'default role user');
select tests.assert(exists(select 1 from public.notification_preferences where user_id = :'alice'), 'notification prefs created');
select tests.assert((select count(*) from public.consents where user_id = :'alice') = 2, 'terms + privacy consents recorded');

-- Anonymous visitor
select tests.login(null);
select tests.assert((select count(*) from public.parks) = 3, 'anon reads published parks');
select tests.assert_raises($$insert into public.posts(category, body) values ('news', 'hola')$$, 'permission denied', 'anon cannot post');
select tests.assert_raises($$select * from public.notifications$$, 'permission denied', 'anon cannot read notifications');
reset role;

-- Unverified e-mail cannot participate
select tests.login(:'noverif');
select tests.assert_raises($$insert into public.posts(category, body) values ('news', 'hola')$$, 'row-level security', 'unverified user cannot post');
reset role;

-- Standard user
select tests.login(:'alice');
insert into public.posts(category, body) values ('experiences', 'Primera visita a Mediterrània!') returning id as post1 \gset
select tests.assert((select author_id from public.posts where id = :'post1') = :'alice', 'author forced to caller');
select tests.assert_raises($$update public.profiles set xp = 99999 where id = auth.uid()$$, 'permission denied', 'user cannot edit own xp');
select tests.assert_raises($$update public.posts set moderation_status = 'visible', is_featured = true$$, 'permission denied', 'user cannot edit moderation columns');
select tests.assert_raises($$insert into public.user_roles(user_id, role) values (auth.uid(), 'admin')$$, 'permission denied', 'user cannot self-grant roles');
select tests.assert_raises($$select public.admin_set_role(auth.uid(), 'admin', true)$$, 'forbidden', 'user cannot call admin_set_role');
select tests.assert_raises($$insert into public.parks(slug, name, kind) values ('fake', 'Fake park', 'theme_park')$$, 'row-level security', 'user cannot create parks');
select tests.assert_raises($$select public.admin_dashboard_stats()$$, 'forbidden', 'user cannot read dashboard');
select tests.assert(tests.count_rows($$select 1 from public.audit_logs$$) = 0, 'user cannot read audit log');
update public.profiles set bio = 'Fan de les muntanyes russes' where id = :'alice';
select tests.assert((select bio from public.profiles where id = :'alice') = 'Fan de les muntanyes russes', 'user edits own bio');
reset role;

select tests.login(:'bob');
update public.posts set body = 'hacked' where id = :'post1';
select tests.assert((select body from public.posts where id = :'post1') <> 'hacked', 'bob cannot edit alice''s post');
update public.profiles set bio = 'hacked' where id = :'alice';
select tests.assert((select bio from public.profiles where id = :'alice') <> 'hacked', 'bob cannot edit alice''s profile');
select tests.assert(tests.count_rows($$select 1 from public.itineraries$$) = 0, 'bob sees no foreign itineraries');
reset role;

-- Editors create drafts; only content managers publish or verify
select tests.login(:'editora');
insert into public.attractions(park_id, slug, name) select id, 'esborrany', 'Esborrany de prova' from public.parks where slug = 'ferrari-land' returning id as draft \gset
select tests.assert_raises(format($$update public.attractions set is_published = true where id = %L$$, :'draft'), 'content.publish', 'editor cannot publish');
select tests.assert_raises(format($$update public.attractions set data_origin = 'verified' where id = %L$$, :'draft'), 'content.publish', 'editor cannot verify');
reset role;
select tests.login(:'alice');
select tests.assert(tests.count_rows(format($$select 1 from public.attractions where id = %L$$, :'draft')) = 0, 'drafts hidden from public');
reset role;
select tests.login(:'manager');
update public.attractions set is_published = true, data_origin = 'verified', source_url = 'https://example.org/font' where id = :'draft';
select tests.assert((select verified_by from public.attractions where id = :'draft') = :'manager', 'verification stamps verifier');
reset role;
select tests.login(:'editora');
update public.attractions set name = 'Esborrany editat' where id = :'draft';
reset role;
select tests.assert((select data_origin from public.attractions where id = :'draft') = 'pending_verification', 'editor edit sends verified data back to review');
select tests.assert(exists(select 1 from public.audit_logs where entity_type = 'attractions' and entity_id = :'draft' and action = 'update'), 'content changes audited');

-- Moderation
select tests.login(:'moda');
select public.moderate_content('post', :'post1', 'hidden', 'Prova de moderació');
reset role;
select tests.login(:'bob');
select tests.assert(tests.count_rows(format($$select 1 from public.posts where id = %L$$, :'post1')) = 0, 'hidden post invisible to others');
reset role;
select tests.login(:'alice');
select tests.assert(tests.count_rows(format($$select 1 from public.posts where id = %L$$, :'post1')) = 1, 'author still sees hidden post');
select tests.assert(exists(select 1 from public.notifications where type = 'moderation'), 'author notified of moderation');
-- Author edit must not un-hide it
update public.posts set body = 'Editat' where id = :'post1';
reset role;
select tests.assert((select moderation_status from public.posts where id = :'post1') = 'hidden', 'author edit keeps moderation status');
select tests.assert(exists(select 1 from public.audit_logs where action = 'moderate' and entity_id = :'post1'), 'moderation audited');

-- Role management respects rank
select tests.login(:'moda');
select tests.assert_raises(format($$select public.admin_set_role(%L, 'moderator', true)$$, :'bob'), 'forbidden', 'moderator cannot grant roles');
select tests.assert_raises(format($$select public.admin_suspend_user(%L, now() + interval '1 day', 'x')$$, :'adminu'), 'insufficient_rank', 'moderator cannot suspend an admin');
reset role;
select tests.login(:'adminu');
select public.admin_set_role(:'bob', 'verified_user', true);
select tests.assert_raises(format($$select public.admin_set_role(%L, 'admin', true)$$, :'bob'), 'insufficient_rank', 'admin cannot grant admin');
select tests.assert_raises(format($$select public.admin_set_role(%L, 'superadmin', true)$$, :'adminu'), 'cannot_change_own_roles', 'no self role change');
reset role;
select tests.assert(exists(select 1 from public.user_roles where user_id = :'bob' and role = 'verified_user'), 'admin granted verified_user');

-- Suspension blocks participation
select tests.login(:'moda');
select public.admin_suspend_user(:'alice', now() + interval '3 days', 'Spam reiterat');
reset role;
select tests.login(:'alice');
select tests.assert_raises($$insert into public.posts(category, body) values ('news', 'encara puc?')$$, 'row-level security', 'suspended user cannot post');
select tests.assert(public.is_suspended(auth.uid()), 'user can see own suspension');
reset role;
select tests.login(:'moda');
select public.admin_suspend_user(:'alice', null, 'Readmesa');
reset role;

-- Blocks
select tests.login(:'bob');
insert into public.posts(category, body) values ('debates', 'Quina és la millor àrea?') returning id as bobpost \gset
insert into public.blocks(blocked_id) values (:'alice');
reset role;
select tests.login(:'alice');
select tests.assert_raises(format($$insert into public.comments(post_id, body) values (%L, 'hola')$$, :'bobpost'), 'blocked', 'blocked user cannot comment');
select tests.assert_raises(format($$insert into public.follows(following_id) values (%L)$$, :'bob'), 'blocked', 'blocked user cannot follow');
reset role;

-- Automatic screening
select tests.login(:'bob');
insert into public.posts(category, body) values ('trivia', 'Compra seguidors barats aquí') returning id as spam \gset
reset role;
select tests.assert((select moderation_status from public.posts where id = :'spam') = 'pending_review', 'screened post goes to review');
select tests.assert(exists(select 1 from public.reports where target_id = :'spam' and reporter_id is null), 'system report opened');

-- Rate limiting (10 posts / hour)
select tests.login(:'bob');
do $$ begin for i in 1..8 loop insert into public.posts(category, body) values ('trivia', 'Curiositat ' || i); end loop; end $$;
select tests.assert_raises($$insert into public.posts(category, body) values ('trivia', 'una més')$$, 'rate_limited', 'post rate limit enforced');
reset role;

-- User reports + resolution
select tests.login(:'alice');
insert into public.reports(target_type, target_id, reason, details) values ('post', :'bobpost', 'spam', 'prova') returning id as rep \gset
select tests.assert_raises(format($$insert into public.reports(target_type, target_id, reason) values ('post', %L, 'spam')$$, :'bobpost'), 'duplicate key', 'one open report per target and reporter');
select tests.assert_raises($$insert into public.reports(target_type, target_id, reason) values ('post', gen_random_uuid(), 'spam')$$, 'target_not_found', 'report target must exist');
select tests.assert_raises(format($$insert into public.reports(target_type, target_id, reason) values ('post', %L, 'spam')$$, :'spam'), 'target_not_found', 'cannot report what you cannot see');
select tests.assert(tests.count_rows($$select 1 from public.reports where reporter_id is null$$) = 0, 'users cannot read system reports');
reset role;
select tests.login(:'moda');
select public.resolve_report(:'rep', 'resolved', 'Gestionat');
reset role;
select tests.assert((select state from public.reports where id = :'rep') = 'resolved', 'report resolved');
select tests.assert(exists(select 1 from public.notifications where user_id = :'alice' and type = 'report_resolved'), 'reporter notified');

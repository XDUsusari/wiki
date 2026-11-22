-- Social graph, notifications, forum, planner, favourites, gamification,
-- search and RGPD export.
\set ON_ERROR_STOP 1
select tests.create_user('marta') as marta \gset
select tests.create_user('pere') as pere \gset
select tests.create_user('laia') as laia \gset
select tests.create_user('fmod') as fmod \gset
insert into public.user_roles(user_id, role) values (:'fmod', 'moderator');

-- Follows + notifications + counters
select tests.login(:'pere');
insert into public.follows(following_id) values (:'marta');
reset role;
select tests.assert((select followers_count from public.profiles where id = :'marta') = 1, 'followers counter');
select tests.assert(exists(select 1 from public.notifications where user_id = :'marta' and type = 'follow' and actor_id = :'pere'), 'follow notification');

-- Post, comment, reply, reaction, mention
select tests.login(:'marta');
insert into public.posts(category, body) values ('photos', 'Posta de sol des de Polynesia, oi @pere?') returning id as p1 \gset
reset role;
select tests.assert(exists(select 1 from public.notifications where user_id = :'pere' and type = 'mention'), 'mention notification');
select tests.assert((select xp from public.profiles where id = :'marta') = 10, 'xp awarded for post');
select tests.assert((select level from public.profiles where id = :'marta') = 1, 'level 1 below 50 xp');

select tests.login(:'pere');
insert into public.comments(post_id, body) values (:'p1', 'Preciosa!') returning id as c1 \gset
insert into public.reactions(post_id, kind) values (:'p1', 'love');
reset role;
select tests.login(:'laia');
insert into public.comments(post_id, parent_id, body) values (:'p1', :'c1', 'Totalment d''acord') returning id as c2 \gset
select tests.assert_raises(format($$insert into public.comments(post_id, parent_id, body) values (%L, %L, 'nivell 3')$$, :'p1', :'c2'), 'invalid_parent', 'only one level of nesting');
reset role;
select tests.assert((select comment_count from public.posts where id = :'p1') = 2, 'comment counter');
select tests.assert((select reaction_count from public.posts where id = :'p1') = 1, 'reaction counter');
select tests.assert(exists(select 1 from public.notifications where user_id = :'marta' and type = 'comment'), 'comment notification to author');
select tests.assert(exists(select 1 from public.notifications where user_id = :'pere' and type = 'reply'), 'reply notification to parent author');
select tests.assert(exists(select 1 from public.notifications where user_id = :'marta' and type = 'reaction'), 'reaction notification');

-- Notification preferences are honoured
update public.notification_preferences set social = false where user_id = :'marta';
select tests.login(:'laia'); insert into public.reactions(post_id, kind) values (:'p1', 'wow'); reset role;
select tests.assert(not exists(select 1 from public.notifications where user_id = :'marta' and type = 'reaction' and actor_id = :'laia'), 'muted social notifications');

-- Moderation removes XP
select tests.login(:'fmod'); select public.moderate_content('post', :'p1', 'removed', 'Imatge amb drets'); reset role;
select tests.assert((select xp from public.profiles where id = :'marta') = 0, 'xp withdrawn after removal');
select tests.assert((select posts_count from public.profiles where id = :'marta') = 0, 'removed posts not counted');

-- XP daily caps (3 posts/day)
select tests.login(:'laia');
do $$ begin for i in 1..5 loop insert into public.posts(category, body) values ('history', 'Record històric número ' || i); end loop; end $$;
reset role;
select tests.assert((select sum(xp) from public.xp_events where user_id = :'laia' and kind = 'post') = 30, 'daily post xp cap');

-- Forum: topic, quote, subscriptions, lock
select id as cat from public.forum_categories where slug = 'general' \gset
select tests.login(:'marta');
insert into public.forum_topics(category_id, title, body) values (:'cat', 'Quina és la vostra atracció preferida?', 'Obro debat!') returning id as t1 \gset
select tests.assert_raises(format($$update public.forum_topics set is_pinned = true where id = %L$$, :'t1'), 'permission denied', 'authors cannot pin');
reset role;
select tests.login(:'pere');
insert into public.forum_replies(topic_id, body) values (:'t1', 'Sens dubte Shambhala') returning id as fr1 \gset
reset role;
select tests.login(:'laia');
insert into public.forum_replies(topic_id, quoted_reply_id, body) values (:'t1', :'fr1', 'Coincideixo') returning id as fr2 \gset
insert into public.forum_bookmarks(topic_id) values (:'t1');
reset role;
select tests.assert((select reply_count from public.forum_topics where id = :'t1') = 2, 'reply counter');
select tests.assert(exists(select 1 from public.notifications where user_id = :'marta' and type = 'forum_reply'), 'topic author notified');
select tests.assert(exists(select 1 from public.notifications where user_id = :'pere' and type = 'mention' and (data ->> 'quoted')::boolean), 'quoted author notified');
select tests.assert((select topic_count from public.forum_categories where id = :'cat') = 1, 'category counter');
select tests.login(:'fmod'); select public.forum_set_flags(:'t1', true, true); reset role;
select tests.login(:'pere');
select tests.assert_raises(format($$insert into public.forum_replies(topic_id, body) values (%L, 'Tancat?')$$, :'t1'), 'topic_locked', 'locked topic rejects replies');
reset role;

-- Planner + achievements
select tests.login(:'pere');
insert into public.itineraries(title, visit_date, party_size, park_ids)
  values ('Dia de muntanyes russes', current_date + 7, 3, array[(select id from public.parks where slug = 'portaventura-park')]) returning id as it1 \gset
insert into public.itinerary_items(itinerary_id, item_kind, attraction_id, position, priority)
  select :'it1', 'attraction', a.id, row_number() over (order by a.sort_order), 'must'
    from public.attractions a where a.attraction_type = 'roller_coaster' and a.is_published;
select tests.assert_raises(format($$insert into public.itinerary_items(itinerary_id, item_kind, custom_title, attraction_id) values (%L, 'custom', 'x', %L)$$,
  :'it1', (select id from public.attractions where slug = 'kontiki')), 'check constraint', 'item kind integrity enforced');
update public.itinerary_items set is_completed = true where itinerary_id = :'it1';
reset role;
select tests.assert((select count(*) from public.itinerary_items where itinerary_id = :'it1' and completed_at is not null) >= 5, 'completion timestamps');
select tests.assert(exists(select 1 from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id
                            where ua.user_id = :'pere' and a.slug = 'primera-visita' and ua.unlocked_at is not null), 'first visit achievement');
select tests.assert(exists(select 1 from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id
                            where ua.user_id = :'pere' and a.slug = 'amant-muntanyes-russes' and ua.unlocked_at is not null), 'coaster lover achievement');
select tests.assert(exists(select 1 from public.notifications where user_id = :'pere' and type = 'achievement'), 'achievement notification');
select tests.assert((select level from public.profiles where id = :'pere') >= 2, 'level up with achievements');
select tests.login(:'marta');
select tests.assert(tests.count_rows(format($$select 1 from public.itinerary_items where itinerary_id = %L$$, :'it1')) = 0, 'itineraries are private');
reset role;

-- Favourites & reviews
select tests.login(:'marta');
insert into public.favorites(attraction_id) values ((select id from public.attractions where slug = 'dragon-khan'));
select tests.assert_raises($$insert into public.favorites(attraction_id) values ((select id from public.attractions where slug = 'dragon-khan'))$$, 'duplicate key', 'favourite unique');
insert into public.attraction_reviews(attraction_id, rating, body) values ((select id from public.attractions where slug = 'dragon-khan'), 5, 'Un clàssic');
reset role;
select tests.login(:'pere');
insert into public.attraction_reviews(attraction_id, rating, body) values ((select id from public.attractions where slug = 'dragon-khan'), 4, 'Molt bona');
reset role;
select tests.assert((select rating_avg from public.attractions where slug = 'dragon-khan') = 4.50, 'rating average');
select tests.assert((select rating_count from public.attractions where slug = 'dragon-khan') = 2, 'rating count');
update public.profiles set show_favorites = false where id = :'marta';
select tests.login(:'pere');
select tests.assert(tests.count_rows(format($$select 1 from public.favorites where user_id = %L$$, :'marta')) = 0, 'hidden favourites respected');
reset role;

-- Search (accent-insensitive, RLS aware)
select tests.login(null);
select tests.assert(exists(select 1 from public.search_all('dragon') where kind = 'attraction' and title = 'Dragon Khan'), 'search attractions');
select tests.assert(exists(select 1 from public.search_all('mexico') where kind = 'area' and title = 'México'), 'accent-insensitive search');
select tests.assert(exists(select 1 from public.search_all('atraccio preferida') where kind = 'forum_topic'), 'search forum topics');
select tests.assert(not exists(select 1 from public.search_all('Imatge amb drets')), 'removed content not searchable');
select tests.assert(exists(select 1 from public.search_all('marta', array['user'])), 'search users with kind filter');
reset role;

-- RGPD export
select tests.login(:'pere');
select tests.assert((public.export_my_data() -> 'profile' ->> 'username') = 'pere', 'export contains profile');
select tests.assert(jsonb_array_length(public.export_my_data() -> 'itineraries') = 1, 'export contains itineraries');
reset role;

-- Account deletion cascades
delete from auth.users where id = :'laia';
select tests.assert(not exists(select 1 from public.profiles where id = :'laia'), 'profile removed with account');
select tests.assert(not exists(select 1 from public.forum_replies where author_id = :'laia'), 'content removed with account');

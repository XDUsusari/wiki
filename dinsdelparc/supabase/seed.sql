-- =============================================================================
-- DinsDelParc · Seed data
--
-- IMPORTANT — data honesty rules applied to this seed:
--  * Park, area and attraction NAMES are public facts but every row is marked
--    data_origin = 'pending_verification' until an editor checks it against a
--    reliable source in the admin panel.
--  * NO opening hours, NO waiting times, NO height restrictions, NO durations
--    and NO coordinates are seeded. Those fields stay empty until verified.
--  * Descriptions are short, neutral texts written by DinsDelParc.
--  * Rows marked 'demo' exist only to exercise the UI and must be removed or
--    replaced before going to production.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Parks
-- -----------------------------------------------------------------------------
insert into public.parks (slug, name, kind, accent_color, tagline_i18n, description_i18n, official_url, sort_order, data_origin, is_published) values
('portaventura-park', 'PortAventura Park', 'theme_park', '#0B5FD6',
 '{"ca":"Sis àrees temàtiques per descobrir","es":"Seis áreas temáticas por descubrir","en":"Six themed areas to explore"}',
 '{"ca":"Parc temàtic del complex PortAventura World, organitzat en àrees temàtiques inspirades en diferents cultures i èpoques. Informació pendent de verificació per l''equip editorial de DinsDelParc.","es":"Parque temático del complejo PortAventura World, organizado en áreas temáticas inspiradas en distintas culturas y épocas. Información pendiente de verificación por el equipo editorial de DinsDelParc.","en":"Theme park within the PortAventura World resort, organised into themed areas inspired by different cultures and eras. Information pending verification by the DinsDelParc editorial team."}',
 'https://www.portaventuraworld.com', 1, 'pending_verification', true),
('ferrari-land', 'Ferrari Land', 'theme_park', '#D32F2F',
 '{"ca":"Un parc dedicat al món del motor","es":"Un parque dedicado al mundo del motor","en":"A park dedicated to the world of motor racing"}',
 '{"ca":"Parc temàtic del complex PortAventura World dedicat a l''univers Ferrari. Informació pendent de verificació.","es":"Parque temático del complejo PortAventura World dedicado al universo Ferrari. Información pendiente de verificación.","en":"Theme park within the PortAventura World resort dedicated to the Ferrari universe. Information pending verification."}',
 'https://www.portaventuraworld.com', 2, 'pending_verification', true),
('caribe-aquatic-park', 'Caribe Aquatic Park', 'water_park', '#00897B',
 '{"ca":"El parc aquàtic del complex","es":"El parque acuático del complejo","en":"The resort''s water park"}',
 '{"ca":"Parc aquàtic de temàtica caribenya del complex PortAventura World. Obre per temporada: consulta sempre el calendari oficial. Informació pendent de verificació.","es":"Parque acuático de temática caribeña del complejo PortAventura World. Abre por temporada: consulta siempre el calendario oficial. Información pendiente de verificación.","en":"Caribbean-themed water park within the PortAventura World resort. It opens seasonally: always check the official calendar. Information pending verification."}',
 'https://www.portaventuraworld.com', 3, 'pending_verification', true);

-- -----------------------------------------------------------------------------
-- Themed areas of PortAventura Park
-- -----------------------------------------------------------------------------
insert into public.themed_areas (park_id, slug, name, accent_color, description_i18n, sort_order, data_origin, is_published)
select p.id, a.slug, a.name, a.color, a.descr::jsonb, a.ord, 'pending_verification', true
from public.parks p, (values
  ('mediterrania', 'Mediterrània', '#1565C0', 1,
   '{"ca":"Àrea d''entrada al parc, inspirada en un poble pescador mediterrani.","es":"Área de entrada al parque, inspirada en un pueblo pesquero mediterráneo.","en":"The park''s entrance area, inspired by a Mediterranean fishing village."}'),
  ('polynesia', 'Polynesia', '#2E7D32', 2,
   '{"ca":"Àrea ambientada en les illes del Pacífic Sud, amb vegetació tropical.","es":"Área ambientada en las islas del Pacífico Sur, con vegetación tropical.","en":"An area set in the South Pacific islands, with tropical vegetation."}'),
  ('china', 'China', '#C62828', 3,
   '{"ca":"Àrea inspirada en la Xina imperial.","es":"Área inspirada en la China imperial.","en":"An area inspired by imperial China."}'),
  ('sesamoaventura', 'SésamoAventura', '#F9A825', 4,
   '{"ca":"Àrea familiar pensada per als més petits.","es":"Área familiar pensada para los más pequeños.","en":"A family area designed for younger visitors."}'),
  ('mexico', 'México', '#EF6C00', 5,
   '{"ca":"Àrea ambientada en el Mèxic colonial i les cultures precolombines.","es":"Área ambientada en el México colonial y las culturas precolombinas.","en":"An area themed on colonial Mexico and pre-Columbian cultures."}'),
  ('far-west', 'Far West', '#6D4C41', 6,
   '{"ca":"Àrea ambientada en un poble de l''oest americà.","es":"Área ambientada en un pueblo del oeste americano.","en":"An area themed as a town in the American Old West."}')
) as a(slug, name, color, ord, descr)
where p.slug = 'portaventura-park';

-- -----------------------------------------------------------------------------
-- Attractions (names and type only; safety data intentionally empty)
-- -----------------------------------------------------------------------------
insert into public.attractions (park_id, area_id, slug, name, attraction_type, description_i18n, sort_order, data_origin, is_published)
select p.id, ar.id, x.slug, x.name, x.kind, x.descr::jsonb, x.ord, 'pending_verification', true
from (values
  ('portaventura-park', 'mediterrania', 'furius-baco', 'Furius Baco', 'roller_coaster', 1,
   '{"ca":"Muntanya russa de llançament.","es":"Montaña rusa de lanzamiento.","en":"Launched roller coaster."}'),
  ('portaventura-park', 'polynesia', 'tutuki-splash', 'Tutuki Splash', 'water_ride', 2,
   '{"ca":"Atracció aquàtica amb barques.","es":"Atracción acuática con barcas.","en":"Water ride with boats."}'),
  ('portaventura-park', 'polynesia', 'kontiki', 'Kontiki', 'flat_ride', 3,
   '{"ca":"Atracció de vaixell pèndol.","es":"Atracción de barco péndulo.","en":"Swinging ship ride."}'),
  ('portaventura-park', 'china', 'dragon-khan', 'Dragon Khan', 'roller_coaster', 4,
   '{"ca":"Muntanya russa amb inversions, una de les més conegudes del parc.","es":"Montaña rusa con inversiones, una de las más conocidas del parque.","en":"Roller coaster with inversions, one of the park''s best-known rides."}'),
  ('portaventura-park', 'china', 'shambhala', 'Shambhala', 'roller_coaster', 5,
   '{"ca":"Muntanya russa de gran alçada.","es":"Montaña rusa de gran altura.","en":"Tall roller coaster."}'),
  ('portaventura-park', 'sesamoaventura', 'tami-tami', 'Tami-Tami', 'family', 6,
   '{"ca":"Muntanya russa familiar.","es":"Montaña rusa familiar.","en":"Family roller coaster."}'),
  ('portaventura-park', 'mexico', 'hurakan-condor', 'Hurakan Condor', 'drop_tower', 7,
   '{"ca":"Torre de caiguda lliure.","es":"Torre de caída libre.","en":"Drop tower."}'),
  ('portaventura-park', 'mexico', 'el-diablo-tren-de-la-mina', 'El Diablo – Tren de la Mina', 'roller_coaster', 8,
   '{"ca":"Muntanya russa de tipus tren de la mina.","es":"Montaña rusa de tipo tren de la mina.","en":"Mine train roller coaster."}'),
  ('portaventura-park', 'far-west', 'stampida', 'Stampida', 'roller_coaster', 9,
   '{"ca":"Muntanya russa de fusta.","es":"Montaña rusa de madera.","en":"Wooden roller coaster."}'),
  ('portaventura-park', 'far-west', 'tomahawk', 'Tomahawk', 'roller_coaster', 10,
   '{"ca":"Muntanya russa de fusta de mida reduïda.","es":"Montaña rusa de madera de tamaño reducido.","en":"Smaller wooden roller coaster."}'),
  ('portaventura-park', 'far-west', 'grand-canyon-rapids', 'Grand Canyon Rapids', 'water_ride', 11,
   '{"ca":"Descens de ràpids en bot circular.","es":"Descenso de rápidos en bote circular.","en":"River rapids ride in round boats."}'),
  ('portaventura-park', 'far-west', 'silver-river-flume', 'Silver River Flume', 'water_ride', 12,
   '{"ca":"Atracció aquàtica de troncs.","es":"Atracción acuática de troncos.","en":"Log flume ride."}'),
  ('ferrari-land', null, 'red-force', 'Red Force', 'roller_coaster', 1,
   '{"ca":"Muntanya russa d''acceleració.","es":"Montaña rusa de aceleración.","en":"Accelerator roller coaster."}'),
  ('ferrari-land', null, 'thrill-towers', 'Thrill Towers', 'drop_tower', 2,
   '{"ca":"Torres de caiguda.","es":"Torres de caída.","en":"Drop towers."}'),
  ('ferrari-land', null, 'maranello-grand-race', 'Maranello Grand Race', 'family', 3,
   '{"ca":"Circuit de cotxes per conduir.","es":"Circuito de coches para conducir.","en":"Driving circuit."}'),
  ('ferrari-land', null, 'flying-dreams', 'Flying Dreams', 'simulator', 4,
   '{"ca":"Experiència de vol simulat.","es":"Experiencia de vuelo simulado.","en":"Simulated flight experience."}'),
  ('caribe-aquatic-park', null, 'king-khajuna', 'King Khajuna', 'slide', 1,
   '{"ca":"Tobogan aquàtic de gran pendent.","es":"Tobogán acuático de gran pendiente.","en":"Steep water slide."}')
) as x(park_slug, area_slug, slug, name, kind, ord, descr)
join public.parks p on p.slug = x.park_slug
left join public.themed_areas ar on ar.park_id = p.id and ar.slug = x.area_slug;

-- -----------------------------------------------------------------------------
-- Forum categories
-- -----------------------------------------------------------------------------
insert into public.forum_categories (slug, name_i18n, description_i18n, icon, sort_order, park_id)
select c.slug, c.n::jsonb, c.d::jsonb, c.icon, c.ord, p.id from (values
  ('general', '{"ca":"General","es":"General","en":"General"}', '{"ca":"Converses de tot tipus sobre el complex.","es":"Conversaciones de todo tipo sobre el complejo.","en":"All kinds of conversations about the resort."}', 'chatbubbles-outline', 1, null),
  ('portaventura-park', '{"ca":"PortAventura Park","es":"PortAventura Park","en":"PortAventura Park"}', '{"ca":"Tot sobre PortAventura Park.","es":"Todo sobre PortAventura Park.","en":"Everything about PortAventura Park."}', 'map-outline', 2, 'portaventura-park'),
  ('ferrari-land', '{"ca":"Ferrari Land","es":"Ferrari Land","en":"Ferrari Land"}', '{"ca":"Tot sobre Ferrari Land.","es":"Todo sobre Ferrari Land.","en":"Everything about Ferrari Land."}', 'speedometer-outline', 3, 'ferrari-land'),
  ('caribe-aquatic-park', '{"ca":"Caribe Aquatic Park","es":"Caribe Aquatic Park","en":"Caribe Aquatic Park"}', '{"ca":"Tot sobre Caribe Aquatic Park.","es":"Todo sobre Caribe Aquatic Park.","en":"Everything about Caribe Aquatic Park."}', 'water-outline', 4, 'caribe-aquatic-park'),
  ('actualitat', '{"ca":"Actualitat","es":"Actualidad","en":"News"}', '{"ca":"Novetats i notícies. Cita sempre la font.","es":"Novedades y noticias. Cita siempre la fuente.","en":"News and updates. Always cite your source."}', 'newspaper-outline', 5, null),
  ('historia', '{"ca":"Història del parc","es":"Historia del parque","en":"Park history"}', '{"ca":"Records, curiositats i història del complex.","es":"Recuerdos, curiosidades e historia del complejo.","en":"Memories, trivia and history of the resort."}', 'time-outline', 6, null),
  ('atraccions', '{"ca":"Atraccions","es":"Atracciones","en":"Attractions"}', '{"ca":"Debats sobre atraccions.","es":"Debates sobre atracciones.","en":"Discussions about attractions."}', 'rocket-outline', 7, null),
  ('espectacles', '{"ca":"Espectacles","es":"Espectáculos","en":"Shows"}', '{"ca":"Espectacles i esdeveniments.","es":"Espectáculos y eventos.","en":"Shows and events."}', 'musical-notes-outline', 8, null),
  ('comunitat', '{"ca":"Comunitat","es":"Comunidad","en":"Community"}', '{"ca":"Trobades, presentacions i vida de la comunitat.","es":"Quedadas, presentaciones y vida de la comunidad.","en":"Meetups, introductions and community life."}', 'people-outline', 9, null),
  ('suggeriments', '{"ca":"Suggeriments","es":"Sugerencias","en":"Suggestions"}', '{"ca":"Idees per millorar DinsDelParc.","es":"Ideas para mejorar DinsDelParc.","en":"Ideas to improve DinsDelParc."}', 'bulb-outline', 10, null)
) as c(slug, n, d, icon, ord, park_slug)
left join public.parks p on p.slug = c.park_slug;

-- -----------------------------------------------------------------------------
-- Badges & achievements
-- -----------------------------------------------------------------------------
insert into public.badges (slug, name_i18n, description_i18n, icon, color, is_manual) values
  ('fundador', '{"ca":"Membre fundador","es":"Miembro fundador","en":"Founding member"}', '{"ca":"Es va unir a DinsDelParc durant el llançament.","es":"Se unió a DinsDelParc durante el lanzamiento.","en":"Joined DinsDelParc during launch."}', 'star-outline', '#F9A825', true),
  ('equip', '{"ca":"Equip DinsDelParc","es":"Equipo DinsDelParc","en":"DinsDelParc team"}', '{"ca":"Forma part de l''equip de DinsDelParc.","es":"Forma parte del equipo de DinsDelParc.","en":"Member of the DinsDelParc team."}', 'shield-checkmark-outline', '#0B3D91', true),
  ('col-laborador', '{"ca":"Col·laborador destacat","es":"Colaborador destacado","en":"Top contributor"}', '{"ca":"Aportacions de qualitat reconegudes per l''equip.","es":"Aportaciones de calidad reconocidas por el equipo.","en":"Quality contributions recognised by the team."}', 'heart-outline', '#D81B60', true),
  ('explorador-tres-parcs', '{"ca":"Explorador dels tres parcs","es":"Explorador de los tres parques","en":"Three-park explorer"}', '{"ca":"Ha completat activitats als tres parcs.","es":"Ha completado actividades en los tres parques.","en":"Completed activities in all three parks."}', 'earth-outline', '#00897B', false);

insert into public.achievements (slug, name_i18n, description_i18n, icon, metric, threshold, xp_reward, sort_order, badge_id)
select a.slug, a.n::jsonb, a.d::jsonb, a.icon, a.metric, a.threshold, a.xp, a.ord, b.id from (values
  ('primera-visita', '{"ca":"Primera visita","es":"Primera visita","en":"First visit"}', '{"ca":"Completa una activitat d''un pla de visita.","es":"Completa una actividad de un plan de visita.","en":"Complete an activity in a visit plan."}', 'flag-outline', 'visits', 1, 20, 1, null),
  ('explorador-portaventura', '{"ca":"Explorador de PortAventura","es":"Explorador de PortAventura","en":"PortAventura explorer"}', '{"ca":"Completa atraccions a les sis àrees de PortAventura Park.","es":"Completa atracciones en las seis áreas de PortAventura Park.","en":"Complete attractions in all six areas of PortAventura Park."}', 'compass-outline', 'pap_areas_visited', 6, 60, 2, null),
  ('amant-muntanyes-russes', '{"ca":"Amant de les muntanyes russes","es":"Amante de las montañas rusas","en":"Coaster lover"}', '{"ca":"Completa cinc muntanyes russes diferents.","es":"Completa cinco montañas rusas diferentes.","en":"Complete five different roller coasters."}', 'trending-up-outline', 'coasters_ridden', 5, 50, 3, null),
  ('fotograf-del-parc', '{"ca":"Fotògraf del parc","es":"Fotógrafo del parque","en":"Park photographer"}', '{"ca":"Publica deu fotografies a la comunitat.","es":"Publica diez fotografías en la comunidad.","en":"Share ten photos with the community."}', 'camera-outline', 'photos', 10, 40, 4, null),
  ('historiador', '{"ca":"Historiador","es":"Historiador","en":"Historian"}', '{"ca":"Publica cinc aportacions a la categoria Història.","es":"Publica cinco aportaciones en la categoría Historia.","en":"Publish five posts in the History category."}', 'library-outline', 'history_posts', 5, 40, 5, null),
  ('usuari-vetera', '{"ca":"Usuari veterà","es":"Usuario veterano","en":"Veteran member"}', '{"ca":"Un any a DinsDelParc.","es":"Un año en DinsDelParc.","en":"One year on DinsDelParc."}', 'hourglass-outline', 'account_age_days', 365, 30, 6, null),
  ('explorador-tres-parcs', '{"ca":"Explorador dels tres parcs","es":"Explorador de los tres parques","en":"Three-park explorer"}', '{"ca":"Completa atraccions als tres parcs del complex.","es":"Completa atracciones en los tres parques del complejo.","en":"Complete attractions in the three parks of the resort."}', 'earth-outline', 'parks_visited', 3, 60, 7, 'explorador-tres-parcs'),
  ('informador-fiable', '{"ca":"Informador fiable","es":"Informador fiable","en":"Reliable reporter"}', '{"ca":"Comunica vint temps d''espera vàlids.","es":"Comunica veinte tiempos de espera válidos.","en":"Report twenty valid waiting times."}', 'timer-outline', 'wait_reports', 20, 40, 8, null)
) as a(slug, n, d, icon, metric, threshold, xp, ord, badge_slug)
left join public.badges b on b.slug = a.badge_slug;

-- -----------------------------------------------------------------------------
-- App settings (public ones are readable by the apps)
-- -----------------------------------------------------------------------------
insert into public.app_settings (key, value, is_public, description) values
  ('legal.terms_version', '"2026-11"', true, 'Current version of the terms and privacy policy'),
  ('legal.contact_email', '"privacitat@dinsdelparc.example"', true, 'RGPD contact address — replace before production'),
  ('map.default_view', '{"latitude":41.087,"longitude":1.157,"zoom":14.5,"verified":false,"note":"Approximate centre of the resort for the initial map view only. Not used to place any point of interest."}', true, 'Initial map viewport'),
  ('operations.wait_report_ttl_minutes', '45', true, 'Minutes a community waiting-time report stays valid'),
  ('operations.official_feed', '{"enabled":false,"note":"No authorised real-time integration with PortAventura World exists."}', true, 'Status of the official data feed'),
  ('community.max_images_per_post', '4', true, 'Maximum images per post');

-- -----------------------------------------------------------------------------
-- Welcome announcement (about DinsDelParc itself, therefore verified)
-- -----------------------------------------------------------------------------
insert into public.announcements (kind, severity, title_i18n, body_i18n, data_origin, is_published) values
  ('news', 'info',
   '{"ca":"Benvinguts a DinsDelParc","es":"Bienvenidos a DinsDelParc","en":"Welcome to DinsDelParc"}',
   '{"ca":"DinsDelParc és una plataforma independent creada per i per a la comunitat d''aficionats. No és l''aplicació oficial de PortAventura World ni hi té cap vinculació. Les dades marcades com a «pendent de verificació» encara no han estat comprovades per l''equip editorial.","es":"DinsDelParc es una plataforma independiente creada por y para la comunidad de aficionados. No es la aplicación oficial de PortAventura World ni tiene vinculación alguna con ella. Los datos marcados como «pendiente de verificación» aún no han sido comprobados por el equipo editorial.","en":"DinsDelParc is an independent platform built by and for the fan community. It is not the official PortAventura World app and has no affiliation with it. Data marked as \"pending verification\" has not yet been checked by the editorial team."}',
   'verified', true);

insert into public.featured_items (target_kind, target_id, title_i18n, subtitle_i18n, section, accent_color, sort_order, data_origin, is_published)
select 'attraction', a.id, jsonb_build_object('ca', a.name, 'es', a.name, 'en', a.name), f.sub::jsonb, 'discover', f.color, f.ord, 'pending_verification', true
from (values
  ('dragon-khan', '{"ca":"Descobreix la fitxa","es":"Descubre la ficha","en":"Discover the ride"}', '#C62828', 1),
  ('shambhala', '{"ca":"Descobreix la fitxa","es":"Descubre la ficha","en":"Discover the ride"}', '#1565C0', 2),
  ('red-force', '{"ca":"Descobreix la fitxa","es":"Descubre la ficha","en":"Discover the ride"}', '#D32F2F', 3),
  ('king-khajuna', '{"ca":"Descobreix la fitxa","es":"Descubre la ficha","en":"Discover the ride"}', '#00897B', 4)
) as f(slug, sub, color, ord)
join public.attractions a on a.slug = f.slug;

-- Initial moderation terms (examples; staff extend them from the admin panel).
insert into public.moderation_terms (term, action, created_by) values
  ('compra seguidors', 'review', null),
  ('entrades falses', 'review', null),
  ('free followers', 'review', null);

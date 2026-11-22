# Arquitectura

## Visió general

```
 App mòbil (Expo)  ─┐                      ┌─ PostgreSQL (RLS + RBAC + triggers)
                    ├─ anon key + JWT ──►  Supabase ─┼─ Auth (correu verificat, PKCE)
 Panell admin (Next)┘                      ├─ Storage (avatars, post-images, content)
                                           └─ Edge Functions (service_role només aquí)
```

**Principi clau:** cap client té privilegis. Tant l'app com el panell utilitzen només la clau pública `anon` i la sessió de l'usuari. Tota autorització s'aplica a PostgreSQL:

- **RLS** a totes les taules.
- **Grants per columna** (un usuari no pot modificar `xp`, `moderation_status`, comptadors…).
- **Funcions `SECURITY DEFINER`** per a accions privilegiades (`moderate_content`, `admin_set_role`, `set_attraction_status`…) que comproven `has_permission()` i escriuen a `audit_logs`.
- **Triggers** per a validació, límits de freqüència, cribratge de text, comptadors, notificacions i gamificació.

## Paquet compartit (`packages/shared`)

Font única de veritat per a: tipus de files, matriu de permisos (mirall de la BD, només per a la UI), lògica de temps d'espera (frescor, fiabilitat), assistent del planificador, gamificació (fórmula de nivell idèntica a la SQL), esquemes zod, tokens de disseny (colors clar/fosc, tipografia, espaiats) i traduccions. El català és la llengua font; TypeScript obliga castellà i anglès a tenir exactament les mateixes claus, i qualsevol `t('clau')` inexistent falla a la compilació.

## App mòbil

- **Expo SDK 58, Expo Router** (5 pestanyes: Inici, Parcs, Mapa, Comunitat, Perfil + pantalles de detall).
- **TanStack Query** amb memòria cau persistida (AsyncStorage) per al mode offline; **Zustand** per a preferències i la cua de canvis offline del planificador.
- **Sessió** guardada al Keychain/Keystore (expo-secure-store, fragmentada per superar el límit de 2 KB).
- **Mapa:** MapLibre amb cartografia base OpenStreetMap (OpenFreeMap per defecte, configurable). Només es pinten punts amb coordenades publicades per l'equip.
- **Offline:** dades de consulta, favorits i plans disponibles sense connexió; els plans es poden crear/editar offline i se sincronitzen de manera idempotent (`client_id`). Els temps d'espera desats es tornen a validar contra `valid_until`: mai es mostren dades caducades com a actuals.
- **Accessibilitat:** rols i etiquetes accessibles, àrees tàctils ≥ 44 px, contrast WCAG AA verificat per test, suport per a mida de text del sistema.

## Panell d'administració

Next.js 16 (App Router, `proxy.ts` per refrescar la sessió). Els continguts (12 taules) es gestionen amb una configuració declarativa (`src/lib/contentConfig.ts`) que genera llistes, formularis i validació. Seccions: Tauler, Continguts, Informació operativa, Moderació, Denúncies, Usuaris, Fòrum, Gamificació, Configuració i Registre d'auditoria. El menú es filtra amb els permisos retornats per `my_permissions()`.

## Rols (RBAC)

| Rol | Rang | Permisos principals |
|---|---|---|
| Superadministrador | 100 | Tots; pot atorgar qualsevol rol |
| Administrador | 80 | Tots excepte atorgar rols ≥ 80 |
| Responsable de continguts | 60 | Editar, publicar, verificar, eliminar continguts; operació; insígnies |
| Moderador | 50 | Moderació, denúncies, fòrum, validar reports, suspendre usuaris de rang inferior |
| Editor | 40 | Crear i editar esborranys (no pot publicar ni verificar) |
| Usuari verificat | 20 | Reports d'espera aprovats automàticament |
| Usuari estàndard | 10 | Participar a la comunitat (amb correu verificat) |

Un membre de l'equip només pot actuar sobre usuaris de rang inferior i atorgar rols inferiors al seu.

## Model de dades

Totes les entitats demanades (profiles, roles, permissions, parks, themed_areas, attractions, attraction_status, waiting_times, waiting_time_reports, restaurants, shops, shows, park_services, locations, itineraries, itinerary_items, favorites, posts, post_images, comments, reactions, follows, forum_*, notifications, reports, badges, user_badges, achievements, user_achievements, announcements, audit_logs, app_settings) més: `user_roles`, `role_permissions`, `user_moderation`, `user_settings`, `consents`, `park_schedules`, `show_sessions`, `featured_items`, `attraction_reviews`, `blocks`, `forum_bookmarks`, `forum_subscriptions`, `notification_preferences`, `push_tokens`, `moderation_terms`, `xp_events`, `rate_limit_events`. Els "users" són `auth.users` de Supabase Auth.

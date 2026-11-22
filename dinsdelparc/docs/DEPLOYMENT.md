# Desplegament

## 1. Supabase (producció)

```bash
npx supabase link --project-ref <ref>
npx supabase db push                      # aplica supabase/migrations
psql "$DATABASE_URL" -f supabase/seed.sql # només la primera vegada
npx supabase functions deploy delete-account
npx supabase functions deploy send-push --no-verify-jwt
npx supabase secrets set PUSH_WEBHOOK_SECRET=<secret aleatori llarg>
```

Al panell de Supabase:

- **Auth → URL configuration**: `Site URL = dinsdelparc://`, redireccions `dinsdelparc://**` i l'URL del panell.
- **Auth**: confirmació de correu activada, longitud mínima 10, `letters_digits` (com a `supabase/config.toml`), SMTP propi.
- **Database → Webhooks**: `INSERT` a `public.notifications` → Edge Function `send-push`, capçalera `x-webhook-secret: <PUSH_WEBHOOK_SECRET>`.
- **Extensions**: activa `pg_cron` i torna a executar la darrera migració o programa `select public.expire_wait_reports()` cada 10 min.

## 2. App mòbil (EAS)

```bash
cd apps/mobile
npx eas-cli@latest init                    # crea el projecte EAS (EAS_PROJECT_ID)
npx eas-cli@latest secret:create --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co
npx eas-cli@latest secret:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key>
npx eas-cli@latest build --profile preview --platform android    # APK de prova
npx eas-cli@latest build --profile production --platform android # AAB per a Google Play
npx eas-cli@latest build --profile production --platform ios     # requereix compte d'Apple Developer
npx eas-cli@latest submit --profile production
```

Perfils a `eas.json`: `development` (development client, cal per al mapa natiu), `preview` (APK intern), `production` (AAB / IPA amb autoincrement). Els identificadors de paquet són `cat.dinsdelparc.app` (+ sufix per entorn) — canvieu-los si no sou titulars d'aquest domini.

Configureu les credencials de push (FCM per Android, APNs per iOS) a EAS perquè funcionin les notificacions.

## 3. Panell d'administració

Qualsevol plataforma compatible amb Next.js 16 (Vercel, Netlify, Cloudflare via OpenNext, Docker amb `next start`). Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

El panell **no** necessita la clau `service_role`. Els registres d'error s'emeten en JSON estructurat a stdout (`src/lib/log.ts`).

## 4. Mapa

Per defecte s'usa l'estil gratuït d'OpenFreeMap (dades OpenStreetMap). Per a volums alts, configureu un proveïdor propi amb `EXPO_PUBLIC_MAP_STYLE_URL` i mantingueu l'atribució d'OpenStreetMap.

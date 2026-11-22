# Seguretat i privacitat

## Controls implementats

| Àmbit | Implementació |
|---|---|
| Control d'accés | RLS a totes les taules, `has_permission()` a les funcions, grants per columna, rang jeràrquic per a rols i suspensions |
| Secrets | Els clients només tenen la clau `anon`. `service_role` només existeix a les Edge Functions. Les dades privilegiades per defecte es revoquen (`alter default privileges … revoke`) |
| Injecció SQL | PostgREST amb paràmetres; les funcions dinàmiques usen `format(%I)` i `using` |
| XSS | React escapa tot el text; no s'usa HTML d'usuaris. Només s'obren enllaços `https://` (`safeExternalUrl`). El panell envia CSP, `X-Frame-Options: DENY`, HSTS, etc. |
| Sessions | App: Keychain/Keystore. Panell: cookies `httpOnly`, `SameSite=Lax`, `Secure` en producció; PKCE per als enllaços de correu |
| Contrasenyes | Mínim 10 caràcters amb lletres i números (client + Supabase Auth) |
| Rate limiting | `assert_rate_limit()` a la BD: publicacions 10/h, temes 5/h, comentaris/respostes 40/h, denúncies 20/h, reports d'espera 20/h, ressenyes 10/h, seguiments 100/h, exportació 5/dia |
| Fitxers | Buckets amb límit de mida i tipus MIME; ruta obligatòria `<user_id>/…` validada per polítiques i per CHECK |
| Moderació | Termes «bloquejar»/«revisar», heurística d'spam, denúncies, ocultar/eliminar contingut, bloquejos entre usuaris, suspensions |
| Auditoria | Triggers d'auditoria a tots els continguts + registres explícits a cada acció administrativa |

## RGPD

- **Consentiments** en un registre immutable (`consents`): condicions, privacitat, màrqueting, push.
- **Accés i portabilitat**: Configuració → «Exporta les meves dades» (`export_my_data()`, JSON complet).
- **Supressió**: Configuració → «Elimina el compte» (Edge Function `delete-account`: esborra fitxers i l'usuari; la resta s'elimina en cascada).
- **Rectificació**: edició de perfil; i denúncies d'«informació incorrecta».
- **Privacitat**: opcions per amagar favorits i estadístiques; la ubicació només s'usa al dispositiu.
- **Cookies**: l'app no n'usa; el panell només usa cookies tècniques de sessió.
- Els textos legals inclosos són una **base** i han de ser revisats per assessorament jurídic abans de publicar.

## Recomanacions de producció

- Activar la protecció de contrasenyes filtrades i CAPTCHA a Supabase Auth.
- Configurar SMTP propi i plantilles de correu.
- Rotar `PUSH_WEBHOOK_SECRET` i limitar l'accés al panell (p. ex. per xarxa o SSO).
- Activar `pg_cron` per a `expire_wait_reports()` (la migració ho fa si l'extensió existeix).

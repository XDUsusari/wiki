# Proves

| Nivell | Ordre | Què cobreix |
|---|---|---|
| Unitàries (shared) | `npm test -w @dinsdelparc/shared` | i18n (claus idèntiques en 3 idiomes, marcadors), temps d'espera, planificador, gamificació, permisos, validació, contrast WCAG |
| Unitàries (mobile) | `npm test -w @dinsdelparc/mobile` | cua offline, punts del mapa, errors d'autenticació |
| Unitàries (admin) | `npm test -w @dinsdelparc/admin` | parser de formularis, configuració de continguts, navegació per permisos |
| Base de dades | `npm run test:db` | Aplica totes les migracions + seed a un PostgreSQL 16 temporal i executa 122 asserts com a usuaris reals (rols `anon`/`authenticated`): RLS, RBAC, grants per columna, moderació, suspensions, bloquejos, rate limiting, temps d'espera, notificacions, fòrum, planificador, gamificació, cerca, exportació RGPD, eliminació en cascada |
| End-to-end | `bash e2e/run-local.sh` | Supabase local real + panell compilat + app web exportada amb Playwright: control d'accés al panell; crear → verificar → publicar una atracció i comprovar-ho per l'API pública; estat operatiu; atorgar rol; auditoria; navegació de l'app amb etiquetes de dades; inici de sessió, report d'espera, publicació, comentari, pla de visita i progrés |
| Natiu | `maestro test apps/mobile/maestro` | Fluxos equivalents en Android/iOS (cal un build i un emulador) |

`npm run typecheck` comprova els tres paquets amb TypeScript estricte. El workflow `.github/workflows/dinsdelparc.yml` executa tot això a cada canvi.

**No executat en l'entorn de desenvolupament inicial:** fluxos Maestro (sense emulador) i Edge Functions (el contenidor no podia descarregar dependències a través del proxy). Executeu-los abans del primer llançament.

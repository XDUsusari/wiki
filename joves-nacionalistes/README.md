# Joves Nacionalistes · Intranet

Web app instal·lable (PWA) per a joves membres: comptes amb aprovació, notícies i avisos, agenda amb inscripcions i
entrades QR, i fòrum per canals amb xat en temps real i moderació.

**Tecnologia:** Next.js 15 (App Router, Server Actions) · Supabase (Auth, Postgres amb RLS, Realtime) · TypeScript.

## Funcionalitats

| Mòdul | Què fa |
|---|---|
| Comptes | Registre amb **edat ≥ 18** (validada al formulari, al servidor i a la base de dades), consentiment explícit RGPD, aprovació per un coordinador, rols `membre` / `coordinador` / `admin`, suspensió. |
| Notícies | Notícies i avisos, fixar a dalt. Només la coordinació publica. |
| Agenda | Activitats amb aforament, inscripció, **entrada amb codi QR** i validació a la porta. |
| Fòrum | Canals (alguns només de lectura), xat en temps real, esborrar, **denunciar**, límit antispam de 10 missatges/minut. |
| Perfil | Editar dades, **descarregar les meves dades** (JSON) i **esborrar el compte** (RGPD art. 15, 17 i 20). |
| Gestió | Aprovar sol·licituds, rols, denúncies, crear notícies, activitats i canals. |

## Seguretat i privacitat

- **Row Level Security a totes les taules**: qui no és membre actiu no pot llegir res, encara que tingui un compte.
- La **data de naixement no és accessible per l'API** (permisos per columna); només la veu el propi usuari en l'exportació.
- Rol i estat només es canvien amb funcions que comproven permisos (un membre no es pot fer admin).
- La còpia del missatge denunciat la fa la base de dades, no el client.
- El service worker **no desa pàgines privades** a la memòria cau.
- Capçaleres de seguretat (HSTS, X-Frame-Options…), i la pàgina no apareix als cercadors (`noindex`).

## Posada en marxa

1. Crea un projecte a [supabase.com](https://supabase.com), **a la regió UE** (Frankfurt o Irlanda).
2. A *SQL Editor*, executa `supabase/migrations/0001_init.sql`.
3. A *Authentication → Providers → Email*, activa la confirmació de correu.
4. Copia `.env.example` a `.env.local` i omple les claus (*Project Settings → API*).
5. `npm install` i després `npm run dev`. L'app s'obre a http://localhost:3000.
6. Registra't i converteix el teu usuari en el primer administrador des del *SQL Editor*:
   ```sql
   update public.profiles set role = 'admin', status = 'actiu'
   where id = (select id from auth.users where email = 'el-teu@correu.cat');
   ```

Desplegament recomanat: Vercel (regió `fra1`) o qualsevol servidor Node 20+.

## Abans de publicar

- [ ] Completar la **política de privacitat** (`app/privacitat`) amb un professional: responsable, NIF, contacte.
- [ ] Fer el registre d'activitats de tractament i l'avaluació d'impacte (AIPD), perquè es tracten dades d'opinió política.
- [ ] Configurar un SMTP propi a Supabase, perquè el de proves té un límit d'enviaments.
- [ ] Activar la protecció contra contrasenyes filtrades i el CAPTCHA a Supabase Auth.
- [ ] Definir l'equip de moderació i el protocol de denúncies.
- [ ] Crear icones PNG de 192 i 512 px per a una instal·lació òptima a Android.

## Idees per a la versió 2

Notificacions push · 2FA · canals per comarca automàtics · enquestes internes · fitxers adjunts · empaquetar per a
Google Play amb TWA (Bubblewrap).

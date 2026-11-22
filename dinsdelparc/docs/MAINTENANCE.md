# Manteniment i operació

## Primer superadministrador

1. Registreu-vos des de l'app i verifiqueu el correu.
2. A l'editor SQL de Supabase (rol `postgres`):

```sql
insert into public.user_roles (user_id, role)
select id, 'superadmin' from auth.users where email = 'vostre@correu.cat';
```

A partir d'aquí, els rols es gestionen des del panell (Usuaris).

## Tasques editorials abans del llançament

1. **Verificar el seed**: cada parc, àrea i atracció és `pending_verification`. Comproveu-los amb una font fiable, indiqueu `source_url` i marqueu-los com a verificats.
2. **Afegir dades sensibles** només amb font: alçades, restriccions, horaris (`park_schedules`), sessions d'espectacles i coordenades (`locations`).
3. **Imatges**: pugeu fotografies pròpies o amb llicència al bucket `content` i ompliu crèdit i llicència.
4. **Textos legals**: substituïu el correu de contacte (`legal.contact_email` a Configuració) i feu revisar els textos.

## Feina recurrent

- **Informació operativa**: cua de reports marcats, horaris caducats.
- **Moderació/Denúncies**: revisar la cua «Pendent de revisió» i les denúncies obertes.
- **Termes moderats**: ajustar la llista segons l'experiència.
- **Auditoria**: revisar accions de l'equip.

## Canvis d'esquema

Afegiu una migració nova a `supabase/migrations/` (no modifiqueu les ja desplegades), actualitzeu `packages/shared/src/types/database.ts`, afegiu proves a `supabase/tests/` i executeu `npm run test:db`.

## Traduccions

Afegiu la clau a `packages/shared/src/i18n/ca.ts`; TypeScript us obligarà a afegir-la a `es.ts` i `en.ts`, i les proves validen que no hi hagi textos buits ni marcadors diferents.

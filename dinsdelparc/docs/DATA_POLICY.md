# Política de dades i verificació

DinsDelParc **no inventa dades**. Aquestes són les regles implementades:

## Origen de cada dada

Cada registre de referència té `data_origin`:

| Valor | Significat | Com es mostra |
|---|---|---|
| `verified` | Comprovat per un responsable de continguts amb una font (`source_url`) | Insígnia verda «Verificat» |
| `pending_verification` | Encara no comprovat | Insígnia ambre + recomanació de consultar la web oficial |
| `demo` | Només per provar la UI | Insígnia «Dades de demostració» |
| `community` | Aportat per usuaris | Insígnia «Aportació de la comunitat» |

- Només els rols amb `content.publish` poden marcar `verified` o publicar; la BD registra qui i quan.
- Si un editor sense aquest permís modifica un registre verificat, torna automàticament a `pending_verification`.

## Dades sensibles

- **Alçades, restriccions, durades i accessibilitat**: l'app només les mostra si l'atracció està verificada. Si no, apareix «Encara no hi ha dades de seguretat verificades».
- **Horaris**: només es mostren els de `park_schedules` verificats. Sense dades: «Horari no verificat per avui».
- **Sessions d'espectacles**: el planificador només proposa hores a partir de sessions verificades.
- **Coordenades**: només es pinten punts amb coordenades publicades; `coords_verified` indica si estan verificades. Les que no en tenen apareixen en una llista separada, mai en una posició aproximada.

## Temps d'espera

- No existeix cap integració oficial en temps real; l'app ho diu explícitament. El valor `official` queda reservat per a una integració autoritzada futura (només escrivible amb service_role).
- Prioritat: `official` > `admin` (equip) > `community` (mediana dels reports vigents).
- Reports: 0–300 min, observació de com a màxim fa 30 min, caducitat de 45 min, 1 report per atracció cada 10 min i 20/hora per usuari.
- Detecció d'anomalies amb mediana i MAD (z-score robust); també es marca qualsevol temps > 0 en una atracció tancada. Els reports marcats van a la cua de moderació.
- La fiabilitat depèn del nombre de reports, la dispersió i els reports de confiança.

## Dades inicials (`supabase/seed.sql`)

Inclou noms públics de parcs, àrees i atraccions amb descripcions breus i neutres, **tots com a `pending_verification`**. No inclou horaris, alçades, durades, coordenades ni temps d'espera. No s'inclouen logotips ni fotografies de tercers: les capçaleres són il·lustracions de color pròpies, i les imatges reals s'han de pujar al bucket `content` indicant crèdit i llicència.

## Assistent del planificador

Proposa un **ordre**, no un horari: agrupa per parc i àrea, prioritza «imprescindibles», té en compte el temps d'espera vigent i posa les atraccions tancades al final. Cada pas indica si es basa en una dada verificada, una estimació o una recomanació. No calcula temps de recorregut.

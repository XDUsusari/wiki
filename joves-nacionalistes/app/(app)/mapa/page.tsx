import Alerts, { readAlerts, type SearchParams } from "@/components/Alerts";
import BarcelonesMap, { KIND_STYLE, type MapPoint } from "@/components/BarcelonesMap";
import { isStaff, requireMember } from "@/lib/auth";
import { MUNICIPIS_BARCELONES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { createMapPoint, deleteMapPoint } from "../modules-actions";

export const metadata = { title: "Mapa del Barcelonès" };

export default async function MapPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireMember();
  const staff = isStaff(me);
  const { error, ok } = await readAlerts(searchParams);
  const supabase = await createClient();
  const { data } = await supabase
    .from("map_points").select("id, name, kind, municipality, address, description, lat, lng").order("municipality").order("name");
  const points = (data ?? []) as MapPoint[];

  const byMunicipality = MUNICIPIS_BARCELONES.map((m) => ({ m, items: points.filter((p) => p.municipality === m) }))
    .filter((g) => g.items.length);

  return (
    <div>
      <h1>🗺️ Mapa del Barcelonès</h1>
      <p className="lead">Seus, punts de trobada i activitats als cinc municipis de la comarca.</p>
      <Alerts error={error} ok={ok} />

      <BarcelonesMap points={points} />
      <div className="legend">
        {Object.entries(KIND_STYLE).map(([k, s]) => (
          <span key={k}><i style={{ background: s.color }} />{s.label}</span>
        ))}
      </div>

      {staff && (
        <details className="staff-box">
          <summary>＋ Afegir punt al mapa</summary>
          <form action={createMapPoint}>
            <div className="two-col">
              <div className="field"><label htmlFor="m-name">Nom</label><input id="m-name" name="name" required /></div>
              <div className="field">
                <label htmlFor="m-kind">Tipus</label>
                <select id="m-kind" name="kind">{Object.entries(KIND_STYLE).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}</select>
              </div>
              <div className="field">
                <label htmlFor="m-mun">Municipi</label>
                <select id="m-mun" name="municipality">{MUNICIPIS_BARCELONES.map((m) => <option key={m}>{m}</option>)}</select>
              </div>
              <div className="field"><label htmlFor="m-addr">Adreça</label><input id="m-addr" name="address" /></div>
              <div className="field"><label htmlFor="m-lat">Latitud</label><input id="m-lat" name="lat" type="number" step="any" min={41.2} max={41.6} required placeholder="41.3870" /></div>
              <div className="field"><label htmlFor="m-lng">Longitud</label><input id="m-lng" name="lng" type="number" step="any" min={1.9} max={2.4} required placeholder="2.1700" /></div>
            </div>
            <div className="field"><label htmlFor="m-desc">Descripció</label><input id="m-desc" name="description" /></div>
            <p className="muted">Consell: a Google Maps o OpenStreetMap, clic dret sobre el lloc per copiar les coordenades.</p>
            <button type="submit">Afegir punt</button>
          </form>
        </details>
      )}

      <div className="grid">
        {byMunicipality.map(({ m, items }) => (
          <section key={m} className="card">
            <h3>{m}</h3>
            {items.map((p) => (
              <div key={p.id} className="row spread" style={{ padding: "6px 0", borderTop: "1px solid var(--border)", flexWrap: "nowrap" }}>
                <div>
                  <span aria-hidden="true">{KIND_STYLE[p.kind]?.icon}</span> <strong>{p.name}</strong>
                  <div className="muted">{p.address}</div>
                </div>
                {staff && (
                  <form action={deleteMapPoint}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="secondary small" type="submit" aria-label={`Esborrar ${p.name}`}>✕</button>
                  </form>
                )}
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

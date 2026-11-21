import Alerts, { readAlerts, type SearchParams } from "@/components/Alerts";
import { PROFILE_COLUMNS, requireStaff, type Profile } from "@/lib/auth";
import { COMARQUES, formatDate } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { createChannel, createEvent, createPost, resolveReport, setRole, setStatus } from "../actions";

export const metadata = { title: "Gestió" };

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireStaff();
  const isAdmin = me.role === "admin";
  const { error, ok } = await readAlerts(searchParams);
  const supabase = await createClient();

  const [{ data: pending }, { data: members }, { data: reports }] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).eq("status", "pendent").order("created_at"),
    supabase.from("profiles").select(PROFILE_COLUMNS).neq("status", "pendent").order("display_name").limit(500),
    supabase.from("reports").select("id, message_id, message_snapshot, reason, created_at, profiles(display_name)")
      .eq("status", "obert").order("created_at"),
  ]);

  return (
    <div className="stack">
      <h1>Gestió</h1>
      <Alerts error={error} ok={ok} />

      {/* Sol·licituds pendents */}
      <section className="card">
        <h2>Sol·licituds pendents ({pending?.length ?? 0})</h2>
        {pending?.length ? (
          <div className="table-wrap"><table>
            <thead><tr><th>Nom</th><th>Comarca</th><th>Data</th><th></th></tr></thead>
            <tbody>
              {(pending as Profile[]).map((p) => (
                <tr key={p.id}>
                  <td>{p.display_name}</td>
                  <td>{p.comarca ?? "—"}</td>
                  <td>{formatDate(p.created_at, false)}</td>
                  <td className="row">
                    <StatusButton id={p.id} status="actiu" label="Aprovar" />
                    <StatusButton id={p.id} status="suspes" label="Rebutjar" danger />
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : <p className="muted">Cap sol·licitud pendent.</p>}
      </section>

      {/* Denúncies */}
      <section className="card">
        <h2>Denúncies obertes ({reports?.length ?? 0})</h2>
        {reports?.length ? reports.map((r) => (
          <form key={r.id} action={resolveReport} className="card">
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="message_id" value={r.message_id ?? ""} />
            <p className="prose"><strong>Missatge:</strong> {r.message_snapshot}</p>
            <p className="muted">
              Motiu: {r.reason} · per {(r.profiles as unknown as { display_name: string } | null)?.display_name ?? "—"} · {formatDate(r.created_at)}
            </p>
            <div className="row">
              {r.message_id && (
                <label className="check" style={{ marginBottom: 0 }}>
                  <input type="checkbox" name="delete_message" /> Esborrar el missatge
                </label>
              )}
              <button className="small" type="submit">Marcar com a resolta</button>
            </div>
          </form>
        )) : <p className="muted">Cap denúncia oberta.</p>}
      </section>

      <div className="grid">
        {/* Nova notícia */}
        <form action={createPost} className="card">
          <h2>Nova notícia o avís</h2>
          <div className="field"><label htmlFor="p-title">Títol</label><input id="p-title" name="title" minLength={3} maxLength={160} required /></div>
          <div className="field"><label htmlFor="p-body">Text</label><textarea id="p-body" name="body" required /></div>
          <div className="field">
            <label htmlFor="p-kind">Tipus</label>
            <select id="p-kind" name="kind"><option value="noticia">Notícia</option><option value="avis">Avís</option></select>
          </div>
          <label className="check field"><input type="checkbox" name="pinned" /> Fixar a dalt</label>
          <button type="submit">Publicar</button>
        </form>

        {/* Nova activitat */}
        <form action={createEvent} className="card">
          <h2>Nova activitat</h2>
          <div className="field"><label htmlFor="e-title">Títol</label><input id="e-title" name="title" minLength={3} maxLength={160} required /></div>
          <div className="field"><label htmlFor="e-desc">Descripció</label><textarea id="e-desc" name="description" /></div>
          <div className="field"><label htmlFor="e-loc">Lloc</label><input id="e-loc" name="location" required /></div>
          <div className="field">
            <label htmlFor="e-com">Comarca</label>
            <select id="e-com" name="comarca" defaultValue=""><option value="">—</option>
              {COMARQUES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor="e-start">Inici</label><input id="e-start" name="starts_at" type="datetime-local" required /></div>
          <div className="field"><label htmlFor="e-end">Final (opcional)</label><input id="e-end" name="ends_at" type="datetime-local" /></div>
          <div className="field"><label htmlFor="e-cap">Aforament (opcional)</label><input id="e-cap" name="capacity" type="number" min={1} /></div>
          <button type="submit">Crear activitat</button>
        </form>

        {isAdmin && (
          <form action={createChannel} className="card">
            <h2>Nou canal del fòrum</h2>
            <div className="field"><label htmlFor="c-name">Nom</label><input id="c-name" name="name" required maxLength={60} /></div>
            <div className="field">
              <label htmlFor="c-slug">Identificador (URL)</label>
              <input id="c-slug" name="slug" required pattern="[a-z0-9\-]{2,40}" placeholder="ex: barcelones" />
            </div>
            <div className="field"><label htmlFor="c-desc">Descripció</label><input id="c-desc" name="description" /></div>
            <label className="check field"><input type="checkbox" name="staff_only_post" /> Només la coordinació hi pot publicar</label>
            <button type="submit">Crear canal</button>
          </form>
        )}
      </div>

      {/* Membres */}
      <section className="card">
        <h2>Membres ({members?.length ?? 0})</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>Nom</th><th>Comarca</th><th>Rol</th><th>Estat</th><th></th></tr></thead>
          <tbody>
            {(members as Profile[] | null)?.map((p) => (
              <tr key={p.id}>
                <td>{p.display_name}</td>
                <td>{p.comarca ?? "—"}</td>
                <td>
                  {isAdmin && p.id !== me.id ? (
                    <form action={setRole} className="row">
                      <input type="hidden" name="id" value={p.id} />
                      <select name="role" defaultValue={p.role} style={{ width: "auto" }}>
                        <option value="membre">Membre</option>
                        <option value="coordinador">Coordinador</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button className="small secondary" type="submit">Desar</button>
                    </form>
                  ) : p.role}
                </td>
                <td>{p.status}</td>
                <td>
                  {p.id !== me.id && (p.status === "actiu"
                    ? <StatusButton id={p.id} status="suspes" label="Suspendre" danger />
                    : <StatusButton id={p.id} status="actiu" label="Reactivar" />)}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </section>
    </div>
  );
}

function StatusButton({ id, status, label, danger }: { id: string; status: string; label: string; danger?: boolean }) {
  return (
    <form action={setStatus}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={`small${danger ? " danger" : ""}`} type="submit">{label}</button>
    </form>
  );
}

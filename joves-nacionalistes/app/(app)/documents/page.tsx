import Alerts, { readAlerts, type SearchParams } from "@/components/Alerts";
import { isStaff, requireMember } from "@/lib/auth";
import { formatDate } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { deleteDocument, uploadDocument } from "../modules-actions";

export const metadata = { title: "Documents" };

const CATEGORIES = ["Guies", "Actes i reunions", "Materials de campanya", "Formació", "General"];

function ext(name: string, mime: string) {
  const e = name.split(".").pop()?.toUpperCase();
  if (e && e.length <= 4) return e;
  return mime.split("/").pop()?.slice(0, 4).toUpperCase() ?? "DOC";
}

function size(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} kB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function DocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireMember();
  const staff = isStaff(me);
  const sp = await searchParams;
  const { error, ok } = await readAlerts(searchParams);
  const qText = typeof sp.q === "string" ? sp.q.trim() : "";

  const supabase = await createClient();
  let q = supabase.from("documents").select("id, title, description, category, file_path, file_name, mime_type, size_bytes, created_at")
    .order("category").order("created_at", { ascending: false });
  if (qText) q = q.ilike("title", `%${qText.replace(/[%_]/g, "")}%`);
  const { data: docs } = await q;

  // Enllaços de descàrrega temporals (10 minuts), generats amb els permisos del membre
  const { data: signed } = docs?.length
    ? await supabase.storage.from("documents").createSignedUrls(docs.map((d) => d.file_path), 600, { download: true })
    : { data: [] };
  const urlFor = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl as string]));

  const groups = [...new Set((docs ?? []).map((d) => d.category))];

  return (
    <div>
      <h1>📁 Documents</h1>
      <p className="lead">Guies, actes i materials. Només els membres poden descarregar-los.</p>
      <Alerts error={error} ok={ok} />

      <form className="filters" role="search">
        <input name="q" defaultValue={qText} placeholder="Cerca per títol…" aria-label="Cerca documents" />
        <button type="submit" className="secondary">Cercar</button>
      </form>

      {staff && (
        <details className="staff-box">
          <summary>＋ Pujar document</summary>
          <form action={uploadDocument}>
            <div className="field"><label htmlFor="d-file">Fitxer (PDF, Office, imatge o text · màx. 20 MB)</label><input id="d-file" name="file" type="file" required /></div>
            <div className="two-col">
              <div className="field"><label htmlFor="d-title">Títol</label><input id="d-title" name="title" placeholder="Per defecte, el nom del fitxer" /></div>
              <div className="field">
                <label htmlFor="d-cat">Categoria</label>
                <select id="d-cat" name="category">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
              </div>
            </div>
            <div className="field"><label htmlFor="d-desc">Descripció</label><input id="d-desc" name="description" /></div>
            <button type="submit">Pujar</button>
          </form>
        </details>
      )}

      {groups.map((g) => (
        <section key={g} className="card">
          <h2>{g}</h2>
          {docs!.filter((d) => d.category === g).map((d) => (
            <div key={d.id} className="doc-row">
              <div className="doc-icon">{ext(d.file_name, d.mime_type)}</div>
              <div className="grow">
                <strong title={d.title}>{d.title}</strong>
                <span className="muted">{d.description ? `${d.description} · ` : ""}{size(d.size_bytes)} · {formatDate(d.created_at, false)}</span>
              </div>
              <div className="doc-actions">
                {urlFor.get(d.file_path) && <a className="btn small secondary" href={urlFor.get(d.file_path)}>Descarregar</a>}
                {staff && (
                  <form action={deleteDocument}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className="secondary small" type="submit" aria-label={`Esborrar ${d.title}`}>✕</button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </section>
      ))}
      {!docs?.length && <p className="muted">{qText ? "Cap document coincideix amb la cerca." : "Encara no hi ha documents."}</p>}
    </div>
  );
}

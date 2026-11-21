import Alerts, { readAlerts, type SearchParams } from "@/components/Alerts";
import { isStaff, requireMember } from "@/lib/auth";
import { COMARQUES, initials } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { setResponsibility } from "../modules-actions";

export const metadata = { title: "Directori" };

const ROLE: Record<string, string> = { membre: "Membre", coordinador: "Coordinació", admin: "Administració" };

type Member = { id: string; display_name: string; comarca: string | null; bio: string | null; role: string; responsibility: string | null };

export default async function DirectoryPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireMember();
  const staff = isStaff(me);
  const sp = await searchParams;
  const { error, ok } = await readAlerts(searchParams);
  const qText = typeof sp.q === "string" ? sp.q.trim() : "";
  const comarca = typeof sp.comarca === "string" && (COMARQUES as readonly string[]).includes(sp.comarca) ? sp.comarca : "";

  const supabase = await createClient();
  let q = supabase.from("profiles")
    .select("id, display_name, comarca, bio, role, responsibility")
    .eq("status", "actiu").eq("directory_visible", true).order("display_name").limit(500);
  if (qText) q = q.ilike("display_name", `%${qText.replace(/[%_]/g, "")}%`);
  if (comarca) q = q.eq("comarca", comarca);
  const { data } = await q;
  const members = (data ?? []) as Member[];
  const team = members.filter((m) => m.role !== "membre" || m.responsibility);
  const rest = members.filter((m) => !team.includes(m));

  const card = (m: Member) => (
    <div key={m.id} className="card member-card">
      <span className="avatar lg" aria-hidden="true">{initials(m.display_name)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>{m.display_name}</strong>
        <div className="muted">
          {m.responsibility ?? ROLE[m.role]}{m.comarca ? ` · ${m.comarca}` : ""}
        </div>
        {m.bio && <p style={{ margin: "6px 0 0", fontSize: "0.92rem" }}>{m.bio}</p>}
        {staff && (
          <details style={{ marginTop: 6 }}>
            <summary className="muted" style={{ cursor: "pointer", fontSize: "0.85rem" }}>Editar càrrec</summary>
            <form action={setResponsibility} className="row" style={{ marginTop: 6 }}>
              <input type="hidden" name="id" value={m.id} />
              <input name="responsibility" defaultValue={m.responsibility ?? ""} maxLength={80} placeholder="Ex: Responsable de formació" style={{ flex: 1 }} />
              <button className="small" type="submit">Desar</button>
            </form>
          </details>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <h1>📇 Directori</h1>
      <p className="lead">Coneix l&apos;equip i els membres. Pots amagar-te del directori des del teu perfil.</p>
      <Alerts error={error} ok={ok} />

      <form className="filters" role="search">
        <input name="q" defaultValue={qText} placeholder="Cerca per nom…" aria-label="Cerca per nom" />
        <select name="comarca" defaultValue={comarca} aria-label="Comarca">
          <option value="">Totes les comarques</option>
          {COMARQUES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button type="submit" className="secondary">Filtrar</button>
      </form>

      {team.length > 0 && (
        <>
          <h2>Equip de coordinació</h2>
          <div className="grid">{team.map(card)}</div>
        </>
      )}
      <h2 style={{ marginTop: 16 }}>Membres ({rest.length})</h2>
      <div className="grid">{rest.map(card)}</div>
      {!members.length && <p className="muted">Cap membre coincideix amb la cerca.</p>}
    </div>
  );
}

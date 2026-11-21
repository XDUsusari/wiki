import Link from "next/link";
import Alerts, { readAlerts, type SearchParams } from "@/components/Alerts";
import { isStaff, requireMember } from "@/lib/auth";
import { formatDate } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { answerProposal, createProposal, toggleSupport } from "../modules-actions";

export const metadata = { title: "Bústia de propostes" };

const STATUS: Record<string, string> = { nova: "Nova", en_estudi: "En estudi", acceptada: "Acceptada", descartada: "Descartada" };
const CATEGORIES = ["Activitats", "Formació", "Comunicació", "Organització", "Altres"];

type Proposal = {
  id: string; title: string; body: string; category: string; status: string; response: string | null; created_at: string;
  author_id: string | null; profiles: { display_name: string } | null; proposal_supports: { user_id: string }[];
};

export default async function ProposalsPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireMember();
  const staff = isStaff(me);
  const sp = await searchParams;
  const { error, ok } = await readAlerts(searchParams);
  const order = sp.ordre === "recents" ? "recents" : "suports";
  const filter = typeof sp.estat === "string" && sp.estat in STATUS ? sp.estat : "";

  const supabase = await createClient();
  let q = supabase.from("proposals")
    .select("id, title, body, category, status, response, created_at, author_id, profiles!proposals_author_id_fkey(display_name), proposal_supports(user_id)")
    .order("created_at", { ascending: false });
  if (filter) q = q.eq("status", filter);
  const { data } = await q;
  const proposals = (data ?? []) as unknown as Proposal[];
  if (order === "suports") proposals.sort((a, b) => b.proposal_supports.length - a.proposal_supports.length);

  const link = (o: string, e: string) => `/propostes?ordre=${o}${e ? `&estat=${e}` : ""}`;

  return (
    <div>
      <h1>💡 Bústia de propostes</h1>
      <p className="lead">Tens una idea? Proposa-la i dona suport a les dels altres. La coordinació respon totes les propostes.</p>
      <Alerts error={error} ok={ok} />

      <details className="staff-box" style={{ background: "var(--surface)" }}>
        <summary>＋ Enviar una proposta</summary>
        <form action={createProposal}>
          <div className="field"><label htmlFor="pr-title">Títol</label><input id="pr-title" name="title" required minLength={5} maxLength={140} /></div>
          <div className="field"><label htmlFor="pr-body">Explica-la</label><textarea id="pr-body" name="body" required minLength={10} maxLength={5000} /></div>
          <div className="field" style={{ maxWidth: 240 }}>
            <label htmlFor="pr-cat">Categoria</label>
            <select id="pr-cat" name="category">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </div>
          <button type="submit">Enviar proposta</button>
        </form>
      </details>

      <div className="filters">
        <div className="row">
          <Link className={`btn small ${order === "suports" ? "" : "secondary"}`} href={link("suports", filter)}>Més suport</Link>
          <Link className={`btn small ${order === "recents" ? "" : "secondary"}`} href={link("recents", filter)}>Més recents</Link>
        </div>
        <div className="row">
          <Link className={`btn small ${!filter ? "" : "secondary"}`} href={link(order, "")}>Totes</Link>
          {Object.entries(STATUS).map(([k, v]) => (
            <Link key={k} className={`btn small ${filter === k ? "" : "secondary"}`} href={link(order, k)}>{v}</Link>
          ))}
        </div>
      </div>

      {proposals.map((p) => {
        const supported = p.proposal_supports.some((s) => s.user_id === me.id);
        return (
          <article key={p.id} id={`p-${p.id}`} className="card" style={{ display: "flex", gap: 14 }}>
            <form action={toggleSupport}>
              <input type="hidden" name="proposal_id" value={p.id} />
              <input type="hidden" name="on" value={supported ? "1" : "0"} />
              <input type="hidden" name="back" value={link(order, filter)} />
              <button type="submit" className={`secondary support-btn${supported ? " on" : ""}`} aria-pressed={supported}
                aria-label={supported ? "Retirar el suport" : "Donar suport"}>
                <span aria-hidden="true">▲</span><b>{p.proposal_supports.length}</b>
              </button>
            </form>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row">
                <span className={`status ${p.status}`}>{STATUS[p.status]}</span>
                <span className="badge">{p.category}</span>
              </div>
              <h3 style={{ marginTop: 8 }}>{p.title}</h3>
              <p className="prose" style={{ margin: "4px 0" }}>{p.body}</p>
              <p className="muted" style={{ margin: 0 }}>{p.profiles?.display_name ?? "Membre"} · {formatDate(p.created_at, false)}</p>
              {p.response && (
                <div className="alert ok" style={{ marginTop: 10, marginBottom: 0, color: "var(--text)", borderColor: "var(--brand)", background: "var(--brand-tint)" }}>
                  <strong style={{ color: "var(--brand)" }}>Resposta de la coordinació:</strong> {p.response}
                </div>
              )}
              {staff && (
                <details style={{ marginTop: 10 }}>
                  <summary className="muted" style={{ cursor: "pointer" }}>Respondre / canviar estat</summary>
                  <form action={answerProposal} style={{ marginTop: 8 }}>
                    <input type="hidden" name="id" value={p.id} />
                    <div className="field" style={{ maxWidth: 220 }}>
                      <select name="status" defaultValue={p.status} aria-label="Estat">
                        {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div className="field"><textarea name="response" defaultValue={p.response ?? ""} placeholder="Resposta visible per a tothom" style={{ minHeight: 70 }} /></div>
                    <button className="small" type="submit">Desar</button>
                  </form>
                </details>
              )}
            </div>
          </article>
        );
      })}
      {!proposals.length && <p className="muted">Encara no hi ha propostes{filter ? " amb aquest estat" : ""}.</p>}
    </div>
  );
}

import Link from "next/link";
import Alerts, { readAlerts, type SearchParams } from "@/components/Alerts";
import { isStaff, requireMember } from "@/lib/auth";
import { formatDate } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { createPoll } from "../modules-actions";

export const metadata = { title: "Enquestes i consultes" };

export default async function PollsPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireMember();
  const { error, ok } = await readAlerts(searchParams);
  const supabase = await createClient();
  const [{ data: polls }, { data: myVotes }] = await Promise.all([
    supabase.from("polls").select("id, question, description, closes_at, poll_options(id)").order("closes_at", { ascending: false }),
    supabase.from("poll_votes").select("poll_id").eq("user_id", me.id),
  ]);
  const voted = new Set((myVotes ?? []).map((v) => v.poll_id));
  const now = new Date();
  const open = (polls ?? []).filter((p) => new Date(p.closes_at) > now);
  const closed = (polls ?? []).filter((p) => new Date(p.closes_at) <= now);
  const counts = await Promise.all((polls ?? []).map((p) => supabase.rpc("poll_voter_count", { pid: p.id })));
  const voters = new Map((polls ?? []).map((p, i) => [p.id, (counts[i].data as number) ?? 0]));

  const card = (p: NonNullable<typeof polls>[number], isOpen: boolean) => (
    <Link key={p.id} href={`/enquestes/${p.id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
      <div className="row spread">
        {isOpen ? <span className="badge accent">Oberta</span> : <span className="badge">Tancada</span>}
        {voted.has(p.id) ? <span className="muted">✓ Has votat</span> : isOpen ? <span className="muted" style={{ color: "var(--danger)" }}>Pendent de votar</span> : null}
      </div>
      <h3 style={{ marginTop: 10 }}>{p.question}</h3>
      <p className="muted">{p.poll_options.length} opcions · {voters.get(p.id)} vots · {isOpen ? "tanca" : "va tancar"} el {formatDate(p.closes_at)}</p>
    </Link>
  );

  return (
    <div>
      <h1>🗳️ Enquestes i consultes</h1>
      <p className="lead">La teva opinió decideix. El vot és <strong>secret</strong>: ningú, ni tan sols la coordinació, pot veure què has votat.</p>
      <Alerts error={error} ok={ok} />

      {isStaff(me) && (
        <details className="staff-box">
          <summary>＋ Nova consulta</summary>
          <form action={createPoll}>
            <div className="field"><label htmlFor="p-q">Pregunta</label><input id="p-q" name="question" required minLength={5} maxLength={200} /></div>
            <div className="field"><label htmlFor="p-d">Context (opcional)</label><textarea id="p-d" name="description" /></div>
            <div className="field"><label htmlFor="p-o">Opcions (una per línia, màxim 10)</label><textarea id="p-o" name="options" required placeholder={"Opció A\nOpció B"} /></div>
            <div className="field" style={{ maxWidth: 260 }}><label htmlFor="p-c">Data de tancament</label><input id="p-c" name="closes_at" type="datetime-local" required /></div>
            <button type="submit">Publicar consulta</button>
          </form>
        </details>
      )}

      <h2>Obertes ({open.length})</h2>
      <div className="grid">{open.map((p) => card(p, true))}</div>
      {!open.length && <p className="muted">No hi ha cap consulta oberta.</p>}

      {closed.length > 0 && (
        <>
          <h2 style={{ marginTop: 24 }}>Resultats anteriors</h2>
          <div className="grid">{closed.map((p) => card(p, false))}</div>
        </>
      )}
    </div>
  );
}

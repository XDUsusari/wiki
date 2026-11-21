import Link from "next/link";
import { notFound } from "next/navigation";
import Alerts, { readAlerts, type SearchParams } from "@/components/Alerts";
import { requireMember } from "@/lib/auth";
import { formatDate } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { vote } from "../../modules-actions";

export default async function PollPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const { error, ok } = await readAlerts(searchParams);
  const me = await requireMember();
  const supabase = await createClient();
  const { data: poll } = await supabase
    .from("polls").select("id, question, description, closes_at, poll_options(id, label, position)").eq("id", id).maybeSingle();
  if (!poll) notFound();
  const options = [...poll.poll_options].sort((a, b) => a.position - b.position);

  const [{ data: mine }, { data: results }, { data: voters }] = await Promise.all([
    supabase.from("poll_votes").select("option_id").eq("poll_id", id).eq("user_id", me.id).maybeSingle(),
    supabase.rpc("poll_results", { pid: id }),
    supabase.rpc("poll_voter_count", { pid: id }),
  ]);
  const isOpen = new Date(poll.closes_at) > new Date();
  const showResults = !!mine || !isOpen;
  const votes = new Map(((results ?? []) as { option_id: string; votes: number }[]).map((r) => [r.option_id, r.votes]));
  const total = (voters as number) ?? 0;
  const max = Math.max(0, ...votes.values());

  return (
    <div style={{ maxWidth: 720 }}>
      <Link href="/enquestes">← Totes les consultes</Link>
      <div className="row" style={{ marginTop: 12 }}>
        {isOpen ? <span className="badge accent">Oberta</span> : <span className="badge">Tancada</span>}
        <span className="muted">{isOpen ? "Tanca" : "Va tancar"} el {formatDate(poll.closes_at)} · {total} vots</span>
      </div>
      <h1 style={{ marginTop: 10 }}>{poll.question}</h1>
      {poll.description && <p className="prose lead">{poll.description}</p>}
      <Alerts error={error} ok={ok} />

      <section className="card">
        {showResults ? (
          <>
            {options.map((o) => {
              const n = votes.get(o.id) ?? 0;
              const pct = total ? Math.round((n / total) * 100) : 0;
              return (
                <div key={o.id} className={`option-bar${mine?.option_id === o.id ? " mine" : ""}`}>
                  <div className="fill" style={{ width: `${pct}%`, background: n === max && n > 0 ? "#cfd9ea" : undefined }} />
                  <span>
                    <span>{o.label}{mine?.option_id === o.id && <strong> · el teu vot</strong>}</span>
                    <strong>{pct}% <small className="muted">({n})</small></strong>
                  </span>
                </div>
              );
            })}
            <p className="muted" style={{ marginBottom: 0 }}>🔒 Resultats agregats. Els vots individuals són secrets.</p>
          </>
        ) : (
          <form action={vote}>
            <input type="hidden" name="poll_id" value={poll.id} />
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="muted" style={{ marginBottom: 8 }}>Tria una opció. Un cop enviat, el vot no es pot canviar.</legend>
              {options.map((o) => (
                <label key={o.id} className="vote-option">
                  <input type="radio" name="option_id" value={o.id} required /> {o.label}
                </label>
              ))}
            </fieldset>
            <button type="submit">Enviar el meu vot</button>
          </form>
        )}
      </section>
    </div>
  );
}

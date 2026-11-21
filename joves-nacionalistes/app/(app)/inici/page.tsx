import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { formatDate, formatRange } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Inici" };

const SHORTCUTS = [
  { href: "/voluntariat", icon: "🙋", label: "Voluntariat" },
  { href: "/mapa", icon: "🗺️", label: "Mapa" },
  { href: "/formacio", icon: "🎓", label: "Formació" },
  { href: "/forum", icon: "💬", label: "Fòrum" },
  { href: "/enquestes", icon: "🗳️", label: "Consultes" },
  { href: "/propostes", icon: "💡", label: "Propostes" },
  { href: "/documents", icon: "📁", label: "Documents" },
  { href: "/directori", icon: "📇", label: "Directori" },
];

export default async function HomePage() {
  const me = await requireMember();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [{ data: posts }, { data: events }, { data: openPolls }, { data: myVotes }, { data: myShifts }] = await Promise.all([
    supabase.from("posts").select("id, title, kind, pinned, created_at")
      .order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(4),
    supabase.from("events").select("id, title, starts_at, location").gte("starts_at", now).order("starts_at").limit(3),
    supabase.from("polls").select("id, question").gt("closes_at", now),
    supabase.from("poll_votes").select("poll_id").eq("user_id", me.id),
    supabase.from("shift_signups").select("volunteer_shifts(title, starts_at, ends_at, campaign_id)").eq("user_id", me.id),
  ]);
  const voted = new Set((myVotes ?? []).map((v) => v.poll_id));
  const pendingPolls = (openPolls ?? []).filter((p) => !voted.has(p.id));
  const nextShift = (myShifts ?? [])
    .map((r) => r.volunteer_shifts as unknown as { title: string; starts_at: string; ends_at: string; campaign_id: string })
    .filter((s) => s && s.starts_at > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];

  return (
    <div className="stack">
      <h1>Hola, {me.display_name} 👋</h1>

      {(pendingPolls.length > 0 || nextShift) && (
        <div className="grid">
          {pendingPolls.length > 0 && (
            <Link href={`/enquestes/${pendingPolls[0].id}`} className="card" style={{ textDecoration: "none", color: "inherit", borderColor: "var(--brand)" }}>
              <span className="badge accent">🗳️ {pendingPolls.length} {pendingPolls.length > 1 ? "consultes pendents" : "consulta pendent"}</span>
              <h3 style={{ marginTop: 8 }}>{pendingPolls[0].question}</h3>
              <span className="muted">Vota abans que tanqui →</span>
            </Link>
          )}
          {nextShift && (
            <Link href={`/voluntariat/${nextShift.campaign_id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
              <span className="badge">🙋 El teu proper torn</span>
              <h3 style={{ marginTop: 8 }}>{nextShift.title}</h3>
              <span className="muted">{formatRange(nextShift.starts_at, nextShift.ends_at)}</span>
            </Link>
          )}
        </div>
      )}

      <div className="grid">
        <section className="card">
          <div className="row spread"><h2>📢 Taulell d&apos;anuncis</h2><Link href="/anuncis">Tots</Link></div>
          {posts?.length ? posts.map((p) => (
            <p key={p.id}>
              {p.kind === "avis" && <span className="badge accent">Avís</span>}{" "}
              <Link href={`/anuncis/${p.id}`}>{p.title}</Link>
              <br /><span className="muted">{formatDate(p.created_at, false)}</span>
            </p>
          )) : <p className="muted">Encara no hi ha anuncis.</p>}
        </section>
        <section className="card">
          <div className="row spread"><h2>📅 Properes activitats</h2><Link href="/esdeveniments">Agenda</Link></div>
          {events?.length ? events.map((e) => (
            <p key={e.id}>
              <Link href={`/esdeveniments/${e.id}`}>{e.title}</Link>
              <br /><span className="muted">{formatDate(e.starts_at)} · {e.location}</span>
            </p>
          )) : <p className="muted">No hi ha activitats programades.</p>}
        </section>
      </div>

      <section>
        <h2>Participa</h2>
        <div className="shortcuts">
          {SHORTCUTS.map((s) => (
            <Link key={s.href} href={s.href} className="shortcut">
              <span aria-hidden="true">{s.icon}</span>{s.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

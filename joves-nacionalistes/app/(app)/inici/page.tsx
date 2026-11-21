import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { formatDate } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Inici" };

export default async function HomePage() {
  const me = await requireMember();
  const supabase = await createClient();
  const [{ data: posts }, { data: events }] = await Promise.all([
    supabase.from("posts").select("id, title, kind, pinned, created_at")
      .order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(5),
    supabase.from("events").select("id, title, starts_at, location")
      .gte("starts_at", new Date().toISOString()).order("starts_at").limit(3),
  ]);

  return (
    <div className="stack">
      <h1>Hola, {me.display_name}</h1>
      <div className="grid">
        <section className="card">
          <div className="row spread"><h2>Darreres notícies</h2><Link href="/noticies">Totes</Link></div>
          {posts?.length ? posts.map((p) => (
            <p key={p.id}>
              {p.kind === "avis" && <span className="badge accent">Avís</span>}{" "}
              <Link href={`/noticies/${p.id}`}>{p.title}</Link>
              <br /><span className="muted">{formatDate(p.created_at, false)}</span>
            </p>
          )) : <p className="muted">Encara no hi ha notícies.</p>}
        </section>
        <section className="card">
          <div className="row spread"><h2>Properes activitats</h2><Link href="/esdeveniments">Agenda</Link></div>
          {events?.length ? events.map((e) => (
            <p key={e.id}>
              <Link href={`/esdeveniments/${e.id}`}>{e.title}</Link>
              <br /><span className="muted">{formatDate(e.starts_at)} · {e.location}</span>
            </p>
          )) : <p className="muted">No hi ha activitats programades.</p>}
        </section>
      </div>
    </div>
  );
}

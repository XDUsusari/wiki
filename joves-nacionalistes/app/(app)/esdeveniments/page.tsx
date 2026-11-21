import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { formatDate } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Agenda" };

export default async function EventsPage() {
  const me = await requireMember();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [{ data: upcoming }, { data: mine }] = await Promise.all([
    supabase.from("events").select("id, title, starts_at, location, comarca, capacity")
      .gte("starts_at", now).order("starts_at").limit(100),
    supabase.from("event_registrations").select("event_id").eq("user_id", me.id),
  ]);
  const registered = new Set((mine ?? []).map((r) => r.event_id));

  return (
    <div>
      <h1>Agenda</h1>
      {upcoming?.length ? (
        <div className="grid">
          {upcoming.map((e) => (
            <article key={e.id} className="card">
              {registered.has(e.id) && <span className="badge accent">Inscrit</span>}
              <h3 style={{ marginTop: 6 }}><Link href={`/esdeveniments/${e.id}`}>{e.title}</Link></h3>
              <p className="muted">{formatDate(e.starts_at)}</p>
              <p className="muted">{e.location}{e.comarca ? ` · ${e.comarca}` : ""}</p>
            </article>
          ))}
        </div>
      ) : <p className="muted">No hi ha activitats programades.</p>}
    </div>
  );
}

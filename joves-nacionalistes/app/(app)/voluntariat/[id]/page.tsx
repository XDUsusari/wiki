import Link from "next/link";
import { notFound } from "next/navigation";
import Alerts, { readAlerts, type SearchParams } from "@/components/Alerts";
import { isStaff, requireMember } from "@/lib/auth";
import { formatDay, formatRange, initials } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { createShift, toggleShift } from "../../modules-actions";

type Shift = {
  id: string; title: string; location: string; starts_at: string; ends_at: string; slots: number;
  shift_signups: { user_id: string; profiles: { display_name: string } | null }[];
};

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const me = await requireMember();
  const { error, ok } = await readAlerts(searchParams);
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("campaigns")
    .select("id, title, description, comarca, starts_on, ends_on, volunteer_shifts(id, title, location, starts_at, ends_at, slots, shift_signups(user_id, profiles(display_name)))")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();
  const shifts = (c.volunteer_shifts as unknown as Shift[]).sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  return (
    <div>
      <Link href="/voluntariat">← Totes les campanyes</Link>
      <h1 style={{ marginTop: 12 }}>{c.title}</h1>
      <p className="lead">{c.comarca ?? "Tot el territori"} · {formatDay(c.starts_on)} – {formatDay(c.ends_on)}</p>
      <Alerts error={error} ok={ok} />
      <section className="card"><div className="prose">{c.description}</div></section>

      {isStaff(me) && (
        <details className="staff-box">
          <summary>＋ Afegir torn</summary>
          <form action={createShift}>
            <input type="hidden" name="campaign_id" value={c.id} />
            <div className="two-col">
              <div className="field"><label htmlFor="s-title">Tasca</label><input id="s-title" name="title" required placeholder="Ex: Repartiment de fulletons" /></div>
              <div className="field"><label htmlFor="s-loc">Lloc</label><input id="s-loc" name="location" required /></div>
              <div className="field"><label htmlFor="s-start">Inici</label><input id="s-start" type="datetime-local" name="starts_at" required /></div>
              <div className="field"><label htmlFor="s-end">Final</label><input id="s-end" type="datetime-local" name="ends_at" required /></div>
            </div>
            <div className="field" style={{ maxWidth: 160 }}><label htmlFor="s-slots">Places</label><input id="s-slots" type="number" name="slots" min={1} defaultValue={4} required /></div>
            <button type="submit">Afegir torn</button>
          </form>
        </details>
      )}

      <section className="card">
        <h2>Torns</h2>
        {shifts.map((s) => {
          const joined = s.shift_signups.some((x) => x.user_id === me.id);
          const full = s.shift_signups.length >= s.slots;
          const past = new Date(s.starts_at) < new Date();
          return (
            <div key={s.id} className="shift">
              <div style={{ flex: 1, minWidth: 220 }}>
                <strong>{s.title}</strong>
                <div className="muted">{formatRange(s.starts_at, s.ends_at)} · 📍 {s.location}</div>
                <div className="row" style={{ marginTop: 6 }}>
                  <div className="avatars">
                    {s.shift_signups.slice(0, 6).map((x) => (
                      <span key={x.user_id} className="avatar" title={x.profiles?.display_name}>{initials(x.profiles?.display_name ?? "?")}</span>
                    ))}
                  </div>
                  <span className="muted">{s.shift_signups.length}/{s.slots} places</span>
                </div>
              </div>
              {!past && (joined || !full) ? (
                <form action={toggleShift}>
                  <input type="hidden" name="shift_id" value={s.id} />
                  <input type="hidden" name="campaign_id" value={c.id} />
                  <input type="hidden" name="joined" value={joined ? "1" : "0"} />
                  <button type="submit" className={joined ? "secondary" : ""}>{joined ? "✓ Apuntat · Desapuntar-me" : "M'hi apunto"}</button>
                </form>
              ) : (
                <span className="badge">{past ? "Finalitzat" : "Complet"}</span>
              )}
            </div>
          );
        })}
        {!shifts.length && <p className="muted">Encara no hi ha torns en aquesta campanya.</p>}
      </section>
    </div>
  );
}

import Link from "next/link";
import Alerts, { readAlerts, type SearchParams } from "@/components/Alerts";
import { isStaff, requireMember } from "@/lib/auth";
import { COMARQUES, formatDay, formatRange } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { createCampaign } from "../modules-actions";

export const metadata = { title: "Voluntariat i campanyes" };

type Shift = { id: string; slots: number; starts_at: string; shift_signups: { user_id: string }[] };

export default async function VolunteerPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireMember();
  const { error, ok } = await readAlerts(searchParams);
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, title, description, comarca, starts_on, ends_on, volunteer_shifts(id, slots, starts_at, shift_signups(user_id))")
    .gte("ends_on", today)
    .order("starts_on");

  const { data: myShifts } = await supabase
    .from("shift_signups")
    .select("volunteer_shifts(id, title, starts_at, ends_at, location, campaign_id, campaigns(title))")
    .eq("user_id", me.id);
  const upcomingMine = (myShifts ?? [])
    .map((r) => r.volunteer_shifts as unknown as { id: string; title: string; starts_at: string; ends_at: string; location: string; campaign_id: string; campaigns: { title: string } })
    .filter((s) => s && new Date(s.starts_at) > new Date())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const totals = (campaigns ?? []).reduce(
    (acc, c) => {
      for (const s of c.volunteer_shifts as Shift[]) {
        acc.slots += s.slots;
        acc.filled += s.shift_signups.length;
      }
      return acc;
    },
    { slots: 0, filled: 0 },
  );

  return (
    <div>
      <div className="page-head"><h1>🙋 Voluntariat i campanyes</h1></div>
      <p className="lead">Apunta&apos;t als torns de les campanyes actives. Cada mà compta!</p>
      <Alerts error={error} ok={ok} />

      <div className="stat-row">
        <div className="stat"><b>{campaigns?.length ?? 0}</b>Campanyes actives</div>
        <div className="stat"><b>{totals.filled}/{totals.slots}</b>Places cobertes</div>
        <div className="stat"><b>{upcomingMine.length}</b>Els meus torns</div>
      </div>

      {upcomingMine.length > 0 && (
        <section className="card">
          <h2>Els meus propers torns</h2>
          {upcomingMine.map((s) => (
            <div key={s.id} className="shift">
              <div>
                <strong>{s.title}</strong> · <Link href={`/voluntariat/${s.campaign_id}`}>{s.campaigns.title}</Link>
                <div className="muted">{formatRange(s.starts_at, s.ends_at)} · {s.location}</div>
              </div>
            </div>
          ))}
        </section>
      )}

      {isStaff(me) && (
        <details className="staff-box">
          <summary>＋ Nova campanya</summary>
          <form action={createCampaign}>
            <div className="field"><label htmlFor="c-title">Nom de la campanya</label><input id="c-title" name="title" required minLength={3} maxLength={120} /></div>
            <div className="field"><label htmlFor="c-desc">Descripció</label><textarea id="c-desc" name="description" /></div>
            <div className="two-col">
              <div className="field"><label htmlFor="c-start">Inici</label><input id="c-start" type="date" name="starts_on" required /></div>
              <div className="field"><label htmlFor="c-end">Final</label><input id="c-end" type="date" name="ends_on" required /></div>
            </div>
            <div className="field">
              <label htmlFor="c-com">Comarca</label>
              <select id="c-com" name="comarca" defaultValue="Barcelonès">{COMARQUES.map((c) => <option key={c}>{c}</option>)}</select>
            </div>
            <button type="submit">Crear campanya</button>
          </form>
        </details>
      )}

      <div className="grid">
        {campaigns?.map((c) => {
          const shifts = c.volunteer_shifts as Shift[];
          const slots = shifts.reduce((n, s) => n + s.slots, 0);
          const filled = shifts.reduce((n, s) => n + s.shift_signups.length, 0);
          const pct = slots ? Math.round((filled / slots) * 100) : 0;
          return (
            <Link key={c.id} href={`/voluntariat/${c.id}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="row spread">
                <span className="badge">{c.comarca ?? "Tot el territori"}</span>
                <span className="muted">{formatDay(c.starts_on)} – {formatDay(c.ends_on)}</span>
              </div>
              <h3 style={{ marginTop: 10 }}>{c.title}</h3>
              <p className="muted">{c.description.length > 140 ? c.description.slice(0, 140) + "…" : c.description}</p>
              <div className="progress" aria-label={`${pct}% de places cobertes`}><div style={{ width: `${pct}%` }} /></div>
              <p className="muted" style={{ margin: "6px 0 0" }}>{shifts.length} torns · {filled}/{slots} voluntaris</p>
            </Link>
          );
        })}
      </div>
      {!campaigns?.length && <p className="muted">No hi ha campanyes actives ara mateix.</p>}
    </div>
  );
}

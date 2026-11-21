import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import Alerts, { readAlerts, type SearchParams } from "@/components/Alerts";
import { isStaff, requireMember } from "@/lib/auth";
import { formatDate } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { checkIn, deleteEvent, registerEvent, unregisterEvent } from "../../actions";

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { error, ok } = await readAlerts(searchParams);
  const me = await requireMember();
  const staff = isStaff(me);
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!event) notFound();

  const [{ data: count }, { data: reg }] = await Promise.all([
    supabase.rpc("event_registration_count", { eid: id }),
    supabase.from("event_registrations").select("token, checked_in_at")
      .eq("event_id", id).eq("user_id", me.id).maybeSingle(),
  ]);

  const attendees = staff
    ? (await supabase.from("event_registrations")
        .select("user_id, checked_in_at, created_at, profiles(display_name, comarca)")
        .eq("event_id", id).order("created_at")).data ?? []
    : [];

  const qr = reg ? await QRCode.toDataURL(reg.token, { margin: 1, width: 220 }) : null;
  const full = event.capacity != null && (count ?? 0) >= event.capacity;
  const past = new Date(event.starts_at) < new Date();

  return (
    <div className="stack">
      <Alerts error={error} ok={ok} />
      <article className="card">
        <h1>{event.title}</h1>
        <p className="muted">
          {formatDate(event.starts_at)}{event.ends_at ? ` – ${formatDate(event.ends_at)}` : ""}
          <br />{event.location}{event.comarca ? ` · ${event.comarca}` : ""}
          <br />Inscrits: {count ?? 0}{event.capacity ? ` / ${event.capacity}` : ""}
        </p>
        <div className="prose">{event.description}</div>
      </article>

      <section className="card">
        {reg ? (
          <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
            {qr && <img src={qr} alt="Codi QR d'entrada" width={220} height={220} style={{ background: "#fff", borderRadius: 8 }} />}
            <div>
              <h2>Estàs inscrit</h2>
              <p className="muted">Mostra aquest codi QR a l&apos;entrada.{reg.checked_in_at ? " Entrada ja validada." : ""}</p>
              {!past && (
                <form action={unregisterEvent}>
                  <input type="hidden" name="event_id" value={event.id} />
                  <button className="secondary" type="submit">Anul·lar inscripció</button>
                </form>
              )}
            </div>
          </div>
        ) : past ? (
          <p className="muted">Aquesta activitat ja ha començat.</p>
        ) : full ? (
          <p className="muted">Aforament complet.</p>
        ) : (
          <form action={registerEvent}>
            <input type="hidden" name="event_id" value={event.id} />
            <button type="submit">Inscriure&apos;m</button>
          </form>
        )}
      </section>

      {staff && (
        <section className="card">
          <h2>Gestió de l&apos;activitat</h2>
          <form action={checkIn} className="row" style={{ marginBottom: 12 }}>
            <input type="hidden" name="event_id" value={event.id} />
            <input name="token" placeholder="Codi de l'entrada (QR)" required style={{ flex: 1, minWidth: 200 }} />
            <button type="submit">Validar entrada</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nom</th><th>Comarca</th><th>Entrada</th></tr></thead>
              <tbody>
                {attendees.map((a) => {
                  const p = a.profiles as unknown as { display_name: string; comarca: string | null } | null;
                  return (
                    <tr key={a.user_id}>
                      <td>{p?.display_name}</td>
                      <td>{p?.comarca ?? "—"}</td>
                      <td>{a.checked_in_at ? "✔ " + formatDate(a.checked_in_at) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <form action={deleteEvent} style={{ marginTop: 12 }}>
            <input type="hidden" name="id" value={event.id} />
            <button className="danger small" type="submit">Esborrar activitat</button>
          </form>
        </section>
      )}
      <Link href="/esdeveniments">← Tornar a l&apos;agenda</Link>
    </div>
  );
}

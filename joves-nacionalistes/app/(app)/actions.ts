"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember, requireStaff } from "@/lib/auth";
import { COMARQUES, friendlyError } from "@/lib/constants";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function done(path: string, result: { error?: string; ok?: string }): never {
  const q = result.error ? `error=${encodeURIComponent(result.error)}` : `ok=${encodeURIComponent(result.ok ?? "Fet")}`;
  revalidatePath(path);
  redirect(`${path}?${q}`);
}

// ───────────── Perfil ─────────────
export async function updateProfile(f: FormData) {
  const me = await requireMember();
  const comarca = str(f, "comarca");
  if (comarca && !(COMARQUES as readonly string[]).includes(comarca)) done("/perfil", { error: "Comarca no vàlida." });
  const supabase = await createClient();
  const { error } = await supabase.from("profiles")
    .update({ display_name: str(f, "display_name"), comarca: comarca || null, bio: str(f, "bio") || null })
    .eq("id", me.id);
  done("/perfil", error ? { error: friendlyError(error.message) } : { ok: "Perfil desat." });
}

export async function deleteAccount(f: FormData) {
  const me = await requireMember();
  if (str(f, "confirm") !== "ESBORRAR") done("/perfil", { error: "Escriu ESBORRAR per confirmar." });
  const supabase = await createClient();
  const admin = createAdminClient();
  // Esborrar l'usuari d'auth elimina en cascada el perfil, missatges i inscripcions
  const { error } = await admin.auth.admin.deleteUser(me.id);
  if (error) done("/perfil", { error: "No s'ha pogut esborrar el compte." });
  await supabase.auth.signOut();
  redirect("/?ok=" + encodeURIComponent("Compte esborrat."));
}

// ───────────── Notícies ─────────────
export async function createPost(f: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const kind = str(f, "kind") === "avis" ? "avis" : "noticia";
  const { error } = await supabase.from("posts").insert({
    author_id: me.id, kind, title: str(f, "title"), body: str(f, "body"), pinned: f.get("pinned") === "on",
  });
  done("/admin", error ? { error: friendlyError(error.message) } : { ok: "Notícia publicada." });
}

export async function deletePost(f: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("posts").delete().eq("id", str(f, "id"));
  if (error) done("/noticies", { error: friendlyError(error.message) });
  done("/noticies", { ok: "Notícia esborrada." });
}

// ───────────── Esdeveniments ─────────────
const madridFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Madrid", hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

/** Diferència (ms) entre l'hora de Catalunya i UTC en un instant donat. */
function madridOffset(ms: number) {
  const p = Object.fromEntries(madridFmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** L'input datetime-local («2026-05-01T18:30») no porta zona: s'interpreta com a hora de Catalunya. */
function toIso(local: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let utc = guess - madridOffset(guess);
  utc = guess - madridOffset(utc); // corregeix canvis d'horari d'estiu
  return new Date(utc).toISOString();
}

export async function createEvent(f: FormData) {
  const me = await requireStaff();
  const startsAt = toIso(str(f, "starts_at"));
  if (!startsAt) done("/admin", { error: "Data d'inici no vàlida." });
  const capacity = str(f, "capacity");
  const comarca = str(f, "comarca");
  const supabase = await createClient();
  const { error } = await supabase.from("events").insert({
    created_by: me.id,
    title: str(f, "title"),
    description: str(f, "description"),
    location: str(f, "location"),
    comarca: (COMARQUES as readonly string[]).includes(comarca) ? comarca : null,
    starts_at: startsAt,
    ends_at: toIso(str(f, "ends_at")),
    capacity: capacity ? Math.max(1, parseInt(capacity, 10)) : null,
  });
  done("/admin", error ? { error: friendlyError(error.message) } : { ok: "Activitat creada." });
}

export async function deleteEvent(f: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", str(f, "id"));
  if (error) done(`/esdeveniments/${str(f, "id")}`, { error: friendlyError(error.message) });
  done("/esdeveniments", { ok: "Activitat esborrada." });
}

export async function registerEvent(f: FormData) {
  const me = await requireMember();
  const eventId = str(f, "event_id");
  const supabase = await createClient();
  const { error } = await supabase.from("event_registrations").insert({ event_id: eventId, user_id: me.id });
  done(`/esdeveniments/${eventId}`, error ? { error: friendlyError(error.message) } : { ok: "Inscripció feta!" });
}

export async function unregisterEvent(f: FormData) {
  const me = await requireMember();
  const eventId = str(f, "event_id");
  const supabase = await createClient();
  const { error } = await supabase.from("event_registrations").delete().eq("event_id", eventId).eq("user_id", me.id);
  done(`/esdeveniments/${eventId}`, error ? { error: friendlyError(error.message) } : { ok: "Inscripció anul·lada." });
}

export async function checkIn(f: FormData) {
  await requireStaff();
  const eventId = str(f, "event_id");
  const token = str(f, "token");
  if (!/^[0-9a-f-]{36}$/i.test(token)) done(`/esdeveniments/${eventId}`, { error: "Codi no vàlid." });
  const supabase = await createClient();
  const { data, error } = await supabase.from("event_registrations")
    .update({ checked_in_at: new Date().toISOString() })
    .eq("event_id", eventId).eq("token", token).is("checked_in_at", null)
    .select("user_id");
  if (error) done(`/esdeveniments/${eventId}`, { error: friendlyError(error.message) });
  if (!data?.length) done(`/esdeveniments/${eventId}`, { error: "Entrada no trobada o ja validada." });
  done(`/esdeveniments/${eventId}`, { ok: "Entrada validada ✔" });
}

// ───────────── Membres ─────────────
export async function setStatus(f: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_status", { target: str(f, "id"), new_status: str(f, "status") });
  done("/admin", error ? { error: friendlyError(error.message) } : { ok: "Estat actualitzat." });
}

export async function setRole(f: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", { target: str(f, "id"), new_role: str(f, "role") });
  done("/admin", error ? { error: friendlyError(error.message) } : { ok: "Rol actualitzat." });
}

// ───────────── Canals i moderació ─────────────
export async function createChannel(f: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("channels").insert({
    slug: str(f, "slug").toLowerCase(), name: str(f, "name"),
    description: str(f, "description"), staff_only_post: f.get("staff_only_post") === "on",
  });
  done("/admin", error ? { error: friendlyError(error.message) } : { ok: "Canal creat." });
}

export async function resolveReport(f: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const messageId = str(f, "message_id");
  if (f.get("delete_message") === "on" && messageId) {
    const { error } = await supabase.from("messages").delete().eq("id", Number(messageId));
    if (error) done("/admin", { error: friendlyError(error.message) });
  }
  const { error } = await supabase.from("reports").update({ status: "resolt" }).eq("id", str(f, "id"));
  done("/admin", error ? { error: friendlyError(error.message) } : { ok: "Denúncia resolta." });
}

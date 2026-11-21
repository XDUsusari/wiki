"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requireMember, requireStaff } from "@/lib/auth";
import { friendlyError, MUNICIPIS_BARCELONES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { toIso } from "@/lib/time";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function done(path: string, error?: { message: string } | null, ok = "Fet"): never {
  revalidatePath(path);
  redirect(`${path}?${error ? `error=${encodeURIComponent(friendlyError(error.message))}` : `ok=${encodeURIComponent(ok)}`}`);
}

// ───────────── Voluntariat i campanyes ─────────────
export async function createCampaign(f: FormData) {
  const me = await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("campaigns").insert({
    title: str(f, "title"), description: str(f, "description"), comarca: str(f, "comarca") || null,
    starts_on: str(f, "starts_on"), ends_on: str(f, "ends_on"), created_by: me.id,
  });
  done("/voluntariat", error, "Campanya creada.");
}

export async function createShift(f: FormData) {
  await requireStaff();
  const campaignId = str(f, "campaign_id");
  const startsAt = toIso(str(f, "starts_at"));
  const endsAt = toIso(str(f, "ends_at"));
  const path = `/voluntariat/${campaignId}`;
  if (!startsAt || !endsAt) done(path, { message: "Dates no vàlides." });
  const supabase = await createClient();
  const { error } = await supabase.from("volunteer_shifts").insert({
    campaign_id: campaignId, title: str(f, "title"), location: str(f, "location"),
    starts_at: startsAt, ends_at: endsAt, slots: Math.max(1, parseInt(str(f, "slots"), 10) || 1),
  });
  done(path, error, "Torn afegit.");
}

export async function toggleShift(f: FormData) {
  const me = await requireMember();
  const shiftId = str(f, "shift_id");
  const path = `/voluntariat/${str(f, "campaign_id")}`;
  const supabase = await createClient();
  const { error } = f.get("joined") === "1"
    ? await supabase.from("shift_signups").delete().eq("shift_id", shiftId).eq("user_id", me.id)
    : await supabase.from("shift_signups").insert({ shift_id: shiftId, user_id: me.id });
  done(path, error, f.get("joined") === "1" ? "T'has desapuntat del torn." : "T'has apuntat al torn. Gràcies!");
}

// ───────────── Mapa ─────────────
export async function createMapPoint(f: FormData) {
  const me = await requireStaff();
  const municipality = str(f, "municipality");
  if (!(MUNICIPIS_BARCELONES as readonly string[]).includes(municipality)) done("/mapa", { message: "Municipi no vàlid." });
  const supabase = await createClient();
  const { error } = await supabase.from("map_points").insert({
    name: str(f, "name"), kind: str(f, "kind"), municipality, address: str(f, "address"),
    description: str(f, "description"), lat: Number(str(f, "lat")), lng: Number(str(f, "lng")), created_by: me.id,
  });
  done("/mapa", error, "Punt afegit al mapa.");
}

export async function deleteMapPoint(f: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("map_points").delete().eq("id", str(f, "id"));
  done("/mapa", error, "Punt esborrat.");
}

// ───────────── Formació ─────────────
export async function createCourse(f: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const { data, error } = await supabase.from("courses")
    .insert({ title: str(f, "title"), description: str(f, "description"), level: str(f, "level") || "Inicial" })
    .select("id").single();
  if (error) done("/formacio", error);
  done(`/formacio/${data.id}`, null, "Curs creat. Ara afegeix-hi lliçons.");
}

export async function createLesson(f: FormData) {
  await requireStaff();
  const courseId = str(f, "course_id");
  const supabase = await createClient();
  const { count } = await supabase.from("lessons").select("id", { count: "exact", head: true }).eq("course_id", courseId);
  const { error } = await supabase.from("lessons").insert({
    course_id: courseId, title: str(f, "title"), body: str(f, "body"),
    duration_min: parseInt(str(f, "duration_min"), 10) || null, position: (count ?? 0) + 1,
  });
  done(`/formacio/${courseId}`, error, "Lliçó afegida.");
}

export async function toggleLesson(f: FormData) {
  const me = await requireMember();
  const lessonId = str(f, "lesson_id");
  const path = `/formacio/${str(f, "course_id")}`;
  const supabase = await createClient();
  const { error } = f.get("done") === "1"
    ? await supabase.from("lesson_progress").delete().eq("lesson_id", lessonId).eq("user_id", me.id)
    : await supabase.from("lesson_progress").insert({ lesson_id: lessonId, user_id: me.id });
  revalidatePath(path);
  if (error) done(path, error);
  redirect(`${path}?lesson=${lessonId}`);
}

// ───────────── Enquestes i consultes ─────────────
export async function createPoll(f: FormData) {
  const me = await requireStaff();
  const options = str(f, "options").split("\n").map((o) => o.trim()).filter(Boolean);
  if (options.length < 2) done("/enquestes", { message: "Cal un mínim de 2 opcions (una per línia)." });
  const closesAt = toIso(str(f, "closes_at"));
  if (!closesAt) done("/enquestes", { message: "Data de tancament no vàlida." });
  const supabase = await createClient();
  const { data, error } = await supabase.from("polls")
    .insert({ question: str(f, "question"), description: str(f, "description"), closes_at: closesAt, created_by: me.id })
    .select("id").single();
  if (error) done("/enquestes", error);
  const { error: optErr } = await supabase.from("poll_options")
    .insert(options.slice(0, 10).map((label, i) => ({ poll_id: data.id, label, position: i })));
  done(`/enquestes/${data.id}`, optErr, "Consulta publicada.");
}

export async function vote(f: FormData) {
  const me = await requireMember();
  const pollId = str(f, "poll_id");
  const supabase = await createClient();
  const { error } = await supabase.from("poll_votes").insert({ poll_id: pollId, option_id: str(f, "option_id"), user_id: me.id });
  done(`/enquestes/${pollId}`, error?.message.includes("duplicate") ? { message: "Ja has votat en aquesta consulta." } : error,
    "Vot registrat. Gràcies per participar!");
}

// ───────────── Bústia de propostes ─────────────
export async function createProposal(f: FormData) {
  const me = await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.from("proposals").insert({
    author_id: me.id, title: str(f, "title"), body: str(f, "body"), category: str(f, "category") || "Altres",
  });
  done("/propostes", error, "Proposta enviada. La coordinació la revisarà.");
}

export async function toggleSupport(f: FormData) {
  const me = await requireMember();
  const id = str(f, "proposal_id");
  const supabase = await createClient();
  const { error } = f.get("on") === "1"
    ? await supabase.from("proposal_supports").delete().eq("proposal_id", id).eq("user_id", me.id)
    : await supabase.from("proposal_supports").insert({ proposal_id: id, user_id: me.id });
  revalidatePath("/propostes");
  if (error) done("/propostes", error);
  const back = str(f, "back");
  redirect(`${back.startsWith("/propostes?") ? back : "/propostes"}#p-${id}`);
}

export async function answerProposal(f: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.from("proposals")
    .update({ status: str(f, "status"), response: str(f, "response") || null }).eq("id", str(f, "id"));
  done("/propostes", error, "Resposta desada.");
}

// ───────────── Documents ─────────────
const ALLOWED_MIME = [
  "application/pdf", "image/png", "image/jpeg", "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export async function uploadDocument(f: FormData) {
  const me = await requireStaff();
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) done("/documents", { message: "Tria un fitxer." });
  if (file.size > 20 * 1024 * 1024) done("/documents", { message: "El fitxer supera els 20 MB." });
  if (!ALLOWED_MIME.includes(file.type)) done("/documents", { message: "Format no permès (PDF, Office, imatge o text)." });

  const safeName = file.name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `${randomUUID()}/${safeName}`;
  const supabase = await createClient();
  const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type });
  if (upErr) done("/documents", upErr);
  const { error } = await supabase.from("documents").insert({
    title: str(f, "title") || file.name, description: str(f, "description"), category: str(f, "category") || "General",
    file_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size, uploaded_by: me.id,
  });
  if (error) await supabase.storage.from("documents").remove([path]);
  done("/documents", error, "Document pujat.");
}

export async function deleteDocument(f: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const id = str(f, "id");
  const { data: doc } = await supabase.from("documents").select("file_path").eq("id", id).single();
  if (doc) await supabase.storage.from("documents").remove([doc.file_path]);
  const { error } = await supabase.from("documents").delete().eq("id", id);
  done("/documents", error, "Document esborrat.");
}

// ───────────── Directori ─────────────
export async function setResponsibility(f: FormData) {
  await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_responsibility", { target: str(f, "id"), value: str(f, "responsibility") });
  done("/directori", error, "Càrrec actualitzat.");
}

"use server";

import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { COMARQUES, friendlyError } from "@/lib/constants";

function back(path: string, error: string): never {
  redirect(`${path}?error=${encodeURIComponent(error)}`);
}

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/inici";
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // Missatge genèric: no revelem si el correu existeix
  if (error) console.error("[login] error d'autenticació:", error.status, error.code ?? "", error.message);
  if (error?.code === "email_not_confirmed") back("/login", "Encara no has confirmat el correu. Revisa la safata d'entrada.");
  if (error) back("/login", "Correu o contrasenya incorrectes.");
  redirect(safeNext(formData.get("next")));
}

function isAdult(birthdate: string) {
  const bd = new Date(birthdate + "T00:00:00Z");
  if (Number.isNaN(bd.getTime())) return false;
  const limit = new Date();
  limit.setUTCFullYear(limit.getUTCFullYear() - 18);
  return bd <= limit;
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("display_name") ?? "").trim();
  const birthdate = String(formData.get("birthdate") ?? "");
  const comarca = String(formData.get("comarca") ?? "");
  const privacy = formData.get("privacy") === "on";
  const rules = formData.get("rules") === "on";

  if (displayName.length < 2 || displayName.length > 60) back("/registre", "El nom ha de tenir entre 2 i 60 caràcters.");
  if (password.length < 10) back("/registre", "La contrasenya ha de tenir almenys 10 caràcters.");
  if (!isAdult(birthdate)) back("/registre", "Cal tenir 18 anys o més per registrar-se.");
  if (comarca && !(COMARQUES as readonly string[]).includes(comarca)) back("/registre", "Comarca no vàlida.");
  if (!privacy || !rules) back("/registre", "Cal acceptar la política de privacitat i les normes.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/confirm?next=/pendent`,
      data: {
        display_name: displayName,
        birthdate,
        comarca,
        privacy_accepted: privacy,
        rules_accepted: rules,
      },
    },
  });
  if (error) back("/registre", friendlyError(error.message));
  redirect("/login?ok=" + encodeURIComponent("Revisa el correu per confirmar el compte. Després un coordinador aprovarà l'accés."));
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/confirm?next=/canviar-contrasenya`,
  });
  // Sempre el mateix missatge: no revelem si el correu està registrat
  redirect("/recuperar?ok=" + encodeURIComponent("Si el correu està registrat, rebràs un enllaç en uns minuts."));
}

export async function changePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const password2 = String(formData.get("password2") ?? "");
  const path = "/canviar-contrasenya";
  if (password !== password2) back(path, "Les contrasenyes no coincideixen.");
  if (password.length < 12) back(path, "La contrasenya ha de tenir almenys 12 caràcters.");
  if (["root", "admin", "password", "contrasenya", "123456"].some((w) => password.toLowerCase().includes(w))) {
    back(path, "La contrasenya és massa fàcil d'endevinar.");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) back(path, friendlyError(error.message));

  // Només el servidor pot treure l'obligació de canviar la contrasenya
  await createAdminClient().from("profiles").update({ must_change_password: false }).eq("id", user.id);
  redirect("/inici");
}

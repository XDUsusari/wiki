import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Role = "membre" | "coordinador" | "admin";
export type Status = "pendent" | "actiu" | "suspes";

export type Profile = {
  id: string;
  display_name: string;
  comarca: string | null;
  bio: string | null;
  role: Role;
  status: Status;
  must_change_password: boolean;
  directory_visible: boolean;
  created_at: string;
};

export const PROFILE_COLUMNS = "id, display_name, comarca, bio, role, status, must_change_password, directory_visible, created_at";

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).single();
  return (data as Profile) ?? null;
});

/** Exigeix un membre aprovat (estat «actiu»). */
export async function requireMember(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.must_change_password) redirect("/canviar-contrasenya");
  if (profile.status !== "actiu") redirect("/pendent");
  return profile;
}

export function isStaff(p: Pick<Profile, "role">) {
  return p.role === "coordinador" || p.role === "admin";
}

export async function requireStaff(): Promise<Profile> {
  const profile = await requireMember();
  if (!isStaff(profile)) redirect("/inici");
  return profile;
}

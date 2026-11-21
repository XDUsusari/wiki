import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticat" }, { status: 401 });

  const [profile, registrations, messages] = await Promise.all([
    supabase.rpc("my_profile_export"),
    supabase.from("event_registrations").select("event_id, created_at, checked_in_at, events(title, starts_at)").eq("user_id", user.id),
    supabase.from("messages").select("id, body, created_at, channels(name)").eq("author_id", user.id).order("created_at"),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email, created_at: user.created_at },
    profile: profile.data,
    event_registrations: registrations.data ?? [],
    messages: messages.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="les-meves-dades.json"',
      "Cache-Control": "no-store",
    },
  });
}

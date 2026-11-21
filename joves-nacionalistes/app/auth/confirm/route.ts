import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Destinació dels enllaços que Supabase envia per correu
 * (confirmació de registre i recuperació de contrasenya).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/inici";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/inici";

  const supabase = await createClient();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  const url = new URL(ok ? next : "/login", request.url);
  if (!ok) url.searchParams.set("error", "L'enllaç no és vàlid o ha caducat. Torna-ho a provar.");
  return NextResponse.redirect(url);
}

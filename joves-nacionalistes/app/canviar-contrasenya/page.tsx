import { redirect } from "next/navigation";
import Alerts, { readAlerts, type SearchParams } from "@/components/Alerts";
import PasswordInput from "@/components/PasswordInput";
import { getCurrentProfile } from "@/lib/auth";
import { changePassword } from "../(auth)/actions";

export const metadata = { title: "Nova contrasenya" };

export default async function ChangePasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const { error } = await readAlerts(searchParams);

  return (
    <main className="container narrow">
      <a href="/" aria-label="Inici"><img className="auth-logo" src="/logo.png" alt="Joves Nacionalistes" width={720} height={518} /></a>
      <h1 style={{ marginTop: 16 }}>Nova contrasenya</h1>
      {profile.must_change_password && (
        <div className="alert error">Has d&apos;establir una contrasenya pròpia abans de continuar.</div>
      )}
      <Alerts error={error} />
      <form action={changePassword} className="card">
        <div className="field">
          <label htmlFor="password">Contrasenya nova (mínim 12 caràcters)</label>
          <PasswordInput id="password" name="password" minLength={12} autoComplete="new-password" required />
        </div>
        <div className="field">
          <label htmlFor="password2">Repeteix la contrasenya</label>
          <PasswordInput id="password2" name="password2" minLength={12} autoComplete="new-password" required />
        </div>
        <button type="submit">Desar</button>
      </form>
    </main>
  );
}

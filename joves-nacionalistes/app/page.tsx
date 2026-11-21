import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { APP_NAME } from "@/lib/constants";

export default async function Landing() {
  const profile = await getCurrentProfile();
  if (profile) redirect(profile.must_change_password ? "/canviar-contrasenya" : profile.status === "actiu" ? "/inici" : "/pendent");

  return (
    <main className="container">
      <section className="hero">
        <h1 style={{ margin: 0 }}>
          <img className="logo" src="/logo.png" alt={`${APP_NAME} · Intranet`} width={720} height={518} />
        </h1>
        <p className="muted" style={{ fontSize: "1.1rem", maxWidth: 560, margin: "24px auto 0" }}>
          Espai intern per a joves membres: notícies, agenda d&apos;activitats i fòrums per comarques.
          L&apos;accés requereix ser major d&apos;edat i l&apos;aprovació d&apos;un coordinador.
        </p>
        <div className="row" style={{ marginTop: 20 }}>
          <Link className="btn" href="/registre">Sol·licitar accés</Link>
          <Link className="btn secondary" href="/login">Entrar</Link>
        </div>
      </section>
      <footer className="footer muted">
        <Link href="/normes">Normes de la comunitat</Link> · <Link href="/privacitat">Privacitat</Link>
      </footer>
    </main>
  );
}

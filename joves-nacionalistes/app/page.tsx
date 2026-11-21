import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { APP_NAME } from "@/lib/constants";

export default async function Landing() {
  const profile = await getCurrentProfile();
  if (profile) redirect(profile.status === "actiu" ? "/inici" : "/pendent");

  return (
    <main className="container">
      <section className="hero">
        <span className="badge accent">Intranet privada</span>
        <h1 style={{ marginTop: 12 }}>{APP_NAME}</h1>
        <p className="muted" style={{ fontSize: "1.1rem", maxWidth: 560 }}>
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

import Link from "next/link";
import Alerts, { readAlerts, type SearchParams } from "@/components/Alerts";
import PasswordInput from "@/components/PasswordInput";
import { login } from "../actions";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { error, ok, next } = await readAlerts(searchParams);
  return (
    <main className="container narrow">
      <a href="/" aria-label="Inici"><img className="auth-logo" src="/logo.png" alt="Joves Nacionalistes" width={720} height={518} /></a>
      <h1 style={{ marginTop: 16 }}>Entrar</h1>
      <Alerts error={error} ok={ok} />
      <form action={login} className="card">
        <input type="hidden" name="next" value={next ?? ""} />
        <div className="field">
          <label htmlFor="email">Correu electrònic</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Contrasenya</label>
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </div>
        <div className="row spread">
          <button type="submit">Entrar</button>
          <Link href="/recuperar">Has oblidat la contrasenya?</Link>
        </div>
      </form>
      <p className="muted">Encara no tens compte? <Link href="/registre">Sol·licita l&apos;accés</Link></p>
    </main>
  );
}

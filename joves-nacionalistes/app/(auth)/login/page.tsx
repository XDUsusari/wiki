import Link from "next/link";
import Alerts, { readAlerts, type SearchParams } from "@/components/Alerts";
import { login } from "../actions";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { error, ok, next } = await readAlerts(searchParams);
  return (
    <main className="container narrow">
      <h1 style={{ marginTop: 32 }}>Entrar</h1>
      <Alerts error={error} ok={ok} />
      <form action={login} className="card">
        <input type="hidden" name="next" value={next ?? ""} />
        <div className="field">
          <label htmlFor="email">Correu electrònic</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Contrasenya</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button type="submit">Entrar</button>
      </form>
      <p className="muted">Encara no tens compte? <Link href="/registre">Sol·licita l&apos;accés</Link></p>
    </main>
  );
}

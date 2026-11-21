import Link from "next/link";
import Alerts, { readAlerts, type SearchParams } from "@/components/Alerts";
import { requestPasswordReset } from "../actions";

export const metadata = { title: "Recuperar la contrasenya" };

export default async function RecoverPage({ searchParams }: { searchParams: SearchParams }) {
  const { error, ok } = await readAlerts(searchParams);
  return (
    <main className="container narrow">
      <h1 style={{ marginTop: 32 }}>Recuperar la contrasenya</h1>
      <p className="muted">Et enviarem un enllaç per crear una contrasenya nova.</p>
      <Alerts error={error} ok={ok} />
      <form action={requestPasswordReset} className="card">
        <div className="field">
          <label htmlFor="email">Correu electrònic</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <button type="submit">Enviar l&apos;enllaç</button>
      </form>
      <p className="muted"><Link href="/login">← Tornar a entrar</Link></p>
    </main>
  );
}

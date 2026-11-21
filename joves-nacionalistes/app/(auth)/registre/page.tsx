import Link from "next/link";
import Alerts, { readAlerts, type SearchParams } from "@/components/Alerts";
import PasswordInput from "@/components/PasswordInput";
import { COMARQUES } from "@/lib/constants";
import { signup } from "../actions";

export const metadata = { title: "Sol·licitar accés" };

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await readAlerts(searchParams);
  const max = new Date();
  max.setFullYear(max.getFullYear() - 18);
  const maxDate = max.toISOString().slice(0, 10);

  return (
    <main className="container narrow">
      <h1 style={{ marginTop: 32 }}>Sol·licitar accés</h1>
      <p className="muted">Només per a majors de 18 anys. Un coordinador revisarà la teva sol·licitud.</p>
      <Alerts error={error} />
      <form action={signup} className="card">
        <div className="field">
          <label htmlFor="display_name">Nom o àlies</label>
          <input id="display_name" name="display_name" minLength={2} maxLength={60} required />
        </div>
        <div className="field">
          <label htmlFor="email">Correu electrònic</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Contrasenya (mínim 10 caràcters)</label>
          <PasswordInput id="password" name="password" minLength={10} autoComplete="new-password" required />
        </div>
        <div className="field">
          <label htmlFor="birthdate">Data de naixement</label>
          <input id="birthdate" name="birthdate" type="date" max={maxDate} required />
        </div>
        <div className="field">
          <label htmlFor="comarca">Comarca (opcional)</label>
          <select id="comarca" name="comarca" defaultValue="">
            <option value="">—</option>
            {COMARQUES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="check">
            <input type="checkbox" name="privacy" required />
            <span>
              He llegit la <Link href="/privacitat" target="_blank">política de privacitat</Link> i dono el meu
              consentiment explícit al tractament de les meves dades, incloent-hi la meva afinitat política.
            </span>
          </label>
        </div>
        <div className="field">
          <label className="check">
            <input type="checkbox" name="rules" required />
            <span>Accepto les <Link href="/normes" target="_blank">normes de la comunitat</Link>.</span>
          </label>
        </div>
        <button type="submit">Enviar sol·licitud</button>
      </form>
      <p className="muted">Ja tens compte? <Link href="/login">Entra</Link></p>
    </main>
  );
}

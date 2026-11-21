import Alerts, { readAlerts, type SearchParams } from "@/components/Alerts";
import { requireMember } from "@/lib/auth";
import { COMARQUES, formatDate } from "@/lib/constants";
import { deleteAccount, updateProfile } from "../actions";

export const metadata = { title: "Perfil" };

const ROLE_LABEL = { membre: "Membre", coordinador: "Coordinador/a", admin: "Administrador/a" };

export default async function ProfilePage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireMember();
  const { error, ok } = await readAlerts(searchParams);

  return (
    <div className="stack" style={{ maxWidth: 600 }}>
      <h1>👤 El meu perfil</h1>
      <Alerts error={error} ok={ok} />
      <p className="muted">{ROLE_LABEL[me.role]} · membre des del {formatDate(me.created_at, false)}</p>

      <form action={updateProfile} className="card">
        <div className="field">
          <label htmlFor="display_name">Nom o àlies</label>
          <input id="display_name" name="display_name" defaultValue={me.display_name} minLength={2} maxLength={60} required />
        </div>
        <div className="field">
          <label htmlFor="comarca">Comarca</label>
          <select id="comarca" name="comarca" defaultValue={me.comarca ?? ""}>
            <option value="">—</option>
            {COMARQUES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="bio">Sobre mi</label>
          <textarea id="bio" name="bio" defaultValue={me.bio ?? ""} maxLength={500} />
        </div>
        <label className="check field">
          <input type="checkbox" name="directory_visible" defaultChecked={me.directory_visible} />
          <span>Mostrar-me al directori de membres (nom, comarca i «sobre mi»)</span>
        </label>
        <button type="submit">Desar canvis</button>
      </form>

      <section className="card">
        <h2>Les meves dades</h2>
        <p className="muted">Descarrega una còpia de totes les dades que tenim sobre tu (RGPD, art. 15 i 20).</p>
        <a className="btn secondary" href="/perfil/exportar">Descarregar (JSON)</a>
      </section>

      <section className="card">
        <h2>Esborrar el compte</h2>
        <p className="muted">
          S&apos;eliminaran el perfil, els missatges i les inscripcions. Aquesta acció no es pot desfer.
          Escriu <strong>ESBORRAR</strong> per confirmar.
        </p>
        <form action={deleteAccount} className="row">
          <input name="confirm" required pattern="ESBORRAR" style={{ maxWidth: 200 }} aria-label="Confirmació" />
          <button className="danger" type="submit">Esborrar definitivament</button>
        </form>
      </section>
    </div>
  );
}

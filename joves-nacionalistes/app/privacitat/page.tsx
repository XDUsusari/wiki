import Link from "next/link";

export const metadata = { title: "Política de privacitat" };

export default function PrivacyPage() {
  return (
    <main className="container" style={{ maxWidth: 720 }}>
      <h1 style={{ marginTop: 32 }}>Política de privacitat</h1>
      <div className="alert error">
        PLANTILLA: cal que un professional del dret la revisi i completi abans de publicar l&apos;aplicació.
      </div>
      <div className="card stack">
        <h2>Responsable</h2>
        <p>[Nom de l&apos;entitat responsable] · [NIF] · [Adreça] · Contacte: [correu de protecció de dades]</p>

        <h2>Quines dades tractem</h2>
        <ul>
          <li>Nom o àlies, correu electrònic, data de naixement i comarca (opcional).</li>
          <li>Continguts que publiques (missatges) i inscripcions a esdeveniments.</li>
        </ul>
        <p>
          El fet de ser membre d&apos;aquesta intranet pot revelar la teva <strong>opinió política</strong>, que és una
          categoria especial de dades (art. 9 del RGPD). Només la tractem amb el teu <strong>consentiment explícit</strong>,
          que pots retirar en qualsevol moment esborrant el compte.
        </p>

        <h2>Per a què</h2>
        <p>Gestionar el teu accés a la intranet, la comunicació interna i les inscripcions a activitats. No fem perfils
          publicitaris ni venem dades.</p>

        <h2>Qui hi té accés</h2>
        <p>Els altres membres aprovats veuen el teu nom, comarca i biografia. La data de naixement només és visible per
          a tu. El proveïdor d&apos;allotjament ([proveïdor], servidors a la UE) actua com a encarregat del tractament.</p>

        <h2>Quant de temps</h2>
        <p>Mentre mantinguis el compte. Si l&apos;esborres, eliminem el perfil, els missatges i les inscripcions.</p>

        <h2>Els teus drets</h2>
        <p>Pots descarregar les teves dades i esborrar el compte des de la pàgina «Perfil». També pots exercir els drets
          d&apos;accés, rectificació, supressió, oposició, limitació i portabilitat escrivint a [correu], i reclamar davant
          l&apos;Autoritat Catalana de Protecció de Dades (apdcat.gencat.cat).</p>
      </div>
      <p><Link href="/">← Tornar</Link></p>
    </main>
  );
}

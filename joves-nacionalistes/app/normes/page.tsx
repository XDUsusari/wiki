import Link from "next/link";

export const metadata = { title: "Normes de la comunitat" };

export default function RulesPage() {
  return (
    <main className="container" style={{ maxWidth: 720 }}>
      <h1 style={{ marginTop: 32 }}>Normes de la comunitat</h1>
      <div className="card stack">
        <p>Aquesta és una intranet privada. Per mantenir-la un espai segur i útil, tots els membres es comprometen a:</p>
        <ol>
          <li><strong>Respecte.</strong> Debat d&apos;idees, mai atacs personals, insults ni assetjament.</li>
          <li><strong>Res d&apos;il·legal.</strong> Prohibit el discurs d&apos;odi, l&apos;amenaça o la incitació a la violència
            contra cap persona o col·lectiu, i qualsevol contingut que infringeixi la llei.</li>
          <li><strong>Privacitat.</strong> No comparteixis fora de la intranet dades, fotos ni missatges d&apos;altres membres
            sense el seu permís, ni publiquis dades personals de ningú.</li>
          <li><strong>Veracitat.</strong> No difonguis informacions que sàpigues falses.</li>
          <li><strong>Sense spam ni publicitat</strong> aliena a l&apos;organització.</li>
          <li><strong>Un compte per persona</strong>, amb dades reals d&apos;edat.</li>
        </ol>
        <p>
          Pots denunciar qualsevol missatge amb el botó «Denunciar». La coordinació pot esborrar continguts i
          suspendre comptes que incompleixin aquestes normes.
        </p>
      </div>
      <p><Link href="/">← Tornar</Link></p>
    </main>
  );
}

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";

export const metadata = { title: "Pendent d'aprovació" };

export default async function PendingPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.must_change_password) redirect("/canviar-contrasenya");
  if (profile.status === "actiu") redirect("/inici");

  return (
    <main className="container narrow">
      <div className="card" style={{ marginTop: 32 }}>
        {profile.status === "pendent" ? (
          <>
            <h1>Sol·licitud rebuda</h1>
            <p>Hola, {profile.display_name}. Un coordinador revisarà la teva sol·licitud aviat.</p>
          </>
        ) : (
          <>
            <h1>Compte suspès</h1>
            <p>El teu accés està suspès. Contacta amb la coordinació si creus que és un error.</p>
          </>
        )}
        <form action="/auth/sortir" method="post">
          <button className="secondary" type="submit">Sortir</button>
        </form>
      </div>
    </main>
  );
}

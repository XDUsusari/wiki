import Link from "next/link";
import { isStaff, requireMember } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMember();
  return (
    <>
      <header className="topbar">
        <div className="container">
          <Link href="/inici" className="brand">Joves <span>Nacionalistes</span></Link>
          <nav className="nav" aria-label="Principal">
            <Link href="/inici">Inici</Link>
            <Link href="/noticies">Notícies</Link>
            <Link href="/esdeveniments">Agenda</Link>
            <Link href="/forum">Fòrum</Link>
            <Link href="/perfil">Perfil</Link>
            {isStaff(me) && <Link href="/admin">Gestió</Link>}
          </nav>
          <form action="/auth/sortir" method="post">
            <button className="secondary small" type="submit">Sortir</button>
          </form>
        </div>
      </header>
      <main className="container">{children}</main>
    </>
  );
}

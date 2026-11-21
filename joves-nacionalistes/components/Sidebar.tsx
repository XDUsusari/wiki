"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Item = { href: string; icon: string; label: string };
type Group = { title: string; items: Item[] };

const GROUPS: Group[] = [
  {
    title: "Principal",
    items: [
      { href: "/inici", icon: "🏠", label: "Inici" },
      { href: "/anuncis", icon: "📢", label: "Taulell d'anuncis" },
      { href: "/esdeveniments", icon: "📅", label: "Agenda" },
    ],
  },
  {
    title: "Participa",
    items: [
      { href: "/voluntariat", icon: "🙋", label: "Voluntariat i campanyes" },
      { href: "/mapa", icon: "🗺️", label: "Mapa del Barcelonès" },
      { href: "/formacio", icon: "🎓", label: "Formació" },
      { href: "/forum", icon: "💬", label: "Fòrum" },
      { href: "/enquestes", icon: "🗳️", label: "Enquestes i consultes" },
      { href: "/propostes", icon: "💡", label: "Bústia de propostes" },
    ],
  },
  {
    title: "Recursos",
    items: [
      { href: "/documents", icon: "📁", label: "Documents" },
      { href: "/directori", icon: "📇", label: "Directori" },
    ],
  },
];

export default function Sidebar({ name, staff }: { name: string; staff: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const account: Item[] = [
    { href: "/perfil", icon: "👤", label: "El meu perfil" },
    ...(staff ? [{ href: "/admin", icon: "⚙️", label: "Gestió" }] : []),
  ];
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const renderGroup = (g: Group) => (
    <div key={g.title} className="side-group">
      <p className="side-title">{g.title}</p>
      {g.items.map((it) => (
        <Link key={it.href} href={it.href} className={`side-link${isActive(it.href) ? " active" : ""}`}
          aria-current={isActive(it.href) ? "page" : undefined}>
          <span className="side-icon" aria-hidden="true">{it.icon}</span>
          {it.label}
        </Link>
      ))}
    </div>
  );

  return (
    <>
      <header className="mobilebar">
        <button className="menu-btn" onClick={() => setOpen(true)} aria-label="Obrir el menú" aria-expanded={open}>
          <span /><span /><span />
        </button>
        <Link href="/inici" className="brand" aria-label="Inici">
          <img src="/logo-mark.png" alt="" width={72} height={30} />
          <span>Joves<br />Nacionalistes</span>
        </Link>
      </header>

      <div className={`scrim${open ? " show" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />

      <aside className={`sidebar${open ? " open" : ""}`} aria-label="Menú principal">
        <Link href="/inici" className="brand side-brand">
          <img src="/logo-mark.png" alt="" width={72} height={30} />
          <span>Joves<br />Nacionalistes</span>
        </Link>
        <nav>
          {GROUPS.map(renderGroup)}
          <div className="side-group">
            <p className="side-title">El meu compte</p>
            <div className="side-user">{name}</div>
            {account.map((it) => (
              <Link key={it.href} href={it.href} className={`side-link${isActive(it.href) ? " active" : ""}`}>
                <span className="side-icon" aria-hidden="true">{it.icon}</span>
                {it.label}
              </Link>
            ))}
            <form action="/auth/sortir" method="post">
              <button type="submit" className="side-link side-logout">
                <span className="side-icon" aria-hidden="true">🚪</span>Sortir
              </button>
            </form>
          </div>
        </nav>
      </aside>
    </>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLinks({ items }: { items: { href: string; label: string; icon: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Menú principal" style={{ display: 'contents' }}>
      {items.map((i) => {
        const active = i.href === '/' ? path === '/' : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined}>
            <span aria-hidden>{i.icon}</span>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

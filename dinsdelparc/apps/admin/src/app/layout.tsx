import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { getLocale } from '@/lib/i18n';
import { themeCss } from '@/lib/themeCss';
import './globals.css';

export const metadata: Metadata = {
  title: 'DinsDelParc · Administració',
  description: 'Panell d’administració de DinsDelParc (plataforma independent i no oficial).',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const theme = (await cookies()).get('ddp_theme')?.value;
  return (
    <html lang={locale} data-theme={theme === 'dark' || theme === 'light' ? theme : undefined}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

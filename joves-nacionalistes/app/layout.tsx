import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { APP_NAME } from "@/lib/constants";
import ServiceWorker from "@/components/ServiceWorker";

const brandFont = Montserrat({ subsets: ["latin"], weight: ["400", "600", "800"], variable: "--font-brand", display: "swap" });

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Intranet per a joves membres",
  applicationName: APP_NAME,
  icons: { icon: [{ url: "/favicon.png", type: "image/png" }, { url: "/icon-192.png", sizes: "192x192" }], apple: "/apple-touch-icon.png" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#002252",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca" className={brandFont.variable}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}

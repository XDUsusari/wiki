import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP_NAME } from "@/lib/constants";
import ServiceWorker from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Intranet per a joves membres",
  applicationName: APP_NAME,
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#1d3f8f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ca">
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}

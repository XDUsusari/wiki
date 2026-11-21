import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Joves Nacionalistes",
    short_name: "Joves",
    description: "Intranet per a joves membres",
    start_url: "/inici",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#1d3f8f",
    lang: "ca",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}

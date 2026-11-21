"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import boundaries from "@/lib/barcelones.geo.json";

export type MapPoint = {
  id: string; name: string; kind: string; municipality: string; address: string; description: string; lat: number; lng: number;
};

export const KIND_STYLE: Record<string, { color: string; icon: string; label: string }> = {
  seu: { color: "#002252", icon: "🏛️", label: "Seu" },
  punt_trobada: { color: "#1a7f37", icon: "📍", label: "Punt de trobada" },
  campanya: { color: "#c2410c", icon: "📣", label: "Campanya" },
  activitat: { color: "#6d28d9", icon: "📅", label: "Activitat" },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export default function BarcelonesMap({ points }: { points: MapPoint[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, { scrollWheelZoom: false, zoomSnap: 0.25 });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap · © CARTO · Límits: © IGN (CC BY 4.0)",
      }).addTo(map);

      const outline = L.geoJSON(boundaries as GeoJSON.FeatureCollection, {
        style: { color: "#002252", weight: 2, fillColor: "#002252", fillOpacity: 0.06 },
        onEachFeature: (f, layer) => layer.bindTooltip(String(f.properties?.name ?? ""), { sticky: true }),
      }).addTo(map);
      map.fitBounds(outline.getBounds(), { padding: [12, 12] });

      for (const p of points) {
        const st = KIND_STYLE[p.kind] ?? KIND_STYLE.activitat;
        const icon = L.divIcon({
          className: "",
          html: `<div class="pin" style="background:${st.color}"><span>${st.icon}</span></div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
          popupAnchor: [0, -28],
        });
        L.marker([p.lat, p.lng], { icon, title: p.name })
          .bindPopup(
            `<strong>${esc(p.name)}</strong><br><small>${esc(st.label)} · ${esc(p.municipality)}</small>` +
              (p.address ? `<br>${esc(p.address)}` : "") +
              (p.description ? `<p style="margin:6px 0 0">${esc(p.description)}</p>` : ""),
          )
          .addTo(map);
      }
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points]);

  return <div ref={ref} className="map" role="region" aria-label="Mapa del Barcelonès" />;
}

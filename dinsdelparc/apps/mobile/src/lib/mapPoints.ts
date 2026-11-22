import type { LocationRow, PoiKind } from '@dinsdelparc/shared';
import type { MapData } from '../services/content';

export type MapFilter = 'all' | 'attraction' | 'restaurant' | 'shop' | 'show' | 'service' | 'toilet' | 'first_aid';

export interface MapPoint {
  key: string;
  name: string;
  kind: PoiKind;
  parkId: string;
  route: string | null;
  location: LocationRow | null;
}

/**
 * Joins POIs with their published location. Points without verified
 * coordinates are kept (shown in a list), but never plotted at a guessed place.
 */
export function buildMapPoints(data: MapData): MapPoint[] {
  const loc = new Map(data.locations.map((l) => [l.id, l]));
  const used = new Set<string>();
  const points: MapPoint[] = [];
  const add = (kind: PoiKind, items: { id: string; name: string; location_id: string | null; park_id: string }[], route: (id: string) => string) => {
    for (const i of items) {
      const l = i.location_id ? loc.get(i.location_id) ?? null : null;
      if (l) used.add(l.id);
      points.push({ key: `${kind}-${i.id}`, name: i.name, kind, parkId: i.park_id, route: route(i.id), location: l });
    }
  };
  add('attraction', data.attractions, (id) => `/attraction/${id}`);
  add('restaurant', data.restaurants, (id) => `/venue/restaurant/${id}`);
  add('shop', data.shops, (id) => `/venue/shop/${id}`);
  add('show', data.shows, (id) => `/venue/show/${id}`);
  for (const s of data.services) {
    const l = s.location_id ? loc.get(s.location_id) ?? null : null;
    if (l) used.add(l.id);
    const kind: PoiKind = s.service_type === 'toilets' ? 'toilet' : s.service_type === 'first_aid' ? 'first_aid' : 'service';
    points.push({ key: `service-${s.id}`, name: s.name, kind, parkId: s.park_id, route: `/venue/service/${s.id}`, location: l });
  }
  // Standalone locations (toilets, entrances…) published without a linked venue.
  for (const l of data.locations) {
    if (!used.has(l.id)) points.push({ key: `loc-${l.id}`, name: l.name, kind: l.kind, parkId: l.park_id, route: null, location: l });
  }
  return points;
}

export function matchesFilter(p: MapPoint, f: MapFilter): boolean {
  if (f === 'all') return true;
  if (f === 'service') return p.kind === 'service' || p.kind === 'entrance' || p.kind === 'other';
  return p.kind === f;
}

export const hasCoords = (p: MapPoint) => p.location?.latitude != null && p.location?.longitude != null;

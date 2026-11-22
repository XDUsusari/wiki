import type { SearchResult } from '@dinsdelparc/shared';
import { localMatchScore } from '@dinsdelparc/shared';
import type { QueryClient } from '@tanstack/react-query';
import { supabase, unwrap } from '../lib/supabase';
import type { ParkBundle } from './content';

export async function searchAll(query: string, kinds: SearchResult['kind'][] | null): Promise<SearchResult[]> {
  return unwrap(await supabase.rpc('search_all', { p_query: query, p_kinds: kinds, p_limit: 40 })) as SearchResult[];
}

/** Offline fallback: searches reference content already cached on the device. */
export function searchCached(qc: QueryClient, query: string): SearchResult[] {
  const out: SearchResult[] = [];
  for (const [, bundle] of qc.getQueriesData<ParkBundle>({ queryKey: ['park'] })) {
    if (!bundle) continue;
    const push = (kind: SearchResult['kind'], id: string, title: string, slug: string | null) => {
      const score = localMatchScore(query, title);
      if (score > 0.4) out.push({ kind, id, title, subtitle: bundle.park.name, slug, park_slug: bundle.park.slug, score });
    };
    push('park', bundle.park.id, bundle.park.name, bundle.park.slug);
    bundle.areas.forEach((a) => push('area', a.id, a.name, a.slug));
    bundle.attractions.forEach((a) => push('attraction', a.id, a.name, a.slug));
    bundle.restaurants.forEach((a) => push('restaurant', a.id, a.name, a.slug));
    bundle.shops.forEach((a) => push('shop', a.id, a.name, a.slug));
    bundle.shows.forEach((a) => push('show', a.id, a.name, a.slug));
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 40);
}

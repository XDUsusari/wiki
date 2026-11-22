import { toDisplayWait, type AttractionLiveStatus, type DisplayWait } from '@dinsdelparc/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { isBackendConfigured } from '../lib/env';
import { fetchLiveStatus, fetchPublicSettings } from '../services/content';
import { addFavorite, fetchMyFavorites, removeFavorite, type FavoriteKind } from '../services/favorites';
import { fetchPlans, plansKey } from '../services/planner';
import { useAuth } from './useAuth';

/** Live status for every attraction, refreshed every minute while visible. */
export function useLiveStatus() {
  const q = useQuery({
    queryKey: ['live'],
    queryFn: fetchLiveStatus,
    enabled: isBackendConfigured,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const byId = useMemo(() => {
    const m = new Map<string, AttractionLiveStatus>();
    for (const r of q.data ?? []) m.set(r.attraction_id, r);
    return m;
  }, [q.data]);
  /** Always re-evaluates expiry at render time so cached data is never shown as current. */
  const waitFor = (id: string): DisplayWait => toDisplayWait(byId.get(id) ?? null);
  return { ...q, byId, waitFor };
}

export function usePublicSettings() {
  return useQuery({ queryKey: ['settings', 'public'], queryFn: fetchPublicSettings, enabled: isBackendConfigured, staleTime: 3_600_000 });
}

export function useFavorites() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['favorites', userId], queryFn: () => fetchMyFavorites(userId!), enabled: !!userId });
  const find = (kind: FavoriteKind, id: string) => q.data?.find((f) => f[`${kind}_id`] === id) ?? null;
  const toggle = useMutation({
    mutationFn: async ({ kind, id }: { kind: FavoriteKind; id: string }) => {
      const existing = find(kind, id);
      if (existing) await removeFavorite(existing.id);
      else await addFavorite({ kind, id });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['favorites', userId] }),
  });
  return { ...q, isFavorite: (kind: FavoriteKind, id: string) => !!find(kind, id), toggle };
}

export function usePlans() {
  const { userId } = useAuth();
  return useQuery({ queryKey: plansKey(userId), queryFn: fetchPlans, enabled: !!userId });
}

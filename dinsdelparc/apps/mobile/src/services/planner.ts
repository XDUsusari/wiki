import type { Itinerary, ItineraryItem } from '@dinsdelparc/shared';
import { onlineManager } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { supabase, unwrap } from '../lib/supabase';
import {
  foldOp,
  isLocalId,
  LOCAL_PREFIX,
  localId,
  newClientId,
  useOfflineQueue,
  type ItemDraft,
  type PlanDraft,
  type QueuedOp,
} from '../stores/offlineQueue';

export interface PlanWithItems {
  plan: Itinerary;
  items: ItineraryItem[];
}

export const plansKey = (userId: string | null) => ['plans', userId] as const;
export const planKey = (id: string) => ['plan', id] as const;

export async function fetchPlans(): Promise<Itinerary[]> {
  return unwrap(await supabase.from('itineraries').select('*').order('visit_date', { ascending: true, nullsFirst: false })) as Itinerary[];
}

export async function fetchPlan(id: string): Promise<PlanWithItems> {
  const [plan, items] = await Promise.all([
    supabase.from('itineraries').select('*').eq('id', id).single(),
    supabase.from('itinerary_items').select('*').eq('itinerary_id', id).order('position'),
  ]);
  return { plan: unwrap(plan) as Itinerary, items: unwrap(items) as ItineraryItem[] };
}

// ---------------------------------------------------------------------------
// Remote execution of an operation (idempotent thanks to client_id upserts)
// ---------------------------------------------------------------------------
async function resolvePlanId(planRef: string): Promise<string> {
  if (!isLocalId(planRef)) return planRef;
  const cid = planRef.slice(LOCAL_PREFIX.length);
  const row = unwrap(await supabase.from('itineraries').select('id').eq('client_id', cid).single()) as { id: string };
  return row.id;
}

async function resolveItemId(id: string): Promise<string | null> {
  if (!isLocalId(id)) return id;
  const cid = id.slice(LOCAL_PREFIX.length);
  const row = (await supabase.from('itinerary_items').select('id').eq('client_id', cid).maybeSingle()).data as { id: string } | null;
  return row?.id ?? null;
}

async function execute(op: QueuedOp, userId: string): Promise<void> {
  switch (op.kind) {
    case 'upsertPlan':
      unwrap(await supabase.from('itineraries').upsert({ ...op.plan, user_id: userId }, { onConflict: 'user_id,client_id' }));
      return;
    case 'updatePlan':
      unwrap(await supabase.from('itineraries').update(op.patch).eq('id', await resolvePlanId(op.id)));
      return;
    case 'deletePlan':
      unwrap(await supabase.from('itineraries').delete().eq('id', await resolvePlanId(op.id)));
      return;
    case 'upsertItem': {
      const itinerary_id = await resolvePlanId(op.planRef);
      unwrap(await supabase.from('itinerary_items').upsert({ ...op.item, itinerary_id }, { onConflict: 'itinerary_id,client_id' }));
      return;
    }
    case 'updateItem': {
      const id = await resolveItemId(op.id);
      if (id) unwrap(await supabase.from('itinerary_items').update(op.patch).eq('id', id));
      return;
    }
    case 'deleteItem': {
      const id = await resolveItemId(op.id);
      if (id) unwrap(await supabase.from('itinerary_items').delete().eq('id', id));
      return;
    }
  }
}

let flushing = false;
/** Sends queued offline changes in order. Stops at the first network failure. */
export async function flushPlannerQueue(userId: string | null): Promise<number> {
  if (!userId || flushing || !onlineManager.isOnline()) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (;;) {
      const [next, ...rest] = useOfflineQueue.getState().ops;
      if (!next) break;
      try {
        await execute(next, userId);
      } catch (e) {
        const msg = String((e as Error).message);
        if (msg.includes('Network') || msg.includes('fetch')) break; // retry later
        // Permanent error (e.g. deleted remotely): drop the op so the queue never blocks.
      }
      useOfflineQueue.getState().replace(rest);
      sent++;
    }
  } finally {
    flushing = false;
  }
  if (sent) await queryClient.invalidateQueries({ queryKey: ['plans'] });
  if (sent) await queryClient.invalidateQueries({ queryKey: ['plan'] });
  return sent;
}

/** Runs online, or queues + updates the cache optimistically when offline. */
async function run(op: QueuedOp, userId: string, optimistic: () => void): Promise<'synced' | 'queued'> {
  optimistic();
  if (onlineManager.isOnline() && useOfflineQueue.getState().ops.length === 0) {
    try {
      await execute(op, userId);
      return 'synced';
    } catch (e) {
      const msg = String((e as Error).message);
      if (!(msg.includes('Network') || msg.includes('fetch'))) {
        await queryClient.invalidateQueries({ queryKey: ['plans'] });
        await queryClient.invalidateQueries({ queryKey: ['plan'] });
        throw e;
      }
    }
  }
  useOfflineQueue.getState().replace(foldOp(useOfflineQueue.getState().ops, op));
  return 'queued';
}

function nowIso() {
  return new Date().toISOString();
}

function patchPlanCache(id: string, fn: (p: PlanWithItems) => PlanWithItems) {
  queryClient.setQueryData<PlanWithItems>(planKey(id), (old) => (old ? fn(old) : old));
}

// ---------------------------------------------------------------------------
// Public API used by screens
// ---------------------------------------------------------------------------
export async function createPlan(userId: string, input: Omit<PlanDraft, 'client_id'>) {
  const client_id = newClientId();
  const id = localId(client_id);
  const plan: Itinerary = {
    id,
    user_id: userId,
    ...input,
    client_id,
    preferences: {},
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  const result = await run({ kind: 'upsertPlan', plan: { client_id, ...input } }, userId, () => {
    queryClient.setQueryData<Itinerary[]>(plansKey(userId), (old) => [...(old ?? []), plan]);
    queryClient.setQueryData<PlanWithItems>(planKey(id), { plan, items: [] });
  });
  if (result === 'synced') {
    const row = unwrap(await supabase.from('itineraries').select('id').eq('client_id', client_id).single()) as { id: string };
    await queryClient.invalidateQueries({ queryKey: ['plans'] });
    return { id: row.id, result };
  }
  return { id, result };
}

export async function updatePlan(userId: string, id: string, patch: Partial<Omit<PlanDraft, 'client_id'>>) {
  return run({ kind: 'updatePlan', id, patch }, userId, () => {
    patchPlanCache(id, (p) => ({ ...p, plan: { ...p.plan, ...patch } }));
    queryClient.setQueryData<Itinerary[]>(plansKey(userId), (old) => old?.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  });
}

export async function deletePlan(userId: string, id: string) {
  return run({ kind: 'deletePlan', id }, userId, () => {
    queryClient.setQueryData<Itinerary[]>(plansKey(userId), (old) => old?.filter((p) => p.id !== id));
    queryClient.removeQueries({ queryKey: planKey(id) });
  });
}

export async function addPlanItem(userId: string, planId: string, draft: Omit<ItemDraft, 'client_id' | 'position'>) {
  const client_id = newClientId();
  const current = queryClient.getQueryData<PlanWithItems>(planKey(planId));
  const position = (current?.items.reduce((m, i) => Math.max(m, i.position), -1) ?? -1) + 1;
  const item: ItineraryItem = {
    id: localId(client_id),
    itinerary_id: planId,
    item_kind: draft.item_kind,
    attraction_id: draft.attraction_id ?? null,
    show_id: draft.show_id ?? null,
    restaurant_id: draft.restaurant_id ?? null,
    custom_title: draft.custom_title ?? null,
    priority: draft.priority,
    position,
    planned_time: null,
    is_completed: false,
    completed_at: null,
    notes: null,
    client_id,
  };
  const result = await run({ kind: 'upsertItem', planRef: planId, item: { ...draft, client_id, position } }, userId, () =>
    patchPlanCache(planId, (p) => ({ ...p, items: [...p.items, item] })),
  );
  if (result === 'synced') await queryClient.invalidateQueries({ queryKey: planKey(planId) });
  return result;
}

export async function updatePlanItem(userId: string, planId: string, itemId: string, patch: Partial<ItemDraft>) {
  const result = await run({ kind: 'updateItem', id: itemId, patch }, userId, () =>
    patchPlanCache(planId, (p) => ({
      ...p,
      items: p.items.map((i) =>
        i.id === itemId
          ? { ...i, ...patch, completed_at: patch.is_completed === undefined ? i.completed_at : patch.is_completed ? nowIso() : null }
          : i,
      ),
    })),
  );
  if (result === 'synced' && patch.is_completed) {
    // Completing activities can unlock achievements.
    await queryClient.invalidateQueries({ queryKey: ['me'] });
  }
  return result;
}

export async function deletePlanItem(userId: string, planId: string, itemId: string) {
  return run({ kind: 'deleteItem', id: itemId }, userId, () =>
    patchPlanCache(planId, (p) => ({ ...p, items: p.items.filter((i) => i.id !== itemId) })),
  );
}

/** Persists a new order (positions 0..n-1). */
export async function reorderPlanItems(userId: string, planId: string, orderedIds: string[]) {
  patchPlanCache(planId, (p) => ({
    ...p,
    items: orderedIds
      .map((id, position) => {
        const it = p.items.find((i) => i.id === id);
        return it ? { ...it, position } : null;
      })
      .filter((i): i is ItineraryItem => i !== null),
  }));
  for (const [position, id] of orderedIds.entries()) {
    await run({ kind: 'updateItem', id, patch: { position } }, userId, () => undefined);
  }
}

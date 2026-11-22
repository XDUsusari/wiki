import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type PlanDraft = {
  client_id: string;
  title: string;
  visit_date: string | null;
  party_size: number;
  park_ids: string[];
  notes: string | null;
};

export type ItemDraft = {
  client_id: string;
  item_kind: 'attraction' | 'show' | 'restaurant' | 'custom';
  attraction_id?: string | null;
  show_id?: string | null;
  restaurant_id?: string | null;
  custom_title?: string | null;
  priority: 'must' | 'want' | 'maybe';
  position: number;
  is_completed?: boolean;
};

export type QueuedOp =
  | { kind: 'upsertPlan'; plan: PlanDraft }
  | { kind: 'updatePlan'; id: string; patch: Partial<PlanDraft> }
  | { kind: 'deletePlan'; id: string }
  | { kind: 'upsertItem'; planRef: string; item: ItemDraft }
  | { kind: 'updateItem'; id: string; patch: Partial<ItemDraft> }
  | { kind: 'deleteItem'; id: string };

interface QueueState {
  ops: QueuedOp[];
  push: (op: QueuedOp) => void;
  replace: (ops: QueuedOp[]) => void;
  clear: () => void;
}

/** Planner changes made offline, persisted on the device until they sync. */
export const useOfflineQueue = create<QueueState>()(
  persist(
    (set) => ({
      ops: [],
      push: (op) => set((s) => ({ ops: [...s.ops, op] })),
      replace: (ops) => set({ ops }),
      clear: () => set({ ops: [] }),
    }),
    { name: 'dinsdelparc-offline-queue', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export const LOCAL_PREFIX = 'local:';
export const isLocalId = (id: string) => id.startsWith(LOCAL_PREFIX);
export const localId = (clientId: string) => `${LOCAL_PREFIX}${clientId}`;

export function newClientId(): string {
  // RFC 4122 v4 from Math.random — only used as an idempotency key, not a secret.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Folds an operation into the queue: edits to items/plans that only exist
 * locally are merged into their pending upsert instead of being queued.
 */
export function foldOp(ops: QueuedOp[], op: QueuedOp): QueuedOp[] {
  if ((op.kind === 'updateItem' || op.kind === 'deleteItem') && isLocalId(op.id)) {
    const cid = op.id.slice(LOCAL_PREFIX.length);
    if (op.kind === 'deleteItem') return ops.filter((o) => !(o.kind === 'upsertItem' && o.item.client_id === cid));
    return ops.map((o) => (o.kind === 'upsertItem' && o.item.client_id === cid ? { ...o, item: { ...o.item, ...op.patch } } : o));
  }
  if ((op.kind === 'updatePlan' || op.kind === 'deletePlan') && isLocalId(op.id)) {
    const cid = op.id.slice(LOCAL_PREFIX.length);
    if (op.kind === 'deletePlan') {
      return ops.filter(
        (o) => !(o.kind === 'upsertPlan' && o.plan.client_id === cid) && !(o.kind === 'upsertItem' && o.planRef === op.id),
      );
    }
    return ops.map((o) => (o.kind === 'upsertPlan' && o.plan.client_id === cid ? { ...o, plan: { ...o.plan, ...op.patch } } : o));
  }
  return [...ops, op];
}

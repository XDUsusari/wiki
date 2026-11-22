import { describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => undefined), removeItem: vi.fn(async () => undefined) },
}));

import { authErrorKey } from '../src/lib/authErrors';
import { buildMapPoints, hasCoords, matchesFilter } from '../src/lib/mapPoints';
import { foldOp, isLocalId, localId, newClientId, type QueuedOp } from '../src/stores/offlineQueue';
import type { MapData } from '../src/services/content';

describe('offline planner queue', () => {
  const plan: QueuedOp = { kind: 'upsertPlan', plan: { client_id: 'p1', title: 'Pla', visit_date: null, party_size: 2, park_ids: [], notes: null } };
  const item: QueuedOp = { kind: 'upsertItem', planRef: localId('p1'), item: { client_id: 'i1', item_kind: 'custom', custom_title: 'A', priority: 'want', position: 0 } };

  it('merges edits of local-only items into the pending upsert', () => {
    const ops = foldOp([plan, item], { kind: 'updateItem', id: localId('i1'), patch: { is_completed: true } });
    expect(ops).toHaveLength(2);
    expect(ops[1]).toMatchObject({ kind: 'upsertItem', item: { client_id: 'i1', is_completed: true } });
  });

  it('drops local-only items that are deleted before syncing', () => {
    expect(foldOp([plan, item], { kind: 'deleteItem', id: localId('i1') })).toEqual([plan]);
  });

  it('drops a local plan and its items when deleted offline', () => {
    expect(foldOp([plan, item], { kind: 'deletePlan', id: localId('p1') })).toEqual([]);
  });

  it('queues operations on server rows as-is', () => {
    const op: QueuedOp = { kind: 'updateItem', id: '7f6c1f9e-0000-4000-8000-000000000000', patch: { position: 3 } };
    expect(foldOp([plan], op)).toEqual([plan, op]);
  });

  it('generates RFC 4122 v4 idempotency keys', () => {
    const id = newClientId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(isLocalId(localId(id))).toBe(true);
    expect(isLocalId(id)).toBe(false);
  });
});

describe('map points', () => {
  const base = { park_id: 'pap', area_id: null, description_i18n: {}, is_published: true, data_origin: 'verified' as const, source_url: null, verified_at: null, verified_by: null, created_at: '', updated_at: '' };
  const data: MapData = {
    locations: [
      { ...base, id: 'l1', kind: 'attraction', name: 'Loc DK', latitude: 41.08, longitude: 1.15, coords_verified: true, coords_source: 'survey' },
      { ...base, id: 'l2', kind: 'toilet', name: 'Lavabos', latitude: 41.09, longitude: 1.16, coords_verified: false, coords_source: null },
    ],
    attractions: [
      { id: 'a1', name: 'Dragon Khan', location_id: 'l1', park_id: 'pap' },
      { id: 'a2', name: 'Shambhala', location_id: null, park_id: 'pap' },
    ],
    restaurants: [],
    shops: [],
    shows: [],
    services: [{ id: 's1', name: 'Primers auxilis', location_id: null, park_id: 'pap', service_type: 'first_aid' }],
  };

  it('never plots points without published coordinates', () => {
    const points = buildMapPoints(data);
    expect(points.filter(hasCoords).map((p) => p.name).sort()).toEqual(['Dragon Khan', 'Lavabos']);
    expect(points.find((p) => p.name === 'Shambhala')?.location).toBeNull();
  });

  it('maps services to specific kinds and filters', () => {
    const points = buildMapPoints(data);
    expect(points.find((p) => p.name === 'Primers auxilis')?.kind).toBe('first_aid');
    expect(points.filter((p) => matchesFilter(p, 'toilet')).map((p) => p.name)).toEqual(['Lavabos']);
    expect(points.filter((p) => matchesFilter(p, 'all'))).toHaveLength(4);
  });
});

describe('auth errors', () => {
  it('maps Supabase Auth messages', () => {
    expect(authErrorKey('Invalid login credentials')).toBe('errors.invalidCredentials');
    expect(authErrorKey('Email not confirmed')).toBe('errors.emailNotConfirmed');
    expect(authErrorKey('For security purposes, you can only request this after 60 seconds. Rate limit')).toBe('errors.rateLimited');
    expect(authErrorKey('weird')).toBe('errors.generic');
  });
});

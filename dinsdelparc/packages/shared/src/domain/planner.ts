import type { ItemPriority, ItineraryItemKind, OperationalStatus } from '../types/database';

/**
 * Visit organisation assistant.
 *
 * Honest by design: DinsDelParc has no verified walking times or ride
 * durations for most attractions, so the assistant proposes an ORDER, not a
 * timetable. Only shows with verified sessions get a clock time. Every step
 * says whether it is based on verified data, an estimate or a recommendation.
 */

export type StepBasis = 'verified' | 'estimate' | 'recommendation';

export interface PlannerCandidate {
  key: string;
  kind: ItineraryItemKind;
  name: string;
  parkId: string | null;
  areaId: string | null;
  /** Sort order of the themed area inside its park (layout proximity proxy). */
  areaOrder: number | null;
  priority: ItemPriority;
  status?: OperationalStatus;
  /** Current waiting time if a non-expired value exists (community or staff). */
  currentWaitMinutes?: number | null;
  /** Verified show sessions for the visit date, "HH:MM". */
  verifiedSessions?: string[];
}

export interface PlannerOptions {
  parkOrder: string[];
  /** Earliest time the group wants to watch shows from, "HH:MM". */
  arrivalTime?: string | null;
  includeMealBreak?: boolean;
}

export type StepReason =
  | 'mustDo'
  | 'sameArea'
  | 'lowerWaitNow'
  | 'verifiedSession'
  | 'noVerifiedSchedule'
  | 'closedNow'
  | 'mealBreak'
  | 'parkNotSelected';

export interface PlannedStep {
  key: string;
  position: number;
  parkId: string | null;
  suggestedTime: string | null;
  basis: StepBasis;
  reasons: StepReason[];
}

export interface PlanSuggestion {
  steps: PlannedStep[];
  warnings: ('noTimesAvailable' | 'closedItems' | 'itemsOutsideSelectedParks' | 'noVerifiedShowSchedules')[];
}

const PRIORITY_WEIGHT: Record<ItemPriority, number> = { must: 0, want: 1, maybe: 2 };

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function suggestPlan(candidates: PlannerCandidate[], options: PlannerOptions): PlanSuggestion {
  const warnings = new Set<PlanSuggestion['warnings'][number]>();
  const parkRank = new Map(options.parkOrder.map((id, i) => [id, i]));
  const closed = (c: PlannerCandidate) => c.status === 'temporarily_closed' || c.status === 'permanently_closed';

  const inParks = candidates.filter((c) => c.kind === 'custom' || c.parkId === null || parkRank.has(c.parkId));
  const outside = candidates.filter((c) => !inParks.includes(c));
  if (outside.length) warnings.add('itemsOutsideSelectedParks');

  const steps: PlannedStep[] = [];
  const parkIds = [...new Set(inParks.map((c) => c.parkId))].sort(
    (a, b) => (a === null ? 99 : parkRank.get(a) ?? 98) - (b === null ? 99 : parkRank.get(b) ?? 98),
  );

  let lastShowTime = options.arrivalTime ? toMinutes(options.arrivalTime) : 0;

  for (const parkId of parkIds) {
    const group = inParks.filter((c) => c.parkId === parkId);
    const rides = group
      .filter((c) => c.kind === 'attraction' && !closed(c))
      .sort((a, b) => {
        const area = (a.areaOrder ?? 999) - (b.areaOrder ?? 999);
        if (area !== 0) return area;
        const pr = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
        if (pr !== 0) return pr;
        return (a.currentWaitMinutes ?? 999) - (b.currentWaitMinutes ?? 999);
      });

    let previousArea: string | null | undefined;
    for (const r of rides) {
      const reasons: StepReason[] = [];
      if (r.priority === 'must') reasons.push('mustDo');
      if (previousArea !== undefined && previousArea === r.areaId && r.areaId !== null) reasons.push('sameArea');
      if (r.currentWaitMinutes != null) reasons.push('lowerWaitNow');
      previousArea = r.areaId;
      steps.push({
        key: r.key,
        position: 0,
        parkId,
        suggestedTime: null,
        basis: r.currentWaitMinutes != null ? 'estimate' : 'recommendation',
        reasons,
      });
    }

    // Restaurants: suggested around the middle of the park's sequence.
    const meals = group.filter((c) => c.kind === 'restaurant');
    if (meals.length) {
      const insertAt = Math.max(0, steps.length - Math.floor(rides.length / 2));
      steps.splice(
        insertAt,
        0,
        ...meals.map<PlannedStep>((m) => ({
          key: m.key,
          position: 0,
          parkId,
          suggestedTime: null,
          basis: 'recommendation',
          reasons: options.includeMealBreak === false ? [] : ['mealBreak'],
        })),
      );
    }

    // Shows: anchored to verified sessions when available.
    const shows = group.filter((c) => c.kind === 'show');
    for (const s of shows) {
      const session = (s.verifiedSessions ?? [])
        .map((t) => t.slice(0, 5))
        .sort()
        .find((t) => toMinutes(t) >= lastShowTime);
      if (session) {
        lastShowTime = toMinutes(session) + 1;
        steps.push({ key: s.key, position: 0, parkId, suggestedTime: session, basis: 'verified', reasons: ['verifiedSession'] });
      } else {
        warnings.add('noVerifiedShowSchedules');
        steps.push({ key: s.key, position: 0, parkId, suggestedTime: null, basis: 'recommendation', reasons: ['noVerifiedSchedule'] });
      }
    }

    // Custom items keep their relative order at the end of their park.
    for (const c of group.filter((x) => x.kind === 'custom')) {
      steps.push({ key: c.key, position: 0, parkId, suggestedTime: null, basis: 'recommendation', reasons: [] });
    }

    // Closed attractions are kept, but last and flagged.
    for (const c of group.filter((x) => x.kind === 'attraction' && closed(x))) {
      warnings.add('closedItems');
      steps.push({ key: c.key, position: 0, parkId, suggestedTime: null, basis: 'estimate', reasons: ['closedNow'] });
    }
  }

  for (const o of outside) {
    steps.push({ key: o.key, position: 0, parkId: o.parkId, suggestedTime: null, basis: 'recommendation', reasons: ['parkNotSelected'] });
  }

  // Shows with a verified time are placed chronologically relative to each other;
  // everything else keeps the proposed order.
  steps.forEach((s, i) => (s.position = i));
  if (!steps.some((s) => s.suggestedTime)) warnings.add('noTimesAvailable');

  return { steps, warnings: [...warnings] };
}

export interface PlanProgress {
  total: number;
  completed: number;
  ratio: number;
  nextKey: string | null;
}

export function planProgress(items: { key: string; isCompleted: boolean; position: number }[]): PlanProgress {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const completed = sorted.filter((i) => i.isCompleted).length;
  return {
    total: sorted.length,
    completed,
    ratio: sorted.length ? completed / sorted.length : 0,
    nextKey: sorted.find((i) => !i.isCompleted)?.key ?? null,
  };
}

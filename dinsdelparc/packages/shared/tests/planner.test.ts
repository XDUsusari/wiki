import { describe, expect, it } from 'vitest';
import { planProgress, suggestPlan, type PlannerCandidate } from '../src';

const PAP = 'pap';
const FL = 'fl';
const c = (over: Partial<PlannerCandidate> & { key: string }): PlannerCandidate => ({
  kind: 'attraction',
  name: over.key,
  parkId: PAP,
  areaId: null,
  areaOrder: null,
  priority: 'want',
  ...over,
});

describe('suggestPlan', () => {
  it('groups by park order and themed area, must-dos first inside an area', () => {
    const plan = suggestPlan(
      [
        c({ key: 'red-force', parkId: FL }),
        c({ key: 'stampida', areaId: 'fw', areaOrder: 6 }),
        c({ key: 'furius', areaId: 'med', areaOrder: 1 }),
        c({ key: 'shambhala', areaId: 'china', areaOrder: 3, priority: 'want' }),
        c({ key: 'dragon', areaId: 'china', areaOrder: 3, priority: 'must' }),
      ],
      { parkOrder: [PAP, FL] },
    );
    expect(plan.steps.map((s) => s.key)).toEqual(['furius', 'dragon', 'shambhala', 'stampida', 'red-force']);
    expect(plan.steps.find((s) => s.key === 'shambhala')?.reasons).toContain('sameArea');
    expect(plan.steps.find((s) => s.key === 'dragon')?.reasons).toContain('mustDo');
  });

  it('never invents times: only verified show sessions get a clock time', () => {
    const plan = suggestPlan(
      [c({ key: 'dragon' }), c({ key: 'show', kind: 'show', verifiedSessions: ['16:30:00', '12:00:00'] }), c({ key: 'show2', kind: 'show' })],
      { parkOrder: [PAP], arrivalTime: '13:00' },
    );
    const show = plan.steps.find((s) => s.key === 'show');
    expect(show).toMatchObject({ suggestedTime: '16:30', basis: 'verified' });
    expect(plan.steps.find((s) => s.key === 'dragon')?.suggestedTime).toBeNull();
    expect(plan.steps.find((s) => s.key === 'show2')).toMatchObject({ suggestedTime: null, basis: 'recommendation' });
    expect(plan.warnings).toContain('noVerifiedShowSchedules');
  });

  it('labels wait-based ordering as an estimate', () => {
    const plan = suggestPlan([c({ key: 'a', currentWaitMinutes: 40 }), c({ key: 'b', currentWaitMinutes: 5 })], { parkOrder: [PAP] });
    expect(plan.steps.map((s) => s.key)).toEqual(['b', 'a']);
    expect(plan.steps.every((s) => s.basis === 'estimate')).toBe(true);
    expect(plan.warnings).toContain('noTimesAvailable');
  });

  it('moves closed attractions to the end and warns', () => {
    const plan = suggestPlan([c({ key: 'closed', status: 'temporarily_closed', priority: 'must' }), c({ key: 'open' })], { parkOrder: [PAP] });
    expect(plan.steps.map((s) => s.key)).toEqual(['open', 'closed']);
    expect(plan.warnings).toContain('closedItems');
  });

  it('flags items from parks not in the plan', () => {
    const plan = suggestPlan([c({ key: 'x', parkId: 'caribe' })], { parkOrder: [PAP] });
    expect(plan.steps[0]?.reasons).toContain('parkNotSelected');
    expect(plan.warnings).toContain('itemsOutsideSelectedParks');
  });

  it('inserts meal breaks within the park sequence', () => {
    const plan = suggestPlan(
      [c({ key: 'a', areaOrder: 1 }), c({ key: 'b', areaOrder: 2 }), c({ key: 'c', areaOrder: 3 }), c({ key: 'r', kind: 'restaurant' })],
      { parkOrder: [PAP] },
    );
    const idx = plan.steps.findIndex((s) => s.key === 'r');
    expect(idx).toBeGreaterThan(0);
    expect(idx).toBeLessThan(plan.steps.length - 1);
  });
});

describe('planProgress', () => {
  it('computes progress and next item', () => {
    const p = planProgress([
      { key: 'a', isCompleted: true, position: 0 },
      { key: 'b', isCompleted: false, position: 1 },
      { key: 'c', isCompleted: false, position: 2 },
    ]);
    expect(p).toEqual({ total: 3, completed: 1, ratio: 1 / 3, nextKey: 'b' });
    expect(planProgress([])).toEqual({ total: 0, completed: 0, ratio: 0, nextKey: null });
  });
});

import type { AttractionLiveStatus, InfoSource, OperationalStatus } from '../types/database';

/** Must match public.wait_report_ttl() in the database. */
export const WAIT_REPORT_TTL_MINUTES = 45;
export const WAIT_REPORT_MIN = 0;
export const WAIT_REPORT_MAX = 300;
export const WAIT_REPORT_COOLDOWN_MINUTES = 10;

export type ReliabilityLevel = 'high' | 'medium' | 'low';
export type Freshness = 'fresh' | 'aging' | 'expired';

export function reliabilityLevel(reliability: number | null | undefined): ReliabilityLevel | null {
  if (reliability == null || Number.isNaN(reliability)) return null;
  if (reliability >= 0.75) return 'high';
  if (reliability >= 0.45) return 'medium';
  return 'low';
}

/**
 * Freshness of a value. Expired values must never be displayed as current:
 * callers should hide or explicitly label them.
 */
export function freshness(updatedAt: string | null, validUntil: string | null, now: Date = new Date()): Freshness {
  if (!updatedAt || !validUntil) return 'expired';
  const until = Date.parse(validUntil);
  if (Number.isNaN(until) || until <= now.getTime()) return 'expired';
  const ageMin = (now.getTime() - Date.parse(updatedAt)) / 60000;
  return ageMin > 20 ? 'aging' : 'fresh';
}

export interface DisplayWait {
  kind: 'closed' | 'wait' | 'none';
  status: OperationalStatus;
  minutes: number | null;
  source: InfoSource | null;
  reliability: ReliabilityLevel | null;
  freshness: Freshness;
  updatedAt: string | null;
  sampleSize: number;
}

/** Turns a live status row (possibly cached offline) into what the UI may show. */
export function toDisplayWait(live: AttractionLiveStatus | null | undefined, now: Date = new Date()): DisplayWait {
  const status: OperationalStatus = live?.status ?? 'unknown';
  if (status === 'temporarily_closed' || status === 'permanently_closed') {
    return {
      kind: 'closed',
      status,
      minutes: null,
      source: live?.status_source ?? null,
      reliability: null,
      freshness: 'fresh',
      updatedAt: live?.status_updated_at ?? null,
      sampleSize: 0,
    };
  }
  const fr = freshness(live?.wait_updated_at ?? null, live?.wait_valid_until ?? null, now);
  if (!live || live.wait_minutes == null || fr === 'expired') {
    return {
      kind: 'none',
      status,
      minutes: null,
      source: null,
      reliability: null,
      freshness: 'expired',
      updatedAt: null,
      sampleSize: 0,
    };
  }
  return {
    kind: 'wait',
    status,
    minutes: live.wait_minutes,
    source: live.wait_source,
    reliability: reliabilityLevel(live.wait_reliability),
    freshness: fr,
    updatedAt: live.wait_updated_at,
    sampleSize: live.wait_sample_size ?? 0,
  };
}

export type WaitInputError = 'not_integer' | 'out_of_range';

export function validateWaitMinutes(value: unknown): WaitInputError | null {
  const n = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof n !== 'number' || !Number.isInteger(n)) return 'not_integer';
  if (n < WAIT_REPORT_MIN || n > WAIT_REPORT_MAX) return 'out_of_range';
  return null;
}

/** Maps database error messages raised by validate_wait_report() to i18n keys. */
export function waitReportErrorKey(message: string | undefined): string {
  const m = message ?? '';
  if (m.includes('duplicate_report')) return 'errors.duplicateReport';
  if (m.includes('rate_limited')) return 'errors.rateLimited';
  if (m.includes('attraction_closed')) return 'errors.attractionClosed';
  if (m.includes('report_too_old') || m.includes('invalid_observed_at')) return 'errors.invalidTime';
  if (m.includes('row-level security') || m.includes('permission denied')) return 'errors.notAllowed';
  return 'errors.generic';
}

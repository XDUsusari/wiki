import { describe, expect, it } from 'vitest';
import {
  canActOn,
  checkImage,
  contrastRatio,
  darkColors,
  dbErrorKey,
  extractMentions,
  freshness,
  grantableRoles,
  highestRole,
  isFallback,
  levelForXp,
  levelProgress,
  lightColors,
  localMatchScore,
  normalizeText,
  parseOpenMeteo,
  permissionsFor,
  pickI18n,
  reliabilityLevel,
  safeExternalUrl,
  slugify,
  toDisplayWait,
  validateWaitMinutes,
  waitReportErrorKey,
  weatherKind,
  xpForLevel,
  type AttractionLiveStatus,
} from '../src';

const NOW = new Date('2026-07-15T12:00:00Z');
const live = (over: Partial<AttractionLiveStatus>): AttractionLiveStatus => ({
  attraction_id: 'a',
  park_id: 'p',
  area_id: null,
  status: 'open',
  status_note_i18n: null,
  status_source: null,
  status_updated_at: null,
  wait_minutes: 30,
  wait_source: 'community',
  wait_reliability: 0.6,
  wait_sample_size: 3,
  wait_updated_at: '2026-07-15T11:55:00Z',
  wait_valid_until: '2026-07-15T12:30:00Z',
  ...over,
});

describe('wait times', () => {
  it('classifies reliability', () => {
    expect(reliabilityLevel(0.9)).toBe('high');
    expect(reliabilityLevel(0.5)).toBe('medium');
    expect(reliabilityLevel(0.2)).toBe('low');
    expect(reliabilityLevel(null)).toBeNull();
  });

  it('never presents expired values as current', () => {
    expect(freshness('2026-07-15T11:00:00Z', '2026-07-15T11:45:00Z', NOW)).toBe('expired');
    const d = toDisplayWait(live({ wait_valid_until: '2026-07-15T11:59:00Z' }), NOW);
    expect(d.kind).toBe('none');
    expect(d.minutes).toBeNull();
  });

  it('marks aging values', () => {
    expect(freshness('2026-07-15T11:30:00Z', '2026-07-15T12:10:00Z', NOW)).toBe('aging');
    expect(freshness('2026-07-15T11:58:00Z', '2026-07-15T12:10:00Z', NOW)).toBe('fresh');
  });

  it('hides waits for closed attractions', () => {
    const d = toDisplayWait(live({ status: 'temporarily_closed' }), NOW);
    expect(d.kind).toBe('closed');
    expect(d.minutes).toBeNull();
  });

  it('returns source and reliability for current values', () => {
    const d = toDisplayWait(live({}), NOW);
    expect(d).toMatchObject({ kind: 'wait', minutes: 30, source: 'community', reliability: 'medium', sampleSize: 3 });
  });

  it('treats missing data as unknown', () => {
    expect(toDisplayWait(null, NOW)).toMatchObject({ kind: 'none', status: 'unknown' });
  });

  it('validates user input', () => {
    expect(validateWaitMinutes(25)).toBeNull();
    expect(validateWaitMinutes('25')).toBeNull();
    expect(validateWaitMinutes(301)).toBe('out_of_range');
    expect(validateWaitMinutes(-1)).toBe('out_of_range');
    expect(validateWaitMinutes(2.5)).toBe('not_integer');
    expect(validateWaitMinutes('abc')).toBe('not_integer');
  });

  it('maps database errors to translation keys', () => {
    expect(waitReportErrorKey('duplicate_report')).toBe('errors.duplicateReport');
    expect(waitReportErrorKey('rate_limited')).toBe('errors.rateLimited');
    expect(waitReportErrorKey('new row violates row-level security policy')).toBe('errors.notAllowed');
    expect(dbErrorKey('content_blocked')).toBe('errors.contentBlocked');
    expect(dbErrorKey('topic_locked')).toBe('errors.locked');
    expect(dbErrorKey('TypeError: Network request failed')).toBe('errors.network');
    expect(dbErrorKey(undefined)).toBe('errors.generic');
  });
});

describe('gamification', () => {
  it('matches the SQL level formula', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(49)).toBe(1);
    expect(levelForXp(50)).toBe(2);
    expect(levelForXp(200)).toBe(3);
    expect(levelForXp(4050)).toBe(10);
    expect(xpForLevel(3)).toBe(200);
  });

  it('computes progress inside a level', () => {
    const p = levelProgress(125);
    expect(p.level).toBe(2);
    expect(p.nextLevelXp).toBe(200);
    expect(p.remaining).toBe(75);
    expect(p.ratio).toBeCloseTo(0.5);
  });
});

describe('permissions mirror', () => {
  it('derives highest role and permissions', () => {
    expect(highestRole(['user', 'moderator', 'editor'])).toBe('moderator');
    expect(permissionsFor(['editor']).has('content.publish')).toBe(false);
    expect(permissionsFor(['content_manager']).has('content.publish')).toBe(true);
    expect(permissionsFor(['moderator']).has('users.manage_roles')).toBe(false);
  });

  it('only allows granting lower roles', () => {
    expect(grantableRoles(['admin'])).not.toContain('admin');
    expect(grantableRoles(['admin'])).toContain('moderator');
    expect(grantableRoles(['superadmin'])).toContain('superadmin');
    expect(canActOn(['moderator'], ['user'])).toBe(true);
    expect(canActOn(['moderator'], ['admin'])).toBe(false);
  });
});

describe('text helpers', () => {
  it('normalizes accents and case', () => {
    expect(normalizeText('México')).toBe('mexico');
    expect(normalizeText('Mediterrània')).toBe('mediterrania');
    expect(normalizeText('SésamoAventura')).toBe('sesamoaventura');
  });

  it('picks translations with fallback', () => {
    expect(pickI18n({ ca: 'Hola', es: 'Hola ES' }, 'es')).toBe('Hola ES');
    expect(pickI18n({ ca: 'Només català' }, 'en')).toBe('Només català');
    expect(isFallback({ ca: 'Només català' }, 'en')).toBe(true);
    expect(pickI18n({}, 'ca')).toBeNull();
  });

  it('scores local matches', () => {
    expect(localMatchScore('dragon', 'Dragon Khan')).toBeGreaterThan(localMatchScore('khan', 'Dragon Khan') - 0.2);
    expect(localMatchScore('mexico', 'México')).toBe(1);
    expect(localMatchScore('xyz', 'Dragon Khan')).toBe(0);
  });

  it('extracts mentions (max 5, deduplicated)', () => {
    expect(extractMentions('Hola @Anna i @anna, mira @pere_1!')).toEqual(['anna', 'pere_1']);
  });

  it('slugifies', () => {
    expect(slugify('El Diablo – Tren de la Mina')).toBe('el-diablo-tren-de-la-mina');
  });

  it('only allows https links', () => {
    expect(safeExternalUrl('https://example.org/a')).toBe('https://example.org/a');
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('http://example.org')).toBeNull();
    expect(safeExternalUrl('not a url')).toBeNull();
  });
});

describe('image validation', () => {
  it('rejects disallowed types and sizes', () => {
    expect(checkImage({ mimeType: 'image/jpeg', fileSize: 1000 }, 5000)).toBeNull();
    expect(checkImage({ mimeType: 'image/gif', fileSize: 1000 }, 5000)).toBe('validation.imageType');
    expect(checkImage({ mimeType: 'image/png', fileSize: 9000 }, 5000)).toBe('validation.imageSize');
    expect(checkImage({ mimeType: null }, 5000)).toBe('validation.imageType');
  });
});

describe('weather', () => {
  it('maps WMO codes', () => {
    expect(weatherKind(0)).toBe('clear');
    expect(weatherKind(63)).toBe('rainy');
    expect(weatherKind(95)).toBe('storm');
    expect(weatherKind(null)).toBeNull();
  });

  it('parses Open-Meteo responses defensively', () => {
    const w = parseOpenMeteo(
      { current: { temperature_2m: 24.6, weather_code: 1 }, daily: { temperature_2m_max: [28.2], temperature_2m_min: [19.9], precipitation_probability_max: [10] } },
      NOW,
    );
    expect(w).toMatchObject({ temperature: 25, max: 28, min: 20, rainProbability: 10, code: 1 });
    expect(parseOpenMeteo(null, NOW).temperature).toBeNull();
  });
});

describe('design tokens', () => {
  it('meets WCAG AA contrast for body text in both themes', () => {
    for (const c of [lightColors, darkColors]) {
      expect(contrastRatio(c.text, c.background)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(c.textMuted, c.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.interactive, c.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.brandOn, c.brand)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { CONTENT, CONTENT_TABLES } from '../src/lib/contentConfig';
import { adminErrorKey, inputValue, parseContentForm } from '../src/lib/forms';
import { visibleNav } from '../src/lib/nav';
import { permissionsFor, ca, flattenKeys } from '@dinsdelparc/shared';

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const PARK = '3f2b8c2e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';

describe('parseContentForm', () => {
  const fields = CONTENT.attractions.fields;

  it('builds a typed payload', () => {
    const { payload, errors } = parseContentForm(
      fields,
      fd({
        park_id: PARK,
        name: '  Atracció  ',
        slug: 'Atracció Nova!',
        attraction_type: 'family',
        'description_i18n.ca': 'Hola',
        'description_i18n.en': '',
        min_height_cm: '120',
        data_origin: 'pending_verification',
        is_published: 'on',
        source_url: 'https://example.org/x',
      }),
    );
    expect(errors).toEqual({});
    expect(payload).toMatchObject({
      park_id: PARK,
      name: 'Atracció',
      slug: 'atraccio-nova',
      attraction_type: 'family',
      description_i18n: { ca: 'Hola' },
      min_height_cm: 120,
      is_published: true,
      source_url: 'https://example.org/x',
      area_id: null,
      sort_order: 0,
    });
  });

  it('rejects invalid values', () => {
    const { errors } = parseContentForm(
      fields,
      fd({ park_id: 'not-a-uuid', name: '', slug: 'x', attraction_type: 'spaceship', min_height_cm: '12.5', source_url: 'javascript:alert(1)', data_origin: 'verified' }),
    );
    expect(errors).toMatchObject({
      park_id: 'validation.required',
      name: 'validation.required',
      attraction_type: 'validation.required',
      min_height_cm: 'validation.number',
      source_url: 'validation.required',
    });
  });

  it('enforces numeric ranges from the schema', () => {
    const { errors } = parseContentForm(fields, fd({ park_id: PARK, name: 'A', slug: 'a', attraction_type: 'other', data_origin: 'demo', min_height_cm: '20' }));
    expect(errors.min_height_cm).toBeDefined();
  });

  it('parses dates and times', () => {
    const { payload, errors } = parseContentForm(CONTENT.park_schedules.fields, fd({ park_id: PARK, schedule_date: '2027-06-01', opens_at: '10:00', closes_at: '19:00', data_origin: 'verified' }));
    expect(errors).toEqual({});
    expect(payload).toMatchObject({ schedule_date: '2027-06-01', opens_at: '10:00', is_closed: false });
    expect(inputValue({ name: 'opens_at', type: 'time' }, '10:00:00')).toBe('10:00');
  });
});

describe('content config', () => {
  it('has a translated label for every field of every table', () => {
    const keys = new Set(flattenKeys(ca));
    for (const tbl of CONTENT_TABLES) {
      expect(keys.has(CONTENT[tbl].label)).toBe(true);
      for (const f of CONTENT[tbl].fields) expect(keys.has(`admin.content.fields.${f.name}`), `${tbl}.${f.name}`).toBe(true);
    }
  });

  it('marks safety and schedule fields as sensitive', () => {
    const sensitive = (tbl: keyof typeof CONTENT, name: string) => CONTENT[tbl].fields.find((f) => f.name === name)?.sensitive;
    expect(sensitive('attractions', 'min_height_cm')).toBe(true);
    expect(sensitive('attractions', 'restrictions_i18n')).toBe(true);
    expect(sensitive('park_schedules', 'opens_at')).toBe(true);
    expect(sensitive('locations', 'latitude')).toBe(true);
  });
});

describe('admin helpers', () => {
  it('maps database errors', () => {
    expect(adminErrorKey('forbidden: content.publish required')).toBe('errors.notAllowed');
    expect(adminErrorKey('duplicate key value violates unique constraint')).toBe('errors.duplicate');
    expect(adminErrorKey('insufficient_rank')).toBe('errors.notAllowed');
  });

  it('filters the navigation by permission', () => {
    expect(visibleNav(permissionsFor(['editor'])).map((n) => n.href)).toEqual(['/', '/content']);
    expect(visibleNav(permissionsFor(['moderator'])).map((n) => n.href)).toEqual(['/', '/operations', '/moderation', '/reports', '/users', '/forum']);
    expect(visibleNav(permissionsFor(['admin'])).length).toBe(10);
    expect(visibleNav(permissionsFor(['user']))).toEqual([]);
  });
});

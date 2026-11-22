import { describe, expect, it } from 'vitest';
import { buildUserStoragePath, itinerarySchema, postSchema, signUpSchema, waitReportSchema } from '../src';

describe('validation schemas', () => {
  it('validates sign-up', () => {
    const ok = signUpSchema.safeParse({ email: 'a@b.cat', username: 'Visitant_1', password: 'abcdefgh12', acceptTerms: true });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.username).toBe('visitant_1');
    const bad = signUpSchema.safeParse({ email: 'nope', username: 'a', password: 'short', acceptTerms: false });
    expect(bad.success).toBe(false);
    const messages = bad.error?.issues.map((i) => i.message) ?? [];
    expect(messages).toEqual(expect.arrayContaining(['validation.email', 'validation.username', 'validation.acceptTerms']));
  });

  it('validates posts', () => {
    expect(postSchema.safeParse({ category: 'photos', body: '  Hola  ' }).success).toBe(true);
    expect(postSchema.safeParse({ category: 'photos', body: '   ' }).success).toBe(false);
    expect(postSchema.safeParse({ category: 'unknown', body: 'x' }).success).toBe(false);
  });

  it('validates wait reports', () => {
    expect(waitReportSchema.safeParse({ minutes: 20 }).success).toBe(true);
    expect(waitReportSchema.safeParse({ minutes: 301 }).error?.issues[0]?.message).toBe('validation.waitRange');
  });

  it('validates itineraries', () => {
    expect(itinerarySchema.safeParse({ title: 'Pla', visit_date: '2026-08-01', party_size: 4, park_ids: [], notes: null }).success).toBe(true);
    expect(itinerarySchema.safeParse({ title: 'Pla', visit_date: '01/08/2026', party_size: 4, park_ids: [], notes: null }).success).toBe(false);
    expect(itinerarySchema.safeParse({ title: 'Pla', visit_date: null, party_size: 0, park_ids: [], notes: null }).success).toBe(false);
  });

  it('builds storage paths accepted by the database constraint', () => {
    const uid = '3f2b8c2e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
    const path = buildUserStoragePath(uid, 'image/webp', 1700000000000);
    expect(path).toMatch(/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}\.(jpg|jpeg|png|webp)$/);
  });
});

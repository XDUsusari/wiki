import { describe, expect, it } from 'vitest';
import { ca, dictionaries, en, es, flattenKeys, getTranslator, LOCALES } from '../src';

describe('i18n', () => {
  const caKeys = flattenKeys(ca).sort();

  it.each(['es', 'en'] as const)('%s has exactly the same keys as Catalan', (locale) => {
    const keys = flattenKeys(dictionaries[locale]).sort();
    expect(keys).toEqual(caKeys);
  });

  it.each([['ca', ca], ['es', es], ['en', en]] as const)('%s has no empty strings', (_l, dict) => {
    const empty: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (typeof node === 'string') {
        if (!node.trim()) empty.push(path);
      } else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
      }
    };
    walk(dict, '');
    expect(empty).toEqual([]);
  });

  it('keeps interpolation placeholders consistent across languages', () => {
    const placeholders = (s: string) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort();
    const get = (dict: object, path: string): unknown =>
      path.split('.').reduce<unknown>((n, k) => (n as Record<string, unknown>)?.[k], dict);
    const mismatches: string[] = [];
    for (const key of caKeys) {
      const base = get(ca, key);
      for (const l of ['es', 'en'] as const) {
        const other = get(dictionaries[l], key);
        const a = typeof base === 'string' ? placeholders(base) : placeholders(JSON.stringify(base));
        const b = typeof other === 'string' ? placeholders(other) : placeholders(JSON.stringify(other));
        if (JSON.stringify(a) !== JSON.stringify(b)) mismatches.push(`${l}:${key}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('interpolates and pluralises', () => {
    const t = getTranslator('ca');
    expect(t('common.minutes', { count: 1 })).toBe('1 minut');
    expect(t('common.minutes', { count: 5 })).toBe('5 minuts');
    expect(t('greeting.named', { greeting: 'Bon dia', name: 'Anna' })).toBe('Bon dia, Anna');
    expect(getTranslator('en')('common.people', { count: 2 })).toBe('2 people');
  });

  it('defaults to Catalan as the first locale', () => {
    expect(LOCALES[0]).toBe('ca');
  });

  it('keeps the independence disclaimer in every language', () => {
    for (const l of LOCALES) {
      expect(getTranslator(l)('app.disclaimer')).toMatch(/PortAventura World/);
    }
  });
});

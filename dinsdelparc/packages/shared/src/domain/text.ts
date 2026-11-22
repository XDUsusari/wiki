import type { I18nText, Locale } from '../types/database';

export const LOCALES: readonly Locale[] = ['ca', 'es', 'en'] as const;
export const DEFAULT_LOCALE: Locale = 'ca';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** Picks a translated content field with the same fallback as SQL i18n(): ca → es → en. */
export function pickI18n(text: I18nText | null | undefined, locale: Locale): string | null {
  if (!text) return null;
  const order: Locale[] = [locale, 'ca', 'es', 'en'];
  for (const l of order) {
    const v = text[l];
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return null;
}

/** Whether the requested locale exists or a fallback language was used. */
export function isFallback(text: I18nText | null | undefined, locale: Locale): boolean {
  return !!text && !text[locale] && pickI18n(text, locale) !== null;
}

/** Lower-case, accent-free text (same idea as SQL normalize_text()). */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/·/g, '.')
    .toLowerCase()
    .trim();
}

/** Simple local relevance score used for offline search over cached data. */
export function localMatchScore(query: string, candidate: string): number {
  const q = normalizeText(query);
  const c = normalizeText(candidate);
  if (!q || !c) return 0;
  if (c === q) return 1;
  if (c.startsWith(q)) return 0.9;
  if (c.split(/[\s\-–]+/).some((w) => w.startsWith(q))) return 0.8;
  if (c.includes(q)) return 0.6;
  const tokens = q.split(/\s+/).filter(Boolean);
  const hits = tokens.filter((t) => c.includes(t)).length;
  return tokens.length ? (hits / tokens.length) * 0.5 : 0;
}

export function extractMentions(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/@([A-Za-z0-9_.]{3,24})/g)) {
    if (m[1]) found.add(m[1].toLowerCase());
    if (found.size >= 5) break;
  }
  return [...found];
}

/** Turns a free text into a URL slug (used by the admin panel). */
export function slugify(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

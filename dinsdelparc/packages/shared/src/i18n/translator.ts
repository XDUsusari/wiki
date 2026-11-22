import type { Locale } from '../types/database';

/** A translation leaf: plain text or a plural form selected with `count`. */
export type PluralLeaf = { one: string; other: string };
export type Leaf = string | PluralLeaf;
export interface Dict {
  [key: string]: Leaf | Dict;
}

/** Same keys as the source dictionary; every leaf must be translated. */
export type DictShape<T> = {
  [K in keyof T]: T[K] extends string ? string : T[K] extends PluralLeaf ? PluralLeaf : DictShape<T[K]>;
};

type IsLeaf<T> = T extends string ? true : T extends PluralLeaf ? true : false;

/** Dot-separated key paths that end in a leaf. */
export type KeyPath<T> = {
  [K in keyof T & string]: IsLeaf<T[K]> extends true ? K : `${K}.${KeyPath<T[K]>}`;
}[keyof T & string];

export type TranslateParams = Record<string, string | number | null | undefined>;

function lookup(dict: Dict, key: string): Leaf | undefined {
  let node: Leaf | Dict | undefined = dict;
  for (const part of key.split('.')) {
    if (node == null || typeof node === 'string' || 'one' in (node as object)) return undefined;
    node = (node as Dict)[part];
  }
  return node as Leaf | undefined;
}

function interpolate(text: string, params?: TranslateParams): string {
  if (!params) return text;
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
    const v = params[name];
    return v == null ? '' : String(v);
  });
}

export function createTranslator<T extends Dict>(dictionaries: Record<Locale, Dict>, locale: Locale, fallback: Locale = 'ca') {
  const plural = new Intl.PluralRules(locale);
  return function t(key: KeyPath<T>, params?: TranslateParams): string {
    const leaf = lookup(dictionaries[locale], key) ?? lookup(dictionaries[fallback], key);
    if (leaf == null) return key; // surfaced by the i18n completeness tests
    if (typeof leaf === 'string') return interpolate(leaf, params);
    const count = Number(params?.count ?? 0);
    const form = plural.select(count) === 'one' ? leaf.one : leaf.other;
    return interpolate(form, params);
  };
}

/** Flattens a dictionary to "a.b.c" keys (used by tests and tooling). */
export function flattenKeys(dict: Dict, prefix = ''): string[] {
  return Object.entries(dict).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string' || (typeof v === 'object' && 'one' in v && 'other' in v)) return [path];
    return flattenKeys(v as Dict, path);
  });
}

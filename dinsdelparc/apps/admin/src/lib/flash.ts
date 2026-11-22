import type { TFunction, TKey } from '@dinsdelparc/shared';

/** Translates a flash key coming from the URL, ignoring unknown keys. */
export function flashT(t: TFunction) {
  return (k: string) => {
    const v = t(k as TKey);
    return v === k ? t('errors.generic') : v;
  };
}

export function withFlash(path: string, kind: 'ok' | 'error', key: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}${kind}=${encodeURIComponent(key)}`;
}

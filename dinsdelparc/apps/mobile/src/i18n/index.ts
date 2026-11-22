import { getTranslator, type Locale, type TFunction } from '@dinsdelparc/shared';
import { useMemo } from 'react';
import { usePreferences } from '../stores/preferences';

const cache = new Map<Locale, TFunction>();
export function translatorFor(locale: Locale): TFunction {
  let t = cache.get(locale);
  if (!t) {
    t = getTranslator(locale);
    cache.set(locale, t);
  }
  return t;
}

/** Typed translation hook: t('home.planTitle'). Unknown keys fail type-checking. */
export function useT() {
  const locale = usePreferences((s) => s.locale);
  return useMemo(() => ({ t: translatorFor(locale), locale }), [locale]);
}

import type { Locale } from '../types/database';
import { ca, type Translations } from './ca';
import { en } from './en';
import { es } from './es';
import { createTranslator, type Dict, type KeyPath, type TranslateParams } from './translator';

export const dictionaries: Record<Locale, Dict> = { ca, es, en };
export type TKey = KeyPath<Translations>;
export type TFunction = (key: TKey, params?: TranslateParams) => string;

export function getTranslator(locale: Locale): TFunction {
  return createTranslator<Translations>(dictionaries, locale);
}

export const LANGUAGE_NAMES: Record<Locale, string> = { ca: 'Català', es: 'Español', en: 'English' };

export { ca, es, en };
export type { Translations, TranslateParams };

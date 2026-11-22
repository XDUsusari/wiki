import 'server-only';
import { getTranslator, isLocale, type Locale } from '@dinsdelparc/shared';
import { cookies } from 'next/headers';

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get('ddp_locale')?.value;
  return isLocale(v) ? v : 'ca';
}

export async function getT() {
  const locale = await getLocale();
  return { t: getTranslator(locale), locale };
}

import type { Locale } from './types/database';

const INTL_LOCALE: Record<Locale, string> = { ca: 'ca-ES', es: 'es-ES', en: 'en-GB' };
export const intlLocale = (l: Locale) => INTL_LOCALE[l];

export function formatRelativeTime(iso: string | null | undefined, locale: Locale, now: Date = new Date()): string {
  if (!iso) return '';
  const diffSec = Math.round((Date.parse(iso) - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: 'auto' });
  const abs = Math.abs(diffSec);
  if (abs < 45) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day');
  return formatDate(iso, locale);
}

export function formatDate(iso: string | null | undefined, locale: Locale, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return '';
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], opts ?? { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

export function formatLongToday(locale: Locale, now: Date = new Date()): string {
  const s = new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "HH:MM:SS" → "HH:MM" */
export function formatClock(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : '';
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function greetingKey(now: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const h = now.getHours();
  if (h >= 6 && h < 14) return 'morning';
  if (h >= 14 && h < 21) return 'afternoon';
  return 'evening';
}

export function formatDuration(seconds: number | null | undefined, locale: Locale): string {
  if (seconds == null) return '';
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min === 0) return new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'unit', unit: 'second' }).format(sec);
  const m = new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'unit', unit: 'minute' }).format(min);
  return sec ? `${m} ${new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'unit', unit: 'second' }).format(sec)}` : m;
}

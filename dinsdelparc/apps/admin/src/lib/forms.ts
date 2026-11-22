import { safeExternalUrl, slugify } from '@dinsdelparc/shared';
import type { FieldDef } from './contentConfig';

export type FieldErrors = Record<string, string>;
export type Payload = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Converts submitted FormData into a typed row payload according to the
 * table definition. Returns i18n error keys per field. The database enforces
 * the same constraints again (CHECKs, FKs, RLS).
 */
export function parseContentForm(fields: FieldDef[], form: FormData): { payload: Payload; errors: FieldErrors } {
  const payload: Payload = {};
  const errors: FieldErrors = {};
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === 'string' ? v.trim() : '';
  };

  for (const f of fields) {
    switch (f.type) {
      case 'boolean':
        payload[f.name] = form.get(f.name) === 'on' || form.get(f.name) === 'true';
        break;
      case 'i18n':
      case 'i18nLong': {
        const obj: Record<string, string> = {};
        for (const l of ['ca', 'es', 'en'] as const) {
          const v = str(`${f.name}.${l}`);
          if (v) obj[l] = v;
        }
        if (f.required && Object.keys(obj).length === 0) errors[f.name] = 'validation.required';
        payload[f.name] = obj;
        break;
      }
      case 'number':
      case 'decimal': {
        const raw = str(f.name).replace(',', '.');
        if (!raw) {
          if (f.required) errors[f.name] = 'validation.required';
          payload[f.name] = f.defaultValue ?? null;
          break;
        }
        const n = Number(raw);
        if (!Number.isFinite(n) || (f.type === 'number' && !Number.isInteger(n))) {
          errors[f.name] = 'validation.number';
          break;
        }
        if ((f.min != null && n < f.min) || (f.max != null && n > f.max)) {
          errors[f.name] = 'validation.tooLong';
          break;
        }
        payload[f.name] = n;
        break;
      }
      case 'url': {
        const raw = str(f.name);
        if (!raw) {
          if (f.required) errors[f.name] = 'validation.required';
          payload[f.name] = null;
          break;
        }
        const safe = safeExternalUrl(raw);
        if (!safe) errors[f.name] = 'validation.required';
        else payload[f.name] = safe;
        break;
      }
      case 'color': {
        const raw = str(f.name);
        if (!raw) {
          if (f.required) errors[f.name] = 'validation.required';
          payload[f.name] = null;
          break;
        }
        if (!/^#[0-9A-Fa-f]{6}$/.test(raw)) errors[f.name] = 'validation.required';
        else payload[f.name] = raw.toUpperCase();
        break;
      }
      case 'fk': {
        const raw = str(f.name);
        if (!raw) {
          if (f.required) errors[f.name] = 'validation.required';
          payload[f.name] = null;
          break;
        }
        if (!UUID.test(raw)) errors[f.name] = 'validation.required';
        else payload[f.name] = raw;
        break;
      }
      case 'select': {
        const raw = str(f.name);
        if (!raw) {
          if (f.required) errors[f.name] = 'validation.required';
          payload[f.name] = null;
          break;
        }
        if (f.options && !f.options.includes(raw)) errors[f.name] = 'validation.required';
        else payload[f.name] = raw;
        break;
      }
      case 'date': {
        const raw = str(f.name);
        if (!raw) {
          if (f.required) errors[f.name] = 'validation.required';
          payload[f.name] = null;
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) errors[f.name] = 'validation.date';
        else payload[f.name] = raw;
        break;
      }
      case 'time': {
        const raw = str(f.name);
        if (!raw) {
          if (f.required) errors[f.name] = 'validation.required';
          payload[f.name] = null;
        } else if (!/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) errors[f.name] = 'validation.required';
        else payload[f.name] = raw;
        break;
      }
      case 'datetime': {
        const raw = str(f.name);
        if (!raw) {
          if (f.required) errors[f.name] = 'validation.required';
          payload[f.name] = null;
          break;
        }
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) errors[f.name] = 'validation.date';
        else payload[f.name] = d.toISOString();
        break;
      }
      default: {
        const raw = str(f.name);
        if (!raw) {
          if (f.required) errors[f.name] = 'validation.required';
          payload[f.name] = null;
          break;
        }
        if (f.max && raw.length > f.max) {
          errors[f.name] = 'validation.tooLong';
          break;
        }
        if (f.name === 'target_id' && !UUID.test(raw)) {
          errors[f.name] = 'validation.required';
          break;
        }
        payload[f.name] = f.name === 'slug' ? slugify(raw) : raw;
      }
    }
  }
  return { payload, errors };
}

/** Value to pre-fill an input with (datetime-local needs "YYYY-MM-DDTHH:mm"). */
export function inputValue(f: FieldDef, value: unknown): string {
  if (value == null) return '';
  if (f.type === 'datetime') {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  if (f.type === 'time') return String(value).slice(0, 5);
  return String(value);
}

/** Maps Postgres errors returned by PostgREST to i18n keys for the admin UI. */
export function adminErrorKey(message: string | undefined): string {
  const m = message ?? '';
  if (m.includes('content.publish')) return 'errors.notAllowed';
  if (m.includes('duplicate key')) return 'errors.duplicate';
  if (m.includes('violates check constraint')) return 'validation.required';
  if (m.includes('violates foreign key')) return 'validation.required';
  if (m.includes('row-level security') || m.includes('permission denied') || m.includes('forbidden') || m.includes('insufficient_rank')) return 'errors.notAllowed';
  if (m.includes('rate_limited')) return 'errors.rateLimited';
  return 'errors.generic';
}

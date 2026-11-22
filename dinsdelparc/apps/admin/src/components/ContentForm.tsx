'use client';

import { useActionState } from 'react';
import type { FieldDef } from '@/lib/contentConfig';
import { inputValue } from '@/lib/forms';
import type { SaveState } from '@/app/(panel)/content/actions';

export interface ContentFormProps {
  action: (prev: SaveState, form: FormData) => Promise<SaveState>;
  fields: FieldDef[];
  values: Record<string, unknown>;
  labels: Record<string, string>;
  optionLabels: Record<string, string>;
  fkOptions: Record<string, { id: string; label: string }[]>;
  messages: Record<string, string>;
  saveLabel: string;
  sensitiveNote: string;
  i18nHint: string;
}

const LANGS = ['ca', 'es', 'en'] as const;

export function ContentForm(p: ContentFormProps) {
  const [state, formAction, pending] = useActionState(p.action, { errors: {}, formError: null });
  const msg = (k: string | null | undefined) => (k ? (p.messages[k] ?? k) : null);

  const field = (f: FieldDef) => {
    const id = `f-${f.name}`;
    const err = msg(state.errors[f.name]);
    const v = p.values[f.name];
    const label = `${p.labels[f.name] ?? f.name}${f.required ? ' *' : ''}`;
    const describedBy = err ? `${id}-err` : undefined;
    let control;
    switch (f.type) {
      case 'boolean':
        return (
          <div key={f.name}>
            <label className="checkbox" htmlFor={id}>
              <input id={id} type="checkbox" name={f.name} defaultChecked={Boolean(v)} />
              {label}
            </label>
          </div>
        );
      case 'i18n':
      case 'i18nLong': {
        const obj = (v ?? {}) as Record<string, string>;
        return (
          <fieldset key={f.name} className="fieldset" style={{ border: 'none', padding: 0 }}>
            <legend style={{ fontWeight: 600, fontSize: 13 }}>{label}</legend>
            <div className="i18n">
              {LANGS.map((l) => (
                <label key={l} style={{ fontWeight: 400 }}>
                  <span>{l.toUpperCase()}</span>
                  {f.type === 'i18nLong' ? (
                    <textarea name={`${f.name}.${l}`} defaultValue={obj[l] ?? ''} aria-label={`${label} (${l})`} />
                  ) : (
                    <input type="text" name={`${f.name}.${l}`} defaultValue={obj[l] ?? ''} aria-label={`${label} (${l})`} />
                  )}
                </label>
              ))}
            </div>
            {err ? <span className="error" id={describedBy}>{err}</span> : null}
          </fieldset>
        );
      }
      case 'select':
        control = (
          <select id={id} name={f.name} defaultValue={inputValue(f, v)} aria-describedby={describedBy} aria-invalid={!!err}>
            {!f.required ? <option value="">—</option> : null}
            {(f.options ?? []).map((o) => (
              <option key={o} value={o}>
                {p.optionLabels[`${f.name}.${o}`] ?? o}
              </option>
            ))}
          </select>
        );
        break;
      case 'fk':
        control = (
          <select id={id} name={f.name} defaultValue={inputValue(f, v)} aria-describedby={describedBy} aria-invalid={!!err}>
            <option value="">—</option>
            {(p.fkOptions[f.name] ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        );
        break;
      case 'textarea':
        control = <textarea id={id} name={f.name} defaultValue={inputValue(f, v)} aria-describedby={describedBy} />;
        break;
      default: {
        const type =
          f.type === 'number' ? 'number' : f.type === 'decimal' ? 'text' : f.type === 'url' ? 'url' : f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : f.type === 'datetime' ? 'datetime-local' : f.type === 'color' ? 'color' : 'text';
        control = (
          <input
            id={id}
            type={type}
            name={f.name}
            defaultValue={inputValue(f, v) || (f.type === 'color' ? '#1E88E5' : '')}
            min={f.type === 'number' ? f.min : undefined}
            max={f.type === 'number' ? f.max : undefined}
            inputMode={f.type === 'decimal' ? 'decimal' : undefined}
            maxLength={f.type === 'text' ? f.max : undefined}
            required={f.required && f.type !== 'color'}
            aria-describedby={describedBy}
            aria-invalid={!!err}
          />
        );
      }
    }
    return (
      <label key={f.name} htmlFor={id}>
        {label}
        {control}
        {err ? <span className="error" id={describedBy}>{err}</span> : null}
      </label>
    );
  };

  const normal = p.fields.filter((f) => !f.sensitive);
  const sensitive = p.fields.filter((f) => f.sensitive);
  return (
    <form action={formAction} className="stack card" noValidate>
      {state.formError ? (
        <p className="notice err" role="alert">
          {msg(state.formError)}
        </p>
      ) : null}
      {normal.map(field)}
      {sensitive.length ? (
        <div className="fieldset sensitive">
          <p className="small" style={{ margin: 0 }}>
            ⚠ {p.sensitiveNote}
          </p>
          {sensitive.map(field)}
        </div>
      ) : null}
      <p className="small muted">{p.i18nHint}</p>
      <div className="row">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? '…' : p.saveLabel}
        </button>
      </div>
    </form>
  );
}

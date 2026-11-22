import type { ReactNode } from 'react';

/** Flash message driven by ?ok=<i18n key> / ?error=<i18n key>. */
export function Flash({ ok, error, t }: { ok?: string; error?: string; t: (k: string) => string }) {
  if (error) return <p className="notice err" role="alert">{t(error)}</p>;
  if (ok) return <p className="notice ok" role="status">{t(ok)}</p>;
  return null;
}

export function Stat({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div className={`card stat${warn ? ' warn' : ''}`}>
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

export function Card({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      {title || actions ? (
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          {title ? <h2 style={{ margin: 0 }}>{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function OriginPill({ origin, label }: { origin: string; label: string }) {
  const cls = origin === 'verified' ? 'ok' : origin === 'pending_verification' ? 'warn' : 'info';
  return <span className={`pill ${cls}`}>{label}</span>;
}

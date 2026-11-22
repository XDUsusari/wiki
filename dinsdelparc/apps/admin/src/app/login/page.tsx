import { getT } from '@/lib/i18n';
import { signIn } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { t } = await getT();
  const { error } = await searchParams;
  return (
    <main className="login">
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#0A2F6B', border: '2px solid #FFB300', display: 'grid', placeItems: 'center', color: '#FFB300', fontWeight: 800 }} aria-hidden>
            ∩
          </div>
          <strong style={{ fontSize: 20 }}>DinsDelParc</strong>
        </div>
        <h1 style={{ fontSize: 22, marginBottom: 6 }}>{t('admin.signInTitle')}</h1>
        <p className="muted small">{t('admin.signInHint')}</p>
        {error ? (
          <p className="notice err" role="alert">
            {error === 'not_staff' ? t('admin.notStaff') : t('errors.invalidCredentials')}
          </p>
        ) : null}
        <form action={signIn} className="stack">
          <label>
            {t('auth.email')}
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <label>
            {t('auth.password')}
            <input type="password" name="password" autoComplete="current-password" required />
          </label>
          <button className="btn" type="submit">
            {t('auth.signIn')}
          </button>
        </form>
        <p className="muted small" style={{ marginTop: 16 }}>
          {t('app.disclaimer')}
        </p>
      </div>
    </main>
  );
}

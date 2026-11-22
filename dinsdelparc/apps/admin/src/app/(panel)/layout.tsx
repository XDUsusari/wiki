import type { ReactNode } from 'react';
import { LANGUAGE_NAMES, LOCALES } from '@dinsdelparc/shared';
import { NavLinks } from '@/components/NavLinks';
import { getStaff } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { visibleNav } from '@/lib/nav';
import { setPreference, signOut } from '../actions';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const staff = await getStaff();
  const { t, locale } = await getT();
  const items = visibleNav(staff.permissions).map((n) => ({ href: n.href, icon: n.icon, label: t(n.label) }));
  return (
    <div className="shell">
      <a className="skip" href="#main">
        {t('admin.skipToContent')}
      </a>
      <aside className="sidebar">
        <div className="brand">
          <div className="mark" aria-hidden>
            ∩
          </div>
          DinsDelParc
        </div>
        <NavLinks items={items} />
        <div className="foot">
          <div>{t('admin.loggedAs', { name: `@${staff.username}` })}</div>
          <div>{t(`admin.users.roleNames.${staff.topRole}`)}</div>
          <form action={setPreference} className="row">
            <input type="hidden" name="back" value="/" />
            <select name="locale" defaultValue={locale} aria-label={t('settings.language')} style={{ width: 'auto', minHeight: 30, padding: '2px 6px' }}>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {LANGUAGE_NAMES[l]}
                </option>
              ))}
            </select>
            <select name="theme" defaultValue="system" aria-label={t('settings.theme')} style={{ width: 'auto', minHeight: 30, padding: '2px 6px' }}>
              <option value="system">{t('settings.themeSystem')}</option>
              <option value="light">{t('settings.themeLight')}</option>
              <option value="dark">{t('settings.themeDark')}</option>
            </select>
            <button className="btn sm secondary" type="submit">
              {t('common.save')}
            </button>
          </form>
          <form action={signOut}>
            <button className="btn sm ghost" type="submit" style={{ color: 'inherit' }}>
              {t('admin.signOut')}
            </button>
          </form>
          <div style={{ fontSize: 11 }}>{t('app.disclaimer')}</div>
        </div>
      </aside>
      <main className="main" id="main">
        {children}
      </main>
    </div>
  );
}

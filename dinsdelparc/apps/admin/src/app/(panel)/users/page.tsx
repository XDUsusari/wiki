import { formatRelativeTime, highestRole, type AdminUserRow } from '@dinsdelparc/shared';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { requirePermission } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { getSupabase } from '@/lib/supabase/server';

export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requirePermission('users.view');
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  const { t, locale } = await getT();
  const supabase = await getSupabase();
  const { data } = await supabase.rpc('admin_list_users', { p_search: sp.q ?? null, p_limit: 50, p_offset: page * 50 });
  const users = (data ?? []) as AdminUserRow[];
  return (
    <div className="grid">
      <div className="topbar">
        <h1>{t('admin.nav.users')}</h1>
      </div>
      <form className="row" role="search">
        <input type="search" name="q" defaultValue={sp.q ?? ''} placeholder={t('admin.users.search')} aria-label={t('admin.users.search')} style={{ maxWidth: 360 }} />
        <button className="btn secondary">{t('common.search')}</button>
      </form>
      <Card>
        <table>
          <thead>
            <tr>
              <th>{t('profile.username')}</th>
              <th>{t('admin.users.email')}</th>
              <th>{t('admin.users.roles')}</th>
              <th>{t('admin.users.lastSignIn')}</th>
              <th>{t('profile.posts')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const suspended = u.suspended_until && Date.parse(u.suspended_until) > Date.now();
              return (
                <tr key={u.id}>
                  <td>
                    <strong>@{u.username}</strong>
                    <div className="small muted">{u.display_name}</div>
                  </td>
                  <td className="small">
                    {u.email} {u.email_confirmed ? <span className="pill ok">✓</span> : <span className="pill warn">{t('admin.users.verified')}?</span>}
                  </td>
                  <td>
                    <span className="pill info">{t(`admin.users.roleNames.${highestRole(u.roles)}`)}</span> {suspended ? <span className="pill err">{t('admin.users.suspend')}</span> : null}
                  </td>
                  <td className="small muted">{u.last_sign_in_at ? formatRelativeTime(u.last_sign_in_at, locale) : '—'}</td>
                  <td>{u.posts_count}</td>
                  <td>
                    <Link className="btn sm secondary" href={`/users/${u.id}`}>
                      {t('common.edit')}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="row" style={{ marginTop: 12 }}>
          {page > 0 ? <Link className="btn sm ghost" href={`/users?page=${page - 1}&q=${encodeURIComponent(sp.q ?? '')}`}>← {t('common.back')}</Link> : null}
          {users.length === 50 ? <Link className="btn sm ghost" href={`/users?page=${page + 1}&q=${encodeURIComponent(sp.q ?? '')}`}>{t('common.next')} →</Link> : null}
        </div>
      </Card>
    </div>
  );
}

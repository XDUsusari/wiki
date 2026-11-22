import { canActOn, formatDate, formatRelativeTime, grantableRoles, pickI18n, type AppRole, type Badge } from '@dinsdelparc/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, Flash } from '@/components/ui';
import { requirePermission } from '@/lib/auth';
import { flashT } from '@/lib/flash';
import { getT } from '@/lib/i18n';
import { getSupabase } from '@/lib/supabase/server';
import { awardBadge, setRole, suspend } from '../actions';

export default async function UserDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const staff = await requirePermission('users.view');
  const { id } = await params;
  const sp = await searchParams;
  const { t, locale } = await getT();
  const supabase = await getSupabase();
  const [{ data: profile }, { data: roles }, { data: mod }, { data: badges }, { data: mine }, { data: posts }, { data: reports }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
    supabase.from('user_roles').select('role,granted_at').eq('user_id', id),
    supabase.from('user_moderation').select('*').eq('user_id', id).maybeSingle(),
    supabase.from('badges').select('*').order('slug'),
    supabase.from('user_badges').select('badge_id').eq('user_id', id),
    supabase.from('posts').select('id,body,moderation_status,created_at').eq('author_id', id).order('created_at', { ascending: false }).limit(10),
    supabase.from('reports').select('id,reason,state,created_at').eq('target_type', 'profile').eq('target_id', id).limit(20),
  ]);
  if (!profile) notFound();
  const userRoles = (roles ?? []).map((r) => r.role as AppRole);
  const canAct = canActOn(staff.roles, userRoles) && staff.userId !== id;
  const grantable = grantableRoles(staff.roles);
  const has = new Set((mine ?? []).map((b) => b.badge_id as string));
  const suspended = mod?.suspended_until && Date.parse(mod.suspended_until) > Date.now();

  return (
    <div className="grid">
      <div className="topbar">
        <div>
          <p className="small">
            <Link href="/users">{t('admin.nav.users')}</Link>
          </p>
          <h1>@{profile.username}</h1>
          <p className="muted small">
            {profile.display_name} · {t('profile.memberSince', { date: formatDate(profile.created_at, locale) })} · {t('profile.level', { level: profile.level })} · {profile.xp} XP
          </p>
        </div>
      </div>
      <Flash ok={sp.ok} error={sp.error} t={flashT(t)} />
      <div className="grid two">
        <Card title={t('admin.users.roles')}>
          <div className="row" style={{ marginBottom: 10 }}>
            {userRoles.map((r) => (
              <span key={r} className="pill info">
                {t(`admin.users.roleNames.${r}`)}
              </span>
            ))}
          </div>
          {staff.permissions.has('users.manage_roles') && canAct ? (
            <table>
              <tbody>
                {grantable
                  .filter((r) => r !== 'user')
                  .map((r) => (
                    <tr key={r}>
                      <td>{t(`admin.users.roleNames.${r}`)}</td>
                      <td>
                        <form action={setRole}>
                          <input type="hidden" name="user_id" value={id} />
                          <input type="hidden" name="role" value={r} />
                          <input type="hidden" name="grant" value={userRoles.includes(r) ? 'false' : 'true'} />
                          <button className={`btn sm ${userRoles.includes(r) ? 'danger' : 'secondary'}`}>
                            {userRoles.includes(r) ? t('admin.users.revoke') : t('admin.users.grant')}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : null}
        </Card>
        <Card title={t('admin.users.suspend')}>
          {suspended ? (
            <p className="notice err">
              {t('admin.users.suspendUntil')}: {new Date(mod!.suspended_until!).toLocaleString(locale)} — {mod?.reason}
            </p>
          ) : null}
          {staff.permissions.has('users.suspend') && canAct ? (
            <form action={suspend} className="stack">
              <input type="hidden" name="user_id" value={id} />
              <label>
                {t('admin.users.suspendUntil')}
                <input type="datetime-local" name="until" />
              </label>
              <label>
                {t('admin.users.suspendReason')}
                <input type="text" name="reason" maxLength={1000} />
              </label>
              <div className="row">
                <button className="btn danger" name="reinstate" value="false">
                  {t('admin.users.suspend')}
                </button>
                {suspended ? (
                  <button className="btn secondary" name="reinstate" value="true">
                    {t('admin.users.reinstate')}
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <p className="muted small">{t('errors.notAllowed')}</p>
          )}
        </Card>
        {staff.permissions.has('badges.award') ? (
          <Card title={t('admin.users.badges')}>
            <table>
              <tbody>
                {((badges ?? []) as Badge[]).map((b) => (
                  <tr key={b.id}>
                    <td>{pickI18n(b.name_i18n, locale)}</td>
                    <td>
                      <form action={awardBadge}>
                        <input type="hidden" name="user_id" value={id} />
                        <input type="hidden" name="badge_id" value={b.id} />
                        <input type="hidden" name="award" value={has.has(b.id) ? 'false' : 'true'} />
                        <button className={`btn sm ${has.has(b.id) ? 'danger' : 'secondary'}`}>{has.has(b.id) ? t('admin.users.revoke') : t('admin.users.award')}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : null}
        <Card title={t('profile.activity')}>
          {(posts ?? []).map((p) => (
            <p key={p.id} className="small">
              <span className="pill">{p.moderation_status}</span> {String(p.body).slice(0, 140)} <span className="muted">· {formatRelativeTime(p.created_at, locale)}</span>
            </p>
          ))}
          {(reports ?? []).length ? (
            <p className="small">
              {t('admin.nav.reports')}: {(reports ?? []).length}
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

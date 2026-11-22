import type { DashboardStats } from '@dinsdelparc/shared';
import { formatRelativeTime } from '@dinsdelparc/shared';
import Link from 'next/link';
import { Card, Stat } from '@/components/ui';
import { getStaff } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { getSupabase } from '@/lib/supabase/server';

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const staff = await getStaff();
  const { t, locale } = await getT();
  const { error } = await searchParams;
  const supabase = await getSupabase();
  const { data, error: statsError } = await supabase.rpc('admin_dashboard_stats');
  const s = (data ?? null) as DashboardStats | null;
  const audit = staff.permissions.has('audit.view')
    ? (await supabase.from('audit_logs').select('id,action,entity_type,entity_id,created_at').order('created_at', { ascending: false }).limit(10)).data ?? []
    : [];
  const max = Math.max(1, ...(s?.activity_14d ?? []).map((d) => d.posts + d.replies + d.reports));

  const stats: { key: keyof DashboardStats; warn?: boolean; href?: string }[] = [
    { key: 'users_total' },
    { key: 'users_active_7d' },
    { key: 'users_new_7d' },
    { key: 'users_suspended' },
    { key: 'posts_total' },
    { key: 'comments_total' },
    { key: 'forum_topics_total' },
    { key: 'forum_replies_total' },
    { key: 'reports_open', warn: true, href: '/reports' },
    { key: 'pending_review_items', warn: true, href: '/moderation' },
    { key: 'attractions_total', href: '/content/attractions' },
    { key: 'attractions_pending_verification', warn: true, href: '/content/attractions' },
    { key: 'wait_reports_24h', href: '/operations' },
    { key: 'wait_reports_flagged', warn: true, href: '/operations' },
    { key: 'stale_schedules', warn: true, href: '/operations' },
  ];

  return (
    <div className="grid">
      <div className="topbar">
        <h1>{t('admin.nav.dashboard')}</h1>
      </div>
      {error === 'forbidden' ? <p className="notice err">{t('errors.notAllowed')}</p> : null}
      {statsError ? <p className="notice err">{t('errors.generic')}</p> : null}
      {s ? (
        <div className="grid stats">
          {stats.map((st) => {
            const v = Number(s[st.key] ?? 0);
            const node = <Stat label={t(`admin.stats.${st.key as 'users_total'}`)} value={v} warn={st.warn && v > 0} />;
            return st.href ? (
              <Link key={st.key} href={st.href} style={{ color: 'inherit' }}>
                {node}
              </Link>
            ) : (
              <div key={st.key}>{node}</div>
            );
          })}
        </div>
      ) : null}
      <div className="grid two">
        <Card title={t('admin.stats.activity')}>
          <div className="bars" role="img" aria-label={t('admin.stats.activity')}>
            {(s?.activity_14d ?? []).map((d) => {
              const total = d.posts + d.replies + d.reports;
              return (
                <div className="bar" key={d.day} title={`${d.day}: ${total}`}>
                  <span>{total}</span>
                  <div style={{ height: `${(total / max) * 110}px` }} />
                  <span>{d.day.slice(8, 10)}</span>
                </div>
              );
            })}
          </div>
        </Card>
        {audit.length ? (
          <Card title={t('admin.stats.recent')}>
            <table>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className="pill">{a.action}</span>
                    </td>
                    <td className="small">{a.entity_type}</td>
                    <td className="small muted">{formatRelativeTime(a.created_at, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="small">
              <Link href="/audit">{t('common.seeAll')}</Link>
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

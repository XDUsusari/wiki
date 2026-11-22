import { formatRelativeTime, type Report } from '@dinsdelparc/shared';
import Link from 'next/link';
import { ModerateButtons } from '@/components/ModerateButtons';
import { Card, Flash } from '@/components/ui';
import { requirePermission } from '@/lib/auth';
import { flashT } from '@/lib/flash';
import { getT } from '@/lib/i18n';
import { getSupabase } from '@/lib/supabase/server';
import { resolveReport } from '../moderation/actions';

const TABLE: Partial<Record<Report['target_type'], { table: string; text: string; status?: boolean }>> = {
  post: { table: 'posts', text: 'body', status: true },
  comment: { table: 'comments', text: 'body', status: true },
  forum_topic: { table: 'forum_topics', text: 'title', status: true },
  forum_reply: { table: 'forum_replies', text: 'body', status: true },
  review: { table: 'attraction_reviews', text: 'body', status: true },
  profile: { table: 'profiles', text: 'username' },
  attraction_info: { table: 'attractions', text: 'name' },
  park_info: { table: 'parks', text: 'name' },
  wait_report: { table: 'waiting_time_reports', text: 'minutes' },
};

export default async function Reports({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; state?: string }> }) {
  const staff = await requirePermission('reports.manage');
  const sp = await searchParams;
  const states = sp.state === 'closed' ? ['resolved', 'dismissed'] : ['open', 'reviewing'];
  const { t, locale } = await getT();
  const supabase = await getSupabase();
  const { data } = await supabase
    .from('reports')
    .select('*, reporter:profiles!reporter_id(username)')
    .in('state', states)
    .order('created_at', { ascending: sp.state !== 'closed' })
    .limit(100);
  const reports = (data ?? []) as (Report & { reporter: { username: string } | null })[];

  // Load a preview of every target.
  const previews = new Map<string, { text: string; status?: string }>();
  for (const [type, cfg] of Object.entries(TABLE)) {
    const ids = reports.filter((r) => r.target_type === type).map((r) => r.target_id);
    if (!ids.length || !cfg) continue;
    const cols = ['id', cfg.text, cfg.status ? 'moderation_status' : null].filter(Boolean).join(',');
    const { data: rows } = await supabase.from(cfg.table).select(cols).in('id', ids);
    for (const row of (rows ?? []) as unknown as Record<string, unknown>[]) {
      previews.set(`${type}:${row.id}`, { text: String(row[cfg.text] ?? ''), status: row.moderation_status as string | undefined });
    }
  }
  const labels = { hide: t('admin.moderation.hide'), restore: t('admin.moderation.restore'), remove: t('admin.moderation.remove'), note: t('admin.moderation.note') };
  const linkFor = (r: Report) =>
    r.target_type === 'attraction_info' ? `/content/attractions/${r.target_id}` : r.target_type === 'park_info' ? `/content/parks/${r.target_id}` : r.target_type === 'profile' ? `/users/${r.target_id}` : null;

  return (
    <div className="grid">
      <div className="topbar">
        <h1>{t('admin.nav.reports')}</h1>
      </div>
      <Flash ok={sp.ok} error={sp.error} t={flashT(t)} />
      <nav className="tabs">
        <a href="/reports" aria-current={sp.state !== 'closed' ? 'page' : undefined}>
          {t('admin.moderation.reportsOpen')}
        </a>
        <a href="/reports?state=closed" aria-current={sp.state === 'closed' ? 'page' : undefined}>
          {t('admin.moderation.states.resolved')} / {t('admin.moderation.states.dismissed')}
        </a>
      </nav>
      <Card>
        {!reports.length ? (
          <p className="muted">{t('admin.moderation.noReports')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('admin.moderation.target')}</th>
                <th>{t('report.reason')}</th>
                <th>{t('admin.moderation.reporter')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const p = previews.get(`${r.target_type}:${r.target_id}`);
                const link = linkFor(r);
                const moderatable = TABLE[r.target_type]?.status && staff.permissions.has('community.moderate');
                return (
                  <tr key={r.id}>
                    <td style={{ maxWidth: 420 }}>
                      <span className="pill info">{r.target_type}</span> <span className={`pill ${r.state === 'open' ? 'warn' : ''}`}>{t(`admin.moderation.states.${r.state}`)}</span>
                      <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{p ? p.text.slice(0, 400) : '—'}</div>
                      {link ? <Link href={link}>{t('common.edit')}</Link> : null}
                      {moderatable && p?.status ? (
                        <div style={{ marginTop: 6 }}>
                          <ModerateButtons target={r.target_type} id={r.target_id} current={p.status} back="/reports" labels={labels} />
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {t(`report.reasons.${r.reason}`)}
                      {r.details ? <div className="small muted" style={{ whiteSpace: 'pre-wrap' }}>{r.details}</div> : null}
                    </td>
                    <td className="small">
                      {r.reporter_id ? `@${r.reporter?.username ?? '—'}` : t('admin.moderation.system')}
                      <div className="muted">{formatRelativeTime(r.created_at, locale)}</div>
                    </td>
                    <td>
                      {r.state === 'open' || r.state === 'reviewing' ? (
                        <form action={resolveReport} className="stack" style={{ gap: 6 }}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="text" name="note" placeholder={t('admin.moderation.note')} aria-label={t('admin.moderation.note')} />
                          <div className="row">
                            {r.state === 'open' ? (
                              <button className="btn sm ghost" name="state" value="reviewing">
                                {t('admin.moderation.reviewing')}
                              </button>
                            ) : null}
                            <button className="btn sm" name="state" value="resolved">
                              {t('admin.moderation.resolve')}
                            </button>
                            <button className="btn sm secondary" name="state" value="dismissed">
                              {t('admin.moderation.dismiss')}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <span className="small muted">{r.resolution_note}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

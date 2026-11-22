import { formatRelativeTime, type AttractionLiveStatus } from '@dinsdelparc/shared';
import Link from 'next/link';
import { Card, Flash } from '@/components/ui';
import { requirePermission } from '@/lib/auth';
import { flashT } from '@/lib/flash';
import { getT } from '@/lib/i18n';
import { getSupabase } from '@/lib/supabase/server';
import { reviewReport, setStaffWait, setStatus } from './actions';

export default async function Operations({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const staff = await requirePermission('operations.validate');
  const canManage = staff.permissions.has('operations.manage');
  const sp = await searchParams;
  const { t, locale } = await getT();
  const supabase = await getSupabase();
  const [{ data: attractions }, { data: live }, { data: queue }, { data: stale }] = await Promise.all([
    supabase.from('attractions').select('id,name,park_id').order('name'),
    supabase.from('attraction_live_status').select('*'),
    supabase.from('waiting_time_reports').select('*').in('status', ['flagged', 'pending']).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(100),
    supabase.from('park_schedules').select('id,park_id,schedule_date').lt('schedule_date', new Date().toISOString().slice(0, 10)).eq('is_published', true).limit(50),
  ]);
  const liveMap = new Map(((live ?? []) as AttractionLiveStatus[]).map((l) => [l.attraction_id, l]));
  const name = new Map((attractions ?? []).map((a) => [a.id as string, a.name as string]));

  return (
    <div className="grid">
      <div className="topbar">
        <h1>{t('admin.nav.operations')}</h1>
      </div>
      <Flash ok={sp.ok} error={sp.error} t={flashT(t)} />
      <p className="notice warn">{t('home.liveDisclaimer')}</p>

      <Card title={t('admin.operations.queue')}>
        {!queue?.length ? (
          <p className="muted">{t('admin.operations.noQueue')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('admin.content.fields.attraction_id')}</th>
                <th>{t('attraction.waitNow')}</th>
                <th>{t('admin.audit.when')}</th>
                <th>{t('admin.operations.anomaly')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {queue.map((r) => (
                <tr key={r.id}>
                  <td>{name.get(r.attraction_id) ?? '—'}</td>
                  <td>{r.minutes} min</td>
                  <td className="small">{formatRelativeTime(r.observed_at, locale)}</td>
                  <td className="small">
                    <span className={`pill ${r.status === 'flagged' ? 'warn' : 'info'}`}>{r.status}</span> {r.anomaly_reason ?? ''}
                  </td>
                  <td className="row">
                    <form action={reviewReport}>
                      <input type="hidden" name="report_id" value={r.id} />
                      <input type="hidden" name="approve" value="true" />
                      <button className="btn sm secondary">{t('admin.operations.approve')}</button>
                    </form>
                    <form action={reviewReport}>
                      <input type="hidden" name="report_id" value={r.id} />
                      <input type="hidden" name="approve" value="false" />
                      <button className="btn sm danger">{t('admin.operations.reject')}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={t('admin.operations.statusTitle')}>
        <table>
          <thead>
            <tr>
              <th>{t('admin.content.fields.name')}</th>
              <th>{t('attraction.waitNow')}</th>
              {canManage ? <th>{t('admin.operations.setStatus')}</th> : null}
              {canManage ? <th>{t('admin.operations.staffWait')}</th> : null}
            </tr>
          </thead>
          <tbody>
            {(attractions ?? []).map((a) => {
              const l = liveMap.get(a.id as string);
              return (
                <tr key={a.id as string}>
                  <td>
                    <Link href={`/content/attractions/${a.id}`}>{a.name as string}</Link>
                    <div>
                      <span className={`pill ${l?.status === 'open' ? 'ok' : l?.status === 'unknown' || !l ? '' : 'warn'}`}>{t(`status.${l?.status ?? 'unknown'}`)}</span>
                    </div>
                  </td>
                  <td className="small">
                    {l?.wait_minutes != null ? `${l.wait_minutes} min · ${t(`source.${l.wait_source ?? 'community'}`)} · ${Math.round(Number(l.wait_reliability ?? 0) * 100)}%` : '—'}
                    {l?.wait_updated_at ? <div className="muted">{formatRelativeTime(l.wait_updated_at, locale)}</div> : null}
                  </td>
                  {canManage ? (
                    <td>
                      <form action={setStatus} className="row">
                        <input type="hidden" name="attraction_id" value={a.id as string} />
                        <select name="status" defaultValue={l?.status ?? 'unknown'} aria-label={t('admin.operations.setStatus')} style={{ maxWidth: 190 }}>
                          {(['open', 'temporarily_closed', 'permanently_closed', 'unknown'] as const).map((s) => (
                            <option key={s} value={s}>
                              {t(`status.${s}`)}
                            </option>
                          ))}
                        </select>
                        <input type="number" name="valid_hours" min={1} max={720} placeholder="h" aria-label={t('admin.operations.validHours')} style={{ width: 70 }} />
                        <input type="text" name="note" placeholder={t('admin.content.fields.note_i18n')} aria-label={t('admin.content.fields.note_i18n')} style={{ maxWidth: 180 }} />
                        <input type="url" name="source_url" placeholder="https://" aria-label={t('admin.content.fields.source_url')} style={{ maxWidth: 160 }} />
                        <button className="btn sm secondary">{t('common.save')}</button>
                      </form>
                    </td>
                  ) : null}
                  {canManage ? (
                    <td>
                      <form action={setStaffWait} className="row">
                        <input type="hidden" name="attraction_id" value={a.id as string} />
                        <input type="number" name="minutes" min={0} max={300} required placeholder="min" aria-label={t('attraction.waitNow')} style={{ width: 80 }} />
                        <input type="number" name="valid_minutes" min={5} max={180} defaultValue={30} aria-label={t('admin.operations.validMinutes')} style={{ width: 80 }} />
                        <button className="btn sm secondary">{t('common.save')}</button>
                      </form>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title={t('admin.operations.stale')}>
        <h3>{t('admin.operations.staleSchedules')}</h3>
        {!stale?.length ? (
          <p className="muted">{t('admin.content.empty')}</p>
        ) : (
          <ul>
            {stale.map((s) => (
              <li key={s.id}>
                <Link href={`/content/park_schedules/${s.id}`}>{s.schedule_date}</Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

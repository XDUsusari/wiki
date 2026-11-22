import Link from 'next/link';
import { Card } from '@/components/ui';
import { requirePermission } from '@/lib/auth';
import { getT } from '@/lib/i18n';
import { getSupabase } from '@/lib/supabase/server';

export default async function Audit({ searchParams }: { searchParams: Promise<{ page?: string; entity?: string }> }) {
  await requirePermission('audit.view');
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  const { t, locale } = await getT();
  const supabase = await getSupabase();
  let q = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).range(page * 50, page * 50 + 49);
  if (sp.entity) q = q.eq('entity_type', sp.entity);
  const { data } = await q;
  const actorIds = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length ? await supabase.from('profiles').select('id,username').in('id', actorIds) : { data: [] };
  const name = new Map((actors ?? []).map((a) => [a.id as string, a.username as string]));
  return (
    <div className="grid">
      <div className="topbar">
        <h1>{t('admin.nav.audit')}</h1>
      </div>
      <Card>
        <table>
          <thead>
            <tr>
              <th>{t('admin.audit.when')}</th>
              <th>{t('admin.audit.actor')}</th>
              <th>{t('admin.audit.action')}</th>
              <th>{t('admin.audit.entity')}</th>
              <th>{t('admin.audit.details')}</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id}>
                <td className="small">{new Date(r.created_at).toLocaleString(locale)}</td>
                <td className="small">{r.actor_id ? `@${name.get(r.actor_id) ?? r.actor_id.slice(0, 8)}` : 'system'}</td>
                <td>
                  <span className="pill">{r.action}</span>
                </td>
                <td className="small">
                  <Link href={`/audit?entity=${r.entity_type}`}>{r.entity_type}</Link>
                  <div className="muted">{r.entity_id}</div>
                </td>
                <td>
                  <details>
                    <summary className="small">JSON</summary>
                    <pre className="json">{JSON.stringify({ before: r.before_data, after: r.after_data, note: r.note }, null, 2)}</pre>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row" style={{ marginTop: 12 }}>
          {page > 0 ? <Link className="btn sm ghost" href={`/audit?page=${page - 1}`}>← {t('common.back')}</Link> : null}
          {(data ?? []).length === 50 ? <Link className="btn sm ghost" href={`/audit?page=${page + 1}`}>{t('common.next')} →</Link> : null}
        </div>
      </Card>
    </div>
  );
}

import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { CONTENT, CONTENT_TABLES } from '@/lib/contentConfig';
import { getT } from '@/lib/i18n';
import { getSupabase } from '@/lib/supabase/server';

export default async function ContentIndex() {
  await requirePermission('content.edit');
  const { t } = await getT();
  const supabase = await getSupabase();
  const counts = await Promise.all(
    CONTENT_TABLES.map(async (tbl) => {
      const [{ count: total }, { count: pending }] = await Promise.all([
        supabase.from(tbl).select('id', { count: 'exact', head: true }),
        supabase.from(tbl).select('id', { count: 'exact', head: true }).neq('data_origin', 'verified'),
      ]);
      return { tbl, total: total ?? 0, pending: pending ?? 0 };
    }),
  );
  return (
    <div className="grid">
      <div className="topbar">
        <h1>{t('admin.nav.content')}</h1>
      </div>
      <p className="notice warn">{t('admin.content.verificationNote')}</p>
      <div className="grid stats">
        {counts.map((c) => (
          <Link key={c.tbl} href={`/content/${c.tbl}`} className="card" style={{ color: 'inherit' }}>
            <h3>{t(CONTENT[c.tbl].label)}</h3>
            <div className="small muted">
              {c.total} · <span className={c.pending ? 'pill warn' : 'pill ok'}>{t('origin.pending_verification')}: {c.pending}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

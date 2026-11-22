import { pickI18n, type I18nText } from '@dinsdelparc/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Flash, OriginPill } from '@/components/ui';
import { requirePermission } from '@/lib/auth';
import { CONTENT, isContentTable } from '@/lib/contentConfig';
import { flashT } from '@/lib/flash';
import { getT } from '@/lib/i18n';
import { getSupabase } from '@/lib/supabase/server';

export default async function ContentList({
  params,
  searchParams,
}: {
  params: Promise<{ table: string }>;
  searchParams: Promise<{ q?: string; origin?: string; ok?: string; error?: string }>;
}) {
  const { table } = await params;
  if (!isContentTable(table)) notFound();
  await requirePermission('content.edit');
  const sp = await searchParams;
  const { t, locale } = await getT();
  const def = CONTENT[table];
  const supabase = await getSupabase();
  let q = supabase.from(table).select('*').order(def.orderBy, { ascending: def.orderBy !== 'starts_at' }).limit(300);
  if (sp.origin) q = q.eq('data_origin', sp.origin);
  if (sp.q && def.titleField === 'name') q = q.ilike('name', `%${sp.q.replace(/[%_]/g, '')}%`);
  const { data: rows } = await q;
  const { data: parks } = await supabase.from('parks').select('id,name');
  const parkName = new Map((parks ?? []).map((p) => [p.id as string, p.name as string]));

  const cell = (row: Record<string, unknown>, f: string) => {
    const v = row[f];
    if (f === 'data_origin') return <OriginPill origin={String(v)} label={t(`origin.${v as 'verified'}`)} />;
    if (f === 'is_published' || f === 'coords_verified' || f === 'is_closed') return v ? <span className="pill ok">✓</span> : <span className="pill">—</span>;
    if (f === 'park_id') return parkName.get(String(v)) ?? '—';
    if (f.endsWith('_i18n')) return pickI18n(v as I18nText, locale) ?? '—';
    if (v == null || v === '') return '—';
    if (f === 'starts_at') return new Date(String(v)).toLocaleString(locale);
    return String(v);
  };

  return (
    <div className="grid">
      <div className="topbar">
        <div>
          <p className="small">
            <Link href="/content">{t('admin.nav.content')}</Link>
          </p>
          <h1>{t(def.label)}</h1>
        </div>
        <Link className="btn" href={`/content/${table}/new`}>
          + {t('admin.content.new')}
        </Link>
      </div>
      <Flash ok={sp.ok} error={sp.error} t={flashT(t)} />
      <form className="row" role="search">
        {def.titleField === 'name' ? <input type="search" name="q" defaultValue={sp.q ?? ''} placeholder={t('admin.content.filter')} aria-label={t('admin.content.filter')} style={{ maxWidth: 280 }} /> : null}
        <select name="origin" defaultValue={sp.origin ?? ''} aria-label={t('admin.content.fields.data_origin')} style={{ maxWidth: 240 }}>
          <option value="">{t('search.all')}</option>
          {(['verified', 'pending_verification', 'demo', 'community'] as const).map((o) => (
            <option key={o} value={o}>
              {t(`origin.${o}`)}
            </option>
          ))}
        </select>
        <button className="btn secondary" type="submit">
          {t('common.search')}
        </button>
      </form>
      <div className="card" style={{ overflowX: 'auto' }}>
        {!rows?.length ? (
          <p className="muted">{t('admin.content.empty')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                {def.listFields.map((f) => (
                  <th key={f} scope="col">
                    {t(`admin.content.fields.${f as 'name'}`)}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id as string}>
                  {def.listFields.map((f) => (
                    <td key={f}>{cell(r as Record<string, unknown>, f)}</td>
                  ))}
                  <td>
                    <Link className="btn sm secondary" href={`/content/${table}/${r.id}`}>
                      {t('common.edit')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

import { flattenKeys, getTranslator, ca, pickI18n, type I18nText, type TKey } from '@dinsdelparc/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfirmSubmit } from '@/components/ConfirmSubmit';
import { ContentForm } from '@/components/ContentForm';
import { Flash } from '@/components/ui';
import { getStaff, requirePermission } from '@/lib/auth';
import { CONTENT, isContentTable } from '@/lib/contentConfig';
import { flashT } from '@/lib/flash';
import { getT } from '@/lib/i18n';
import { getSupabase } from '@/lib/supabase/server';
import { deleteContent, saveContent } from '../../actions';

const OPTION_KEYS: Record<string, (v: string) => string> = {
  attraction_type: (v) => `attraction.types.${v}`,
  intensity: (v) => `attraction.intensities.${v}`,
  data_origin: (v) => `origin.${v}`,
  service_type: (v) => `venue.serviceTypes.${v}`,
  kind: (v) => `search.kinds.${v}`,
};

export default async function ContentEdit({
  params,
  searchParams,
}: {
  params: Promise<{ table: string; id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { table, id } = await params;
  if (!isContentTable(table)) notFound();
  const def = CONTENT[table];
  await requirePermission('content.edit');
  const staff = await getStaff();
  const sp = await searchParams;
  const { t, locale } = await getT();
  const supabase = await getSupabase();
  const isNew = id === 'new';
  const row = isNew ? null : (await supabase.from(table).select('*').eq('id', id).maybeSingle()).data;
  if (!isNew && !row) notFound();

  // Foreign key options
  const fkOptions: Record<string, { id: string; label: string }[]> = {};
  for (const f of def.fields.filter((x) => x.type === 'fk')) {
    const { data } = await supabase.from(f.ref!).select(f.ref === 'locations' ? 'id,name,kind' : 'id,name').order('name').limit(1000);
    fkOptions[f.name] = ((data ?? []) as unknown as { id: string; name: string }[]).map((r) => ({ id: r.id, label: r.name }));
  }

  const labels = Object.fromEntries(def.fields.map((f) => [f.name, t(`admin.content.fields.${f.name}` as TKey)]));
  const known = new Set(flattenKeys(ca));
  const optionLabels: Record<string, string> = {};
  for (const f of def.fields.filter((x) => x.type === 'select')) {
    for (const o of f.options ?? []) {
      const key = OPTION_KEYS[f.name]?.(o);
      optionLabels[`${f.name}.${o}`] = key && known.has(key) ? getTranslator(locale)(key as TKey) : o;
    }
  }
  const messages = Object.fromEntries(
    [...flattenKeys(ca)].filter((k) => k.startsWith('validation.') || k.startsWith('errors.')).map((k) => [k, t(k as TKey)]),
  );

  const title = row ? (def.titleField.endsWith('_i18n') ? pickI18n(row[def.titleField] as I18nText, locale) : String(row[def.titleField] ?? '')) : t('admin.content.creating');
  const action = saveContent.bind(null, table, isNew ? null : id);

  return (
    <div className="grid">
      <div className="topbar">
        <div>
          <p className="small">
            <Link href="/content">{t('admin.nav.content')}</Link> › <Link href={`/content/${table}`}>{t(def.label)}</Link>
          </p>
          <h1>{title}</h1>
          {row ? (
            <p className="small muted">
              {row.verified_at ? `${t('origin.verified')}: ${new Date(String(row.verified_at)).toLocaleString(locale)}` : t('origin.pendingHint')}
            </p>
          ) : null}
        </div>
        {!isNew && staff.permissions.has('content.delete') ? (
          <form action={deleteContent.bind(null, table, id)}>
            <ConfirmSubmit label={t('common.delete')} confirm={t('admin.content.deleteConfirm')} className="btn danger" />
          </form>
        ) : null}
      </div>
      <Flash ok={sp.ok} error={sp.error} t={flashT(t)} />
      {!staff.permissions.has('content.publish') ? <p className="notice warn">{t('admin.content.verificationNote')}</p> : null}
      <ContentForm
        action={action}
        fields={def.fields}
        values={(row ?? { data_origin: 'pending_verification', is_published: false }) as Record<string, unknown>}
        labels={labels}
        optionLabels={optionLabels}
        fkOptions={fkOptions}
        messages={messages}
        saveLabel={t('common.save')}
        sensitiveNote={t('admin.content.verificationNote')}
        i18nHint={t('admin.content.jsonHint')}
      />
    </div>
  );
}

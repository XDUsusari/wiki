import { Card, Flash } from '@/components/ui';
import { requirePermission } from '@/lib/auth';
import { flashT } from '@/lib/flash';
import { getT } from '@/lib/i18n';
import { getSupabase } from '@/lib/supabase/server';
import { saveSetting } from './actions';

export default async function Settings({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePermission('settings.manage');
  const sp = await searchParams;
  const { t } = await getT();
  const supabase = await getSupabase();
  const { data } = await supabase.from('app_settings').select('*').order('key');
  return (
    <div className="grid">
      <div className="topbar">
        <h1>{t('admin.nav.settings')}</h1>
      </div>
      <Flash ok={sp.ok} error={sp.error} t={flashT(t)} />
      <Card>
        {[...(data ?? []), null].map((s) => (
          <form key={s?.key ?? 'new'} action={saveSetting} className="fieldset" style={{ marginBottom: 10 }}>
            <div className="row">
              <label style={{ flex: 1 }}>
                {t('admin.settings.key')}
                <input type="text" name="key" defaultValue={s?.key ?? ''} readOnly={!!s} required pattern="[a-z0-9_.]{2,80}" />
              </label>
              <label className="checkbox">
                <input type="checkbox" name="is_public" defaultChecked={s?.is_public ?? false} /> {t('admin.settings.public')}
              </label>
            </div>
            <label>
              {t('admin.settings.value')}
              <textarea name="value" defaultValue={s ? JSON.stringify(s.value, null, 2) : ''} required style={{ fontFamily: 'ui-monospace, monospace' }} />
            </label>
            <input type="text" name="description" defaultValue={s?.description ?? ''} aria-label={t('admin.content.fields.description_i18n')} placeholder={t('admin.content.fields.description_i18n')} />
            <div>
              <button className="btn sm">{s ? t('common.save') : `+ ${t('admin.content.new')}`}</button>
            </div>
          </form>
        ))}
      </Card>
    </div>
  );
}

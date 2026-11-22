import type { Achievement, Badge } from '@dinsdelparc/shared';
import { Card, Flash } from '@/components/ui';
import { requirePermission } from '@/lib/auth';
import { flashT } from '@/lib/flash';
import { getT } from '@/lib/i18n';
import { inputValue } from '@/lib/forms';
import { getSupabase } from '@/lib/supabase/server';
import { saveAchievement, saveBadge } from './actions';

const METRICS = ['posts', 'photos', 'wait_reports', 'reviews', 'forum_posts', 'history_posts', 'visits', 'parks_visited', 'coasters_ridden', 'pap_areas_visited', 'account_age_days'];

function I18nInputs({ name, value, label }: { name: string; value?: Record<string, string>; label: string }) {
  return (
    <div className="i18n">
      {(['ca', 'es', 'en'] as const).map((l) => (
        <label key={l}>
          <span>
            {label} {l.toUpperCase()}
          </span>
          <input type="text" name={`${name}.${l}`} defaultValue={value?.[l] ?? ''} required={l === 'ca' && name === 'name'} />
        </label>
      ))}
    </div>
  );
}

export default async function Gamification({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requirePermission('badges.award');
  const sp = await searchParams;
  const { t } = await getT();
  const supabase = await getSupabase();
  const [{ data: badges }, { data: achievements }] = await Promise.all([
    supabase.from('badges').select('*').order('slug'),
    supabase.from('achievements').select('*').order('sort_order'),
  ]);
  const dt = { name: 'x', type: 'datetime' } as const;
  return (
    <div className="grid">
      <div className="topbar">
        <h1>{t('admin.nav.gamification')}</h1>
      </div>
      <Flash ok={sp.ok} error={sp.error} t={flashT(t)} />
      <Card title={t('profile.badges')}>
        {[...((badges ?? []) as Badge[]), null].map((b) => (
          <form key={b?.id ?? 'new'} action={saveBadge} className="fieldset" style={{ marginBottom: 10 }}>
            <input type="hidden" name="id" value={b?.id ?? ''} />
            <I18nInputs name="name" value={b?.name_i18n as Record<string, string>} label={t('admin.content.fields.name')} />
            <I18nInputs name="description" value={b?.description_i18n as Record<string, string>} label={t('admin.content.fields.description_i18n')} />
            <div className="row">
              <input type="text" name="slug" defaultValue={b?.slug ?? ''} placeholder={t('admin.content.fields.slug')} required aria-label={t('admin.content.fields.slug')} style={{ maxWidth: 200 }} />
              <input type="text" name="icon" defaultValue={b?.icon ?? 'ribbon-outline'} aria-label="Icona" style={{ maxWidth: 180 }} />
              <input type="color" name="color" defaultValue={b?.color ?? '#1E88E5'} aria-label={t('admin.content.fields.accent_color')} />
              <label className="checkbox">
                <input type="checkbox" name="is_manual" defaultChecked={b?.is_manual ?? true} /> manual
              </label>
              <button className="btn sm">{b ? t('common.save') : `+ ${t('admin.content.new')}`}</button>
            </div>
          </form>
        ))}
      </Card>
      <Card title={t('profile.achievements')}>
        {[...((achievements ?? []) as (Achievement & { is_active: boolean })[]), null].map((a) => (
          <form key={a?.id ?? 'new'} action={saveAchievement} className="fieldset" style={{ marginBottom: 10 }}>
            <input type="hidden" name="id" value={a?.id ?? ''} />
            <I18nInputs name="name" value={a?.name_i18n as Record<string, string>} label={t('admin.content.fields.name')} />
            <I18nInputs name="description" value={a?.description_i18n as Record<string, string>} label={t('admin.content.fields.description_i18n')} />
            <div className="row">
              <input type="text" name="slug" defaultValue={a?.slug ?? ''} placeholder={t('admin.content.fields.slug')} required aria-label={t('admin.content.fields.slug')} style={{ maxWidth: 200 }} />
              <select name="metric" defaultValue={a?.metric ?? 'posts'} aria-label="metric" style={{ maxWidth: 200 }}>
                {METRICS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
              <input type="number" name="threshold" min={1} defaultValue={a?.threshold ?? 1} aria-label="threshold" style={{ width: 90 }} />
              <input type="number" name="xp_reward" min={0} max={1000} defaultValue={a?.xp_reward ?? 0} aria-label="XP" style={{ width: 90 }} />
              <input type="text" name="icon" defaultValue={a?.icon ?? 'trophy-outline'} aria-label="Icona" style={{ maxWidth: 160 }} />
              <label className="checkbox">
                <input type="checkbox" name="is_challenge" defaultChecked={a?.is_challenge ?? false} /> {t('profile.challenge')}
              </label>
              <label className="checkbox">
                <input type="checkbox" name="is_active" defaultChecked={a?.is_active ?? true} /> {t('admin.content.published')}
              </label>
            </div>
            <div className="row">
              <input type="datetime-local" name="starts_at" defaultValue={inputValue(dt, a?.starts_at)} aria-label={t('admin.content.fields.starts_at')} style={{ maxWidth: 230 }} />
              <input type="datetime-local" name="ends_at" defaultValue={inputValue(dt, a?.ends_at)} aria-label={t('admin.content.fields.ends_at')} style={{ maxWidth: 230 }} />
              <button className="btn sm">{a ? t('common.save') : `+ ${t('admin.content.new')}`}</button>
            </div>
          </form>
        ))}
      </Card>
    </div>
  );
}

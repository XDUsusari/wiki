import { formatRelativeTime, pickI18n, type ForumCategory } from '@dinsdelparc/shared';
import { Card, Flash } from '@/components/ui';
import { ModerateButtons } from '@/components/ModerateButtons';
import { requirePermission } from '@/lib/auth';
import { flashT } from '@/lib/flash';
import { getT } from '@/lib/i18n';
import { getSupabase } from '@/lib/supabase/server';
import { saveCategory, setTopicFlags } from './actions';

export default async function ForumAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const staff = await requirePermission('forum.manage');
  const sp = await searchParams;
  const { t, locale } = await getT();
  const supabase = await getSupabase();
  const [{ data: cats }, { data: topics }] = await Promise.all([
    supabase.from('forum_categories').select('*').order('sort_order'),
    supabase.from('forum_topics').select('id,title,is_pinned,is_locked,moderation_status,category_id,reply_count,last_activity_at,author:profiles!author_id(username)').order('last_activity_at', { ascending: false }).limit(100),
  ]);
  const categories = (cats ?? []) as ForumCategory[];
  const labels = { hide: t('admin.moderation.hide'), restore: t('admin.moderation.restore'), remove: t('admin.moderation.remove'), note: t('admin.moderation.note') };
  return (
    <div className="grid">
      <div className="topbar">
        <h1>{t('admin.nav.forum')}</h1>
      </div>
      <Flash ok={sp.ok} error={sp.error} t={flashT(t)} />
      <Card title={t('forum.title')}>
        <table>
          <tbody>
            {(topics ?? []).map((tp) => {
              const author = tp.author as unknown as { username: string } | null;
              return (
                <tr key={tp.id}>
                  <td>
                    <strong>{tp.title}</strong>
                    <div className="small muted">
                      @{author?.username} · {t('forum.replies', { count: tp.reply_count })} · {formatRelativeTime(tp.last_activity_at, locale)}
                    </div>
                    <div className="row" style={{ marginTop: 4 }}>
                      {tp.is_pinned ? <span className="pill info">{t('forum.pinned')}</span> : null}
                      {tp.is_locked ? <span className="pill warn">{t('forum.locked')}</span> : null}
                      <span className="pill">{t(`admin.moderation.statuses.${tp.moderation_status as 'visible'}`)}</span>
                    </div>
                  </td>
                  <td>
                    <form action={setTopicFlags} className="row">
                      <input type="hidden" name="id" value={tp.id} />
                      <button className="btn sm secondary" name="pinned" value={tp.is_pinned ? 'false' : 'true'}>
                        {tp.is_pinned ? t('admin.forum.unpin') : t('admin.forum.pin')}
                      </button>
                      <button className="btn sm secondary" name="locked" value={tp.is_locked ? 'false' : 'true'}>
                        {tp.is_locked ? t('admin.forum.unlock') : t('admin.forum.lock')}
                      </button>
                    </form>
                    <form action={setTopicFlags} className="row" style={{ marginTop: 6 }}>
                      <input type="hidden" name="id" value={tp.id} />
                      <select name="category" defaultValue={tp.category_id} aria-label={t('admin.forum.move')} style={{ maxWidth: 200 }}>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {pickI18n(c.name_i18n, locale)}
                          </option>
                        ))}
                      </select>
                      <button className="btn sm ghost">{t('admin.forum.move')}</button>
                    </form>
                    {staff.permissions.has('community.moderate') ? (
                      <div style={{ marginTop: 6 }}>
                        <ModerateButtons target="forum_topic" id={tp.id} current={tp.moderation_status} back="/forum" labels={labels} />
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card title={t('forum.categories')}>
        {[...categories, null].map((c) => (
          <form key={c?.id ?? 'new'} action={saveCategory} className="fieldset" style={{ marginBottom: 12 }}>
            <input type="hidden" name="id" value={c?.id ?? ''} />
            <div className="i18n">
              {(['ca', 'es', 'en'] as const).map((l) => (
                <label key={l}>
                  <span>{l.toUpperCase()}</span>
                  <input type="text" name={`name.${l}`} defaultValue={c?.name_i18n[l] ?? ''} required={l === 'ca'} aria-label={`${t('admin.content.fields.name')} (${l})`} />
                  <input type="text" name={`description.${l}`} defaultValue={c?.description_i18n[l] ?? ''} aria-label={`${t('admin.content.fields.description_i18n')} (${l})`} />
                </label>
              ))}
            </div>
            <div className="row">
              <input type="text" name="slug" defaultValue={c?.slug ?? ''} placeholder={t('admin.content.fields.slug')} aria-label={t('admin.content.fields.slug')} style={{ maxWidth: 200 }} />
              <input type="text" name="icon" defaultValue={c?.icon ?? 'chatbubbles-outline'} aria-label="Icona" style={{ maxWidth: 200 }} />
              <input type="number" name="sort_order" defaultValue={c?.sort_order ?? 0} aria-label={t('admin.content.fields.sort_order')} style={{ width: 90 }} />
              <label className="checkbox">
                <input type="checkbox" name="is_locked" defaultChecked={c?.is_locked ?? false} /> {t('forum.locked')}
              </label>
              <button className="btn sm">{c ? t('common.save') : `+ ${t('admin.content.new')}`}</button>
            </div>
          </form>
        ))}
      </Card>
    </div>
  );
}

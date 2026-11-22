import { formatRelativeTime } from '@dinsdelparc/shared';
import { ConfirmSubmit } from '@/components/ConfirmSubmit';
import { ModerateButtons } from '@/components/ModerateButtons';
import { Card, Flash } from '@/components/ui';
import { requirePermission } from '@/lib/auth';
import { flashT } from '@/lib/flash';
import { getT } from '@/lib/i18n';
import { getSupabase } from '@/lib/supabase/server';
import { addTerm, removeTerm } from './actions';

type Item = { target: string; id: string; text: string; author: string; status: string; created_at: string };

export default async function Moderation({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; status?: string }> }) {
  const staff = await requirePermission('community.moderate');
  const sp = await searchParams;
  const status = sp.status === 'hidden' || sp.status === 'removed' ? sp.status : 'pending_review';
  const { t, locale } = await getT();
  const supabase = await getSupabase();
  const author = 'author:profiles!author_id(username)';
  const [posts, comments, topics, replies, reviews, images, terms] = await Promise.all([
    supabase.from('posts').select(`id,body,moderation_status,created_at,${author}`).eq('moderation_status', status).order('created_at', { ascending: false }).limit(50),
    supabase.from('comments').select(`id,body,moderation_status,created_at,${author}`).eq('moderation_status', status).order('created_at', { ascending: false }).limit(50),
    supabase.from('forum_topics').select(`id,title,body,moderation_status,created_at,${author}`).eq('moderation_status', status).order('created_at', { ascending: false }).limit(50),
    supabase.from('forum_replies').select(`id,body,moderation_status,created_at,${author}`).eq('moderation_status', status).order('created_at', { ascending: false }).limit(50),
    supabase.from('attraction_reviews').select('id,body,moderation_status,created_at,author:profiles!user_id(username)').eq('moderation_status', status).order('created_at', { ascending: false }).limit(50),
    supabase.from('post_images').select('id,storage_path,alt_text,moderation_status,created_at').eq('moderation_status', status === 'pending_review' ? 'pending_review' : status).limit(50),
    staff.permissions.has('settings.manage') ? supabase.from('moderation_terms').select('*').order('term') : Promise.resolve({ data: [] }),
  ]);
  type Row = { id: string; body?: string | null; title?: string; moderation_status: string; created_at: string; author?: { username: string } | null };
  const map = (target: string, rows: unknown) =>
    ((rows ?? []) as Row[]).map<Item>((r) => ({
      target,
      id: r.id,
      text: r.title ? `${r.title} — ${r.body ?? ''}` : (r.body ?? ''),
      author: r.author?.username ?? '—',
      status: r.moderation_status,
      created_at: r.created_at,
    }));
  const items = [
    ...map('post', posts.data),
    ...map('comment', comments.data),
    ...map('forum_topic', topics.data),
    ...map('forum_reply', replies.data),
    ...map('review', reviews.data),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const labels = { hide: t('admin.moderation.hide'), restore: t('admin.moderation.restore'), remove: t('admin.moderation.remove'), note: t('admin.moderation.note') };
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

  return (
    <div className="grid">
      <div className="topbar">
        <h1>{t('admin.nav.moderation')}</h1>
      </div>
      <Flash ok={sp.ok} error={sp.error} t={flashT(t)} />
      <nav className="tabs" aria-label={t('admin.moderation.queue')}>
        {(['pending_review', 'hidden', 'removed'] as const).map((s) => (
          <a key={s} href={`/moderation?status=${s}`} aria-current={status === s ? 'page' : undefined}>
            {t(`admin.moderation.statuses.${s}`)}
          </a>
        ))}
      </nav>
      <Card title={t('admin.moderation.queue')}>
        {!items.length ? (
          <p className="muted">{t('admin.content.empty')}</p>
        ) : (
          <table>
            <tbody>
              {items.map((i) => (
                <tr key={`${i.target}-${i.id}`}>
                  <td style={{ width: 120 }}>
                    <span className="pill info">{i.target}</span>
                    <div className="small muted">@{i.author}</div>
                    <div className="small muted">{formatRelativeTime(i.created_at, locale)}</div>
                  </td>
                  <td style={{ whiteSpace: 'pre-wrap', maxWidth: 520 }}>{i.text.slice(0, 800)}</td>
                  <td>
                    <ModerateButtons target={i.target} id={i.id} current={i.status} back={`/moderation?status=${status}`} labels={labels} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {images.data?.length ? (
        <Card title={t('community.addPhotos')}>
          <div className="grid stats">
            {images.data.map((img) => (
              <div key={img.id} className="card" style={{ padding: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${base}/storage/v1/object/public/post-images/${img.storage_path}`} alt={img.alt_text ?? ''} style={{ width: '100%', borderRadius: 8 }} />
                <ModerateButtons target="post_image" id={img.id} current={img.moderation_status} back={`/moderation?status=${status}`} labels={labels} />
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      {staff.permissions.has('settings.manage') ? (
        <Card title={t('admin.moderation.terms')}>
          <form action={addTerm} className="row" style={{ marginBottom: 12 }}>
            <input type="text" name="term" minLength={2} maxLength={60} required placeholder={t('admin.moderation.addTerm')} aria-label={t('admin.moderation.addTerm')} style={{ maxWidth: 260 }} />
            <select name="action" aria-label={t('admin.audit.action')} style={{ maxWidth: 200 }}>
              <option value="review">{t('admin.moderation.termAction.review')}</option>
              <option value="block">{t('admin.moderation.termAction.block')}</option>
            </select>
            <button className="btn secondary">{t('admin.moderation.addTerm')}</button>
          </form>
          <table>
            <tbody>
              {((terms.data ?? []) as { term: string; action: 'review' | 'block' }[]).map((term) => (
                <tr key={term.term}>
                  <td>{term.term}</td>
                  <td>
                    <span className={`pill ${term.action === 'block' ? 'err' : 'warn'}`}>{t(`admin.moderation.termAction.${term.action}`)}</span>
                  </td>
                  <td>
                    <form action={removeTerm}>
                      <input type="hidden" name="term" value={term.term} />
                      <ConfirmSubmit label={t('common.delete')} confirm={t('admin.content.deleteConfirm')} />
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}

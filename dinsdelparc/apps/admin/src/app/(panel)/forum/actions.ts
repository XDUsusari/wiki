'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { withFlash } from '@/lib/flash';
import { adminErrorKey } from '@/lib/forms';
import { getSupabase } from '@/lib/supabase/server';
import { slugify } from '@dinsdelparc/shared';

function back(error: { message: string } | null) {
  revalidatePath('/forum');
  redirect(withFlash('/forum', error ? 'error' : 'ok', error ? adminErrorKey(error.message) : 'admin.content.saved'));
}

export async function setTopicFlags(formData: FormData) {
  await requirePermission('forum.manage');
  const flag = (k: string) => (formData.get(k) == null ? null : formData.get(k) === 'true');
  const supabase = await getSupabase();
  const { error } = await supabase.rpc('forum_set_flags', {
    p_topic: String(formData.get('id')),
    p_pinned: flag('pinned'),
    p_locked: flag('locked'),
    p_category: (formData.get('category') as string) || null,
  });
  back(error);
}

export async function saveCategory(formData: FormData) {
  await requirePermission('forum.manage');
  const id = String(formData.get('id') ?? '');
  const name = { ca: String(formData.get('name.ca') ?? '').trim(), es: String(formData.get('name.es') ?? '').trim(), en: String(formData.get('name.en') ?? '').trim() };
  const description = {
    ca: String(formData.get('description.ca') ?? '').trim(),
    es: String(formData.get('description.es') ?? '').trim(),
    en: String(formData.get('description.en') ?? '').trim(),
  };
  const clean = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v));
  const row = {
    slug: slugify(String(formData.get('slug') ?? name.ca)),
    name_i18n: clean(name),
    description_i18n: clean(description),
    icon: String(formData.get('icon') || 'chatbubbles-outline').slice(0, 60),
    sort_order: Number(formData.get('sort_order') || 0),
    is_locked: formData.get('is_locked') === 'on',
  };
  const supabase = await getSupabase();
  const { error } = id ? await supabase.from('forum_categories').update(row).eq('id', id) : await supabase.from('forum_categories').insert(row);
  back(error);
}

'use server';

import { slugify } from '@dinsdelparc/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { withFlash } from '@/lib/flash';
import { adminErrorKey } from '@/lib/forms';
import { getSupabase } from '@/lib/supabase/server';

const i18n = (f: FormData, name: string) =>
  Object.fromEntries((['ca', 'es', 'en'] as const).map((l) => [l, String(f.get(`${name}.${l}`) ?? '').trim()]).filter(([, v]) => v));

function back(error: { message: string } | null) {
  revalidatePath('/gamification');
  redirect(withFlash('/gamification', error ? 'error' : 'ok', error ? adminErrorKey(error.message) : 'admin.content.saved'));
}

export async function saveBadge(f: FormData) {
  await requirePermission('badges.award');
  const id = String(f.get('id') ?? '');
  const row = {
    slug: slugify(String(f.get('slug') ?? '')),
    name_i18n: i18n(f, 'name'),
    description_i18n: i18n(f, 'description'),
    icon: String(f.get('icon') || 'ribbon-outline').slice(0, 60),
    color: /^#[0-9A-Fa-f]{6}$/.test(String(f.get('color'))) ? String(f.get('color')) : '#1E88E5',
    is_manual: f.get('is_manual') === 'on',
  };
  const supabase = await getSupabase();
  const { error } = id ? await supabase.from('badges').update(row).eq('id', id) : await supabase.from('badges').insert(row);
  back(error);
}

export async function saveAchievement(f: FormData) {
  await requirePermission('badges.award');
  const id = String(f.get('id') ?? '');
  const date = (k: string) => (f.get(k) ? new Date(String(f.get(k))).toISOString() : null);
  const row = {
    slug: slugify(String(f.get('slug') ?? '')),
    name_i18n: i18n(f, 'name'),
    description_i18n: i18n(f, 'description'),
    icon: String(f.get('icon') || 'trophy-outline').slice(0, 60),
    metric: String(f.get('metric')),
    threshold: Math.max(1, Number(f.get('threshold') || 1)),
    xp_reward: Math.min(1000, Math.max(0, Number(f.get('xp_reward') || 0))),
    is_challenge: f.get('is_challenge') === 'on',
    is_active: f.get('is_active') === 'on',
    starts_at: date('starts_at'),
    ends_at: date('ends_at'),
  };
  const supabase = await getSupabase();
  const { error } = id ? await supabase.from('achievements').update(row).eq('id', id) : await supabase.from('achievements').insert(row);
  back(error);
}

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { withFlash } from '@/lib/flash';
import { adminErrorKey } from '@/lib/forms';
import { getSupabase } from '@/lib/supabase/server';

const TARGETS = ['post', 'comment', 'post_image', 'forum_topic', 'forum_reply', 'review'] as const;
const STATUSES = ['visible', 'pending_review', 'hidden', 'removed'] as const;

function back(path: string, error: { message: string } | null) {
  revalidatePath(path);
  redirect(withFlash(path, error ? 'error' : 'ok', error ? adminErrorKey(error.message) : 'admin.content.saved'));
}

export async function moderate(formData: FormData) {
  await requirePermission('community.moderate');
  const target = String(formData.get('target'));
  const status = String(formData.get('status'));
  const backTo = String(formData.get('back') ?? '/moderation');
  if (!(TARGETS as readonly string[]).includes(target) || !(STATUSES as readonly string[]).includes(status)) return back('/moderation', { message: 'invalid' });
  const supabase = await getSupabase();
  const { error } = await supabase.rpc('moderate_content', {
    p_target: target,
    p_id: String(formData.get('id')),
    p_status: status,
    p_note: String(formData.get('note') ?? '').slice(0, 1000) || null,
  });
  back(backTo.startsWith('/') ? backTo : '/moderation', error);
}

export async function resolveReport(formData: FormData) {
  await requirePermission('reports.manage');
  const state = String(formData.get('state'));
  if (!['reviewing', 'resolved', 'dismissed'].includes(state)) return back('/reports', { message: 'invalid' });
  const supabase = await getSupabase();
  const { error } = await supabase.rpc('resolve_report', {
    p_report: String(formData.get('id')),
    p_state: state,
    p_note: String(formData.get('note') ?? '').slice(0, 2000) || null,
  });
  back('/reports', error);
}

export async function addTerm(formData: FormData) {
  await requirePermission('settings.manage');
  const term = String(formData.get('term') ?? '').trim().toLowerCase();
  const action = formData.get('action') === 'block' ? 'block' : 'review';
  const supabase = await getSupabase();
  const { error } = await supabase.from('moderation_terms').insert({ term, action });
  back('/moderation', error);
}

export async function removeTerm(formData: FormData) {
  await requirePermission('settings.manage');
  const supabase = await getSupabase();
  const { error } = await supabase.from('moderation_terms').delete().eq('term', String(formData.get('term')));
  back('/moderation', error);
}

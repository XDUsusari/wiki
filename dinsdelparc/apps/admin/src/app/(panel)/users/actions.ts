'use server';

import { ROLE_RANK, type AppRole } from '@dinsdelparc/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { withFlash } from '@/lib/flash';
import { adminErrorKey } from '@/lib/forms';
import { getSupabase } from '@/lib/supabase/server';

function back(id: string, error: { message: string } | null) {
  revalidatePath(`/users/${id}`);
  redirect(withFlash(`/users/${id}`, error ? 'error' : 'ok', error ? adminErrorKey(error.message) : 'admin.content.saved'));
}

export async function setRole(formData: FormData) {
  await requirePermission('users.manage_roles');
  const id = String(formData.get('user_id'));
  const role = String(formData.get('role')) as AppRole;
  if (!(role in ROLE_RANK)) return back(id, { message: 'invalid' });
  const supabase = await getSupabase();
  const { error } = await supabase.rpc('admin_set_role', { p_user: id, p_role: role, p_grant: formData.get('grant') === 'true' });
  back(id, error);
}

export async function suspend(formData: FormData) {
  await requirePermission('users.suspend');
  const id = String(formData.get('user_id'));
  const reinstate = formData.get('reinstate') === 'true';
  const until = String(formData.get('until') ?? '');
  const supabase = await getSupabase();
  const { error } = await supabase.rpc('admin_suspend_user', {
    p_user: id,
    p_until: reinstate ? null : until ? new Date(until).toISOString() : null,
    p_reason: String(formData.get('reason') ?? '').slice(0, 1000) || (reinstate ? 'reinstated' : 'suspended'),
  });
  back(id, reinstate || until ? error : { message: 'invalid' });
}

export async function awardBadge(formData: FormData) {
  await requirePermission('badges.award');
  const id = String(formData.get('user_id'));
  const supabase = await getSupabase();
  const { error } = await supabase.rpc('admin_award_badge', {
    p_user: id,
    p_badge: String(formData.get('badge_id')),
    p_award: formData.get('award') === 'true',
  });
  back(id, error);
}

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { withFlash } from '@/lib/flash';
import { adminErrorKey } from '@/lib/forms';
import { getSupabase } from '@/lib/supabase/server';

const STATUSES = ['open', 'temporarily_closed', 'permanently_closed', 'unknown'] as const;

function done(error: { message: string } | null) {
  revalidatePath('/operations');
  redirect(withFlash('/operations', error ? 'error' : 'ok', error ? adminErrorKey(error.message) : 'admin.content.saved'));
}

export async function setStatus(formData: FormData) {
  await requirePermission('operations.manage');
  const attraction = String(formData.get('attraction_id') ?? '');
  const status = String(formData.get('status') ?? '');
  const hours = String(formData.get('valid_hours') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim().slice(0, 500);
  const source = String(formData.get('source_url') ?? '').trim();
  if (!(STATUSES as readonly string[]).includes(status)) return done({ message: 'invalid' });
  const supabase = await getSupabase();
  const { error } = await supabase.rpc('set_attraction_status', {
    p_attraction: attraction,
    p_status: status,
    p_note: note ? { ca: note } : {},
    p_valid_hours: hours ? Math.max(1, Math.min(720, Number(hours) || 1)) : null,
    p_source_url: source.startsWith('https://') ? source : null,
  });
  done(error);
}

export async function setStaffWait(formData: FormData) {
  await requirePermission('operations.manage');
  const supabase = await getSupabase();
  const { error } = await supabase.rpc('set_staff_wait_time', {
    p_attraction: String(formData.get('attraction_id') ?? ''),
    p_minutes: Number(formData.get('minutes')),
    p_valid_minutes: Number(formData.get('valid_minutes') || 30),
  });
  done(error);
}

export async function reviewReport(formData: FormData) {
  await requirePermission('operations.validate');
  const supabase = await getSupabase();
  const { error } = await supabase.rpc('review_wait_report', {
    p_report: String(formData.get('report_id') ?? ''),
    p_approve: formData.get('approve') === 'true',
  });
  done(error);
}

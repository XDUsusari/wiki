'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { withFlash } from '@/lib/flash';
import { adminErrorKey } from '@/lib/forms';
import { getSupabase } from '@/lib/supabase/server';

export async function saveSetting(f: FormData) {
  await requirePermission('settings.manage');
  const key = String(f.get('key') ?? '').trim();
  let value: unknown;
  try {
    value = JSON.parse(String(f.get('value') ?? ''));
  } catch {
    redirect(withFlash('/settings', 'error', 'admin.settings.invalidJson'));
  }
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value, is_public: f.get('is_public') === 'on', description: String(f.get('description') ?? '').slice(0, 300) || null }, { onConflict: 'key' });
  revalidatePath('/settings');
  redirect(withFlash('/settings', error ? 'error' : 'ok', error ? adminErrorKey(error.message) : 'admin.content.saved'));
}

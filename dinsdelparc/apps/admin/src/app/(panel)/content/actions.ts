'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { CONTENT, isContentTable } from '@/lib/contentConfig';
import { withFlash } from '@/lib/flash';
import { adminErrorKey, parseContentForm } from '@/lib/forms';
import { log } from '@/lib/log';
import { getSupabase } from '@/lib/supabase/server';

export interface SaveState {
  errors: Record<string, string>;
  formError: string | null;
}

export async function saveContent(table: string, id: string | null, _prev: SaveState, formData: FormData): Promise<SaveState> {
  if (!isContentTable(table)) return { errors: {}, formError: 'errors.notFound' };
  const def = CONTENT[table];
  await requirePermission(def.writePermission);
  const { payload, errors } = parseContentForm(def.fields, formData);
  if (Object.keys(errors).length) return { errors, formError: 'validation.required' };

  const supabase = await getSupabase();
  const res = id
    ? await supabase.from(table).update(payload).eq('id', id).select('id').single()
    : await supabase.from(table).insert(payload).select('id').single();
  if (res.error) {
    log('warn', 'content.save_failed', { table, id, code: res.error.code, message: res.error.message });
    return { errors: {}, formError: adminErrorKey(res.error.message) };
  }

  revalidatePath(`/content/${table}`);
  redirect(withFlash(`/content/${table}/${res.data.id}`, 'ok', 'admin.content.saved'));
}

export async function deleteContent(table: string, id: string) {
  if (!isContentTable(table)) return;
  await requirePermission('content.delete');
  const supabase = await getSupabase();
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) {
    log('warn', 'content.delete_failed', { table, id, code: error.code, message: error.message });
    redirect(withFlash(`/content/${table}/${id}`, 'error', adminErrorKey(error.message)));
  }
  revalidatePath(`/content/${table}`);
  redirect(withFlash(`/content/${table}`, 'ok', 'admin.content.deleted'));
}

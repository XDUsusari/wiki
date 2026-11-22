'use server';

import { isLocale } from '@dinsdelparc/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSupabase } from '@/lib/supabase/server';

export async function setPreference(formData: FormData) {
  const store = await cookies();
  const locale = formData.get('locale');
  const theme = formData.get('theme');
  if (typeof locale === 'string' && isLocale(locale)) store.set('ddp_locale', locale, { path: '/', sameSite: 'lax', maxAge: 31536000 });
  if (theme === 'light' || theme === 'dark' || theme === 'system') {
    if (theme === 'system') store.delete('ddp_theme');
    else store.set('ddp_theme', theme, { path: '/', sameSite: 'lax', maxAge: 31536000 });
  }
  const back = formData.get('back');
  redirect(typeof back === 'string' && back.startsWith('/') ? back : '/');
}

export async function signOut() {
  const supabase = await getSupabase();
  await supabase.auth.signOut();
  redirect('/login');
}

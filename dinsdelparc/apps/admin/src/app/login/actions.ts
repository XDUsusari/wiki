'use server';

import { emailSchema } from '@dinsdelparc/shared';
import { redirect } from 'next/navigation';
import { getSupabase } from '@/lib/supabase/server';

export async function signIn(formData: FormData) {
  const email = emailSchema.safeParse(String(formData.get('email') ?? '').trim());
  const password = String(formData.get('password') ?? '');
  if (!email.success || !password) redirect('/login?error=invalid');
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password });
  if (error) redirect('/login?error=invalid');
  const { data: perms } = await supabase.rpc('my_permissions');
  if (!((perms as string[] | null) ?? []).includes('dashboard.view')) {
    await supabase.auth.signOut();
    redirect('/login?error=not_staff');
  }
  redirect('/');
}

import { buildUserStoragePath, type Locale, type ProfileInput } from '@dinsdelparc/shared';
import * as Linking from 'expo-linking';
import { supabase, unwrap } from '../lib/supabase';

export async function signUp(input: { email: string; password: string; username: string; marketingConsent: boolean; locale: Locale; termsVersion: string }) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: Linking.createURL('/auth/callback'),
      data: {
        username: input.username,
        locale: input.locale,
        terms_version: input.termsVersion,
        marketing_consent: input.marketingConsent,
      },
    },
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: Linking.createURL('/auth/reset') });
  if (error) throw new Error(error.message);
}

export async function resendVerification(email: string) {
  const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: Linking.createURL('/auth/callback') } });
  if (error) throw new Error(error.message);
}

/** Completes PKCE flows (e-mail verification, password recovery) from a deep link. */
export async function exchangeCode(code: string) {
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw new Error(error.message);
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

export async function updateProfile(userId: string, input: ProfileInput) {
  unwrap(await supabase.from('profiles').update(input).eq('id', userId));
}

export async function uploadAvatar(userId: string, uri: string, mimeType: string) {
  const path = buildUserStoragePath(userId, mimeType);
  const body = await (await fetch(uri)).arrayBuffer();
  const up = await supabase.storage.from('avatars').upload(path, body, { contentType: mimeType, upsert: false });
  if (up.error) throw new Error(up.error.message);
  const old = (await supabase.from('profiles').select('avatar_path').eq('id', userId).single()).data as { avatar_path: string | null } | null;
  unwrap(await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId));
  if (old?.avatar_path) await supabase.storage.from('avatars').remove([old.avatar_path]);
}

export async function saveUserSettings(userId: string, patch: { locale?: Locale; theme?: 'system' | 'light' | 'dark'; onboarding_completed?: boolean }) {
  unwrap(await supabase.from('user_settings').update(patch).eq('user_id', userId));
}

export async function recordConsent(userId: string, kind: 'marketing' | 'push', granted: boolean, version: string) {
  unwrap(await supabase.from('consents').insert({ user_id: userId, kind, granted, version }));
}

export async function latestConsent(userId: string, kind: 'marketing' | 'push'): Promise<boolean> {
  const row = (await supabase.from('consents').select('granted').eq('user_id', userId).eq('kind', kind).order('created_at', { ascending: false }).limit(1).maybeSingle())
    .data as { granted: boolean } | null;
  return row?.granted ?? false;
}

export async function exportMyData(): Promise<unknown> {
  return unwrap(await supabase.rpc('export_my_data'));
}

/** Account deletion needs the service role, so it runs in an Edge Function. */
export async function deleteMyAccount() {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST', body: { confirm: true } });
  if (error) throw new Error(error.message);
  await supabase.auth.signOut();
}

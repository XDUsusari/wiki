import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { env, isBackendConfigured } from './env';
import { authStorage } from './secureStorage';

/**
 * Supabase client using ONLY the public anon key. Every permission is enforced
 * server-side by Row Level Security and SECURITY DEFINER functions.
 */
export const supabase = createClient(
  isBackendConfigured ? env.supabaseUrl : 'https://not-configured.invalid',
  isBackendConfigured ? env.supabaseAnonKey : 'not-configured',
  {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  },
);

// Refresh tokens only while the app is in the foreground (Supabase RN guidance).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}

export function publicStorageUrl(bucket: 'avatars' | 'post-images' | 'content', path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Throws a plain Error with the PostgREST message so dbErrorKey() can map it. */
export function unwrap<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

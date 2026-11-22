import type { TKey } from '@dinsdelparc/shared';

/** Maps Supabase Auth error messages to translation keys. */
export function authErrorKey(message: string): TKey {
  if (/invalid login credentials/i.test(message)) return 'errors.invalidCredentials';
  if (/email not confirmed/i.test(message)) return 'errors.emailNotConfirmed';
  if (/rate limit|too many/i.test(message)) return 'errors.rateLimited';
  if (/network|fetch/i.test(message)) return 'errors.network';
  return 'errors.generic';
}

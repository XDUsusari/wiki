import type { AppNotification, NotificationPreferences } from '@dinsdelparc/shared';
import { supabase, unwrap } from '../lib/supabase';
import type { AuthorSummary } from './community';

export type NotificationRow = AppNotification & { actor: AuthorSummary | null };

export async function fetchNotifications(): Promise<NotificationRow[]> {
  return unwrap(
    await supabase
      .from('notifications')
      .select('*, actor:profiles!actor_id(id,username,display_name,avatar_path,level)')
      .order('created_at', { ascending: false })
      .limit(100),
  ) as NotificationRow[];
}

export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markRead(ids: string[] | 'all') {
  let q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
  if (ids !== 'all') q = q.in('id', ids);
  unwrap(await q);
}

export async function fetchPreferences(userId: string): Promise<NotificationPreferences> {
  return unwrap(await supabase.from('notification_preferences').select('*').eq('user_id', userId).single()) as NotificationPreferences;
}

export async function updatePreferences(userId: string, patch: Partial<Omit<NotificationPreferences, 'user_id'>>) {
  unwrap(await supabase.from('notification_preferences').update(patch).eq('user_id', userId));
}

export async function savePushToken(token: string, platform: 'ios' | 'android' | 'web') {
  unwrap(await supabase.from('push_tokens').upsert({ token, platform }, { onConflict: 'token' }));
}

export async function removePushToken(token: string) {
  unwrap(await supabase.from('push_tokens').delete().eq('token', token));
}

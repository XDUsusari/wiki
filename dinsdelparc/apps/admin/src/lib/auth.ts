import 'server-only';
import { highestRole, type AppRole, type Permission } from '@dinsdelparc/shared';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getSupabase } from './supabase/server';

export interface StaffSession {
  userId: string;
  email: string | null;
  username: string;
  roles: AppRole[];
  topRole: AppRole;
  permissions: Set<Permission>;
}

/**
 * Loads the current staff member. Permissions come from the database
 * (my_permissions()), so the UI mirrors exactly what PostgreSQL will allow.
 */
export const getStaff = cache(async (): Promise<StaffSession> => {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  const [{ data: perms }, { data: roles }, { data: profile }] = await Promise.all([
    supabase.rpc('my_permissions'),
    supabase.from('user_roles').select('role').eq('user_id', data.user.id),
    supabase.from('profiles').select('username').eq('id', data.user.id).single(),
  ]);
  const permissions = new Set(((perms as string[] | null) ?? []) as Permission[]);
  if (!permissions.has('dashboard.view')) redirect('/login?error=not_staff');
  const r = (roles ?? []).map((x) => x.role as AppRole);
  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    username: (profile?.username as string) ?? '',
    roles: r,
    topRole: highestRole(r),
    permissions,
  };
});

export async function requirePermission(p: Permission): Promise<StaffSession> {
  const s = await getStaff();
  if (!s.permissions.has(p)) redirect('/?error=forbidden');
  return s;
}

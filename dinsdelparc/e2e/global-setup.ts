import { createClient } from '@supabase/supabase-js';

/**
 * Creates the e2e accounts in the LOCAL Supabase stack (supabase start).
 * Needs E2E_SUPABASE_URL and E2E_SERVICE_ROLE_KEY (the local demo key printed
 * by `supabase status`). Never point this at a production project.
 */
export const E2E_USERS = {
  admin: { email: 'admin@e2e.dinsdelparc.test', password: 'Admin-e2e-2026', username: 'e2e_admin', role: 'superadmin' },
  visitor: { email: 'visitor@e2e.dinsdelparc.test', password: 'Visitor-e2e-2026', username: 'e2e_visitor', role: null },
} as const;

export default async function globalSetup() {
  const url = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  const key = process.env.E2E_SERVICE_ROLE_KEY;
  if (!key) throw new Error('E2E_SERVICE_ROLE_KEY is required (local stack only)');
  if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error('Refusing to run e2e setup against a non-local Supabase URL');
  const admin = createClient(url, key, { auth: { persistSession: false } });

  // Remove records left behind by previous (interrupted) runs.
  await admin.from('attractions').delete().like('slug', 'e2e-%');

  for (const u of Object.values(E2E_USERS)) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
    const existing = list.users.find((x) => x.email === u.email);
    if (existing) await admin.auth.admin.deleteUser(existing.id);
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { username: u.username, terms_version: '2026-11', locale: 'ca' },
    });
    if (error) throw error;
    if (u.role) {
      const { error: roleError } = await admin.from('user_roles').insert({ user_id: data.user.id, role: u.role });
      if (roleError) throw roleError;
    }
  }
}

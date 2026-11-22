// DinsDelParc · delete-account
// Permanently deletes the CALLER's account (RGPD right to erasure).
// The service_role key only exists here, server-side, never in the apps.
import { createClient } from 'npm:@supabase/supabase-js@2.119.2';
import { corsHeaders, json } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function removeFolder(admin: ReturnType<typeof createClient>, bucket: string, folder: string) {
  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 100 });
    if (error || !data?.length) return;
    await admin.storage.from(bucket).remove(data.map((f) => `${folder}/${f.name}`));
    if (data.length < 100) return;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'not_authenticated' }, 401);

  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== true) return json({ error: 'confirmation_required' }, 400);

  // Identify the caller from their own JWT.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'not_authenticated' }, 401);
  const uid = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Uploaded files live under <uid>/ in each user bucket.
  await removeFolder(admin, 'avatars', uid);
  await removeFolder(admin, 'post-images', uid);

  await admin.from('audit_logs').insert({ actor_id: null, action: 'delete_account', entity_type: 'profiles', entity_id: uid, note: 'self-service deletion' });

  // Deleting the auth user cascades to every table (profiles, posts, plans…).
  const { error } = await admin.auth.admin.deleteUser(uid);
  if (error) return json({ error: 'delete_failed' }, 500);
  return json({ ok: true });
});

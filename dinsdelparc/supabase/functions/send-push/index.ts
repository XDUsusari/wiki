// DinsDelParc · send-push
// Called by a Database Webhook on INSERT into public.notifications.
// Sends an Expo push notification if the recipient enabled push.
import { createClient } from 'npm:@supabase/supabase-js@2.119.2';
import { json } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';

type Locale = 'ca' | 'es' | 'en';
const TITLES: Record<string, Record<Locale, string>> = {
  follow: { ca: 'Nou seguidor', es: 'Nuevo seguidor', en: 'New follower' },
  reaction: { ca: 'Nova reacció', es: 'Nueva reacción', en: 'New reaction' },
  comment: { ca: 'Nou comentari', es: 'Nuevo comentario', en: 'New comment' },
  reply: { ca: 'Nova resposta', es: 'Nueva respuesta', en: 'New reply' },
  mention: { ca: 'T’han mencionat', es: 'Te han mencionado', en: 'You were mentioned' },
  forum_reply: { ca: 'Nova resposta al fòrum', es: 'Nueva respuesta en el foro', en: 'New forum reply' },
  news: { ca: 'Novetat a DinsDelParc', es: 'Novedad en DinsDelParc', en: 'DinsDelParc news' },
  moderation: { ca: 'Avís de moderació', es: 'Aviso de moderación', en: 'Moderation notice' },
  plan: { ca: 'El teu pla de visita', es: 'Tu plan de visita', en: 'Your visit plan' },
  park_info: { ca: 'Informació dels parcs', es: 'Información de los parques', en: 'Park information' },
  achievement: { ca: 'Assoliment desbloquejat', es: 'Logro desbloqueado', en: 'Achievement unlocked' },
  badge: { ca: 'Nova insígnia', es: 'Nueva insignia', en: 'New badge' },
  report_resolved: { ca: 'Denúncia revisada', es: 'Denuncia revisada', en: 'Report reviewed' },
};
const BODY: Record<Locale, string> = {
  ca: 'Obre DinsDelParc per veure-ho.',
  es: 'Abre DinsDelParc para verlo.',
  en: 'Open DinsDelParc to see it.',
};

/** Constant-time comparison of the shared webhook secret. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!safeEqual(req.headers.get('x-webhook-secret') ?? '', WEBHOOK_SECRET)) return json({ error: 'unauthorized' }, 401);

  const payload = await req.json().catch(() => null);
  const n = payload?.record;
  if (payload?.type !== 'INSERT' || payload?.table !== 'notifications' || !n?.user_id) return json({ skipped: true });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const [{ data: prefs }, { data: settings }, { data: tokens }] = await Promise.all([
    admin.from('notification_preferences').select('push_enabled').eq('user_id', n.user_id).maybeSingle(),
    admin.from('user_settings').select('locale').eq('user_id', n.user_id).maybeSingle(),
    admin.from('push_tokens').select('token').eq('user_id', n.user_id),
  ]);
  if (!prefs?.push_enabled || !tokens?.length) return json({ skipped: true });

  const locale: Locale = (['ca', 'es', 'en'] as const).includes(settings?.locale) ? settings!.locale : 'ca';
  const messages = tokens.map((t: { token: string }) => ({
    to: t.token,
    title: TITLES[n.type]?.[locale] ?? 'DinsDelParc',
    body: BODY[locale],
    data: { entity_type: n.entity_type, entity_id: n.entity_id, notification_id: n.id },
    sound: null,
  }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const result = await res.json().catch(() => ({}));

  // Remove tokens Expo reports as no longer registered.
  const stale: string[] = [];
  (result?.data ?? []).forEach((r: { status?: string; details?: { error?: string } }, i: number) => {
    if (r?.status === 'error' && r.details?.error === 'DeviceNotRegistered') stale.push(messages[i]!.to);
  });
  if (stale.length) await admin.from('push_tokens').delete().in('token', stale);

  return json({ sent: messages.length - stale.length });
});

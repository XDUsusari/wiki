import { z } from 'zod';

/**
 * Client-side validation. Error messages are i18n keys (see i18n/ca.ts →
 * validation.*). The database enforces the same limits again.
 */

const trimmed = (min: number, max: number) =>
  z.string().trim().min(min, { message: 'validation.tooShort' }).max(max, { message: 'validation.tooLong' });

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_.]{3,24}$/, { message: 'validation.username' });

export const passwordSchema = z
  .string()
  .min(10, { message: 'validation.passwordLength' })
  .max(128, { message: 'validation.tooLong' })
  .regex(/[A-Za-z]/, { message: 'validation.passwordLetters' })
  .regex(/[0-9]/, { message: 'validation.passwordDigits' });

export const emailSchema = z.email({ message: 'validation.email' }).max(254, { message: 'validation.tooLong' });

export const signUpSchema = z
  .object({
    email: emailSchema,
    username: usernameSchema,
    password: passwordSchema,
    acceptTerms: z.literal(true, { message: 'validation.acceptTerms' }),
    marketingConsent: z.boolean().default(false),
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: 'validation.required' }),
});

export const profileSchema = z.object({
  username: usernameSchema,
  display_name: trimmed(1, 60).nullable().or(z.literal('').transform(() => null)),
  bio: z.string().trim().max(400, { message: 'validation.tooLong' }).nullable(),
  favourite_park_slug: z.string().max(60).nullable(),
  show_favorites: z.boolean(),
  show_stats: z.boolean(),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const POST_CATEGORIES = [
  'news',
  'experiences',
  'attractions',
  'photos',
  'collecting',
  'history',
  'events',
  'debates',
  'trivia',
] as const;

export const postSchema = z.object({
  category: z.enum(POST_CATEGORIES, { message: 'validation.required' }),
  body: trimmed(1, 5000),
  attraction_id: z.uuid().nullable().optional(),
  park_id: z.uuid().nullable().optional(),
});
export type PostInput = z.infer<typeof postSchema>;

export const commentSchema = z.object({ body: trimmed(1, 2000), parent_id: z.uuid().nullable().optional() });

export const reviewSchema = z.object({
  rating: z.number().int().min(1, { message: 'validation.rating' }).max(5, { message: 'validation.rating' }),
  body: z.string().trim().max(2000, { message: 'validation.tooLong' }).nullable(),
});

export const forumTopicSchema = z.object({
  category_id: z.uuid({ message: 'validation.required' }),
  title: trimmed(5, 140),
  body: trimmed(1, 10000),
});

export const forumReplySchema = z.object({
  body: trimmed(1, 10000),
  quoted_reply_id: z.uuid().nullable().optional(),
});

export const waitReportSchema = z.object({
  minutes: z
    .number({ message: 'validation.number' })
    .int({ message: 'validation.number' })
    .min(0, { message: 'validation.waitRange' })
    .max(300, { message: 'validation.waitRange' }),
});

export const itinerarySchema = z.object({
  title: trimmed(1, 80),
  visit_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'validation.date' })
    .nullable(),
  party_size: z.number().int().min(1, { message: 'validation.partySize' }).max(30, { message: 'validation.partySize' }),
  park_ids: z.array(z.uuid()).max(3),
  notes: z.string().trim().max(2000, { message: 'validation.tooLong' }).nullable(),
});
export type ItineraryInput = z.infer<typeof itinerarySchema>;

export const REPORT_REASONS = [
  'spam',
  'harassment',
  'hate',
  'inappropriate',
  'violence',
  'misinformation',
  'copyright',
  'privacy',
  'incorrect_info',
  'other',
] as const;

export const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS, { message: 'validation.required' }),
  details: z.string().trim().max(2000, { message: 'validation.tooLong' }).nullable(),
});

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_POST_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGES_PER_POST = 4;

export type ImageCheckError = 'validation.imageType' | 'validation.imageSize';

export function checkImage(
  file: { mimeType?: string | null; fileSize?: number | null },
  maxBytes: number,
): ImageCheckError | null {
  if (!file.mimeType || !(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.mimeType)) return 'validation.imageType';
  if (file.fileSize != null && file.fileSize > maxBytes) return 'validation.imageSize';
  return null;
}

/** Storage path accepted by the post_images CHECK constraint and Storage policies. */
export function buildUserStoragePath(userId: string, mimeType: string, now: number = Date.now()): string {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const rand = Math.random().toString(36).slice(2, 10);
  return `${userId}/${now}-${rand}.${ext}`;
}

/** Only https URLs are rendered as links (avoids javascript: and other schemes). */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Maps PostgREST / Postgres error messages raised by the schema to i18n keys. */
export function dbErrorKey(message: string | undefined | null): string {
  const m = message ?? '';
  if (m.includes('rate_limited')) return 'errors.rateLimited';
  if (m.includes('content_blocked')) return 'errors.contentBlocked';
  if (m.includes('duplicate_report')) return 'errors.duplicateReport';
  if (m.includes('attraction_closed')) return 'errors.attractionClosed';
  if (m.includes('topic_locked') || m.includes('category_locked')) return 'errors.locked';
  if (m.includes('blocked')) return 'errors.blocked';
  if (m.includes('limit_reached')) return 'errors.limitReached';
  if (m.includes('duplicate key') || m.includes('23505')) return 'errors.duplicate';
  if (m.includes('row-level security') || m.includes('permission denied') || m.includes('forbidden')) return 'errors.notAllowed';
  if (m.includes('Failed to fetch') || m.includes('Network request failed')) return 'errors.network';
  return 'errors.generic';
}

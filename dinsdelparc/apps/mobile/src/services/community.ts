import {
  buildUserStoragePath,
  type Comment,
  type Post,
  type PostCategory,
  type PostImage,
  type Profile,
  type ReactionKind,
} from '@dinsdelparc/shared';
import { supabase, unwrap } from '../lib/supabase';

export type AuthorSummary = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_path' | 'level'>;
export type FeedPost = Post & { author: AuthorSummary | null; images: PostImage[]; my_reaction: ReactionKind | null };
export type ThreadComment = Comment & { author: AuthorSummary | null };

const AUTHOR = 'author:profiles!author_id(id,username,display_name,avatar_path,level)';
export const PAGE_SIZE = 15;

async function withMyReactions(posts: (Post & { author: AuthorSummary | null; images: PostImage[] })[], userId: string | null) {
  if (!userId || posts.length === 0) return posts.map((p) => ({ ...p, my_reaction: null }));
  const rows = unwrap(
    await supabase.from('reactions').select('post_id,kind').eq('user_id', userId).in('post_id', posts.map((p) => p.id)),
  ) as { post_id: string; kind: ReactionKind }[];
  const map = new Map(rows.map((r) => [r.post_id, r.kind]));
  return posts.map((p) => ({ ...p, my_reaction: map.get(p.id) ?? null }));
}

export interface FeedPage {
  posts: FeedPost[];
  nextCursor: string | null;
}

/** Keyset pagination on created_at (stable and index-friendly). */
export async function fetchFeed(opts: {
  cursor: string | null;
  userId: string | null;
  mode: 'latest' | 'following';
  category?: PostCategory | null;
  authorId?: string | null;
  attractionId?: string | null;
}): Promise<FeedPage> {
  let q = supabase
    .from('posts')
    .select(`*, ${AUTHOR}, images:post_images(*)`)
    .eq('moderation_status', 'visible')
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (opts.cursor) q = q.lt('created_at', opts.cursor);
  if (opts.category) q = q.eq('category', opts.category);
  if (opts.authorId) q = q.eq('author_id', opts.authorId);
  if (opts.attractionId) q = q.eq('attraction_id', opts.attractionId);
  if (opts.mode === 'following') {
    if (!opts.userId) return { posts: [], nextCursor: null };
    const follows = unwrap(await supabase.from('follows').select('following_id').eq('follower_id', opts.userId)) as {
      following_id: string;
    }[];
    if (follows.length === 0) return { posts: [], nextCursor: null };
    q = q.in('author_id', follows.map((f) => f.following_id));
  }
  const rows = unwrap(await q) as (Post & { author: AuthorSummary | null; images: PostImage[] })[];
  const posts = (await withMyReactions(rows, opts.userId)).map((p) => ({
    ...p,
    images: [...(p.images ?? [])].filter((i) => i.moderation_status === 'visible').sort((a, b) => a.position - b.position),
  }));
  return { posts, nextCursor: rows.length === PAGE_SIZE ? (rows[rows.length - 1]?.created_at ?? null) : null };
}

export async function fetchPost(id: string, userId: string | null): Promise<{ post: FeedPost; comments: ThreadComment[] }> {
  const post = unwrap(await supabase.from('posts').select(`*, ${AUTHOR}, images:post_images(*)`).eq('id', id).single()) as Post & {
    author: AuthorSummary | null;
    images: PostImage[];
  };
  const comments = unwrap(
    await supabase.from('comments').select(`*, ${AUTHOR}`).eq('post_id', id).order('created_at').limit(300),
  ) as ThreadComment[];
  const [withReaction] = await withMyReactions([post], userId);
  return { post: { ...withReaction!, images: [...post.images].sort((a, b) => a.position - b.position) }, comments };
}

export interface NewImage {
  uri: string;
  mimeType: string;
  width?: number;
  height?: number;
  altText?: string;
}

export async function createPost(
  userId: string,
  input: { category: PostCategory; body: string; attraction_id?: string | null; park_id?: string | null },
  images: NewImage[],
): Promise<Post> {
  const post = unwrap(await supabase.from('posts').insert(input).select('*').single()) as Post;
  for (const [position, img] of images.entries()) {
    const path = buildUserStoragePath(userId, img.mimeType);
    const body = await (await fetch(img.uri)).arrayBuffer();
    const up = await supabase.storage.from('post-images').upload(path, body, { contentType: img.mimeType, upsert: false });
    if (up.error) throw new Error(up.error.message);
    unwrap(
      await supabase.from('post_images').insert({
        post_id: post.id,
        storage_path: path,
        width: img.width ?? null,
        height: img.height ?? null,
        alt_text: img.altText?.trim() || null,
        position,
      }),
    );
  }
  return post;
}

export async function deletePost(id: string) {
  const images = unwrap(await supabase.from('post_images').select('storage_path').eq('post_id', id)) as { storage_path: string }[];
  unwrap(await supabase.from('posts').delete().eq('id', id));
  if (images.length) await supabase.storage.from('post-images').remove(images.map((i) => i.storage_path));
}

export async function addComment(postId: string, body: string, parentId: string | null) {
  unwrap(await supabase.from('comments').insert({ post_id: postId, body, parent_id: parentId }));
}

export async function deleteComment(id: string) {
  unwrap(await supabase.from('comments').delete().eq('id', id));
}

export async function setReaction(postId: string, userId: string, kind: ReactionKind | null, current: ReactionKind | null) {
  if (kind === null || kind === current) {
    unwrap(await supabase.from('reactions').delete().eq('post_id', postId).eq('user_id', userId));
  } else if (current) {
    unwrap(await supabase.from('reactions').update({ kind }).eq('post_id', postId).eq('user_id', userId));
  } else {
    unwrap(await supabase.from('reactions').insert({ post_id: postId, kind }));
  }
}

// ----------------------------------------------------------------------------
// Profiles, follows and blocks
// ----------------------------------------------------------------------------
export async function fetchProfileByUsername(username: string): Promise<Profile> {
  return unwrap(await supabase.from('profiles').select('*').eq('username', username.toLowerCase()).single()) as Profile;
}

export async function fetchRelationship(me: string | null, other: string) {
  if (!me || me === other) return { following: false, blocked: false };
  const [f, b] = await Promise.all([
    supabase.from('follows').select('follower_id').eq('follower_id', me).eq('following_id', other).maybeSingle(),
    supabase.from('blocks').select('blocker_id').eq('blocker_id', me).eq('blocked_id', other).maybeSingle(),
  ]);
  return { following: !!f.data, blocked: !!b.data };
}

export async function follow(other: string) {
  unwrap(await supabase.from('follows').insert({ following_id: other }));
}
export async function unfollow(me: string, other: string) {
  unwrap(await supabase.from('follows').delete().eq('follower_id', me).eq('following_id', other));
}
export async function block(other: string) {
  unwrap(await supabase.from('blocks').insert({ blocked_id: other }));
}
export async function unblock(me: string, other: string) {
  unwrap(await supabase.from('blocks').delete().eq('blocker_id', me).eq('blocked_id', other));
}

export async function fetchBlocked(me: string) {
  const rows = unwrap(await supabase.from('blocks').select('blocked_id').eq('blocker_id', me)) as { blocked_id: string }[];
  if (!rows.length) return [] as AuthorSummary[];
  return unwrap(
    await supabase.from('profiles').select('id,username,display_name,avatar_path,level').in('id', rows.map((r) => r.blocked_id)),
  ) as AuthorSummary[];
}

export async function fetchUserBadgesAndAchievements(userId: string) {
  const [badges, achievements, mine] = await Promise.all([
    supabase.from('user_badges').select('awarded_at, badge:badges(*)').eq('user_id', userId),
    supabase.from('achievements').select('*').order('sort_order'),
    supabase.from('user_achievements').select('*').eq('user_id', userId),
  ]);
  return {
    badges: (unwrap(badges) as unknown as { awarded_at: string; badge: import('@dinsdelparc/shared').Badge }[]) ?? [],
    achievements: unwrap(achievements) as import('@dinsdelparc/shared').Achievement[],
    progress: unwrap(mine) as import('@dinsdelparc/shared').UserAchievement[],
  };
}

export async function fetchReviews(attractionId: string) {
  return unwrap(
    await supabase
      .from('attraction_reviews')
      .select('*, author:profiles!user_id(id,username,display_name,avatar_path,level)')
      .eq('attraction_id', attractionId)
      .order('created_at', { ascending: false })
      .limit(30),
  ) as (import('@dinsdelparc/shared').AttractionReview & { author: AuthorSummary | null })[];
}

export async function saveReview(attractionId: string, userId: string, rating: number, body: string | null) {
  const existing = (await supabase.from('attraction_reviews').select('id').eq('attraction_id', attractionId).eq('user_id', userId).maybeSingle())
    .data as { id: string } | null;
  if (existing) unwrap(await supabase.from('attraction_reviews').update({ rating, body }).eq('id', existing.id));
  else unwrap(await supabase.from('attraction_reviews').insert({ attraction_id: attractionId, rating, body }));
}

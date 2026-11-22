import type { ForumCategory, ForumReply, ForumTopic } from '@dinsdelparc/shared';
import { normalizeText } from '@dinsdelparc/shared';
import { supabase, unwrap } from '../lib/supabase';
import type { AuthorSummary } from './community';

const AUTHOR = 'author:profiles!author_id(id,username,display_name,avatar_path,level)';
export type TopicRow = ForumTopic & { author: AuthorSummary | null };
export type ReplyRow = ForumReply & { author: AuthorSummary | null };

export async function fetchCategories(): Promise<ForumCategory[]> {
  return unwrap(await supabase.from('forum_categories').select('*').order('sort_order')) as ForumCategory[];
}

export async function fetchTopics(categoryId: string, search: string | null, page: number): Promise<TopicRow[]> {
  let q = supabase
    .from('forum_topics')
    .select(`*, ${AUTHOR}`)
    .eq('category_id', categoryId)
    .eq('moderation_status', 'visible')
    .order('is_pinned', { ascending: false })
    .order('last_activity_at', { ascending: false })
    .range(page * 20, page * 20 + 19);
  const s = normalizeText(search ?? '').replace(/[%_\\]/g, '');
  if (s.length >= 2) q = q.like('search_text', `%${s}%`);
  return unwrap(await q) as TopicRow[];
}

export async function fetchTopic(id: string): Promise<{ topic: TopicRow; replies: ReplyRow[] }> {
  const [topic, replies] = await Promise.all([
    supabase.from('forum_topics').select(`*, ${AUTHOR}`).eq('id', id).single(),
    supabase.from('forum_replies').select(`*, ${AUTHOR}`).eq('topic_id', id).order('created_at').limit(500),
  ]);
  return { topic: unwrap(topic) as TopicRow, replies: unwrap(replies) as ReplyRow[] };
}

export async function createTopic(categoryId: string, title: string, body: string): Promise<string> {
  const row = unwrap(await supabase.from('forum_topics').insert({ category_id: categoryId, title, body }).select('id').single()) as {
    id: string;
  };
  return row.id;
}

export async function createReply(topicId: string, body: string, quotedReplyId: string | null) {
  unwrap(await supabase.from('forum_replies').insert({ topic_id: topicId, body, quoted_reply_id: quotedReplyId }));
}

export async function editReply(id: string, body: string) {
  unwrap(await supabase.from('forum_replies').update({ body }).eq('id', id));
}

export async function editTopic(id: string, title: string, body: string) {
  unwrap(await supabase.from('forum_topics').update({ title, body }).eq('id', id));
}

export async function deleteReply(id: string) {
  unwrap(await supabase.from('forum_replies').delete().eq('id', id));
}

export async function fetchTopicFlags(userId: string | null, topicId: string) {
  if (!userId) return { bookmarked: false, subscribed: false };
  const [b, s] = await Promise.all([
    supabase.from('forum_bookmarks').select('topic_id').eq('user_id', userId).eq('topic_id', topicId).maybeSingle(),
    supabase.from('forum_subscriptions').select('topic_id').eq('user_id', userId).eq('topic_id', topicId).maybeSingle(),
  ]);
  return { bookmarked: !!b.data, subscribed: !!s.data };
}

export async function setTopicFlag(kind: 'forum_bookmarks' | 'forum_subscriptions', userId: string, topicId: string, on: boolean) {
  if (on) unwrap(await supabase.from(kind).insert({ topic_id: topicId }));
  else unwrap(await supabase.from(kind).delete().eq('user_id', userId).eq('topic_id', topicId));
}

export async function fetchBookmarkedTopics(userId: string): Promise<TopicRow[]> {
  const rows = unwrap(await supabase.from('forum_bookmarks').select('topic_id').eq('user_id', userId)) as { topic_id: string }[];
  if (!rows.length) return [];
  return unwrap(
    await supabase.from('forum_topics').select(`*, ${AUTHOR}`).in('id', rows.map((r) => r.topic_id)).order('last_activity_at', { ascending: false }),
  ) as TopicRow[];
}

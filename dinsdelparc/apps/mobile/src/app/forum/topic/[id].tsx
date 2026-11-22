import { dbErrorKey, forumReplySchema, formatRelativeTime, type TKey } from '@dinsdelparc/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Avatar } from '../../../components/Avatar';
import { ReportSheet } from '../../../components/ReportSheet';
import { Button, Card, ErrorState, Pill, Screen, SkeletonList, Text, TextField } from '../../../components/ui';
import { useAuth } from '../../../hooks/useAuth';
import { useT } from '../../../i18n';
import { createReply, deleteReply, editReply, fetchTopic, fetchTopicFlags, setTopicFlag, type ReplyRow } from '../../../services/forum';
import { useAppTheme } from '../../../theme';

export default function TopicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useT();
  const { spacing, colors, radii } = useAppTheme();
  const { userId, canParticipate, can } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [quote, setQuote] = useState<ReplyRow | null>(null);
  const [editing, setEditing] = useState<ReplyRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{ type: 'forum_topic' | 'forum_reply'; id: string } | null>(null);
  const q = useQuery({ queryKey: ['forum-topic', id], queryFn: () => fetchTopic(id) });
  const flags = useQuery({ queryKey: ['forum-flags', id, userId], queryFn: () => fetchTopicFlags(userId, id), enabled: !!userId });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['forum-topic', id] });
    void qc.invalidateQueries({ queryKey: ['forum-topics'] });
  };
  const send = useMutation({
    mutationFn: () => (editing ? editReply(editing.id, body.trim()) : createReply(id, body.trim(), quote?.id ?? null)),
    onSuccess: () => {
      setBody('');
      setQuote(null);
      setEditing(null);
      refresh();
    },
    onError: (e) => setError(t(dbErrorKey((e as Error).message) as TKey)),
  });
  const toggleFlag = useMutation({
    mutationFn: (args: { kind: 'forum_bookmarks' | 'forum_subscriptions'; on: boolean }) => setTopicFlag(args.kind, userId!, id, args.on),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forum-flags', id] }),
  });

  if (q.isLoading) return <Screen edges={[]}><SkeletonList rows={4} height={100} /></Screen>;
  if (q.error || !q.data) return <Screen edges={[]}><ErrorState error={q.error} onRetry={() => q.refetch()} /></Screen>;
  const { topic, replies } = q.data;
  const locked = topic.is_locked && !can('forum.manage');

  const submit = () => {
    const parsed = forumReplySchema.safeParse({ body });
    if (!parsed.success) return setError(t(parsed.error.issues[0]!.message as TKey));
    setError(null);
    send.mutate();
  };

  return (
    <Screen edges={[]} keyboard onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Stack.Screen options={{ title: t('forum.title') }} />
      <Card>
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            {topic.is_pinned ? <Pill label={t('forum.pinned')} fg={colors.interactive} bg={colors.interactiveSoft} icon="pin" /> : null}
            {topic.is_locked ? <Pill label={t('forum.locked')} fg={colors.warning} bg={colors.warningSoft} icon="lock-closed" /> : null}
          </View>
          <Text variant="h2">{topic.title}</Text>
          <AuthorLine author={topic.author} at={topic.created_at} edited={!!topic.edited_at} />
          <Text>{topic.body}</Text>
          {userId ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              <Button
                label={flags.data?.bookmarked ? t('forum.bookmarked') : t('forum.bookmark')}
                icon={flags.data?.bookmarked ? 'bookmark' : 'bookmark-outline'}
                variant="secondary"
                size="sm"
                onPress={() => toggleFlag.mutate({ kind: 'forum_bookmarks', on: !flags.data?.bookmarked })}
              />
              <Button
                label={flags.data?.subscribed ? t('forum.unsubscribe') : t('forum.subscribe')}
                icon={flags.data?.subscribed ? 'notifications-off-outline' : 'notifications-outline'}
                variant="ghost"
                size="sm"
                onPress={() => toggleFlag.mutate({ kind: 'forum_subscriptions', on: !flags.data?.subscribed })}
              />
              {userId !== topic.author_id ? <Button label={t('common.report')} icon="flag-outline" variant="ghost" size="sm" onPress={() => setReport({ type: 'forum_topic', id: topic.id })} /> : null}
            </View>
          ) : null}
        </View>
      </Card>

      <Text variant="h3">{t('forum.replies', { count: replies.length })}</Text>
      {replies.map((r) => {
        const quoted = r.quoted_reply_id ? replies.find((x) => x.id === r.quoted_reply_id) : null;
        return (
          <Card key={r.id}>
            <View style={{ gap: spacing.sm }}>
              <AuthorLine author={r.author} at={r.created_at} edited={!!r.edited_at} />
              {quoted ? (
                <View style={{ borderLeftWidth: 3, borderLeftColor: colors.interactive, backgroundColor: colors.surfaceAlt, padding: spacing.sm, borderRadius: radii.sm }}>
                  <Text variant="caption" tone="muted">
                    @{quoted.author?.username}
                  </Text>
                  <Text variant="small" numberOfLines={3}>
                    {quoted.body}
                  </Text>
                </View>
              ) : null}
              <Text variant="small">{r.body}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                {canParticipate && !locked ? <Button label={t('forum.quote')} variant="ghost" size="sm" onPress={() => { setEditing(null); setQuote(r); }} /> : null}
                {userId === r.author_id && !locked ? (
                  <Button label={t('common.edit')} variant="ghost" size="sm" onPress={() => { setQuote(null); setEditing(r); setBody(r.body); }} />
                ) : null}
                {userId === r.author_id ? (
                  <Button
                    label={t('common.delete')}
                    variant="ghost"
                    size="sm"
                    onPress={() =>
                      Alert.alert(t('common.delete'), t('community.deleteConfirm'), [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: t('common.delete'), style: 'destructive', onPress: () => void deleteReply(r.id).then(refresh) },
                      ])
                    }
                  />
                ) : null}
                {userId && userId !== r.author_id ? <Button label={t('common.report')} variant="ghost" size="sm" onPress={() => setReport({ type: 'forum_reply', id: r.id })} /> : null}
              </View>
            </View>
          </Card>
        );
      })}

      {locked ? (
        <Text variant="small" tone="warning">
          {t('forum.lockedNotice')}
        </Text>
      ) : canParticipate ? (
        <Card>
          <View style={{ gap: spacing.sm }}>
            {quote ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="caption" tone="muted">
                  {t('forum.quoting', { name: `@${quote.author?.username ?? ''}` })}
                </Text>
                <Button label={t('common.cancel')} variant="ghost" size="sm" onPress={() => setQuote(null)} />
              </View>
            ) : null}
            {editing ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="caption" tone="muted">
                  {t('common.edit')}
                </Text>
                <Button label={t('common.cancel')} variant="ghost" size="sm" onPress={() => { setEditing(null); setBody(''); }} />
              </View>
            ) : null}
            <TextField label={t('forum.writeReply')} value={body} onChangeText={setBody} multiline maxLength={10000} error={error} />
            <Button label={editing ? t('common.save') : t('common.send')} icon="send" loading={send.isPending} onPress={submit} />
          </View>
        </Card>
      ) : userId ? (
        <Text variant="small" tone="muted">
          {t('profile.verifyEmail')}
        </Text>
      ) : (
        <Button label={t('common.signIn')} variant="secondary" onPress={() => router.push('/auth/sign-in')} />
      )}
      {report ? <ReportSheet visible onClose={() => setReport(null)} targetType={report.type} targetId={report.id} /> : null}
      <Text variant="caption" tone="muted">
        {formatRelativeTime(topic.last_activity_at, locale)}
      </Text>
    </Screen>
  );
}

function AuthorLine({ author, at, edited }: { author: ReplyRow['author']; at: string; edited: boolean }) {
  const { t, locale } = useT();
  return (
    <Pressable accessibilityRole="link" onPress={() => author && router.push(`/user/${author.username}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Avatar path={author?.avatar_path} name={author?.username ?? '?'} size={28} />
      <Text variant="label">@{author?.username}</Text>
      <Text variant="caption" tone="muted">
        {formatRelativeTime(at, locale)}
        {edited ? ` · ${t('community.edited')}` : ''}
      </Text>
    </Pressable>
  );
}

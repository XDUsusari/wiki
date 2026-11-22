import { commentSchema, dbErrorKey, formatRelativeTime, type TKey } from '@dinsdelparc/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { PostCard } from '../../components/PostCard';
import { ReportSheet } from '../../components/ReportSheet';
import { Button, Card, ErrorState, Screen, Section, SkeletonList, Text, TextField } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n';
import { addComment, deleteComment, deletePost, fetchPost, type ThreadComment } from '../../services/community';
import { useAppTheme } from '../../theme';

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useT();
  const { spacing } = useAppTheme();
  const { userId, canParticipate } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<ThreadComment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['post', id, userId], queryFn: () => fetchPost(id, userId) });

  const send = useMutation({
    mutationFn: () => addComment(id, body.trim(), replyTo?.parent_id ?? replyTo?.id ?? null),
    onSuccess: () => {
      setBody('');
      setReplyTo(null);
      void qc.invalidateQueries({ queryKey: ['post', id] });
      void qc.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (e) => setError(t(dbErrorKey((e as Error).message) as TKey)),
  });
  const removePost = useMutation({
    mutationFn: () => deletePost(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['feed'] });
      router.back();
    },
    onError: (e) => Alert.alert(t(dbErrorKey((e as Error).message) as TKey)),
  });
  const removeComment = useMutation({
    mutationFn: (cid: string) => deleteComment(cid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post', id] }),
  });

  if (q.isLoading) return <Screen edges={[]}><SkeletonList rows={3} height={140} /></Screen>;
  if (q.error || !q.data) return <Screen edges={[]}><ErrorState error={q.error} onRetry={() => q.refetch()} /></Screen>;
  const { post, comments } = q.data;
  const roots = comments.filter((c) => !c.parent_id);
  const childrenOf = (cid: string) => comments.filter((c) => c.parent_id === cid);

  const submit = () => {
    const parsed = commentSchema.safeParse({ body });
    if (!parsed.success) return setError(t(parsed.error.issues[0]!.message as TKey));
    setError(null);
    send.mutate();
  };

  const confirmDelete = (fn: () => void) =>
    Alert.alert(t('common.delete'), t('community.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: fn },
    ]);

  const renderComment = (c: ThreadComment, nested = false) => (
    <View key={c.id} style={{ marginLeft: nested ? spacing.xl : 0, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Pressable accessibilityRole="link" accessibilityLabel={`@${c.author?.username ?? ''}`} onPress={() => c.author && router.push(`/user/${c.author.username}`)}>
          <Avatar path={c.author?.avatar_path} name={c.author?.username ?? '?'} size={32} />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label">
            @{c.author?.username}{' '}
            <Text variant="caption" tone="muted">
              · {formatRelativeTime(c.created_at, locale)}
              {c.edited_at ? ` · ${t('community.edited')}` : ''}
            </Text>
          </Text>
          <Text variant="small">{c.body}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {canParticipate && !nested ? <Button label={t('community.reply')} variant="ghost" size="sm" onPress={() => setReplyTo(c)} /> : null}
            {userId === c.author_id ? <Button label={t('common.delete')} variant="ghost" size="sm" onPress={() => confirmDelete(() => removeComment.mutate(c.id))} /> : null}
            {userId && userId !== c.author_id ? <Button label={t('common.report')} variant="ghost" size="sm" onPress={() => setReportId(c.id)} /> : null}
          </View>
        </View>
      </View>
      {childrenOf(c.id).map((r) => renderComment(r, true))}
    </View>
  );

  return (
    <Screen edges={[]} keyboard>
      <Stack.Screen options={{ title: t('community.comments') }} />
      <PostCard post={post} detail />
      {userId === post.author_id ? (
        <Button label={t('common.delete')} icon="trash-outline" variant="danger" size="sm" onPress={() => confirmDelete(() => removePost.mutate())} />
      ) : null}
      <Section title={t('community.commentCount', { count: comments.length })}>
        {roots.map((c) => renderComment(c))}
        {canParticipate ? (
          <Card>
            <View style={{ gap: spacing.sm }}>
              {replyTo ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text variant="caption" tone="muted">
                    {t('community.replyingTo', { name: `@${replyTo.author?.username ?? ''}` })}
                  </Text>
                  <Button label={t('common.cancel')} variant="ghost" size="sm" onPress={() => setReplyTo(null)} />
                </View>
              ) : null}
              <TextField label={t('community.writeComment')} value={body} onChangeText={setBody} multiline maxLength={2000} error={error} />
              <Button label={t('common.send')} icon="send" loading={send.isPending} onPress={submit} />
            </View>
          </Card>
        ) : userId ? (
          <Text variant="small" tone="muted">
            {t('profile.verifyEmail')}
          </Text>
        ) : (
          <Button label={t('common.signIn')} variant="secondary" onPress={() => router.push('/auth/sign-in')} />
        )}
      </Section>
      {reportId ? <ReportSheet visible onClose={() => setReportId(null)} targetType="comment" targetId={reportId} /> : null}
    </Screen>
  );
}

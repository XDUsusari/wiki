import { showAlert } from '../lib/dialogs';
import { Ionicons } from '@expo/vector-icons';
import { dbErrorKey, formatRelativeTime, type ReactionKind, type TKey } from '@dinsdelparc/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useT } from '../i18n';
import { publicStorageUrl } from '../lib/supabase';
import { setReaction, type FeedPost } from '../services/community';
import { useAppTheme } from '../theme';
import { Avatar } from './Avatar';
import { ReportSheet } from './ReportSheet';
import { Card, Pill, Text } from './ui';

const REACTIONS: { kind: ReactionKind; icon: 'thumbs-up' | 'heart' | 'flash' | 'happy' }[] = [
  { kind: 'like', icon: 'thumbs-up' },
  { kind: 'love', icon: 'heart' },
  { kind: 'wow', icon: 'flash' },
  { kind: 'fun', icon: 'happy' },
];

export function PostCard({ post, detail }: { post: FeedPost; detail?: boolean }) {
  const { t, locale } = useT();
  const { colors, spacing, radii } = useAppTheme();
  const { userId, canParticipate } = useAuth();
  const qc = useQueryClient();
  const [reporting, setReporting] = useState(false);
  const [picker, setPicker] = useState(false);
  const name = post.author?.display_name || post.author?.username || t('notifications.someone');

  const react = useMutation({
    mutationFn: (kind: ReactionKind | null) => setReaction(post.id, userId!, kind, post.my_reaction),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['feed'] });
      void qc.invalidateQueries({ queryKey: ['post', post.id] });
    },
    onError: (e) => showAlert(t(dbErrorKey((e as Error).message) as TKey)),
  });

  const onReact = (kind: ReactionKind) => {
    if (!userId) return router.push('/auth/sign-in');
    if (!canParticipate) return showAlert(t('profile.verifyEmail'));
    setPicker(false);
    react.mutate(post.my_reaction === kind ? null : kind);
  };

  const mine = REACTIONS.find((r) => r.kind === post.my_reaction);

  return (
    <Card padded={false} onPress={detail ? undefined : () => router.push(`/post/${post.id}`)} accessibilityLabel={`${name}: ${post.body.slice(0, 120)}`}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Pressable
          accessibilityRole="link"
          onPress={() => post.author && router.push(`/user/${post.author.username}`)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
        >
          <Avatar path={post.author?.avatar_path} name={name} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="caption" tone="muted">
              @{post.author?.username} · {formatRelativeTime(post.created_at, locale)}
              {post.edited_at ? ` · ${t('community.edited')}` : ''}
            </Text>
          </View>
          <Pill label={t(`community.categories.${post.category}`)} fg={colors.community} bg={colors.communitySoft} />
        </Pressable>
        {post.moderation_status === 'pending_review' ? (
          <Text variant="caption" tone="warning">
            {t('community.pendingReview')}
          </Text>
        ) : null}
        {post.moderation_status === 'hidden' || post.moderation_status === 'removed' ? (
          <Text variant="caption" tone="danger">
            {t('community.hiddenNotice')}
          </Text>
        ) : null}
        <Text variant="body" numberOfLines={detail ? undefined : 8}>
          {post.body}
        </Text>
      </View>
      {post.images.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
          {post.images.map((img) => {
            const uri = publicStorageUrl('post-images', img.storage_path);
            const ratio = img.width && img.height ? img.width / img.height : 4 / 3;
            return uri ? (
              <Image
                key={img.id}
                source={{ uri }}
                accessibilityLabel={img.alt_text ?? undefined}
                style={{ width: post.images.length === 1 ? '100%' : '49.7%', aspectRatio: post.images.length === 1 ? Math.max(0.8, Math.min(ratio, 1.8)) : 1, backgroundColor: colors.surfaceAlt }}
                contentFit="cover"
                transition={150}
                recyclingKey={img.id}
              />
            ) : null;
          })}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mine ? t(`community.reactions.${mine.kind}`) : t('community.reactions.like')}
          accessibilityState={{ selected: !!mine }}
          onPress={() => onReact(mine?.kind ?? 'like')}
          onLongPress={() => setPicker((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: spacing.sm, minHeight: 44 }}
        >
          <Ionicons name={mine ? mine.icon : 'thumbs-up-outline'} size={18} color={mine ? colors.interactive : colors.textMuted} />
          <Text variant="label" tone={mine ? 'interactive' : 'muted'}>
            {t('community.reactionCount', { count: post.reaction_count })}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('community.commentCount', { count: post.comment_count })}
          onPress={() => router.push(`/post/${post.id}`)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: spacing.sm, minHeight: 44 }}
        >
          <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
          <Text variant="label" tone="muted">
            {t('community.commentCount', { count: post.comment_count })}
          </Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.share')}
          onPress={() => Share.share({ message: `${post.body.slice(0, 200)}\n\ndinsdelparc://post/${post.id}` })}
          style={{ padding: spacing.sm, minHeight: 44, justifyContent: 'center' }}
        >
          <Ionicons name="share-outline" size={18} color={colors.textMuted} />
        </Pressable>
        {userId && userId !== post.author_id ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.report')} onPress={() => setReporting(true)} style={{ padding: spacing.sm, minHeight: 44, justifyContent: 'center' }}>
            <Ionicons name="flag-outline" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {picker ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radii.md, margin: spacing.sm }}>
          {REACTIONS.map((r) => (
            <Pressable key={r.kind} accessibilityRole="button" accessibilityLabel={t(`community.reactions.${r.kind}`)} onPress={() => onReact(r.kind)} style={{ padding: spacing.sm }}>
              <Ionicons name={r.icon} size={22} color={post.my_reaction === r.kind ? colors.interactive : colors.textMuted} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <ReportSheet visible={reporting} onClose={() => setReporting(false)} targetType="post" targetId={post.id} />
    </Card>
  );
}

import { showAlert } from '../../lib/dialogs';
import { dbErrorKey, type AppRole, type TKey } from '@dinsdelparc/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AchievementsList, BadgesRow } from '../../components/AchievementsList';
import { PostCard } from '../../components/PostCard';
import { ProfileHeader } from '../../components/ProfileHeader';
import { ReportSheet } from '../../components/ReportSheet';
import { Button, EmptyState, ErrorState, Screen, Section, SkeletonList, Text } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n';
import { supabase } from '../../lib/supabase';
import {
  block,
  fetchFeed,
  fetchProfileByUsername,
  fetchRelationship,
  fetchUserBadgesAndAchievements,
  follow,
  unblock,
  unfollow,
} from '../../services/community';
import { useAppTheme } from '../../theme';

export default function PublicProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { t } = useT();
  const { spacing } = useAppTheme();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [reporting, setReporting] = useState(false);
  const profile = useQuery({ queryKey: ['profile', username], queryFn: () => fetchProfileByUsername(username) });
  const pid = profile.data?.id;
  const roles = useQuery({
    queryKey: ['profile', username, 'roles'],
    enabled: !!pid,
    queryFn: async () => ((await supabase.from('user_roles').select('role').eq('user_id', pid!)).data ?? []).map((r) => r.role as AppRole),
  });
  const rel = useQuery({ queryKey: ['profile', username, 'rel', userId], enabled: !!pid, queryFn: () => fetchRelationship(userId, pid!) });
  const gami = useQuery({ queryKey: ['achievements', pid], enabled: !!pid, queryFn: () => fetchUserBadgesAndAchievements(pid!) });
  const posts = useInfiniteQuery({
    queryKey: ['feed', 'user', pid, userId],
    enabled: !!pid,
    queryFn: ({ pageParam }) => fetchFeed({ cursor: pageParam, userId, mode: 'latest', authorId: pid }),
    initialPageParam: null as string | null,
    getNextPageParam: (l) => l.nextCursor,
  });

  const action = useMutation({
    mutationFn: async (kind: 'follow' | 'unfollow' | 'block' | 'unblock') => {
      if (kind === 'follow') await follow(pid!);
      if (kind === 'unfollow') await unfollow(userId!, pid!);
      if (kind === 'block') await block(pid!);
      if (kind === 'unblock') await unblock(userId!, pid!);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile', username] });
      void qc.invalidateQueries({ queryKey: ['feed'] });
    },
    onError: (e) => showAlert(t(dbErrorKey((e as Error).message) as TKey)),
  });

  if (profile.isLoading) return <Screen edges={[]}><SkeletonList rows={3} height={100} /></Screen>;
  if (profile.error || !profile.data) return <Screen edges={[]}><ErrorState error={profile.error ?? new Error('not found')} /></Screen>;
  const p = profile.data;
  const me = userId === p.id;
  const list = posts.data?.pages.flatMap((x) => x.posts) ?? [];

  return (
    <Screen edges={[]} onRefresh={() => { void profile.refetch(); void posts.refetch(); }}>
      <Stack.Screen options={{ title: `@${p.username}` }} />
      <ProfileHeader profile={p} roles={roles.data ?? []} />
      {!me && userId ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          {!rel.data?.blocked ? (
            <Button
              label={rel.data?.following ? t('profile.unfollow') : t('profile.follow')}
              icon={rel.data?.following ? 'person-remove-outline' : 'person-add-outline'}
              loading={action.isPending}
              onPress={() => action.mutate(rel.data?.following ? 'unfollow' : 'follow')}
            />
          ) : null}
          <Button
            label={rel.data?.blocked ? t('profile.unblock') : t('profile.block')}
            icon="ban-outline"
            variant="ghost"
            onPress={() =>
              rel.data?.blocked
                ? action.mutate('unblock')
                : showAlert(t('profile.block'), t('profile.blockConfirm'), [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('profile.block'), style: 'destructive', onPress: () => action.mutate('block') },
                  ])
            }
          />
          <Button label={t('common.report')} icon="flag-outline" variant="ghost" onPress={() => setReporting(true)} />
        </View>
      ) : null}
      {!userId && !me ? <Button label={t('common.signIn')} variant="secondary" onPress={() => router.push('/auth/sign-in')} /> : null}
      <Section title={t('profile.badges')}>
        <BadgesRow badges={gami.data?.badges ?? []} />
      </Section>
      <Section title={t('profile.achievements')}>
        {p.show_stats || me ? (
          gami.data ? <AchievementsList achievements={gami.data.achievements.filter((a) => gami.data!.progress.some((x) => x.achievement_id === a.id && x.unlocked_at))} progress={gami.data.progress} /> : null
        ) : (
          <Text variant="small" tone="muted">{t('profile.statsHidden')}</Text>
        )}
      </Section>
      <Section title={t('profile.posts')}>
        {list.length === 0 && !posts.isLoading ? <EmptyState icon="chatbubbles-outline" title={t('community.noPosts')} /> : null}
        {list.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
        {posts.hasNextPage ? <Button label={t('common.loadMore')} variant="secondary" onPress={() => posts.fetchNextPage()} /> : null}
      </Section>
      <ReportSheet visible={reporting} onClose={() => setReporting(false)} targetType="profile" targetId={p.id} />
    </Screen>
  );
}

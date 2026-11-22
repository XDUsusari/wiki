import { POST_CATEGORIES, type PostCategory } from '@dinsdelparc/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OfflineBanner } from '../../components/OfflineBanner';
import { PostCard } from '../../components/PostCard';
import { Button, Card, Chip, EmptyState, ErrorState, Segmented, SkeletonList, Text } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n';
import { isBackendConfigured } from '../../lib/env';
import { fetchFeed } from '../../services/community';
import { useAppTheme } from '../../theme';

export default function CommunityTab() {
  const { t } = useT();
  const { colors, spacing } = useAppTheme();
  const { userId } = useAuth();
  const [mode, setMode] = useState<'latest' | 'following'>('latest');
  const [category, setCategory] = useState<PostCategory | null>(null);

  const feed = useInfiniteQuery({
    queryKey: ['feed', mode, category, userId],
    queryFn: ({ pageParam }) => fetchFeed({ cursor: pageParam, userId, mode, category }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: isBackendConfigured,
  });
  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? [];

  const header = (
    <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="h1">{t('community.title')}</Text>
        <Button label={t('community.newPost')} icon="create-outline" size="sm" onPress={() => router.push(userId ? '/post/new' : '/auth/sign-in')} />
      </View>
      <Card onPress={() => router.push('/forum')} accessibilityLabel={t('forum.title')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Text variant="h3" style={{ flex: 1 }}>
            {t('forum.title')}
          </Text>
          <Text variant="label" tone="interactive">
            {t('forum.categories')} →
          </Text>
        </View>
      </Card>
      <Segmented
        options={[
          { value: 'latest', label: t('community.feed') },
          { value: 'following', label: t('community.following') },
        ]}
        value={mode}
        onChange={setMode}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        <Chip label={t('search.all')} selected={category === null} onPress={() => setCategory(null)} />
        {POST_CATEGORIES.map((c) => (
          <Chip key={c} label={t(`community.categories.${c}`)} selected={category === c} onPress={() => setCategory(c)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <OfflineBanner />
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        ListHeaderComponent={header}
        ListEmptyComponent={
          feed.isLoading ? (
            <SkeletonList rows={3} height={160} />
          ) : feed.error ? (
            <ErrorState error={feed.error} onRetry={() => feed.refetch()} />
          ) : (
            <EmptyState
              icon="chatbubbles-outline"
              title={mode === 'following' ? t('community.noFollowingPosts') : t('community.noPosts')}
              body={t('community.guidelinesBody')}
              action={t('community.newPost')}
              onAction={() => router.push(userId ? '/post/new' : '/auth/sign-in')}
            />
          )
        }
        onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
        onEndReachedThreshold={0.4}
        ListFooterComponent={feed.isFetchingNextPage ? <SkeletonList rows={1} height={120} /> : undefined}
        refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={() => void feed.refetch()} tintColor={colors.interactive} />}
      />
    </SafeAreaView>
  );
}

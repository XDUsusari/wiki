import { formatRelativeTime, pickI18n } from '@dinsdelparc/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Divider, ListRow } from '../../../components/Rows';
import { Button, Card, EmptyState, ErrorState, Pill, Screen, SkeletonList, TextField } from '../../../components/ui';
import { useAuth } from '../../../hooks/useAuth';
import { useT } from '../../../i18n';
import { fetchCategories, fetchTopics } from '../../../services/forum';
import { useAppTheme } from '../../../theme';

export default function ForumCategory() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, locale } = useT();
  const { colors, spacing } = useAppTheme();
  const { userId } = useAuth();
  const [search, setSearch] = useState('');
  const cats = useQuery({ queryKey: ['forum-categories'], queryFn: fetchCategories });
  const cat = cats.data?.find((c) => c.slug === slug);
  const topics = useInfiniteQuery({
    queryKey: ['forum-topics', cat?.id, search.trim()],
    enabled: !!cat,
    queryFn: ({ pageParam }) => fetchTopics(cat!.id, search, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === 20 ? all.length : undefined),
  });
  const rows = topics.data?.pages.flat() ?? [];
  return (
    <Screen edges={[]} onRefresh={() => topics.refetch()} refreshing={topics.isRefetching}>
      <Stack.Screen options={{ title: cat ? (pickI18n(cat.name_i18n, locale) ?? '') : t('forum.title') }} />
      <TextField label={t('common.search')} placeholder={t('forum.searchPlaceholder')} value={search} onChangeText={setSearch} returnKeyType="search" />
      {cat && (!cat.is_locked || false) ? (
        <Button label={t('forum.newTopic')} icon="add" size="sm" onPress={() => router.push(userId ? `/forum/new?category=${cat.id}` : '/auth/sign-in')} />
      ) : null}
      {topics.isLoading || cats.isLoading ? <SkeletonList rows={5} height={64} /> : null}
      {topics.error ? <ErrorState error={topics.error} onRetry={() => topics.refetch()} /> : null}
      {!topics.isLoading && rows.length === 0 ? <EmptyState icon="chatbubbles-outline" title={t('forum.noTopics')} /> : null}
      {rows.length ? (
        <Card>
          {rows.map((tp, i) => (
            <View key={tp.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                title={tp.title}
                subtitle={`@${tp.author?.username ?? ''} · ${t('forum.replies', { count: tp.reply_count })} · ${t('forum.lastActivity', { time: formatRelativeTime(tp.last_activity_at, locale) })}`}
                icon={tp.is_pinned ? 'pin' : tp.is_locked ? 'lock-closed-outline' : 'chatbubble-ellipses-outline'}
                onPress={() => router.push(`/forum/topic/${tp.id}`)}
                right={
                  <View style={{ gap: 4, alignItems: 'flex-end' }}>
                    {tp.is_pinned ? <Pill label={t('forum.pinned')} fg={colors.interactive} bg={colors.interactiveSoft} /> : null}
                    {tp.is_locked ? <Pill label={t('forum.locked')} fg={colors.warning} bg={colors.warningSoft} /> : null}
                  </View>
                }
              />
            </View>
          ))}
        </Card>
      ) : null}
      {topics.hasNextPage ? (
        <Button label={t('common.loadMore')} variant="secondary" loading={topics.isFetchingNextPage} onPress={() => topics.fetchNextPage()} style={{ alignSelf: 'center', marginTop: spacing.sm }} />
      ) : null}
    </Screen>
  );
}

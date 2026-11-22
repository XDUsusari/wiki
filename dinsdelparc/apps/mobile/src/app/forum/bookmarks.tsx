import { formatRelativeTime } from '@dinsdelparc/shared';
import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { View } from 'react-native';
import { Divider, ListRow } from '../../components/Rows';
import { Card, EmptyState, Screen, SkeletonList } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n';
import { fetchBookmarkedTopics } from '../../services/forum';

export default function Bookmarks() {
  const { t, locale } = useT();
  const { userId } = useAuth();
  const q = useQuery({ queryKey: ['forum-bookmarks', userId], queryFn: () => fetchBookmarkedTopics(userId!), enabled: !!userId });
  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: t('forum.bookmarks') }} />
      {q.isLoading ? <SkeletonList rows={4} height={56} /> : null}
      {q.data?.length === 0 ? <EmptyState icon="bookmark-outline" title={t('common.empty')} /> : null}
      {q.data?.length ? (
        <Card>
          {q.data.map((tp, i) => (
            <View key={tp.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow title={tp.title} subtitle={t('forum.lastActivity', { time: formatRelativeTime(tp.last_activity_at, locale) })} icon="bookmark" onPress={() => router.push(`/forum/topic/${tp.id}`)} />
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

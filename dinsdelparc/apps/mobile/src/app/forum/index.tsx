import { pickI18n } from '@dinsdelparc/shared';
import { useQuery } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { View } from 'react-native';
import { Divider, ListRow } from '../../components/Rows';
import { Button, Card, ErrorState, Screen, SkeletonList } from '../../components/ui';
import type { IconName } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n';
import { fetchCategories } from '../../services/forum';

export default function ForumHome() {
  const { t, locale } = useT();
  const { userId } = useAuth();
  const q = useQuery({ queryKey: ['forum-categories'], queryFn: fetchCategories });
  return (
    <Screen edges={[]} onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Stack.Screen options={{ title: t('forum.title') }} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button label={t('forum.newTopic')} icon="add" size="sm" onPress={() => router.push(userId ? '/forum/new' : '/auth/sign-in')} />
        {userId ? <Button label={t('forum.bookmarks')} icon="bookmark-outline" variant="secondary" size="sm" onPress={() => router.push('/forum/bookmarks')} /> : null}
      </View>
      {q.isLoading ? <SkeletonList rows={6} height={56} /> : null}
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : null}
      <Card>
        {(q.data ?? []).map((c, i) => (
          <View key={c.id}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              title={pickI18n(c.name_i18n, locale) ?? c.slug}
              subtitle={`${pickI18n(c.description_i18n, locale) ?? ''} · ${t('forum.topics', { count: c.topic_count })}`}
              icon={c.icon as IconName}
              onPress={() => router.push(`/forum/category/${c.slug}`)}
            />
          </View>
        ))}
      </Card>
    </Screen>
  );
}

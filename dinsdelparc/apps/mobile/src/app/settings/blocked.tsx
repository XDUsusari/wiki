import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { View } from 'react-native';
import { Divider, ListRow } from '../../components/Rows';
import { Button, Card, EmptyState, Screen, SkeletonList } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n';
import { fetchBlocked, unblock } from '../../services/community';

export default function Blocked() {
  const { t } = useT();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['blocked', userId], queryFn: () => fetchBlocked(userId!), enabled: !!userId });
  const un = useMutation({ mutationFn: (id: string) => unblock(userId!, id), onSuccess: () => qc.invalidateQueries({ queryKey: ['blocked'] }) });
  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: t('settings.blocked') }} />
      {q.isLoading ? <SkeletonList rows={2} height={56} /> : null}
      {q.data?.length === 0 ? <EmptyState icon="ban-outline" title={t('settings.noBlocked')} /> : null}
      {q.data?.length ? (
        <Card>
          {q.data.map((u, i) => (
            <View key={u.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow title={u.display_name || u.username} subtitle={`@${u.username}`} right={<Button label={t('profile.unblock')} size="sm" variant="secondary" onPress={() => un.mutate(u.id)} />} />
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

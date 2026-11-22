import { Ionicons } from '@expo/vector-icons';
import { formatRelativeTime, pickI18n, type I18nText, type TKey } from '@dinsdelparc/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { Button, EmptyState, ErrorState, Screen, SkeletonList, Text } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useT } from '../i18n';
import { routeForNotification } from '../lib/push';
import { fetchNotifications, markRead, type NotificationRow } from '../services/notifications';
import { useAppTheme } from '../theme';

export default function Notifications() {
  const { t, locale } = useT();
  const { colors, spacing, radii } = useAppTheme();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications', 'list', userId], queryFn: fetchNotifications, enabled: !!userId });
  const read = useMutation({
    mutationFn: markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const text = (n: NotificationRow) => {
    const actor = n.actor?.display_name || n.actor?.username || t('notifications.someone');
    const name = n.type === 'achievement' ? (pickI18n(n.data.name as I18nText, locale) ?? '') : '';
    return t(`notifications.${n.type}` as TKey, { actor, name });
  };

  if (!userId) return <Screen edges={[]}><EmptyState title={t('common.signInRequired')} action={t('common.signIn')} onAction={() => router.push('/auth/sign-in')} /></Screen>;

  return (
    <Screen edges={[]} onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      {q.data?.some((n) => !n.read_at) ? <Button label={t('notifications.markAllRead')} icon="checkmark-done" variant="secondary" size="sm" onPress={() => read.mutate('all')} /> : null}
      {q.isLoading ? <SkeletonList rows={5} height={60} /> : null}
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : null}
      {q.data?.length === 0 ? <EmptyState icon="notifications-off-outline" title={t('notifications.empty')} /> : null}
      <View style={{ gap: spacing.sm }}>
        {(q.data ?? []).map((n) => (
          <Pressable
            key={n.id}
            accessibilityRole="button"
            accessibilityLabel={text(n)}
            accessibilityState={{ selected: !n.read_at }}
            onPress={() => {
              if (!n.read_at) read.mutate([n.id]);
              const route = routeForNotification({ entity_type: n.entity_type, entity_id: n.entity_type === 'profile' ? undefined : n.entity_id });
              if (n.entity_type === 'profile' && n.actor) router.push(`/user/${n.actor.username}`);
              else if (route) router.push(route as never);
            }}
            style={{
              flexDirection: 'row',
              gap: spacing.md,
              alignItems: 'center',
              padding: spacing.md,
              borderRadius: radii.md,
              backgroundColor: n.read_at ? colors.surface : colors.interactiveSoft,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {n.actor ? (
              <Avatar path={n.actor.avatar_path} name={n.actor.username} size={36} />
            ) : (
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={n.type === 'moderation' ? 'shield-outline' : n.type === 'achievement' || n.type === 'badge' ? 'trophy-outline' : 'notifications-outline'} size={18} color={colors.interactive} />
              </View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="small">{text(n)}</Text>
              {typeof n.data.note === 'string' && n.data.note ? (
                <Text variant="caption" tone="muted">
                  {n.data.note}
                </Text>
              ) : null}
              <Text variant="caption" tone="muted">
                {formatRelativeTime(n.created_at, locale)}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

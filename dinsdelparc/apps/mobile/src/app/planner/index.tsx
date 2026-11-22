import { formatDate } from '@dinsdelparc/shared';
import { router, Stack } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, EmptyState, ErrorState, Screen, SkeletonList, Text } from '../../components/ui';
import { usePlans } from '../../hooks/queries';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n';
import { isLocalId } from '../../stores/offlineQueue';
import { useAppTheme } from '../../theme';

export default function PlannerHome() {
  const { t, locale } = useT();
  const { spacing } = useAppTheme();
  const { userId } = useAuth();
  const plans = usePlans();

  if (!userId) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: t('planner.title') }} />
        <EmptyState icon="calendar-outline" title={t('home.planTitle')} body={t('profile.guestBody')} action={t('common.signIn')} onAction={() => router.push('/auth/sign-in')} />
      </Screen>
    );
  }
  return (
    <Screen edges={[]} onRefresh={() => plans.refetch()} refreshing={plans.isRefetching}>
      <Stack.Screen options={{ title: t('planner.myPlans') }} />
      <Button label={t('planner.newPlan')} icon="add" onPress={() => router.push('/planner/new')} />
      {plans.isLoading ? <SkeletonList rows={3} /> : null}
      {plans.error ? <ErrorState error={plans.error} onRetry={() => plans.refetch()} /> : null}
      {plans.data?.length === 0 ? <EmptyState icon="calendar-outline" title={t('planner.noPlans')} body={t('home.planBody')} /> : null}
      {(plans.data ?? []).map((p) => (
        <Card key={p.id} onPress={() => router.push(`/planner/${encodeURIComponent(p.id)}`)} accessibilityLabel={p.title}>
          <View style={{ gap: 4 }}>
            <Text variant="h3">{p.title}</Text>
            <Text variant="small" tone="muted">
              {p.visit_date ? formatDate(p.visit_date, locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : t('planner.date')}
              {' · '}
              {t('common.people', { count: p.party_size })}
            </Text>
            {isLocalId(p.id) ? (
              <Text variant="caption" tone="warning">
                {t('planner.savedOffline')}
              </Text>
            ) : null}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

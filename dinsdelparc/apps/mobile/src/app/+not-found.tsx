import { router, Stack } from 'expo-router';
import { EmptyState, Screen } from '../components/ui';
import { useT } from '../i18n';

export default function NotFound() {
  const { t } = useT();
  return (
    <Screen>
      <Stack.Screen options={{ title: t('errors.notFound') }} />
      <EmptyState icon="compass-outline" title={t('errors.notFound')} action={t('tabs.home')} onAction={() => router.replace('/')} />
    </Screen>
  );
}

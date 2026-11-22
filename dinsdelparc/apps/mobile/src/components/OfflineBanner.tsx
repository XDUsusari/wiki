import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useIsOnline } from '../hooks/useNetwork';
import { useT } from '../i18n';
import { useOfflineQueue } from '../stores/offlineQueue';
import { useAppTheme } from '../theme';
import { Text } from './ui/Text';

/** Connection indicator + pending offline changes. */
export function OfflineBanner() {
  const online = useIsOnline();
  const pending = useOfflineQueue((s) => s.ops.length);
  const { colors, spacing } = useAppTheme();
  const { t } = useT();
  if (online && pending === 0) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg, paddingVertical: 8, backgroundColor: colors.warningSoft }}
    >
      <Ionicons name={online ? 'sync-outline' : 'cloud-offline-outline'} size={16} color={colors.warning} />
      <Text variant="caption" style={{ color: colors.warning, flex: 1 }}>
        {online ? t('offline.pendingSync', { count: pending }) : t('offline.banner')}
        {!online && pending > 0 ? ` · ${t('offline.pendingSync', { count: pending })}` : ''}
      </Text>
    </View>
  );
}

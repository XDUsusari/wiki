import { Ionicons } from '@expo/vector-icons';
import { dbErrorKey, type TKey } from '@dinsdelparc/shared';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View, type DimensionValue } from 'react-native';
import { useT } from '../../i18n';
import { useAppTheme } from '../../theme';
import { Button, type IconName } from './Button';
import { Text } from './Text';

export function EmptyState({ icon = 'sparkles-outline', title, body, action, onAction }: {
  icon?: IconName;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
}) {
  const { colors, spacing, radii } = useAppTheme();
  return (
    <View style={[styles.empty, { backgroundColor: colors.surfaceAlt, borderRadius: radii.lg, padding: spacing.xl, gap: spacing.sm }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.interactiveSoft }]}>
        <Ionicons name={icon} size={26} color={colors.interactive} />
      </View>
      <Text variant="bodyStrong" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="small" tone="muted" align="center">
          {body}
        </Text>
      ) : null}
      {action && onAction ? <Button label={action} onPress={onAction} variant="secondary" size="sm" style={{ alignSelf: 'center', marginTop: 4 }} /> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useT();
  const key = dbErrorKey(error instanceof Error ? error.message : String(error)) as TKey;
  return <EmptyState icon="cloud-offline-outline" title={t(key)} action={onRetry ? t('common.retry') : undefined} onAction={onRetry} />;
}

export function Loading({ label }: { label?: string }) {
  const { colors } = useAppTheme();
  const { t } = useT();
  return (
    <View style={styles.loading} accessibilityLiveRegion="polite" accessibilityLabel={label ?? t('app.loading')}>
      <ActivityIndicator color={colors.interactive} />
    </View>
  );
}

export function Skeleton({ height = 16, width = '100%', radius = 8 }: { height?: number; width?: DimensionValue; radius?: number }) {
  const { colors } = useAppTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height, width, borderRadius: radius, backgroundColor: colors.skeleton, opacity }}
    />
  );
}

export function SkeletonList({ rows = 3, height = 72 }: { rows?: number; height?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} radius={16} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center' },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  loading: { padding: 32, alignItems: 'center', justifyContent: 'center' },
});

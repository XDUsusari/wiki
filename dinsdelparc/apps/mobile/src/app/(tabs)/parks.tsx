import { Ionicons } from '@expo/vector-icons';
import { onColor, pickI18n } from '@dinsdelparc/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { OriginBadge } from '../../components/Badges';
import { Card, ErrorState, Screen, Section, SkeletonList, Text } from '../../components/ui';
import { useT } from '../../i18n';
import { isBackendConfigured } from '../../lib/env';
import { fetchParks } from '../../services/content';
import { useAppTheme } from '../../theme';

export default function ParksTab() {
  const { t, locale } = useT();
  const { spacing, radii } = useAppTheme();
  const parks = useQuery({ queryKey: ['parks'], queryFn: fetchParks, enabled: isBackendConfigured });
  const groups = [
    { title: t('parks.themeParks'), items: (parks.data ?? []).filter((p) => p.kind === 'theme_park') },
    { title: t('parks.waterPark'), items: (parks.data ?? []).filter((p) => p.kind === 'water_park') },
  ];
  return (
    <Screen onRefresh={() => parks.refetch()} refreshing={parks.isRefetching}>
      <View style={{ gap: 4 }}>
        <Text variant="h1">{t('parks.title')}</Text>
        <Text tone="muted">{t('parks.subtitle')}</Text>
      </View>
      {parks.isLoading ? <SkeletonList rows={3} height={150} /> : null}
      {parks.error ? <ErrorState error={parks.error} onRetry={() => parks.refetch()} /> : null}
      {groups.map((g) =>
        g.items.length ? (
          <Section key={g.title} title={g.title}>
            {g.items.map((p) => {
              const fg = onColor(p.accent_color);
              return (
                <Card key={p.id} onPress={() => router.push(`/park/${p.slug}`)} padded={false} accessibilityLabel={p.name}>
                  <View style={{ backgroundColor: p.accent_color, padding: spacing.xl, minHeight: 120, justifyContent: 'flex-end', borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg }}>
                    <Ionicons name={p.kind === 'water_park' ? 'water' : 'sparkles'} size={28} color={fg} />
                    <Text variant="h2" style={{ color: fg }}>
                      {p.name}
                    </Text>
                  </View>
                  <View style={{ padding: spacing.lg, gap: spacing.sm }}>
                    <Text variant="small" tone="muted" numberOfLines={3}>
                      {pickI18n(p.tagline_i18n, locale)}
                    </Text>
                    <OriginBadge origin={p.data_origin} />
                  </View>
                </Card>
              );
            })}
          </Section>
        ) : null,
      )}
    </Screen>
  );
}

import { pickI18n } from '@dinsdelparc/shared';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { OriginBadge } from '../../components/Badges';
import { Hero } from '../../components/Hero';
import { AttractionRow, Divider, ListRow } from '../../components/Rows';
import { Card, ErrorState, Screen, Section, SkeletonList, Text } from '../../components/ui';
import { useLiveStatus } from '../../hooks/queries';
import { useT } from '../../i18n';
import { fetchArea } from '../../services/content';

export default function AreaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useT();
  const live = useLiveStatus();
  const q = useQuery({ queryKey: ['area', id], queryFn: () => fetchArea(id) });
  if (q.isLoading) return <Screen edges={[]}><SkeletonList rows={4} /></Screen>;
  if (q.error || !q.data) return <Screen edges={[]}><ErrorState error={q.error} onRetry={() => q.refetch()} /></Screen>;
  const { area, park, attractions, restaurants, shops, shows } = q.data;
  const others = [
    ...shows.map((s) => ({ ...s, kind: 'show' as const, icon: 'musical-notes-outline' as const })),
    ...restaurants.map((s) => ({ ...s, kind: 'restaurant' as const, icon: 'restaurant-outline' as const })),
    ...shops.map((s) => ({ ...s, kind: 'shop' as const, icon: 'bag-handle-outline' as const })),
  ];
  return (
    <Screen edges={[]} onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Stack.Screen options={{ title: area.name }} />
      <Hero title={area.name} subtitle={park.name} color={area.accent_color} imagePath={area.hero_image_path} imageCredit={area.image_credit}>
        <View style={{ marginTop: 8 }}>
          <OriginBadge origin={area.data_origin} />
        </View>
      </Hero>
      <Text>{pickI18n(area.description_i18n, locale) ?? t('parks.noItems')}</Text>
      <Section title={t('parks.attractionsInArea')}>
        <Card>
          {attractions.length === 0 ? (
            <Text variant="small" tone="muted">{t('parks.noItems')}</Text>
          ) : (
            attractions.map((a, i) => (
              <View key={a.id}>
                {i > 0 ? <Divider /> : null}
                <AttractionRow attraction={a} wait={live.waitFor(a.id)} accent={area.accent_color} onPress={() => router.push(`/attraction/${a.id}`)} />
              </View>
            ))
          )}
        </Card>
      </Section>
      <Section title={t('parks.otherInArea')}>
        <Card>
          {others.length === 0 ? (
            <Text variant="small" tone="muted">{t('parks.noItems')}</Text>
          ) : (
            others.map((o, i) => (
              <View key={`${o.kind}-${o.id}`}>
                {i > 0 ? <Divider /> : null}
                <ListRow title={o.name} icon={o.icon} iconColor={area.accent_color} onPress={() => router.push(`/venue/${o.kind}/${o.id}`)} />
              </View>
            ))
          )}
        </Card>
      </Section>
    </Screen>
  );
}

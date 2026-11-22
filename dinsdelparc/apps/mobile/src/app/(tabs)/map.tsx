import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OfflineBanner } from '../../components/OfflineBanner';
import { ParkMap } from '../../components/map/ParkMap';
import { POI_STYLE } from '../../components/map/poiStyle';
import { Divider, ListRow } from '../../components/Rows';
import { Button, Card, Chip, ErrorState, Pill, Text } from '../../components/ui';
import { usePublicSettings } from '../../hooks/queries';
import { useT } from '../../i18n';
import { isBackendConfigured } from '../../lib/env';
import { buildMapPoints, hasCoords, matchesFilter, type MapFilter } from '../../lib/mapPoints';
import { fetchMapData, fetchParks } from '../../services/content';
import { useAppTheme } from '../../theme';

const FILTERS: { value: MapFilter; key: 'all' | 'attractions' | 'restaurants' | 'shops' | 'shows' | 'services' | 'toilets' | 'firstAid' }[] = [
  { value: 'all', key: 'all' },
  { value: 'attraction', key: 'attractions' },
  { value: 'restaurant', key: 'restaurants' },
  { value: 'show', key: 'shows' },
  { value: 'shop', key: 'shops' },
  { value: 'toilet', key: 'toilets' },
  { value: 'first_aid', key: 'firstAid' },
  { value: 'service', key: 'services' },
];

export default function MapTab() {
  const { t } = useT();
  const { colors, spacing } = useAppTheme();
  const [filter, setFilter] = useState<MapFilter>('all');
  const [park, setPark] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const settings = usePublicSettings();
  const parks = useQuery({ queryKey: ['parks'], queryFn: fetchParks, enabled: isBackendConfigured });
  const data = useQuery({ queryKey: ['map', 'data'], queryFn: fetchMapData, enabled: isBackendConfigured });

  const all = useMemo(() => (data.data ? buildMapPoints(data.data) : []), [data.data]);
  const visible = all.filter((p) => matchesFilter(p, filter) && (!park || p.parkId === park));
  const plotted = visible.filter(hasCoords);
  const unplaced = visible.filter((p) => !hasCoords(p));
  const sel = all.find((p) => p.key === selected) ?? null;
  const view = settings.data?.mapDefaultView ?? { latitude: 41.087, longitude: 1.157, zoom: 14.5, verified: false };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <OfflineBanner />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm }}>
        <Text variant="h1">{t('map.title')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          <Chip label={t('parks.filterAll')} selected={park === null} onPress={() => setPark(null)} />
          {(parks.data ?? []).map((p) => (
            <Chip key={p.id} label={p.name} color={p.accent_color} selected={park === p.id} onPress={() => setPark(p.id)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }} accessibilityLabel={t('map.filters')}>
          {FILTERS.map((f) => (
            <Chip
              key={f.value}
              label={t(`map.${f.key}`)}
              icon={f.value === 'all' ? 'apps-outline' : POI_STYLE[f.value === 'service' ? 'service' : f.value].icon}
              selected={filter === f.value}
              onPress={() => setFilter(f.value)}
            />
          ))}
        </ScrollView>
      </View>
      {data.error ? (
        <View style={{ padding: spacing.lg }}>
          <ErrorState error={data.error} onRetry={() => data.refetch()} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {showList ? (
            <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
              {unplaced.length === 0 && plotted.length === 0 ? <Text tone="muted">{t('map.noPoints')}</Text> : null}
              <Card>
                {[...plotted, ...unplaced].map((p, i) => (
                  <View key={p.key}>
                    {i > 0 ? <Divider /> : null}
                    <ListRow
                      title={p.name}
                      subtitle={hasCoords(p) ? (p.location!.coords_verified ? null : t('map.unverifiedPoint')) : t('map.withoutLocation')}
                      icon={POI_STYLE[p.kind].icon}
                      iconColor={POI_STYLE[p.kind].color}
                      onPress={p.route ? () => router.push(p.route as never) : undefined}
                    />
                  </View>
                ))}
              </Card>
            </ScrollView>
          ) : (
            <ParkMap points={plotted} center={view} selected={selected} onSelect={setSelected} />
          )}
          <View style={{ position: 'absolute', left: spacing.md, top: spacing.md, right: 64, gap: spacing.sm }} pointerEvents="box-none">
            <Card style={{ padding: spacing.md }}>
              <Text variant="caption" tone="muted">
                {t('map.disclaimer')} {t('map.attribution')}
              </Text>
              {unplaced.length > 0 ? (
                <Text variant="caption" tone="warning" style={{ marginTop: 4 }}>
                  {t('map.withoutLocation')}: {unplaced.length}
                </Text>
              ) : null}
            </Card>
          </View>
          <View style={{ position: 'absolute', left: spacing.md, bottom: spacing.md }}>
            <Button label={showList ? t('map.title') : t('map.list')} icon={showList ? 'map-outline' : 'list-outline'} size="sm" variant="secondary" onPress={() => setShowList((v) => !v)} />
          </View>
          {sel && !showList ? (
            <View style={{ position: 'absolute', left: spacing.md, right: 64, bottom: 64 }}>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Ionicons name={POI_STYLE[sel.kind].icon} size={22} color={POI_STYLE[sel.kind].color} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text variant="bodyStrong">{sel.name}</Text>
                    {sel.location && !sel.location.coords_verified ? <Pill label={t('map.unverifiedPoint')} fg={colors.warning} bg={colors.warningSoft} /> : null}
                  </View>
                  {sel.route ? <Button label={t('map.openDetails')} size="sm" onPress={() => router.push(sel.route as never)} /> : null}
                </View>
              </Card>
            </View>
          ) : null}
        </View>
      )}
    </SafeAreaView>
  );
}

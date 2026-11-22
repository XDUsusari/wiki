import { formatClock, formatDate, pickI18n, safeExternalUrl, type Attraction } from '@dinsdelparc/shared';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, View } from 'react-native';
import { AnnouncementCard } from '../../components/AnnouncementCard';
import { OriginBadge } from '../../components/Badges';
import { Hero } from '../../components/Hero';
import { AttractionRow, Divider, ListRow } from '../../components/Rows';
import { ReportSheet } from '../../components/ReportSheet';
import { Button, Card, Chip, EmptyState, ErrorState, Screen, Section, SkeletonList, Text } from '../../components/ui';
import { useLiveStatus } from '../../hooks/queries';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n';
import { fetchParkBundle } from '../../services/content';
import { useAppTheme } from '../../theme';

export default function ParkScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, locale } = useT();
  const { spacing, colors } = useAppTheme();
  const { userId } = useAuth();
  const live = useLiveStatus();
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const q = useQuery({ queryKey: ['park', slug], queryFn: () => fetchParkBundle(slug) });

  const attractionsByArea = useMemo(() => {
    const list = q.data?.attractions ?? [];
    return areaFilter ? list.filter((a) => a.area_id === areaFilter) : list;
  }, [q.data?.attractions, areaFilter]);

  if (q.isLoading) return <Screen edges={[]}><SkeletonList rows={4} height={120} /></Screen>;
  if (q.error || !q.data) return <Screen edges={[]}><ErrorState error={q.error} onRetry={() => q.refetch()} /></Screen>;

  const { park, areas, restaurants, shops, shows, services, schedules, announcements } = q.data;
  const official = safeExternalUrl(park.official_url);
  const verifiedSchedules = schedules.filter((s) => s.data_origin === 'verified');
  const isWater = park.kind === 'water_park';
  const pools = q.data.attractions.filter((a) => a.attraction_type === 'pool');
  const rides = attractionsByArea.filter((a) => !isWater || a.attraction_type !== 'pool');

  const venueList = (items: { id: string; name: string; data_origin: Attraction['data_origin'] }[], kind: 'restaurant' | 'shop' | 'show' | 'service', icon: 'restaurant-outline' | 'bag-handle-outline' | 'musical-notes-outline' | 'medkit-outline') =>
    items.length === 0 ? (
      <Text variant="small" tone="muted">
        {t('parks.noItems')}
      </Text>
    ) : (
      items.map((v, i) => (
        <View key={v.id}>
          {i > 0 ? <Divider /> : null}
          <ListRow title={v.name} icon={icon} iconColor={park.accent_color} onPress={() => router.push(`/venue/${kind}/${v.id}`)} right={v.data_origin !== 'verified' ? <OriginBadge origin={v.data_origin} /> : undefined} />
        </View>
      ))
    );

  return (
    <Screen edges={[]} onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <Stack.Screen options={{ title: park.name }} />
      <Hero title={park.name} subtitle={pickI18n(park.tagline_i18n, locale)} color={park.accent_color} imagePath={park.hero_image_path} imageCredit={park.image_credit}>
        <View style={{ marginTop: spacing.sm }}>
          <OriginBadge origin={park.data_origin} />
        </View>
      </Hero>

      <Section title={t('parks.about')}>
        <Text>{pickI18n(park.description_i18n, locale) ?? t('parks.noItems')}</Text>
        {pickI18n(park.season_i18n, locale) ? (
          <Text variant="small" tone="muted">
            {t('parks.season')}: {pickI18n(park.season_i18n, locale)}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          {official ? <Button label={t('common.officialSite')} icon="open-outline" variant="secondary" size="sm" onPress={() => Linking.openURL(official)} /> : null}
          {userId ? <Button label={t('attraction.reportIncorrect')} icon="flag-outline" variant="ghost" size="sm" onPress={() => setReporting(true)} /> : null}
        </View>
      </Section>

      <Section title={t('parks.schedule')} subtitle={t('parks.upcoming')}>
        <Card>
          {verifiedSchedules.length === 0 ? (
            <Text variant="small" tone="muted">
              {t('parks.scheduleEmpty')}
            </Text>
          ) : (
            verifiedSchedules.slice(0, 7).map((s) => (
              <View key={s.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                <Text variant="small">{formatDate(s.schedule_date, locale, { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                <Text variant="label">{s.is_closed ? t('parks.scheduleClosed') : `${formatClock(s.opens_at)} – ${formatClock(s.closes_at)}`}</Text>
              </View>
            ))
          )}
        </Card>
      </Section>

      {announcements.length ? (
        <Section title={t('parks.news')}>
          {announcements.map((a) => (
            <AnnouncementCard key={a.id} item={a} />
          ))}
        </Section>
      ) : null}

      {areas.length ? (
        <Section title={t('parks.areas')}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {areas.map((a) => (
              <Card key={a.id} onPress={() => router.push(`/area/${a.id}`)} style={{ width: '47%', borderLeftWidth: 5, borderLeftColor: a.accent_color }} accessibilityLabel={a.name}>
                <Text variant="bodyStrong">{a.name}</Text>
                <Text variant="caption" tone="muted">
                  {t('parks.attractions')}: {q.data.attractions.filter((x) => x.area_id === a.id).length}
                </Text>
              </Card>
            ))}
          </View>
        </Section>
      ) : null}

      <Section title={t('parks.attractions')}>
        {areas.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Chip label={t('parks.filterAll')} selected={areaFilter === null} onPress={() => setAreaFilter(null)} />
            {areas.map((a) => (
              <Chip key={a.id} label={a.name} color={a.accent_color} selected={areaFilter === a.id} onPress={() => setAreaFilter(a.id)} />
            ))}
          </View>
        ) : null}
        <Card>
          {rides.length === 0 ? (
            <Text variant="small" tone="muted">
              {t('parks.noItems')}
            </Text>
          ) : (
            rides.map((a, i) => (
              <View key={a.id}>
                {i > 0 ? <Divider /> : null}
                <AttractionRow attraction={a} wait={live.waitFor(a.id)} accent={areas.find((x) => x.id === a.area_id)?.accent_color ?? park.accent_color} onPress={() => router.push(`/attraction/${a.id}`)} />
              </View>
            ))
          )}
        </Card>
      </Section>

      {isWater ? (
        <Section title={t('parks.pools')}>
          <Card>
            {pools.length === 0 ? (
              <Text variant="small" tone="muted">
                {t('parks.noItems')}
              </Text>
            ) : (
              pools.map((a, i) => (
                <View key={a.id}>
                  {i > 0 ? <Divider /> : null}
                  <AttractionRow attraction={a} wait={live.waitFor(a.id)} accent={park.accent_color} onPress={() => router.push(`/attraction/${a.id}`)} />
                </View>
              ))
            )}
          </Card>
        </Section>
      ) : null}

      <Section title={t('parks.shows')}>
        <Card>{venueList(shows, 'show', 'musical-notes-outline')}</Card>
      </Section>
      <Section title={t('parks.restaurants')}>
        <Card>{venueList(restaurants, 'restaurant', 'restaurant-outline')}</Card>
      </Section>
      <Section title={t('parks.shops')}>
        <Card>{venueList(shops, 'shop', 'bag-handle-outline')}</Card>
      </Section>
      <Section title={t('parks.services')}>
        <Card>{venueList(services, 'service', 'medkit-outline')}</Card>
      </Section>
      {!areas.length && !q.data.attractions.length ? <EmptyState title={t('parks.noItems')} /> : null}
      <Text variant="caption" tone="muted" align="center" style={{ color: colors.textMuted }}>
        {t('app.disclaimer')}
      </Text>
      <ReportSheet visible={reporting} onClose={() => setReporting(false)} targetType="park_info" targetId={park.id} defaultReason="incorrect_info" title={t('attraction.reportIncorrect')} hint={t('attraction.reportIncorrectHint')} />
    </Screen>
  );
}

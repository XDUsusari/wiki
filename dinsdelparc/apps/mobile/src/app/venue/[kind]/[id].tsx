import { formatClock, formatDate, formatDuration, pickI18n } from '@dinsdelparc/shared';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { OriginBadge } from '../../../components/Badges';
import { Hero } from '../../../components/Hero';
import { ReportSheet } from '../../../components/ReportSheet';
import { Button, Card, ErrorState, Screen, Section, SkeletonList, Text } from '../../../components/ui';
import { useFavorites } from '../../../hooks/queries';
import { useAuth } from '../../../hooks/useAuth';
import { useT } from '../../../i18n';
import { fetchVenue, type VenueKind } from '../../../services/content';
import { useAppTheme } from '../../../theme';

const KINDS: VenueKind[] = ['restaurant', 'shop', 'show', 'service'];

export default function VenueScreen() {
  const params = useLocalSearchParams<{ kind: string; id: string }>();
  const kind = (KINDS.includes(params.kind as VenueKind) ? params.kind : 'restaurant') as VenueKind;
  const { t, locale } = useT();
  const { spacing } = useAppTheme();
  const { userId } = useAuth();
  const favorites = useFavorites();
  const [reporting, setReporting] = useState(false);
  const q = useQuery({ queryKey: ['venues', kind, params.id], queryFn: () => fetchVenue(kind, params.id) });
  if (q.isLoading) return <Screen edges={[]}><SkeletonList rows={3} /></Screen>;
  if (q.error || !q.data) return <Screen edges={[]}><ErrorState error={q.error} onRetry={() => q.refetch()} /></Screen>;
  const { venue, park, area, sessions } = q.data;
  const v = venue as typeof venue & { cuisine?: string | null; service_type?: string; price_range?: number | null; dietary_i18n?: Record<string, string>; duration_seconds?: number | null; season_i18n?: Record<string, string> };
  const favKind = kind === 'service' ? null : kind;
  const fav = favKind ? favorites.isFavorite(favKind, venue.id) : false;
  const verified = venue.data_origin === 'verified';
  const verifiedSessions = sessions.filter((s) => s.data_origin === 'verified');

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: venue.name }} />
      <Hero title={venue.name} subtitle={[park.name, area?.name].filter(Boolean).join(' · ')} color={area?.accent_color ?? park.accent_color} imagePath={venue.hero_image_path} imageCredit={venue.image_credit}>
        <View style={{ marginTop: 8 }}>
          <OriginBadge origin={venue.data_origin} />
        </View>
      </Hero>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        {favKind ? (
          <Button
            label={fav ? t('attraction.unfavorite') : t('attraction.favorite')}
            icon={fav ? 'heart' : 'heart-outline'}
            variant="secondary"
            size="sm"
            onPress={() => (userId ? favorites.toggle.mutate({ kind: favKind, id: venue.id }) : router.push('/auth/sign-in'))}
          />
        ) : null}
        {userId ? <Button label={t('attraction.reportIncorrect')} icon="flag-outline" variant="ghost" size="sm" onPress={() => setReporting(true)} /> : null}
      </View>
      <Text>{pickI18n(venue.description_i18n, locale) ?? t('parks.noItems')}</Text>
      <Card>
        {kind === 'restaurant' ? (
          <View style={{ gap: 8 }}>
            {v.service_type ? <Row label={t('venue.service')} value={t(`venue.serviceTypes.${v.service_type as 'table'}`)} /> : null}
            {v.cuisine ? <Row label={t('venue.cuisine')} value={v.cuisine} /> : null}
            {verified && v.price_range ? <Row label={t('venue.price')} value={'€'.repeat(v.price_range)} /> : null}
            {verified && pickI18n(v.dietary_i18n ?? {}, locale) ? <Row label={t('venue.dietary')} value={pickI18n(v.dietary_i18n ?? {}, locale)!} /> : null}
          </View>
        ) : null}
        {kind === 'show' ? (
          <View style={{ gap: 8 }}>
            {verified && v.duration_seconds ? <Row label={t('attraction.duration')} value={formatDuration(v.duration_seconds, locale)} /> : null}
            {pickI18n(v.season_i18n ?? {}, locale) ? <Row label={t('parks.season')} value={pickI18n(v.season_i18n ?? {}, locale)!} /> : null}
          </View>
        ) : null}
        {kind !== 'show' && kind !== 'restaurant' ? <Text variant="small" tone="muted">{park.name}</Text> : null}
      </Card>
      {kind === 'show' ? (
        <Section title={t('venue.sessions')}>
          <Card>
            {verifiedSessions.length === 0 ? (
              <Text variant="small" tone="muted">{t('venue.noSessions')}</Text>
            ) : (
              verifiedSessions.map((s) => (
                <Row key={s.id} label={formatDate(s.session_date, locale, { weekday: 'short', day: 'numeric', month: 'short' })} value={formatClock(s.starts_at)} />
              ))
            )}
          </Card>
        </Section>
      ) : null}
      <ReportSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        targetType="park_info"
        targetId={park.id}
        defaultReason="incorrect_info"
        title={t('attraction.reportIncorrect')}
        hint={`${venue.name}. ${t('attraction.reportIncorrectHint')}`}
      />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="small" tone="muted">{label}</Text>
      <Text variant="label" style={{ flexShrink: 1 }} align="right">{value}</Text>
    </View>
  );
}

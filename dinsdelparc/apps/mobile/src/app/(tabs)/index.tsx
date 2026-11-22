import { Ionicons } from '@expo/vector-icons';
import {
  formatClock,
  formatLongToday,
  formatRelativeTime,
  greetingKey,
  onColor,
  pickI18n,
  weatherKind,
  type Announcement,
  type Park,
  type ParkSchedule,
} from '@dinsdelparc/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { AnnouncementCard } from '../../components/AnnouncementCard';
import { WaitBadge } from '../../components/Badges';
import { Logo } from '../../components/Logo';
import { ListRow } from '../../components/Rows';
import { Button, Card, EmptyState, ErrorState, IconButton, Pill, Screen, Section, SkeletonList, Text } from '../../components/ui';
import { useLiveStatus, usePublicSettings } from '../../hooks/queries';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n';
import { isBackendConfigured } from '../../lib/env';
import { fetchAllAttractions, fetchAnnouncements, fetchFeatured, fetchParks, fetchTodaySchedules } from '../../services/content';
import { fetchFeed } from '../../services/community';
import { fetchUnreadCount } from '../../services/notifications';
import { fetchWeather } from '../../services/weather';
import { useAppTheme } from '../../theme';

export default function Home() {
  const { t, locale } = useT();
  const { colors, spacing, radii } = useAppTheme();
  const { profile, userId } = useAuth();
  const qc = useQueryClient();

  const parks = useQuery({ queryKey: ['parks'], queryFn: fetchParks, enabled: isBackendConfigured });
  const schedules = useQuery({ queryKey: ['parks', 'schedules-today'], queryFn: fetchTodaySchedules, enabled: isBackendConfigured });
  const attractions = useQuery({ queryKey: ['parks', 'attractions'], queryFn: fetchAllAttractions, enabled: isBackendConfigured });
  const featured = useQuery({ queryKey: ['featured'], queryFn: fetchFeatured, enabled: isBackendConfigured });
  const news = useQuery({ queryKey: ['announcements'], queryFn: () => fetchAnnouncements(6), enabled: isBackendConfigured });
  const community = useQuery({
    queryKey: ['feed', 'home', userId],
    queryFn: () => fetchFeed({ cursor: null, userId, mode: 'latest' }),
    enabled: isBackendConfigured,
  });
  const unread = useQuery({ queryKey: ['notifications', 'unread', userId], queryFn: fetchUnreadCount, enabled: !!userId, refetchInterval: 60_000 });
  const live = useLiveStatus();
  const settings = usePublicSettings();
  const view = settings.data?.mapDefaultView;
  const weather = useQuery({
    queryKey: ['weather', view?.latitude, view?.longitude],
    queryFn: () => fetchWeather(view!.latitude, view!.longitude),
    enabled: !!view,
    staleTime: 30 * 60_000,
  });

  if (!isBackendConfigured) {
    return (
      <Screen>
        <Logo />
        <EmptyState icon="construct-outline" title={t('errors.configMissing')} body={t('app.disclaimer')} />
      </Screen>
    );
  }

  const greeting = t(`greeting.${greetingKey()}`);
  const name = profile?.display_name || profile?.username;
  const currentWaits = (attractions.data ?? [])
    .map((a) => ({ a, w: live.waitFor(a.id) }))
    .filter((x) => x.w.kind === 'wait')
    .sort((x, y) => (y.w.updatedAt ?? '').localeCompare(x.w.updatedAt ?? ''))
    .slice(0, 5);
  const incidents = (news.data ?? []).filter((n) => n.kind === 'incident');
  const wk = weatherKind(weather.data?.code);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['parks'] });
    void qc.invalidateQueries({ queryKey: ['live'] });
    void qc.invalidateQueries({ queryKey: ['featured'] });
    void qc.invalidateQueries({ queryKey: ['announcements'] });
    void qc.invalidateQueries({ queryKey: ['feed'] });
  };

  return (
    <Screen onRefresh={refresh} refreshing={parks.isRefetching}>
      {/* Header */}
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Logo />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconButton icon="search-outline" label={t('search.title')} onPress={() => router.push('/search')} />
            <IconButton
              icon="notifications-outline"
              label={t('notifications.title')}
              badge={unread.data ?? 0}
              onPress={() => router.push(userId ? '/notifications' : '/auth/sign-in')}
            />
            <IconButton icon="person-circle-outline" label={t('tabs.profile')} onPress={() => router.push('/profile')} />
          </View>
        </View>
        <View style={{ gap: 2 }}>
          <Text variant="caption" tone="muted">
            {formatLongToday(locale)}
          </Text>
          <Text variant="h1">{name ? t('greeting.named', { greeting, name }) : t('greeting.visitor', { greeting })}</Text>
        </View>
      </View>

      {/* Park status */}
      <Section title={t('home.parksStatus')}>
        {parks.isLoading ? (
          <SkeletonList rows={1} height={150} />
        ) : parks.error ? (
          <ErrorState error={parks.error} onRetry={() => parks.refetch()} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}>
            {(parks.data ?? []).map((p) => (
              <ParkStatusCard
                key={p.id}
                park={p}
                schedule={schedules.data?.find((s) => s.park_id === p.id && s.is_published && s.data_origin === 'verified') ?? null}
                incidents={incidents.filter((i) => i.park_id === p.id)}
              />
            ))}
          </ScrollView>
        )}
      </Section>

      {/* Plan */}
      <Card style={{ backgroundColor: colors.brand, borderColor: colors.brand }} onPress={() => router.push('/planner')} accessibilityLabel={t('home.planTitle')}>
        <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
          <View style={{ width: 52, height: 52, borderRadius: radii.lg, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="calendar-outline" size={28} color={colors.brandOn} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="h3" style={{ color: colors.brandOn }}>
              {t('home.planTitle')}
            </Text>
            <Text variant="small" style={{ color: colors.brandOn, opacity: 0.9 }}>
              {t('home.planBody')}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={22} color={colors.brandOn} />
        </View>
      </Card>

      {/* Live information */}
      <Section title={t('home.live')} subtitle={t('home.liveDisclaimer')}>
        <Card>
          {live.isLoading || attractions.isLoading ? (
            <SkeletonList rows={2} height={44} />
          ) : currentWaits.length === 0 ? (
            <Text variant="small" tone="muted">
              {t('home.liveEmpty')}
            </Text>
          ) : (
            currentWaits.map(({ a, w }) => (
              <ListRow key={a.id} title={a.name} onPress={() => router.push(`/attraction/${a.id}`)} right={<WaitBadge wait={w} />} />
            ))
          )}
        </Card>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Ionicons name={wk === 'clear' ? 'sunny-outline' : wk === 'rainy' || wk === 'drizzle' ? 'rainy-outline' : wk === 'storm' ? 'thunderstorm-outline' : 'partly-sunny-outline'} size={32} color={colors.warning} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">{t('home.weather')}</Text>
              {weather.data && weather.data.temperature != null ? (
                <>
                  <Text variant="small">
                    {wk ? t(`weather.${wk}`) : ''} · {t('weather.now', { temp: weather.data.temperature })}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {t('weather.range', { max: weather.data.max ?? '–', min: weather.data.min ?? '–' })}
                    {weather.data.rainProbability != null ? ` · ${t('weather.rain', { value: weather.data.rainProbability })}` : ''}
                  </Text>
                </>
              ) : (
                <Text variant="small" tone="muted">
                  {weather.isLoading ? t('app.loading') : t('home.weatherUnavailable')}
                </Text>
              )}
              <Text variant="caption" tone="muted">
                {t('home.weatherSource')}
              </Text>
            </View>
          </View>
        </Card>
      </Section>

      {/* Discover */}
      {featured.data && featured.data.length > 0 ? (
        <Section title={t('home.discover')}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.lg }}>
            {featured.data.map((f) => {
              const bg = f.accent_color ?? colors.interactive;
              const fg = onColor(bg);
              const go = () => {
                if (f.target_kind === 'attraction' && f.target_id) router.push(`/attraction/${f.target_id}`);
                else if (f.target_kind === 'post' && f.target_id) router.push(`/post/${f.target_id}`);
                else if (f.target_kind === 'forum_topic' && f.target_id) router.push(`/forum/topic/${f.target_id}`);
                else if (f.target_kind === 'area' && f.target_id) router.push(`/area/${f.target_id}`);
                else if ((f.target_kind === 'show' || f.target_kind === 'restaurant') && f.target_id) router.push(`/venue/${f.target_kind}/${f.target_id}`);
              };
              return (
                <Card key={f.id} onPress={go} style={{ width: 200, backgroundColor: bg, borderColor: bg, minHeight: 130, justifyContent: 'flex-end' }} accessibilityLabel={pickI18n(f.title_i18n, locale) ?? ''}>
                  <Text variant="h3" style={{ color: fg }}>
                    {pickI18n(f.title_i18n, locale)}
                  </Text>
                  <Text variant="small" style={{ color: fg, opacity: 0.9 }}>
                    {pickI18n(f.subtitle_i18n, locale)}
                  </Text>
                </Card>
              );
            })}
          </ScrollView>
        </Section>
      ) : null}

      {/* News */}
      <Section title={t('home.news')}>
        {news.isLoading ? (
          <SkeletonList rows={2} />
        ) : (news.data ?? []).length === 0 ? (
          <EmptyState icon="newspaper-outline" title={t('common.empty')} />
        ) : (
          (news.data ?? []).map((n) => <AnnouncementCard key={n.id} item={n} />)
        )}
      </Section>

      {/* Community */}
      <Section title={t('home.communityHighlights')} action={t('common.seeAll')} onAction={() => router.push('/community')}>
        {(community.data?.posts ?? []).slice(0, 3).map((p) => (
          <Card key={p.id} onPress={() => router.push(`/post/${p.id}`)} accessibilityLabel={p.body.slice(0, 100)}>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Avatar path={p.author?.avatar_path} name={p.author?.username ?? '?'} size={32} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label">@{p.author?.username}</Text>
                <Text variant="small" numberOfLines={2}>
                  {p.body}
                </Text>
                <Text variant="caption" tone="muted">
                  {formatRelativeTime(p.created_at, locale)} · {t('community.commentCount', { count: p.comment_count })}
                </Text>
              </View>
            </View>
          </Card>
        ))}
        {community.data && community.data.posts.length === 0 ? (
          <EmptyState icon="people-outline" title={t('community.noPosts')} action={t('community.newPost')} onAction={() => router.push(userId ? '/post/new' : '/auth/sign-in')} />
        ) : null}
      </Section>

      <Text variant="caption" tone="muted" align="center">
        {t('app.disclaimer')}
      </Text>
    </Screen>
  );
}

function ParkStatusCard({ park, schedule, incidents }: { park: Park; schedule: ParkSchedule | null; incidents: Announcement[] }) {
  const { t, locale } = useT();
  const { spacing } = useAppTheme();
  const fg = onColor(park.accent_color);
  const scheduleText = !schedule
    ? t('home.noVerifiedSchedule')
    : schedule.is_closed
      ? t('home.closedToday')
      : t('home.openToday', { opens: formatClock(schedule.opens_at), closes: formatClock(schedule.closes_at) });
  return (
    <Card
      onPress={() => router.push(`/park/${park.slug}`)}
      style={{ width: 270, backgroundColor: park.accent_color, borderColor: park.accent_color }}
      accessibilityLabel={`${park.name}. ${scheduleText}`}
      accessibilityHint={t('home.viewPark')}
    >
      <View style={{ gap: spacing.sm }}>
        <Text variant="h3" style={{ color: fg }}>
          {park.name}
        </Text>
        <Text variant="small" style={{ color: fg, opacity: 0.92 }} numberOfLines={2}>
          {pickI18n(park.tagline_i18n, locale)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="time-outline" size={16} color={fg} />
          <Text variant="label" style={{ color: fg, flex: 1 }}>
            {scheduleText}
          </Text>
        </View>
        {incidents.length > 0 ? <Pill label={`${t('home.incidents')}: ${incidents.length}`} fg="#8A5300" bg="#FFF4E0" icon="warning-outline" /> : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          {schedule?.source_url ? (
            <Text variant="caption" style={{ color: fg, opacity: 0.85 }}>
              {t('common.source')}: {new URL(schedule.source_url).hostname}
            </Text>
          ) : (
            <View />
          )}
          <Button label={t('home.viewPark')} size="sm" variant="secondary" onPress={() => router.push(`/park/${park.slug}`)} />
        </View>
      </View>
    </Card>
  );
}

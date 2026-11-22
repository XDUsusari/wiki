import { showAlert } from '../../lib/dialogs';
import { Ionicons } from '@expo/vector-icons';
import {
  dbErrorKey,
  formatClock,
  formatDuration,
  formatRelativeTime,
  pickI18n,
  validateWaitMinutes,
  waitReportErrorKey,
  type Attraction,
  type TKey,
} from '@dinsdelparc/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnnouncementCard } from '../../components/AnnouncementCard';
import { Avatar } from '../../components/Avatar';
import { OriginBadge, StatusPill, WaitBadge } from '../../components/Badges';
import { Hero } from '../../components/Hero';
import { ReportSheet } from '../../components/ReportSheet';
import { AttractionRow, Divider, ListRow } from '../../components/Rows';
import { StarRating } from '../../components/StarRating';
import { Button, Card, Chip, ErrorState, Screen, Section, SkeletonList, Text, TextField } from '../../components/ui';
import { useFavorites, useLiveStatus, usePlans } from '../../hooks/queries';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n';
import { successFeedback } from '../../lib/haptics';
import { fetchReviews, saveReview } from '../../services/community';
import { fetchAttraction } from '../../services/content';
import { fetchWaitHistory, submitWaitReport } from '../../services/operations';
import { addPlanItem } from '../../services/planner';
import { useAppTheme } from '../../theme';

const QUICK_MINUTES = [0, 5, 10, 15, 20, 30, 45, 60, 90];

export default function AttractionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useT();
  const { spacing } = useAppTheme();
  const { userId, canParticipate, can } = useAuth();
  const live = useLiveStatus();
  const favorites = useFavorites();
  const [reporting, setReporting] = useState(false);
  const [planPicker, setPlanPicker] = useState(false);

  const q = useQuery({ queryKey: ['attraction', id], queryFn: () => fetchAttraction(id) });
  const history = useQuery({ queryKey: ['wait-history', id], queryFn: () => fetchWaitHistory(id), refetchInterval: 120_000 });

  if (q.isLoading) return <Screen edges={[]}><SkeletonList rows={4} height={100} /></Screen>;
  if (q.error || !q.data) return <Screen edges={[]}><ErrorState error={q.error} onRetry={() => q.refetch()} /></Screen>;

  const { attraction: a, park, area, related, incidents } = q.data;
  const wait = live.waitFor(a.id);
  const accent = area?.accent_color ?? park.accent_color;
  const fav = favorites.isFavorite('attraction', a.id);

  const requireUser = () => {
    if (!userId) {
      router.push('/auth/sign-in');
      return false;
    }
    return true;
  };

  return (
    <Screen edges={[]} onRefresh={() => { void q.refetch(); void live.refetch(); void history.refetch(); }} refreshing={q.isRefetching}>
      <Stack.Screen options={{ title: a.name }} />
      <Hero title={a.name} subtitle={[park.name, area?.name].filter(Boolean).join(' · ')} color={accent} imagePath={a.hero_image_path} imageCredit={a.image_credit}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' }}>
          <OriginBadge origin={a.data_origin} />
        </View>
      </Hero>

      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button
          label={fav ? t('attraction.unfavorite') : t('attraction.favorite')}
          icon={fav ? 'heart' : 'heart-outline'}
          variant="secondary"
          size="sm"
          loading={favorites.toggle.isPending}
          onPress={() => requireUser() && favorites.toggle.mutate({ kind: 'attraction', id: a.id })}
        />
        <Button label={t('attraction.addToPlan')} icon="calendar-outline" variant="secondary" size="sm" onPress={() => requireUser() && setPlanPicker(true)} />
        <Button label={t('common.share')} icon="share-outline" variant="ghost" size="sm" onPress={() => Share.share({ message: `${a.name} · ${park.name}\ndinsdelparc://attraction/${a.id}` })} />
      </View>

      {/* Live */}
      <Section title={t('attraction.waitNow')}>
        <Card>
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
              <StatusPill status={wait.status} />
              <WaitBadge wait={wait} />
            </View>
            {wait.kind === 'wait' ? (
              <Text variant="caption" tone="muted">
                {t('reliability.reports', { count: wait.sampleSize })}
              </Text>
            ) : null}
            <WaitReportForm attraction={a} disabled={wait.status === 'permanently_closed'} onDone={() => { void live.refetch(); void history.refetch(); }} canReport={can('operations.report')} />
          </View>
        </Card>
        <Card>
          <Text variant="label">{t('attraction.history')}</Text>
          <WaitHistoryChart data={history.data ?? []} color={accent} />
        </Card>
      </Section>

      {/* Info */}
      <Section title={t('parks.about')}>
        <Text>{pickI18n(a.description_i18n, locale) ?? t('parks.noItems')}</Text>
        <Card>
          <InfoRow label={t('attraction.type')} value={t(`attraction.types.${a.attraction_type}`)} />
          {a.intensity ? <InfoRow label={t('attraction.intensity')} value={t(`attraction.intensities.${a.intensity}`)} /> : null}
          <SafetyBlock attraction={a} />
        </Card>
        {userId ? (
          <Button label={t('attraction.reportIncorrect')} icon="flag-outline" variant="ghost" size="sm" onPress={() => setReporting(true)} />
        ) : null}
      </Section>

      {incidents.length ? (
        <Section title={t('attraction.incidents')}>
          {incidents.map((i) => (
            <AnnouncementCard key={i.id} item={i} />
          ))}
        </Section>
      ) : null}

      <ReviewsSection attraction={a} canParticipate={canParticipate} onRequireUser={requireUser} />

      {related.length ? (
        <Section title={t('attraction.related')}>
          <Card>
            {related.map((r, i) => (
              <View key={r.id}>
                {i > 0 ? <Divider /> : null}
                <AttractionRow attraction={r} wait={live.waitFor(r.id)} accent={accent} onPress={() => router.push(`/attraction/${r.id}`)} />
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      {a.image_credit ? (
        <Text variant="caption" tone="muted">
          {t('attraction.imageCredit', { credit: `${a.image_credit}${a.image_license ? ` (${a.image_license})` : ''}` })}
        </Text>
      ) : null}

      <ReportSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        targetType="attraction_info"
        targetId={a.id}
        defaultReason="incorrect_info"
        title={t('attraction.reportIncorrect')}
        hint={t('attraction.reportIncorrectHint')}
      />
      <PlanPicker visible={planPicker} onClose={() => setPlanPicker(false)} attractionId={a.id} />
    </Screen>
  );
}

function InfoRow({ label, value, note }: { label: string; value: string; note?: string }) {
  const { spacing } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: 8 }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="small" tone="muted" style={{ flex: 1 }}>
        {label}
      </Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text variant="label" align="right">
          {value}
        </Text>
        {note ? (
          <Text variant="caption" tone="warning">
            {note}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Safety data is shown ONLY when the attraction record is verified. */
function SafetyBlock({ attraction: a }: { attraction: Attraction }) {
  const { t, locale } = useT();
  const { spacing, colors, radii } = useAppTheme();
  const verified = a.data_origin === 'verified';
  const rows: { label: string; value: string }[] = [];
  if (verified) {
    if (a.min_height_cm) rows.push({ label: t('attraction.minHeight'), value: `${a.min_height_cm} cm` });
    if (a.min_height_accompanied_cm) rows.push({ label: t('attraction.minHeightAccompanied'), value: `${a.min_height_accompanied_cm} cm` });
    if (a.max_height_cm) rows.push({ label: t('attraction.maxHeight'), value: `${a.max_height_cm} cm` });
    if (a.duration_seconds) rows.push({ label: t('attraction.duration'), value: formatDuration(a.duration_seconds, locale) });
    if (a.opened_year) rows.push({ label: t('attraction.opened'), value: String(a.opened_year) });
  }
  const restrictions = verified ? pickI18n(a.restrictions_i18n, locale) : null;
  const accessibility = verified ? pickI18n(a.accessibility_i18n, locale) : null;
  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
      {rows.map((r) => (
        <InfoRow key={r.label} label={r.label} value={r.value} />
      ))}
      {restrictions ? <InfoRow label={t('attraction.restrictions')} value={restrictions} /> : null}
      {accessibility ? <InfoRow label={t('attraction.accessibility')} value={accessibility} /> : null}
      {rows.length === 0 && !restrictions ? (
        <Text variant="small" tone="muted">
          {t('attraction.noSafetyData')}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, backgroundColor: colors.infoSoft, padding: spacing.md, borderRadius: radii.md }}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.info} />
        <Text variant="caption" style={{ color: colors.info, flex: 1 }}>
          {t('attraction.safetyDisclaimer')}
        </Text>
      </View>
    </View>
  );
}

function WaitReportForm({ attraction, disabled, onDone, canReport }: { attraction: Attraction; disabled: boolean; onDone: () => void; canReport: boolean }) {
  const { t } = useT();
  const { spacing } = useAppTheme();
  const { userId, emailVerified } = useAuth();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = useMutation({
    mutationFn: (minutes: number) => submitWaitReport(attraction.id, minutes),
    onSuccess: (r) => {
      successFeedback();
      showAlert(r.status === 'flagged' ? t('attraction.reportWaitFlagged') : t('attraction.reportWaitThanks'));
      setOpen(false);
      setValue('');
      onDone();
    },
    onError: (e) => setError(t(waitReportErrorKey((e as Error).message) as TKey)),
  });

  if (disabled) return null;
  if (!open) {
    return (
      <Button
        label={t('attraction.reportWait')}
        icon="megaphone-outline"
        variant="secondary"
        onPress={() => {
          if (!userId) return router.push('/auth/sign-in');
          if (!emailVerified) return showAlert(t('profile.verifyEmail'));
          if (!canReport) return showAlert(t('errors.notAllowed'));
          setOpen(true);
        }}
      />
    );
  }
  const send = () => {
    const err = validateWaitMinutes(value);
    if (err) return setError(t(err === 'out_of_range' ? 'validation.waitRange' : 'validation.number'));
    setError(null);
    submit.mutate(Number(value));
  };
  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="bodyStrong">{t('attraction.reportWaitTitle')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {QUICK_MINUTES.map((m) => (
          <Chip key={m} label={t('common.minutesShort', { count: m })} selected={value === String(m)} onPress={() => setValue(String(m))} />
        ))}
      </View>
      <TextField label={t('attraction.waitNow')} keyboardType="number-pad" value={value} onChangeText={setValue} maxLength={3} error={error} hint={t('attraction.reportWaitHint')} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button label={t('common.cancel')} variant="ghost" onPress={() => setOpen(false)} />
        <Button label={t('common.send')} loading={submit.isPending} onPress={send} />
      </View>
    </View>
  );
}

function WaitHistoryChart({ data, color }: { data: { bucket: string; median_minutes: number; reports: number }[]; color: string }) {
  const { t, locale } = useT();
  const { colors, spacing } = useAppTheme();
  if (data.length === 0) {
    return (
      <Text variant="small" tone="muted" style={{ marginTop: spacing.sm }}>
        {t('attraction.historyEmpty')}
      </Text>
    );
  }
  const max = Math.max(15, ...data.map((d) => Number(d.median_minutes)));
  return (
    <View style={{ marginTop: spacing.md, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 110 }}>
        {data.map((d) => {
          const v = Number(d.median_minutes);
          return (
            <View
              key={d.bucket}
              accessible
              accessibilityLabel={`${formatClock(new Date(d.bucket).toTimeString())}: ${t('common.minutes', { count: v })}, ${t('reliability.reports', { count: d.reports })}`}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}
            >
              <Text variant="caption" tone="muted" style={{ fontSize: 10 }}>
                {v}
              </Text>
              <View style={{ width: '100%', maxWidth: 22, height: Math.max(4, (v / max) * 80), backgroundColor: color, borderRadius: 4 }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" tone="muted">
          {formatRelativeTime(data[0]!.bucket, locale)}
        </Text>
        <Text variant="caption" tone="muted" style={{ color: colors.textMuted }}>
          {formatRelativeTime(data[data.length - 1]!.bucket, locale)}
        </Text>
      </View>
    </View>
  );
}

function ReviewsSection({ attraction, canParticipate, onRequireUser }: { attraction: Attraction; canParticipate: boolean; onRequireUser: () => boolean }) {
  const { t, locale } = useT();
  const { spacing } = useAppTheme();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const reviews = useQuery({ queryKey: ['reviews', attraction.id], queryFn: () => fetchReviews(attraction.id) });
  const mine = reviews.data?.find((r) => r.user_id === userId);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => saveReview(attraction.id, userId!, rating, body.trim() || null),
    onSuccess: () => {
      successFeedback();
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ['reviews', attraction.id] });
      void qc.invalidateQueries({ queryKey: ['attraction', attraction.id] });
    },
    onError: (e) => showAlert(t(dbErrorKey((e as Error).message) as TKey)),
  });

  return (
    <Section title={t('attraction.reviews')}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Text variant="display">{attraction.rating_count ? Number(attraction.rating_avg).toFixed(1) : '–'}</Text>
          <View style={{ gap: 4 }}>
            <StarRating value={Number(attraction.rating_avg)} size={18} />
            <Text variant="caption" tone="muted">
              {t('attraction.ratingCount', { count: attraction.rating_count })}
            </Text>
          </View>
        </View>
      </Card>
      {editing ? (
        <Card>
          <View style={{ gap: spacing.md }}>
            <Text variant="bodyStrong">{t('attraction.yourReview')}</Text>
            <StarRating value={rating} onChange={setRating} size={30} />
            <TextField label={t('attraction.reviews')} placeholder={t('attraction.reviewPlaceholder')} value={body} onChangeText={setBody} multiline maxLength={2000} />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button label={t('common.cancel')} variant="ghost" onPress={() => setEditing(false)} />
              <Button label={t('common.save')} disabled={rating < 1} loading={save.isPending} onPress={() => save.mutate()} />
            </View>
          </View>
        </Card>
      ) : (
        <Button
          label={mine ? t('common.edit') : t('attraction.writeReview')}
          icon="star-outline"
          variant="secondary"
          onPress={() => {
            if (!onRequireUser()) return;
            if (!canParticipate) return showAlert(t('profile.verifyEmail'));
            setRating(mine?.rating ?? 0);
            setBody(mine?.body ?? '');
            setEditing(true);
          }}
        />
      )}
      {reviews.data?.length === 0 ? (
        <Text variant="small" tone="muted">
          {t('attraction.noReviews')}
        </Text>
      ) : null}
      {reviews.data?.map((r) => (
        <Card key={r.id}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Avatar path={r.author?.avatar_path} name={r.author?.username ?? '?'} size={32} />
            <View style={{ flex: 1, gap: 4 }}>
              <ListRow title={`@${r.author?.username ?? ''}`} subtitle={formatRelativeTime(r.created_at, locale)} onPress={() => r.author && router.push(`/user/${r.author.username}`)} />
              <StarRating value={r.rating} size={14} />
              {r.body ? <Text variant="small">{r.body}</Text> : null}
              {userId && userId !== r.user_id ? (
                <Button label={t('common.report')} icon="flag-outline" variant="ghost" size="sm" onPress={() => setReportId(r.id)} />
              ) : null}
            </View>
          </View>
        </Card>
      ))}
      {reportId ? <ReportSheet visible onClose={() => setReportId(null)} targetType="review" targetId={reportId} /> : null}
    </Section>
  );
}

function PlanPicker({ visible, onClose, attractionId }: { visible: boolean; onClose: () => void; attractionId: string }) {
  const { t } = useT();
  const { colors, spacing } = useAppTheme();
  const { userId } = useAuth();
  const plans = usePlans();
  const add = async (planId: string, title: string) => {
    try {
      await addPlanItem(userId!, planId, { item_kind: 'attraction', attraction_id: attractionId, priority: 'want' });
      successFeedback();
      showAlert(t('attraction.addedToPlan', { title }));
      onClose();
    } catch (e) {
      showAlert(t(dbErrorKey((e as Error).message) as TKey));
    }
  };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.lg }}>
        <Text variant="h2">{t('planner.choose')}</Text>
        {(plans.data ?? []).map((p) => (
          <Card key={p.id} onPress={() => add(p.id, p.title)} accessibilityLabel={p.title}>
            <Text variant="bodyStrong">{p.title}</Text>
            {p.visit_date ? (
              <Text variant="caption" tone="muted">
                {p.visit_date}
              </Text>
            ) : null}
          </Card>
        ))}
        {plans.data?.length === 0 ? <Text tone="muted">{t('planner.noPlans')}</Text> : null}
        <Button
          label={t('planner.newPlan')}
          icon="add"
          variant="secondary"
          onPress={() => {
            onClose();
            router.push('/planner/new');
          }}
        />
        <Button label={t('common.close')} variant="ghost" onPress={onClose} />
      </SafeAreaView>
    </Modal>
  );
}

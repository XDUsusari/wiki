import { showAlert } from '../../lib/dialogs';
import { Ionicons } from '@expo/vector-icons';
import {
  dbErrorKey,
  formatDate,
  planProgress,
  suggestPlan,
  type ItineraryItem,
  type PlannerCandidate,
  type TKey,
} from '@dinsdelparc/shared';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, EmptyState, ErrorState, Pill, Screen, Section, SkeletonList, Text, TextField } from '../../components/ui';
import { useLiveStatus } from '../../hooks/queries';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n';
import { successFeedback } from '../../lib/haptics';
import { fetchPlannerCatalog, fetchSessionsForDate } from '../../services/content';
import {
  addPlanItem,
  deletePlan,
  deletePlanItem,
  fetchPlan,
  planKey,
  reorderPlanItems,
  updatePlanItem,
} from '../../services/planner';
import { isLocalId } from '../../stores/offlineQueue';
import { useAppTheme } from '../../theme';

export default function PlanScreen() {
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = decodeURIComponent(raw);
  const { t, locale } = useT();
  const { colors, spacing, radii } = useAppTheme();
  const { userId } = useAuth();
  const live = useLiveStatus();
  const [custom, setCustom] = useState('');
  const [showAssistant, setShowAssistant] = useState(false);

  const plan = useQuery({ queryKey: planKey(id), queryFn: () => fetchPlan(id), enabled: !isLocalId(id) });
  const catalog = useQuery({ queryKey: ['plan', 'catalog'], queryFn: fetchPlannerCatalog, staleTime: 3_600_000 });
  const date = plan.data?.plan.visit_date ?? null;
  const sessions = useQuery({ queryKey: ['plan', 'sessions', date], queryFn: () => fetchSessionsForDate(date!), enabled: !!date });

  const items = useMemo(() => [...(plan.data?.items ?? [])].sort((a, b) => a.position - b.position), [plan.data?.items]);

  const describe = (i: ItineraryItem) => {
    const c = catalog.data;
    if (i.item_kind === 'attraction') {
      const a = c?.attractions.find((x) => x.id === i.attraction_id);
      return { name: a?.name ?? '…', parkId: a?.park_id ?? null, areaId: a?.area_id ?? null, icon: 'rocket-outline' as const };
    }
    if (i.item_kind === 'show') {
      const s = c?.shows.find((x) => x.id === i.show_id);
      return { name: s?.name ?? '…', parkId: s?.park_id ?? null, areaId: s?.area_id ?? null, icon: 'musical-notes-outline' as const };
    }
    if (i.item_kind === 'restaurant') {
      const r = c?.restaurants.find((x) => x.id === i.restaurant_id);
      return { name: r?.name ?? '…', parkId: r?.park_id ?? null, areaId: r?.area_id ?? null, icon: 'restaurant-outline' as const };
    }
    return { name: i.custom_title ?? '', parkId: null, areaId: null, icon: 'flag-outline' as const };
  };

  const suggestion = useMemo(() => {
    if (!plan.data || !catalog.data) return null;
    const candidates: PlannerCandidate[] = items
      .filter((i) => !i.is_completed)
      .map((i) => {
        const d = describe(i);
        const area = catalog.data.areas.find((a) => a.id === d.areaId);
        const w = i.attraction_id ? live.waitFor(i.attraction_id) : null;
        return {
          key: i.id,
          kind: i.item_kind,
          name: d.name,
          parkId: d.parkId,
          areaId: d.areaId,
          areaOrder: area?.sort_order ?? null,
          priority: i.priority,
          status: w?.status,
          currentWaitMinutes: w?.kind === 'wait' ? w.minutes : null,
          verifiedSessions: i.show_id ? (sessions.data ?? []).filter((s) => s.show_id === i.show_id).map((s) => s.starts_at) : [],
        };
      });
    const parkOrder = plan.data.plan.park_ids.length
      ? plan.data.plan.park_ids
      : catalog.data.parks.map((p) => p.id);
    return suggestPlan(candidates, { parkOrder, includeMealBreak: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.data, catalog.data, items, sessions.data, live.data]);

  if (isLocalId(id) && !plan.data) {
    return (
      <Screen edges={[]}>
        <EmptyState icon="cloud-offline-outline" title={t('planner.savedOffline')} />
      </Screen>
    );
  }
  if (plan.isLoading) return <Screen edges={[]}><SkeletonList rows={4} /></Screen>;
  if (plan.error || !plan.data) return <Screen edges={[]}><ErrorState error={plan.error} onRetry={() => plan.refetch()} /></Screen>;

  const p = plan.data.plan;
  const progress = planProgress(items.map((i) => ({ key: i.id, isCompleted: i.is_completed, position: i.position })));
  const next = items.find((i) => i.id === progress.nextKey);
  const safe = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      showAlert(t(dbErrorKey((e as Error).message) as TKey));
    }
  };
  const move = (index: number, dir: -1 | 1) => {
    const ids = items.map((i) => i.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j]!, ids[index]!];
    void safe(() => reorderPlanItems(userId!, id, ids));
  };

  return (
    <Screen edges={[]} keyboard onRefresh={() => plan.refetch()} refreshing={plan.isRefetching}>
      <Stack.Screen options={{ title: p.title }} />
      <Card>
        <View style={{ gap: spacing.sm }}>
          <Text variant="h2">{p.title}</Text>
          <Text variant="small" tone="muted">
            {p.visit_date ? formatDate(p.visit_date, locale, { weekday: 'long', day: 'numeric', month: 'long' }) : '—'} · {t('common.people', { count: p.party_size })}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            {p.park_ids.map((pid) => {
              const park = catalog.data?.parks.find((x) => x.id === pid);
              return park ? <Pill key={pid} label={park.name} fg="#fff" bg={park.accent_color} /> : null;
            })}
          </View>
          {p.notes ? <Text variant="small">{p.notes}</Text> : null}
          <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: progress.total, now: progress.completed }} style={{ gap: 6, marginTop: spacing.sm }}>
            <Text variant="label">{t('planner.progress', { completed: progress.completed, total: progress.total })}</Text>
            <View style={{ height: 10, backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(progress.ratio * 100)}%`, height: '100%', backgroundColor: colors.success }} />
            </View>
          </View>
          {next ? (
            <Text variant="small">
              {t('planner.next')}: <Text variant="bodyStrong">{describe(next).name}</Text>
            </Text>
          ) : null}
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button label={t('planner.addItems')} icon="add" onPress={() => router.push(`/planner/add?plan=${encodeURIComponent(id)}`)} />
        <Button label={t('planner.assistant')} icon="sparkles-outline" variant="secondary" onPress={() => setShowAssistant((v) => !v)} />
      </View>

      {showAssistant && suggestion ? (
        <Section title={t('planner.assistant')} subtitle={t('planner.assistantHint')}>
          {suggestion.warnings.map((w) => (
            <View key={w} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
              <Text variant="small" tone="warning" style={{ flex: 1 }}>
                {t(`planner.warnings.${w}`)}
              </Text>
            </View>
          ))}
          <Card>
            {suggestion.steps.map((s, idx) => {
              const item = items.find((i) => i.id === s.key);
              if (!item) return null;
              const basisColor = s.basis === 'verified' ? colors.success : s.basis === 'estimate' ? colors.warning : colors.info;
              return (
                <View key={s.key} style={{ flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.sm }}>
                  <Text variant="h3" tone="muted" style={{ width: 28 }}>
                    {idx + 1}
                  </Text>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text variant="bodyStrong">
                      {describe(item).name}
                      {s.suggestedTime ? ` · ${s.suggestedTime}` : ''}
                    </Text>
                    <Pill label={t(`planner.basis.${s.basis}`)} fg={basisColor} bg={colors.surfaceAlt} />
                    {s.reasons.length ? (
                      <Text variant="caption" tone="muted">
                        {s.reasons.map((r) => t(`planner.reasons.${r}`)).join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </Card>
          <Button
            label={t('planner.assistantApply')}
            icon="checkmark-done"
            onPress={() =>
              void safe(async () => {
                const done = items.filter((i) => i.is_completed).map((i) => i.id);
                await reorderPlanItems(userId!, id, [...done, ...suggestion.steps.map((s) => s.key)]);
                successFeedback();
                showAlert(t('planner.assistantApplied'));
                setShowAssistant(false);
              })
            }
          />
        </Section>
      ) : null}

      <Section title={t('planner.items')}>
        {items.length === 0 ? <EmptyState icon="list-outline" title={t('planner.empty')} /> : null}
        {items.map((i, index) => {
          const d = describe(i);
          const w = i.attraction_id ? live.waitFor(i.attraction_id) : null;
          return (
            <Card key={i.id} style={{ opacity: i.is_completed ? 0.7 : 1 }}>
              <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: i.is_completed }}
                  accessibilityLabel={i.is_completed ? t('planner.markPending') : t('planner.markDone')}
                  onPress={() => void safe(() => updatePlanItem(userId!, id, i.id, { is_completed: !i.is_completed }))}
                  hitSlop={8}
                >
                  <Ionicons name={i.is_completed ? 'checkmark-circle' : 'ellipse-outline'} size={30} color={i.is_completed ? colors.success : colors.textMuted} />
                </Pressable>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="bodyStrong" style={{ textDecorationLine: i.is_completed ? 'line-through' : 'none' }}>
                    {d.name}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Pill label={t(`planner.priorities.${i.priority}`)} fg={i.priority === 'must' ? colors.danger : colors.textMuted} bg={colors.surfaceAlt} />
                    {w && w.kind === 'wait' ? <Text variant="caption" tone="muted">{t('common.minutesShort', { count: w.minutes })} · {t(`source.${w.source ?? 'community'}`)}</Text> : null}
                    {w && w.kind === 'closed' ? <Text variant="caption" tone="warning">{t(`status.${w.status}`)}</Text> : null}
                    {isLocalId(i.id) ? <Ionicons name="cloud-upload-outline" size={14} color={colors.warning} accessibilityLabel={t('planner.savedOffline')} /> : null}
                  </View>
                </View>
                <View>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('planner.moveUp')} onPress={() => move(index, -1)} hitSlop={6} style={{ padding: 4 }}>
                    <Ionicons name="chevron-up" size={20} color={colors.textMuted} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('planner.moveDown')} onPress={() => move(index, 1)} hitSlop={6} style={{ padding: 4 }}>
                    <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
                  </Pressable>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={t('planner.remove')} onPress={() => void safe(() => deletePlanItem(userId!, id, i.id))} hitSlop={8}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            </Card>
          );
        })}
        <Card>
          <View style={{ gap: spacing.sm }}>
            <TextField label={t('planner.addCustom')} placeholder={t('planner.customPlaceholder')} value={custom} onChangeText={setCustom} maxLength={80} />
            <Button
              label={t('common.save')}
              icon="add"
              size="sm"
              variant="secondary"
              disabled={!custom.trim()}
              onPress={() =>
                void safe(async () => {
                  await addPlanItem(userId!, id, { item_kind: 'custom', custom_title: custom.trim(), priority: 'want' });
                  setCustom('');
                })
              }
            />
          </View>
        </Card>
      </Section>

      <Button
        label={t('planner.deletePlan')}
        icon="trash-outline"
        variant="danger"
        onPress={() =>
          showAlert(t('planner.deletePlan'), t('planner.deleteConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('common.delete'),
              style: 'destructive',
              onPress: () =>
                void safe(async () => {
                  await deletePlan(userId!, id);
                  router.back();
                }),
            },
          ])
        }
      />
    </Screen>
  );
}

import { showAlert } from '../../lib/dialogs';
import { normalizeText, type ItemPriority } from '@dinsdelparc/shared';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Divider, ListRow } from '../../components/Rows';
import { Button, Card, Chip, Screen, Segmented, Text, TextField } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n';
import { successFeedback } from '../../lib/haptics';
import { fetchPlannerCatalog } from '../../services/content';
import { addPlanItem, planKey, type PlanWithItems } from '../../services/planner';
import { useAppTheme } from '../../theme';
import { useQueryClient } from '@tanstack/react-query';

type Kind = 'attraction' | 'show' | 'restaurant';

export default function AddItems() {
  const { plan: raw } = useLocalSearchParams<{ plan: string }>();
  const planId = decodeURIComponent(raw ?? '');
  const { t } = useT();
  const { spacing } = useAppTheme();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const catalog = useQuery({ queryKey: ['plan', 'catalog'], queryFn: fetchPlannerCatalog, staleTime: 3_600_000 });
  const [kind, setKind] = useState<Kind>('attraction');
  const [priority, setPriority] = useState<ItemPriority>('want');
  const [query, setQuery] = useState('');
  const current = qc.getQueryData<PlanWithItems>(planKey(planId));
  const parkFilter = current?.plan.park_ids ?? [];

  const list = useMemo(() => {
    const c = catalog.data;
    if (!c) return [];
    const src = kind === 'attraction' ? c.attractions : kind === 'show' ? c.shows : c.restaurants;
    const q = normalizeText(query);
    return src
      .filter((x) => (parkFilter.length ? parkFilter.includes(x.park_id) : true))
      .filter((x) => !q || normalizeText(x.name).includes(q));
  }, [catalog.data, kind, query, parkFilter]);

  const already = new Set((current?.items ?? []).map((i) => i.attraction_id ?? i.show_id ?? i.restaurant_id));

  const add = async (id: string, name: string) => {
    try {
      await addPlanItem(userId!, planId, {
        item_kind: kind,
        attraction_id: kind === 'attraction' ? id : null,
        show_id: kind === 'show' ? id : null,
        restaurant_id: kind === 'restaurant' ? id : null,
        priority,
      });
      successFeedback();
      showAlert(t('attraction.addedToPlan', { title: current?.plan.title ?? name }));
    } catch (e) {
      showAlert(String((e as Error).message));
    }
  };

  return (
    <Screen edges={[]} keyboard>
      <Segmented
        options={[
          { value: 'attraction', label: t('parks.attractions') },
          { value: 'show', label: t('map.shows') },
          { value: 'restaurant', label: t('parks.restaurants') },
        ]}
        value={kind}
        onChange={setKind}
      />
      <View style={{ gap: spacing.sm }}>
        <Text variant="label">{t('planner.priority')}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          {(['must', 'want', 'maybe'] as const).map((p) => (
            <Chip key={p} label={t(`planner.priorities.${p}`)} selected={priority === p} onPress={() => setPriority(p)} />
          ))}
        </View>
      </View>
      <TextField label={t('common.search')} value={query} onChangeText={setQuery} />
      <Card>
        {list.length === 0 ? <Text tone="muted">{t('parks.noItems')}</Text> : null}
        {list.map((x, i) => (
          <View key={x.id}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              title={x.name}
              subtitle={catalog.data?.parks.find((p) => p.id === x.park_id)?.name}
              icon={already.has(x.id) ? 'checkmark-circle' : 'add-circle-outline'}
              onPress={() => void add(x.id, x.name)}
            />
          </View>
        ))}
      </Card>
      <Button label={t('common.done')} fullWidth onPress={() => router.back()} />
    </Screen>
  );
}

import { dbErrorKey, itinerarySchema, type TKey } from '@dinsdelparc/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Chip, Screen, Text, TextField } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../i18n';
import { successFeedback } from '../../lib/haptics';
import { fetchParks } from '../../services/content';
import { createPlan } from '../../services/planner';
import { usePreferences } from '../../stores/preferences';
import { useAppTheme } from '../../theme';

export default function NewPlan() {
  const { t } = useT();
  const { spacing } = useAppTheme();
  const { userId } = useAuth();
  const setActive = usePreferences((s) => s.setActivePlan);
  const parks = useQuery({ queryKey: ['parks'], queryFn: fetchParks });
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [party, setParty] = useState('2');
  const [parkIds, setParkIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (!userId) return null;

  const submit = async () => {
    const parsed = itinerarySchema.safeParse({
      title,
      visit_date: date.trim() || null,
      party_size: Number(party),
      park_ids: parkIds,
      notes: notes.trim() || null,
    });
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const i of parsed.error.issues) map[String(i.path[0])] = t(i.message as TKey);
      return setErrors(map);
    }
    setErrors({});
    setSaving(true);
    try {
      const { id, result } = await createPlan(userId, parsed.data);
      successFeedback();
      setActive(id);
      if (result === 'queued') Alert.alert(t('planner.savedOffline'));
      router.replace(`/planner/${encodeURIComponent(id)}`);
    } catch (e) {
      Alert.alert(t(dbErrorKey((e as Error).message) as TKey));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={[]} keyboard>
      <TextField label={t('planner.planTitle')} placeholder={t('planner.planTitlePlaceholder')} value={title} onChangeText={setTitle} maxLength={80} error={errors.title} />
      <TextField label={t('planner.date')} placeholder={t('planner.datePlaceholder')} value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" maxLength={10} error={errors.visit_date} />
      <TextField label={t('planner.party')} value={party} onChangeText={setParty} keyboardType="number-pad" maxLength={2} error={errors.party_size} />
      <View style={{ gap: spacing.sm }}>
        <Text variant="label">{t('planner.parks')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {(parks.data ?? []).map((p) => (
            <Chip
              key={p.id}
              label={p.name}
              color={p.accent_color}
              selected={parkIds.includes(p.id)}
              onPress={() => setParkIds((prev) => (prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]))}
            />
          ))}
        </View>
      </View>
      <TextField label={t('planner.notes')} value={notes} onChangeText={setNotes} multiline maxLength={2000} error={errors.notes} />
      <Button label={t('common.save')} icon="checkmark" fullWidth loading={saving} onPress={submit} />
    </Screen>
  );
}

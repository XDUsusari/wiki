import { REPORT_REASONS, dbErrorKey, type ReportReason, type ReportTarget, type TKey } from '@dinsdelparc/shared';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '../i18n';
import { createReport } from '../services/reports';
import { useAppTheme } from '../theme';
import { Button, Chip, Text, TextField } from './ui';

/** Report flow shared by posts, comments, forum, reviews, profiles and reference data. */
export function ReportSheet({ visible, onClose, targetType, targetId, defaultReason, title, hint }: {
  visible: boolean;
  onClose: () => void;
  targetType: ReportTarget;
  targetId: string;
  defaultReason?: ReportReason;
  title?: string;
  hint?: string;
}) {
  const { t } = useT();
  const { colors, spacing } = useAppTheme();
  const [reason, setReason] = useState<ReportReason>(defaultReason ?? 'spam');
  const [details, setDetails] = useState('');
  const send = useMutation({
    mutationFn: () => createReport(targetType, targetId, reason, details.trim() || null),
    onSuccess: () => {
      Alert.alert(t('report.sent'));
      setDetails('');
      onClose();
    },
    onError: (e) => Alert.alert(t(dbErrorKey((e as Error).message) as TKey)),
  });
  const reasons = targetType === 'attraction_info' || targetType === 'park_info' ? (['incorrect_info', 'misinformation', 'other'] as const) : REPORT_REASONS;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Text variant="h2">{title ?? t('report.title')}</Text>
          {hint ? (
            <Text variant="small" tone="muted">
              {hint}
            </Text>
          ) : null}
          <Text variant="label">{t('report.reason')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {reasons.map((r) => (
              <Chip key={r} label={t(`report.reasons.${r}`)} selected={reason === r} onPress={() => setReason(r)} />
            ))}
          </View>
          <TextField label={t('report.details')} value={details} onChangeText={setDetails} multiline maxLength={2000} />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button label={t('common.cancel')} variant="ghost" onPress={onClose} />
            <Button label={t('common.send')} icon="flag-outline" loading={send.isPending} onPress={() => send.mutate()} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

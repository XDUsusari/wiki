import { showAlert } from '../lib/dialogs';
import type { DataOrigin, DisplayWait, InfoSource, OperationalStatus, TKey } from '@dinsdelparc/shared';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { formatRelativeTime } from '@dinsdelparc/shared';
import { useT } from '../i18n';
import { useAppTheme } from '../theme';
import { Pill } from './ui/Chip';
import { Text } from './ui/Text';

/** Shows where a piece of data comes from; tapping explains it. */
export function OriginBadge({ origin, interactive = true }: { origin: DataOrigin; interactive?: boolean }) {
  const { colors } = useAppTheme();
  const { t } = useT();
  const map: Record<DataOrigin, { fg: string; bg: string; icon: 'checkmark-circle' | 'time-outline' | 'flask-outline' | 'people-outline'; hint: TKey }> = {
    verified: { fg: colors.success, bg: colors.successSoft, icon: 'checkmark-circle', hint: 'origin.verifiedHint' },
    pending_verification: { fg: colors.warning, bg: colors.warningSoft, icon: 'time-outline', hint: 'origin.pendingHint' },
    demo: { fg: colors.community, bg: colors.communitySoft, icon: 'flask-outline', hint: 'origin.demoHint' },
    community: { fg: colors.info, bg: colors.infoSoft, icon: 'people-outline', hint: 'origin.communityHint' },
  };
  const m = map[origin];
  if (!interactive) return <Pill label={t(`origin.${origin}`)} fg={m.fg} bg={m.bg} icon={m.icon} />;
  return (
    <Pressable
      style={{ alignSelf: 'flex-start' }}
      accessibilityRole="button"
      accessibilityLabel={`${t(`origin.${origin}`)}. ${t(m.hint)}`}
      onPress={() => showAlert(t(`origin.${origin}`), t(m.hint))}
      hitSlop={8}
    >
      <Pill label={t(`origin.${origin}`)} fg={m.fg} bg={m.bg} icon={m.icon} />
    </Pressable>
  );
}

export function StatusPill({ status }: { status: OperationalStatus }) {
  const { colors } = useAppTheme();
  const { t } = useT();
  const s = {
    open: { fg: colors.success, bg: colors.successSoft },
    temporarily_closed: { fg: colors.warning, bg: colors.warningSoft },
    permanently_closed: { fg: colors.danger, bg: colors.dangerSoft },
    unknown: { fg: colors.textMuted, bg: colors.surfaceAlt },
  }[status];
  return <Pill label={t(`status.${status}`)} fg={s.fg} bg={s.bg} />;
}

export function SourceLabel({ source }: { source: InfoSource | null }) {
  const { t } = useT();
  if (!source) return null;
  return (
    <Text variant="caption" tone="muted">
      {t(`source.${source}`)}
    </Text>
  );
}

/** Compact waiting time display with source, reliability and freshness. */
export function WaitBadge({ wait, compact }: { wait: DisplayWait; compact?: boolean }) {
  const { colors, radii } = useAppTheme();
  const { t, locale } = useT();
  if (wait.kind === 'closed') return <StatusPill status={wait.status} />;
  if (wait.kind === 'none') {
    return compact ? (
      <Text variant="caption" tone="muted">
        {t('attraction.noWait')}
      </Text>
    ) : (
      <StatusPill status={wait.status} />
    );
  }
  const tone = wait.minutes! <= 15 ? colors.success : wait.minutes! <= 45 ? colors.warning : colors.danger;
  return (
    <View
      accessible
      accessibilityLabel={`${t('attraction.waitNow')}: ${t('common.minutes', { count: wait.minutes })}. ${t(`source.${wait.source ?? 'community'}`)}. ${wait.reliability ? t(`reliability.${wait.reliability}`) : ''}`}
      style={{ alignItems: compact ? 'flex-end' : 'flex-start', gap: 2 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
        <Ionicons name="time-outline" size={14} color={tone} />
        <Text variant="label" style={{ color: tone }}>
          {t('common.minutesShort', { count: wait.minutes })}
        </Text>
      </View>
      {!compact ? (
        <Text variant="caption" tone="muted">
          {t(`source.${wait.source ?? 'community'}`)}
          {wait.reliability ? ` · ${t(`reliability.${wait.reliability}`)}` : ''}
          {wait.updatedAt ? ` · ${formatRelativeTime(wait.updatedAt, locale)}` : ''}
          {wait.freshness === 'aging' ? ` · ${t('offline.staleWarning')}` : ''}
        </Text>
      ) : null}
    </View>
  );
}

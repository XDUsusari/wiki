import { Ionicons } from '@expo/vector-icons';
import { formatRelativeTime, pickI18n, type Announcement } from '@dinsdelparc/shared';
import { View } from 'react-native';
import { useT } from '../i18n';
import { useAppTheme } from '../theme';
import { OriginBadge } from './Badges';
import { Card, Text } from './ui';

export function AnnouncementCard({ item }: { item: Announcement }) {
  const { t, locale } = useT();
  const { colors, spacing } = useAppTheme();
  const tone = item.severity === 'critical' ? colors.danger : item.severity === 'warning' ? colors.warning : colors.info;
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Ionicons name={item.kind === 'incident' ? 'warning-outline' : item.kind === 'notice' ? 'information-circle-outline' : 'newspaper-outline'} size={22} color={tone} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="bodyStrong">{pickI18n(item.title_i18n, locale)}</Text>
          {pickI18n(item.body_i18n, locale) ? (
            <Text variant="small" tone="muted">
              {pickI18n(item.body_i18n, locale)}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
            <OriginBadge origin={item.data_origin} />
            <Text variant="caption" tone="muted">
              {formatRelativeTime(item.starts_at, locale)}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

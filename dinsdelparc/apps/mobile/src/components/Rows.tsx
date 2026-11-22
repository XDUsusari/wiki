import { Ionicons } from '@expo/vector-icons';
import type { Attraction, DisplayWait } from '@dinsdelparc/shared';
import { MIN_TOUCH_TARGET } from '@dinsdelparc/shared';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { tapFeedback } from '../lib/haptics';
import { useT } from '../i18n';
import { useAppTheme } from '../theme';
import { OriginBadge, WaitBadge } from './Badges';
import type { IconName } from './ui/Button';
import { Text } from './ui/Text';

export function ListRow({ title, subtitle, icon, iconColor, right, onPress, accessibilityHint }: {
  title: string;
  subtitle?: string | null;
  icon?: IconName;
  iconColor?: string;
  right?: ReactNode;
  onPress?: () => void;
  accessibilityHint?: string;
}) {
  const { colors, spacing, radii } = useAppTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH_TARGET + 12, paddingVertical: spacing.sm }}>
      {icon ? (
        <View style={{ width: 40, height: 40, borderRadius: radii.md, backgroundColor: (iconColor ?? colors.interactive) + '1F', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={20} color={iconColor ?? colors.interactive} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" tone="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {body}
    </Pressable>
  );
}

export function Divider() {
  const { colors } = useAppTheme();
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

export const ATTRACTION_ICON: Record<Attraction['attraction_type'], IconName> = {
  roller_coaster: 'trending-up-outline',
  water_ride: 'water-outline',
  drop_tower: 'arrow-down-circle-outline',
  flat_ride: 'sync-outline',
  family: 'people-outline',
  kids: 'happy-outline',
  dark_ride: 'moon-outline',
  simulator: 'airplane-outline',
  slide: 'water-outline',
  pool: 'water-outline',
  walkthrough: 'walk-outline',
  other: 'star-outline',
};

export function AttractionRow({ attraction, wait, accent, onPress }: { attraction: Attraction; wait: DisplayWait; accent?: string; onPress: () => void }) {
  const { t } = useT();
  return (
    <ListRow
      title={attraction.name}
      subtitle={t(`attraction.types.${attraction.attraction_type}`)}
      icon={ATTRACTION_ICON[attraction.attraction_type]}
      iconColor={accent}
      onPress={onPress}
      right={
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <WaitBadge wait={wait} compact />
          {attraction.data_origin !== 'verified' ? <OriginBadge origin={attraction.data_origin} /> : null}
        </View>
      }
    />
  );
}

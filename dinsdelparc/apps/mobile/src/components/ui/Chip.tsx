import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tapFeedback } from '../../lib/haptics';
import { useAppTheme } from '../../theme';
import type { IconName } from './Button';
import { Text } from './Text';

export function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  color?: string;
}) {
  const { colors, radii } = useAppTheme();
  const accent = color ?? colors.interactive;
  const content = (
    <View
      style={[
        styles.chip,
        {
          borderRadius: radii.pill,
          backgroundColor: selected ? accent : colors.surfaceAlt,
          borderColor: selected ? accent : colors.border,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={selected ? '#fff' : colors.textMuted} /> : null}
      <Text variant="label" style={{ color: selected ? '#fff' : colors.text }}>
        {label}
      </Text>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      hitSlop={6}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
    >
      {content}
    </Pressable>
  );
}

/** Small coloured label (status, origin, role…). */
export function Pill({ label, fg, bg, icon }: { label: string; fg: string; bg: string; icon?: IconName }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]} accessible accessibilityLabel={label}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text variant="caption" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 36, borderWidth: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
});

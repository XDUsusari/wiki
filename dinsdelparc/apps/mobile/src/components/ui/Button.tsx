import { MIN_TOUCH_TARGET } from '@dinsdelparc/shared';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { tapFeedback } from '../../lib/haptics';
import { useAppTheme, type AppTheme } from '../../theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type IconName = ComponentProps<typeof Ionicons>['name'];

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  label: string;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  size?: 'md' | 'sm';
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

function colorsFor(theme: AppTheme, variant: Variant) {
  const c = theme.colors;
  switch (variant) {
    case 'primary':
      return { bg: c.interactive, fg: c.interactiveOn, border: c.interactive };
    case 'secondary':
      return { bg: c.interactiveSoft, fg: c.interactive, border: c.interactiveSoft };
    case 'danger':
      return { bg: c.dangerSoft, fg: c.danger, border: c.dangerSoft };
    default:
      return { bg: 'transparent', fg: c.interactive, border: 'transparent' };
  }
}

export function Button({ label, variant = 'primary', icon, loading, size = 'md', fullWidth, disabled, style, onPress, ...rest }: ButtonProps) {
  const theme = useAppTheme();
  const { bg, fg, border } = colorsFor(theme, variant);
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={(e) => {
        tapFeedback();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor: border,
          minHeight: size === 'sm' ? 36 : MIN_TOUCH_TARGET + 4,
          paddingHorizontal: size === 'sm' ? 12 : 18,
          borderRadius: theme.radii.md,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
      hitSlop={size === 'sm' ? 6 : 0}
      {...rest}
    >
      <View style={styles.row}>
        {loading ? <ActivityIndicator color={fg} size="small" /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
        <Text variant={size === 'sm' ? 'label' : 'bodyStrong'} style={{ color: fg }} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  color,
  size = 22,
  badge,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  badge?: number;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.icon, { opacity: pressed ? 0.6 : 1 }]}
      hitSlop={4}
    >
      <Ionicons name={icon} size={size} color={color ?? colors.text} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.danger }]}>
          <Text variant="caption" style={{ color: '#fff', fontSize: 10, lineHeight: 12 }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { justifyContent: 'center', borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  icon: { width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 6, right: 4, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
});

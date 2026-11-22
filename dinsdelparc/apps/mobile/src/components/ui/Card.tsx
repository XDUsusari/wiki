import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { tapFeedback } from '../../lib/haptics';
import { useAppTheme } from '../../theme';

export function Card({
  children,
  onPress,
  style,
  accessibilityLabel,
  accessibilityHint,
  padded = true,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  padded?: boolean;
}) {
  const { colors, radii, spacing, dark } = useAppTheme();
  const base: ViewStyle = {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: padded ? spacing.lg : 0,
    overflow: 'hidden',
    shadowColor: '#061A3D',
    shadowOpacity: dark ? 0 : 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: dark ? 0 : 1,
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [base, { transform: [{ scale: pressed ? 0.985 : 1 }] }, style]}
    >
      {children}
    </Pressable>
  );
}

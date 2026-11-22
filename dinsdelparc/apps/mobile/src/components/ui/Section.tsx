import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useAppTheme } from '../../theme';
import { Text } from './Text';

export function Section({
  title,
  action,
  onAction,
  children,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  const { spacing, colors } = useAppTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="h2">{title}</Text>
          {subtitle ? (
            <Text variant="small" tone="muted">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {action && onAction ? (
          <Pressable accessibilityRole="link" onPress={onAction} hitSlop={10}>
            <Text variant="label" style={{ color: colors.interactive }}>
              {action}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

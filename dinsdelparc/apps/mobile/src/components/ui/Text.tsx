import type { TypographyVariant } from '@dinsdelparc/shared';
import { Text as RNText, type TextProps } from 'react-native';
import { useAppTheme } from '../../theme';

type Tone = 'default' | 'muted' | 'brand' | 'interactive' | 'danger' | 'success' | 'warning' | 'inverse';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  tone?: Tone;
  align?: 'left' | 'center' | 'right';
}

export function Text({ variant = 'body', tone = 'default', align, style, ...rest }: AppTextProps) {
  const { colors, typography } = useAppTheme();
  const color = {
    default: colors.text,
    muted: colors.textMuted,
    brand: colors.brand,
    interactive: colors.interactive,
    danger: colors.danger,
    success: colors.success,
    warning: colors.warning,
    inverse: colors.textInverse,
  }[tone];
  const isHeading = variant === 'display' || variant === 'h1' || variant === 'h2' || variant === 'h3';
  return (
    <RNText
      accessibilityRole={isHeading ? 'header' : undefined}
      maxFontSizeMultiplier={1.6}
      style={[typography[variant], { color, textAlign: align }, style]}
      {...rest}
    />
  );
}

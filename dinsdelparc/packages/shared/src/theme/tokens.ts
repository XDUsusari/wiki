/**
 * DinsDelParc design tokens — single source of truth for the mobile app and
 * the admin panel (exported as CSS variables there).
 */

export const palette = {
  navy950: '#061A3D',
  navy900: '#0A2F6B', // institutional deep blue
  navy700: '#14479B',
  blue600: '#1565C0',
  blue500: '#1E88E5', // interactive
  blue300: '#64B5F6',
  blue100: '#E3F0FD',
  white: '#FFFFFF',
  gray50: '#F4F6FA',
  gray100: '#EBEFF5',
  gray200: '#E3E8F0',
  gray400: '#9AA8BC',
  gray600: '#5B6B82',
  gray900: '#0E1726',
  green700: '#2E7D32',
  green100: '#E6F4EA',
  amber700: '#8A5300',
  amber100: '#FFF4E0',
  red700: '#C62828',
  red100: '#FDECEC',
  purple700: '#6A1B9A',
  purple100: '#F3E8FA',
  sun: '#FFB300',
} as const;

export interface ColorScheme {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;
  brand: string;
  brandOn: string;
  interactive: string;
  interactiveOn: string;
  interactiveSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  community: string;
  communitySoft: string;
  overlay: string;
  skeleton: string;
}

export const lightColors: ColorScheme = {
  background: palette.white,
  surface: palette.white,
  surfaceAlt: palette.gray50,
  surfaceRaised: palette.white,
  border: palette.gray200,
  text: palette.gray900,
  textMuted: palette.gray600,
  textInverse: palette.white,
  brand: palette.navy900,
  brandOn: palette.white,
  interactive: palette.blue600,
  interactiveOn: palette.white,
  interactiveSoft: palette.blue100,
  success: palette.green700,
  successSoft: palette.green100,
  warning: palette.amber700,
  warningSoft: palette.amber100,
  danger: palette.red700,
  dangerSoft: palette.red100,
  info: palette.blue600,
  infoSoft: palette.blue100,
  community: palette.purple700,
  communitySoft: palette.purple100,
  overlay: 'rgba(6, 26, 61, 0.55)',
  skeleton: palette.gray100,
};

export const darkColors: ColorScheme = {
  background: '#0B1220',
  surface: '#121A2B',
  surfaceAlt: '#0F1726',
  surfaceRaised: '#1A2438',
  border: '#26324A',
  text: '#E8EEF8',
  textMuted: '#A3B1C6',
  textInverse: palette.gray900,
  brand: '#7FB2FF',
  brandOn: palette.navy950,
  interactive: palette.blue300,
  interactiveOn: palette.navy950,
  interactiveSoft: '#16304F',
  success: '#7BD389',
  successSoft: '#163323',
  warning: '#FFC46B',
  warningSoft: '#3A2A10',
  danger: '#FF8A80',
  dangerSoft: '#3D1616',
  info: palette.blue300,
  infoSoft: '#16304F',
  community: '#D7A6F2',
  communitySoft: '#2E1A3C',
  overlay: 'rgba(0, 0, 0, 0.6)',
  skeleton: '#1F2A40',
};

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radii = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;

export const fontFamilies = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontFamily: fontFamilies.bold, letterSpacing: -0.5 },
  h1: { fontSize: 26, lineHeight: 32, fontFamily: fontFamilies.bold, letterSpacing: -0.3 },
  h2: { fontSize: 21, lineHeight: 28, fontFamily: fontFamilies.semibold, letterSpacing: -0.2 },
  h3: { fontSize: 18, lineHeight: 24, fontFamily: fontFamilies.semibold, letterSpacing: 0 },
  body: { fontSize: 16, lineHeight: 24, fontFamily: fontFamilies.regular, letterSpacing: 0 },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontFamily: fontFamilies.semibold, letterSpacing: 0 },
  small: { fontSize: 14, lineHeight: 20, fontFamily: fontFamilies.regular, letterSpacing: 0 },
  label: { fontSize: 13, lineHeight: 18, fontFamily: fontFamilies.semibold, letterSpacing: 0.2 },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: fontFamilies.medium, letterSpacing: 0.2 },
} as const;
export type TypographyVariant = keyof typeof typography;

/** Minimum touch target (WCAG 2.5.5 / platform guidelines). */
export const MIN_TOUCH_TARGET = 44;

export const parkAccents: Record<string, string> = {
  'portaventura-park': '#0B5FD6',
  'ferrari-land': '#D32F2F',
  'caribe-aquatic-park': '#00897B',
};

/** WCAG relative luminance contrast ratio between two hex colours. */
export function contrastRatio(hexA: string, hexB: string): number {
  const lum = (hex: string) => {
    const v = hex.replace('#', '');
    const rgb = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
    const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [l1, l2] = [lum(hexA), lum(hexB)].sort((a, b) => b - a) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Text colour (white or near-black) with the best contrast on a background. */
export function onColor(background: string): string {
  return contrastRatio(background, '#FFFFFF') >= contrastRatio(background, palette.gray900) ? '#FFFFFF' : palette.gray900;
}

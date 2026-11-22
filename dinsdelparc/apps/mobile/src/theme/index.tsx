import {
  darkColors,
  fontFamilies,
  lightColors,
  radii,
  spacing,
  typography,
  type ColorScheme,
} from '@dinsdelparc/shared';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { usePreferences } from '../stores/preferences';

export interface AppTheme {
  dark: boolean;
  colors: ColorScheme;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  fonts: typeof fontFamilies;
}

const ThemeContext = createContext<AppTheme | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const pref = usePreferences((s) => s.theme);
  const dark = pref === 'dark' || (pref === 'system' && system === 'dark');
  const value = useMemo<AppTheme>(
    () => ({ dark, colors: dark ? darkColors : lightColors, spacing, radii, typography, fonts: fontFamilies }),
    [dark],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used inside AppThemeProvider');
  return ctx;
}

/** Memoised style factory bound to the current theme. */
export function useStyles<T>(factory: (theme: AppTheme) => T): T {
  const theme = useAppTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}

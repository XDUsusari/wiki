import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@dinsdelparc/shared';
import { getLocales } from 'expo-localization';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePreference = 'system' | 'light' | 'dark';

/** Catalan is the default; Spanish/English are used if the device prefers them. */
function deviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode ?? DEFAULT_LOCALE;
  return isLocale(code) ? code : DEFAULT_LOCALE;
}

interface PreferencesState {
  locale: Locale;
  theme: ThemePreference;
  onboardingDone: boolean;
  activePlanId: string | null;
  hydrated: boolean;
  setLocale: (l: Locale) => void;
  setTheme: (t: ThemePreference) => void;
  completeOnboarding: () => void;
  setActivePlan: (id: string | null) => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      locale: deviceLocale(),
      theme: 'system',
      onboardingDone: false,
      activePlanId: null,
      hydrated: false,
      setLocale: (locale) => set({ locale }),
      setTheme: (theme) => set({ theme }),
      completeOnboarding: () => set({ onboardingDone: true }),
      setActivePlan: (activePlanId) => set({ activePlanId }),
    }),
    {
      name: 'dinsdelparc-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ locale, theme, onboardingDone, activePlanId }) => ({ locale, theme, onboardingDone, activePlanId }),
      onRehydrateStorage: () => () => usePreferences.setState({ hydrated: true }),
    },
  ),
);

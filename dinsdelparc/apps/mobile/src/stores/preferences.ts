import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LOCALE, type Locale } from '@dinsdelparc/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePreference = 'system' | 'light' | 'dark';


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
      // Catalan is always the initial language; users can switch on the first onboarding screen.
      locale: DEFAULT_LOCALE as Locale,
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

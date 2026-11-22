import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useT } from '../../i18n';
import { usePreferences } from '../../stores/preferences';
import { useAppTheme } from '../../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
  const { colors, fonts } = useAppTheme();
  const { t } = useT();
  const onboardingDone = usePreferences((s) => s.onboardingDone);
  if (!onboardingDone) return <Redirect href="/onboarding" />;

  const icon = (name: IconName, focusedName: IconName) =>
    function TabIcon({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) {
      return <Ionicons name={focused ? focusedName : name} size={size} color={color as string} />;
    };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.interactive,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home'), tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="parks" options={{ title: t('tabs.parks'), tabBarIcon: icon('compass-outline', 'compass') }} />
      <Tabs.Screen name="map" options={{ title: t('tabs.map'), tabBarIcon: icon('map-outline', 'map') }} />
      <Tabs.Screen name="community" options={{ title: t('tabs.community'), tabBarIcon: icon('people-outline', 'people') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: icon('person-circle-outline', 'person-circle') }} />
    </Tabs>
  );
}

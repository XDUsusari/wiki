import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { setupOnlineManager, useIsOnline } from '../hooks/useNetwork';
import { useT } from '../i18n';
import { listenToNotificationTaps } from '../lib/push';
import { PERSISTED_ROOTS, queryClient, queryPersister } from '../lib/queryClient';
import { flushPlannerQueue } from '../services/planner';
import { usePreferences } from '../stores/preferences';
import { AppThemeProvider, useAppTheme } from '../theme';

void SplashScreen.preventAutoHideAsync();
setupOnlineManager();

function Navigator() {
  const { colors, dark, fonts } = useAppTheme();
  const { t } = useT();
  const { userId } = useAuth();
  const online = useIsOnline();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);
  useEffect(() => listenToNotificationTaps(), []);
  useEffect(() => {
    if (online && userId) void flushPlannerQueue(userId);
  }, [online, userId]);

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.interactive,
          headerTitleStyle: { fontFamily: fonts.semibold, color: colors.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          headerBackButtonDisplayMode: 'minimal',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: t('tabs.home') }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="search" options={{ title: t('search.title') }} />
        <Stack.Screen name="notifications" options={{ title: t('notifications.title') }} />
        <Stack.Screen name="post/new" options={{ title: t('community.newPost'), presentation: 'modal' }} />
        <Stack.Screen name="forum/new" options={{ title: t('forum.newTopic'), presentation: 'modal' }} />
        <Stack.Screen name="planner/new" options={{ title: t('planner.newPlan'), presentation: 'modal' }} />
        <Stack.Screen name="planner/add" options={{ title: t('planner.addItems'), presentation: 'modal' }} />
        <Stack.Screen name="auth/sign-in" options={{ title: t('auth.signIn'), presentation: 'modal' }} />
        <Stack.Screen name="auth/sign-up" options={{ title: t('auth.signUp'), presentation: 'modal' }} />
        <Stack.Screen name="auth/forgot" options={{ title: t('auth.forgotTitle'), presentation: 'modal' }} />
        <Stack.Screen name="auth/reset" options={{ title: t('auth.resetTitle') }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const hydrated = usePreferences((s) => s.hydrated);

  useEffect(() => {
    if (fontsLoaded && hydrated) void SplashScreen.hideAsync();
  }, [fontsLoaded, hydrated]);

  if (!fontsLoaded || !hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: queryPersister,
            maxAge: 1000 * 60 * 60 * 24 * 7,
            buster: 'v1',
            dehydrateOptions: {
              shouldDehydrateQuery: (q) => q.state.status === 'success' && PERSISTED_ROOTS.has(String(q.queryKey[0])),
            },
          }}
        >
          <AppThemeProvider>
            <AuthProvider>
              <Navigator />
            </AuthProvider>
          </AppThemeProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

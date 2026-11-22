import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config. Public runtime values come from EXPO_PUBLIC_* env vars
 * (see .env.example). Never put the Supabase service_role key here: anything
 * in the app bundle is public.
 */
const APP_ENV = process.env.APP_ENV ?? 'development';
const isProd = APP_ENV === 'production';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isProd ? 'DinsDelParc' : `DinsDelParc (${APP_ENV})`,
  slug: 'dinsdelparc',
  scheme: 'dinsdelparc',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: isProd ? 'cat.dinsdelparc.app' : `cat.dinsdelparc.app.${APP_ENV}`,
    supportsTablet: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'DinsDelParc utilitza la teva ubicació només per centrar el mapa. No es desa ni s’envia.',
      NSPhotoLibraryUsageDescription: 'DinsDelParc necessita accés a les fotografies per adjuntar-les a les publicacions.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: isProd ? 'cat.dinsdelparc.app' : `cat.dinsdelparc.app.${APP_ENV}`,
    adaptiveIcon: {
      backgroundColor: '#0A2F6B',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'POST_NOTIFICATIONS'],
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: './assets/favicon.png', bundler: 'metro' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    'expo-web-browser',
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 180, backgroundColor: '#0A2F6B' }],
    ['expo-notifications', { color: '#0A2F6B' }],
    ['expo-location', { locationWhenInUsePermission: 'DinsDelParc utilitza la teva ubicació només per centrar el mapa.' }],
    ['expo-image-picker', { photosPermission: 'DinsDelParc necessita accés a les fotografies per adjuntar-les a les publicacions.' }],
    '@maplibre/maplibre-react-native',
  ],
  experiments: { typedRoutes: false },
  extra: {
    appEnv: APP_ENV,
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
});

/** Public runtime configuration (embedded in the bundle — never secrets). */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  mapStyleUrl: process.env.EXPO_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty',
};

export const isBackendConfigured = /^https:\/\/.+/.test(env.supabaseUrl) && env.supabaseAnonKey.length > 20;

/** Public runtime configuration (embedded in the bundle — never secrets). */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  mapStyleUrl: process.env.EXPO_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty',
};

/** https everywhere; plain http only for local development hosts (incl. Android emulator). */
const LOCAL_HTTP = /^http:\/\/(127\.0\.0\.1|localhost|10\.0\.2\.2)(:\d+)?(\/|$)/;
export const isBackendConfigured = (/^https:\/\/.+/.test(env.supabaseUrl) || LOCAL_HTTP.test(env.supabaseUrl)) && env.supabaseAnonKey.length > 20;

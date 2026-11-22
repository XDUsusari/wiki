import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests against a LOCAL Supabase stack:
 *   npx supabase start
 *   E2E_SERVICE_ROLE_KEY=<local service key> E2E_ANON_KEY=<local anon key> npx playwright test -c e2e
 * Builds are expected first (see docs/TESTING.md).
 */
const anon = process.env.E2E_ANON_KEY ?? '';
const supabaseUrl = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321';

export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalSetup: './global-setup.ts',
  use: { trace: 'off', viewport: { width: 1280, height: 900 } },
  projects: [
    { name: 'admin', testMatch: /admin\.spec\.ts/, use: { baseURL: 'http://127.0.0.1:3000' } },
    { name: 'mobile-web', testMatch: /mobile\.spec\.ts/, use: { baseURL: 'http://127.0.0.1:8081', viewport: { width: 412, height: 915 } } },
  ],
  webServer: [
    {
      command: 'npm run start --workspace @dinsdelparc/admin',
      url: 'http://127.0.0.1:3000/login',
      reuseExistingServer: true,
      cwd: '..',
      env: { NEXT_PUBLIC_SUPABASE_URL: supabaseUrl, NEXT_PUBLIC_SUPABASE_ANON_KEY: anon, PORT: '3000' },
      timeout: 120_000,
    },
    {
      command: 'node e2e/serve-static.mjs apps/mobile/dist-web 8081',
      url: 'http://127.0.0.1:8081',
      reuseExistingServer: true,
      cwd: '..',
      timeout: 30_000,
    },
  ],
});

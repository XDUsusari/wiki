import { defineConfig } from 'vitest/config';

// Pure-logic tests (no React Native renderer). UI flows are covered by the
// Playwright suite (e2e/) and the Maestro flows (apps/mobile/maestro/).
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });

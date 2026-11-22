#!/usr/bin/env bash
# Full local end-to-end run: local Supabase stack + admin build + mobile web build + Playwright.
# Requires Docker. Uses only the LOCAL demo keys printed by `supabase status`.
set -euo pipefail
cd "$(dirname "$0")/.."
npx supabase start >/dev/null
eval "$(npx supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
export E2E_SUPABASE_URL="$API_URL" E2E_ANON_KEY="$ANON_KEY" E2E_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
NEXT_PUBLIC_SUPABASE_URL="$API_URL" NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" npm run build --workspace @dinsdelparc/admin
(cd apps/mobile && EXPO_PUBLIC_SUPABASE_URL="$API_URL" EXPO_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" npx expo export --platform web --output-dir dist-web)
npx playwright test -c e2e --trace off

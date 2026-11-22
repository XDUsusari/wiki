#!/usr/bin/env bash
# Spins up a throw-away PostgreSQL 16 cluster, emulates the Supabase platform
# objects, applies every migration + seed and runs the SQL test suite.
# Usage: bash supabase/tests/run-local.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
WORK="$(mktemp -d)"
PORT="${PGPORT_TEST:-54329}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then RUN_AS=(runuser -u postgres --); chown postgres "$WORK"; fi

cleanup() { "${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

"${RUN_AS[@]}" "$PGBIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
"${RUN_AS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" start >/dev/null

PSQL=(psql -X -q -v ON_ERROR_STOP=1 -h "$WORK" -p "$PORT" -U postgres -d postgres)
"${PSQL[@]}" -f "$HERE/supabase_stub.sql"
for f in "$ROOT"/migrations/*.sql; do
  echo "→ migration $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
echo "→ seed"
"${PSQL[@]}" -f "$ROOT/seed.sql"
status=0
for t in "$HERE"/[0-9]*_*.sql; do
  echo "→ test $(basename "$t")"
  if ! "${PSQL[@]}" -t -f "$t" 2>&1 | sed -e '/^\s*$/d' -e 's/^psql:[^ ]* NOTICE:  /  /'; then status=1; fi
done
if [ $status -eq 0 ]; then echo "✔ all database tests passed"; else echo "✘ database tests failed"; fi
exit $status

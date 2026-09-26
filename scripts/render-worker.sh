#!/usr/bin/env bash
set -euo pipefail

# The API owns migrations. A new Blueprint can start this worker before the API,
# so wait for the read-only migration check instead of processing missing tables.
cd "$(dirname "$0")/.."
for attempt in {1..12}; do
  if timeout 20s npm run db:status > /dev/null 2>&1; then
    echo "Database migrations are current; starting worker."
    exec node apps/api/dist/worker.js
  fi
  echo "Waiting for the API to apply database migrations (attempt ${attempt}/12)."
  sleep 5
done
echo "Database migrations are not ready. Inspect the API deployment and database status." >&2
exit 1

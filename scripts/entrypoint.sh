#!/usr/bin/env bash
set -euo pipefail

echo "▶ Applying database migrations..."
# Versioned, non-destructive migrations. Unlike `push --force`, this only
# applies the migration files committed to the repo and never silently drops
# columns/tables on schema drift.
npx drizzle-kit migrate
echo "✅ Migrations applied."

exec node dist/server.cjs

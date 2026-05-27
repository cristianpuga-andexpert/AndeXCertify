#!/usr/bin/env bash
set -euo pipefail

echo "▶ Applying database schema..."
npx drizzle-kit push --force
echo "✅ Schema ready."

exec node dist/server.cjs

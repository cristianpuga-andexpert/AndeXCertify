#!/usr/bin/env bash
# Run database migrations locally or in CI.
# Usage: ./scripts/migrate.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Load .env if running locally
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT_DIR/.env"
  set +a
fi

cd "$ROOT_DIR"
echo "▶ Running database migrations..."
npx drizzle-kit migrate
echo "✅ Done."

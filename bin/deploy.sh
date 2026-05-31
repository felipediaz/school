#!/usr/bin/env bash
# Opalstack deploy helper.
#
# Run this from the app directory on the Opalstack host. It pulls the
# branch, installs deps (postinstall regenerates Prisma), runs migrations,
# rebuilds Next, and restarts the supervised app.
#
# Usage:
#   cd ~/apps/printshop
#   ./bin/deploy.sh                    # uses the currently-checked-out branch
#   ./bin/deploy.sh feature-branch     # deploys a specific branch
set -euo pipefail

BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo "▶ Deploying $BRANCH from $APP_DIR"

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "▶ Installing deps (postinstall runs prisma generate)"
npm install --omit=dev --no-audit --no-fund

echo "▶ Applying database migrations"
npx prisma migrate deploy

echo "▶ Building Next"
npm run build

# Opalstack creates start/stop/restart scripts alongside each app under
# ~/apps/<name>/. Use restart if it exists; fall back to stop+start.
RESTART="$APP_DIR/restart"
if [[ -x "$RESTART" ]]; then
  echo "▶ Restarting via $RESTART"
  "$RESTART"
else
  echo "▶ No restart script — invoking stop && start"
  "$APP_DIR/stop" || true
  "$APP_DIR/start"
fi

echo "✓ Deploy complete"

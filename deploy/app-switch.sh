#!/usr/bin/env bash
# Point cisssolutions.co.ke at the store (app) or back at the coming-soon page (static).
# Rewrites this project's site file in the edge proxy (see deploy/edge-site.sh). The
# static deploy (deploy.yml / deploy.sh) keeps an existing site file as is, so a later
# push to main does not undo the switch.
#
# Usage: deploy/app-switch.sh user@host app|static [ssh_key]
set -euo pipefail
TARGET="${1:?usage: app-switch.sh user@host app|static [ssh_key]}"
MODE="${2:?usage: app-switch.sh user@host app|static [ssh_key]}"

case "$MODE" in
  app) UPSTREAM=ciss-store:3000 ;;
  static) UPSTREAM=ciss-solutions:80 ;;
  *) echo "mode must be 'app' or 'static'"; exit 1 ;;
esac

bash "$(dirname "$0")/edge-site.sh" "$TARGET" set "$UPSTREAM" ${3:+"$3"}

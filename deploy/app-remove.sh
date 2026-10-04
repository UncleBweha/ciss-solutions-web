#!/usr/bin/env bash
# Stop the store on the VPS: point the domain back at the coming-soon page,
# remove the ciss-store container and its cron entry. Keeps /opt/ciss-store/.env
# and the built images so a redeploy is quick.
#
# Usage: deploy/app-remove.sh user@host [ssh_key]
set -euo pipefail
TARGET="${1:?usage: app-remove.sh user@host [ssh_key]}"
HERE="$(cd "$(dirname "$0")" && pwd)"

bash "$HERE/app-switch.sh" "$TARGET" static ${2:+"$2"} || echo "(Caddy not switched; check it manually)"

SSH=(ssh)
if [ -n "${2:-}" ]; then SSH+=(-i "$2"); fi
"${SSH[@]}" "$TARGET" 'set -e
  docker rm -f ciss-store >/dev/null 2>&1 && echo "Removed container ciss-store" || echo "No ciss-store container"
  rm -f /etc/cron.d/ciss-store'

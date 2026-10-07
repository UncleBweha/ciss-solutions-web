#!/usr/bin/env bash
# Remove the CISS Solutions site from the VPS: its site file in the edge proxy
# (which also routes the POS; remove the POS itself with its repo's deploy/remove.sh),
# its container and its files. Nothing else is touched.
# Usage: deploy/remove.sh user@host [ssh_key]
set -euo pipefail
TARGET="${1:?usage: remove.sh user@host [ssh_key]}"
SSH=(ssh)
if [ -n "${2:-}" ]; then SSH+=(-i "$2"); fi

bash "$(dirname "$0")/edge-site.sh" "$TARGET" remove - ${2:+"$2"} || echo "(Edge proxy not changed; check it manually)"

"${SSH[@]}" "$TARGET" 'docker rm -f ciss-solutions >/dev/null 2>&1 && echo "Removed container."
  rm -rf /var/www/ciss-solutions && echo "Removed files."'
echo "Done."

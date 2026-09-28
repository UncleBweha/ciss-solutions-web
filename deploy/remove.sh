#!/usr/bin/env bash
# Remove the CISS Solutions site from a VPS (use when moving to your own server).
# Usage: deploy/remove.sh user@host [ssh_key]
set -euo pipefail
TARGET="${1:?usage: remove.sh user@host [ssh_key]}"
SSH=(ssh); [ -n "${2:-}" ] && SSH+=(-i "$2")

"${SSH[@]}" "$TARGET" 'set -e
  SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO=sudo
  $SUDO rm -f /etc/nginx/sites-enabled/ciss-solutions /etc/nginx/sites-available/ciss-solutions
  $SUDO rm -rf /var/www/ciss-solutions
  $SUDO nginx -t && $SUDO systemctl reload nginx'
echo "Removed."

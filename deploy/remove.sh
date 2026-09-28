#!/usr/bin/env bash
# Remove the CISS Solutions site from a VPS: its container and its files. Nothing else.
# Usage: deploy/remove.sh user@host [ssh_key]
set -euo pipefail
TARGET="${1:?usage: remove.sh user@host [ssh_key]}"
SSH=(ssh)
if [ -n "${2:-}" ]; then SSH+=(-i "$2"); fi

"${SSH[@]}" "$TARGET" 'docker rm -f ciss-solutions; rm -rf /var/www/ciss-solutions'
echo "Removed."

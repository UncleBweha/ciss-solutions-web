#!/usr/bin/env bash
# Remove the CISS Solutions site from the VPS: its Caddy block (if added by
# caddy-add.sh), its container and its files. Nothing else is touched.
# Usage: deploy/remove.sh user@host [ssh_key]
set -euo pipefail
TARGET="${1:?usage: remove.sh user@host [ssh_key]}"
SSH=(ssh)
if [ -n "${2:-}" ]; then SSH+=(-i "$2"); fi

"${SSH[@]}" "$TARGET" 'bash -s' <<'REMOTE'
set -uo pipefail
C=toolsman-next-caddy-1
CONF=/etc/caddy/Caddyfile

SRC=$(docker inspect "$C" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}' 2>/dev/null)
if [ -z "$SRC" ]; then
  DIR=$(docker inspect "$C" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy"}}{{.Source}}{{end}}{{end}}' 2>/dev/null)
  [ -n "$DIR" ] && SRC="$DIR/Caddyfile"
fi

if [ -n "$SRC" ] && [ -f "$SRC" ] && grep -q '# >>> ciss-solutions' "$SRC"; then
  cp "$SRC" "$SRC.bak-ciss-remove"
  TMP=$(mktemp)
  # drop the marked block; write back in place (keeps the bind-mounted inode)
  awk '/^# >>> ciss-solutions/{skip=1} !skip{print} /^# <<< ciss-solutions/{skip=0}' "$SRC" > "$TMP"
  cat "$TMP" > "$SRC"; rm -f "$TMP"
  if docker exec "$C" caddy validate --config "$CONF" --adapter caddyfile >/dev/null 2>&1; then
    docker exec "$C" caddy reload --config "$CONF" --adapter caddyfile && echo "Removed CISS block from Caddy."
  else
    echo "Caddy config did not validate after removal; restoring."; cat "$SRC.bak-ciss-remove" > "$SRC"
  fi
fi

docker rm -f ciss-solutions >/dev/null 2>&1 && echo "Removed container."
rm -rf /var/www/ciss-solutions && echo "Removed files."
REMOTE
echo "Done."

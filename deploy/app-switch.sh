#!/usr/bin/env bash
# Point cisssolutions.co.ke at the store (app) or back at the coming-soon page (static).
# Edits only the upstream inside the "# >>> ciss-solutions" block that caddy-add.sh
# created, backs the Caddyfile up first, validates, and restores the backup on failure.
# The static deploy (deploy.yml / deploy.sh) keeps an existing block as is, so a later
# push to main does not undo the switch.
#
# Usage: deploy/app-switch.sh user@host app|static [ssh_key]
set -euo pipefail
TARGET="${1:?usage: app-switch.sh user@host app|static [ssh_key]}"
MODE="${2:?usage: app-switch.sh user@host app|static [ssh_key]}"
SSH=(ssh)
if [ -n "${3:-}" ]; then SSH+=(-i "$3"); fi

case "$MODE" in
  app) UPSTREAM=ciss-store:3000 ;;
  static) UPSTREAM=ciss-solutions:80 ;;
  *) echo "mode must be 'app' or 'static'"; exit 1 ;;
esac

"${SSH[@]}" "$TARGET" "UPSTREAM=$UPSTREAM bash -s" <<'REMOTE'
set -euo pipefail
C=toolsman-next-caddy-1
CONF=/etc/caddy/Caddyfile
CONTAINER=${UPSTREAM%%:*}

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Container $CONTAINER is not running. Deploy it first. Nothing changed."; exit 1
fi

SRC=$(docker inspect "$C" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}')
if [ -z "$SRC" ]; then
  DIR=$(docker inspect "$C" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy"}}{{.Source}}{{end}}{{end}}')
  [ -n "$DIR" ] && SRC="$DIR/Caddyfile"
fi
if [ -z "$SRC" ] || ! grep -q '# >>> ciss-solutions' "$SRC"; then
  echo "No CISS block in the Caddyfile. Run deploy/caddy-add.sh first. Nothing changed."; exit 1
fi

NET=$(docker inspect "$C" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' | grep -E '(^|_)web$' | head -1 || true)
[ -n "$NET" ] && docker network connect "$NET" "$CONTAINER" 2>/dev/null || true

cp "$SRC" "$SRC.bak-ciss-switch"
# Rewrite only the reverse_proxy line between the CISS markers. Write in place
# (same inode) so a single-file bind mount sees the change.
UPDATED=$(awk -v up="$UPSTREAM" '
  /# >>> ciss-solutions/ { inblock = 1 }
  /# <<< ciss-solutions/ { inblock = 0 }
  inblock && $1 == "reverse_proxy" { sub(/reverse_proxy[ \t]+[^ \t]+/, "reverse_proxy " up) }
  { print }
' "$SRC")
printf '%s\n' "$UPDATED" > "$SRC"

if ! docker exec "$C" caddy validate --config "$CONF" --adapter caddyfile >/dev/null 2>&1; then
  echo "Caddy config did not validate; restoring backup."
  cat "$SRC.bak-ciss-switch" > "$SRC"
  exit 1
fi
docker exec "$C" caddy reload --config "$CONF" --adapter caddyfile
echo "cisssolutions.co.ke now proxies to $UPSTREAM."
REMOTE

#!/usr/bin/env bash
# Route cisssolutions.co.ke (HTTPS) to the ciss-solutions container through the
# existing Caddy on the VPS. Adds one marked block to that Caddyfile, backs it up
# first, validates before reloading, and restores the backup if validation fails.
# Undo with deploy/remove.sh.
#
# Usage: deploy/caddy-add.sh user@host [ssh_key]
set -euo pipefail
TARGET="${1:?usage: caddy-add.sh user@host [ssh_key]}"
SSH=(ssh)
if [ -n "${2:-}" ]; then SSH+=(-i "$2"); fi

"${SSH[@]}" "$TARGET" 'bash -s' <<'REMOTE'
set -euo pipefail
C=toolsman-next-caddy-1
CONF=/etc/caddy/Caddyfile

SRC=$(docker inspect "$C" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}')
if [ -z "$SRC" ]; then
  DIR=$(docker inspect "$C" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy"}}{{.Source}}{{end}}{{end}}')
  [ -n "$DIR" ] && SRC="$DIR/Caddyfile"
fi
if [ -z "$SRC" ] || [ ! -f "$SRC" ]; then
  echo "Could not find the Caddyfile on the host. Nothing changed."; exit 1
fi
echo "Caddyfile: $SRC"

NET=$(docker inspect "$C" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' | grep -E '(^|_)web$' | head -1 || true)
if [ -z "$NET" ]; then
  echo "Caddy is not on a 'web' network. Nothing changed."; exit 1
fi
echo "Network:   $NET"
docker network connect "$NET" ciss-solutions 2>/dev/null || echo "(ciss-solutions already on $NET)"

if grep -q '# >>> ciss-solutions' "$SRC"; then
  echo "CISS block already present in Caddyfile."
else
  cp "$SRC" "$SRC.bak-ciss"
  # append in place (keeps the same inode, so a single-file bind mount still sees it)
  cat >> "$SRC" <<'BLOCK'

# >>> ciss-solutions (temporary site; remove with deploy/remove.sh from the CISS repo)
www.cisssolutions.co.ke {
	redir https://cisssolutions.co.ke{uri} permanent
}

cisssolutions.co.ke {
	reverse_proxy ciss-solutions:80
	encode gzip
}
# <<< ciss-solutions
BLOCK
  echo "Added CISS block (backup: $SRC.bak-ciss)"
fi

if ! docker exec "$C" caddy validate --config "$CONF" --adapter caddyfile >/dev/null 2>&1; then
  echo "Caddy config did not validate; restoring backup. toolsman is unaffected."
  [ -f "$SRC.bak-ciss" ] && cat "$SRC.bak-ciss" > "$SRC"
  docker exec "$C" caddy validate --config "$CONF" --adapter caddyfile || true
  exit 1
fi

docker exec "$C" caddy reload --config "$CONF" --adapter caddyfile
echo "Caddy reloaded. HTTPS certificate will be issued on the first request."
REMOTE

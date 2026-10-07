#!/usr/bin/env bash
# This project's entry in the VPS's edge proxy (deploy/edge): one file,
# /opt/edge/conf/sites/ciss-solutions.caddy, that sends cisssolutions.co.ke to a
# container. No other project's deploy touches it, and this touches no other
# project's file. The new file is validated before the proxy is reloaded, and the
# previous one is put back if validation fails.
#
# Usage: deploy/edge-site.sh user@host set <container:port> [ssh_key]     write the file
#        deploy/edge-site.sh user@host ensure <container:port> [ssh_key]  only if there is none yet
#        deploy/edge-site.sh user@host remove - [ssh_key]                 delete it
set -euo pipefail
USAGE="usage: edge-site.sh user@host set|ensure|remove <container:port|-> [ssh_key]"
TARGET="${1:?$USAGE}"
MODE="${2:?$USAGE}"
UPSTREAM="${3:?$USAGE}"
SSH=(ssh)
if [ -n "${4:-}" ]; then SSH+=(-i "$4"); fi

case "$MODE" in
  set | ensure | remove) ;;
  *) echo "$USAGE"; exit 1 ;;
esac

"${SSH[@]}" "$TARGET" "MODE=$MODE UPSTREAM=$UPSTREAM bash -s" <<'REMOTE'
set -euo pipefail
C=edge-caddy
CONF=/etc/caddy/Caddyfile
FILE=/opt/edge/conf/sites/ciss-solutions.caddy

if ! docker ps --format '{{.Names}}' | grep -qx "$C"; then
  echo "The edge proxy ($C) is not running. Set it up with deploy/edge/setup.sh. Nothing changed."; exit 1
fi
valid() { docker exec "$C" caddy validate --config "$CONF" --adapter caddyfile >/dev/null 2>&1; }
reload() { docker exec "$C" caddy reload --config "$CONF" --adapter caddyfile >/dev/null 2>&1; }

if [ "$MODE" = remove ]; then
  [ -f "$FILE" ] || { echo "No site file. Nothing changed."; exit 0; }
  mv "$FILE" "$FILE.bak"
  if valid && reload; then echo "Removed cisssolutions.co.ke from the edge proxy."; else mv "$FILE.bak" "$FILE"; echo "Proxy config did not validate; site file put back."; exit 1; fi
  exit 0
fi

if [ "$MODE" = ensure ] && [ -f "$FILE" ]; then
  echo "cisssolutions.co.ke is already routed ($(awk '$1 == "reverse_proxy" { print $2 }' "$FILE")); left as is."; exit 0
fi

CONTAINER=${UPSTREAM%%:*}
if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Container $CONTAINER is not running. Deploy it first. Nothing changed."; exit 1
fi
docker network connect web "$CONTAINER" 2>/dev/null || true

[ -f "$FILE" ] && cp "$FILE" "$FILE.bak"
cat > "$FILE" <<SITE
# cisssolutions.co.ke. Written by deploy/edge-site.sh in the CISS Solutions repo:
# switch with deploy/app-switch.sh, remove with deploy/remove.sh. Do not edit here.
www.cisssolutions.co.ke {
	redir https://cisssolutions.co.ke{uri} permanent
}

cisssolutions.co.ke {
	reverse_proxy $UPSTREAM
	encode gzip
}
SITE

if ! valid; then
  echo "Proxy config did not validate; restoring the previous site file. Other sites are unaffected."
  if [ -f "$FILE.bak" ]; then mv "$FILE.bak" "$FILE"; else rm -f "$FILE"; fi
  exit 1
fi
reload
echo "cisssolutions.co.ke now proxies to $UPSTREAM."
REMOTE

#!/usr/bin/env bash
# CISS Solutions' entry in the VPS's edge proxy (deploy/edge): one file,
# /opt/edge/conf/sites/ciss-solutions.caddy, holding both of its sites: the website
# (cisssolutions.co.ke, sent to the container given here) and the POS
# (pos.cisssolutions.co.ke, always the ciss-pos container of the CISS POS repo, whose
# deploy does not touch the proxy). No other business's deploy touches this file, and
# this touches no other business's file. The new file is validated before the proxy
# is reloaded, and the previous one is put back if validation fails.
#
# Usage: deploy/edge-site.sh user@host set <container:port> [ssh_key]     write the file
#        deploy/edge-site.sh user@host ensure <container:port> [ssh_key]  only if there is none yet
#        deploy/edge-site.sh user@host remove - [ssh_key]                 delete it (website and POS)
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
# The upstream goes into a remote command and into the proxy's config: accept only a
# container name and port, nothing a shell or Caddy could read as more.
if [ "$MODE" != remove ] && ! [[ "$UPSTREAM" =~ ^[a-z0-9][a-z0-9-]*:[0-9]{1,5}$ ]]; then
  echo "upstream must look like container-name:port"; exit 1
fi
[ "$MODE" = remove ] && UPSTREAM=-

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
  if valid && reload; then echo "Removed cisssolutions.co.ke and pos.cisssolutions.co.ke from the edge proxy."; else mv "$FILE.bak" "$FILE"; echo "Proxy config did not validate; site file put back."; exit 1; fi
  exit 0
fi

if [ "$MODE" = ensure ] && [ -f "$FILE" ]; then
  echo "cisssolutions.co.ke is already routed ($(awk '$1 == "reverse_proxy" { print $2; exit }' "$FILE")); left as is."; exit 0
fi

CONTAINER=${UPSTREAM%%:*}
if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Container $CONTAINER is not running. Deploy it first. Nothing changed."; exit 1
fi
docker network connect web "$CONTAINER" 2>/dev/null || true

[ -f "$FILE" ] && cp "$FILE" "$FILE.bak"
cat > "$FILE" <<SITE
# CISS Solutions: the website and the POS. Written by deploy/edge-site.sh in the
# CISS Solutions web repo: switch the website with deploy/app-switch.sh, remove
# both with deploy/remove.sh. Do not edit here.
www.cisssolutions.co.ke {
	redir https://cisssolutions.co.ke{uri} permanent
}

cisssolutions.co.ke {
	reverse_proxy $UPSTREAM
	encode gzip
}

# The POS (repo CISS Solutions POS) runs as container ciss-pos on the shared
# web network. While that container does not exist this answers 502.
pos.cisssolutions.co.ke {
	reverse_proxy ciss-pos:80
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

#!/usr/bin/env bash
# Server-side half of deploy/edge/setup.sh. Runs on the VPS; not meant to be run by hand.
# Usage: setup-remote.sh prepare|switch|rollback /dir/with/docker-compose.yml+Caddyfile
set -euo pipefail
STEP="${1:?step}"
TMP="${2:?directory}"
OLD=toolsman-next-caddy-1
NEW=edge-caddy
EDGE=/opt/edge
SITES=$EDGE/conf/sites
TOOLSMAN=/home/deploy/toolsman-next
HOSTS="toolsman.co.ke www.toolsman.co.ke pos.toolsman.co.ke cisssolutions.co.ke www.cisssolutions.co.ke pos.cisssolutions.co.ke"
COMPOSE=(docker compose --project-directory "$EDGE" -f "$EDGE/docker-compose.yml")

# What each host answers through whichever proxy is on 443 now.
probe() { for h in $HOSTS; do echo "$h $(curl -s -o /dev/null -m 15 --resolve "$h:443:127.0.0.1" -w '%{http_code}' "https://$h/" || true)"; done; }

old_proxy_back() {
  "${COMPOSE[@]}" stop >/dev/null 2>&1 || true
  docker start "$OLD" >/dev/null
  sleep 2
  # Its own Caddyfile may have lost other projects' blocks; the saved full config has them.
  if docker exec "$OLD" test -f /config/Caddyfile.ciss-live; then
    docker exec "$OLD" caddy reload --config /config/Caddyfile.ciss-live --adapter caddyfile >/dev/null 2>&1 || true
  fi
  echo "The old proxy ($OLD) is serving again."
}

if [ "$STEP" = rollback ]; then
  old_proxy_back
  probe
  exit 0
fi

if [ "$STEP" = prepare ]; then
  mkdir -p "$SITES"
  cp "$TMP/docker-compose.yml" "$EDGE/docker-compose.yml"
  cp "$TMP/Caddyfile" "$EDGE/conf/Caddyfile"

  # Toolsman's sites: its repo's Caddyfile without the global block (now in conf/Caddyfile).
  if [ ! -f "$SITES/toolsman.caddy" ]; then
    {
      echo "# Toolsman's sites, from the Caddyfile in the Toolsman-Web repo (global options are in ../Caddyfile)."
      git -C "$TOOLSMAN" -c safe.directory="$TOOLSMAN" show HEAD:Caddyfile \
        | awk '/^\{$/ && !seen { seen = 1; skipping = 1; next } skipping { if (/^\}$/) skipping = 0; next } seen { print }'
    } > "$SITES/toolsman.caddy"
    echo "Wrote $SITES/toolsman.caddy"
  fi
  # CISS Solutions (website and POS) as served now. deploy/edge-site.sh maintains it afterwards.
  if [ ! -f "$SITES/ciss-solutions.caddy" ]; then
    if docker ps --format '{{.Names}}' | grep -qx ciss-store; then UP=ciss-store:3000; else UP=ciss-solutions:80; fi
    printf '%s\n' \
      "# CISS Solutions: the website and the POS. Written by deploy/edge-site.sh in the" \
      "# CISS Solutions web repo: switch the website with deploy/app-switch.sh, remove" \
      "# both with deploy/remove.sh. Do not edit here." \
      "www.cisssolutions.co.ke {" "	redir https://cisssolutions.co.ke{uri} permanent" "}" "" \
      "cisssolutions.co.ke {" "	reverse_proxy $UP" "	encode gzip" "}" "" \
      "# The POS (repo CISS Solutions POS) runs as container ciss-pos on the shared" \
      "# web network. While that container does not exist this answers 502." \
      "pos.cisssolutions.co.ke {" \
      "	reverse_proxy ciss-pos:80" \
      "	encode gzip" \
      "}" > "$SITES/ciss-solutions.caddy"
    echo "Wrote $SITES/ciss-solutions.caddy (website: $UP)"
  fi

  # Create the container (not started) so its volumes exist, then bring the
  # certificates over: no new certificates are requested at the switch.
  "${COMPOSE[@]}" create >/dev/null 2>&1 || "${COMPOSE[@]}" create
  if docker ps --format '{{.Names}}' | grep -qx "$NEW"; then
    echo "$NEW is already serving; certificates left alone."
  else
    DATA=$(docker inspect "$OLD" --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}')
    docker run --rm -v "$DATA":/from:ro -v edge_caddy_data:/to alpine sh -c 'cp -a /from/. /to/'
    echo "Copied certificates from $DATA."
  fi

  docker run --rm -v "$EDGE/conf":/etc/caddy:ro caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>"$TMP/validate.log" \
    || { echo "The new config does NOT validate:"; tail -5 "$TMP/validate.log"; exit 1; }
  echo "New config validates. Site files:"; ls "$SITES"
  echo "Served now:"; probe
  echo "Nothing is switched yet. Next: setup.sh user@host switch"
  exit 0
fi

# switch
[ -f "$EDGE/docker-compose.yml" ] || { echo "Run 'prepare' first."; exit 1; }
BEFORE=$(probe)
docker stop "$OLD" >/dev/null
if ! "${COMPOSE[@]}" up -d >/dev/null 2>"$TMP/up.log"; then
  echo "The edge proxy did not start:"; tail -5 "$TMP/up.log"
  old_proxy_back; exit 1
fi
AFTER=""
for _ in 1 2 3 4 5 6; do
  sleep 3
  AFTER=$(probe)
  [ "$AFTER" = "$BEFORE" ] && break
done
if [ "$AFTER" != "$BEFORE" ]; then
  echo "Hosts do not answer as before."; echo "Before:"; echo "$BEFORE"; echo "After:"; echo "$AFTER"
  docker logs --tail 20 "$NEW" 2>&1 || true
  old_proxy_back; exit 1
fi
# The old proxy stays, stopped, for a manual rollback; it must not come back after a reboot.
docker update --restart=no "$OLD" >/dev/null
echo "Switched: $NEW serves ports 80/443."; echo "$AFTER"

#!/usr/bin/env bash
# Server-side half of deploy/app-deploy.sh. Runs on the VPS; not meant to be run by hand.
# Usage: app-remote.sh /path/to/src.tar.gz <revision>
#
#   1. unpacks the source into /opt/ciss-store/src
#   2. builds ciss-store:<revision>. NEXT_PUBLIC_* lines of the env file become build
#      args (they are compiled into the browser bundle). The production Supabase
#      project must be reachable: catalogue pages are prerendered at build time.
#   3. replaces the container (bound to 127.0.0.1:3100, joined to Caddy's 'web'
#      network), waits for the health check and rolls back if it fails
#   4. installs /etc/cron.d/ciss-store, which releases expired stock reservations
set -euo pipefail

SRC_TGZ="${1:?source tarball}"
REV="${2:?revision}"
APP=${CISS_APP_DIR:-/opt/ciss-store}
ENV_FILE=$APP/.env

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Create it from .env.example first (see docs/DEPLOYMENT.md)."
  exit 1
fi
chmod 600 "$ENV_FILE"

rm -rf "$APP/src.new"
mkdir -p "$APP/src.new"
tar -xzf "$SRC_TGZ" -C "$APP/src.new"
rm -rf "$APP/src"
mv "$APP/src.new" "$APP/src"

# Always rebuild: catalogue and content pages are prerendered from the live database.
BUILD_ARGS=(--build-arg "BUILD_ID=$REV-$(date +%s)")
while IFS= read -r line; do
  BUILD_ARGS+=(--build-arg "$line")
done < <(grep -E '^NEXT_PUBLIC_[A-Z0-9_]+=' "$ENV_FILE" | sed -E 's/^([A-Z0-9_]+)="?([^"]*)"?$/\1=\2/')

# Behind a TLS-intercepting proxy, put its CA at /opt/ciss-store/ca.crt.
if [ -f "$APP/ca.crt" ]; then BUILD_ARGS+=(--secret "id=ca,src=$APP/ca.crt"); fi

echo "Building ciss-store:$REV (a few minutes) ..."
DOCKER_BUILDKIT=1 docker build -t "ciss-store:$REV" "${BUILD_ARGS[@]}" "$APP/src"

PREV=$(docker inspect ciss-store --format '{{.Config.Image}}' 2>/dev/null || true)
NET=$(docker network ls --format '{{.Name}}' | grep -E '(^|_)web$' | head -1 || true)

start() {
  docker rm -f ciss-store >/dev/null 2>&1 || true
  docker run -d --name ciss-store --restart unless-stopped \
    --env-file "$ENV_FILE" -e NODE_ENV=production \
    -p 127.0.0.1:3100:3000 "$1" >/dev/null
  if [ -n "$NET" ]; then docker network connect "$NET" ciss-store; fi
  for _ in $(seq 1 45); do
    [ "$(docker inspect ciss-store --format '{{.State.Health.Status}}')" = healthy ] && return 0
    sleep 2
  done
  return 1
}

if start "ciss-store:$REV"; then
  echo "ciss-store:$REV is healthy${NET:+ (network $NET)}."
else
  echo "The new container failed its health check. Last log lines:"
  docker logs --tail 40 ciss-store 2>&1 || true
  if [ -n "$PREV" ] && [ "$PREV" != "ciss-store:$REV" ]; then
    echo "Rolling back to $PREV ..."
    start "$PREV" && echo "Rolled back to $PREV."
  fi
  exit 1
fi

# Every 5 minutes: release stock held by unpaid orders whose payment window has passed.
# The secret is read by curl from a root-only file, not passed on the command line, where
# every user of this shared server could see it in the process list.
CRON_CURL=$APP/cron.curl
( umask 077; printf 'header = "Authorization: Bearer %s"\n' "$(grep -E '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')" > "$CRON_CURL" )
chmod 600 "$CRON_CURL"
cat > /etc/cron.d/ciss-store <<CRON
# Installed by deploy/app-deploy.sh (CISS Solutions repo). Remove with deploy/app-remove.sh.
*/5 * * * * root curl -fsS -m 30 -K $CRON_CURL http://127.0.0.1:3100/api/cron/release-reservations >/dev/null 2>&1
CRON
chmod 644 /etc/cron.d/ciss-store

# Keep the three most recent images for quick manual rollback.
docker images ciss-store --format '{{.CreatedAt}}\t{{.Tag}}' | sort -r | cut -f2 | grep -v '^latest$' \
  | tail -n +4 | xargs -r -I{} docker rmi "ciss-store:{}" >/dev/null 2>&1 || true

docker ps --filter name=ciss-store --format '{{.Names}}  {{.Status}}  {{.Ports}}'

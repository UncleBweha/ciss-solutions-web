#!/usr/bin/env bash
# Deploy the site to a VPS as its own Docker container (nginx:alpine), independent
# of anything else on the server. Uses a single SSH connection (one password prompt).
#
# Usage: deploy/deploy.sh user@host [port] [ssh_key]
#   port     host port to serve on (default 8080)
#   ssh_key  optional path to a private key
set -euo pipefail

TARGET="${1:?usage: deploy.sh user@host [port] [ssh_key]}"
PORT="${2:-8080}"
SSH=(ssh)
if [ -n "${3:-}" ]; then SSH+=(-i "$3"); fi

cd "$(dirname "$0")/.."

echo "Deploying to $TARGET on port $PORT ..."
tar -czf - index.html assets | "${SSH[@]}" "$TARGET" "set -e
  mkdir -p /var/www/ciss-solutions
  rm -rf /var/www/ciss-solutions/*
  tar -xzf - -C /var/www/ciss-solutions
  docker rm -f ciss-solutions >/dev/null 2>&1 || true
  docker run -d --name ciss-solutions --restart unless-stopped \
    -p $PORT:80 -v /var/www/ciss-solutions:/usr/share/nginx/html:ro nginx:alpine >/dev/null
  # rejoin Caddy's shared network (see caddy-add.sh) so the domain keeps working after a redeploy
  NET=\$(docker network ls --format '{{.Name}}' | grep -E '(^|_)web\$' | head -1 || true)
  [ -n \"\$NET\" ] && docker network connect \"\$NET\" ciss-solutions && echo \"Joined network \$NET\"
  docker ps --filter name=ciss-solutions --format '{{.Names}}  {{.Status}}  {{.Ports}}'"

echo "Done. Visit http://${TARGET#*@}:$PORT"

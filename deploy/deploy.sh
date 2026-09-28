#!/usr/bin/env bash
# Upload the site to a VPS running Nginx and enable it as its own server block.
# Does not touch any other site's config.
#
# Usage: deploy/deploy.sh user@host [port] [server_name] [ssh_key]
#   port         defaults to 80
#   server_name  a domain, or "_" to answer on the bare IP (default "_")
#   ssh_key      optional path to a private key
set -euo pipefail

TARGET="${1:?usage: deploy.sh user@host [port] [server_name] [ssh_key]}"
PORT="${2:-80}"
NAME="${3:-_}"
KEY="${4:-}"
SSH=(ssh); SCP=(scp)
if [ -n "$KEY" ]; then SSH+=(-i "$KEY"); SCP+=(-i "$KEY"); fi

cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
mkdir -p "$TMP/site"
cp -r index.html assets "$TMP/site/"
sed -e "s/LISTEN_PORT/$PORT/g" -e "s/SERVER_NAME/$NAME/" deploy/nginx-ciss.conf > "$TMP/ciss-solutions.conf"

echo "Uploading to $TARGET ..."
"${SSH[@]}" "$TARGET" 'rm -rf /tmp/ciss-deploy && mkdir -p /tmp/ciss-deploy'
"${SCP[@]}" -r "$TMP/site" "$TMP/ciss-solutions.conf" "$TARGET:/tmp/ciss-deploy/"

"${SSH[@]}" "$TARGET" 'set -e
  SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO=sudo
  $SUDO mkdir -p /var/www/ciss-solutions
  $SUDO cp -r /tmp/ciss-deploy/site/. /var/www/ciss-solutions/
  $SUDO cp /tmp/ciss-deploy/ciss-solutions.conf /etc/nginx/sites-available/ciss-solutions
  $SUDO ln -sf /etc/nginx/sites-available/ciss-solutions /etc/nginx/sites-enabled/ciss-solutions
  $SUDO nginx -t && $SUDO systemctl reload nginx
  rm -rf /tmp/ciss-deploy'

rm -rf "$TMP"
echo "Done."

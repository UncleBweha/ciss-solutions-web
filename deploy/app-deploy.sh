#!/usr/bin/env bash
# Deploy the Next.js store to the VPS as its own Docker container (ciss-store),
# next to (not instead of) the static coming-soon container. Public traffic only
# moves to the store when you run: deploy/app-switch.sh user@host app
#
# Usage: deploy/app-deploy.sh user@host [ssh_key]
#
# One-time server setup: create /opt/ciss-store/.env (chmod 600) with the
# production values listed in .env.example. It never leaves the server.
# The server-side steps are in deploy/app-remote.sh. Uses one SSH connection.
set -euo pipefail

TARGET="${1:?usage: app-deploy.sh user@host [ssh_key]}"
SSH=(ssh)
if [ -n "${2:-}" ]; then SSH+=(-i "$2"); fi

HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE/.."

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Note: uncommitted changes are NOT deployed; only the committed HEAD is shipped."
fi
REV="$(git rev-parse --short HEAD)"
echo "Deploying ciss-store $REV to $TARGET ..."

BUNDLE="$(mktemp -d)"
trap 'rm -rf "$BUNDLE"' EXIT
git archive --format=tar.gz -o "$BUNDLE/src.tar.gz" HEAD
cp "$HERE/app-remote.sh" "$BUNDLE/remote.sh"

tar -czf - -C "$BUNDLE" src.tar.gz remote.sh | "${SSH[@]}" "$TARGET" \
  "set -e; d=\$(mktemp -d); trap 'rm -rf \"\$d\"' EXIT; tar -xzf - -C \"\$d\"; bash \"\$d/remote.sh\" \"\$d/src.tar.gz\" $REV"

echo "Done. The store runs on the server at 127.0.0.1:3100 (container ciss-store)."
echo "To send cisssolutions.co.ke to it: deploy/app-switch.sh $TARGET app"

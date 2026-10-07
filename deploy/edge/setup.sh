#!/usr/bin/env bash
# One-time: move ports 80/443 of the VPS from toolsman's own Caddy container to the
# edge proxy in this folder, so no project's deploy can change another's routing.
#
#   prepare   Everything that causes no downtime: /opt/edge, a site file per project
#             (taken from what is being served now), a copy of the certificates, and
#             a validation of the new config. Safe to repeat.
#   switch    Stops toolsman-next-caddy-1 and starts edge-caddy (a few seconds for
#             every site), then checks every host answers as it did before. If one
#             does not, the old proxy is started again.
#   rollback  Back to the old proxy by hand.
#
# Usage: deploy/edge/setup.sh user@host prepare|switch|rollback [ssh_key]
set -euo pipefail
USAGE="usage: setup.sh user@host prepare|switch|rollback [ssh_key]"
TARGET="${1:?$USAGE}"
STEP="${2:?$USAGE}"
SSH=(ssh)
if [ -n "${3:-}" ]; then SSH+=(-i "$3"); fi
HERE="$(cd "$(dirname "$0")" && pwd)"

case "$STEP" in
  prepare | switch | rollback) ;;
  *) echo "$USAGE"; exit 1 ;;
esac

# One SSH connection: the two config files and the server-side script travel together.
tar -czf - -C "$HERE" docker-compose.yml Caddyfile setup-remote.sh | "${SSH[@]}" "$TARGET"   "set -e; d=\$(mktemp -d); trap 'rm -rf \"\$d\"' EXIT; tar -xzf - -C \"\$d\"; bash \"\$d/setup-remote.sh\" $STEP \"\$d\""

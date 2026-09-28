#!/usr/bin/env bash
# Sets the GitHub Actions deploy secrets on the web and POS repos.
# Re-run with a new host/key when moving to a different VPS.
#
# Usage: deploy/setup-github-secrets.sh [host] [user] [private_key] [pos_env_file]
set -euo pipefail
HOST="${1:-169.58.35.158}"
SSH_USER="${2:-root}"
KEY="${3:-$HOME/.ssh/ciss_deploy}"
POS_ENV="${4:-$(dirname "$0")/../../CISS SOLUTIONS POS/.env}"
REPOS=(UncleBweha/ciss-solutions-web UncleBweha/ciss-solutions-pos)

[ -f "$KEY" ] || { echo "Private key not found: $KEY"; exit 1; }
KH=$(ssh-keyscan -T 10 "$HOST" 2>/dev/null)
[ -n "$KH" ] || { echo "Could not read host keys from $HOST"; exit 1; }
echo "Host key fingerprints for $HOST (should match what you trust):"
printf '%s\n' "$KH" | ssh-keygen -lf - | sed 's/^/  /'

for r in "${REPOS[@]}"; do
  echo "== $r"
  gh secret set VPS_HOST -R "$r" -b "$HOST"
  gh secret set VPS_USER -R "$r" -b "$SSH_USER"
  gh secret set VPS_SSH_KEY -R "$r" < "$KEY"
  printf '%s\n' "$KH" | gh secret set VPS_KNOWN_HOSTS -R "$r"
done

if [ -f "$POS_ENV" ]; then
  echo "== Supabase build settings from $POS_ENV"
  gh secret set -f "$POS_ENV" -R UncleBweha/ciss-solutions-pos
else
  echo "POS .env not found at $POS_ENV; set the VITE_SUPABASE_* secrets manually."
fi
echo "Done."

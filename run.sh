#!/usr/bin/env bash
# Start the notes dashboard.
set -euo pipefail

VAULT="${VAULT_PATH:-/mnt/c/Users/pgleb/Desktop/Notes}"
PORT="${PORT:-3001}"
APP="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"

open_browser() {
  cmd.exe /c start "http://localhost:$PORT" >/dev/null 2>&1 || true
}

if curl -sf -o /dev/null "http://localhost:$PORT/api/tree"; then
  echo "already running at http://localhost:$PORT"
  open_browser
  exit 0
fi

if [ ! -d "$VAULT" ]; then
  echo "vault not found: $VAULT" >&2
  exit 1
fi

if ! command -v node >/dev/null; then
  export PATH="$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" | sort -V | tail -1)/bin:$PATH"
fi

cd "$APP"

(
  for _ in $(seq 60); do
    curl -sf -o /dev/null "http://localhost:$PORT/api/tree" && { open_browser; break; }
    sleep 1
  done
) &

VAULT_PATH="$VAULT" exec npx next dev -p "$PORT"

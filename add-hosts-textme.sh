#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$APP_DIR/data/runtime-config.env"
PORT="80"

if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

if grep -Eq '(^|[[:space:]])text\.me($|[[:space:]])' /etc/hosts; then
  echo "text.me already exists in /etc/hosts."
else
  echo "Adding text.me to /etc/hosts..."
  printf '\n127.0.0.1 text.me\n' | sudo tee -a /etc/hosts >/dev/null
fi

if [[ "$PORT" == "80" ]]; then
  echo "Open: http://text.me"
else
  echo "Open: http://text.me:$PORT"
fi

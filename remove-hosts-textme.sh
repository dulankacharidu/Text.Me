#!/usr/bin/env bash
set -euo pipefail

TMP_FILE="$(mktemp)"
grep -Ev '(^|[[:space:]])text\.me($|[[:space:]])' /etc/hosts > "$TMP_FILE" || true
sudo cp "$TMP_FILE" /etc/hosts
rm -f "$TMP_FILE"
echo "text.me was removed from /etc/hosts."

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
mkdir -p "$APP_DIR/data"
rm -f "$APP_DIR/data/.unix-setup-complete"
rm -f "$APP_DIR/data/.linux-setup-complete"

exec "$SCRIPT_DIR/start-textme.sh"

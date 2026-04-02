#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "$APP_DIR/data"
rm -f "$APP_DIR/data/.unix-setup-complete"

exec "$APP_DIR/start-textme.sh"

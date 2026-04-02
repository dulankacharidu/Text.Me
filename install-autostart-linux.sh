#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOSTART_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/autostart"
DESKTOP_FILE="$AUTOSTART_DIR/textme-lan.desktop"

mkdir -p "$AUTOSTART_DIR"

cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=Text.Me LAN
Exec=/bin/bash -lc 'cd "$APP_DIR" && "$APP_DIR/start-textme.sh" --quiet'
Path=$APP_DIR
X-GNOME-Autostart-enabled=true
Terminal=false
EOF

echo "Linux login autostart created:"
echo "  $DESKTOP_FILE"

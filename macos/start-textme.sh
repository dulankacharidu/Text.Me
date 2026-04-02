#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="$APP_DIR/data"
CONFIG_FILE="$DATA_DIR/runtime-config.env"
SETUP_MARKER="$DATA_DIR/.macos-setup-complete"
PID_FILE="$DATA_DIR/textme.pid"
LOG_FILE="$DATA_DIR/server.log"
HOST_ALIAS="text.me"
PORT="80"
QUIET_MODE="0"

mkdir -p "$DATA_DIR"

if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

if [[ "${1:-}" == "--quiet" ]]; then
  QUIET_MODE="1"
fi

save_config() {
  cat > "$CONFIG_FILE" <<EOF
export PORT="${PORT}"
EOF
}

default_url() {
  if [[ "$PORT" == "80" ]]; then
    echo "http://localhost"
  else
    echo "http://localhost:$PORT"
  fi
}

alias_url() {
  if [[ "$PORT" == "80" ]]; then
    echo "http://$HOST_ALIAS"
  else
    echo "http://$HOST_ALIAS:$PORT"
  fi
}

is_running() {
  [[ -f "$PID_FILE" ]] || return 1
  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null
}

open_browser() {
  open "$(default_url)" >/dev/null 2>&1 || true
}

prompt_port_selection() {
  [[ "$QUIET_MODE" == "1" ]] && return 0
  echo "Choose the server port:"
  echo "  [1] 80  (Default, opens as http://$HOST_ALIAS)"
  echo "  [2] 3000"
  echo "  [3] Custom port"
  read -r -p "Select port [1/2/3]: " selection
  case "$selection" in
    2) PORT="3000" ;;
    3)
      read -r -p "Enter custom port number: " custom_port
      if [[ "$custom_port" =~ ^[0-9]+$ ]] && (( custom_port >= 1 && custom_port <= 65535 )); then
        PORT="$custom_port"
      else
        PORT="80"
      fi
      ;;
    *) PORT="80" ;;
  esac
  save_config
}

prompt_optional_setup() {
  prompt_port_selection
  [[ "$QUIET_MODE" == "1" ]] && return 0

  echo
  read -r -p "Add Text.Me LAN to macOS login startup? [y/N]: " startup_reply
  case "$startup_reply" in
    [yY]|[yY][eE][sS]) "$SCRIPT_DIR/install-autostart-macos.sh" ;;
  esac

  echo
  if [[ "$PORT" == "80" ]]; then
    echo "The hosts entry can create $(alias_url) on this computer."
  else
    echo "The hosts entry can create $(alias_url) on this computer."
    echo "It cannot remove :$PORT unless the server runs on port 80."
  fi
  read -r -p "Add $HOST_ALIAS to /etc/hosts? [y/N]: " hosts_reply
  case "$hosts_reply" in
    [yY]|[yY][eE][sS]) "$SCRIPT_DIR/add-hosts-textme.sh" ;;
  esac
}

command -v node >/dev/null 2>&1 || { echo "[ERROR] Node.js is not installed or not on PATH."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "[ERROR] npm is not installed or not on PATH."; exit 1; }

if [[ ! -d "$APP_DIR/node_modules" ]]; then
  echo "Installing dependencies..."
  (cd "$APP_DIR" && npm install)
  prompt_optional_setup
  touch "$SETUP_MARKER"
elif [[ ! -f "$SETUP_MARKER" ]]; then
  [[ "$QUIET_MODE" != "1" ]] && echo "First-time macOS setup options:"
  prompt_optional_setup
  touch "$SETUP_MARKER"
fi

if is_running; then
  echo "Text.Me LAN is already running."
  echo "  $(default_url)"
  open_browser
  exit 0
fi

echo "Starting Text.Me LAN in background..."
(
  cd "$APP_DIR"
  nohup env PORT="$PORT" node server.js >> "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
)

sleep 2

if is_running; then
  echo "Text.Me LAN is running on:"
  echo "  $(default_url)"
  echo "  $(alias_url)"
  open_browser
  exit 0
fi

echo "[ERROR] The server did not start correctly."
echo "Check $LOG_FILE for details."
exit 1

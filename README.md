# Text.Me v1.2.0 Updated

Text.Me is a LAN-only offline messaging and note-sharing app for:
- Windows PCs
- Linux PCs
- macOS Macs
- iPhone browsers or PWA
- Android browsers or PWA

It is designed for private local-network use, with live sync between paired devices.

## Main features

- LAN-only access protection
- One-time PIN pairing for new devices
- Automatic reconnect for previously paired devices
- Live synced text notes
- Live synced freehand drawing
- Multi-page notebook sharing
- Two-way file upload and download between paired users
- Per-page file attachments
- Windows hidden background launcher
- Linux background launcher
- macOS background launcher
- Optional Windows startup shortcut creation
- Optional Linux/macOS login startup helpers
- Optional `text.me` hosts alias on Windows, Linux, and macOS
- Refreshed responsive UI with footer and social links

## What's new in v1.2.0

- Added file upload support
- Added incoming file download flow for the paired user
- Added automatic removal of incoming-file notice after download
- Improved pair persistence after browser refresh or server restart
- Fixed partner switching so old pair links are removed correctly
- Added hidden Windows launcher to avoid a permanent command window
- Added first-run Windows setup prompts for startup and hosts alias
- Added configurable server port with default option `80`
- Added helper scripts for adding/removing `text.me` in the hosts file
- Added Linux and macOS launcher/support scripts
- Restyled the UI and footer branding

## Project files

- `server.js`: Express + WebSocket LAN server
- `public/app.js`: client app logic
- `public/index.html`: app layout
- `public/styles.css`: UI styling
- `start-textme.bat`: Windows launcher with setup prompts
- `launch-textme-hidden.vbs`: hidden Windows background starter
- `stop-textme.bat`: stops the running Windows server
- `configure-textme.bat`: reruns Windows setup questions
- `add-hosts-textme.bat`: adds `text.me` to Windows hosts
- `remove-hosts-textme.bat`: removes `text.me` from Windows hosts
- `start-textme.sh`: Linux/macOS launcher
- `stop-textme.sh`: stops Linux/macOS background server
- `configure-textme.sh`: reruns Linux/macOS setup
- `add-hosts-textme.sh`: adds `text.me` to `/etc/hosts`
- `remove-hosts-textme.sh`: removes `text.me` from `/etc/hosts`
- `install-autostart-linux.sh`: creates Linux login autostart entry
- `install-autostart-macos.sh`: creates macOS LaunchAgent

## Quick start

### Option 1: Windows launcher

Double-click:

```bat
start-textme.bat
```

On first setup it can ask:
- which port to use: `80`, `3000`, or custom
- whether to add Text.Me to Windows startup
- whether to add `text.me` to the Windows hosts file

If you want to rerun those questions later:

```bat
configure-textme.bat
```

### Option 2: Linux or macOS launcher

Make the shell scripts executable once:

```bash
chmod +x start-textme.sh stop-textme.sh configure-textme.sh add-hosts-textme.sh remove-hosts-textme.sh install-autostart-linux.sh install-autostart-macos.sh
```

Start the app:

```bash
./start-textme.sh
```

On first setup it can ask:
- which port to use: `80`, `3000`, or custom
- whether to add Text.Me to Linux/macOS login startup
- whether to add `text.me` to `/etc/hosts`

If you want to rerun those questions later:

```bash
./configure-textme.sh
```

### Option 3: Manual terminal start

```bash
npm install
npm start
```

## Default URLs

If port `80` is selected:
- `http://localhost`
- `http://text.me` on the host machine if hosts entry was added

If port `3000` is selected:
- `http://localhost:3000`
- `http://text.me:3000` on the host machine if hosts entry was added

For other devices on the same LAN:
- `http://<HOST_LAN_IP>:PORT`

Example:

```text
http://192.168.1.136:3000
```

## Pairing flow

1. Open Text.Me on both devices.
2. If they were paired before, they reconnect automatically.
3. If not paired, device one clicks `Create PIN`.
4. Device two enters the PIN and clicks `Join PIN`.
5. After pairing, both devices can live sync text, drawing, and files.

## File sharing flow

1. Upload a file from one paired device.
2. The other user sees the file name and download notice.
3. The other user clicks `Download`.
4. The file downloads to that device.
5. The incoming download notice disappears after download.

This works both ways between paired users.

## Auto reconnect behavior

- Paired links are saved in `data/state.json`
- Reloading the browser does not remove pairing
- Restarting the server does not remove pairing
- If a user creates a new PIN and pairs with a different user, the old pairing is removed cleanly

## LAN-only protection

- The app blocks non-LAN clients
- It is intended for private local-network use only
- Files are stored locally on the host machine under `data/uploads`

## Windows helper scripts

Start hidden server:

```bat
start-textme.bat
```

Stop server:

```bat
stop-textme.bat
```

Rerun setup:

```bat
configure-textme.bat
```

Add hosts entry:

```bat
add-hosts-textme.bat
```

Remove hosts entry:

```bat
remove-hosts-textme.bat
```

## Linux and macOS helper scripts

Start hidden/background server:

```bash
./start-textme.sh
```

Stop server:

```bash
./stop-textme.sh
```

Rerun setup:

```bash
./configure-textme.sh
```

Add hosts entry:

```bash
./add-hosts-textme.sh
```

Remove hosts entry:

```bash
./remove-hosts-textme.sh
```

Linux login startup:

```bash
./install-autostart-linux.sh
```

macOS login startup:

```bash
./install-autostart-macos.sh
```

## Notes

- `text.me` from the hosts file works only on the machine where you added it
- Phones and tablets usually connect using the host LAN IP unless your network has local DNS for `text.me`
- To open just `http://text.me` without a port, use port `80`
- If another app already uses port `80`, choose `3000` or a custom port
- On Unix systems, `sudo` is required to edit `/etc/hosts`

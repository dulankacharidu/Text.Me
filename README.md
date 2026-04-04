# Text.Me v1.2.0 Updated

![Text me_Poster](https://github.com/user-attachments/assets/9f55f442-5fd2-4793-90a2-e44739615358)


## Text.Me is a LAN-only offline messaging and note-sharing app for:
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
- Optional startup/login helpers for each desktop OS
- Optional `text.me` hosts alias on Windows, Linux, and macOS
- Refreshed responsive UI with footer and social links

## What's new in v1.2.0

- Added file upload support
- Added incoming file download flow for the paired user
- Added automatic removal of incoming-file notice after download
- Improved pair persistence after browser refresh or server restart
- Fixed partner switching so old pair links are removed correctly
- Added hidden Windows launcher to avoid a permanent command window
- Added configurable server port with default option `80`
- Added helper scripts for adding/removing `text.me` in the hosts file
- Added Linux and macOS launcher/support scripts
- Cleaned repository structure into platform folders: `windows/`, `linux/`, `macos/`
- Restyled the UI and footer branding

## Main Web Panel

 <center> <img width="560" height="720" alt="Webpanel v1 2" src="https://github.com/user-attachments/assets/25af043f-d0db-4a40-bd5a-25249495050e" /></center>

 ## Main Mobile Panel

  <center><img width="350" height="720" alt="Mobile_version" src="https://github.com/user-attachments/assets/48df2c89-bced-4f49-8331-b41280fe62d0" /></center>

## Repository structure

Core app:
- `server.js`
- `package.json`
- `public/`
- `img/`

Windows files:
- `windows/start-textme.bat`
- `windows/stop-textme.bat`
- `windows/configure-textme.bat`
- `windows/add-hosts-textme.bat`
- `windows/remove-hosts-textme.bat`
- `windows/launch-textme-hidden.vbs`

Linux files:
- `linux/start-textme.sh`
- `linux/stop-textme.sh`
- `linux/configure-textme.sh`
- `linux/add-hosts-textme.sh`
- `linux/remove-hosts-textme.sh`
- `linux/install-autostart-linux.sh`

macOS files:
- `macos/start-textme.sh`
- `macos/stop-textme.sh`
- `macos/configure-textme.sh`
- `macos/add-hosts-textme.sh`
- `macos/remove-hosts-textme.sh`
- `macos/install-autostart-macos.sh`

## Quick start

### Windows

Double-click:

```bat
windows\start-textme.bat
```

Rerun setup:

```bat
windows\configure-textme.bat
```

### Linux

Make scripts executable once:

```bash
chmod +x linux/*.sh
```

Start:

```bash
./linux/start-textme.sh
```

Rerun setup:

```bash
./linux/configure-textme.sh
```

### macOS

Make scripts executable once:

```bash
chmod +x macos/*.sh
```

Start:

```bash
./macos/start-textme.sh
```

Rerun setup:

```bash
./macos/configure-textme.sh
```

### Manual terminal start

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

## Notes

- `text.me` from the hosts file works only on the machine where you added it
- Phones and tablets usually connect using the host LAN IP unless your network has local DNS for `text.me`
- To open just `http://text.me` without a port, use port `80`
- If another app already uses port `80`, choose `3000` or a custom port
- On Linux/macOS, `sudo` is required to edit `/etc/hosts`
- iF there have any issues problems vulnerables please make Pull request or send me on vcreation.lk@gmail.com or https://fb.com/dulankacharidu

Thank You Have a Nice day !!!

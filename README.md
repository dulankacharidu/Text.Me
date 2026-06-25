# Text.Me LAN

Simple, fast LAN live note app for:
- Windows PCs
- iPhone (Safari/PWA)
- Android phones (Chrome/PWA)

## What this app does
- Works on **local area network only** (LAN only).
- After first pairing, devices reconnect automatically when they open app on same LAN.
- PIN is needed only for first-time pairing or when using a new device/browser.
- Live synced **text + freehand drawing**.
- Multi-page notes with autosave history on server (`data/state.json`).

## Quick start

```bash
npm install
npm start
```

Open on host machine:
- `http://localhost:3000`

Open from phone in same LAN:
- `http://<HOST_LAN_IP>:3000`


## Easy start on Windows (.bat)
1. Double-click `start-textme.bat` in this project folder.
2. It will check Node.js, run `npm install`, and start the server automatically.
3. Open `http://localhost:3000` on your PC.

## Pairing flow
1. If devices were paired before: open app on both devices and it auto-connects.
2. If not paired yet: on first device click **Create PIN**.
3. On second device enter PIN and click **Join PIN**.
4. After successful pair, next launches on same LAN do not require PIN.

## LAN-only behavior
- Server rejects non-LAN clients (internet/public IP access is blocked).
- Use this for private local text/code sharing between phone and PC.

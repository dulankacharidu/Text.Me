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

## Pairing flow
1. If devices were paired before: open app on both devices and it auto-connects.
2. If not paired yet: on first device click **Create PIN**.
3. On second device enter PIN and click **Join PIN**.
4. After successful pair, next launches on same LAN do not require PIN.

## LAN-only behavior
- Server rejects non-LAN clients (internet/public IP access is blocked).
- Use this for private local text/code sharing between phone and PC.
- 

## Windows one-click start
- Double-click `start-textme.bat`.
- On first run it installs dependencies, then starts the app.
- It opens server on `http://localhost:3000` (and your LAN IP for iPhone/other devices).

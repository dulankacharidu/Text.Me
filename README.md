# Text.Me on LAN

<img width="975" height="1000" alt="Webpanel" src="https://github.com/user-attachments/assets/7ffe38a6-2e45-4f9d-b62f-c66417074dab" />

##Simple, fast LAN live note app for:
- Windows PCs
- iPhone (Safari/PWA)
- Android phones (Chrome/PWA)

- ![9c3f68df-e73f-46a0-8d0b-2803879176a9](https://github.com/user-attachments/assets/35a94b8d-b302-45d0-856e-f15026f449f6)
- ![WhatsApp Image 2026-03-24 at 00 31 06](https://github.com/user-attachments/assets/b639ca22-f8b2-42bf-8d1f-359df1b531b7)



## What this app does
- Works on **local area network only** (LAN only).
- After first pairing, devices reconnect automatically when they open app on same LAN.
- PIN is needed only for first-time pairing or when using a new device/browser.
- Live synced **text + freehand drawing**.
- Multi-page notes with autosave history on server (`data/state.json`).

## Quick start

Download In Linux :
`````Download & Install on Linux``````
sudo apt update && upgrade -y
sudo apt install git
sudo apt install npm
git clone https://github.com/dulankacharidu/Text.Me.git
cd Text.me
`````````

```bash
npm install
npm start
```

# Open on host machine:
 - `http://localhost:3000`

# Open from phone in same LAN:
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

   
♥️ Feedback
Your feedback is essential to helping us improve this experience. Please use the “Files Changed” preview feedback discussion to report problems, ask questions, and review known issues.
- Developed By : Codex
- Idea and Design By : Dulanka Charidu 


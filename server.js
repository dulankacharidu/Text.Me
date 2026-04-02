const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const net = require('net');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: '25mb' }));

function normalizeRemoteAddress(addr = '') {
  if (!addr) return '';
  return addr.startsWith('::ffff:') ? addr.slice(7) : addr;
}

function isPrivateIpv4(addr) {
  const parts = addr.split('.').map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  return false;
}

function isLanAddress(addr = '') {
  const normalized = normalizeRemoteAddress(addr);
  const ipVersion = net.isIP(normalized);
  if (!ipVersion) return false;
  if (ipVersion === 4) return isPrivateIpv4(normalized);

  const lowered = normalized.toLowerCase();
  if (lowered === '::1') return true;
  if (lowered.startsWith('fc') || lowered.startsWith('fd')) return true;
  if (lowered.startsWith('fe80:')) return true;
  return false;
}

app.use((req, res, next) => {
  const remote = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  if (!isLanAddress(remote)) {
    return res.status(403).json({
      error: 'LAN only: connect from same local network. Internet access is blocked.',
    });
  }
  return next();
});

app.use(express.static(path.join(__dirname, 'public')));

const defaultState = {
  links: {},
  notebooks: {},
};

function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return structuredClone(defaultState);
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    return {
      links: data.links || {},
      notebooks: data.notebooks || {},
    };
  } catch {
    return structuredClone(defaultState);
  }
}

const state = loadState();

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function normalizedPairKey(a, b) {
  return [a, b].sort().join('::');
}

function unlinkDevice(deviceId) {
  const partnerId = state.links[deviceId];
  if (!partnerId) return null;

  delete state.links[deviceId];
  if (state.links[partnerId] === deviceId) {
    delete state.links[partnerId];
  }

  sendTo(deviceId, { type: 'unpaired' });
  sendTo(partnerId, { type: 'unpaired' });
  return partnerId;
}

function ensureNotebook(deviceA, deviceB) {
  const key = normalizedPairKey(deviceA, deviceB);
  if (!state.notebooks[key]) {
    state.notebooks[key] = {
      updatedAt: new Date().toISOString(),
      pages: [{ text: '', strokes: [], attachments: [] }],
    };
  }
  state.notebooks[key].pages = (state.notebooks[key].pages || []).map((page) => ({
    text: typeof page?.text === 'string' ? page.text : '',
    strokes: Array.isArray(page?.strokes) ? page.strokes : [],
    attachments: Array.isArray(page?.attachments) ? page.attachments : [],
  }));
  return { key, notebook: state.notebooks[key] };
}

const pendingCodes = new Map();
const socketsByDevice = new Map();

function sendTo(deviceId, payload) {
  const ws = socketsByDevice.get(deviceId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function randomCode() {
  return String(crypto.randomInt(100000, 999999));
}

app.post('/api/pair/create', (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

  unlinkDevice(deviceId);

  let code = randomCode();
  while (pendingCodes.has(code)) code = randomCode();

  pendingCodes.set(code, { initiator: deviceId, expiresAt: Date.now() + 5 * 60 * 1000 });
  res.json({ code, expiresInSeconds: 300 });
});

app.post('/api/pair/join', (req, res) => {
  const { deviceId, code } = req.body;
  if (!deviceId || !code) return res.status(400).json({ error: 'deviceId and code required' });

  const info = pendingCodes.get(code);
  if (!info || info.expiresAt < Date.now()) {
    pendingCodes.delete(code);
    return res.status(404).json({ error: 'Code expired or invalid' });
  }

  if (info.initiator === deviceId) {
    return res.status(400).json({ error: 'Cannot pair same device' });
  }

  unlinkDevice(info.initiator);
  unlinkDevice(deviceId);

  state.links[info.initiator] = deviceId;
  state.links[deviceId] = info.initiator;
  pendingCodes.delete(code);

  ensureNotebook(info.initiator, deviceId);
  saveState();

  sendTo(info.initiator, { type: 'paired', with: deviceId });
  sendTo(deviceId, { type: 'paired', with: info.initiator });

  res.json({ pairedWith: info.initiator });
});

app.get('/api/status/:deviceId', (req, res) => {
  const deviceId = req.params.deviceId;
  const partnerId = state.links[deviceId] || null;

  if (!partnerId) return res.json({ paired: false });
  if (state.links[partnerId] !== deviceId) {
    delete state.links[deviceId];
    saveState();
    return res.json({ paired: false });
  }

  const { notebook } = ensureNotebook(deviceId, partnerId);
  res.json({
    paired: true,
    partnerId,
    partnerOnline: socketsByDevice.has(partnerId),
    notebook,
  });
});

app.post('/api/upload', (req, res) => {
  const { deviceId, pageIndex, fileName, mimeType, contentBase64 } = req.body;
  if (!deviceId || typeof pageIndex !== 'number' || !fileName || !contentBase64) {
    return res.status(400).json({ error: 'deviceId, pageIndex, fileName and contentBase64 required' });
  }

  const partnerId = state.links[deviceId];
  if (!partnerId) {
    return res.status(400).json({ error: 'Device is not paired' });
  }

  let buffer;
  try {
    buffer = Buffer.from(contentBase64, 'base64');
  } catch {
    return res.status(400).json({ error: 'Invalid file data' });
  }

  if (!buffer.length) {
    return res.status(400).json({ error: 'Uploaded file is empty' });
  }

  const maxBytes = 15 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    return res.status(413).json({ error: 'File too large. Max size is 15 MB.' });
  }

  const safeName = path.basename(String(fileName)).replace(/[^\w.\- ]+/g, '_');
  const fileId = crypto.randomUUID();
  const storedName = `${fileId}-${safeName}`;
  const filePath = path.join(UPLOADS_DIR, storedName);
  fs.writeFileSync(filePath, buffer);

  const { notebook } = ensureNotebook(deviceId, partnerId);
  while (notebook.pages.length <= pageIndex) {
    notebook.pages.push({ text: '', strokes: [], attachments: [] });
  }

  const attachment = {
    id: fileId,
    name: safeName,
    mimeType: mimeType || 'application/octet-stream',
    size: buffer.length,
    url: `/uploads/${encodeURIComponent(storedName)}`,
    uploadedAt: new Date().toISOString(),
    uploadedBy: deviceId,
  };

  notebook.pages[pageIndex].attachments.push(attachment);
  notebook.updatedAt = new Date().toISOString();
  saveState();

  sendTo(partnerId, {
    type: 'update',
    from: deviceId,
    pageIndex,
    text: notebook.pages[pageIndex].text,
    strokes: notebook.pages[pageIndex].strokes,
    attachments: notebook.pages[pageIndex].attachments,
    updatedAt: notebook.updatedAt,
  });

  return res.json({ attachment });
});

app.use('/uploads', express.static(UPLOADS_DIR, {
  index: false,
  fallthrough: false,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  },
}));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  const remote = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
  if (!isLanAddress(remote)) {
    ws.close(1008, 'LAN only access');
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const deviceId = url.searchParams.get('deviceId');

  if (!deviceId) {
    ws.close(1008, 'deviceId required');
    return;
  }

  socketsByDevice.set(deviceId, ws);

  const partnerId = state.links[deviceId];
  if (partnerId) {
    sendTo(partnerId, { type: 'presence', deviceId, online: true });
  }

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }

    const partner = state.links[deviceId];
    if (!partner) return;

    if (msg.type === 'update') {
      const { pageIndex, text, strokes } = msg;
      const { notebook } = ensureNotebook(deviceId, partner);

      while (notebook.pages.length <= pageIndex) {
        notebook.pages.push({ text: '', strokes: [], attachments: [] });
      }
      if (typeof text === 'string') notebook.pages[pageIndex].text = text;
      if (Array.isArray(strokes)) notebook.pages[pageIndex].strokes = strokes;
      if (Array.isArray(msg.attachments)) notebook.pages[pageIndex].attachments = msg.attachments;
      notebook.updatedAt = new Date().toISOString();
      saveState();

      sendTo(partner, {
        type: 'update',
        from: deviceId,
        pageIndex,
        text: notebook.pages[pageIndex].text,
        strokes: notebook.pages[pageIndex].strokes,
        attachments: notebook.pages[pageIndex].attachments,
        updatedAt: notebook.updatedAt,
      });
    }

    if (msg.type === 'page:add') {
      const { notebook } = ensureNotebook(deviceId, partner);
      notebook.pages.push({ text: '', strokes: [], attachments: [] });
      notebook.updatedAt = new Date().toISOString();
      saveState();
      sendTo(partner, { type: 'page:add', pages: notebook.pages.length, updatedAt: notebook.updatedAt });
    }
  });

  ws.on('close', () => {
    socketsByDevice.delete(deviceId);
    const partner = state.links[deviceId];
    if (partner) {
      sendTo(partner, { type: 'presence', deviceId, online: false });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Text.Me server running on http://0.0.0.0:${PORT}`);
});

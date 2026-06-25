const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const net = require('net');
const WebSocket = require('ws');
const QRCode = require('qrcode');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();
app.use(express.json({ limit: '25mb' }));
let needsMigrationSave = false;
const joinAttempts = new Map();

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
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return next();
});

app.use(express.static(path.join(__dirname, 'public')));

const defaultState = {
  sessions: {},
  notebooks: {},
  memberships: {},
};

function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return structuredClone(defaultState);
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const state = {
      sessions: data.sessions || {},
      notebooks: data.notebooks || {},
      memberships: data.memberships || {},
    };

    if (data.links && !Object.keys(state.sessions).length) {
      needsMigrationSave = true;
      const seen = new Set();
      for (const [deviceA, deviceB] of Object.entries(data.links)) {
        const pairKey = normalizedPairKey(deviceA, deviceB);
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);
        const sessionId = crypto.randomUUID();
        let code = randomCode();
        while (Object.values(state.sessions).some((session) => session.code === code)) {
          code = randomCode();
        }
        state.sessions[sessionId] = {
          code,
          members: [deviceA, deviceB],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        state.memberships[deviceA] = sessionId;
        state.memberships[deviceB] = sessionId;
      }
    }

    return {
      sessions: state.sessions,
      notebooks: state.notebooks,
      memberships: state.memberships,
    };
  } catch {
    return structuredClone(defaultState);
  }
}

const state = loadState();

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

if (needsMigrationSave) {
  saveState();
}

function normalizedPairKey(a, b) {
  return [a, b].sort().join('::');
}

function randomCode() {
  return String(crypto.randomInt(1000, 10000));
}

function cleanSession(sessionId) {
  const session = state.sessions[sessionId];
  if (!session) return;
  session.members = (session.members || []).filter(Boolean);
  if (!session.members.length) {
    delete state.sessions[sessionId];
  }
}

function getSessionId(deviceId) {
  return state.memberships[deviceId] || null;
}

function getSession(deviceId) {
  const sessionId = getSessionId(deviceId);
  if (!sessionId) return null;
  const session = state.sessions[sessionId];
  if (!session) {
    delete state.memberships[deviceId];
    return null;
  }
  session.members = Array.from(new Set((session.members || []).filter((memberId) => memberId && state.memberships[memberId] === sessionId)));
  if (!session.members.includes(deviceId)) {
    session.members.push(deviceId);
  }
  state.memberships[deviceId] = sessionId;
  return { sessionId, session };
}

function createSession() {
  const sessionId = crypto.randomUUID();
  let code = randomCode();
  while (Object.values(state.sessions).some((session) => session.code === code)) {
    code = randomCode();
  }
  state.sessions[sessionId] = {
    code,
    members: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return sessionId;
}

function ensureNotebook(sessionId) {
  const key = sessionId;
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

const socketsByDevice = new Map();

function sendTo(deviceId, payload) {
  const ws = socketsByDevice.get(deviceId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function sendSessionPresence(sessionId) {
  const session = state.sessions[sessionId];
  if (!session) return;
  const onlineMembers = (session.members || []).filter((memberId) => socketsByDevice.has(memberId));
  for (const memberId of session.members || []) {
    sendTo(memberId, {
      type: 'presence',
      deviceId: memberId,
      sessionId,
      online: onlineMembers.length > 1,
      onlineMembers: onlineMembers.filter((id) => id !== memberId),
      memberCount: session.members.length,
    });
  }
}

function removeDeviceFromSession(deviceId, notify = true) {
  const sessionId = state.memberships[deviceId];
  if (!sessionId) return null;
  const session = state.sessions[sessionId];
  delete state.memberships[deviceId];
  if (!session) return null;

  session.members = (session.members || []).filter((memberId) => memberId !== deviceId);
  session.updatedAt = new Date().toISOString();
  if (!session.members.length) {
    delete state.sessions[sessionId];
    delete state.notebooks[sessionId];
  } else if (notify) {
    sendSessionPresence(sessionId);
  }
  return sessionId;
}

app.post('/api/pair/create', (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

  removeDeviceFromSession(deviceId);
  const sessionId = createSession();
  state.sessions[sessionId].members.push(deviceId);
  state.memberships[deviceId] = sessionId;
  saveState();
  res.json({ code: state.sessions[sessionId].code, expiresInSeconds: null, sessionId });
});

app.get('/api/pair/qr/:code', async (req, res) => {
  const code = String(req.params.code || '').trim();
  const sessionEntry = Object.entries(state.sessions).find(([, session]) => String(session.code) === code);
  if (!sessionEntry) {
    return res.status(404).send('Session not found');
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const joinUrl = `${baseUrl}/?join=${encodeURIComponent(code)}`;
  const svg = await QRCode.toString(joinUrl, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 6,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.send(svg);
});

app.post('/api/pair/join', (req, res) => {
  const { deviceId, code } = req.body;
  if (!deviceId || !code) return res.status(400).json({ error: 'deviceId and code required' });

  const ipKey = normalizeRemoteAddress(req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown');
  const now = Date.now();
  const recentAttempts = (joinAttempts.get(ipKey) || []).filter((ts) => now - ts < 60_000);
  if (recentAttempts.length >= 10) {
    joinAttempts.set(ipKey, recentAttempts);
    return res.status(429).json({ error: 'Too many join attempts. Please wait a minute and try again.' });
  }
  recentAttempts.push(now);
  joinAttempts.set(ipKey, recentAttempts);

  const sessionEntry = Object.entries(state.sessions).find(([, session]) => String(session.code) === String(code));
  if (!sessionEntry) {
    return res.status(404).json({ error: 'Code expired or invalid' });
  }

  const [sessionId, session] = sessionEntry;
  if ((session.members || []).includes(deviceId)) {
    state.memberships[deviceId] = sessionId;
    saveState();
    sendSessionPresence(sessionId);
    return res.json({ pairedWith: sessionId, code: session.code, sessionId });
  }

  removeDeviceFromSession(deviceId, false);
  session.members = Array.from(new Set([...(session.members || []), deviceId]));
  session.updatedAt = new Date().toISOString();
  state.memberships[deviceId] = sessionId;
  ensureNotebook(sessionId);
  saveState();

  for (const memberId of session.members || []) {
    sendTo(memberId, { type: 'paired', sessionId, code: session.code, memberCount: session.members.length });
  }
  sendSessionPresence(sessionId);

  res.json({ pairedWith: sessionId, code: session.code, sessionId });
});

app.get('/api/status/:deviceId', (req, res) => {
  const deviceId = req.params.deviceId;
  const sessionInfo = getSession(deviceId);
  if (!sessionInfo) return res.json({ paired: false });

  const { sessionId, session } = sessionInfo;
  const { notebook } = ensureNotebook(sessionId);
  const otherMembers = (session.members || []).filter((memberId) => memberId !== deviceId);
  res.json({
    paired: true,
    sessionId,
    sessionCode: session.code,
    memberCount: session.members.length,
    partnerOnline: otherMembers.some((memberId) => socketsByDevice.has(memberId)),
    onlineMembers: otherMembers.filter((memberId) => socketsByDevice.has(memberId)),
    notebook,
  });
});

app.post('/api/upload', (req, res) => {
  const { deviceId, pageIndex, fileName, mimeType, contentBase64 } = req.body;
  if (!deviceId || typeof pageIndex !== 'number' || !fileName || !contentBase64) {
    return res.status(400).json({ error: 'deviceId, pageIndex, fileName and contentBase64 required' });
  }

  const sessionInfo = getSession(deviceId);
  if (!sessionInfo) {
    return res.status(400).json({ error: 'Device is not paired' });
  }
  const { sessionId, session } = sessionInfo;

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

  const { notebook } = ensureNotebook(sessionId);
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

  for (const memberId of session.members || []) {
    if (memberId === deviceId) continue;
    sendTo(memberId, {
      type: 'update',
      from: deviceId,
      pageIndex,
      text: notebook.pages[pageIndex].text,
      strokes: notebook.pages[pageIndex].strokes,
      attachments: notebook.pages[pageIndex].attachments,
      updatedAt: notebook.updatedAt,
    });
  }

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

  const sessionInfo = getSession(deviceId);
  if (sessionInfo) sendSessionPresence(sessionInfo.sessionId);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }

    const sessionInfo = getSession(deviceId);
    if (!sessionInfo) return;
    const { sessionId, session } = sessionInfo;

    if (msg.type === 'update') {
      const { pageIndex, text, strokes } = msg;
      const { notebook } = ensureNotebook(sessionId);

      while (notebook.pages.length <= pageIndex) {
        notebook.pages.push({ text: '', strokes: [], attachments: [] });
      }
      if (typeof text === 'string') notebook.pages[pageIndex].text = text;
      if (Array.isArray(strokes)) notebook.pages[pageIndex].strokes = strokes;
      if (Array.isArray(msg.attachments)) notebook.pages[pageIndex].attachments = msg.attachments;
      notebook.updatedAt = new Date().toISOString();
      saveState();

      for (const memberId of session.members || []) {
        if (memberId === deviceId) continue;
        sendTo(memberId, {
          type: 'update',
          from: deviceId,
          pageIndex,
          text: notebook.pages[pageIndex].text,
          strokes: notebook.pages[pageIndex].strokes,
          attachments: notebook.pages[pageIndex].attachments,
          updatedAt: notebook.updatedAt,
        });
      }
    }

    if (msg.type === 'page:add') {
      const { notebook } = ensureNotebook(sessionId);
      notebook.pages.push({ text: '', strokes: [], attachments: [] });
      notebook.updatedAt = new Date().toISOString();
      saveState();
      for (const memberId of session.members || []) {
        if (memberId === deviceId) continue;
        sendTo(memberId, { type: 'page:add', pages: notebook.pages.length, updatedAt: notebook.updatedAt });
      }
    }
  });

  ws.on('close', () => {
    if (socketsByDevice.get(deviceId) === ws) {
      socketsByDevice.delete(deviceId);
    }
    const sessionId = state.memberships[deviceId];
    if (sessionId) sendSessionPresence(sessionId);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Text.Me server running on http://0.0.0.0:${PORT}`);
});

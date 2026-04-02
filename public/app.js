(() => {
  const getId = () => {
    let id = localStorage.getItem('deviceId');
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
      localStorage.setItem('deviceId', id);
    }
    return id;
  };

  const deviceId = getId();
  const downloadedStoreKey = `downloadedAttachments:${deviceId}`;
  const statusEl = document.getElementById('status');
  const pairCodeEl = document.getElementById('pairCode');
  const createCodeBtn = document.getElementById('createCodeBtn');
  const joinCodeBtn = document.getElementById('joinCodeBtn');
  const joinCodeInput = document.getElementById('joinCodeInput');
  const textEl = document.getElementById('text');
  const fileInput = document.getElementById('fileInput');
  const downloadNextBtn = document.getElementById('downloadNextBtn');
  const uploadStatusEl = document.getElementById('uploadStatus');
  const incomingFilesEl = document.getElementById('incomingFiles');
  const attachmentsEl = document.getElementById('attachments');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');
  const newBtn = document.getElementById('newPageBtn');
  const clearBtn = document.getElementById('clearDrawBtn');
  const pageInfo = document.getElementById('pageInfo');
  const sticky = document.getElementById('stickyPopup');

  let ws;
  let partnerOnline = false;
  let notebook = { pages: [{ text: '', strokes: [], attachments: [] }] };
  let pageIndex = 0;
  let drawMode = false;
  let currentStroke = [];
  let downloadedAttachments = loadDownloadedAttachments();
  const origin = window.location.origin || `${window.location.protocol}//${window.location.host}`;

  function loadDownloadedAttachments() {
    try {
      const value = JSON.parse(localStorage.getItem(downloadedStoreKey) || '[]');
      return new Set(Array.isArray(value) ? value : []);
    } catch {
      return new Set();
    }
  }

  function persistDownloadedAttachments() {
    localStorage.setItem(downloadedStoreKey, JSON.stringify([...downloadedAttachments]));
  }

  function updateStatus(msg) {
    statusEl.textContent = msg;
  }

  function showSticky(msg = 'New live update from your partner.') {
    sticky.textContent = msg;
    sticky.classList.remove('hidden');
    setTimeout(() => sticky.classList.add('hidden'), 2500);
  }

  function getPage(page = notebook.pages[pageIndex]) {
    return {
      text: typeof page?.text === 'string' ? page.text : '',
      strokes: Array.isArray(page?.strokes) ? page.strokes : [],
      attachments: Array.isArray(page?.attachments) ? page.attachments : [],
    };
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 1024) return `${bytes || 0} B`;
    const units = ['KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = -1;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  function getPendingIncomingAttachments(page = getPage()) {
    return (page.attachments || []).filter((attachment) =>
      attachment.uploadedBy &&
      attachment.uploadedBy !== deviceId &&
      !downloadedAttachments.has(attachment.id),
    );
  }

  function renderIncomingFiles(page) {
    const pending = getPendingIncomingAttachments(page);
    downloadNextBtn.disabled = pending.length === 0;

    if (!pending.length) {
      incomingFilesEl.innerHTML = '';
      return;
    }

    incomingFilesEl.innerHTML = pending.map((attachment) => `
      <div class="incoming-item">
        <div class="incoming-copy">
          <strong>${escapeHtml(attachment.name)}</strong>
          <span>Partner uploaded a file for you. Click download to save it.</span>
        </div>
        <a
          class="incoming-download-btn"
          data-attachment-id="${escapeHtml(attachment.id)}"
          href="${escapeHtml(new URL(attachment.url, origin).toString())}"
          download="${escapeHtml(attachment.name)}"
        >Download</a>
      </div>
    `).join('');
  }

  function renderAttachments(page) {
    const attachments = page.attachments || [];
    if (!attachments.length) {
      attachmentsEl.innerHTML = '<p class="attachments-empty">No files on this page yet.</p>';
      return;
    }

    attachmentsEl.innerHTML = attachments.map((attachment) => `
      <div class="attachment-item">
        <span class="attachment-name">${escapeHtml(attachment.name)}</span>
        <span class="attachment-meta">${escapeHtml(formatBytes(attachment.size))}</span>
      </div>
    `).join('');
  }

  function strokeAt(x, y, start = false) {
    if (start) {
      currentStroke = [{ x, y }];
      return;
    }
    currentStroke.push({ x, y });
  }

  function drawStroke(stroke) {
    if (!stroke || stroke.length < 2) return;
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0a58ca';
    ctx.moveTo(stroke[0].x, stroke[0].y);
    for (let i = 1; i < stroke.length; i += 1) ctx.lineTo(stroke[i].x, stroke[i].y);
    ctx.stroke();
  }

  function renderPage() {
    const page = getPage(notebook.pages[pageIndex]);
    notebook.pages[pageIndex] = page;
    textEl.value = page.text || '';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    page.strokes.forEach(drawStroke);
    renderIncomingFiles(page);
    renderAttachments(page);
    pageInfo.textContent = `Page ${pageIndex + 1} / ${notebook.pages.length}`;
  }

  function resetNotebook() {
    notebook = { pages: [{ text: '', strokes: [], attachments: [] }] };
    pageIndex = 0;
    renderPage();
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  const sendUpdate = debounce(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!notebook.pages[pageIndex]) notebook.pages[pageIndex] = { text: '', strokes: [], attachments: [] };

    ws.send(JSON.stringify({
      type: 'update',
      pageIndex,
      text: notebook.pages[pageIndex].text,
      strokes: notebook.pages[pageIndex].strokes,
      attachments: notebook.pages[pageIndex].attachments,
    }));
  }, 100);

  function setPageText(value) {
    if (!notebook.pages[pageIndex]) notebook.pages[pageIndex] = { text: '', strokes: [], attachments: [] };
    notebook.pages[pageIndex].text = value;
    sendUpdate();
  }

  function markAttachmentDownloaded(attachmentId) {
    const page = getPage(notebook.pages[pageIndex]);
    const attachment = page.attachments.find((item) => item.id === attachmentId);
    if (!attachment) return;

    downloadedAttachments.add(attachment.id);
    persistDownloadedAttachments();
    renderIncomingFiles(page);
    uploadStatusEl.textContent = `${attachment.name} downloaded.`;
  }

  async function uploadFile(file) {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      uploadStatusEl.textContent = 'File too large. Max size is 15 MB.';
      fileInput.value = '';
      return;
    }

    uploadStatusEl.textContent = `Uploading ${file.name}...`;
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const commaIndex = result.indexOf(',');
        if (commaIndex === -1) {
          reject(new Error('Invalid file payload'));
          return;
        }
        resolve(result.slice(commaIndex + 1));
      };
      reader.onerror = () => reject(reader.error || new Error('Could not read file'));
      reader.readAsDataURL(file);
    });

    const uploadUrl = new URL('/api/upload', origin).toString();
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        pageIndex,
        fileName: file.name,
        mimeType: file.type,
        contentBase64: base64,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'Upload failed');
    }

    const page = getPage(notebook.pages[pageIndex]);
    page.attachments = [...page.attachments, json.attachment];
    notebook.pages[pageIndex] = page;
    renderPage();
    uploadStatusEl.textContent = `${file.name} uploaded.`;
    fileInput.value = '';
  }

  function connectSocket() {
    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${wsProtocol}//${location.host}/?deviceId=${encodeURIComponent(deviceId)}`);

    ws.onopen = () => updateStatus('Connected. Loading pair info...');

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'presence') {
        partnerOnline = msg.online;
        updateStatus(partnerOnline ? 'Auto-connected. Live sync active.' : 'Paired before. Auto-connect ready; waiting for partner...');
      }
      if (msg.type === 'paired') {
        updateStatus('Pair success. Next time it will auto-connect on same LAN.');
      }
      if (msg.type === 'unpaired') {
        partnerOnline = false;
        resetNotebook();
        pairCodeEl.textContent = 'This device was disconnected from its old partner.';
        updateStatus('Not paired yet on this LAN. Create or join a PIN one time.');
      }
      if (msg.type === 'update') {
        while (notebook.pages.length <= msg.pageIndex) notebook.pages.push({ text: '', strokes: [], attachments: [] });
        notebook.pages[msg.pageIndex] = {
          text: msg.text || '',
          strokes: msg.strokes || [],
          attachments: msg.attachments || [],
        };
        if (document.hidden) showSticky('Partner sent an update.');
        if ((msg.attachments || []).some((attachment) => attachment.uploadedBy && attachment.uploadedBy !== deviceId && !downloadedAttachments.has(attachment.id))) {
          uploadStatusEl.textContent = 'Partner uploaded a file.';
        }
        if (msg.pageIndex === pageIndex) renderPage();
      }
      if (msg.type === 'page:add') {
        while (notebook.pages.length < msg.pages) notebook.pages.push({ text: '', strokes: [], attachments: [] });
        renderPage();
        if (document.hidden) showSticky('Partner added a new page.');
      }
    };

    ws.onclose = () => {
      updateStatus('Disconnected. Retrying...');
      setTimeout(connectSocket, 1000);
    };
  }

  async function loadStatus() {
    const statusUrl = new URL(`/api/status/${encodeURIComponent(deviceId)}`, origin).toString();
    const res = await fetch(statusUrl);
    const json = await res.json();
    if (!json.paired) {
      updateStatus('Not paired yet on this LAN. Create or join a PIN one time.');
      return;
    }

    notebook = json.notebook || notebook;
    notebook.pages = (notebook.pages || []).map((page) => getPage(page));
    partnerOnline = json.partnerOnline;
    renderPage();
    updateStatus(partnerOnline ? 'Auto-connected. Live sync active.' : 'Paired before. Auto-connect ready; waiting for partner...');
  }

  createCodeBtn.onclick = async () => {
    const pairCreateUrl = new URL('/api/pair/create', origin).toString();
    const res = await fetch(pairCreateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    const json = await res.json();
    pairCodeEl.textContent = json.code ? `PIN: ${json.code}` : (json.error || 'Could not create PIN');
  };

  joinCodeBtn.onclick = async () => {
    const code = joinCodeInput.value.trim();
    if (code.length < 6) return;
    const pairJoinUrl = new URL('/api/pair/join', origin).toString();
    const res = await fetch(pairJoinUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, code }),
    });
    const json = await res.json();
    if (!res.ok) {
      pairCodeEl.textContent = json.error || 'Join failed';
      return;
    }
    pairCodeEl.textContent = `Connected with ${json.pairedWith.slice(0, 8)}...`;
    await loadStatus();
  };

  textEl.oninput = () => setPageText(textEl.value);
  fileInput.onchange = async () => {
    try {
      await uploadFile(fileInput.files?.[0]);
    } catch (error) {
      uploadStatusEl.textContent = error.message || 'Upload failed';
      fileInput.value = '';
    }
  };
  downloadNextBtn.onclick = async () => {
    const firstPending = getPendingIncomingAttachments()[0];
    if (!firstPending) return;
    window.location.href = new URL(firstPending.url, origin).toString();
    setTimeout(() => markAttachmentDownloaded(firstPending.id), 300);
  };
  incomingFilesEl.onclick = (event) => {
    const button = event.target.closest('.incoming-download-btn');
    if (!button) return;
    setTimeout(() => markAttachmentDownloaded(button.dataset.attachmentId), 300);
  };

  function posFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : null;
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    return {
      x: ((clientX - rect.left) * canvas.width) / rect.width,
      y: ((clientY - rect.top) * canvas.height) / rect.height,
    };
  }

  function pointerDown(e) {
    drawMode = true;
    const { x, y } = posFromEvent(e);
    strokeAt(x, y, true);
  }

  function pointerMove(e) {
    if (!drawMode) return;
    const { x, y } = posFromEvent(e);
    strokeAt(x, y);
    renderPage();
    drawStroke(currentStroke);
  }

  function pointerUp() {
    if (!drawMode || currentStroke.length < 2) {
      drawMode = false;
      return;
    }
    drawMode = false;
    if (!notebook.pages[pageIndex]) notebook.pages[pageIndex] = { text: '', strokes: [], attachments: [] };
    notebook.pages[pageIndex].strokes.push(currentStroke);
    sendUpdate();
  }

  canvas.addEventListener('mousedown', pointerDown);
  canvas.addEventListener('mousemove', pointerMove);
  window.addEventListener('mouseup', pointerUp);
  canvas.addEventListener('touchstart', pointerDown, { passive: true });
  canvas.addEventListener('touchmove', pointerMove, { passive: true });
  canvas.addEventListener('touchend', pointerUp, { passive: true });

  prevBtn.onclick = () => {
    pageIndex = Math.max(0, pageIndex - 1);
    renderPage();
  };
  nextBtn.onclick = () => {
    pageIndex = Math.min(notebook.pages.length - 1, pageIndex + 1);
    renderPage();
  };
  newBtn.onclick = () => {
    notebook.pages.push({ text: '', strokes: [], attachments: [] });
    pageIndex = notebook.pages.length - 1;
    renderPage();
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'page:add' }));
  };
  clearBtn.onclick = () => {
    if (!notebook.pages[pageIndex]) notebook.pages[pageIndex] = { text: '', strokes: [], attachments: [] };
    notebook.pages[pageIndex].strokes = [];
    renderPage();
    sendUpdate();
  };

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) sticky.classList.add('hidden');
  });

  connectSocket();
  loadStatus();
})();

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
  const statusEl = document.getElementById('status');
  const pairCodeEl = document.getElementById('pairCode');
  const createCodeBtn = document.getElementById('createCodeBtn');
  const joinCodeBtn = document.getElementById('joinCodeBtn');
  const joinCodeInput = document.getElementById('joinCodeInput');
  const textEl = document.getElementById('text');
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
  let notebook = { pages: [{ text: '', strokes: [] }] };
  let pageIndex = 0;
  let drawMode = false;
  let currentStroke = [];

  function updateStatus(msg) {
    statusEl.textContent = msg;
  }

  function showSticky(msg = 'New live update from your partner.') {
    sticky.textContent = msg;
    sticky.classList.remove('hidden');
    setTimeout(() => sticky.classList.add('hidden'), 2500);
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
    const page = notebook.pages[pageIndex] || { text: '', strokes: [] };
    textEl.value = page.text || '';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    (page.strokes || []).forEach(drawStroke);
    pageInfo.textContent = `Page ${pageIndex + 1} / ${notebook.pages.length}`;
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
    if (!notebook.pages[pageIndex]) notebook.pages[pageIndex] = { text: '', strokes: [] };

    ws.send(JSON.stringify({
      type: 'update',
      pageIndex,
      text: notebook.pages[pageIndex].text,
      strokes: notebook.pages[pageIndex].strokes,
    }));
  }, 100);

  function setPageText(value) {
    if (!notebook.pages[pageIndex]) notebook.pages[pageIndex] = { text: '', strokes: [] };
    notebook.pages[pageIndex].text = value;
    sendUpdate();
  }

  function connectSocket() {
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}?deviceId=${encodeURIComponent(deviceId)}`);

    ws.onopen = () => updateStatus('Connected. Loading pair info...');

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'presence') {
        partnerOnline = msg.online;
        updateStatus(partnerOnline ? 'Auto-connected ✅ Live sync active.' : 'Paired before. Auto-connect ready; waiting for partner...');
      }
      if (msg.type === 'paired') {
        updateStatus('Pair success ✅ Next time it will auto-connect on same LAN.');
      }
      if (msg.type === 'update') {
        while (notebook.pages.length <= msg.pageIndex) notebook.pages.push({ text: '', strokes: [] });
        notebook.pages[msg.pageIndex] = { text: msg.text || '', strokes: msg.strokes || [] };
        if (document.hidden) showSticky('Partner sent an update.');
        if (msg.pageIndex === pageIndex) renderPage();
      }
      if (msg.type === 'page:add') {
        while (notebook.pages.length < msg.pages) notebook.pages.push({ text: '', strokes: [] });
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
    const res = await fetch(`/api/status/${deviceId}`);
    const json = await res.json();
    if (!json.paired) {
      updateStatus('Not paired yet on this LAN. Create or join a PIN one time.');
      return;
    }

    notebook = json.notebook || notebook;
    partnerOnline = json.partnerOnline;
    renderPage();
    updateStatus(partnerOnline ? 'Auto-connected ✅ Live sync active.' : 'Paired before. Auto-connect ready; waiting for partner...');
  }

  createCodeBtn.onclick = async () => {
    const res = await fetch('/api/pair/create', {
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
    const res = await fetch('/api/pair/join', {
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
    if (!notebook.pages[pageIndex]) notebook.pages[pageIndex] = { text: '', strokes: [] };
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
    notebook.pages.push({ text: '', strokes: [] });
    pageIndex = notebook.pages.length - 1;
    renderPage();
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'page:add' }));
  };
  clearBtn.onclick = () => {
    if (!notebook.pages[pageIndex]) notebook.pages[pageIndex] = { text: '', strokes: [] };
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

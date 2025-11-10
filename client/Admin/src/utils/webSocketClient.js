import { ensureFreshAccess } from '../apis/api';

let socket = null;
let lastToken = null;
let timerId = null; 
const listeners = new Set();

function buildWsUrl(apiOrigin) {
  const u = new URL('/socket', apiOrigin);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u;
}

export function subscribe(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export function getSocket() {
  return socket;
}

export function closeSocket() {
  try { socket?.close(); } catch {}
  socket = null;
  lastToken = null;
}

function wireSocket(ws) {
  ws.onmessage = evt => { for (const fn of listeners) fn(evt); };
  ws.onclose = () => { socket = null; };
  ws.onerror = () => {};
}

export function initSocket(token, apiOrigin = 'https://taracamp-api.onrender.com') {
  if (socket && socket.readyState <= 1 && token === lastToken) return socket;

  try { socket?.close(); } catch {}
  socket = null;
  lastToken = token || null;

  if (!token) return null;

  const u = buildWsUrl(apiOrigin);
  u.searchParams.set('token', token);

  socket = new WebSocket(u.toString());
  wireSocket(socket);
  return socket;
}

export async function initSocketFresh(apiOrigin = 'https://taracamp-api.onrender.com') {
  const token = await ensureFreshAccess();
  if (!token) {
    closeSocket();
    return null;
  }
  return initSocket(token, apiOrigin);
}

export function startAutoReconnect(getToken = ensureFreshAccess, apiOrigin = 'https://taracamp-api.onrender.com', intervalMs = 30000) {
  stopAutoReconnect();

  async function tick() {
    try {
      const t = await Promise.resolve(getToken());
      if (!t) {
        if (socket) { try { socket.close(); } catch {} }
        socket = null;
        lastToken = null;
      } else if (!socket || socket.readyState === 3 || t !== lastToken) {
        initSocket(t, apiOrigin);
      }
    } catch {
    } finally {
      timerId = setTimeout(tick, intervalMs);
    }
  }

  tick();

  try {
    window.addEventListener('storage', async (e) => {
      if (e.key === 'accessToken') {
        const fresh = await ensureFreshAccess();
        if (fresh && fresh !== lastToken) initSocket(fresh, apiOrigin);
      }
    });
  } catch {}
}

export function stopAutoReconnect() {
  if (timerId) { clearTimeout(timerId); timerId = null; }
}


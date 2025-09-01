let socket = null;
let lastToken = null;
let intervalId = null;
const listeners = new Set();
const WS = import.meta.env.VITE_WS_URL;

export function initSocket(token, apiOrigin = 'http://localhost:3000') {
  if (socket && socket.readyState <= 1 && token === lastToken) return socket;

  try { 
      socket?.close(); 
  } catch {
    // ignorec
  }
  socket = null;
  lastToken = token || null;

  if (!token) return null;

  const u = new URL('/socket', apiOrigin);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.searchParams.set('token', token);

  socket = new WebSocket(u.toString());
  socket.onmessage = (evt) => { for (const fn of listeners) fn(evt); };
  socket.onclose = () => { socket = null; };
  socket.onerror = () => {};

  return socket;
}

export function startAutoReconnect(getToken, apiOrigin = 'http://localhost:3000', intervalMs = 5000) {
  if (typeof getToken !== 'function') return;

  stopAutoReconnect();

  const tick = () => {
    const t = getToken();
    if (!t) {
      if (socket) { try { socket.close(); 

      } catch {
        // ignore
      } 
    }
      socket = null; lastToken = null; return;
    }
    if (!socket || socket.readyState === 3 || t !== lastToken) {
      initSocket(t, apiOrigin);
    }
  };
  tick();
  intervalId = setInterval(tick, intervalMs);

  try {
    window.addEventListener('storage', (e) => {
      if (e.key === 'accessToken') {
        const current = typeof getToken === 'function' ? getToken() : null;
        if (current !== lastToken) initSocket(current, apiOrigin);
      }
    });
  } catch {
    // ignore
  }
}

export function stopAutoReconnect() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

export function subscribe(handler) { listeners.add(handler); return () => listeners.delete(handler); }
export function getSocket() { return socket; }
export function closeSocket() { 
  try { 
    socket?.close(); 
  } catch {
    // ignore
  }; 
  
  socket = null; lastToken = null; 
}

let socket = null;
const listeners = new Set();
const WS = import.meta.env.VITE_WS_URL;

export function initSocket(token, apiOrigin = WS) {
  if (socket && socket.readyState <= 1) return socket; 

  const u = new URL('/socket', apiOrigin);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.searchParams.set('token', token);

  socket = new WebSocket(u.toString());
  socket.onmessage = (evt) => {
    for (const fn of listeners) fn(evt);
  };
  socket.onclose = () => { socket = null; };
  socket.onerror = () => {}; 

  return socket;
}

export function subscribe(handler) {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

export function getSocket() { return socket; }
export function closeSocket() { try { socket?.close(); 
} catch {
    // Ignore Eslint
} 
socket = null; 
}

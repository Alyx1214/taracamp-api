import { ensureFreshAccess } from '../apis/api';

let socket = null;
let lastToken = null;
let timerId = null;
let reconnectTimerId = null;
let reconnectAttempts = 0;
const listeners = new Set();
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second

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
  reconnectAttempts = 0;
  if (reconnectTimerId) {
    clearTimeout(reconnectTimerId);
    reconnectTimerId = null;
  }
}

function wireSocket(ws, apiOrigin, token) {
  ws.onmessage = evt => { 
    // Reset reconnect attempts on successful message
    reconnectAttempts = 0;
    for (const fn of listeners) fn(evt); 
  };
  
  ws.onclose = (event) => {
    socket = null;
    // Only attempt reconnect if it wasn't a normal closure (code 1000)
    // and we haven't exceeded max attempts
    if (event.code !== 1000 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS && token) {
      const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts); // Exponential backoff
      reconnectAttempts++;
      
      reconnectTimerId = setTimeout(async () => {
        try {
          const freshToken = await ensureFreshAccess();
          if (freshToken) {
            initSocket(freshToken, apiOrigin);
          }
        } catch (err) {
          console.warn('WebSocket reconnection attempt failed:', err);
        }
      }, delay);
    } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('WebSocket: Max reconnection attempts reached. Will retry on next auto-reconnect cycle.');
      reconnectAttempts = 0; // Reset for next cycle
    }
  };
  
  ws.onerror = (error) => {
    // Errors are already handled in onclose, so we don't need to log here
    // This prevents duplicate error messages in the console
    // The browser will still log its own connection error, which we can't prevent
  };
  
  ws.onopen = () => {
    // Reset reconnect attempts on successful connection
    reconnectAttempts = 0;
    if (reconnectTimerId) {
      clearTimeout(reconnectTimerId);
      reconnectTimerId = null;
    }
  };
}

export function initSocket(token, apiOrigin = 'http://localhost:3000') {
  if (socket && socket.readyState <= 1 && token === lastToken) return socket;

  try { socket?.close(); } catch {}
  socket = null;
  lastToken = token || null;

  if (!token) return null;

  // Clear any pending reconnect attempts
  if (reconnectTimerId) {
    clearTimeout(reconnectTimerId);
    reconnectTimerId = null;
  }

  const u = buildWsUrl(apiOrigin);
  u.searchParams.set('token', token);

  // Store original console.error to restore later
  const originalError = console.error;

  try {
    const wsUrl = u.toString();
    
    // Override console.error to filter out WebSocket connection errors
    console.error = (...args) => {
      const errorMsg = args.join(' ');
      // Suppress WebSocket connection errors
      if (errorMsg.includes('WebSocket') && 
          (errorMsg.includes('failed') || 
           errorMsg.includes('connection') || 
           errorMsg.includes('network connection was lost') ||
           errorMsg.includes('ws://') || 
           errorMsg.includes('wss://'))) {
        // Silently ignore - we handle reconnection automatically
        return;
      }
      // Allow other errors through
      originalError.apply(console, args);
    };
    
    socket = new WebSocket(wsUrl);
    
    // Restore console.error after a short delay to allow WebSocket to initialize
    setTimeout(() => {
      console.error = originalError;
    }, 200);
    
    // Add error handler before wiring to catch initial connection errors
    socket.addEventListener('error', (error) => {
      // Silently handle - reconnection logic will handle retries
    });
    
    wireSocket(socket, apiOrigin, token);
  } catch (error) {
    // Restore console.error in case of exception
    console.error = originalError;
    socket = null;
  }
  
  return socket;
}

export async function initSocketFresh(apiOrigin = 'http://localhost:3000') {
  const token = await ensureFreshAccess();
  if (!token) {
    closeSocket();
    return null;
  }
  return initSocket(token, apiOrigin);
}

export function startAutoReconnect(getToken = ensureFreshAccess, apiOrigin = 'http://localhost:3000', intervalMs = 30000) {
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
  if (reconnectTimerId) { clearTimeout(reconnectTimerId); reconnectTimerId = null; }
  reconnectAttempts = 0;
}

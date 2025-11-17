const API_BASE = 'http://localhost:3000'; 
const API_V1_PREFIX = '/api/v1';
const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

const isFormData = v => typeof FormData !== 'undefined' && v instanceof FormData;

function getAccessToken() { return localStorage.getItem(ACCESS_KEY); }
function setAccessToken(token) { if (token) localStorage.setItem(ACCESS_KEY, token); }
function getRefreshToken() { return localStorage.getItem(REFRESH_KEY); }
function setRefreshToken(token) { if (token) localStorage.setItem(REFRESH_KEY, token); }
export function clearTokens() { localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(REFRESH_KEY); }

function buildUrl(path) {
  if (!path.startsWith('/')) path = '/' + path;
  if (path.startsWith('/api/')) return `${API_BASE}${path}`;         
  return `${API_BASE}${API_V1_PREFIX}${path}`;                      
}

export async function rawFetch(path, options = {}) {
  const url = buildUrl(path);
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && !isFormData(options.body)) {
    headers.set('Content-Type', 'application/json');
  }

  let access = getAccessToken();
  if (access && !headers.has('Authorization')) {
    try {
      const maybeFresh = await ensureFreshAccess();
      if (maybeFresh) {
        access = maybeFresh;
      } else {
        const payload = decodeJwt(access);
        const exp = payload?.exp;
        const now = Math.floor(Date.now() / 1000);
        if (!exp || exp <= now) {
          try { clearTokens(); } catch {}
          access = null;
        }
      }
    } catch (error) {
      console.warn('Token refresh failed:', error);
      // Don't clear tokens immediately on refresh failure
      // Let the 401 response handle it instead
    }
  }

  if (access && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${access}`);
  }

  const res = await fetch(url, { ...options, headers, credentials: 'include' });
  if (res.status !== 401) return res;

  const newAccess = await tryRefresh();
  if (!newAccess) {
    try { clearTokens(); } catch {}
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
      window.location.href = '/auth/login';
    }
    return res;
  }
  const retryHeaders = new Headers(options.headers || {});
  if (!retryHeaders.has('Content-Type') && options.body && !isFormData(options.body)) {
    retryHeaders.set('Content-Type', 'application/json');
  }
  retryHeaders.set('Authorization', `Bearer ${newAccess}`);
  return fetch(url, { ...options, headers: retryHeaders, credentials: 'include' });
}


function withQuery(path, query) {
  if (!query || typeof query !== 'object') return path;
  const qs = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    qs.append(k, String(v));
  });
  const s = qs.toString();
  return s ? `${path}${path.includes('?') ? '&' : '?'}${s}` : path;
}

async function safeJson(res) { try { return await res.json(); } catch { return null; } }
function handle(res, data) {
  if (res.ok) return data;
  const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
  err.status = res.status; err.data = data; throw err;
}

function decodeJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1])); } catch { return {}; }
}

// Global lock to prevent concurrent token refresh requests
let refreshPromise = null;
let refreshLockTime = 0;
const REFRESH_LOCK_DURATION = 5000; // 5 seconds lock after a refresh

export async function tryRefresh() {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  
  // Check if a refresh is already in progress
  const now = Date.now();
  if (refreshPromise && (now - refreshLockTime) < REFRESH_LOCK_DURATION) {
    // Wait for the existing refresh to complete
    try {
      return await refreshPromise;
    } catch {
      // If the existing refresh failed, continue with a new one
    }
  }
  
  // Start a new refresh
  refreshLockTime = now;
  refreshPromise = (async () => {
    try {
      // refresh endpoint lives under /api/v1/user/refresh-token per main.js
      const res = await fetch(`${API_BASE}${API_V1_PREFIX}/user/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
        credentials: 'include',
      });
      
      if (!res.ok) {
        // Handle 429 specifically
        if (res.status === 429) {
          // Wait a bit and return the current token (don't clear tokens)
          await new Promise(resolve => setTimeout(resolve, 1000));
          return getAccessToken(); // Return current token instead of null
        }
        clearTokens();
        return null;
      }
      
      const data = await res.json().catch(() => ({}));
      if (data?.accessToken) setAccessToken(data.accessToken);
      if (data?.refreshToken) setRefreshToken(data.refreshToken);
      return data?.accessToken || null;
    } catch {
      return null;
    } finally {
      // Clear the promise after a delay to allow other requests to use the new token
      setTimeout(() => {
        refreshPromise = null;
      }, REFRESH_LOCK_DURATION);
    }
  })();
  
  return refreshPromise;
}

export async function ensureFreshAccess(skewSec = 30) {
  const token = getAccessToken();
  if (!token) return null;

  const exp = decodeJwt(token)?.exp || 0;  
  const now = Math.floor(Date.now() / 1000);
  if (exp > now + skewSec) return token;   
  const newAccess = await tryRefresh();
  return newAccess;
}

export async function apiGet(path, query) {
  const res = await rawFetch(withQuery(path, query), { method: 'GET' });
  const data = await safeJson(res);
  return handle(res, data);
}

export async function apiPost(path, body, extraOptions = {}) {
  const opts = isFormData(body)
    ? { method: 'POST', body, ...extraOptions }
    : { method: 'POST', body: body ? JSON.stringify(body) : undefined, ...extraOptions };
  const res = await rawFetch(path, opts);
  const data = await safeJson(res);
  return handle(res, data);
}

export async function postPaymentWebhook(payload) {
  const res = await rawFetch('/api/payment/webhook', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const data = await safeJson(res);
  return handle(res, data);
}

const API_BASE = process.env.VITE_API_BASE_URL || 'https://taracamp-api.onrender.com';
const API_V1_PREFIX = '/api/v1';
const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';
const isFormData = v => typeof FormData !== 'undefined' && v instanceof FormData;

async function rawFetch(path, options = {}) {
  const url = buildUrl(path);
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && !isFormData(options.body)) {
    headers.set('Content-Type', 'application/json');
  }
  
  // Ensure we have a fresh token before making the request
  const access = await ensureFreshAccess();
  if (access) headers.set('Authorization', `Bearer ${access}`);

  const res = await fetch(url, { ...options, headers, credentials: 'include' });
  if (res.status !== 401) return res;

  // If we get 401, try one more refresh attempt
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

export async function tryRefresh() {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const res = await fetch(`${API_BASE}${API_V1_PREFIX}/user/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
      credentials: 'include',
    });
    if (!res.ok) { clearTokens(); return null; }
    const data = await res.json().catch(() => ({}));
    if (data?.accessToken) setAccessToken(data.accessToken);
    if (data?.refreshToken) setRefreshToken(data.refreshToken);
    return data?.accessToken || null;
  } catch {
    return null;
  }
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

export async function ensureFreshAccess(skewSec = 60) {
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

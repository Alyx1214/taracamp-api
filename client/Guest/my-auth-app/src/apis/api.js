const API_BASE = import.meta.env.VITE_API_BASE_URL || 'taracamp-api.onrender.com';
const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

const isFormData = v =>
  typeof FormData !== 'undefined' && v instanceof FormData;

function getAccessToken() { return localStorage.getItem(ACCESS_KEY); }
function setAccessToken(token) { if (token) localStorage.setItem(ACCESS_KEY, token); }
function getRefreshToken() { return localStorage.getItem(REFRESH_KEY); }
function setRefreshToken(token) { if (token) localStorage.setItem(REFRESH_KEY, token); }
export function clearTokens() { localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(REFRESH_KEY); }

async function rawFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.body && !isFormData(options.body)) {
    headers.set('Content-Type', 'application/json');
  }

  const access = getAccessToken();
  if (access) headers.set('Authorization', `Bearer ${access}`);

  const res = await fetch(url, { ...options, headers });
  if (res.status !== 401) return res;

  const newAccess = await tryRefresh();
  if (!newAccess) return res;

  const retryHeaders = new Headers(options.headers || {});
  if (!retryHeaders.has('Content-Type') && options.body && !isFormData(options.body)) {
    retryHeaders.set('Content-Type', 'application/json');
  }
  retryHeaders.set('Authorization', `Bearer ${newAccess}`);
  return fetch(url, { ...options, headers: retryHeaders });
}

async function tryRefresh() {
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const res = await fetch(`${API_BASE}/api/user/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) {
      clearTokens();
      return null;
    }
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

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}
function handle(res, data) {
  if (res.ok) return data;
  const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
  err.status = res.status; err.data = data; throw err;
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

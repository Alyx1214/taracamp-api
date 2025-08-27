import React, { useEffect, useState } from 'react';
import styles from './Notif.module.css';
import NotifPreview from './NotifPreview';

let refreshingPromise = null;
const API = import.meta.env.VITE_API_URL;


function getAccessToken() {
  return localStorage.getItem('accessToken');
}
function getRefreshToken() {
  return localStorage.getItem('refreshToken');
}
function setTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem('accessToken', accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
}

async function callRefresh() {
  if (refreshingPromise) return refreshingPromise;
  const rt = getRefreshToken();
  if (!rt) throw new Error('No refresh token');

  refreshingPromise = fetch(`${API}/user/refresh-token`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  })
    .then(async (res) => {
      const json = await res.json().catch(() => ({}));
      const ok = res.ok && (json?.accessToken || json?.status === 200);
      if (!ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setTokens({ accessToken: json.accessToken, refreshToken: json.refreshToken });
      return json.accessToken;
    })
    .finally(() => { refreshingPromise = null; });

  return refreshingPromise;
}

async function authFetch(url, opts = {}, didRetry = false) {
  const token = getAccessToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, { credentials: 'include', ...opts, headers });
  if (res.status !== 401 || didRetry) return res;

  // first 401: refresh and retry once
  try {
    await callRefresh();
  } catch {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.assign('/auth/login');
    throw new Error('Unauthorized');
  }

  const newToken = getAccessToken();
  const retryHeaders = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
  };
  return fetch(url, { credentials: 'include', ...opts, headers: retryHeaders });
}

async function api(path, opts = {}) {
  const res = await authFetch(path, opts);
  const text = await res.text().catch(() => '');
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return text ? JSON.parse(text) : null;
}

export default function Notif({ onMarkAllAsRead }) {
  const [mode, setMode] = useState('list');                 
  const [selected, setSelected] = useState(null);
  const [notifications, setNotifications] = useState([]);   
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function fetchList() {
    setErr('');
    setLoading(true);
    try {
      const json = await api('/api/notification/list');
      const raw =
        Array.isArray(json?.data?.items) ? json.data.items :
        Array.isArray(json?.data)        ? json.data :
        Array.isArray(json)              ? json :
        [];

      const list = raw.map(n => ({
        _id: n._id || n.id,
        title: n.title,
        message: n.message || n.body,
        isRead: !!n.isRead,
        createdAt: n.createdAt,
        reservationId: n.reservationId,
        source: n.source || "Teachers' Camp",
        time: n.createdAt
          ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : n.time || 'now',
        clientType: n.clientType || 'individual',
        checkInDate: n.checkInDate,
        checkOutDate: n.checkOutDate,
        accommodationType: n.accommodationType,
        numGuests: n.numGuests,
      }));

      setNotifications(list);
    } catch (e) {
      console.error('notif list failed', e);
      setErr('Failed to load notifications.');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchList(); }, []);

  async function markAll() {
    try {
      await api(`${API}/notification/mark-all`, { method: 'POST' });
      setNotifications(n => n.map(x => ({ ...x, isRead: true })));
      onMarkAllAsRead?.();
    } catch (e) {
      console.error('mark-all failed', e);
    }
  }

  const handleOpenDetail = async (notif) => {
    try {
      await api(`${API}/notification/mark-read/${notif._id}`, { method: 'POST' });
      setNotifications(n => n.map(x => x._id === notif._id ? { ...x, isRead: true } : x));
    } catch (e) {
      console.error('mark-read failed', e);
    }
    setSelected(notif);
    setMode('detail');
  };

  const handleBack = () => {
    setSelected(null);
    setMode('list');
  };

  return (
    <div className={styles.notifContainer}>
      {mode === 'list' && (
        <div className={styles.headerRow}>
          <span className={styles.headerTitle}>Notifications</span>
          <button className={styles.markAllBtn} onClick={markAll}>
            Mark all as Read
          </button>
        </div>
      )}

      {mode === 'list' && (
        <div className={styles.notifList}>
          {loading && <div className={styles.emptyMsg}>Loading…</div>}
          {!loading && err && <div className={styles.emptyMsg} style={{ color: '#b91c1c' }}>{err}</div>}
          {!loading && !err && notifications.length === 0 && (
            <div className={styles.emptyMsg}>No notifications</div>
          )}
          {!loading && !err && notifications.map((notif) => (
            <div
              key={notif._id}
              className={notif.isRead ? styles.notifItemRead : styles.notifItem}
              onClick={() => handleOpenDetail(notif)}
            >
              <div className={styles.notifTitleRow}>
                <span className={styles.notifTitle}>{notif.title}</span>
              </div>
              {notif.message && <div className={styles.notifBody}>{notif.message}</div>}
              <div className={styles.notifMeta}>
                <span className={styles.notifSource}>{notif.source}</span>
                <span className={styles.notifTime}>
                  {notif.createdAt
                    ? new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'now'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === 'detail' && selected && (
        <div className={styles.notifDetail}>
          <NotifPreview
            notif={selected}
            clientType={selected.clientType || 'individual'}
            loadReservation={async () => {
              if (!selected.reservationId) return selected;
              const json = await api(`${API}/reservation/get-reservation-by-id/${selected.reservationId}`);
              const r = json?.data || json?.reservation || json;
              return {
                title: r.title,
                body: r.body,
                checkInDate:  r.checkInDate  || r.dateOfArrival,
                checkOutDate: r.checkOutDate || r.dateOfDeparture,
                accommodationType: r.accommodationType || r.facilityType || r.serviceType || r.facility,
                numGuests: r.numGuests ?? r.numberOfGuests?.total ?? r.numberOfGuests,
                source: r.source || "Teachers' Camp",
                time: r.time,
              };
            }}
            onBack={handleBack}
            onConfirm={() => { console.log('Pay now / confirm'); handleBack(); }}
            onCancel={() => { console.log('Cancel booking'); handleBack(); }}
          />
        </div>
      )}
    </div>
  );
}

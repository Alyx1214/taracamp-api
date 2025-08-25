import { useEffect, useMemo, useState } from 'react';
import { initSocket, subscribe, closeSocket } from './webSocketClient';

function getToken() {
  return localStorage.getItem('accessToken');
}

function isJwtExpired(t) {
  try {
    const [, p] = t.split('.');
    const { exp } = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof exp === 'number' && Date.now() / 1000 >= exp;
  } catch {
    return true;
  }
}

async function getJSON(path) {
  const token = getToken();
  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

async function postJSON(path, body) {
  const token = getToken();
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

function toClientShape(n) {
  return {
    id: n._id ?? n.id,  
    title: n.title,
    body: n.message || n.body,
    source: n.source || "Teachers' Camp",
    time: n.time || (n.createdAt ? new Date(n.createdAt).toLocaleString() : ''),
    read: n.isRead ?? n.read ?? false,
    reservationId: n.reservationId,
  };
}

export function useNotifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const token = getToken();
        if (!token || isJwtExpired(token)) {
          throw new Error('Not authenticated');
        }

        const { data } = await getJSON('/api/notification/list?limit=50');
        if (!cancelled) {
          const list = Array.isArray(data) ? data.map(toClientShape) : [];
          setItems(list);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
        }
         
        console.error('Failed to load notifications:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token || isJwtExpired(token)) return;

    const apiOrigin = import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:3000';
    initSocket(token, apiOrigin);

    const unsub = subscribe((evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg?.type === 'notification' && msg.notification) {
          setItems((prev) => [toClientShape(msg.notification), ...prev]);
        }
      } catch {
        // ignore bad payloads
      }
    });

    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    function onStorage(e) {
      if (e.key === 'accessToken') {
        const t = e.newValue;
        const apiOrigin = import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:3000';
        closeSocket();
        if (t && !isJwtExpired(t)) {
          initSocket(t, apiOrigin);
        }
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const unreadCount = useMemo(() => items.filter((i) => !i.read).length, [items]);

  async function markAllAsRead() {
    try {
      await postJSON('/api/notification/mark-all-read');
      setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    } catch (e) {
       
      console.error('markAllAsRead failed:', e);
    }
  }

  async function markRead(id) {
    if (!id) return;
    try {
      await postJSON(`/api/notification/mark-read/${id}`);
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
    } catch (e) {
       
      console.error('markRead failed:', e);
    }
  }

  return { items, unreadCount, loading, loadError, markAllAsRead, markRead };
}

export default useNotifications;

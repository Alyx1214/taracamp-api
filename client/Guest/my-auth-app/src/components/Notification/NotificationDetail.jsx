import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import NotifIndiv from './NotifIndiv';

function getToken() { return localStorage.getItem('accessToken'); }

async function getJSON(path) {
  const res = await fetch(path, {
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    credentials: 'include',
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
  return text ? JSON.parse(text) : {};
}

function pickGuestType(notif) {
  return notif?.guestType ?? notif?.meta?.guestType ?? notif?.data?.guestType ?? null;
}
function pickKind(notif) {
  return notif?.kind ?? notif?.type ?? notif?.category ?? null;
}
function pickReservationId(notif) {
  return notif?.reservationId
      ?? notif?.meta?.reservationId
      ?? notif?.data?.reservationId
      ?? notif?.referenceId
      ?? null;
}

export default function NotificationDetail() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  const [notif, setNotif] = useState(() => state?.notif || null);
  const [loading, setLoading] = useState(!state?.notif);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (notif) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await getJSON(`${API}/notification/list?limit=100`);
        if (cancelled) return;
        const arr = Array.isArray(data) ? data : [];
        const found = arr.find(n => (n.id || n._id) === id);
        if (found) setNotif(found);
        else setError('Notification not found');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, notif]);

  const kind = useMemo(() => pickKind(notif), [notif]);
  const guestType = useMemo(() => pickGuestType(notif), [notif]);
  const reservationId = useMemo(() => pickReservationId(notif), [notif]);

  const onFoodPref = () => {
    // use whatever route you actually have; you showed /reservation-step4
    if (reservationId) navigate('/reservation-step4', { state: { reservationId } });
    else navigate('/reservation-step4');
  };

  const onCancel = () => {
    navigate('/reservations');
  };

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (error) return <div style={{ padding: 16, color: 'crimson' }}>{error}</div>;
  if (!notif) return <div style={{ padding: 16 }}>No notification.</div>;

  if (String(kind).toLowerCase() === 'reservation' && String(guestType).toLowerCase() === 'individual') {
    return <NotifIndiv notif={notif} onFoodPref={onFoodPref} onCancel={onCancel} />;
  }


  return (
    <div style={{ padding: 16 }}>
      <h2>{notif.title || 'Notification'}</h2>
      <p>{notif.message || notif.body || 'No details.'}</p>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#f6f6f6', padding: 12, borderRadius: 8 }}>
        {JSON.stringify(notif, null, 2)}
      </pre>
    </div>
  );
}

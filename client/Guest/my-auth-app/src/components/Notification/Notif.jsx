import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; 
import styles from './Notif.module.css';
import NotifPreview from './NotifPreview';
import NotifUpload from './NotifUpload';
import NotifIndiv from './NotifIndiv';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../../apis/notificationApi';

export default function Notif() {
  const navigate = useNavigate();
  const { search } = useLocation();                           
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [stage, setStage] = useState('list');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await listNotifications({ limit: 20 });
        const items = Array.isArray(res?.data) ? res.data : [];
        if (!cancelled) {
          const normalized = items
            .filter(Boolean)
            .map((n) => {
              const rawId = n?._id ?? n?.id ?? null;
              const resolvedId = typeof rawId === 'string'
                ? rawId
                : rawId && typeof rawId.toString === 'function'
                  ? rawId.toString()
                  : '';

              return {
                ...n,
                _id: resolvedId,
                source: n?.source || "Teachers' Camp",
                kind: n?.kind || null,
                createdAt: n?.createdAt || n?.created_at || null,
                timeLabel: n?.timeLabel ?? n?.time ?? null,
              };
            });

          setNotifications(prev => {
            const locals = prev.filter(x => typeof x?._id === 'string' && x._id.startsWith('local-'));
            const deduped = [...normalized];

            locals.forEach(local => {
              const alreadyExists = normalized.some(serverItem =>
                serverItem._id && serverItem._id === local._id
              ) || normalized.some(serverItem =>
                serverItem.kind === local.kind &&
                !!serverItem.reservationId &&
                !!local.reservationId &&
                String(serverItem.reservationId) === String(local.reservationId)
              );

              if (!alreadyExists) {
                deduped.unshift(local);
              }
            });

            deduped.sort((a, b) => {
              const aTime = new Date(a.createdAt || 0).getTime();
              const bTime = new Date(b.createdAt || 0).getTime();
              return bTime - aTime;
            });

            return deduped;
          });
        }
      } catch {
        if (!cancelled) setNotifications([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // 👇 Detect redirect from Transactions and inject a local payment_success notification
  useEffect(() => {
    const sp = new URLSearchParams(search);
    const isSuccess = sp.get('payment') === 'success' || sp.get('paid') === '1';
    if (!isSuccess) return;

    const reservationId = sp.get('reservationId') || null;
    const localNotif = {
      _id: `local-${Date.now()}`, // local unique id
      title:
        "Congratulations, Camper! Payment Successful — your reservation is now confirmed. We can't wait to welcome you!",
      message: null,
      kind: 'payment_success',
      isRead: false,
      source: "Teachers' Camp",
      timeLabel: 'Just now',
      reservationId,
      createdAt: new Date(),
    };

    // Prepend to list but avoid duplicates if the real notification already exists
    setNotifications(prev => {
      const exists = prev.some(entry => {
        if (entry.kind !== 'payment_success') return false;
        if (reservationId) {
          return String(entry.reservationId || '') === String(reservationId);
        }
        return !entry.reservationId;
      });

      if (exists) return prev;
      return [localNotif, ...prev];
    });

    // Optional: auto-open the success view
    setSelected(localNotif);
    setStage('indiv');

    // Clean the URL so it won't re-inject on refresh
    navigate('.', { replace: true });
  }, [search, navigate]);

  async function markAll() {
    setNotifications(n => n.map(x => ({ ...x, isRead: true })));
    try {
      await markAllNotificationsRead();
    } catch (e) {
      console.warn('Mark all failed:', e.message);
    }
  }

  async function handleClick(notif) {
    if (!notif.isRead) {
      setNotifications(n => n.map(x => x._id === notif._id ? { ...x, isRead: true } : x));
      try {
        await markNotificationRead({ id: notif._id });
      } catch (e) {
        console.warn('Mark read failed:', e.message);
      }
    }

    if (notif.kind === 'payment_success') {
      setSelected(notif);
      setStage('indiv');
      return;
    }
    if (notif.kind === 'booking_success') {
      setSelected(notif);
      setStage('preview');
      return;
    }
  }

  // Route based on what NotifPreview tells us, WITH reservation id.
  function handlePreviewConfirm(payload) {
    // payload: { action: 'transactions'|'upload', reservationId: string, clientType: string }
    if (!payload || !payload.reservationId) return;

    const { action, reservationId, clientType } = payload;

    if (action === 'transactions') {
      setSelected(null);
      setStage('list');
      navigate(`/transactions?reservationId=${encodeURIComponent(reservationId)}`);
      return;
    }

    // If you want to keep the in-component upload stage, comment out the navigate and use the stage switch below.
    // setStage('upload');

    navigate(
      `/notifications/upload?reservationId=${encodeURIComponent(reservationId)}&clientType=${encodeURIComponent(clientType || 'deped')}`
    );
  }

  if (selected && stage === 'preview') {
    return (
      <NotifPreview
        notif={selected}
        clientType="individual"
        onBack={() => { setSelected(null); setStage('list'); }}
        onConfirm={handlePreviewConfirm}
        onCancel={() => { setSelected(null); }}
      />
    );
  }

  if (selected && stage === 'indiv') {
    return (
      <NotifIndiv
        notif={selected}
        onBack={() => { setSelected(null); setStage('list'); }}
        onFoodPref={() => { alert('Open Food Preference form (placeholder)'); }}
        onCancel={() => { alert('Open Cancel Booking flow (placeholder)'); }}
      />
    );
  }

  // Only used if you keep internal stage-based upload instead of routing
  if (selected && stage === 'upload') {
    return (
      <NotifUpload
        clientType="deped"
        onBack={() => setStage('preview')}
        onSubmit={(files) => {
          console.log('Dummy submit files:', files);
          setNotifications(n => n.map(x => x._id === selected._id ? { ...x, isRead: true } : x));
          setSelected(null);
          setStage('list');
          alert('Documents submitted (dummy). Thank you!');
        }}
      />
    );
  }

  return (
    <div className={styles.notifContainer}>
      <div className={styles.headerRow}>
        <span className={styles.headerTitle}>Notifications</span>
        {notifications.some(n => !n.isRead) && (
          <button className={styles.markAllBtn} onClick={markAll}>
            Mark all as Read
          </button>
        )}
      </div>
      <div className={styles.notifList}>
        {loading && (
          <div className={styles.skeletonList} role="status" aria-live="polite" aria-busy="true">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={styles.skelItem}>
                <div className={styles.skelDot} />
                <div className={styles.skelContent}>
                  <div className={`${styles.skelBar} ${styles.skelTitle}`} />
                  <div className={`${styles.skelBar} ${styles.skelBody}`} />
                  <div className={styles.skelMetaRow}>
                    <div className={`${styles.skelBar} ${styles.skelMeta}`} />
                    <div className={`${styles.skelBar} ${styles.skelMetaShort}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No notifications</div>
            <div className={styles.emptySub}>You’re all caught up.</div>
          </div>
        )}

        {!loading && notifications.length > 0 && notifications.map((notif) => (
          <div
            key={notif._id}
            className={notif.isRead ? styles.notifItemRead : styles.notifItem}
            onClick={() => handleClick(notif)}
          >
            <div className={styles.notifTitleRow}>
              <span className={styles.notifTitle}>{notif.title}</span>
            </div>
            {notif.message && (
              <div className={styles.notifBody}>{notif.message}</div>
            )}
            <div className={styles.notifMeta}>
              <span className={styles.notifSource}>
                <span className={styles.notifSourceDot} /> {notif.source}
              </span>
              <span className={styles.notifTime}>
                {notif.timeLabel ?? new Date(notif.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

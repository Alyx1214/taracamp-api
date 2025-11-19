import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Notification.module.css';
import { listNotifications, markAllNotificationsRead, markNotificationRead, deleteAllNotifications } from '../../apis/notificationApi';
import { subscribe, initSocketFresh, startAutoReconnect } from '../../utils/webSocketClient';
import { confirmReservation, uploadConfirmationDocuments } from '../../apis/reservationApi';
import NotificationPreview from './NotificationPreview';
import NotificationCancel from './NotificationCancel';
import NotificationUpload from './NotificationUpload';

export default function Notification({ onMarkAllAsRead }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [stage, setStage] = useState('list');
  const [uploadClientType, setUploadClientType] = useState('deped');
  const [uploadReservationId, setUploadReservationId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await listNotifications({ limit: 50 });
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
                isRead: n?.isRead ?? false,
              };
            });

          setNotifications(normalized.sort((a, b) => {
            const aTime = new Date(a.createdAt || 0).getTime();
            const bTime = new Date(b.createdAt || 0).getTime();
            return bTime - aTime;
          }));
        }
      } catch (error) {
        console.error('Failed to load notifications:', error);
        if (!cancelled) setNotifications([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // WebSocket listener for real-time notifications
  useEffect(() => {
    initSocketFresh().catch(() => {});
    startAutoReconnect();

    const handleWebSocketMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'notification' && data.notification) {
          const newNotif = data.notification;
          
          const normalized = {
            _id: newNotif.id || String(Date.now()),
            title: newNotif.title,
            message: newNotif.message ?? null,
            kind: newNotif.kind ?? null,
            createdAt: newNotif.createdAt || new Date(),
            isRead: false,
            source: newNotif.source || "Teachers' Camp",
            timeLabel: newNotif.time || 'Just now',
            reservationId: newNotif.reservationId || null,
          };

          setNotifications(prev => {
            const exists = prev.some(n => 
              (n._id && normalized._id && String(n._id) === String(normalized._id)) ||
              (n.kind === normalized.kind && 
               n.reservationId && normalized.reservationId &&
               String(n.reservationId) === String(normalized.reservationId))
            );
            
            if (exists) return prev;
            
            const updated = [normalized, ...prev];
            return updated.sort((a, b) => {
              const aTime = new Date(a.createdAt || 0).getTime();
              const bTime = new Date(b.createdAt || 0).getTime();
              return bTime - aTime;
            });
          });

          // Refresh notifications list after a short delay to ensure we have the latest data
          // This is a fallback in case the WebSocket message doesn't contain all the data
          setTimeout(async () => {
            try {
              const res = await listNotifications({ limit: 50 });
              const items = Array.isArray(res?.data) ? res.data : [];
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
                    isRead: n?.isRead ?? false,
                  };
                });

              setNotifications(normalized.sort((a, b) => {
                const aTime = new Date(a.createdAt || 0).getTime();
                const bTime = new Date(b.createdAt || 0).getTime();
                return bTime - aTime;
              }));
            } catch (error) {
              console.error('Failed to refresh notifications:', error);
            }
          }, 500);
        }
      } catch (error) {
        console.error('[Notification] Error parsing WebSocket notification:', error);
      }
    };

    const unsubscribe = subscribe(handleWebSocketMessage);

    return () => {
      unsubscribe();
      // Note: We don't stop auto-reconnect here as other components (Header, Messages) also use it
    };
  }, []);

  async function markAll() {
    setNotifications(n => n.map(x => ({ ...x, isRead: true })));
    try {
      await markAllNotificationsRead();
      if (onMarkAllAsRead) onMarkAllAsRead();
    } catch (e) {
      console.warn('Mark all failed:', e.message);
    }
  }

  async function clearAll() {
    if (!window.confirm('Are you sure you want to delete all notifications? This action cannot be undone.')) {
      return;
    }
    
    try {
      await deleteAllNotifications();
      setNotifications([]);
      if (onMarkAllAsRead) onMarkAllAsRead();
    } catch (e) {
      console.warn('Clear all failed:', e.message);
      alert('Failed to clear all notifications. Please try again.');
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

    // For booking_success notifications, show preview
    if (notif.kind === 'booking_success' || 
        (notif.title && notif.title.includes("Congratulations, Camper! You have successfully submitted your reservation request!"))) {
      setSelected(notif);
      setStage('preview');
      return;
    }

    // For approved notifications, show preview with confirm/cancel buttons
    if (notif.kind === 'reservation_approved' || 
        notif.kind === 'reservation_approved_admin' ||
        (notif.title && (notif.title.toLowerCase().includes('approved') || notif.title.toLowerCase().includes('approval')))) {
      setSelected(notif);
      setStage('approved');
      return;
    }

    // For cancellation notifications, show cancel preview
    if (notif.kind === 'reservation_cancelled' || 
        notif.kind === 'reservation_cancelled_admin' ||
        (notif.title && (notif.title.toLowerCase().includes('cancelled') || notif.title.toLowerCase().includes('cancellation')))) {
      setSelected(notif);
      setStage('cancel');
      return;
    }

    // For decline notifications, show cancel preview (same component handles both)
    if (notif.kind === 'reservation_declined' || 
        notif.kind === 'reservation_declined_admin' ||
        (notif.title && notif.title.toLowerCase().includes('declined'))) {
      setSelected(notif);
      setStage('cancel');
      return;
    }
  }

  // Handle preview confirm action
  async function handlePreviewConfirm(payload) {
    if (!payload || !payload.reservationId) return;

    const { action, reservationId } = payload;

    if (action === 'transactions') {
      setSelected(null);
      setStage('list');
      navigate(`/transactions?reservationId=${encodeURIComponent(reservationId)}`);
      return;
    }

    // For individual reservations, directly confirm
    if (action === 'confirm') {
      try {
        await confirmReservation(reservationId);
        alert('Reservation confirmed successfully!');
        setSelected(null);
        setStage('list');
      } catch (error) {
        console.error('Failed to confirm reservation:', error);
        alert(error?.message || 'Failed to confirm reservation. Please try again.');
      }
      return;
    }

    // For upload action (groups), show upload notification (don't confirm yet)
    if (action === 'upload') {
      // Set upload stage with client type
      setUploadReservationId(reservationId);
      setUploadClientType(payload.clientType || 'group');
      setStage('upload');
      return;
    }
  }

  function formatTime(date) {
    if (!date) return 'Just now';
    try {
      const d = new Date(date);
      const now = new Date();
      const diffMs = now - d;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString();
    } catch {
      return 'Just now';
    }
  }

  // Show preview for approved notifications with confirm/cancel buttons
  if (selected && stage === 'approved') {
    return (
      <NotificationPreview
        notif={selected}
        clientType="individual"
        onBack={() => { setSelected(null); setStage('list'); }}
        onConfirm={handlePreviewConfirm}
        onCancel={() => { setSelected(null); setStage('list'); }}
      />
    );
  }

  // Show preview for booking_success notifications
  if (selected && stage === 'preview') {
    return (
      <NotificationPreview
        notif={selected}
        onBack={() => { setSelected(null); setStage('list'); }}
      />
    );
  }

  // Show cancel preview for cancellation notifications
  if (selected && stage === 'cancel') {
    return (
      <NotificationCancel
        notif={selected}
        tcampImage={selected.tcampImage || selected.image || null}
        tcampDocument={selected.tcampDocument || selected.document || selected.attachment || null}
        onBack={() => { setSelected(null); setStage('list'); }}
      />
    );
  }

  // Show upload notification after confirming reservation
  if (stage === 'upload') {
    const handleUploadBack = () => {
      setStage(selected ? 'approved' : 'list');
      setUploadReservationId(null);
    };

    const handleUploadSubmit = async (files) => {
      if (!uploadReservationId) {
        alert('Reservation ID is missing. Please try again.');
        return;
      }

      try {
        // Extract files from the files object
        const moaFile = files.moa || null;
        const serviceContractFile = files.service || null;
        
        // Log for debugging
        console.log('Uploading files:', { 
          moaFile: moaFile ? moaFile.name : 'none', 
          serviceContractFile: serviceContractFile ? serviceContractFile.name : 'none' 
        });
        
        // Upload documents and confirm reservation
        await uploadConfirmationDocuments(uploadReservationId, moaFile, serviceContractFile);
        
        alert('Documents submitted and reservation confirmed. Thank you!');
        setSelected(null);
        setStage('list');
        setUploadReservationId(null);
      } catch (error) {
        console.error('Failed to upload documents and confirm reservation:', error);
        alert(error?.message || 'Failed to upload documents and confirm reservation. Please try again.');
      }
    };

    return (
      <NotificationUpload
        clientType={uploadClientType}
        onBack={handleUploadBack}
        onSubmit={handleUploadSubmit}
      />
    );
  }

  return (
    <div className={styles.notifContainer}>
      <div className={styles.headerRow}>
        <span className={styles.headerTitle}>Notifications</span>
        {notifications.length > 0 && (
          <div className={styles.headerActions}>
            <button className={styles.markAllBtn} onClick={markAll}>
              Mark all as Read
            </button>
            <button className={styles.clearAllBtn} onClick={clearAll}>
              Clear All
            </button>
          </div>
        )}
      </div>
      <div className={styles.notifList}>
        {loading && (
          <div className={styles.loading}>Loading notifications...</div>
        )}
        {!loading && notifications.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>No notifications</div>
            <div className={styles.emptySub}>You're all caught up.</div>
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
                {notif.timeLabel ?? formatTime(notif.createdAt)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


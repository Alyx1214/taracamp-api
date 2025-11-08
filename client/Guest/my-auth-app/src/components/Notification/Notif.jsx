import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; 
import styles from './Notif.module.css';
import NotifPrev from './NotifPrev';
import NotifPreview from './NotifPreview';
import NotifUpload from './NotifUpload';
import NotifIndiv from './NotifIndiv';
import NotifReviews from './NotifReviews';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../../apis/notificationApi';
import { updateMealPreference, getReservationById } from '../../apis/reservationApi';
import { subscribe, initSocketFresh } from '../../utils/webSocketClient';

export default function Notif() {
  const navigate = useNavigate();
  const { search, pathname } = useLocation();                           
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [stage, setStage] = useState('list');
  const [mealPreference, setMealPreference] = useState(null);
  const [isDormitory, setIsDormitory] = useState(false);
  const [reservationLoaded, setReservationLoaded] = useState(false);
  const [uploadClientType, setUploadClientType] = useState('deped');
  const [uploadReservationId, setUploadReservationId] = useState(null);

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
                isRead: n?.isRead ?? false, // Ensure isRead is always defined
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

  // 👇 Add WebSocket listener for real-time notifications
  useEffect(() => {
    // Ensure WebSocket is initialized (HeaderHome manages auto-reconnect)
    initSocketFresh().catch(() => {});

    const handleWebSocketMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'notification' && data.notification) {
          const newNotif = data.notification;
          
          // Normalize the notification data to match the expected format
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

          // Add to notifications list if it doesn't already exist
          setNotifications(prev => {
            const locals = prev.filter(x => typeof x?._id === 'string' && x._id.startsWith('local-'));
            
            // Check if notification already exists
            const exists = prev.some(n => 
              (n._id && normalized._id && String(n._id) === String(normalized._id)) ||
              (n.kind === normalized.kind && 
               n.reservationId && normalized.reservationId &&
               String(n.reservationId) === String(normalized.reservationId))
            );
            
            if (exists) return prev;
            
            // Add new notification at the top and sort
            const updated = [normalized, ...prev];
            const sorted = updated.sort((a, b) => {
              const aTime = new Date(a.createdAt || 0).getTime();
              const bTime = new Date(b.createdAt || 0).getTime();
              return bTime - aTime;
            });
            
            // Preserve local notifications
            const final = [...sorted];
            locals.forEach(local => {
              const alreadyExists = sorted.some(serverItem =>
                serverItem._id && serverItem._id === local._id
              ) || sorted.some(serverItem =>
                serverItem.kind === local.kind &&
                !!serverItem.reservationId &&
                !!local.reservationId &&
                String(serverItem.reservationId) === String(local.reservationId)
              );
              if (!alreadyExists) {
                final.unshift(local);
              }
            });
            
            return final.sort((a, b) => {
              const aTime = new Date(a.createdAt || 0).getTime();
              const bTime = new Date(b.createdAt || 0).getTime();
              return bTime - aTime;
            });
          });
        }
      } catch (error) {
        console.error('[Notif] Error parsing WebSocket notification:', error);
      }
    };

    // Subscribe to WebSocket messages
    const unsubscribe = subscribe(handleWebSocketMessage);

    return () => {
      unsubscribe();
    };
  }, []);

  // 👇 Detect /notifications/upload route and switch to upload stage
  useEffect(() => {
    if (pathname === '/notifications/upload') {
      const sp = new URLSearchParams(search);
      const reservationId = sp.get('reservationId');
      const clientType = sp.get('clientType') || 'deped';
      setUploadReservationId(reservationId);
      setUploadClientType(clientType);
      setStage('upload');
    } else if (pathname.startsWith('/notifications')) {
      // If on notifications route but not upload, reset to list
      if (stage === 'upload') {
        setStage('list');
        setUploadReservationId(null);
      }
    }
  }, [pathname, search, stage]);

  // 👇 Detect redirect from Transactions and inject a local payment_success notification
  useEffect(() => {
    const sp = new URLSearchParams(search);
    const isSuccess = sp.get('payment') === 'success' || sp.get('paid') === '1';
    if (!isSuccess || pathname === '/notifications/upload') return;

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

  // Load reservation data to get current meal preference and check if it's a dormitory
  useEffect(() => {
    if (selected?.reservationId && stage === 'indiv') {
      let cancelled = false;
      setReservationLoaded(false);
      (async () => {
        try {
          const res = await getReservationById(selected.reservationId);
          const reservation = res?.reservation || res?.data?.reservation;
          if (!cancelled && reservation) {
            setMealPreference(reservation.willAvailMeals);
            // Check if facility type is Dormitory
            const facilityType = reservation.facilityType || 
                                 (reservation.facility?.facilityType) || 
                                 (typeof reservation.facility === 'object' ? reservation.facility?.facilityType : null);
            const isDorm = facilityType && 
                          (String(facilityType).toLowerCase() === 'dormitory' ||
                           String(facilityType).toLowerCase().includes('dormitory'));
            setIsDormitory(isDorm || false);
            setReservationLoaded(true);
          }
        } catch (error) {
          console.error('Failed to load reservation:', error);
          if (!cancelled) {
            setReservationLoaded(true); // Still mark as loaded even on error
          }
        }
      })();
      return () => { cancelled = true; };
    } else {
      setMealPreference(null);
      setIsDormitory(false);
      setReservationLoaded(false);
    }
  }, [selected?.reservationId, stage]);

  async function markAll() {
    // Only update notifications that are currently unread
    setNotifications(n => n.map(x => 
      x.isRead ? x : { ...x, isRead: true }
    ));
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
    // Check for admin approval notification - show NotifPreview with confirm/cancel buttons
    if (notif.kind === 'reservation_approved' || 
        (notif.title && (notif.title.toLowerCase().includes('approved') || notif.title.toLowerCase().includes('approval')))) {
      setSelected(notif);
      setStage('approved');
      return;
    }
    // Check for booking success by kind or title - show NotifPrev (simple version)
    if (notif.kind === 'booking_success' || 
        (notif.title && notif.title.includes("Congratulations, Camper! You have successfully booked a reservation!"))) {
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

    // Switch to upload stage within the same component
    if (action === 'upload') {
      setUploadReservationId(reservationId);
      setUploadClientType(clientType || 'deped');
      setStage('upload');
      return;
    }
  }

  // Show NotifPreview (full version with confirm/cancel) for admin approval notifications
  if (selected && stage === 'approved') {
    return (
      <NotifPreview
        notif={selected}
        clientType="individual"
        onBack={() => { setSelected(null); setStage('list'); }}
        onConfirm={handlePreviewConfirm}
        onCancel={() => { setSelected(null); setStage('list'); }}
      />
    );
  }

  // Show NotifPrev (simple version) for booking success notifications
  if (selected && stage === 'preview') {
    return (
      <NotifPrev
        notif={selected}
        clientType="individual"
        onBack={() => { setSelected(null); setStage('list'); }}
      />
    );
  }

  async function handleMealPreference(willAvailMeals) {
    if (!selected?.reservationId) {
      return;
    }
    
    try {
      await updateMealPreference(selected.reservationId, willAvailMeals);
      // Update local state to reflect the change
      setMealPreference(willAvailMeals);
    } catch (error) {
      console.error('Failed to save meal preference:', error);
    }
  }

  if (selected && stage === 'indiv') {
    return (
      <NotifIndiv
        notif={selected}
        willAvailMeals={mealPreference}
        isDormitory={isDormitory}
        reservationLoaded={reservationLoaded}
        onBack={() => { setSelected(null); setStage('list'); setMealPreference(null); setIsDormitory(false); setReservationLoaded(false); }}
        onFoodPref={handleMealPreference}
        onCancel={() => { alert('Open Cancel Booking flow (placeholder)'); }}
      />
    );
  }

  // Handle upload stage (either from route or internal navigation)
  if (stage === 'upload') {
    const handleUploadBack = () => {
      if (pathname === '/notifications/upload') {
        navigate('/homepage');
      } else {
        // Go back to approved/preview if we came from there, otherwise go to list
        // Upload can be triggered from NotifPreview (approved stage), so go back to approved
        setStage(selected ? 'approved' : 'list');
      }
    };

    const handleUploadSubmit = (files) => {
      console.log('Submit files:', files, 'for reservation:', uploadReservationId || selected?.reservationId);
      // TODO: Implement actual file upload API call
      
      // Mark notification as read if there's a selected notification
      if (selected?._id) {
        setNotifications(n => n.map(x => x._id === selected._id ? { ...x, isRead: true } : x));
      }
      
      alert('Documents submitted. Thank you!');
      
      if (pathname === '/notifications/upload') {
        navigate('/homepage');
      } else {
        // Return to notification list
        setSelected(null);
        setStage('list');
        setUploadReservationId(null);
      }
    };

    return (
      <NotifUpload
        clientType={uploadClientType}
        onBack={handleUploadBack}
        onSubmit={handleUploadSubmit}
      />
    );
  }

  if (stage === 'reviews') {
    return (
      <NotifReviews
        onBack={() => {
          setStage('list');
        }}
        onSubmit={() => {
          setStage('list');
        }}
      />
    );
  }

  return (
    <div className={styles.notifContainer}>
      <div className={styles.headerRow}>
        <span className={styles.headerTitle}>Notifications</span>
        {notifications.length > 0 && (
          <button className={styles.markAllBtn} onClick={markAll}>
            Mark all as Read
          </button>
        )}
      </div>
      <div className={styles.notifList}>
        {/* Static entry to prompt users to write a review */}
        {!loading && (
          <div
            className={styles.notifItem}
            onClick={() => setStage('reviews')}
          >
            <div className={styles.notifTitleRow}>
              <span className={styles.notifTitle}>Share your stay</span>
            </div>
            <div className={styles.notifBody}>Tell others about your experience by leaving a review.</div>
            <div className={styles.notifMeta}>
              <span className={styles.notifSource}>
                <span className={styles.notifSourceDot} /> Teachers' Camp
              </span>
              <span className={styles.notifTime}>Just now</span>
            </div>
          </div>
        )}
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

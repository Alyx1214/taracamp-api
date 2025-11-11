import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; 
import styles from './Notif.module.css';
import NotifPrev from './NotifPrev';
import NotifPreview from './NotifPreview';
import NotifUpload from './NotifUpload';
import NotifIndiv from './NotifIndiv';
import NotifReviews from './NotifReviews';
import NotifCancel from './NotifCancel';
import { listNotifications, markAllNotificationsRead, markNotificationRead, deleteAllNotifications } from '../../apis/notificationApi';
import { updateMealPreference, getReservationById, cancelReservation } from '../../apis/reservationApi';
import { addReview } from '../../apis/reviewsApi';
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
                reservationId: n?.reservationId || n?.reservation_id || null,
                tcampImage: n?.tcampImage || n?.image || null,
                tcampDocument: n?.tcampDocument || n?.document || n?.attachment || null,
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
            tcampImage: newNotif.tcampImage || newNotif.image || null,
            tcampDocument: newNotif.tcampDocument || newNotif.document || newNotif.attachment || null,
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

  async function clearAll() {
    if (!window.confirm('Are you sure you want to delete all notifications? This action cannot be undone.')) {
      return;
    }
    
    try {
      await deleteAllNotifications();
      setNotifications([]);
      setSelected(null);
      setStage('list');
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
    // Check for cancellation notifications - show NotifCancel
    if (notif.kind === 'reservation_cancelled' || 
        (notif.title && (notif.title.toLowerCase().includes('cancelled') || notif.title.toLowerCase().includes('cancellation')))) {
      setSelected(notif);
      setStage('cancel');
      return;
    }
    // Check for checkout review request - show NotifReviews
    if (notif.kind === 'checkout_review_request' || 
        (notif.title && notif.title === 'Share your stay')) {
      setSelected(notif);
      setStage('reviews');
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
        onCancel={handleCancelBooking}
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

  // Show NotifCancel for cancellation notifications
  if (selected && stage === 'cancel') {
    return (
      <NotifCancel
        notif={selected}
        tcampImage={selected.tcampImage || selected.image || null}
        tcampDocument={selected.tcampDocument || selected.document || selected.attachment || null}
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

  async function handleCancelBooking() {
    if (!selected?.reservationId) {
      alert('Reservation ID is missing. Cannot cancel booking.');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to cancel this reservation? This action cannot be undone.'
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await cancelReservation(selected.reservationId);
      
      // The API returns the data object directly if successful (from handle function)
      // Server response structure: { status: 200, error: null, message: '...', reservation: {...} }
      const isSuccess = response?.status === 200 && !response?.error;
      
      if (isSuccess || response?.message) {
        // Remove the notification from the list
        setNotifications(prev => prev.filter(n => n._id !== selected._id));
        
        // Show success message
        alert(response?.message || 'Your reservation has been cancelled successfully.');
        
        // Reset state and go back to list
        setSelected(null);
        setStage('list');
        setMealPreference(null);
        setIsDormitory(false);
        setReservationLoaded(false);
        
        // Optionally refresh notifications to get the cancellation notification
        // The server should send a cancellation notification via WebSocket
      } else {
        throw new Error(response?.error || response?.message || 'Failed to cancel reservation');
      }
    } catch (error) {
      const errorMessage = error?.data?.error || 
                          error?.data?.message || 
                          error?.message || 
                          'Failed to cancel your reservation. Please try again or contact support.';
      alert(errorMessage);
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
        onCancel={handleCancelBooking}
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
        initial={{
          title: selected?.title || 'Share your stay',
          body: selected?.message || 'Tell others about your experience by leaving a review.',
          source: selected?.source || "Teachers' Camp",
          time: selected?.timeLabel || selected?.createdAt || new Date(),
        }}
        onBack={() => {
          setSelected(null);
          setStage('list');
        }}
        onSubmit={async (payload) => {
          try {
            // Validate that all ratings are provided (1-5 stars)
            if (!payload.location || !payload.service || !payload.cleanliness || !payload.overall) {
              alert('Please provide ratings for all categories (Location, Service, Cleanliness, and Overall).');
              return;
            }

            // Get reservation to find facilityId
            if (!selected?.reservationId) {
              alert('Reservation ID is missing. Cannot submit review.');
              return;
            }

            const reservationRes = await getReservationById(selected.reservationId);
            const reservation = reservationRes?.reservation || reservationRes?.data?.reservation;
            
            if (!reservation) {
              alert('Reservation not found. Cannot submit review.');
              return;
            }

            // Extract facilityId from reservation
            const facilityObj = typeof reservation.facility === 'object' ? reservation.facility : null;
            const facilityId =
              facilityObj?._id ||
              reservation.facilityId ||
              (typeof reservation.facility === 'string' ? reservation.facility : null);

            if (!facilityId) {
              alert('Facility ID is missing. Cannot submit review.');
              return;
            }

            // Convert 1-5 star ratings to 1-10 scale (multiply by 2)
            // Prepare review data according to backend API
            const reviewData = {
              facilityId: String(facilityId),
              reservationId: selected.reservationId,
              rating: {
                location: payload.location * 2,
                service: payload.service * 2,
                cleanliness: payload.cleanliness * 2,
                overall: payload.overall * 2,
              },
              text: payload.comment || '',
            };

            // Submit review
            const response = await addReview(reviewData);
            
            if (response?.status === 201 || response?.message) {
              alert(response?.message || 'Review submitted successfully!');
              // Remove the notification from the list
              setNotifications(prev => prev.filter(n => n._id !== selected._id));
              setSelected(null);
              setStage('list');
            } else {
              throw new Error(response?.error || 'Failed to submit review');
            }
          } catch (error) {
            console.error('Error submitting review:', error);
            alert(error?.data?.error || error?.message || 'Failed to submit review. Please try again.');
          }
        }}
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

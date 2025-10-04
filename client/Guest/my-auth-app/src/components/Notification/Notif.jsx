import React, { useEffect, useState } from 'react';
import styles from './Notif.module.css';
import NotifPreview from './NotifPreview';
import NotifUpload from './NotifUpload';
import NotifIndiv from './NotifIndiv';
import { listNotifications, markAllNotificationsRead, markNotificationRead, } from '../../apis/notificationApi';

// const dummyNotifications = [
//   {
//     _id: 'n1',
//     title:
//       "Congratulations, Camper! Payment Successful — your reservation is now confirmed. We can't wait to welcome you!",
//     isRead: false,
//     source: "Teachers' Camp",
//     timeLabel: "30mins",
//     kind: 'payment_success',
//   },
//   {
//     _id: 'n2',
//     title:
//       "Congratulations, Camper!  You have successfully booked a reservation!",
//     isRead: false,
//     source: "Teachers' Camp",
//     timeLabel: "5mins",
//     kind: "booking_success", 
//   },
//   {
//     _id: 'n3',
//     title: "Mabuhay! Welcome to Teachers Camp!",
//     message:
//       "We’re thrilled to have you here! Whether you’re visiting for a seminar, retreat, or a well-deserved break, Teachers’ Camp offers a perfect blend of history, comfort, and inspiration. Explore our facilities, connect with fellow educators, and make the most of your stay. If you need any assistance, we’re here to help. Enjoy your experience!",
//     isRead: true,
//     source: "Teachers Camp System",
//     timeLabel: "1 Hr",
//   },
// ];

export default function Notif() {
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
        if (!cancelled) setNotifications(items);
      } catch (e) {
        if (!cancelled) setNotifications([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

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

  if (selected && stage === 'preview') {
    return (
      <NotifPreview
        notif={selected}
        clientType="individual"
        onBack={() => { setSelected(null); setStage('list'); }}
        onConfirm={() => { setStage('upload'); }}
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

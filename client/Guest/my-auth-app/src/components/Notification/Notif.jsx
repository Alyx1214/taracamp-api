import React, { useEffect, useState } from 'react';
import styles from './Notif.module.css';
import NotifPreview from './NotifPreview';
import NotifUpload from './NotifUpload';

const dummyNotifications = [
  {
    _id: 'n1',
    title: "Congratulations, Camper! Confirmation Successful — your reservation is now confirmed. We can't wait to welcome you!",
    isRead: false,
    source: "Teachers Camp",
    timeLabel: "5mins",
  },
  {
    _id: 'n2',
    title: "Congratulations, Camper!  You have successfully booked a reservation!",
    isRead: false,
    source: "Teachers Camp",
    timeLabel: "30mins",
    kind: "booking_success",   // add marker for detail screen
  },
  {
    _id: 'n3',
    title: "Mabuhay! Welcome to Teachers Camp!",
    message:
      "We’re thrilled to have you here! Whether you’re visiting for a seminar, retreat, or a well-deserved break, Teachers’ Camp offers a perfect blend of history, comfort, and inspiration. Explore our facilities, connect with fellow educators, and make the most of your stay. If you need any assistance, we’re here to help. Enjoy your experience!",
    isRead: true,
    source: "Teachers Camp System",
    timeLabel: "1 Hr",
  },
];

export default function Notif() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [stage, setStage] = useState('list'); // list | preview | upload

  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      setNotifications(dummyNotifications);
      setLoading(false);
    }, 400);
  }, []);

  function markAll() {
    setNotifications(n => n.map(x => ({ ...x, isRead: true })));
  }

  function handleClick(notif) {
    if (notif.kind === "booking_success") {
      setSelected(notif);     // open detail for second UI
      setStage('preview');
    } else {
      setNotifications(n => n.map(x => x._id === notif._id ? { ...x, isRead: true } : x));
    }
  }

  if (selected && stage === 'preview') {
    return (
      <NotifPreview
        notif={selected}
        clientType="individual"
        onBack={() => { setSelected(null); setStage('list'); }}
        onConfirm={() => {
          // Move to upload screen with dummy data
          setStage('upload');
        }}
        onCancel={() => { console.log("Cancel clicked"); setSelected(null); }}
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
          // Mark notification as read and return to list
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
        <button className={styles.markAllBtn} onClick={markAll}>
          Mark all as Read
        </button>
      </div>

      <div className={styles.notifList}>
        {loading && <div className={styles.emptyMsg}>Loading…</div>}
        {!loading &&
          notifications.map((notif) => (
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
                <span className={styles.notifTime}>{notif.timeLabel}</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

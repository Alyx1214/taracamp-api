import React, { useEffect, useState } from 'react';
import styles from './NotifPreview.module.css';

export default function NotifPreview({
  notif = {},
  clientType = 'individual',
  onConfirm = () => {},
  onCancel = () => {},
  onBack = () => {},
  loadReservation,
}) {
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const isPay = clientType === 'priva-group' || clientType === 'individual';
  const confirmLabel = isPay ? 'Pay Now' : 'Confirm Now';

  useEffect(() => {
    let live = true;
    (async () => {
      if (!loadReservation || !notif?.reservationId) {
        setErr('Missing reservationId on notification');
        return;
      }
      setErr('');
      setLoading(true);
      try {
        const data = await loadReservation(notif);
        if (live) setReservation(data);
      } catch (e) {
        if (live) setErr(String(e.message || e));
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [notif?.reservationId, loadReservation]);

  const fmt = v => {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d) ? String(v) : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const title = reservation?.title || notif.title || 'Congratulations, Camper!  You have successfully booked a reservation!';
  const body = reservation?.body || notif.message;

  const checkInDate = reservation?.checkInDate || notif.checkInDate;
  const checkOutDate = reservation?.checkOutDate || notif.checkOutDate;
  const accommodationType = reservation?.accommodationType || notif.accommodationType;
  const numGuests = reservation?.numGuests ?? notif.numGuests;
  const source = reservation?.source || notif.source || 'Teachers Camp';
  const time = reservation?.time || notif.time || '30mins';

  return (
    <div className={styles.previewContainer}>
      <div className={styles.previewHeaderRow}>
        <button className={styles.previewBackBtn} onClick={onBack} aria-label="Back">&#8592;</button>
        <span className={styles.previewHeaderTitle}>Notifications</span>
      </div>
      <div style={{ padding: '24px 32px 0 32px' }}>
        <div className={styles.previewTitleBox}>
          <span>{title}</span>
        </div>

        {err ? (
          <div className={styles.previewBody} style={{ color: '#b91c1c' }}>{err}</div>
        ) : (
          <div className={styles.previewBody}>
            {body || (
              <>Thank you for choosing Teachers' Camp! Your reservation has been confirmed. We're excited to welcome you and ensure you have a comfortable and memorable stay.</>
            )}
          </div>
        )}

        <div className={styles.previewDetailsBox}>
          <div className={styles.previewDetailsTitle}>Reservation Details:</div>
          <div className={styles.previewDetailsRow}><b>Location:</b> Teachers' Camp, Baguio City</div>
          <div className={styles.previewDetailsRow}><b>Check-in Date:</b> {loading ? 'Loading…' : checkInDate ? fmt(checkInDate) : '[Insert Date]'}</div>
          <div className={styles.previewDetailsRow}><b>Check-out Date:</b> {loading ? 'Loading…' : checkOutDate ? fmt(checkOutDate) : '[Insert Date]'}</div>
          <div className={styles.previewDetailsRow}><b>Accommodation Type:</b> {loading ? 'Loading…' : (accommodationType || '[Room/Cottage/Hall Name]')}</div>
          <div className={styles.previewDetailsRow}><b>Number of Guests:</b> {loading ? 'Loading…' : (numGuests ?? '[Insert Number]')}</div>
        </div>

        <div className={styles.previewNotice}>
          Please ensure the confirmation is made before the due date to avoid cancellation of your reservation.
        </div>

        <button className={styles.previewConfirmBtn} onClick={onConfirm} disabled={!!err || loading}>
          {confirmLabel}
        </button>

        <div className={styles.previewCancelBox}>
          <div className={styles.previewCancelTitle}>Need to Cancel?</div>
          <div className={styles.previewCancelText}>
            We understand that plans may change.<br />
            If you wish to cancel your reservation, please click the cancel button below.
          </div>
          <button className={styles.previewCancelBtn} onClick={onCancel}>Cancel Booking</button>
        </div>

        <div className={styles.previewFooter}>Looking forward to seeing you soon!</div>
        <div className={styles.previewMeta}>
          <span className={styles.previewSource}>{source}</span>
          <span className={styles.previewTime}>{time}</span>
        </div>
      </div>
    </div>
  );
}

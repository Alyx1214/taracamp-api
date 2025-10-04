import React, { useEffect, useState } from 'react';
import { getReservationById } from '../../apis/reservationApi';
import { timeAgo } from '../../utils/timeAgo';
import styles from './NotifPreview.module.css';

export default function NotifPreview({
  notif = {},
  clientType = 'individual',
  onConfirm = () => {},
  onCancel = () => {},
  onBack = () => {},
}) {
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await getReservationById(notif.reservationId);
        const raw = res.reservation || res.data?.reservation;
        if (!cancelled && raw) {
          setReservation({
            checkInDate: raw.dateOfArrival,
            checkOutDate: raw.dateOfDeparture,
            accommodationType: raw.facilityType,
            numGuests: raw.numberOfGuests?.total ?? 0,
          });
        }
      } catch (e) {
        console.error('load failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (notif.reservationId) load();
    return () => { cancelled = true; };
  }, [notif.reservationId]);

  const isPay = clientType === 'priva-group' || clientType === 'individual';
  const confirmLabel = isPay ? 'Pay Now' : 'Confirm Now';

  const fmt = v => {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d)
      ? String(v)
      : d.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
  };

  const title =
    notif.title ||
    'Congratulations, Camper!  You have successfully booked a reservation!';
  const body =
    notif.message ||
    "Thank you for choosing Teachers' Camp! Your reservation has been confirmed. We're excited to welcome you and ensure you have a comfortable and memorable stay.";

  const checkInDate = reservation?.checkInDate;
  const checkOutDate = reservation?.checkOutDate;
  const accommodationType = reservation?.accommodationType;
  const numGuests = reservation?.numGuests;
  const source = notif.source || 'Teachers Camp';
  const time   = notif.timeLabel
    ? notif.timeLabel           
    : timeAgo(notif.createdAt);  

  return (
    <div className={styles.previewContainer}>
      <div className={styles.previewHeaderRow}>
        <button
          className={styles.previewBackBtn}
          onClick={onBack}
          aria-label="Back"
        >
          &#8592;
        </button>
        <span className={styles.previewHeaderTitle}>Notifications</span>
      </div>
      <div className={styles.previewCard}>
        <div className={styles.previewTitleBox}>
          <span>{title}</span>
        </div>

        <div className={styles.previewBody}>{body}</div>

        <div className={styles.previewDetailsBox}>
          <div className={styles.previewDetailsTitle}>Reservation Details:</div>
          <div className={styles.previewDetailsRow}>
            <b>Location:</b> Teachers' Camp, Baguio City
          </div>
          <div className={styles.previewDetailsRow}>
            <b>Check-in Date:</b>{' '}
            {loading ? 'Loading…' : checkInDate ? fmt(checkInDate) : '[Insert Date]'}
          </div>
          <div className={styles.previewDetailsRow}>
            <b>Check-out Date:</b>{' '}
            {loading ? 'Loading…' : checkOutDate ? fmt(checkOutDate) : '[Insert Date]'}
          </div>
          <div className={styles.previewDetailsRow}>
            <b>Accommodation Type:</b>{' '}
            {loading ? 'Loading…' : accommodationType || '[Room/Cottage/Hall Name]'}
          </div>
          <div className={styles.previewDetailsRow}>
            <b>Number of Guests:</b>{' '}
            {loading ? 'Loading…' : numGuests ?? '[Insert Number]'}
          </div>
        </div>

        <div className={styles.previewNotice}>
          Please ensure the confirmation is made before the due date to avoid cancellation of your reservation.
        </div>

        <button
          className={styles.previewConfirmBtn}
          onClick={onConfirm}
          disabled={loading}
        >
          {confirmLabel}
        </button>

        <div className={styles.previewCancelBox}>
          <div className={styles.previewCancelTitle}>Need to Cancel?</div>
          <div className={styles.previewCancelText}>
            We understand that plans may change.
            <br />
            If you wish to cancel your reservation, please click the cancel
            button below.
          </div>
          <button className={styles.previewCancelBtn} onClick={onCancel}>
            Cancel Booking
          </button>
        </div>

        <div className={styles.previewFooter}>
          Looking forward to seeing you soon!
        </div>
        <div className={styles.previewMeta}>
          <span className={styles.previewSource}>{source}</span>
          <span className={styles.previewTime}>{time}</span>
        </div>
      </div>
    </div>
  );
}

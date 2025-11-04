import React, { useEffect, useState } from 'react';
import { getReservationById } from '../../apis/reservationApi';
import { getFacilityById } from '../../apis/facilityApi';
import { timeAgo } from '../../utils/timeAgo';
import styles from './NotifPreview.module.css';

export default function NotifPreview({
  notif = {},
  clientType = 'individual',       // fallback if reservation.guestType absent
  onBack = () => {},
}) {
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [facilityLoading, setFacilityLoading] = useState(false);

  // Load reservation
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!notif.reservationId) return;
      setLoading(true);
      try {
        const res = await getReservationById(notif.reservationId);
        const raw = res?.reservation || res?.data?.reservation;
        if (!cancelled && raw) {
          const facilityObj = typeof raw.facility === 'object' ? raw.facility : null;
          const facilityId =
            facilityObj?._id ||
            raw.facilityId ||
            (typeof raw.facility === 'string' ? raw.facility : null) ||
            null;

          setReservation({
            checkInDate: raw.dateOfArrival,
            checkOutDate: raw.dateOfDeparture,
            facilityType: raw.facilityType || facilityObj?.facilityType || null,
            facilityName: raw.facilityName || facilityObj?.name || facilityObj?.facilityName || null,
            facilityId,
            guestType: raw.guestType || null,
            numGuests: raw.numberOfGuests?.total ?? 0,
          });
        }
      } catch (e) {
        console.error('load reservation failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [notif.reservationId]);

  // Optionally load facility details
  const needsFacilityDetails =
    !!reservation?.facilityId && (!reservation?.facilityName || !reservation?.facilityType);

  useEffect(() => {
    if (!needsFacilityDetails) return;
    let cancelled = false;
    (async () => {
      setFacilityLoading(true);
      try {
        const res = await getFacilityById(String(reservation.facilityId));
        const data = res?.facility || res?.data?.facility;
        if (!cancelled && data) {
          setReservation(prev => prev ? ({
            ...prev,
            facilityName: prev.facilityName || data.name || data.facilityName || null,
            facilityType: prev.facilityType || data.facilityType || null,
          }) : prev);
        }
      } catch (e) {
        console.warn('load facility failed', e);
      } finally {
        if (!cancelled) setFacilityLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [needsFacilityDetails, reservation?.facilityId]);

  const fmt = v => {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d)
      ? String(v)
      : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const fmtFacilityType = value =>
    !value ? '' : String(value).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  const title =
    notif.title ||
    'Congratulations, Camper!  You have successfully booked a reservation!';
  const body =
    notif.message ||
    "Thank you for choosing Teachers' Camp! Your reservation has been submitted. Please wait for the approval of your booking.";

  const normalizedGuestType = String(reservation?.guestType || '').toLowerCase();
  const clientTypeFallback = String(clientType || '').toLowerCase();
  // Determine isPay based on reservation data - only after reservation is loaded
  // Show "Loading..." while loading to prevent label flickering
  const isPay = reservation && reservation.guestType !== undefined && reservation.guestType !== null
    ? normalizedGuestType === 'individual'
    : clientTypeFallback === 'individual';

  // Action should match the label - only determine after reservation is loaded
  const action = (loading || facilityLoading) 
    ? null 
    : (isPay ? 'transactions' : 'upload');
  const source = notif.source || 'Teachers Camp';
  const time = notif.timeLabel ? notif.timeLabel : timeAgo(notif.createdAt);

  return (
    <div className={styles.previewContainer}>
      <div className={styles.previewHeaderRow}>
        <button className={styles.previewBackBtn} onClick={onBack} aria-label="Back">
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
            {loading ? 'Loading…' : reservation?.checkInDate ? fmt(reservation.checkInDate) : '[Insert Date]'}
          </div>

          <div className={styles.previewDetailsRow}>
            <b>Check-out Date:</b>{' '}
            {loading ? 'Loading…' : reservation?.checkOutDate ? fmt(reservation.checkOutDate) : '[Insert Date]'}
          </div>

          <div className={styles.previewDetailsRow}>
            <b>Facility:</b>{' '}
            {(loading || facilityLoading) ? 'Loading…' : (reservation?.facilityName || '[Facility Name]')}
          </div>

          <div className={styles.previewDetailsRow}>
            <b>Facility Type:</b>{' '}
            {(loading || facilityLoading)
              ? 'Loading…'
              : (reservation?.facilityType ? fmtFacilityType(reservation.facilityType) : '[Facility Type]')}
          </div>

          <div className={styles.previewDetailsRow}>
            <b>Number of Guests:</b>{' '}
            {loading ? 'Loading…' : (reservation?.numGuests ?? '[Insert Number]')}
          </div>
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

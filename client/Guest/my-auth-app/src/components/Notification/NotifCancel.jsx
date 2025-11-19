import React, { useEffect, useState } from 'react';
import { getReservationById } from '../../apis/reservationApi';
import { getFacilityById } from '../../apis/facilityApi';
import { timeAgo } from '../../utils/timeAgo';
import styles from './NotifCancel.module.css';

export default function NotifCancel({
  notif = {},
  tcampImage = null,  // Image to be sent from tcamp
  tcampDocument = null,  // PDF or image document from tcamp
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
        const raw = res?.reservation || res?.data?.reservation || res?.data;
        if (!cancelled && raw) {
          // Debug: log the raw response to see what we're getting
          console.log('[NotifCancel] Raw reservation data:', raw);
          console.log('[NotifCancel] nonAvailabilityCertFile:', raw.nonAvailabilityCertFile);
          
          const facilityObj = typeof raw.facility === 'object' ? raw.facility : null;
          const facilityId =
            facilityObj?._id ||
            raw.facilityId ||
            (typeof raw.facility === 'string' ? raw.facility : null) ||
            null;

          const reservationData = {
            checkInDate: raw.dateOfArrival,
            checkOutDate: raw.dateOfDeparture,
            facilityType: raw.facilityType || facilityObj?.facilityType || null,
            facilityName: raw.facilityName || facilityObj?.name || facilityObj?.facilityName || null,
            facilityId,
            guestType: raw.guestType || null,
            numGuests: raw.numberOfGuests?.total ?? 0,
            nonAvailabilityCertFile: raw.nonAvailabilityCertFile || null,
          };
          
          console.log('[NotifCancel] Setting reservation with nonAvailabilityCertFile:', reservationData.nonAvailabilityCertFile);
          setReservation(reservationData);
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

  // Determine if this is a decline or cancellation notification
  const isDeclined = notif.kind === 'reservation_declined' || 
    (notif.title && notif.title.toLowerCase().includes('declined'));
  const detailsLabel = isDeclined ? 'Declined Reservation Details:' : 'Cancelled Reservation Details:';

  // For declined notifications, use non-availability certificate if available
  const nonAvailabilityCertFile = isDeclined ? reservation?.nonAvailabilityCertFile : null;

  const title =
    notif.title ||
    (isDeclined ? 'Reservation Declined' : 'Reservation Cancellation Notice');
  const body =
    notif.message ||
    (isDeclined 
      ? "We're sorry to inform you that your reservation request has been declined. If you have any questions or would like to discuss this decision, please contact us."
      : "We're sorry to inform you that your reservation has been cancelled. We understand this may cause inconvenience, and we apologize for any disruption to your plans.");

  const source = notif.source || 'Teachers Camp';
  const time = notif.timeLabel ? notif.timeLabel : timeAgo(notif.createdAt);

  return (
    <div className={styles.cancelContainer}>
      <div className={styles.cancelHeaderRow}>
        <button className={styles.cancelBackBtn} onClick={onBack} aria-label="Back">
          &#8592;
        </button>
        <span className={styles.cancelHeaderTitle}>Notifications</span>
      </div>

      <div className={styles.cancelCard}>
        <div className={styles.cancelTitleBox}>
          <span>{title}</span>
        </div>

        <div className={styles.cancelBody}>{body}</div>

        {tcampImage && (
          <div className={styles.cancelImageBox}>
            <img 
              src={tcampImage} 
              alt="Cancellation notice from Teachers Camp" 
              className={styles.cancelImage}
            />
          </div>
        )}

        <div className={styles.cancelDetailsBox}>
          <div className={styles.cancelDetailsTitle}>{detailsLabel}</div>

          <div className={styles.cancelDetailsRow}>
            <b>Location:</b> Teachers' Camp, Baguio City
          </div>

          <div className={styles.cancelDetailsRow}>
            <b>Check-in Date:</b>{' '}
            {loading ? 'Loading…' : reservation?.checkInDate ? fmt(reservation.checkInDate) : '[Insert Date]'}
          </div>

          <div className={styles.cancelDetailsRow}>
            <b>Check-out Date:</b>{' '}
            {loading ? 'Loading…' : reservation?.checkOutDate ? fmt(reservation.checkOutDate) : '[Insert Date]'}
          </div>

          <div className={styles.cancelDetailsRow}>
            <b>Facility:</b>{' '}
            {(loading || facilityLoading) ? 'Loading…' : (reservation?.facilityName || '[Facility Name]')}
          </div>

          <div className={styles.cancelDetailsRow}>
            <b>Facility Type:</b>{' '}
            {(loading || facilityLoading)
              ? 'Loading…'
              : (reservation?.facilityType ? fmtFacilityType(reservation.facilityType) : '[Facility Type]')}
          </div>

          <div className={styles.cancelDetailsRow}>
            <b>Number of Guests:</b>{' '}
            {loading ? 'Loading…' : (reservation?.numGuests ?? '[Insert Number]')}
          </div>

          {/* Display non-availability certificate for declined notifications */}
          {isDeclined && !loading && (
            <div className={styles.cancelDetailsRow}>
              <b>Non-Availability Certificate:</b>{' '}
              {nonAvailabilityCertFile ? (
                <a 
                  href={nonAvailabilityCertFile} 
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#0066cc', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  Click to open
                </a>
              ) : (
                <span style={{ color: '#666' }}>No certificate available</span>
              )}
            </div>
          )}

          {/* Display cancellation document for cancellation notifications */}
          {!isDeclined && tcampDocument && (
            <div className={styles.cancelDetailsRow}>
              <b>Official Cancellation Document:</b>{' '}
              <a 
                href={tcampDocument} 
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#0066cc', textDecoration: 'underline', cursor: 'pointer' }}
              >
                Click to open
              </a>
            </div>
          )}
        </div>

        <div className={styles.cancelNotice}>
          {isDeclined 
            ? "If you have any questions or would like to discuss this decision, please contact our support team. We're here to assist you."
            : "If you have any questions or concerns regarding this cancellation, please feel free to contact our support team. We're here to assist you."}
        </div>

        <div className={styles.cancelInfoBox}>
          <div className={styles.cancelInfoTitle}>What happens next?</div>
          <div className={styles.cancelInfoText}>
            {isDeclined ? (
              <>
                • You're welcome to submit a new reservation request at any time.
                <br />
                • If you have questions about why your reservation was declined, please contact our support team.
              </>
            ) : (
              <>
                • If you made a payment, a refund will be processed according to our cancellation policy.
                <br />
                • You're welcome to make a new reservation at any time.
              </>
            )}
          </div>
        </div>

        <div className={styles.cancelFooter}>We hope to serve you again in the future!</div>

        <div className={styles.cancelMeta}>
          <span className={styles.cancelSource}>{source}</span>
          <span className={styles.cancelTime}>{time}</span>
        </div>
      </div>
    </div>
  );
}
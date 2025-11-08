import React, { useEffect, useState } from 'react';
import { getReservationById } from '../../apis/reservationApi';
import { getFacilityById } from '../../apis/facilityApi';
import { timeAgo } from '../../utils/timeAgo';
import styles from './NotificationCancel.module.css';

export default function NotificationCancel({
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

  // Determine document type and file extension
  const getDocumentType = (url) => {
    if (!url) return null;
    const urlLower = url.toLowerCase();
    if (urlLower.endsWith('.pdf')) return 'pdf';
    if (urlLower.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/)) return 'image';
    return 'pdf'; // Default to PDF
  };

  const getFileExtension = (url) => {
    if (!url) return 'pdf';
    const match = url.match(/\.([^.]+)$/);
    return match ? match[1] : 'pdf';
  };

  const getFileName = (url) => {
    if (!url) return 'document';
    const parts = url.split('/');
    const fileName = parts[parts.length - 1];
    return fileName || `cancellation-notice-${notif.reservationId || 'document'}`;
  };

  const documentType = getDocumentType(tcampDocument);
  const fileExtension = getFileExtension(tcampDocument);
  const fileName = getFileName(tcampDocument);

  const title =
    notif.title ||
    'Reservation Cancellation Notice';
  const body =
    notif.message ||
    "We're sorry to inform you that your reservation has been cancelled. We understand this may cause inconvenience, and we apologize for any disruption to your plans.";

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
          <div className={styles.cancelDetailsTitle}>Cancelled Reservation Details:</div>

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
        </div>

        {tcampDocument && (
          <div className={styles.cancelDocumentBox}>
            <div className={styles.cancelDocumentHeader}>
              <span className={styles.cancelDocumentTitle}>
                Official Cancellation Document
              </span>
              <span className={styles.cancelDocumentSubtitle}>
                Click the document below to download
              </span>
            </div>
            
            <a 
              href={tcampDocument} 
              download={`cancellation-notice-${notif.reservationId || 'document'}.${fileExtension}`}
              className={styles.cancelDocumentLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              {documentType === 'pdf' ? (
                <div className={styles.cancelDocumentPreview}>
                  <iframe
                    src={tcampDocument}
                    className={styles.cancelDocumentFrame}
                    title="Cancellation Document"
                  />
                  <div className={styles.cancelDocumentOverlay}>
                    <span className={styles.cancelDocumentIcon}>📥</span>
                    <span className={styles.cancelDocumentText}>Click to Download</span>
                  </div>
                </div>
              ) : (
                <div className={styles.cancelDocumentImagePreview}>
                  <img 
                    src={tcampDocument} 
                    alt="Cancellation document" 
                    className={styles.cancelDocumentImage}
                  />
                  <div className={styles.cancelDocumentOverlay}>
                    <span className={styles.cancelDocumentIcon}>📥</span>
                    <span className={styles.cancelDocumentText}>Click to Download</span>
                  </div>
                </div>
              )}
            </a>
            
            <div className={styles.cancelDocumentInfo}>
              <span className={styles.cancelDocumentFileName}>
                {fileName || `cancellation-notice.${fileExtension}`}
              </span>
            </div>
          </div>
        )}

        <div className={styles.cancelNotice}>
          If you have any questions or concerns regarding this cancellation, please feel free to contact our support team. We're here to assist you.
        </div>

        <div className={styles.cancelInfoBox}>
          <div className={styles.cancelInfoTitle}>What happens next?</div>
          <div className={styles.cancelInfoText}>
            • If you made a payment, a refund will be processed according to our cancellation policy.
            <br />
            • You're welcome to make a new reservation at any time.
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


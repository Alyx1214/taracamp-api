import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./ApprovedRSVDetails.module.css";
import { getReservationById } from "../../apis/reservationApi";

function formatDateLong(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function ApprovedRSVDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await getReservationById(id);
        if (cancelled) return;
        if (res?.reservation) {
          setReservation(res.reservation);
          setError("");
        } else {
          setReservation(null);
          setError("Reservation not found.");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "Failed to fetch reservation");
          setReservation(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // Skeleton Loading Component
  const SkeletonLoading = () => (
    <div className={styles["reservation-details-container"]}>
      <div className={styles["reservation-details-header"]}>
        <span className={styles["reservation-details-back"]} onClick={() => navigate('/reservations', { state: { activeTab: 'Approved' } })}>
          &larr;
        </span>
        <h1 className={styles["reservation-details-title"]}>Reservation Details</h1>
      </div>
      <div className={styles["reservation-details-card"]}>
        {/* Header Row Skeleton */}
        <div className={`${styles["skeleton-header-row"]} ${styles["skeleton"]}`}>
          <div className={`${styles["skeleton-facility"]} ${styles["skeleton"]}`}></div>
          <div className={`${styles["skeleton-date"]} ${styles["skeleton"]}`}></div>
        </div>

        {/* Table Rows Skeleton */}
        <div className={styles["reservation-details-table"]}>
          <tbody>
            {Array.from({ length: 11 }).map((_, index) => (
              <tr key={index}>
                <td className={styles["skeleton-table-row"]}>
                  <div className={`${styles["skeleton-label"]} ${styles["skeleton"]}`}></div>
                  <div className={`${styles["skeleton-separator"]} ${styles["skeleton"]}`}></div>
                  <div className={`${styles["skeleton-value"]} ${styles["skeleton"]}`}></div>
                </td>
              </tr>
            ))}
          </tbody>
        </div>

        {/* Status and Print Button Skeleton */}
        <div className={styles["reservation-details-foot"]}>
          <div className={`${styles["skeleton-status-row"]} ${styles["skeleton"]}`}>
            <div className={`${styles["skeleton-status-label"]} ${styles["skeleton"]}`}></div>
            <div className={`${styles["skeleton-status-value"]} ${styles["skeleton"]}`}></div>
          </div>
          <div className={`${styles["skeleton-print-btn"]} ${styles["skeleton"]}`}></div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return <SkeletonLoading />;
  }

  if (!reservation) {
    return (
      <div className={styles["rsv-details-container"]}>
        <div className={styles["rsv-details-header"]}>
          <span
            className={styles["rsv-details-back"]}
            onClick={() => navigate('/reservations', { state: { activeTab: 'Approved' } })}
          >
            &larr;
          </span>
          <h1 className={styles["rsv-details-title"]}>Reservation Details</h1>
        </div>
        <div className={styles["rsv-details-card"]}>
          <p>{error || "Reservation not found."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles["reservation-details-container"]}>
      <div className={styles["reservation-details-header"]}>
        <span
          className={styles["reservation-details-back"]}
          onClick={() => navigate('/reservations', { state: { activeTab: 'Approved' } })}
        >
          &larr;
        </span>
        <h1 className={styles["reservation-details-title"]}>Reservation Details</h1>
      </div>
      <div className={styles["reservation-details-card"]}>
        <div className={styles["reservation-details-row"]}>
          <span className={styles["reservation-details-facility"]}>
            {reservation.facilityType || "N/A"}
          </span>
          <span className={styles["reservation-details-date"]}>
            {formatDateLong(reservation.dateOfArrival)}
          </span>
        </div>
        <table className={styles["reservation-details-table"]}>
          <tbody>
            <tr>
              <td className={styles["reservation-details-label"]}>Group/Association</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.guestName || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Address</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.homeAddress || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Office Address</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.officeAddress || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Category</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.category || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Phone No.</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.telephone || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Office Telephone No.</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.officeTelephone || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Number of Guests</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation?.numberOfGuests?.total ?? "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Emergency Contact</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.emergencyContact || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Date of Arrival</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{formatDateLong(reservation.dateOfArrival)}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Date of Departure</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{formatDateLong(reservation.dateOfDeparture)}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Type of Facility</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.facilityType || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Facility Name</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.facilityName || reservation.facilityType || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Type of Service</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.serviceType || "N/A"}</td>
            </tr>
            {reservation.guestType !== "Individual" && (
              <tr>
                <td className={styles["reservation-details-label"]}>Letter of Intent</td>
                <td className={styles["reservation-details-separator"]}>:</td>
                <td>
                  <a
                    href={reservation.letterOfIntentFile || "#"}
                    className={styles["reservation-details-link"]}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Click to open
                  </a>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className={styles["reservation-details-foot"]}>
          <div className={styles["reservation-details-status-row"]}>
          <span className={styles["reservation-details-status-label"]}>Status:</span>
          <span className={styles["reservation-details-status-value"]}>
            {reservation.status || "N/A"}
          </span>
        </div>
        {reservation.guestType !== "Individual" && (
          <button
            className={styles["reservation-details-print-btn"]}
            onClick={() => {
              if (!reservation.letterOfIntentFile) {
                alert("No Letter of Intent uploaded.");
                return;
              }
              window.open(reservation.letterOfIntentFile, "_blank");
            }}
          >
            <span className={styles["reservation-details-print-icon"]}>🖨️</span> PRINT LETTER OF INTENT
          </button>
        )}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import styles from "./ReservationDetails.module.css";
import { getReservationById } from "../../apis/reservationApi";

function formatDateLong(dateStr) {
  if (!dateStr) return "N/A";
  try {
    // Parse date string to extract date components (avoid timezone issues)
    const datePart = String(dateStr).split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        // Create date in local timezone using date components
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
      }
    }
    // Fallback to regular parsing
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "N/A";
    // Use UTC methods to avoid timezone shifts
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const day = d.getUTCDate();
    const localDate = new Date(year, month, day);
    return localDate.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  } catch (e) {
    return "N/A";
  }
}

function prettifyServiceType(svc) {
  if (!svc) return "N/A";
  return String(svc)
    .split(/([\/\s])/)
    .map((w) =>
      w.match(/[a-z]/i) ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w
    )
    .join("");
}

export default function ApprovedRSVDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { filters, searchQuery, currentPage } = location.state || {};
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

  // Helper function to determine which documents should be shown
  const getRequiredDocuments = () => {
    if (!reservation) {
      return {
        showMoa: false, showCaf: false, showLetterOfIntent: false,
        showGovId: false, showDepEdId: false, showPwdId: false, showScId: false,
        discountNote: null,
      };
    }

    const isGroup = reservation.guestType !== "Individual";
    const cat = (reservation.category || "").toLowerCase();
    const has = (k) => cat.includes(k);

    const hasSenior = has("senior");
    const showGovId = has("government");
    const showDepEdId = has("deped");
    const showPwdId = has("pwd");

    // Groups only: MOA, CAF, Letter of Intent
    const showMoa = isGroup;
    const showCaf = isGroup;
    const showLetterOfIntent = isGroup;

    // If Senior + another discounted category, show only that category's ID and a note
    const hasDiscountId = showGovId || showDepEdId || showPwdId;
    const discountNote = hasSenior && hasDiscountId ? "Note: Only one type of discount applies." : null;

    // Show SC ID only if senior is present and no other discounted ID applies
    const showScId = hasSenior && !hasDiscountId;

    return { showMoa, showCaf, showLetterOfIntent, showGovId, showDepEdId, showPwdId, showScId, discountNote };
  };

  const requiredDocs = getRequiredDocuments();

  // Skeleton Loading Component
  const SkeletonLoading = () => (
    <div className={styles["rsv-details-container"]}>
      <div className={styles["rsv-details-header"]}>
        <span className={styles["rsv-details-back"]} onClick={() => navigate('/reservations', { state: { activeTab: 'Approved', filters, searchQuery, currentPage } })}>
          &larr;
        </span>
        <h1 className={styles["rsv-details-title"]}>Reservation Details</h1>
      </div>
      <div className={styles["rsv-details-card"]}>
        {/* Header Row Skeleton */}
        <div className={`${styles["skeleton-header-row"]} ${styles["skeleton"]}`}>
          <div className={`${styles["skeleton-facility"]} ${styles["skeleton"]}`}></div>
          <div className={`${styles["skeleton-date"]} ${styles["skeleton"]}`}></div>
        </div>

        {/* Table Rows Skeleton */}
        <table className={styles["rsv-details-table"]}>
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
        </table>

        {/* Status Skeleton */}
        <div className={styles["rsv-details-foot"]}>
          <div className={`${styles["skeleton-status-row"]} ${styles["skeleton"]}`}>
            <div className={`${styles["skeleton-status-label"]} ${styles["skeleton"]}`}></div>
            <div className={`${styles["skeleton-status-value"]} ${styles["skeleton"]}`}></div>
          </div>
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
            onClick={() => navigate('/reservations', { state: { activeTab: 'Approved', filters, searchQuery, currentPage } })}
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
    <div className={styles["rsv-details-container"]}>
      <div className={styles["rsv-details-header"]}>
        <span
          className={styles["rsv-details-back"]}
          onClick={() => navigate('/reservations', { state: { activeTab: 'Approved', filters, searchQuery, currentPage } })}
        >
          &larr;
        </span>
        <h1 className={styles["rsv-details-title"]}>Reservation Details</h1>
      </div>
      <div className={styles["rsv-details-card"]}>
        <div className={styles["rsv-details-row"]}>
          <span className={styles["rsv-details-facility"]}>
            {reservation.facilityType || "N/A"}
          </span>
          <span className={styles["rsv-details-date"]}>
            {formatDateLong(reservation.dateOfArrival)}
          </span>
        </div>
        <table className={styles["rsv-details-table"]}>
          <tbody>
            <tr>
              <td className={styles["rsv-details-label"]}>Type</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{reservation.guestType || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Group/Association</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{reservation.guestName || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Address</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{reservation.homeAddress || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Office Address</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{reservation.officeAddress || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Category</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{reservation.category || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Phone No.</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{reservation.telephone || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Office Telephone No.</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{reservation.officeTelephone || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Number of Guests</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{reservation?.numberOfGuests?.total ?? "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Emergency Contact</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{reservation.emergencyContact || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Date of Arrival</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{formatDateLong(reservation.dateOfArrival)}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Date of Departure</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{formatDateLong(reservation.dateOfDeparture)}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Type of Facility</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{reservation.facilityType || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Facility Name</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{reservation.facilityName || reservation.facilityType || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Type of Service</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{prettifyServiceType(reservation.serviceType) || "N/A"}</td>
            </tr>

            {/* MOA - only for groups */}
            {requiredDocs.showMoa && (
              <tr>
                <td className={styles["rsv-details-label"]}>MOA</td>
                <td className={styles["rsv-details-separator"]}>:</td>
                <td>
                  {reservation.moaFile ? (
                    <a
                      href={reservation.moaFile}
                      className={styles["rsv-details-link"]}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Click to open
                    </a>
                  ) : (
                    <span className={styles["rsv-details-placeholder"]}>Not uploaded</span>
                  )}
                </td>
              </tr>
            )}

            {/* CAF - only for groups */}
            {requiredDocs.showCaf && (
              <tr>
                <td className={styles["rsv-details-label"]}>CAF</td>
                <td className={styles["rsv-details-separator"]}>:</td>
                <td>
                  {reservation.cafFile ? (
                    <a
                      href={reservation.cafFile}
                      className={styles["rsv-details-link"]}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Click to open
                    </a>
                  ) : (
                    <span className={styles["rsv-details-placeholder"]}>Not uploaded</span>
                  )}
                </td>
              </tr>
            )}

            {/* Letter of Intent - groups only */}
            {requiredDocs.showLetterOfIntent && (
              <tr>
                <td className={styles["rsv-details-label"]}>Letter of Intent</td>
                <td className={styles["rsv-details-separator"]}>:</td>
                <td>
                  {reservation.letterOfIntentFile ? (
                    <a
                      href={reservation.letterOfIntentFile}
                      className={styles["rsv-details-link"]}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Click to open
                    </a>
                  ) : (
                    <span className={styles["rsv-details-placeholder"]}>Not uploaded</span>
                  )}
                </td>
              </tr>
            )}

            {/* Government ID */}
            {requiredDocs.showGovId && (
              <tr>
                <td className={styles["rsv-details-label"]}>Government ID</td>
                <td className={styles["rsv-details-separator"]}>:</td>
                <td>
                  {reservation.governmentIdFile ? (
                    <a
                      href={reservation.governmentIdFile}
                      className={styles["rsv-details-link"]}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Click to open
                    </a>
                  ) : (
                    <span className={styles["rsv-details-placeholder"]}>Not uploaded</span>
                  )}
                </td>
              </tr>
            )}

            {/* DepEd ID */}
            {requiredDocs.showDepEdId && (
              <tr>
                <td className={styles["rsv-details-label"]}>DepEd ID</td>
                <td className={styles["rsv-details-separator"]}>:</td>
                <td>
                  {reservation.depedIdFile ? (
                    <a
                      href={reservation.depedIdFile}
                      className={styles["rsv-details-link"]}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Click to open
                    </a>
                  ) : (
                    <span className={styles["rsv-details-placeholder"]}>Not uploaded</span>
                  )}
                </td>
              </tr>
            )}

            {/* PWD ID */}
            {requiredDocs.showPwdId && (
              <tr>
                <td className={styles["rsv-details-label"]}>PWD ID</td>
                <td className={styles["rsv-details-separator"]}>:</td>
                <td>
                  {reservation.pwdIdFile ? (
                    <a
                      href={reservation.pwdIdFile}
                      className={styles["rsv-details-link"]}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Click to open
                    </a>
                  ) : (
                    <span className={styles["rsv-details-placeholder"]}>Not uploaded</span>
                  )}
                </td>
              </tr>
            )}

            {/* Senior Citizen ID (only if no other discounted ID applies) */}
            {requiredDocs.showScId && (
              <tr>
                <td className={styles["rsv-details-label"]}>Senior Citizen ID</td>
                <td className={styles["rsv-details-separator"]}>:</td>
                <td>
                  {reservation.scIdFile ? (
                    <a
                      href={reservation.scIdFile}
                      className={styles["rsv-details-link"]}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Click to open
                    </a>
                  ) : (
                    <span className={styles["rsv-details-placeholder"]}>Not uploaded</span>
                  )}
                </td>
              </tr>
            )}

            {/* Discount note */}
            {requiredDocs.discountNote && (
              <tr>
                <td colSpan="3" className={styles["rsv-details-note"]}>
                  {requiredDocs.discountNote}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className={styles["rsv-details-foot"]}>
          <div className={`${styles["rsv-details-status-row"]} ${styles.approved}`}>
            <span className={styles["rsv-details-status-label"]}>Status:</span>
            <span className={styles["rsv-details-status-value"]}>
              {reservation.status || "N/A"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
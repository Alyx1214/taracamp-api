import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import styles from "./ReservationDetails.module.css";
import { getReservationById } from "../../apis/reservationApi";

function prettifyServiceType(svc) {
  if (!svc) return "N/A";
  return String(svc)
    .split(/([\/\s])/)
    .map((w) =>
      w.match(/[a-z]/i) ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w
    )
    .join("");
}

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
    if (isNaN(d.getTime())) return "N/A";
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

export default function ConfGroupRSVDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { filters, searchQuery, currentPage, fromCheckInOut, activeTab } = location.state || {};

  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getReservationById(id);
        if (!cancelled) {
          setReservation(res.reservation);
          setError("");
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Reservation not found.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleBack = () => {
    if (fromCheckInOut) {
      navigate('/checkin', { state: { activeTab: activeTab || 'Confirmed', filters } });
    } else {
      navigate('/reservations', { state: { activeTab: 'Confirmed', filters, searchQuery, currentPage } });
    }
  };

  const SkeletonLoading = () => (
    <div className={styles["rsv-details-container"]}>
      <div className={styles["rsv-details-header"]}>
        <span className={styles["rsv-details-back"]} onClick={handleBack}>
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
            {Array.from({ length: 13 }).map((_, index) => (
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

        {/* Divider Skeleton */}
        <div className={`${styles["rsv-details-divider"]} ${styles["skeleton"]}`}></div>

        {/* Payment Table Skeleton */}
        <table className={styles["rsv-details-table"]}>
          <tbody>
            {Array.from({ length: 4 }).map((_, index) => (
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

        {/* Divider Skeleton */}
        <div className={`${styles["rsv-details-divider"]} ${styles["skeleton"]}`}></div>

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

  if (error || !reservation) {
    return (
      <div className={styles["rsv-details-container"]}>
        <div className={styles["rsv-details-header"]}>
          <span className={styles["rsv-details-back"]} onClick={handleBack}>&larr;</span>
          <h1 className={styles["rsv-details-title"]}>Reservation Details</h1>
        </div>
        <div className={styles["rsv-details-card"]}>
          <p>{error || "Reservation not found."}</p>
        </div>
      </div>
    );
  }

  // Determine which documents to display (same rules as Pending/Declined/ConfIndiv)
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

    // Groups: show MOA, CAF, and Letter of Intent
    const showMoa = isGroup;
    const showCaf = isGroup;
    const showLetterOfIntent = isGroup;

    // If Senior + another discounted category (Gov/DepEd/PWD), show only that category's ID and a note.
    const hasDiscountId = showGovId || showDepEdId || showPwdId;
    const discountNote = hasSenior && hasDiscountId ? "Note: Only one type of discount applies." : null;

    // Senior ID shows only when no other discounted ID applies
    const showScId = hasSenior && !hasDiscountId;

    return { showMoa, showCaf, showLetterOfIntent, showGovId, showDepEdId, showPwdId, showScId, discountNote };
  };

  const requiredDocs = getRequiredDocuments();

  return (
    <div className={styles["rsv-details-container"]}>
      <div className={styles["rsv-details-header"]}>
        <span className={styles["rsv-details-back"]} onClick={handleBack}>&larr;</span>
        <h1 className={styles["rsv-details-title"]}>Reservation Details</h1>
      </div>
      <div className={styles["rsv-details-card"]}>
        <div className={styles["rsv-details-row"]}>
          <span className={styles["rsv-details-facility"]}>{reservation.facilityType}</span>
          <span className={styles["rsv-details-date"]}>{formatDateLong(reservation.dateOfArrival)}</span>
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
              <td>{reservation.guestName || reservation.group || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Address</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{reservation.homeAddress || reservation.address || "N/A"}</td>
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
              <td>{reservation.telephone || reservation.phone || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Office Telephone No.</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{reservation.officeTelephone || reservation.officeTel || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Number of Guests</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{reservation.numberOfGuests?.total ?? reservation.guests ?? "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Emergency Contact</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{reservation.emergencyContact || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Date of Arrival</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{formatDateLong(reservation.dateOfArrival) || reservation.arrival}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Date of Departure</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{formatDateLong(reservation.dateOfDeparture) || reservation.departure}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Type of Facility</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{reservation.facilityType || reservation.typeOfFacility || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Facility Name</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{reservation.facilityName || "N/A"}</td>
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

            {/* Letter of Intent - all groups */}
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

            {/* Discount note when Senior + (Gov/DepEd/PWD) */}
            {requiredDocs.discountNote && (
              <tr>
                <td colSpan="3" className={styles["rsv-details-note"]}>
                  {requiredDocs.discountNote}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <hr className={styles["rsv-details-divider"]} />
        <table className={styles["rsv-details-table"]}>
          <tbody>
            <tr>
              <td className={styles["rsv-details-label"]}>Downpayment Amount</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{reservation.downpayment || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Payment Due</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{reservation.paymentDue || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Date of the Transaction</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{reservation.transactionDate || "N/A"}</td>
            </tr>
            <tr>
              <td className={styles["rsv-details-label"]}>Payment Method</td>
              <td className={styles["rsv-details-separator"]}>:</td>
              <td>{reservation.paymentMethod || "N/A"}</td>
            </tr>
          </tbody>
        </table>
        <hr className={styles["rsv-details-divider"]} />
        <div className={styles["rsv-details-foot"]}>
          <div className={`${styles["rsv-details-status-row"]} ${styles.confirmed}`}>
            <span className={styles["rsv-details-status-label"]}>Status:</span>
            <span className={styles["rsv-details-status-value"]}>{reservation.status || "N/A"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
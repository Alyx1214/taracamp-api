import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./PendingRSVDetails.module.css";
import { FaCheck, FaTimes, FaUpload } from "react-icons/fa";
import { getReservationById, uploadNonavailabilityCertificate, decideReservation } from "../../apis/reservationApi";

function formatDateLong(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function PendingRSVDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef();
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const [fileName, setFileName] = React.useState("");

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    setSelectedFile(file);
    setFileName(file ? file.name : "");
  };

  async function onSend() {
    if (!id) return;
    if (!selectedFile) {
      alert("Please choose a file to upload.");
      return;
    }
    try {
      setUploading(true);
      await uploadNonavailabilityCertificate(id, selectedFile);
      alert("Non-Availability Certificate uploaded.");
      // refresh reservation to reflect latest state
      const res = await getReservationById(id);
      if (res?.reservation) setReservation(res.reservation);
      // reset chooser
      try { if (fileInputRef.current) fileInputRef.current.value = ""; } catch {}
      setSelectedFile(null);
      setFileName("");
    } catch (e) {
      alert(e?.message || "Failed to upload Non-Availability Certificate");
    } finally {
      setUploading(false);
    }
  }

  async function onApprove() {
    if (!id) return;
    try {
      setSubmitting(true);
      await decideReservation(id, "Approved");
      alert("Reservation approved.");
      navigate(-1);
    } catch (e) {
      alert(e?.message || "Failed to approve reservation");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDecline() {
    if (!id) return;
    try {
      setSubmitting(true);
      await decideReservation(id, "Declined");
      alert("Reservation declined.");
      navigate(-1);
    } catch (e) {
      alert(e?.message || "Failed to decline reservation");
    } finally {
      setSubmitting(false);
    }
  }

  const hasNonAvailability = !!reservation?.hasNonAvailabilityCert || !!reservation?.nonAvailabilityCertFile;

  // Skeleton Loading Component
  const SkeletonLoading = () => (
    <div className={styles["reservation-details-container"]}>
      <div className={styles["reservation-details-header"]}>
        <span className={styles["reservation-details-back"]} onClick={() => navigate('/reservations', { state: { activeTab: 'Pending' } })}>
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
            {Array.from({ length: 12 }).map((_, index) => (
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

        {/* Status and Actions Skeleton */}
        <div className={styles["reservation-details-foot"]}>
          <div className={`${styles["skeleton-status-row"]} ${styles["skeleton"]}`}>
            <div className={`${styles["skeleton-status-label"]} ${styles["skeleton"]}`}></div>
            <div className={`${styles["skeleton-status-value"]} ${styles["skeleton"]}`}></div>
          </div>
          <div className={styles["skeleton-actions"]}>
            <div className={`${styles["skeleton-decline-btn"]} ${styles["skeleton"]}`}></div>
            <div className={`${styles["skeleton-approve-btn"]} ${styles["skeleton"]}`}></div>
          </div>
        </div>

        {/* Upload Section Skeleton */}
        <div className={styles["skeleton-upload-section"]}>
          <div className={`${styles["skeleton-upload-label"]} ${styles["skeleton"]}`}></div>
          <div className={`${styles["skeleton-upload-desc"]} ${styles["skeleton"]}`}></div>
          <div className={styles["skeleton-upload-row"]}>
            <div className={`${styles["skeleton-upload-btn"]} ${styles["skeleton"]}`}></div>
            <div className={`${styles["skeleton-send-btn"]} ${styles["skeleton"]}`}></div>
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
              onClick={() => navigate('/reservations', { state: { activeTab: 'Pending' } })}
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
          onClick={() => navigate('/reservations', { state: { activeTab: 'Pending' } })}
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
            <tr>
              <td className={styles["reservation-details-label"]}>Non-Availability Certificate</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>
                {reservation.nonAvailabilityCertFile ? (
                  <a
                    href={reservation.nonAvailabilityCertFile}
                    className={styles["reservation-details-link"]}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Click to open
                  </a>
                ) : hasNonAvailability ? (
                  "On file"
                ) : (
                  "N/A"
                )}
              </td>
            </tr>
          </tbody>
        </table>
        <div className={styles["reservation-details-foot"]}>
          <div className={styles["reservation-details-status-row"]}>
            <span className={styles["reservation-details-status-label"]}>Status:</span>
            <span className={styles["reservation-details-status-value-pending"]}>
              {reservation.status || "N/A"}
            </span>
          </div>
          <div className={styles["reservation-details-action-row"]}>
            <button
              className={styles["reservation-details-decline-btn"]}
              onClick={onDecline}
              disabled={submitting}
            >
              <FaTimes className={styles["reservation-details-action-icon"]} />
              DECLINE
            </button>
            {!hasNonAvailability && (
              <button
                className={styles["reservation-details-approve-btn"]}
                onClick={onApprove}
                disabled={submitting}
              >
                <FaCheck className={styles["reservation-details-action-icon"]} />
                {submitting ? "PROCESSING…" : "APPROVE"}
              </button>
            )}
          </div>
        </div>
        {!hasNonAvailability && (
          <div className={styles["reservation-details-upload-section"]}>
              <div className={styles["reservation-details-upload-label"]}>
                Upload Certificate Of Non-Availability
              </div>
              <div className={styles["reservation-details-upload-desc"]}>
                Applicable Only For Declining A Reservation
              </div>
              <div className={styles["reservation-details-upload-row"]}>
                <input
                  type="file"
                  id="upload"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                <label
                  htmlFor="upload"
                  className={styles["reservation-details-upload-btn"]}
                  tabIndex={0}
                  onKeyPress={e => {
                    if (e.key === "Enter" || e.key === " ") fileInputRef.current.click();
                  }}
                >
                  {fileName ? fileName : "Click to upload"}
                  <FaUpload className={styles["reservation-details-upload-icon"]} />
                </label>
                <button
                  className={styles["reservation-details-send-btn"]}
                  onClick={onSend}
                  disabled={uploading || !selectedFile}
                >
                  {uploading ? "Uploading…" : "Send"}
                </button>
              </div>
            </div>
        )}
      </div>
    </div>
  );
}

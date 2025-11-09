import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styles from "./ReservationDetail.module.css";
import {
  getReservationById,
  decideReservation,
  uploadNonavailabilityCertificate,
} from "../../apis/reservationApi";
import ConfirmModal from "../Shared/ConfirmModal";

function fmtDateLong(dateStr) {
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
        return date.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
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
    return localDate.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (e) {
    return "N/A";
  }
}

function fmtServiceType(svc) {
  if (!svc) return "N/A";
  const s = String(svc).toUpperCase();
  if (s.includes("ACCOMMODATION")) return "Lodging";
  return "Event";
}

function StatusBadge({ status }) {
  const text = status ?? "N/A";
  const cls =
    text === "APPROVED"
      ? styles["reservation-status-approved"]
      : text === "DECLINED"
      ? styles["reservation-status-declined"]
      : text === "PENDING"
      ? styles["reservation-status-pending"]
      : styles["reservation-status-generic"];
  return <div className={`${styles["reservation-status-badge"]} ${cls}`}>{text}</div>;
}

export default function ReservationDetails() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [resv, setResv] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [hasApprovalDoc, setHasApprovalDoc] = useState(false);
  const [approveError, setApproveError] = useState("");
  const uploadRef = useRef(null);

  // Check if user can approve/decline (only Superintendent)
  const role = (typeof window !== 'undefined' && localStorage.getItem('userRole')) || '';
  const canApproveDecline = role === 'SUPERINTENDENT';

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        const data = await getReservationById(id);
        if (cancel) return;
        const r = data?.reservation ?? null;
        setResv(r);
        setHasApprovalDoc(!!r?.approvalDocumentFile);
      } catch (e) {
        if (!cancel) setErr(e?.message || "Failed to fetch reservation");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [id]);

  function promptDecline() {
    if (!id) return;
    setConfirmOpen(true);
  }

  async function doDecline() {
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
      setConfirmOpen(false);
    }
  }

  async function onApprove() {
    if (!id) return;
    if (!hasApprovalDoc) {
      setApproveError("Please upload the Non-Availability Certificate before approving.");
      try {
        uploadRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {}
      return;
    }
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

  async function onUpload() {
    if (!id || !file) {
      alert("Choose a file first.");
      return;
    }
    try {
      setUploading(true);
      await uploadNonavailabilityCertificate(id, file);
      setHasApprovalDoc(true);
      setApproveError("");
      alert("Non-Availability Certificate uploaded.");
    } catch (e) {
      alert(e?.message || "Failed to upload Non-Availability Certificate");
    } finally {
      setUploading(false);
    }
  }

  const counts = useMemo(() => {
    const n = resv?.numberOfGuests || {};
    const total = n?.total ?? 0;
    return total;
  }, [resv]);

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;
  if (err) return <div style={{ padding: 16, color: "crimson" }}>{String(err)}</div>;
  if (!resv) return <div style={{ padding: 16 }}>Reservation not found.</div>;

  return (
    <div className={styles["reservation-page"]}>
      {/* Header */}
      <div className={styles["reservation-header"]}>
        <button className={styles["reservation-back"]} onClick={() => navigate(-1)}>
          ←
        </button>
        <h1 className={styles["reservation-title"]}>Reservation Details</h1>
      </div>

      {/* Banner */}
      <div className={styles["reservation-banner"]}>
        <div className={styles["reservation-banner-title"]}>
          {resv.facilityType || "N/A"}
        </div>
        <div className={styles["reservation-banner-date"]}>
          {fmtDateLong(resv.dateOfArrival)}
        </div>
      </div>

      {/* Grid of details */}
      <div className={styles["reservation-grid"]}>
        <div className={styles["reservation-label"]}>Group/Association</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>{resv.guestName || "N/A"}</div>

        <div className={styles["reservation-label"]}>Address</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>{resv.homeAddress || "N/A"}</div>

        <div className={styles["reservation-label"]}>Office Address</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>
          {resv.officeAddress || "N/A"}
        </div>

        <div className={styles["reservation-label"]}>Category</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>{resv.category || "N/A"}</div>

        <div className={styles["reservation-label"]}>Phone No.</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>{resv.telephone || "N/A"}</div>

        <div className={styles["reservation-label"]}>Office Telephone No.</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>
          {resv.officeTelephone || "N/A"}
        </div>

        <div className={styles["reservation-label"]}>Number of Guests</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>{counts}</div>

        <div className={styles["reservation-label"]}>Emergency Contact</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>{resv.emergencyContact || "N/A"}</div>

        <div className={styles["reservation-label"]}>Date of Arrival</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>{fmtDateLong(resv.dateOfArrival)}</div>

        <div className={styles["reservation-label"]}>Date of Departure</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>{fmtDateLong(resv.dateOfDeparture)}</div>

        <div className={styles["reservation-label"]}>Type of Facility</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>{resv.facilityType || "N/A"}</div>

        <div className={styles["reservation-label"]}>Type of Service</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>{fmtServiceType(resv.serviceType)}</div>

        <div className={styles["reservation-label"]}>Letter of Intent</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>
          {resv.letterOfIntentFile ? (
            <a href={resv.letterOfIntentFile} target="_blank" rel="noreferrer">
              View Document
            </a>
          ) : (
            "N/A"
          )}
        </div>

        <div className={styles["reservation-label"]}>Non-Availability Certificate</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>
          {resv.approvalDocumentFile ? (
            <a href={resv.approvalDocumentFile} target="_blank" rel="noreferrer">
              View Approval
            </a>
          ) : (
            "N/A"
          )}
        </div>
      </div>

      {/* Status */}
      <div className={styles["reservation-status-line"]}>
        <div className={styles["reservation-label"]}>Status</div>
        <div className={styles["reservation-colon"]}>:</div>
        <StatusBadge status={resv.status} />
      </div>

      {/* Actions */}
      {canApproveDecline && (
        <div className={styles["reservation-actions"]}>
          <button
            className={`${styles["reservation-btn"]} ${styles["reservation-btn-decline"]}`}
            onClick={promptDecline}
            disabled={submitting}
          >
            Decline
          </button>
          <button
            className={`${styles["reservation-btn"]} ${styles["reservation-btn-approve"]}`}
            onClick={onApprove}
            disabled={submitting}
          >
            {submitting ? "Approving…" : "Approve"}
          </button>
        </div>
      )}

      {/* Decline confirm */}
      <ConfirmModal
        open={confirmOpen}
        title="Decline Reservation"
        message="Are you sure you want to decline this reservation?"
        confirmText="Decline"
        cancelText="Cancel"
        confirming={submitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={doDecline}
      />

      {/* Upload approval doc */}
      <div className={styles["reservation-upload-wrap"]} ref={uploadRef}>
        <div className={styles["reservation-upload-title"]}>Upload Non-Availability Certificate</div>
        <div className={styles["reservation-upload-note"]}>PDF, DOC, DOCX (max 5MB)</div>
        <div className={styles["reservation-upload-row"]}>
          <input
            type="file"
            className={styles["reservation-file"]}
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              setFile(f);
              if (f) setApproveError("");
            }}
          />
          <button
            className={styles["reservation-send"]}
            onClick={onUpload}
            disabled={uploading || !file}
          >
            {uploading ? "Uploading…" : "Send"}
          </button>
        </div>
        {approveError ? (
          <div className={styles["reservation-upload-error"]} role="alert" aria-live="assertive">
            {approveError}
          </div>
        ) : null}
        {hasApprovalDoc ? (
          <div className={styles["reservation-upload-success"]}>
            ✅ Non-Availability Certificate on file.
          </div>
        ) : (
          <div className={styles["reservation-upload-warning"]}>
            ⚠️ Non-Availability Certificate required before approval.
          </div>
        )}
      </div>
    </div>
  );
}

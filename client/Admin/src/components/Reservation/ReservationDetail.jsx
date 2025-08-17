import React from "react";
import { useNavigate } from "react-router-dom";
import styles from "./ReservationDetail.module.css"; 

export default function ReservationDetail() {
  const navigate = useNavigate();

  return (
    <div className={styles["reservation-page"]}>
      <div className={styles["reservation-header"]}>
        <button className={styles["reservation-back"]} onClick={() => navigate(-1)}>
          ←
        </button>
        <h1 className={styles["reservation-title"]}>Reservation Details</h1>
      </div>

      <div className={styles["reservation-banner"]}>
        <div className={styles["reservation-banner-title"]}>Cottage</div>
        <div className={styles["reservation-banner-date"]}>08/17/2025</div>
      </div>

      <div className={styles["reservation-grid"]}>
        <div className={styles["reservation-label"]}>Group/Association</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>ABC Organization</div>

        <div className={styles["reservation-label"]}>Address</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>123 Sample Street</div>

        <div className={styles["reservation-label"]}>Office Address</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>456 Corporate Avenue</div>

        <div className={styles["reservation-label"]}>Category</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>Government</div>

        <div className={styles["reservation-label"]}>Phone No.</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>09123456789</div>

        <div className={styles["reservation-label"]}>Office Telephone No.</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>(074) 123-4567</div>

        <div className={styles["reservation-label"]}>Number of Guests</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>50</div>

        <div className={styles["reservation-label"]}>Emergency Contact</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>Jane Doe - 0987654321</div>

        <div className={styles["reservation-label"]}>Date of Arrival</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>Aug 25, 2025</div>

        <div className={styles["reservation-label"]}>Date of Departure</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>Aug 28, 2025</div>

        <div className={styles["reservation-label"]}>Type of Facility</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>Conference Hall</div>

        <div className={styles["reservation-label"]}>Type of Service</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>Lodging + Meals</div>

        <div className={styles["reservation-label"]}>Letter of Intent</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-value"]}>
          <a href="#">View Document</a>
        </div>
      </div>

      <div className={styles["reservation-status-line"]}>
        <div className={styles["reservation-label"]}>Status</div>
        <div className={styles["reservation-colon"]}>:</div>
        <div className={styles["reservation-status-badge"]}>Pending</div>
      </div>

      <div className={styles["reservation-actions"]}>
        <button className={`${styles["reservation-btn"]} ${styles["reservation-btn-decline"]}`}>
          Decline
        </button>
        <button className={`${styles["reservation-btn"]} ${styles["reservation-btn-approve"]}`}>
          Approve
        </button>
      </div>

      <div className={styles["reservation-upload-wrap"]}>
        <div className={styles["reservation-upload-title"]}>Upload Approval Document</div>
        <div className={styles["reservation-upload-note"]}>PDF, JPG, or PNG (max 5MB)</div>
        <div className={styles["reservation-upload-row"]}>
          <input type="file" className={styles["reservation-file"]} />
          <button className={styles["reservation-send"]}>Send</button>
        </div>
      </div>
    </div>
  );
}

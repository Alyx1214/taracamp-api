import React, { useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./PendingRSVDetails.module.css";
import { FaCheck, FaTimes, FaUpload } from "react-icons/fa";

// Sample data
const reservations = [
  {
  id: "0508",
  facilityType: "Cottage",
  date: "08/17/2025",
  group: "DepEd Ilocos Sur",
  address: "Bantay, Ilocos Sur",
  officeAddress: "Quirino Boulevard, Zone V, Bantay, Ilocos Sur",
  category: "DepEd",
  phone: "0915 403 2025",
  officeTel: "(077) 1536 9851",
  guests: "120",
  emergencyContact: "0941 256 4578",
  arrival: "September 17, 2025",
  departure: "September 20, 2025",
  typeOfFacility: "Cottage",
  facilityName: "Quirino Conf Hall",
  serviceType: "Lodging",
  letterOfIntent: "#", // link to document
  status: "Pending",
  },
];

export default function PendingRSVDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef();
  const reservation = reservations.find((r) => r.id === id);

  // File upload state (optional, for UI feedback)
  const [fileName, setFileName] = React.useState("");

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setFileName(e.target.files[0].name);
    } else {
      setFileName("");
    }
  };

  if (!reservation) {
      return (
        <div className={styles["rsv-details-container"]}>
          <div className={styles["rsv-details-header"]}>
            <span
              className={styles["rsv-details-back"]}
              onClick={() => navigate(-1)}
            >
              &larr;
            </span>
            <h1 className={styles["rsv-details-title"]}>Reservation Details</h1>
          </div>
          <div className={styles["rsv-details-card"]}>
            <p>Reservation not found.</p>
          </div>
        </div>
      );
    }

  return (
    <div className={styles["reservation-details-container"]}>
      <div className={styles["reservation-details-header"]}>
        <span
          className={styles["reservation-details-back"]}
          onClick={() => navigate(-1)}
        >
          &larr;
        </span>
        <h1 className={styles["reservation-details-title"]}>Reservation Details</h1>
      </div>
      <div className={styles["reservation-details-card"]}>
        <div className={styles["reservation-details-row"]}>
          <span className={styles["reservation-details-facility"]}>
            {reservation.facilityType}
          </span>
          <span className={styles["reservation-details-date"]}>
            {reservation.date}
          </span>
        </div>
        <table className={styles["reservation-details-table"]}>
          <tbody>
            <tr>
              <td className={styles["reservation-details-label"]}>Group/Association</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.group}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Address</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.address}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Office Address</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.officeAddress}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Category</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.category}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Phone No.</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.phone}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Office Telephone No.</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.officeTel}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Number of Guests</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.guests}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Emergency Contact</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.emergencyContact}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Date of Arrival</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.arrival}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Date of Departure</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.departure}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Type of Facility</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.typeOfFacility}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Facility Name</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.facilityName}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Type of Service</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>{reservation.serviceType}</td>
            </tr>
            <tr>
              <td className={styles["reservation-details-label"]}>Letter of Intent</td>
              <td className={styles["reservation-details-separator"]}>:</td>
              <td>
                <a
                  href={reservation.letterOfIntent}
                  className={styles["reservation-details-link"]}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Click to open
                </a>
              </td>
            </tr>
          </tbody>
        </table>
        <div className={styles["reservation-details-foot"]}>
          <div className={styles["reservation-details-status-row"]}>
            <span className={styles["reservation-details-status-label"]}>Status:</span>
            <span className={styles["reservation-details-status-value-pending"]}>
              {reservation.status}
            </span>
          </div>
          <div className={styles["reservation-details-action-row"]}>
            <button className={styles["reservation-details-decline-btn"]}>
              <FaTimes className={styles["reservation-details-action-icon"]} />
              DECLINE
            </button>
            <button className={styles["reservation-details-approve-btn"]}>
              <FaCheck className={styles["reservation-details-action-icon"]} />
              APPROVE
            </button>
          </div>
        </div>
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
              <button className={styles["reservation-details-send-btn"]}>
                Send
              </button>
            </div>
          </div>
      </div>
    </div>
  );
}

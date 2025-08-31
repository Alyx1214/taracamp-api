import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./ConfIndivRSVDetails.module.css";

// Sample data
const reservations = [
  {
    id: "0508",
    facilityType: "Dormitories",
    date: "08/17/2025",
    group: "DepEd Ilocos Sur",
    address: "Bantay, Ilocos Sur",
    officeAddress: "Quirino Boulevard, Zone V, Bantay, Ilocos Sur",
    category: "Private Individual",
    phone: "0915 403 2025",
    officeTel: "(077) 1536 9851",
    guests: "8",
    emergencyContact: "0941 256 4578",
    arrival: "July 24, 2025",
    departure: "July 25, 2025",
    typeOfFacility: "Dormitories",
    facilityName: "Quirino Hall",
    serviceType: "Lodging",
    downpayment: "₱1,200.00",
    paymentDue: "June 24, 2025",
    transactionDate: "June 01, 2025",
    paymentMethod: "Bank Transfer",
    status: "Confirmed",
    foodPreferences: "Guest Food Preferences",
  },
  
];

export default function ConfIndivRSVDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const reservation = reservations.find((r) => r.id === id);

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
            <div className={styles["rsv-details-row"]}>
                <span className={styles["rsv-details-facility"]}>
                    {reservation.facilityType}
                </span>
                <span className={styles["rsv-details-date"]}>{reservation.date}</span>
            </div>
            <table className={styles["rsv-details-table"]}>
                <tbody>
                    <tr>
                        <td className={styles["rsv-details-label"]}>Group/Association</td>
                        <td className={styles["rsv-details-separator"]}>:</td>
                        <td>{reservation.group}</td>
                    </tr>
                    <tr>
                        <td className={styles["rsv-details-label"]}>Address</td>
                        <td className={styles["rsv-details-separator"]}>:</td>
                        <td>{reservation.address}</td>
                    </tr>
                    <tr>
                        <td className={styles["rsv-details-label"]}>Office Address</td>
                        <td className={styles["rsv-details-separator"]}>:</td>
                        <td>{reservation.officeAddress}</td>
                    </tr>
                    <tr>
                        <td className={styles["rsv-details-label"]}>Category</td>
                        <td className={styles["rsv-details-separator"]}>:</td>
                        <td>{reservation.category}</td>
                    </tr>
                    <tr>
                        <td className={styles["rsv-details-label"]}>Phone No.</td>
                        <td className={styles["rsv-details-separator"]}>:</td>
                        <td>{reservation.phone}</td>
                    </tr>
                    <tr>
                        <td className={styles["rsv-details-label"]}>Office Telephone No.</td>
                        <td className={styles["rsv-details-separator"]}>:</td>
                        <td>{reservation.officeTel}</td>
                    </tr>
                    <tr>
                        <td className={styles["rsv-details-label"]}>Number of Guests</td>
                        <td className={styles["rsv-details-separator"]}>:</td>
                        <td>{reservation.guests}</td>
                    </tr>
                    <tr>
                        <td className={styles["rsv-details-label"]}>Emergency Contact</td>
                        <td className={styles["rsv-details-separator"]}>:</td>
                        <td>{reservation.emergencyContact}</td>
                    </tr>
                    <tr>
                        <td className={styles["rsv-details-label"]}>Date of Arrival</td>
                        <td className={styles["rsv-details-separator"]}>:</td>
                        <td>{reservation.arrival}</td>
                    </tr>
                    <tr>
                        <td className={styles["rsv-details-label"]}>Date of Departure</td>
                        <td className={styles["rsv-details-separator"]}>:</td>
                        <td>{reservation.departure}</td>
                    </tr>
                    <tr>
                        <td className={styles["rsv-details-label"]}>Type of Facility</td>
                        <td className={styles["rsv-details-separator"]}>:</td>
                        <td>{reservation.typeOfFacility}</td>
                    </tr>
                    <tr>
                        <td className={styles["rsv-details-label"]}>Facility Name</td>
                        <td className={styles["rsv-details-separator"]}>:</td>
                        <td>{reservation.facilityName}</td>
                    </tr>
                    <tr>
                        <td className={styles["rsv-details-label"]}>Type of Service</td>
                        <td className={styles["rsv-details-separator"]}>:</td>
                        <td>{reservation.serviceType}</td>
                    </tr>
                </tbody>
            </table>
            <hr className={styles["rsv-details-divider"]} />
            <table className={styles["rsv-details-table"]}>
                <tbody>
                    <tr>
                        <td className={styles["rsv-details-label"]}>Downpayment Amount</td>
                        <td className={styles["rsv-details-separator"]}>:</td>
                        <td>{reservation.downpayment}</td>
                    </tr>
                    <tr>
                        <td className={styles["rsv-details-label"]}>Payment Due</td>
                        <td className={styles["rsv-details-separator"]}>:</td>
                        <td>{reservation.paymentDue}</td>
                    </tr>
                    <tr>
                        <td className={styles["rsv-details-label"]}>Date of the Transaction</td>
                        <td className={styles["rsv-details-separator"]}>:</td>
                        <td>{reservation.transactionDate}</td>
                    </tr>
                    <tr>
                        <td className={styles["rsv-details-label"]}>Payment Method</td>
                        <td className={styles["rsv-details-separator"]}>:</td>
                        <td>{reservation.paymentMethod}</td>
                    </tr>
                </tbody>
            </table>
            <hr className={styles["rsv-details-divider"]} />
            <div className={styles["rsv-details-status-row"]}>
                <span className={styles["rsv-details-status-label"]}>Status:</span>
                <span className={styles["rsv-details-status-value"]}>{reservation.status}</span>
            </div>
            <div className={styles["rsv-details-link"]}>
                <button
                    className={styles["rsv-details-food-link"]}
                    onClick={() => navigate(`/reservation/${reservation.id}/food-preferences`)}
                >
                    {reservation.foodPreferences}
                </button>
            </div>
        </div>
    </div>
);
}
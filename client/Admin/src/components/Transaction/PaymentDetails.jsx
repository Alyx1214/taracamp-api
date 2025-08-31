import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./PaymentDetails.module.css";

// Sample data
const payments = [
  {
    id: "0508",
    referenceNumber: "0000002",
    name: "Tom John",
    confirmationFee: "₱1,200.00",
    breakdown: [
      { label: "Quirino Conf Hall", amount: "12,000.00" },
      { label: "Food", amount: "5,000.00" },
      { label: "Table Cloth", amount: "390.00" },
      { label: "Seat Cover", amount: "2,000.00" },
      { label: "LED Wall", amount: "1,800.00" },
    ],
    discount: "None",
    discountAmount: "00.00",
    total: "₱ 19,990.00",
    status: "Not Paid",
  },
];

export default function PaymentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const payment = payments.find((p) => p.id === id);

  if (!payment) {
    return (
      <div className={styles["payment-details-container"]}>
        <div className={styles["payment-details-header"]}>
          <span
            className={styles["payment-details-back"]}
            onClick={() => navigate(-1)}
            style={{ cursor: "pointer" }}
          >
            &larr;
          </span>
          <h1 className={styles["payment-details-title"]}>Payment Details</h1>
        </div>
        <div className={styles["payment-details-card"]}>
          <p>Payment not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles["payment-details-container"]}>
      <div className={styles["payment-details-header"]}>
        <span
          className={styles["payment-details-back"]}
          onClick={() => navigate(-1)}
        >
          &larr;
        </span>
        <h1 className={styles["payment-details-title"]}>Payment Details</h1>
      </div>
      <div className={styles["payment-details-card"]}>
        <table className={styles["payment-details-table"]}>
          <tbody>
            <tr>
              <td className={styles["payment-details-label"]}>Reference Number</td>
              <td className={styles["payment-details-separator"]}>:</td>
              <td>{payment.referenceNumber}</td>
            </tr>
            <tr>
              <td className={styles["payment-details-label"]}>Name</td>
              <td className={styles["payment-details-separator"]}>:</td>
              <td>{payment.name}</td>
            </tr>
            <tr>
              <td className={styles["payment-details-label"]}>Confirmation Fee</td>
              <td className={styles["payment-details-separator"]}>:</td>
              <td>{payment.confirmationFee}</td>
            </tr>
          </tbody>
        </table>
        <hr className={styles["payment-details-divider"]} />
        <div className={styles["payment-details-section-title"]}>Payment Breakdown</div>
        <table className={styles["payment-details-table"]}>
          <tbody>
            {payment.breakdown.map((item, idx) => (
              <tr key={idx}>
                <td className={styles["payment-details-label"]}>{item.label}</td>
                <td className={styles["payment-details-separator"]}>:</td>
                <td>{item.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr className={styles["payment-details-divider"]} />
        <div className={styles["payment-details-section-title"]}>Discount %</div>
        <table className={styles["payment-details-table"]}>
          <tbody>
            <tr>
              <td className={styles["payment-details-label"]}>{payment.discount}</td>
              <td className={styles["payment-details-separator"]}>:</td>
              <td>{payment.discountAmount}</td>
            </tr>
          </tbody>
        </table>
        <hr className={styles["payment-details-divider"]} />
        <div className={styles["payment-details-total-row"]}>
          <span>Total Estimated Amount</span>
          <span className={styles["payment-details-total"]}>{payment.total}</span>
        </div>
        <div className={styles["payment-details-status-row"]}>
          <span className={styles["payment-details-status-label"]}>Status:</span>
          <span className={styles["payment-details-status-value"]}>{payment.status}</span>
        </div>
      </div>
    </div>
  );
}
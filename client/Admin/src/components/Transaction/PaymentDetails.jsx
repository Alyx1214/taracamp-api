import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./PaymentDetails.module.css";
import { getPaymentDetails } from "../../apis/paymentApi"; 

export default function PaymentDetails() {
  const { id: reservationId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [payment, setPayment] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!reservationId) throw new Error("Missing reservation id");
        setLoading(true);
        setError("");

        const res = await getPaymentDetails(reservationId);
        const data = res?.data?.data ?? res?.data ?? res;

        if (!data || typeof data !== "object") {
          throw new Error(res?.error || "Failed to fetch payment details");
        }

        if (!cancelled) setPayment(data);
      } catch (e) {
        if (!cancelled) setError(e?.message || "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [reservationId]);

  const Back = (
    <span
      className={styles["payment-details-back"]}
      onClick={() => navigate(-1)}
      style={{ cursor: "pointer" }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && navigate(-1)}
      aria-label="Go back"
    >
      &larr;
    </span>
  );

  if (loading) {
    return (
      <div className={styles["payment-details-container"]}>
        <div className={styles["payment-details-header"]}>
          {Back}
          <h1 className={styles["payment-details-title"]}>Payment Details</h1>
        </div>
        <div className={styles["payment-details-card"]}>
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className={styles["payment-details-container"]}>
        <div className={styles["payment-details-header"]}>
          {Back}
          <h1 className={styles["payment-details-title"]}>Payment Details</h1>
        </div>
        <div className={styles["payment-details-card"]}>
          <p>{error || "Payment not found."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles["payment-details-container"]}>
      <div className={styles["payment-details-header"]}>
        {Back}
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

import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./TransactionDetails.module.css";
import { getTransactionDetails } from "../../apis/paymentApi";

export default function TransactionDetails() {
  const { id: reservationId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [transaction, setTransaction] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!reservationId) throw new Error("Missing reservation id");
        setLoading(true);
        setError("");
        const res = await getTransactionDetails(reservationId);
        const data = res?.data?.data ?? res?.data ?? res;

        if (!data || typeof data !== "object") {
          throw new Error(res?.error || "Failed to fetch transaction");
        }
		
        const mapped = {
          id: data.id ?? "—",
          referenceNumber: data.referenceNumber.toUpperCase() ?? "N/A",
          name: data.name ?? "—",
          confirmationFee: data.confirmationFee ?? "₱0.00",
          paymentDue: data.paymentDue ?? "—",
          date: data.date ?? "—",
          paymentMethod: data.paymentMethod ?? "—",
          status: data.status ?? "—",
        };

        if (!cancelled) setTransaction(mapped);
      } catch (e) {
        if (!cancelled) setError(e?.message || "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reservationId]);

  // Skeleton Loading Component
  const SkeletonLoading = () => (
    <div className={styles["transaction-details-container"]}>
      <div className={styles["transaction-details-header"]}>
        <span
          className={styles["add-form-back"]}
          onClick={() => navigate('/transactions?tab=Transactions')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && navigate('/transactions?tab=Transactions')}
        >
          &larr;
        </span>
        <h1 className={styles["transaction-details-title"]}>Transaction Details</h1>
      </div>
      <div className={styles["transaction-details-card"]}>
        {/* Table Rows Skeleton */}
        <div className={styles["transaction-details-table"]}>
          <tbody>
            {Array.from({ length: 7 }).map((_, index) => (
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
      </div>
    </div>
  );

  const Back = (
    <span
      className={styles["add-form-back"]}
      onClick={() => navigate('/transactions')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && navigate('/transactions')}
      aria-label="Go back"
    >
      &larr;
    </span>
  );

  if (loading) {
    return <SkeletonLoading />;
  }

  if (error || !transaction) {
    return (
      <div className={styles["transaction-details-container"]}>
        <div className={styles["transaction-details-header"]}>
          {Back}
          <h1 className={styles["transaction-details-title"]}>Transaction Details</h1>
        </div>
        <div className={styles["transaction-details-card"]}>
          <p>{error || "Transaction not found."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles["transaction-details-container"]}>
      <div className={styles["transaction-details-header"]}>
        {Back}
        <h1 className={styles["transaction-details-title"]}>Transaction Details</h1>
      </div>
      <div className={styles["transaction-details-card"]}>
        <table className={styles["transaction-details-table"]}>
          <tbody>
            <tr>
              <td className={styles["transaction-details-label"]}>Reference Number</td>
              <td className={styles["transaction-details-separator"]}>:</td>
              <td>{transaction.referenceNumber}</td>
            </tr>
            <tr>
              <td className={styles["transaction-details-label"]}>Name</td>
              <td className={styles["transaction-details-separator"]}>:</td>
              <td>{transaction.name}</td>
            </tr>
            <tr>
              <td className={styles["transaction-details-label"]}>Confirmation Fee</td>
              <td className={styles["transaction-details-separator"]}>:</td>
              <td>{transaction.confirmationFee}</td>
            </tr>
            <tr>
              <td className={styles["transaction-details-label"]}>Payment Due</td>
              <td className={styles["transaction-details-separator"]}>:</td>
              <td>{transaction.paymentDue}</td>
            </tr>
            <tr>
              <td className={styles["transaction-details-label"]}>Date of the Transaction</td>
              <td className={styles["transaction-details-separator"]}>:</td>
              <td>{transaction.date}</td>
            </tr>
            <tr>
              <td className={styles["transaction-details-label"]}>Payment Method</td>
              <td className={styles["transaction-details-separator"]}>:</td>
              <td>{transaction.paymentMethod}</td>
            </tr>
            <tr>
              <td colSpan={3} className={styles["transaction-details-status-row"]}>
                <span className={styles["transaction-details-status-label"]}>Status:</span>{" "}
                <span className={`${styles["transaction-details-status-value"]} ${transaction.status === "Fully Paid" ? styles["transaction-details-status-paid"] : ""}`}>
                  {transaction.status}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

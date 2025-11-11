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
          id: data.id ?? "N/A",
          referenceNumber: data.referenceNumber?.toUpperCase() ?? "N/A",
          name: data.name ?? "N/A",
          confirmationFee: data.confirmationFee ?? "₱0.00",
          paymentDue: data.paymentDue ?? "N/A",
          date: data.date ?? "N/A",
          paymentMethod: data.paymentMethod ?? "N/A",
          status: data.status ?? "N/A",
          // Report details
          reservationCode: data.reservationCode ?? "N/A",
          facilityUsed: data.facilityUsed ?? "N/A",
          checkInDate: data.checkInDate ?? "N/A",
          checkOutDate: data.checkOutDate ?? "N/A",
          numberOfNights: data.numberOfNights ?? 0,
          numberOfGuests: data.numberOfGuests ?? 0,
          category: data.category ?? "N/A",
          checkOutEmployee: data.checkOutEmployee ?? "N/A",
          contactNumber: data.contactNumber ?? "N/A",
          address: data.address ?? "N/A",
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
        <table className={styles["transaction-details-table"]}>
          <tbody>
            {Array.from({ length: 17 }).map((_, index) => (
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
        
        <hr className={styles["transaction-details-divider"]} />
        
        <div className={styles["transaction-details-section-title"]}>Reservation Details</div>
        <table className={styles["transaction-details-table"]}>
          <tbody>
            <tr>
              <td className={styles["transaction-details-label"]}>RF. No.</td>
              <td className={styles["transaction-details-separator"]}>:</td>
              <td>{transaction.reservationCode}</td>
            </tr>
            <tr>
              <td className={styles["transaction-details-label"]}>Facility Used</td>
              <td className={styles["transaction-details-separator"]}>:</td>
              <td>{transaction.facilityUsed}</td>
            </tr>
            <tr>
              <td className={styles["transaction-details-label"]}>Check-in Date</td>
              <td className={styles["transaction-details-separator"]}>:</td>
              <td>{transaction.checkInDate}</td>
            </tr>
            <tr>
              <td className={styles["transaction-details-label"]}>Check-out Date</td>
              <td className={styles["transaction-details-separator"]}>:</td>
              <td>{transaction.checkOutDate}</td>
            </tr>
            <tr>
              <td className={styles["transaction-details-label"]}>No. of Nights</td>
              <td className={styles["transaction-details-separator"]}>:</td>
              <td>{transaction.numberOfNights}</td>
            </tr>
            <tr>
              <td className={styles["transaction-details-label"]}>No. of Guests</td>
              <td className={styles["transaction-details-separator"]}>:</td>
              <td>{transaction.numberOfGuests}</td>
            </tr>
            <tr>
              <td className={styles["transaction-details-label"]}>Category</td>
              <td className={styles["transaction-details-separator"]}>:</td>
              <td>{transaction.category}</td>
            </tr>
            <tr>
              <td className={styles["transaction-details-label"]}>C/O Employee</td>
              <td className={styles["transaction-details-separator"]}>:</td>
              <td>{transaction.checkOutEmployee}</td>
            </tr>
            <tr>
              <td className={styles["transaction-details-label"]}>Contact No.</td>
              <td className={styles["transaction-details-separator"]}>:</td>
              <td>{transaction.contactNumber}</td>
            </tr>
            <tr>
              <td className={styles["transaction-details-label"]}>Address</td>
              <td className={styles["transaction-details-separator"]}>:</td>
              <td>{transaction.address}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React from "react";
import styles from "./TransactionDetails.module.css";

const transaction = {
    referenceNumber: "202405068742",
    name: "Tom John",
    confirmationFee: "₱1,200.00",
    paymentDue: "0941 256 4578",
    date: "June 01, 2025",
    paymentMethod: "Bank Transfer",
    status: "Confirmed",
};

export default function TransactionDetails() {
    return (
        <div className={styles["transaction-details-container"]}>
            <div className={styles["transaction-details-header"]}>
                <span className={styles["transaction-details-back"]}>&larr;</span>
                <h1 className={styles["transaction-details-title"]}>
                    Transaction Details
                </h1>
            </div>
            <div className={styles["transaction-details-card"]}>
                <table className={styles["transaction-details-table"]}>
                    <tbody>
                        <tr>
                            <td className={styles["transaction-details-label"]}>
                                Reference Number
                            </td>
                            <td className={styles["transaction-details-separator"]}>
                                :
                            </td>
                            <td>{transaction.referenceNumber}</td>
                        </tr>
                        <tr>
                            <td className={styles["transaction-details-label"]}>Name</td>
                            <td className={styles["transaction-details-separator"]}>:</td>
                            <td>{transaction.name}</td>
                        </tr>
                        <tr>
                            <td className={styles["transaction-details-label"]}>
                                Confirmation Fee
                            </td>
                            <td className={styles["transaction-details-separator"]}>
                                :
                            </td>
                            <td>{transaction.confirmationFee}</td>
                        </tr>
                        <tr>
                            <td className={styles["transaction-details-label"]}>Payment Due</td>
                            <td className={styles["transaction-details-separator"]}>:</td>
                            <td>{transaction.paymentDue}</td>
                        </tr>
                        <tr>
                            <td className={styles["transaction-details-label"]}>
                                Date of the Transaction
                            </td>
                            <td className={styles["transaction-details-separator"]}>
                                :
                            </td>
                            <td>{transaction.date}</td>
                        </tr>
                        <tr>
                            <td className={styles["transaction-details-label"]}>
                                Payment Method
                            </td>
                            <td className={styles["transaction-details-separator"]}>
                                :
                            </td>
                            <td>{transaction.paymentMethod}</td>
                        </tr>
                        <tr>
                            <td colSpan={3} className={styles["transaction-details-status-row"]}>
                                <span className={styles["transaction-details-status-label"]}>
                                    Status:
                                </span>{" "}
                                <span className={styles["transaction-details-status-value"]}>
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

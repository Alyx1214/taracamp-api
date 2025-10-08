import React from "react";
import { useNavigate } from "react-router-dom";
import { FaFileAlt } from "react-icons/fa";
import styles from "./TransactionHeader.module.css";

const TransactionHeader = () => {
  const navigate = useNavigate();

  return (
    <div className={styles["transaction-header__container"]}>
      <h1 className={styles["transaction-header__title"]}>TRANSACTIONS</h1>

      <button
        type="button"
        className={styles["transaction-header__generate"]}
        onClick={() => navigate("/transactions/report")}
        aria-label="Generate report"
      >
        <FaFileAlt className={styles["generate__icon"]} />
        Generate Report
      </button>
    </div>
  );
};

export default TransactionHeader;
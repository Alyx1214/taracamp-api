import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaFileAlt } from "react-icons/fa";
import styles from "./TransactionHeader.module.css";
import GenerateReport from "./GenerateReport";

const TransactionHeader = () => {
  const navigate = useNavigate();
  const [showReportModal, setShowReportModal] = useState(false);

  return (
    <>
      <div className={styles["transaction-header__container"]}>
        <h1 className={styles["transaction-header__title"]}>TRANSACTIONS</h1>

        <button
          type="button"
          className={styles["transaction-header__generate"]}
          onClick={() => setShowReportModal(true)}
          aria-label="Generate report"
        >
          <FaFileAlt className={styles["generate__icon"]} />
          Generate Report
        </button>
      </div>

      <GenerateReport 
        isOpen={showReportModal} 
        onClose={() => setShowReportModal(false)} 
      />
    </>
  );
};

export default TransactionHeader;
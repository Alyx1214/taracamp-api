import React from "react";
import styles from "./TransactionHeader.module.css";

const TransactionHeader = () => {
  
  return (
    <div className={styles["transaction-header__container"]}>
      <h1 className={styles["transaction-header__title"]}>
        TRANSACTIONS
      </h1>
    </div>
  );
};

export default TransactionHeader;
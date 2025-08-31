import React, { useState } from "react";
import TransactionHeader from "./TransactionHeader";
import TransactionPagination from "./TransactionPagination";
import styles from "./Transaction.module.css";
import Tabs from "../SharedTabs/SharedTabs.jsx";
import SearchFil from "../SearchFil/SearchFil";
import TransactionTable from "../TransactionTables/TransactionTable.jsx";
import PaymentTable from "../TransactionTables/PaymentTable.jsx";


export default function Transaction() {
  const [activeTab, setActiveTab] = useState("Transactions");

  const handleSearch = (value) => console.log("Searching for:", value);
  const handleFilter = () => console.log("Filter clicked");

  const renderActiveTab = () => {
    switch (activeTab) {
        case "Transactions":
            return <TransactionTable />;
        case "Payment":
            return <PaymentTable />;
        default:
            return null;
    }
  };

    return (
    <div className={styles["transaction-container"]}>
      <TransactionHeader />
      <div className={styles["transaction-controls"]}>
            <Tabs
                tabs={["Transactions", "Payment"]}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
            />
            <SearchFil onSearch={handleSearch} onFilter={handleFilter} />
      </div>

      {renderActiveTab()}
      
      <TransactionPagination />
    </div>
  );


}
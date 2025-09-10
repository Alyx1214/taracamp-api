import React, { useState, useEffect } from "react";
import TransactionHeader from "./TransactionHeader";
import Pagination from "../Pagination/Pagination.jsx";
import styles from "./Transaction.module.css";
import Tabs from "../SharedTabs/SharedTabs.jsx";
import SearchFil from "../SearchFil/SearchFil";
import TransactionTable from "../TransactionTables/TransactionTable.jsx";
import PaymentTable from "../TransactionTables/PaymentTable.jsx";
import { getAllReservationsByStatus } from "../../apis/reservationApi.js";


export default function Transaction() {
  const [activeTab, setActiveTab] = useState("Transactions");
  const [transactions, setTransactions] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    if (activeTab === "Transactions") {
      getAllReservationsByStatus("CHECKED-OUT")
        .then(data => setTransactions(data.reservations || []))
        .catch((err) => {
          console.error("Failed to fetch checked out reservations:", err)
          setTransactions([]);
        });
    } else if (activeTab === "Payment") {
        getAllReservationsByStatus("CONFIRMED")
        .then(data => setPayments(data.reservations || []))
        .catch((err) => {
          console.error("Failed to fetch confirmed reservations:", err)
          setPayments([]);
        });
    }
  }, [activeTab]);

  const handleSearch = (value) => console.log("Searching for:", value);
  const handleFilter = () => console.log("Filter clicked");

  const renderActiveTab = () => {
    switch (activeTab) {
        case "Transactions":
            return <TransactionTable data={transactions} />;
        case "Payment":
            return <PaymentTable data={payments} />;
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

      <Pagination />
    </div>
  );


}
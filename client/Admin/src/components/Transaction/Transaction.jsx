import React, { useState, useEffect } from "react";
import TransactionHeader from "./TransactionHeader";
import Pagination from "../Pagination/Pagination.jsx";
import styles from "./Transaction.module.css";
import Tabs from "../SharedTabs/SharedTabs.jsx";
import SearchFil from "../SearchFil/SearchFil";
import TransactionTable from "../TransactionTables/TransactionTable.jsx";
import PaymentTable from "../TransactionTables/PaymentTable.jsx";
import { getAllReservationsByStatus, searchReservations } from "../../apis/reservationApi.js";


export default function Transaction() {
  const [activeTab, setActiveTab] = useState("Transactions");
  const [transactions, setTransactions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    if (activeTab === "Transactions") {
      getAllReservationsByStatus("Checked-out")
        .then(data => {
          setTransactions(data.reservations || []);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to fetch checked out reservations:", err)
          setTransactions([]);
          setLoading(false);
        });
    } else if (activeTab === "Payment") {
        getAllReservationsByStatus("Confirmed")
        .then(data => {
          setPayments(data.reservations || []);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to fetch confirmed reservations:", err)
          setPayments([]);
          setLoading(false);
        });
    }
  }, [activeTab]);

  const handleSearch = async (value) => {
    const q = (value || "").trim();
    setLoading(true);
    if (!q) {
      if (activeTab === "Transactions") {
        try {
          const data = await getAllReservationsByStatus("Checked-out");
          setTransactions(data.reservations || []);
        } catch {
          setTransactions([]);
        }
      } else if (activeTab === "Payment") {
        try {
          const data = await getAllReservationsByStatus("Confirmed");
          setPayments(data.reservations || []);
        } catch {
          setPayments([]);
        }
      }
      setLoading(false);
      return;
    }

    const params = {
      query: q,
      status: activeTab === "Transactions" ? "Checked-out" : "Confirmed",
    };

    try {
      const res = await searchReservations(params);
      const list = res?.reservations || [];
      if (activeTab === "Transactions") setTransactions(list);
      else if (activeTab === "Payment") setPayments(list);
    } catch (err) {
      console.error("Search failed:", err?.message || err);
      if (activeTab === "Transactions") setTransactions([]);
      else if (activeTab === "Payment") setPayments([]);
    } finally {
      setLoading(false);
    }
  };
  const handleFilter = () => console.log("Filter clicked");

  const renderActiveTab = () => {
    switch (activeTab) {
        case "Transactions":
            return <TransactionTable data={transactions} loading={loading} />;
        case "Payment":
            return <PaymentTable data={payments} loading={loading} />;
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

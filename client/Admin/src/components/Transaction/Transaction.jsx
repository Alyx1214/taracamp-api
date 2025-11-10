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
  const [filters, setFilters] = useState({
    serviceType: "",
    startDate: "",
    endDate: "",
    paymentMethod: "",
    sortBy: ""
  });

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

  // Reset filters when active tab changes
  useEffect(() => {
    setFilters({
      serviceType: "",
      startDate: "",
      endDate: "",
      paymentMethod: "",
      sortBy: ""
    });
  }, [activeTab]);

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters || {});
  };

  // Define filter fields based on active tab
  const getFilterFields = () => {
    if (activeTab === "Transactions") {
      return [
        {
          name: "serviceType",
          label: "Service Type",
          type: "select",
          options: [
            { value: "", label: "All Types" },
            { value: "Lodging", label: "Lodging" },
            { value: "Event", label: "Event" },
            { value: "Event and Lodging", label: "Event and Lodging" }
          ]
        },
        {
          name: "startDate",
          label: "Start Date",
          type: "date"
        },
        {
          name: "endDate",
          label: "End Date",
          type: "date"
        },
        {
          name: "paymentMethod",
          label: "Payment Method",
          type: "select",
          options: [
            { value: "", label: "All Methods" },
            { value: "DBP", label: "DBP" },
            { value: "GCash", label: "GCash" },
            { value: "GrabPay", label: "GrabPay" }
          ]
        },
        {
          name: "sortBy",
          label: "Sort By",
          type: "select",
          options: [
            { value: "", label: "None" },
            { value: "date-asc", label: "Date (Earliest First)" },
            { value: "date-desc", label: "Date (Latest First)" },
            { value: "amount-asc", label: "Amount (Low to High)" },
            { value: "amount-desc", label: "Amount (High to Low)" },
            { value: "service", label: "Service Type (A-Z)" },
            { value: "payment", label: "Payment Method (A-Z)" }
          ]
        }
      ];
    } else if (activeTab === "Payment") {
      return [
        {
          name: "serviceType",
          label: "Service Type",
          type: "select",
          options: [
            { value: "", label: "All Types" },
            { value: "Lodging", label: "Lodging" },
            { value: "Event", label: "Event" },
            { value: "Event and Lodging", label: "Event and Lodging" }
          ]
        },
        {
          name: "startDate",
          label: "Start Date",
          type: "date"
        },
        {
          name: "endDate",
          label: "End Date",
          type: "date"
        },
        {
          name: "sortBy",
          label: "Sort By",
          type: "select",
          options: [
            { value: "", label: "None" },
            { value: "date-asc", label: "Date (Earliest First)" },
            { value: "date-desc", label: "Date (Latest First)" },
            { value: "service", label: "Service Type (A-Z)" }
          ]
        }
      ];
    }
    return [];
  };

  const renderActiveTab = () => {
    const commonProps = {
      loading,
      filters
    };

    switch (activeTab) {
        case "Transactions":
            return <TransactionTable data={transactions} {...commonProps} />;
        case "Payment":
            return <PaymentTable data={payments} {...commonProps} />;
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
            <SearchFil 
              onApplyFilters={handleApplyFilters}
              filterFields={getFilterFields()}
            />
      </div>

      {renderActiveTab()}

      <Pagination />
    </div>
  );


}
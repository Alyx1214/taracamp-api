import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import TransactionHeader from "./TransactionHeader";
import Pagination from "../Pagination/Pagination.jsx";
import styles from "./Transaction.module.css";
import Tabs from "../SharedTabs/SharedTabs.jsx";
import SearchFil from "../SearchFil/SearchFil";
import TransactionTable from "../TransactionTables/TransactionTable.jsx";
import PaymentTable from "../TransactionTables/PaymentTable.jsx";
import { searchReservations } from "../../apis/reservationApi.js";


export default function Transaction() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") || "Payment";
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [transactions, setTransactions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    serviceType: "",
    startDate: "",
    endDate: "",
    paymentMethod: "",
    sortBy: ""
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const itemsPerPage = 15;

  // Fetch payments data with filters
  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const skip = (currentPage - 1) * itemsPerPage;
      const options = { 
        limit: itemsPerPage, 
        skip
      };
      
      if (filters.serviceType) options.serviceType = filters.serviceType;
      if (filters.startDate) options.startDate = filters.startDate;
      if (filters.endDate) options.endDate = filters.endDate;
      if (filters.sortBy) options.sortBy = filters.sortBy;

      const searchParams = {
        status: 'Confirmed,Checked-in', // Include both Confirmed and Checked-in reservations
        ...options
      };
      
      if (String(searchQuery || '').trim()) {
        searchParams.query = String(searchQuery).trim();
      }

      const res = await searchReservations(searchParams);
      const reservations = res?.reservations || [];
      setPayments(reservations);
      
      const totalCount = res?.totalCount || 0;
      setTotalItems(totalCount);
      setTotalPages(Math.ceil(totalCount / itemsPerPage));
    } catch (err) {
      console.error("Failed to fetch confirmed reservations:", err);
      setPayments([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentPage, searchQuery, filters]);

  // Fetch transactions data with filters
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const skip = (currentPage - 1) * itemsPerPage;
      const options = { 
        limit: itemsPerPage, 
        skip
      };
      
      if (filters.serviceType) options.serviceType = filters.serviceType;
      if (filters.startDate) options.startDate = filters.startDate;
      if (filters.endDate) options.endDate = filters.endDate;
      if (filters.paymentMethod) options.paymentMethod = filters.paymentMethod;
      if (filters.sortBy) options.sortBy = filters.sortBy;

      const searchParams = {
        status: 'Confirmed,Checked-out', // Include both Confirmed and Checked-out fully paid reservations
        isFullyPaid: true, // Only fetch fully paid reservations
        ...options
      };
      
      if (String(searchQuery || '').trim()) {
        searchParams.query = String(searchQuery).trim();
      }

      const res = await searchReservations(searchParams);
      const reservations = res?.reservations || [];
      setTransactions(reservations);
      
      const totalCount = res?.totalCount || 0;
      setTotalItems(totalCount);
      setTotalPages(Math.ceil(totalCount / itemsPerPage));
    } catch (err) {
      console.error("Failed to fetch checked out reservations:", err);
      setTransactions([]);
      setTotalItems(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentPage, searchQuery, filters]);

  // Fetch data when tab, page, search query, or filters change
  useEffect(() => {
    if (activeTab === "Payment") {
      fetchPayments();
    } else if (activeTab === "Transactions") {
      fetchTransactions();
    }
  }, [activeTab, currentPage, searchQuery, filters, fetchPayments, fetchTransactions]);

  // Sync activeTab with URL when URL changes (but not when user clicks tab)
  useEffect(() => {
    const urlTab = searchParams.get("tab") || "Payment";
    if (urlTab !== activeTab && (urlTab === "Payment" || urlTab === "Transactions")) {
      setActiveTab(urlTab);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update URL when active tab changes (from user interaction)
  useEffect(() => {
    const currentTab = searchParams.get("tab") || "Payment";
    if (activeTab !== currentTab && (activeTab === "Payment" || activeTab === "Transactions")) {
      setSearchParams({ tab: activeTab });
    }
  }, [activeTab, setSearchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset filters and page when active tab changes
  useEffect(() => {
    setFilters({
      serviceType: "",
      startDate: "",
      endDate: "",
      paymentMethod: "",
      sortBy: ""
    });
    setCurrentPage(1);
  }, [activeTab]);

  const handleSearch = (value) => {
    setSearchQuery(String(value || "").trim());
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters || {});
    setCurrentPage(1); // Reset to first page when applying filters
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Define filter fields based on active tab
  const getFilterFields = () => {
    if (activeTab === "Payment") {
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
    } else if (activeTab === "Transactions") {
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
    }
    return [];
  };

  const renderActiveTab = () => {
    const commonProps = {
      loading,
      filters
    };

    switch (activeTab) {
        case "Payment":
            return <PaymentTable data={payments} {...commonProps} />;
        case "Transactions":
            return <TransactionTable data={transactions} {...commonProps} />;
        default:
            return null;
    }
  };

  return (
    <div className={styles["transaction-container"]}>
      <TransactionHeader />
      <div className={styles["transaction-controls"]}>
            <Tabs
                tabs={["Payment", "Transactions"]}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
            />
            <SearchFil 
              onSearch={handleSearch}
              onApplyFilters={handleApplyFilters}
              filterFields={getFilterFields()}
              initialSearchValue={searchQuery}
              initialFilterValues={filters}
            />
      </div>

      {renderActiveTab()}

      <Pagination 
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
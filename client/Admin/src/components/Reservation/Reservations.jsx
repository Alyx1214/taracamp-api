import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import ReservationsHeader from "./ReservationsHeader";
import Pagination from "../Pagination/Pagination.jsx";
import styles from "./Reservations.module.css"; 
import Tabs from "../SharedTabs/SharedTabs.jsx";
import SearchFil from "../SearchFil/SearchFil.jsx";

import Pending from "../UnivTable/Pending";
import Approved from "../UnivTable/Approved";
import Declined from "../UnivTable/Declined";
import Cancelled from "../UnivTable/Cancelled";
import Confirmed from "../UnivTable/Confirmed";

export default function Reservations() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || "Pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    serviceType: "",
    category: "",
    startDate: "",
    endDate: "",
    sortBy: ""
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Refresh keys to force re-render of tabs
  const [refreshKeys, setRefreshKeys] = useState({
    Pending: 0,
    Approved: 0,
    Declined: 0,
    Cancelled: 0,
    Confirmed: 0
  });

  // Function to refresh a specific tab
  const refreshTab = useCallback((tabName) => {
    setRefreshKeys(prev => ({
      ...prev,
      [tabName]: prev[tabName] + 1
    }));
  }, []);

  // Refresh tab on mount if specified in location state
  useEffect(() => {
    if (location.state?.refreshTab) {
      refreshTab(location.state.refreshTab);
    }
  }, [location.state?.refreshTab, refreshTab]);

  // Reset filters when active tab changes
  useEffect(() => {
    setFilters({
      serviceType: "",
      category: "",
      startDate: "",
      endDate: "",
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

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1); // Reset to first page when changing tabs
    // Refresh the tab when switching to it to ensure fresh data
    refreshTab(tab);
  };

  // Define filter fields for reservations
  const getFilterFields = () => {
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
        name: "category",
        label: "Category",
        type: "select",
        options: [
          { value: "", label: "All Categories" },
          { value: "DepEd", label: "DepEd" },
          { value: "Government", label: "Government" },
          { value: "PWD", label: "PWD" },
          { value: "Private", label: "Private" }
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
          { value: "service", label: "Service Type (A-Z)" },
          { value: "category", label: "Category (A-Z)" }
        ]
      }
    ];
  };

  const renderActiveTab = () => {
    const paginationProps = {
      currentPage,
      totalPages,
      totalItems,
      onPageChange: handlePageChange,
      onPaginationUpdate: (pages, items) => {
        setTotalPages(pages);
        setTotalItems(items);
      },
      onRefreshTab: refreshTab // Pass refresh function to child components
    };

    const commonProps = {
      ...paginationProps,
      searchQuery,
      filters
    };

    switch (activeTab) {
      case "Pending":
        return <Pending 
          key={`pending-${refreshKeys.Pending}`}
          {...commonProps}
        />;
      case "Approved":
        return <Approved 
          key={`approved-${refreshKeys.Approved}`}
          {...commonProps}
        />;
      case "Declined":
        return <Declined 
          key={`declined-${refreshKeys.Declined}`}
          {...commonProps}
        />;
      case "Cancelled":
        return <Cancelled 
          key={`cancelled-${refreshKeys.Cancelled}`}
          {...commonProps}
        />;
      case "Confirmed":
        return <Confirmed 
          key={`confirmed-${refreshKeys.Confirmed}`}
          {...commonProps}
        />;
      default:
        return null;
    }
  };

  return (
    <div className={styles["reservations-container"]}>
      <ReservationsHeader />

      <div className={styles["reservations-controls"]}>
        <Tabs
          tabs={["Pending", "Approved", "Declined", "Cancelled", "Confirmed"]}
          activeTab={activeTab}
          setActiveTab={handleTabChange}
        />
        <SearchFil 
          onSearch={handleSearch} 
          onApplyFilters={handleApplyFilters}
          filterFields={getFilterFields()}
        />
      </div>

      <div className={styles["reservations-list"]}>
        {renderActiveTab()}
      </div>

      <Pagination 
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        onPageChange={handlePageChange}
      />
    </div>
  );
}
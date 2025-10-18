import React, { useState, useEffect } from "react";
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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const handleSearch = (value) => {
    setSearchQuery(String(value || "").trim());
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleFilter = () => {
    console.log("Filter clicked");
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1); // Reset to first page when changing tabs
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
      }
    };

    switch (activeTab) {
      case "Pending":
        return <Pending searchQuery={searchQuery} {...paginationProps} />;
      case "Approved":
        return <Approved searchQuery={searchQuery} {...paginationProps} />;
      case "Declined":
        return <Declined searchQuery={searchQuery} {...paginationProps} />;
      case "Cancelled":
        return <Cancelled searchQuery={searchQuery} {...paginationProps} />;
      case "Confirmed":
        return <Confirmed searchQuery={searchQuery} {...paginationProps} />;
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
        <SearchFil onSearch={handleSearch} onFilter={handleFilter} />
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

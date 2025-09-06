import React, { useState } from "react";
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
  const [activeTab, setActiveTab] = useState("Pending");
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (value) => {
    setSearchQuery(String(value || "").trim());
  };

  const handleFilter = () => {
    console.log("Filter clicked");
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case "Pending":
        return <Pending searchQuery={searchQuery} />;
      case "Approved":
        return <Approved searchQuery={searchQuery} />;
      case "Declined":
        return <Declined searchQuery={searchQuery} />;
      case "Cancelled":
        return <Cancelled searchQuery={searchQuery} />;
      case "Confirmed":
        return <Confirmed searchQuery={searchQuery} />;
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
          setActiveTab={setActiveTab}
        />
        <SearchFil onSearch={handleSearch} onFilter={handleFilter} />
      </div>

      <div className={styles["reservations-list"]}>
        {renderActiveTab()}
      </div>

      <Pagination />
    </div>
  );
}

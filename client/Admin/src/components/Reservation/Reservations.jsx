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

  const handleSearch = (value) => console.log("Searching for:", value);
  const handleFilter = () => console.log("Filter clicked");

  const renderActiveTab = () => {
    switch (activeTab) {
      case "Pending":
        return <Pending />;
      case "Approved":
        return <Approved />;
      case "Declined":
        return <Declined />;
      case "Cancelled":
        return <Cancelled />;
      case "Confirmed":
        return <Confirmed />;
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

      {renderActiveTab()}

      <Pagination />
    </div>
  );
}

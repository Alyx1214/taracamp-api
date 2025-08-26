import React, { useState } from "react";
import styles from "./CheckInOuts.module.css";
import CheckTabs from "./CheckTabs";
import CheckHead from "./CheckHead";
import UnivTable from "../UnivTable/UnivTable"; 
import SearchFil from "../SearchFil/SearchFil";

export default function CheckInOuts() {
  const [activeTab, setActiveTab] = useState("Approved");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({});

  const columns = ["ID", "Name", "Email", "Service Type", "Date", "Actions"];

  const approvedData = [
    { id: "0508", name: "Tom John", email: "john.tom@gmail.com", serviceType: "Lodging", date: "April 6, 2025" },
    { id: "0509", name: "Jerome Bell", email: "jeromebell@gmail.com", serviceType: "Event and Lodging", date: "April 5, 2025" },
    { id: "0510", name: "Wade Warren", email: "warren05@gmail.com", serviceType: "Event", date: "April 4, 2025" },
    { id: "0511", name: "Eleanor Pena", email: "eleanorpena@gmail.com", serviceType: "Lodging", date: "April 3, 2025" },
    { id: "0512", name: "Michelle Smith", email: "smith_mt@gmail.com", serviceType: "Lodging", date: "April 2, 2025" },
  ];

  const checkInData = [...approvedData];
  const checkOutData = [...approvedData];

  const renderMenu = (row) => [
    { label: "View", onClick: () => alert(`Viewing ${row.name}`) },
    { label: "Edit", onClick: () => alert(`Editing ${row.name}`) },
  ];

  const renderApprovedActions = (row) => (
    <button
      className={`${styles.pillBtn} ${styles.checkInBtn}`}
      onClick={() => alert(`Checked in ${row.name}`)}
    >
      Check-In
    </button>
  );

  const renderCheckInActions = (row) => (
    <button
      className={`${styles.pillBtn} ${styles.checkOutBtn}`}
      onClick={() => alert(`Checked out ${row.name}`)}
    >
      Check-Out
    </button>
  );

  const renderCheckOutActions = (row) => (
    <button
      className={`${styles.pillBtn} ${styles.deleteBtn}`}
      onClick={() => alert(`Deleted ${row.name}`)}
    >
      Delete
    </button>
  );

  const applyFilters = (data) => {
    return data.filter((row) => {
      const matchesSearch =
        row.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFilters = Object.entries(filters).every(([key, value]) =>
        value ? String(row[key]).toLowerCase().includes(String(value).toLowerCase()) : true
      );

      return matchesSearch && matchesFilters;
    });
  };

  const getActiveData = () => {
    if (activeTab === "Approved") return applyFilters(approvedData);
    if (activeTab === "Check-in") return applyFilters(checkInData);
    if (activeTab === "Check-out") return applyFilters(checkOutData);
    return [];
  };

  return (
    <div className={styles.container}>
      <CheckHead />

      <div className={styles.headerRow}>
        <CheckTabs value={activeTab} onChange={setActiveTab} />

        <SearchFil
          placeholder={`Search in ${activeTab}`}
          onSearch={setSearchQuery}
          onApplyFilters={setFilters}
          filterFields={[
            { name: "serviceType", label: "Service Type", placeholder: "Event / Lodging" },
            { name: "date", label: "Date", type: "date" },
          ]}
        />
      </div>

      <div className={styles.content}>
        {activeTab === "Approved" && (
          <UnivTable
            columns={columns}
            data={getActiveData()}
            renderActions={renderApprovedActions}
            renderMenu={renderMenu}
          />
        )}
        {activeTab === "Check-in" && (
          <UnivTable
            columns={columns}
            data={getActiveData()}
            renderActions={renderCheckInActions}
            renderMenu={renderMenu}
          />
        )}
        {activeTab === "Check-out" && (
          <UnivTable
            columns={columns}
            data={getActiveData()}
            renderActions={renderCheckOutActions}
            renderMenu={renderMenu}
          />
        )}
      </div>
    </div>
  );
}

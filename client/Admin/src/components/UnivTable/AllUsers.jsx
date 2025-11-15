import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import UserRoleTable from "../UnivTable/AllUsers.jsx";
import SearchFil from "../SearchFil/SearchFil.jsx";
import UsersHeader from "./UsersHeader.jsx";
import styles from "./Users.module.css";

export default function Users() {
  const location = useLocation();
  const roleTabs = useMemo(
    () => [
      { label: "All", value: "All" },
      { label: "Guest", value: "Guest" },
      { label: "Front Desk", value: "Frontdesk" },
      { label: "Staff", value: "CRMS Team" },
      { label: "Accounting", value: "Accounting" },
      { label: "Superintendent", value: "Superintendent" },
    ],
    []
  );

  const [activeTab, setActiveTab] = useState(location.state?.activeTab || "All");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    lastLoggedFrom: "",
    lastLoggedTo: "",
    role: "",
    sortBy: ""
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Sync activeTab with location state changes
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);

  // Reset filters and pagination when active tab changes
  useEffect(() => {
    setFilters({
      lastLoggedFrom: "",
      lastLoggedTo: "",
      role: "",
      sortBy: ""
    });
    setSearchQuery("");
    setCurrentPage(1);
  }, [activeTab]);

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters || {});
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handleSearch = (searchValue) => {
    setSearchQuery(searchValue || "");
    setCurrentPage(1); // Reset to first page when search changes
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePaginationUpdate = (pages, items) => {
    setTotalPages(pages);
    setTotalItems(items);
  };

  // Define filter fields for users
  const getFilterFields = () => {
    return [
      {
        name: "lastLoggedFrom",
        label: "Last Logged In (From)",
        type: "date"
      },
      {
        name: "lastLoggedTo",
        label: "Last Logged In (To)",
        type: "date"
      },
      {
        name: "role",
        label: "Role",
        type: "select",
        options: [
          { value: "", label: "All Roles" },
          { value: "Guest", label: "Guest" },
          { value: "Frontdesk", label: "Front Desk" },
          { value: "CRMS Team", label: "Staff" },
          { value: "Accounting", label: "Accounting" },
          { value: "Superintendent", label: "Superintendent" }
        ]
      },
      {
        name: "sortBy",
        label: "Sort By",
        type: "select",
        options: [
          { value: "", label: "None" },
          { value: "name:asc", label: "Name (A-Z)" },
          { value: "name:desc", label: "Name (Z-A)" },
          { value: "lastLoggedIn:asc", label: "Last Logged In (Earliest First)" },
          { value: "lastLoggedIn:desc", label: "Last Logged In (Latest First)" },
          { value: "role:asc", label: "Role (A-Z)" },
          { value: "createdAt:desc", label: "Created Date (Latest First)" },
          { value: "createdAt:asc", label: "Created Date (Earliest First)" }
        ]
      }
    ];
  };

  // Get role value for the UserRoleTable component
  const getRoleForTable = () => {
    if (activeTab === "All") return undefined;
    return activeTab;
  };

  return (
    <div className={styles["users-container"]}>
      <UsersHeader />
      <div className={styles["controlsContainer"]}>
        <div className={styles.roleTabsContainer}>
          {roleTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`${styles.roleTabBtn} ${activeTab === tab.value ? styles.active : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <SearchFil
          onSearch={handleSearch}
          onApplyFilters={handleApplyFilters}
          filterFields={getFilterFields()}
          initialSearchValue={searchQuery}
          initialFilterValues={filters}
        />
      </div>

      <div className={styles.tableShiftRight}>
        <UserRoleTable
          role={getRoleForTable()}
          searchQuery={searchQuery}
          filters={filters}
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={handlePageChange}
          onPaginationUpdate={handlePaginationUpdate}
        />
      </div>
    </div>
  );
}
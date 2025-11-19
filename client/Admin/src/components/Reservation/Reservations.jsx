import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  const hasRestoredFromState = useRef(false);
  const restoredStateRef = useRef(null);
  
  // Initialize state from location.state or sessionStorage (runs before first render)
  const getInitialState = () => {
    // First try location.state
    if (location.state && location.state.filters) {
      // Create a new object to ensure React detects the change
      return {
        activeTab: location.state.activeTab || "Pending",
        searchQuery: location.state.searchQuery || "",
        filters: { ...location.state.filters },
        currentPage: location.state.currentPage || 1
      };
    }
    
    // Fallback to sessionStorage
    try {
      const savedFilters = sessionStorage.getItem('reservations_filters');
      const savedSearchQuery = sessionStorage.getItem('reservations_searchQuery');
      const savedActiveTab = sessionStorage.getItem('reservations_activeTab');
      const savedCurrentPage = sessionStorage.getItem('reservations_currentPage');
      
      if (savedFilters || savedSearchQuery || savedActiveTab || savedCurrentPage) {
        return {
          activeTab: savedActiveTab || "Pending",
          searchQuery: savedSearchQuery || "",
          filters: savedFilters ? JSON.parse(savedFilters) : {
            serviceType: "",
            category: "",
            startDate: "",
            endDate: "",
            sortBy: ""
          },
          currentPage: savedCurrentPage ? parseInt(savedCurrentPage, 10) : 1
        };
      }
    } catch (e) {
      // Ignore sessionStorage errors
    }
    
    // Default values
    return {
      activeTab: "Pending",
      searchQuery: "",
      filters: {
        serviceType: "",
        category: "",
        startDate: "",
        endDate: "",
        sortBy: ""
      },
      currentPage: 1
    };
  };
  
  const initialState = getInitialState();
  const [activeTab, setActiveTab] = useState(initialState.activeTab);
  const [searchQuery, setSearchQuery] = useState(initialState.searchQuery);
  const [filters, setFilters] = useState(initialState.filters);
  const [currentPage, setCurrentPage] = useState(initialState.currentPage);
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

  // Track the last location.state we've processed to avoid duplicate restorations
  const lastProcessedStateRef = useRef(null);
  
  // Mark that we've initialized from location.state or sessionStorage
  // Also refresh the tab if we restored filters to ensure data is fetched
  useEffect(() => {
    const hasRestoredFilters = location.state?.filters || 
      (initialState.filters && Object.keys(initialState.filters).some(key => initialState.filters[key] !== ""));
    
    if (location.state || hasRestoredFilters) {
      hasRestoredFromState.current = true;
      // Refresh the active tab to ensure data is fetched with restored filters
      // Use a small delay to ensure state is fully initialized
      setTimeout(() => {
        refreshTab(initialState.activeTab);
      }, 0);
    }
  }, []); // Only run once on mount

  // Track previous activeTab to detect manual tab changes
  const prevActiveTabRef = useRef(activeTab);
  const isRestoringRef = useRef(false);
  
  // Reset filters when active tab changes (but not when restoring from location.state)
  useEffect(() => {
    // Skip reset if we're currently restoring from location.state
    if (isRestoringRef.current) {
      prevActiveTabRef.current = activeTab;
      return;
    }
    
    // Skip reset if we just restored from location.state
    if (restoredStateRef.current && restoredStateRef.current.activeTab === activeTab) {
      prevActiveTabRef.current = activeTab;
      // Clear the restored state ref after using it
      restoredStateRef.current = null;
      return;
    }
    
    // Only reset if:
    // 1. The tab actually changed (not initial render)
    // 2. We've already restored from state (or there's no state to restore)
    // 3. The change wasn't from location.state restoration
    if (prevActiveTabRef.current !== activeTab && hasRestoredFromState.current) {
      // Check if this tab change was from location.state
      const wasFromState = location.state?.activeTab === activeTab || 
                           (restoredStateRef.current && restoredStateRef.current.activeTab === activeTab);
      
      if (!wasFromState) {
        // User manually changed tabs, reset filters
        setFilters({
          serviceType: "",
          category: "",
          startDate: "",
          endDate: "",
          sortBy: ""
        });
        setCurrentPage(1);
      }
    }
    prevActiveTabRef.current = activeTab;
  }, [activeTab, location.state?.activeTab]);

  const handleSearch = (value) => {
    const query = String(value || "").trim();
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page when searching
    // Save search query to sessionStorage as backup
    try {
      sessionStorage.setItem('reservations_searchQuery', query);
    } catch (e) {
      // Ignore sessionStorage errors
    }
  };

  const handleApplyFilters = (newFilters) => {
    const filtersToSet = newFilters || {};
    setFilters(filtersToSet);
    setCurrentPage(1); // Reset to first page when applying filters
    // Save filters to sessionStorage as backup
    try {
      sessionStorage.setItem('reservations_filters', JSON.stringify(filtersToSet));
      sessionStorage.setItem('reservations_searchQuery', searchQuery);
      sessionStorage.setItem('reservations_activeTab', activeTab);
      sessionStorage.setItem('reservations_currentPage', String(currentPage));
    } catch (e) {
      // Ignore sessionStorage errors
    }
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

  // Memoize filters object to prevent unnecessary re-renders in child components
  // This prevents the filters object reference from changing on every render
  const memoizedFilters = useMemo(() => filters, [
    filters.serviceType,
    filters.category,
    filters.startDate,
    filters.endDate,
    filters.sortBy
  ]);

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
      filters: memoizedFilters
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
          initialSearchValue={searchQuery}
          initialFilterValues={filters}
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
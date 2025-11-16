import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DormAddFaci from "./DormAddFaci";
import FaciTypes from "./FaciTypes";
import SearchFil from "../SearchFil/SearchFil";
import Dormitory from "./Dormitory";
import Cottages from "./Cottages";
import Conference from "./Conference";
import OtherService from "./OtherService";
import styles from "./Facilities.module.css";

export default function Facilities() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Initialize activeTab based on navigation state to prevent flash
  const [activeTab, setActiveTab] = useState(() => {
    return location.state?.activeTab || "Dormitory";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    minPrice: "",
    maxPrice: "",
    capacity: "",
    maxCapacity: "",
    sortBy: ""
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editingData, setEditingData] = useState(null);

  // Handle activeTab from navigation state
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);

  // Reset filters when active tab changes
  useEffect(() => {
    setFilters({
      minPrice: "",
      maxPrice: "",
      capacity: "",
      maxCapacity: "",
      sortBy: ""
    });
  }, [activeTab]);

  const handleEdit = (facility) => {
    setIsEditing(true);
    setEditingData(facility);
  };

  const handleSaveChanges = (updatedData) => {
    console.log("Updated Data:", updatedData);
    setIsEditing(false);
    setEditingData(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingData(null);
  };

  const handleApplyFilters = (newFilters) => {
    setFilters(newFilters || {});
  };

  const handleClearFilters = () => {
    setFilters({
      minPrice: "",
      maxPrice: "",
      capacity: "",
      maxCapacity: "",
      sortBy: "",
      serviceType: ""
    });
  };

  // Define filter fields based on active tab
  const getFilterFields = () => {
    if (activeTab === "Add-ons") {
      return [
        {
          name: "serviceType",
          label: "Service Type",
          type: "select",
          options: [
            { value: "", label: "All Types" },
            { value: "Event", label: "Event" },
            { value: "Event and Lodging", label: "Event and Lodging" },
            { value: "Lodging", label: "Lodging" }
          ]
        },
        {
          name: "minPrice",
          label: "Min Price",
          type: "number",
          placeholder: "0.00",
          min: "0"
        },
        {
          name: "maxPrice",
          label: "Max Price",
          type: "number",
          placeholder: "999999.99",
          min: "0"
        },
        {
          name: "sortBy",
          label: "Sort By",
          type: "select",
          options: [
            { value: "", label: "None" },
            { value: "name", label: "Name (A-Z)" },
            { value: "price-asc", label: "Price (Low to High)" },
            { value: "price-desc", label: "Price (High to Low)" }
          ]
        }
      ];
    }
    return [
      {
        name: "minPrice",
        label: "Min Price",
        type: "number",
        placeholder: "0.00",
        min: "0"
      },
      {
        name: "maxPrice",
        label: "Max Price",
        type: "number",
        placeholder: "999999.99",
        min: "0"
      },
      {
        name: "capacity",
        label: "Min Capacity",
        type: "number",
        placeholder: "1",
        min: "1"
      },
      {
        name: "maxCapacity",
        label: "Max Capacity",
        type: "number",
        placeholder: "999",
        min: "1"
      },
      {
        name: "sortBy",
        label: "Sort By",
        type: "select",
        options: [
          { value: "", label: "None" },
          { value: "name", label: "Name (A-Z)" },
          { value: "price-asc", label: "Price (Low to High)" },
          { value: "price-desc", label: "Price (High to Low)" },
          { value: "capacity-asc", label: "Capacity (Low to High)" },
          { value: "capacity-desc", label: "Capacity (High to Low)" }
        ]
      }
    ];
  };

  const renderContent = () => {
    if (isEditing && activeTab === "Add-ons") {
      return (
        <OtherService
          editable
          onSave={handleSaveChanges}
          onCancel={handleCancelEdit}
          data={editingData}
        />
      );
    }

    const commonProps = {
      searchQuery,
      filters,
      onEdit: activeTab !== "Add-ons" ? handleEdit : undefined
    };

    switch (activeTab) {
      case "Dormitory":
        return <Dormitory {...commonProps} />;
      case "Cottage":
        return <Cottages {...commonProps} />;
      case "Conference":
        return <Conference {...commonProps} />;
      case "Add-ons":
        return (
          <OtherService
            onEdit={handleEdit}
            searchQuery={searchQuery}
            filters={filters}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.facilitiesContainer}>
      {!isEditing && <DormAddFaci activeTab={activeTab} />}

      {!isEditing && (
        <div className={styles.facilitiesControls}>
          <FaciTypes activeTab={activeTab} setActiveTab={setActiveTab} />
          <SearchFil 
            onSearch={(q) => setSearchQuery(String(q || "").trim())} 
            onApplyFilters={handleApplyFilters}
            filterFields={getFilterFields()}
          />
        </div>
      )}

      <div className={styles.facilitiesContent}>{renderContent()}</div>
    </div>
  );
}

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
  const [isEditing, setIsEditing] = useState(false);
  const [editingData, setEditingData] = useState(null);

  // Handle activeTab from navigation state
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);

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

    switch (activeTab) {
      case "Dormitory":
        return <Dormitory searchQuery={searchQuery} />;
      case "Cottage":
        return <Cottages searchQuery={searchQuery} />;
      case "Conference":
        return <Conference searchQuery={searchQuery} />;
      case "Add-ons":
        return (
          <OtherService
            onEdit={handleEdit}
            searchQuery={searchQuery}
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
          <SearchFil onSearch={(q) => setSearchQuery(String(q || "").trim())} />
        </div>
      )}

      <div className={styles.facilitiesContent}>{renderContent()}</div>
    </div>
  );
}

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import DormAddFaci from "./DormAddFaci";
import FaciTypes from "./FaciTypes";
import SearchFil from "../SearchFil/SearchFil";
import Dormitory from "./Dormitory";
import Cottages from "./Cottages";
import Conference from "./Conference";
import OtherService from "./OtherService";
import styles from "./Facilities.module.css";

export default function Facilities() {
  const [activeTab, setActiveTab] = useState("Dormitory");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleEdit = (id, type, facility) => {
    if (!id) {
      console.warn("No facility ID passed to edit — generating fallback ID");
      id = "temp-id-001";
    }

    navigate(`/facilities/edit/${id}`, { state: { category: type, facility } });
  };

  const renderContent = () => {
    switch (activeTab) {
      case "Dormitory":
        return (
          <Dormitory
            onEdit={(id, f) => handleEdit(id, "Dormitory", f)}
            searchQuery={searchQuery}
          />
        );
      case "Cottages":
        return (
          <Cottages
            onEdit={(id, f) => handleEdit(id, "Cottages", f)}
            searchQuery={searchQuery}
          />
        );
      case "Conference":
        return (
          <Conference
            onEdit={(id, f) => handleEdit(id, "Conference", f)}
            searchQuery={searchQuery}
          />
        );
      case "Other Service":
        return (
          <OtherService
            onEdit={(id, f) => handleEdit(id, "Other Service", f)}
            searchQuery={searchQuery}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.facilitiesContainer}>
      <DormAddFaci activeTab={activeTab} />

      <div className={styles.facilitiesControls}>
        <FaciTypes activeTab={activeTab} setActiveTab={setActiveTab} />
        <SearchFil onSearch={(q) => setSearchQuery(String(q || "").trim())} />
      </div>

      <div className={styles.facilitiesContent}>{renderContent()}</div>
    </div>
  );
}

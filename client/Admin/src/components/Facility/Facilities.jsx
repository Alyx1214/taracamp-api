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
  const navigate = useNavigate();

  const handleEdit = (id) => {
    if (!id) {
      console.warn("No facility ID passed to edit — generating fallback ID");
      id = "temp-id-001";
    }
    navigate(`/facilities/edit/${id}`);
  };

  const renderContent = () => {
    switch (activeTab) {
      case "Dormitory":
        return <Dormitory onEdit={handleEdit} />;
      case "Cottages":
        return <Cottages onEdit={handleEdit} />;
      case "Conference":
        return <Conference onEdit={handleEdit} />;
      case "Other Service":
        return <OtherService onEdit={handleEdit} />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.facilitiesContainer}>

      <DormAddFaci />

      <div className={styles.facilitiesControls}>
        <FaciTypes activeTab={activeTab} setActiveTab={setActiveTab} />
        <SearchFil />
      </div>

      <div className={styles.facilitiesContent}>{renderContent()}</div>
    </div>
  );
}

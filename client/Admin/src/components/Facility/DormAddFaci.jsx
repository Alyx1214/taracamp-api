import React from "react";
import { FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import styles from "./DormAddFaci.module.css";

const DormAddFaci = ({ activeTab }) => {
  const navigate = useNavigate();

  const handleAddClick = () => {
    navigate("/add-facility", { state: { category: activeTab } });
  };

  return (
    <div className={styles["dormitory-header-container"]}>
      <h1 className={styles["dormitory-header-title"]}>
        {activeTab.toUpperCase()} FACILITY
      </h1>

      <button
        className={styles["dormitory-header-add-btn"]}
        onClick={handleAddClick}
      >
        <FaPlus className={styles["dormitory-header-icon"]} />
        Add {activeTab}
      </button>
    </div>
  );
};

export default DormAddFaci;

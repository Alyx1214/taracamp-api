import React from "react";
import styles from "./FaciTypes.module.css";

const FaciTypes = ({ activeTab, setActiveTab }) => {
  const tabs = ["Dormitory", "Cottages", "Conference", "Other Service"];

  return (
    <div className={styles["faci-types-container"]}>
      {tabs.map((tab) => (
        <button
          key={tab}
          className={`${styles["faci-type-btn"]} ${
            activeTab === tab ? styles.active : ""
          }`}
          onClick={() => setActiveTab(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
};

export default FaciTypes;

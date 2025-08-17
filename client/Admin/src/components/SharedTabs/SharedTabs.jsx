import React from "react";
import styles from "./SharedTabs.module.css"; 

export default function SharedTabs({ tabs, activeTab, setActiveTab }) {
  return (
    <div className={styles["shared-tabs-container"]}>
      <div className={styles["shared-tabs"]}>
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`${styles["shared-tab"]} ${
              activeTab === tab ? styles.active : ""
            }`}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}

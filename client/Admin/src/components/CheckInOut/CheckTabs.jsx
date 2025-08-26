import React from "react";
import styles from "./CheckTabs.module.css";

export default function CheckTabs({ value, onChange }) {
  return (
    <div className={styles.checkInOutTabs}>
      {["Approved", "Check-in", "Check-out"].map((tab) => (
        <div
          key={tab}
          className={`${styles.checkInOutTab} ${
            value === tab ? styles.checkInOutTabActive : ""
          }`}
          onClick={() => onChange(tab)}
        >
          {tab}
        </div>
      ))}
    </div>
  );
}

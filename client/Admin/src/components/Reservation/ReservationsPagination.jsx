import React from "react";
import styles from "./ReservationsPagination.module.css"; 

export default function ReservationsPagination() {
  return (
    <div className={styles.pagination}>
      <span>Showing 1 to 15 items</span>
      <div className={styles["page-controls"]}>
        <button>{"<"}</button>
        {[1, 2, 3, 4, 5].map((num) => (
          <button
            key={num}
            className={num === 1 ? styles.active : ""}
          >
            {num}
          </button>
        ))}
        <button>{">"}</button>
      </div>
    </div>
  );
}

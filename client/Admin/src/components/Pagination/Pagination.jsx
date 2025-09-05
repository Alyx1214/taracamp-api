import React from "react";
import styles from "./Pagination.module.css";

const Pagination = () => (
  <div className={styles["univ-pagination"]}>
    <span className={styles["pagination-info"]}>Showing 1 to 15 items</span>
    <div className={styles["pagination-controls"]}>
      <button className={styles["pagination-arrow"]}>&lt;</button>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          className={`${styles["pagination-btn"]} ${n === 1 ? styles["active"] : ""}`.trim()}
        >
          {n}
        </button>
      ))}
      <button className={styles["pagination-arrow"]}>&gt;</button>
    </div>
  </div>
);

export default Pagination;
import React from "react";
import { FaSearch, FaSlidersH } from "react-icons/fa";
import styles from "./SearchFil.module.css"; 

export default function SearchFil({ placeholder = "Search", onSearch, onFilter }) {
  return (
    <div className={styles["searchfil-container"]}>
      <div className={styles["searchfil-input"]}>
        <input
          type="text"
          placeholder={placeholder}
          onChange={(e) => onSearch && onSearch(e.target.value)}
        />
      </div>

      <button className={styles["searchfil-btn"]} onClick={onSearch}>
        <FaSearch />
      </button>

      <button className={styles["searchfil-btn"]} onClick={onFilter}>
        <FaSlidersH />
      </button>
    </div>
  );
}

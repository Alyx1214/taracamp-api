import React from "react";
import { FaSearch, FaSlidersH } from "react-icons/fa";
import styles from "./SearchFil.module.css";

export default function SearchFil({ placeholder = "Search", onSearch, onFilter }) {
return (
<div className={styles["searchfil-container"]}>
{/* Search Input */}
<div className={styles["searchfil-input"]}>
<input
type="text"
placeholder={placeholder}
onChange={(e) => onSearch && onSearch(e.target.value)}
/>
</div>

{/* Search Button */}
<button className={styles["searchfil-btn"]} onClick={onSearch}>
<FaSearch />
</button>

{/* Filter Button */}
<button className={styles["searchfil-btn"]} onClick={onFilter}>
<FaSlidersH />
</button>
</div>
);
}
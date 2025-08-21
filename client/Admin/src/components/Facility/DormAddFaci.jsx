import React from "react";
import { FaPlus } from "react-icons/fa";
import { Link } from "react-router-dom";
import styles from "./DormAddFaci.module.css";

const DormAddFaci = () => {
  return (
    <div className={styles["dormitory-header-container"]}>
      <h1 className={styles["dormitory-header-title"]}>
        DORMITORIES FACILITY
      </h1>

      <Link to="/add-facility">
        <button className={styles["dormitory-header-add-btn"]}>
          <FaPlus className={styles["dormitory-header-icon"]} />
          Add Facility
        </button>
      </Link>
    </div>
  );
};

export default DormAddFaci;

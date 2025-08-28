import React from "react";
import { FaPlus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import styles from "./ReservationsHeader.module.css";

const ReservationsHeader = () => {
  const navigate = useNavigate();

  const handleAddClick = () => {
    navigate("/reservation-form");
  };

  return (
    <div className={styles["reservations-header__container"]}>
      <h1 className={styles["reservations-header__title"]}>
        RESERVATIONS
      </h1>

      <button
        className={styles["reservations-header__add-btn"]}
        onClick={handleAddClick}
      >
        <FaPlus className={styles["reservations-header__icon"]} />
        Add Reservation
      </button>
    </div>
  );
};

export default ReservationsHeader;

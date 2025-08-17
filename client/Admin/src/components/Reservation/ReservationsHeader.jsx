import React from "react";
import { useNavigate } from "react-router-dom";
import styles from "./ReservationsHeader.module.css";

export default function ReservationsHeader() {
  const navigate = useNavigate();

  return (
    <div className={styles["reservations-header__container"]}>
      <h1 className={styles["reservations-header__title"]}>RESERVATIONS</h1>
      <button
        className={styles["reservations-header__add-btn"]}
        onClick={() => navigate("/reservations/add")}
      >
        + Add Reservation
      </button>
    </div>
  );
}

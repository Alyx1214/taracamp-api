import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./BoxCard.module.css";

export default function BoxCards() {
  const navigate = useNavigate();
  const [openMenuIndex, setOpenMenuIndex] = useState(null);

  const facilities = [
    { name: "QUIRINO HALL", rate: 375, capacity: 100 },
    { name: "ROXAS HALL", rate: 375, capacity: 100 },
    { name: "RECTO HALL", rate: 375, capacity: 100 },
    { name: "ESCODA ROOM 104", rate: 375, capacity: 100 },
    { name: "PAGES HALL", rate: 350, capacity: 100 },
    { name: "SQ MEDICAL", rate: 350, capacity: 100 },
  ];

  const handleMenuToggle = (index) => {
    setOpenMenuIndex(openMenuIndex === index ? null : index);
  };

  const handleEdit = (facility) => {
    navigate("/edit-facility", { state: { facility } });
  };

  return (
    <div className={styles["boxcards-container"]}>
      {facilities.map((facility, index) => (
        <div className={styles.card} key={index}>

          <div className={styles["card-image"]} />

          <div className={styles["card-content"]}>
            <h3 className={styles["card-title"]}>{facility.name}</h3>
            <p className={styles["card-rate"]}>
              Rate per Person: ₱ {facility.rate}
            </p>
            <p className={styles["card-capacity"]}>
              Capacity: {facility.capacity}
            </p>
          </div>

          <div
            className={styles["card-menu"]}
            onClick={() => handleMenuToggle(index)}
          >
            ⋮
          </div>

          {openMenuIndex === index && (
            <div className={styles["menu-dropdown"]}>
              <div
                className={styles["menu-item"]}
                onClick={() => handleEdit(facility)}
              >
                Edit
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

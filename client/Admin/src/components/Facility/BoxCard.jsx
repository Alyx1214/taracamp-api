import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaEdit, FaTrash } from "react-icons/fa";
import styles from "./BoxCard.module.css";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

const getSingularLabel = (category) => {
  switch (category) {
    case "Dormitory":
      return "Dormitory";
    case "Cottages":
      return "Cottage";
    case "Conference":
      return "Conference";
    case "Add-ons":
      return "Service";
    default:
      return "Facility";
  }
};

export default function BoxCard({ facilities, onDelete, type, onEdit }) {
  const navigate = useNavigate();
  const [openMenuIndex, setOpenMenuIndex] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState(null);

  const menuRefs = useRef([]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        openMenuIndex !== null &&
        menuRefs.current[openMenuIndex] &&
        !menuRefs.current[openMenuIndex].contains(e.target)
      ) {
        setOpenMenuIndex(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuIndex]);

  const handleMenuToggle = (index) => {
    setOpenMenuIndex(openMenuIndex === index ? null : index);
  };

  const handleEditClick = (facility) => {
    setOpenMenuIndex(null);
    if (onEdit) {
      onEdit(facility.id, type, facility);
    } else {
      navigate(`/facilities/edit/${facility.id}`, {
        state: { category: type, facility },
      });
    }
  };

  const handleDeleteClick = (facility) => {
    setSelectedFacility(facility);
    setModalOpen(true);
    setOpenMenuIndex(null);
  };

  const handleConfirmDelete = () => {
    if (selectedFacility && onDelete) onDelete(selectedFacility.id);
    setModalOpen(false);
    setSelectedFacility(null);
  };

  return (
    <>
      <div className={styles["boxcards-container"]}>
        {facilities.map((facility, index) => {
          const images = Array.isArray(facility.images) ? facility.images : [];
          const primary = images[0] || "/placeholder.jpg"; // your placeholder path

          return (
            <div
              className={styles.card}
              key={facility.id}
              style={{ position: "relative" }}
            >
              <div
                className={styles["card-image"]}
                style={{
                  backgroundImage: `url("${primary}")`, // quote URL for signed URLs with query params
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />

              <div className={styles["card-content"]}>
                <h3 className={styles["card-title"]}>{facility.name}</h3>
                <p className={styles["card-rate"]}>
                  {type === "Add-ons"
                    ? "Price per Unit"
                    : type === "Conference" || type === "Cottage"
                    ? "Price"
                    : "Rate per Person"}
                  : ₱ {facility.rate}
                  {type === "Add-ons" &&
                    facility.capacity &&
                    facility.capacity !== "-" &&
                    ` / ${facility.capacity}`}
                </p>
                {type !== "Add-ons" && (
                  <p className={styles["card-capacity"]}>
                    Capacity: {facility.capacity}
                  </p>
                )}
              </div>

              <div
                className={styles["card-menu"]}
                onClick={() => handleMenuToggle(index)}
              >
                ⋮
              </div>

              {openMenuIndex === index && (
                <div
                  className={styles["dropdown-menu"]}
                  ref={(el) => (menuRefs.current[index] = el)}
                >
                  <div
                    className={styles["dropdown-item"]}
                    onClick={() => handleEditClick(facility)}
                  >
                    <FaEdit className={styles.icon} /> Edit
                  </div>
                  <div
                    className={styles["dropdown-item"]}
                    onClick={() => handleDeleteClick(facility)}
                  >
                    <FaTrash className={styles.icon} /> Delete
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDeleteModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleConfirmDelete}
        type={getSingularLabel(type)}
      />
    </>
  );
}

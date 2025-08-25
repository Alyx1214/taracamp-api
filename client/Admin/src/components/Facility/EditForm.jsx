import React from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import styles from "./EditForm.module.css";

const getSingularLabel = (category) => {
  switch (category) {
    case "Dormitory":
      return "Dormitory";
    case "Cottages":
      return "Cottage";
    case "Conference":
      return "Conference";
    case "Other Service":
      return "Service";
    default:
      return "Facility";
  }
};

export default function EditForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { category, facility } = location.state || {};

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`${getSingularLabel(category)} ${id} updated!`);
    navigate("/facilities");
  };

  return (
    <div className={styles.editFormContainer}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          ←
        </button>
        <h2 className={styles.title}>{category || "FACILITY"}</h2>
      </div>

      <div className={styles.imageUpload}>
        <div className={styles.imageBox}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="72"
            height="72"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#333"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.8"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>

          <button type="button" className={styles.editImageBtn}>
            edit
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formRow}>
          <label>
            {getSingularLabel(category)} Name:
            <input
              type="text"
              defaultValue={facility?.name || `${getSingularLabel(category)} Name`}
            />
          </label>
          <label>
            Rate per Person:
            <input type="number" defaultValue={facility?.rate || 0} />
          </label>
        </div>

        <div className={styles.formRow}>
          <label>
            Capacity:
            <input type="number" defaultValue={facility?.capacity || 0} />
          </label>
          <label>
            Status:
            <select defaultValue={facility?.status || "Available"}>
              <option value="Available">Available</option>
              <option value="Unavailable">Unavailable</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </label>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
          <button type="submit" className={styles.saveBtn}>
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

import React, { useState } from "react";
import { FaArrowLeft, FaUpload } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import styles from "./AddForm.module.css";

const AddForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    rate: "",
    capacity: "",
    status: "Available",
    image: null,
  });

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (files) {
      setFormData((prev) => ({ ...prev, image: files[0] }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
  };

  return (
    <div className={styles.formContainer}>
      <div className={styles.header}>
        <FaArrowLeft
          className={styles.backArrow}
          onClick={() => navigate(-1)}
        />
        <h2 className={styles.title}>DORMITORIES</h2>
      </div>

      <label className={styles.uploadBox}>
        <FaUpload className={styles.uploadIcon} />
        <p className={styles.uploadText}>Upload Facility Image</p>
        <input type="file" name="image" onChange={handleChange} hidden />
      </label>

      <form onSubmit={handleSubmit}>
        <div className={styles.formRow}>
          <label>
            Facility Name:
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Rate per Person:
            <input
              type="number"
              name="rate"
              value={formData.rate}
              onChange={handleChange}
              required
            />
          </label>
        </div>

        <div className={styles.formRow}>
          <label>
            Capacity:
            <input
              type="number"
              name="capacity"
              value={formData.capacity}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Status:
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="Available">Available</option>
              <option value="Unavailable">Unavailable</option>
            </select>
          </label>
        </div>

        <button type="submit" className={styles.submitBtn}>
          ADD FACILITY
        </button>
      </form>
    </div>
  );
};

export default AddForm;

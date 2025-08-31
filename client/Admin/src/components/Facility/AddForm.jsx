import React, { useMemo, useState } from "react";
import { FaArrowLeft, FaUpload } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import styles from "./AddForm.module.css";
import { createFacility } from "../../apis/facilityApi";
import { createSpecialService } from "../../apis/specialServiceApi";

const AddForm = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const category = location.state?.category || "Facility";

  const [formData, setFormData] = useState({
    name: "",
    rate: "",
    unit: "",
    capacity: "",
    status: "Available",
    image: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const facilityType = useMemo(() => {
    switch (category) {
      case "Dormitory":
        return "DORMITORY";
      case "Cottages":
        return "COTTAGE";
      case "Conference":
        return "CONFERENCE";
      default:
        return "";
    }
  }, [category]);

  const isSpecialService = category === "Other Service";

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (files) {
      setFormData((prev) => ({ ...prev, image: files[0] }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (isSpecialService) {
        const res = await createSpecialService({
          name: formData.name,
          price: formData.rate,
          unit: formData.unit,
        });
        setSuccess(res.message || "Service created successfully");
      } else {
        const payload = {
          name: formData.name,
          facilityType,
          status: formData.status.toUpperCase(),
          image: formData.image,
        };
        if (facilityType === "DORMITORY" || facilityType === "CONFERENCE" || facilityType === "COTTAGE") {
          payload.capacity = formData.capacity;
        }
        if (facilityType === "CONFERENCE") {
          payload.price = formData.rate;
        } else if (facilityType === "DORMITORY" || facilityType === "COTTAGE") {
          payload.ratePerPerson = formData.rate;
        }
        const res = await createFacility(payload);
        setSuccess(res.message || "Facility created successfully");
      }
      setTimeout(() => navigate(-1), 800);
    } catch (err) {
      setError(err?.data?.error || err.message || (isSpecialService ? "Failed to create service" : "Failed to create facility"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.formContainer}>
      <div className={styles.header}>
        <FaArrowLeft className={styles.backArrow} onClick={() => navigate(-1)} />
        <h2 className={styles.title}>
          {category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()}
        </h2>
      </div>

      {!isSpecialService && (
        <>
          <label className={styles.uploadBox}>
            <FaUpload className={styles.uploadIcon} />
            <p className={styles.uploadText}>Upload {category} Image</p>
            <input
              type="file"
              name="image"
              accept="image/png,image/jpeg"
              onChange={handleChange}
              hidden
            />
          </label>
          {formData.image && (
            <div style={{ marginBottom: 16 }}>
              <small>Selected: {formData.image.name}</small>
            </div>
          )}
        </>
      )}

      <form onSubmit={handleSubmit}>
        <div className={styles.formRow}>
          <label>
            {category} Name:
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            {isSpecialService || facilityType === "CONFERENCE" ? "Price:" : "Rate per Person:"}
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
          {(facilityType === "DORMITORY" || facilityType === "CONFERENCE" || facilityType === "COTTAGE") && (
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
          )}

          {isSpecialService ? (
            <label>
              Unit:
              <input
                type="text"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                required
              />
            </label>
          ) : (
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
          )}
        </div>

        {error && <p style={{ color: 'red' }}>{error}</p>}
        {success && <p style={{ color: 'green' }}>{success}</p>}
        <button type="submit" className={styles.submitBtn} disabled={submitting}>
          {isSpecialService ? 'Add Other service' : `Add ${category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()}`}
        </button>
      </form>
    </div>
  );
};

export default AddForm;

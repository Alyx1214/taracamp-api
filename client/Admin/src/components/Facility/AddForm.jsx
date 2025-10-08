import React, { useMemo, useState } from "react";
import { FaArrowLeft, FaUpload } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import styles from "./AddForm.module.css";
import { createFacility } from "../../apis/facilityApi";
import { createAddon } from "../../apis/addonsApi";

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
    images: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const facilityType = useMemo(() => {
    switch (category) {
      case "Dormitory":
        return "Dormitory";
      case "Cottage":
        return "Cottage";
      case "Conference":
        return "Conference";
      default:
        return "";
    }
  }, [category]);

  const isSpecialService = category === "Add-ons";

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (files) {
      if (name === 'images') {
        setFormData((prev) => ({ ...prev, images: Array.from(files) }));
      } else {
        setFormData((prev) => ({ ...prev, [name]: files[0] }));
      }
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
        const res = await createAddon({
          name: formData.name,
          price: formData.rate,
          unit: formData.unit,
        });
        setSuccess(res.message || "Service created successfully");
      } else {
        const payload = {
          name: formData.name,
          facilityType,
          status: formData.status,
          images: formData.images,
        };

        // Only attach capacity for actual facilities (not other services)
        if (!isSpecialService && formData.capacity) {
          payload.capacity = formData.capacity;
        }

        if (facilityType === "Conference") {
          payload.price = formData.rate;
        } else if (facilityType === "Dormitory" || facilityType === "Cottage") {
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
        <span
          className={styles["add-form-back"]}
          onClick={() => navigate(-1)}
          >
          &larr;
        </span>
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
              name="images"
              accept="image/png,image/jpeg"
              multiple
              onChange={handleChange}
              hidden
            />
          </label>
          {formData.images?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <small>
                Selected ({formData.images.length}): {formData.images.map(f => f.name).join(', ')}
              </small>
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
            {isSpecialService || facilityType === "Conference" ? "Price:" : "Rate per Person:"}
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
          {!isSpecialService && (
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
          {isSpecialService ? 'Add Add-on' : `Add ${category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()}`}
        </button>
      </form>
    </div>
  );
};

export default AddForm;

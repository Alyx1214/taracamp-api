import React, { useMemo, useRef, useState } from "react";
import { FaArrowLeft, FaUpload } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import styles from "./AddForm.module.css";
import { createFacility } from "../../apis/facilityApi";
import { createAddon } from "../../apis/addonsApi";

const MAX_IMAGES = 5;

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
    images: Array(MAX_IMAGES).fill(null),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const inputRefs = useRef([]);
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
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // set single slot file
  const handleSlotChange = (index, file) => {
    setFormData((prev) => {
      const imgs = Array.from(prev.images || Array(MAX_IMAGES).fill(null));
      imgs[index] = file || null;
      return { ...prev, images: imgs };
    });
  };

  const removeImage = (index) => {
    handleSlotChange(index, null);
  };

  const openSlot = (index) => {
    const el = inputRefs.current[index];
    if (el) el.click();
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
          images: (formData.images || []).filter(Boolean),
        };

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
      setError(
        err?.data?.error ||
          err.message ||
          (isSpecialService ? "Failed to create service" : "Failed to create facility")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCount = (formData.images || []).filter(Boolean).length;

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
          <div className={styles.uploadGrid}>
            {/* Large slot (index 0) */}
            {Array.from({ length: MAX_IMAGES }).map((_, idx) => {
              const file = formData.images[idx];
              const isLarge = idx === 0;
              return (
                <div
                  key={idx}
                  className={`${styles.uploadSlot} ${
                    isLarge ? styles.uploadSlotLarge : styles.uploadSlotSmall
                  }`}
                  onClick={() => openSlot(idx)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openSlot(idx)}
                >
                  {file ? (
                    <div className={styles.uploadPreview}>
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className={styles.previewImg}
                      />
                      <button
                        type="button"
                        className={styles.removeImageBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(idx);
                        }}
                        aria-label={`Remove image ${idx + 1}`}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className={styles.uploadPlaceholder}>
                      <FaUpload className={styles.uploadIcon} />
                    </div>
                  )}

                  <input
                    ref={(el) => (inputRefs.current[idx] = el)}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => {
                      const f = e.target.files && e.target.files[0];
                      handleSlotChange(idx, f || null);
                    }}
                    hidden
                  />
                </div>
              );
            })}
          </div>

          {selectedCount > 0 && (
            <div style={{ marginBottom: 16 }}>
              <small>
                Selected ({selectedCount}):{" "}
                {(formData.images || []).filter(Boolean).map((f) => f.name).join(", ")}
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

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import styles from "./EditForm.module.css";

import { getFacilityById, updateFacility } from "../../apis/facilityApi";
import { updateAddon } from "../../apis/addonsApi";

const FACILITY_ENUM = {
  Dormitory: "Dormitory",
  Cottages: "Cottage",
  Conference: "Conference",
};

const getSingularLabel = (category) => {
  switch (category) {
    case "Dormitory": return "Dormitory";
    case "Cottages": return "Cottage";
    case "Conference": return "Conference";
    case "Add-ons": return "Service";
    default: return "Facility";
  }
};

export default function EditForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { category: categoryFromState } = location.state || {};

  const [category, setCategory] = useState(categoryFromState || "");
  const [form, setForm] = useState({
    name: "",
    rate: "",
    capacity: "",
    status: "Available",
    unit: "",
    image: null,
    previewUrl: null,
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const facilityType = useMemo(() => {
    if (category && FACILITY_ENUM[category]) return FACILITY_ENUM[category];
    return "";
  }, [category]);

  const isSpecialService = category === "Add-ons";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const resp = await getFacilityById(id);
        const data = resp?.facility || {};
        if (cancelled) return;

        const inferredCategory =
          categoryFromState ||
          (data.facilityType === "Dormitory"
            ? "Dormitory"
            : data.facilityType === "Cottage"
            ? "Cottages"
            : data.facilityType === "Conference"
            ? "Conference"
            : "");

        setCategory(inferredCategory);

        setForm({
          name: data.name || "",
          rate: data.price || data.ratePerPerson || "",
          capacity: data.capacity || "",
          status: data.status || "Available", 
          unit: data.unit || "",
          image: null,
          previewUrl: Array.isArray(data.images) && data.images.length ? data.images[0] : null,
        });
      } catch (e) {
        if (!cancelled) setError("Failed to load facility details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, categoryFromState]);

  const onChange = (e) => {
    const { name, value, files } = e.target;
    if (files) {
      const file = files[0];
      const url = file ? URL.createObjectURL(file) : null;
      setForm((p) => ({
        ...p,
        image: file || null,
        previewUrl: url || p.previewUrl,
      }));
      return;
    }
    setForm((p) => ({ ...p, [name]: value }));
  };

  useEffect(() => {
    return () => {
      if (form.previewUrl && form.image) {
        URL.revokeObjectURL(form.previewUrl);
      }
    };
  }, [form.image]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      if (isSpecialService) {
        await updateAddon(id, {
          name: form.name,
          price: form.rate,
          unit: form.unit,
        });
      } else {
        const payload = {
          name: form.name,
          facilityType,           
          status: form.status,   
          image: form.image,     
        };

        if (facilityType === "Conference") {
          payload.capacity = form.capacity;
          payload.price = form.rate;
        } else if (facilityType === "Dormitory" || facilityType === "Cottage") {
          payload.capacity = form.capacity;
          payload.ratePerPerson = form.rate;
        }

        await updateFacility(id, payload);
      }

      setSuccess("Saved successfully");
      setTimeout(() => navigate("/facilities"), 600);
    } catch (err) {
      setError(err?.data?.error || err?.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.editFormContainer}>
      <div className={styles.header}>
        <FaArrowLeft className={styles.backArrow} onClick={() => navigate(-1)} />
        <h2 className={styles.title}>{category || "FACILITY"}</h2>
      </div>

      {loading ? (
        <p className={styles.loadingText}>Loading facility details...</p>
      ) : (
        <>
          {!isSpecialService && (
            <div className={styles.imageUpload}>
              <label className={styles.imageBox}>
                {form.previewUrl ? (
                  <img src={form.previewUrl} alt="Preview" className={styles.previewImage} />
                ) : (
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
                )}
                <span className={styles.editImageBtn}>Select image</span>
                <input type="file" name="image" accept="image/png,image/jpeg" onChange={onChange} hidden />
              </label>
              {form.image && (
                <div className={styles.selectedFile}>
                  Selected: {form.image.name}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formRow}>
              <label>
                {getSingularLabel(category)} Name:
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  required
                />
              </label>

              <label>
                {(facilityType === "Conference" || isSpecialService)
                  ? "Price"
                  : "Rate per Person"}:
                <input
                  type="number"
                  name="rate"
                  value={form.rate}
                  onChange={onChange}
                  required
                />
              </label>
            </div>

            <div className={styles.formRow}>
              {!isSpecialService &&
                (facilityType === "Dormitory" || facilityType === "Conference") && (
                  <label>
                    Capacity:
                    <input
                      type="number"
                      name="capacity"
                      value={form.capacity}
                      onChange={onChange}
                      required
                    />
                  </label>
              )}

              {!isSpecialService && (
                <label>
                  Status:
                  <select name="status" value={form.status} onChange={onChange}>
                    <option value="Available">Available</option>
                    <option value="Unavailable">Unavailable</option>
                  </select>
                </label>
              )}

              {isSpecialService && (
                <label>
                  Unit:
                  <input
                    type="text"
                    name="unit"
                    value={form.unit}
                    onChange={onChange}
                  />
                </label>
              )}
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => navigate(-1)}
              >
                Cancel
              </button>

              <button type="submit" className={styles.saveBtn} disabled={submitting}>
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </div>

            {(error || success) && (
              <p
                className={`${styles.statusMessage} ${
                  error ? styles.errorMessage : styles.successMessage
                }`}
              >
                {error || success}
              </p>
            )}
          </form>
        </>
      )}
    </div>
  );
}

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaArrowLeft, FaUpload } from "react-icons/fa";
import styles from "./EditForm.module.css";

import { getFacilityById, updateFacility } from "../../apis/facilityApi";
import { updateAddon } from "../../apis/addonsApi";

const MAX_IMAGES = 5;

const FACILITY_ENUM = {
  Dormitory: "Dormitory",
  Cottages: "Cottage",
  Conference: "Conference",
};

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
    // images: file objects selected (max 5)
    images: Array(MAX_IMAGES).fill(null),
    // previewUrls: string urls to show previews
    previewUrls: Array(MAX_IMAGES).fill(null),
  });

  const createdObjectUrls = useRef(new Set());

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

        const previews = Array(MAX_IMAGES).fill(null);
        if (Array.isArray(data.images)) {
          for (let i = 0; i < Math.min(MAX_IMAGES, data.images.length); i++) {
            previews[i] = data.images[i] || null;
          }
        } else if (data.images && typeof data.images === "string") {
          previews[0] = data.images;
        }

        setForm({
          name: data.name || "",
          rate: data.price || data.ratePerPerson || "",
          capacity: data.capacity || "",
          status: data.status || "Available",
          unit: data.unit || "",
          images: Array(MAX_IMAGES).fill(null),
          previewUrls: previews,
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

  useEffect(() => {
    return () => {
      createdObjectUrls.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}
      });
      createdObjectUrls.current.clear();
    };
  }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleSlotChange = (index, files) => {
    const file = files && files[0] ? files[0] : null;
    setForm((prev) => {
      const nextImages = Array.from(prev.images);
      const nextPreviews = Array.from(prev.previewUrls);

      const prevPreview = nextPreviews[index];
      if (prevPreview && createdObjectUrls.current.has(prevPreview)) {
        try {
          URL.revokeObjectURL(prevPreview);
        } catch (_) {}
        createdObjectUrls.current.delete(prevPreview);
      }

      if (file) {
        const objUrl = URL.createObjectURL(file);
        createdObjectUrls.current.add(objUrl);
        nextImages[index] = file;
        nextPreviews[index] = objUrl;
      } else {
        nextImages[index] = null;
        nextPreviews[index] = null;
      }

      return { ...prev, images: nextImages, previewUrls: nextPreviews };
    });
  };

  const removeImage = (index) => {
    setForm((prev) => {
      const nextImages = Array.from(prev.images);
      const nextPreviews = Array.from(prev.previewUrls);

      const prevUrl = nextPreviews[index];
      if (prevUrl && createdObjectUrls.current.has(prevUrl)) {
        try {
          URL.revokeObjectURL(prevUrl);
        } catch (_) {}
        createdObjectUrls.current.delete(prevUrl);
      }

      nextImages[index] = null;
      nextPreviews[index] = null;
      return { ...prev, images: nextImages, previewUrls: nextPreviews };
    });
  };

  const fileInputRefs = useRef([]);

  const openFileDialog = (index) => {
    const el = fileInputRefs.current[index];
    if (el) el.click();
  };

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
          images: (form.images || []).filter(Boolean),
        };

        if ((form.images || []).filter(Boolean).length > 0) {
          payload.image = (form.images || []).filter(Boolean)[0];
        }

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
        <span
          className={styles["edit-form-back"]}
          onClick={() => navigate(-1)}
        >
          &larr;
        </span>
        <h2 className={styles.title}>{category || "FACILITY"}</h2>
      </div>

      {loading ? (
        <p className={styles.loadingText}>Loading facility details...</p>
      ) : (
        <>
          {!isSpecialService && (
            <div className={styles.imageUploadGrid}>
              {Array.from({ length: MAX_IMAGES }).map((_, idx) => (
                <label
                  key={idx}
                  className={styles.imageBoxSlot}
                  onClick={() => openFileDialog(idx)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openFileDialog(idx)}
                >
                  {form.previewUrls[idx] ? (
                    <img
                      src={form.previewUrls[idx]}
                      alt={`preview-${idx}`}
                      className={styles.previewImage}
                    />
                  ) : (
                    <FaUpload className={styles.placeholderIcon} />
                  )}

                  <input
                    ref={(el) => (fileInputRefs.current[idx] = el)}
                    type="file"
                    name={`image-${idx}`}
                    accept="image/png,image/jpeg"
                    onChange={(e) => handleSlotChange(idx, e.target.files)}
                    hidden
                  />

                  {form.images[idx] && (
                    <button
                      type="button"
                      className={styles.removeImageBtn}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        removeImage(idx);
                      }}
                      aria-label={`Remove image ${idx + 1}`}
                    >
                      ✕
                    </button>
                  )}
                </label>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formRow}>
              <label>
                {getSingularLabel(category)} Name:
                <input type="text" name="name" value={form.name} onChange={onChange} required />
              </label>

              <label>
                {(facilityType === "Conference" || isSpecialService) ? "Price" : "Rate per Person"}:
                <input type="number" name="rate" value={form.rate} onChange={onChange} required />
              </label>
            </div>

            <div className={styles.formRow}>
              {!isSpecialService &&
                (facilityType === "Dormitory" || facilityType === "Conference") && (
                  <label>
                    Capacity:
                    <input type="number" name="capacity" value={form.capacity} onChange={onChange} required />
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
                  <input type="text" name="unit" value={form.unit} onChange={onChange} />
                </label>
              )}
            </div>

            <div className={styles.actions}>
              <button type="submit" className={styles.saveBtn} disabled={submitting}>
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </div>

            {(error || success) && (
              <p className={`${styles.statusMessage} ${error ? styles.errorMessage : styles.successMessage}`}>
                {error || success}
              </p>
            )}
          </form>
        </>
      )}
    </div>
  );
}

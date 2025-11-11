import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaUpload } from "react-icons/fa";
import styles from "./EditForm.module.css";

import { getFacilityById, updateFacility } from "../../apis/facilityApi";
import { updateAddon } from "../../apis/addonsApi";

const MAX_IMAGES = 5;

const FACILITY_ENUM = {
  Dormitory: "Dormitory",
  Cottages: "Cottage",
  Cottage: "Cottage",
  Conference: "Conference",
};

export default function EditForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { category: categoryFromState } = location.state || {};

  const [category, setCategory] = useState(categoryFromState || "");
  const [formData, setFormData] = useState({
    name: "",
    rate: "",
    baseRate: "",
    discountRate: "",
    capacity: "",
    quantity: "",
    status: "Available",
    unit: "",
    images: Array(MAX_IMAGES).fill(null),
    previewUrls: Array(MAX_IMAGES).fill(null),
    extraRows: [],
  });

  const createdObjectUrls = useRef(new Set());
  const inputRefs = useRef([]);

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
            ? "Cottage"
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

        setFormData({
          name: data.name || "",
          rate: data.price || data.ratePerPerson || "",
          baseRate: data.baseRate || "",
          discountRate: data.discountRate || "",
          capacity: data.capacity || "",
          quantity: data.quantity || "",
          status: data.status || "Available",
          unit: data.unit || "",
          images: Array(MAX_IMAGES).fill(null),
          previewUrls: previews,
          extraRows: data.extraRows || [],
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSlotChange = (index, file) => {
    setFormData((prev) => {
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
    setFormData((prev) => {
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
        await updateAddon(id, {
          name: formData.name,
          price: formData.rate,
          unit: formData.unit,
        });
      } else {
        const payload = {
          name: formData.name,
          facilityType,
          status: formData.status,
          images: (formData.images || []).filter(Boolean),
          baseRate: formData.baseRate,
          discountRate: formData.discountRate,
          quantity: formData.quantity,
          extraRows: formData.extraRows,
        };

        if ((formData.images || []).filter(Boolean).length > 0) {
          payload.image = (formData.images || []).filter(Boolean)[0];
        }

        if (facilityType === "Conference" || facilityType === "Cottage") {
          payload.capacity = formData.capacity;
          payload.price = formData.rate;
        } else if (facilityType === "Dormitory") {
          payload.capacity = formData.capacity;
          payload.ratePerPerson = formData.rate;
        }

        await updateFacility(id, payload);
      }

      setSuccess("Saved successfully");
      
      setTimeout(() => {
        if (isSpecialService) {
          navigate('/facilities', { state: { activeTab: 'Add-ons' } });
        } else {
          navigate('/facilities', { state: { activeTab: category } });
        }
      }, 600);
    } catch (err) {
      setError(err?.data?.error || err?.message || "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCount = (formData.images || []).filter(Boolean).length;

  return (
    <div className={styles.editFormContainer}>
      <div className={styles.header}>
        <span
          className={styles["edit-form-back"]}
          onClick={() => {
            if (isSpecialService) {
              navigate('/facilities', { state: { activeTab: 'Add-ons' } });
            } else {
              navigate('/facilities', { state: { activeTab: category } });
            }
          }}
        >
          &larr;
        </span>
        <h2 className={styles.title}>
          {category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()}
        </h2>
      </div>

      {loading ? (
        <p className={styles.loadingText}>Loading facility details...</p>
      ) : (
        <>
          {!isSpecialService && (
            <>
              <div className={styles.imageUploadGrid}>
                {Array.from({ length: MAX_IMAGES }).map((_, idx) => {
                  const isLarge = idx === 0;
                  return (
                    <div
                      key={idx}
                      className={`${styles.imageBoxSlot} ${
                        isLarge ? styles.uploadSlotLarge : styles.uploadSlotSmall
                      }`}
                      onClick={() => openSlot(idx)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openSlot(idx)}
                    >
                      {formData.previewUrls[idx] ? (
                        <div className={styles.uploadPreview}>
                          <img
                            src={formData.previewUrls[idx]}
                            alt={`preview-${idx}`}
                            className={styles.previewImage}
                          />
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
                        </div>
                      ) : (
                        <div className={styles.uploadPlaceholder}>
                          <FaUpload className={styles.placeholderIcon} />
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

          <form onSubmit={handleSubmit} className={styles.form}>
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
                {isSpecialService || facilityType === "Conference" || facilityType === "Cottage" ? "Price:" : "Rate per Person:"}
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
                {isSpecialService || facilityType === "Conference" || facilityType === "Cottage" ? "Price:" : "Facility Rate (Inclusive of 10% Service Fee):"}
                <input
                  type="number"
                  name="baseRate"
                  value={formData.baseRate}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                {isSpecialService || facilityType === "Conference" || facilityType === "Cottage" ? "Price:" : "Discounted Facility Rate:"}
                <input
                  type="number"
                  name="discountRate"
                  value={formData.discountRate}
                  onChange={handleChange}
                  required
                />
              </label>
            </div>

            <div className={styles.formRow}>
              {!isSpecialService && (
                <>
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
                    Quantity:
                    <input
                      type="number"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleChange}
                      required
                    />
                  </label>

                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                    <button
                      type="button"
                      className={styles.addBtn}
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          extraRows: [...(prev.extraRows || []), { capacity: "", quantity: "" }],
                        }))
                      }
                    >
                      Add
                    </button>
                  </div>
                </>
              )}
            </div>

            {!isSpecialService && (formData.extraRows || []).map((row, idx) => (
              <div className={styles.formRow} key={`extra-row-${idx}`}>
                <label>
                  Capacity:
                  <input
                    type="number"
                    value={row.capacity}
                    onChange={(e) =>
                      setFormData((prev) => {
                        const extra = Array.from(prev.extraRows || []);
                        extra[idx] = { ...extra[idx], capacity: e.target.value };
                        return { ...prev, extraRows: extra };
                      })
                    }
                    required
                  />
                </label>

                <label>
                  Quantity:
                  <input
                    type="number"
                    value={row.quantity}
                    onChange={(e) =>
                      setFormData((prev) => {
                        const extra = Array.from(prev.extraRows || []);
                        extra[idx] = { ...extra[idx], quantity: e.target.value };
                        return { ...prev, extraRows: extra };
                      })
                    }
                    required
                  />
                </label>

                <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() =>
                      setFormData((prev) => {
                        const extra = Array.from(prev.extraRows || []);
                        extra.splice(idx, 1);
                        return { ...prev, extraRows: extra };
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}

            <div className={styles.formRow}>
              {isSpecialService ? (
                <label>
                  Unit:
                  <select
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select unit</option>
                    <option value="day">day</option>
                    <option value="pc">pc</option>
                    <option value="watts">watts</option>
                    <option value="mins">mins</option>
                    <option value="cert">cert</option>
                  </select>
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

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => {
                  if (isSpecialService) {
                    navigate('/facilities', { state: { activeTab: 'Add-ons' } });
                  } else {
                    navigate('/facilities', { state: { activeTab: category } });
                  }
                }}
                disabled={submitting}
              >
                Cancel
              </button>
              <button type="submit" className={styles.saveBtn} disabled={submitting}>
                {submitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
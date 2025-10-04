import React, { useMemo, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FaArrowLeft, FaUpload } from "react-icons/fa";
import styles from "./EditForm.module.css";
import { updateFacility } from "../../apis/facilityApi";
import { updateAddon } from "../../apis/addonsApi";

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
  const { category, facility } = location.state || {};

  const [form, setForm] = useState({
    name: facility?.name || "",
    rate: facility?.rate || "",
    capacity: facility?.capacity || "",
    status: facility?.status || "Available",
    unit: facility?.unit || facility?.capacity || "",
    image: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const facilityType = useMemo(() => {
    switch (category) {
      case "Dormitory": return "DORMITORY";
      case "Cottages": return "COTTAGE";
      case "Conference": return "CONFERENCE";
      default: return "";
    }
  }, [category]);

  const isSpecialService = category === "Add-ons";

  const onChange = (e) => {
    const { name, value, files } = e.target;
    if (files) return setForm((p) => ({ ...p, image: files[0] }));
    setForm((p) => ({ ...p, [name]: value }));
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
          status: form.status.toUpperCase() === 'MAINTENANCE' ? 'UNDERMAINTENCE' : form.status.toUpperCase(),
          image: form.image,
        };
        if (facilityType === 'CONFERENCE' || facilityType === 'DORMITORY') payload.capacity = form.capacity;
        if (facilityType === 'CONFERENCE') payload.price = form.rate;
        else payload.ratePerPerson = form.rate;
        await updateFacility(id, payload);
      }
      setSuccess('Saved successfully');
      setTimeout(() => navigate('/facilities'), 600);
    } catch (err) {
      setError(err?.data?.error || err.message || 'Failed to save');
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

      {!isSpecialService && (
        <div className={styles.imageUpload}>
          <label className={styles.imageBox}>
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
            <span className={styles.editImageBtn}>Select image</span>
            <input type="file" name="image" accept="image/png,image/jpeg" onChange={onChange} hidden />
          </label>
          {form.image && <small>Selected: {form.image.name}</small>}
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formRow}>
          <label>
            {getSingularLabel(category)} Name:
            <input type="text" name="name" value={form.name} onChange={onChange} required />
          </label>
          <label>
            {(facilityType === 'CONFERENCE' || isSpecialService) ? 'Price' : 'Rate per Person'}:
            <input type="number" name="rate" value={form.rate} onChange={onChange} required />
          </label>
        </div>

        <div className={styles.formRow}>
          {(!isSpecialService && (facilityType === 'DORMITORY' || facilityType === 'CONFERENCE')) && (
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
                <option value="Maintenance">Maintenance</option>
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
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          {success && <p style={{ color: 'green' }}>{success}</p>}
          <button type="submit" className={styles.saveBtn} disabled={submitting}>
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

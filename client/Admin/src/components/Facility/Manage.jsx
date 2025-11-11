import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import styles from "./Manage.module.css";

export default function Manage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { category, facility } = location.state || {};

  const [formData, setFormData] = useState({
    capacity: "",
    quantity: "",
    extraRows: [],
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load facility data
    // TODO: Fetch from API
    if (facility) {
      setFormData({
        capacity: facility.capacity || "",
        quantity: facility.quantity || "",
        extraRows: facility.extraRows || [],
      });
    }
  }, [facility]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddRow = () => {
    setFormData((prev) => ({
      ...prev,
      extraRows: [...prev.extraRows, { capacity: "", quantity: "" }],
    }));
  };

  const handleRemoveRow = (index) => {
    setFormData((prev) => {
      const extra = Array.from(prev.extraRows);
      extra.splice(index, 1);
      return { ...prev, extraRows: extra };
    });
  };

  const handleExtraRowChange = (index, field, value) => {
    setFormData((prev) => {
      const extra = Array.from(prev.extraRows);
      extra[index] = { ...extra[index], [field]: value };
      return { ...prev, extraRows: extra };
    });
  };

  const handleSaveRooms = async () => {
    setLoading(true);
    try {
      // TODO: API call to save room configuration
      console.log("Saving room data:", formData);
      setTimeout(() => {
        alert("Room configuration saved successfully!");
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error("Error saving rooms:", error);
      setLoading(false);
    }
  };

  return (
    <div className={styles.manageContainer}>
      <div className={styles.header}>
        <span
          className={styles["manage-back"]}
          onClick={() =>
            navigate("/facilities", { state: { activeTab: category } })
          }
        >
          &larr;
        </span>
        <h2 className={styles.title}>
          Manage {facility?.name || "Facility"}
        </h2>
      </div>

      {/* Room Configuration Section */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Manage Room</h3>
        
        <div className={styles.formRow}>
          <label>
            Capacity:
            <input
              type="number"
              name="capacity"
              value={formData.capacity}
              onChange={handleChange}
              placeholder="Enter capacity"
            />
          </label>

          <label>
            Quantity:
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleChange}
              placeholder="Enter quantity"
            />
          </label>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <button
              type="button"
              className={styles.addBtn}
              onClick={handleAddRow}
            >
              <span className={styles.btnIcon}>+</span>
              Add
            </button>
          </div>
        </div>

        {formData.extraRows.map((row, idx) => (
          <div className={styles.formRow} key={`extra-row-${idx}`}>
            <label>
              Capacity:
              <input
                type="number"
                value={row.capacity}
                onChange={(e) =>
                  handleExtraRowChange(idx, "capacity", e.target.value)
                }
                placeholder="Enter capacity"
              />
            </label>

            <label>
              Quantity:
              <input
                type="number"
                value={row.quantity}
                onChange={(e) =>
                  handleExtraRowChange(idx, "quantity", e.target.value)
                }
                placeholder="Enter quantity"
              />
            </label>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => handleRemoveRow(idx)}
              >
                <span className={styles.btnIcon}>×</span>
                Remove
              </button>
            </div>
          </div>
        ))}

        <div className={styles.buttonContainer}>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={handleSaveRooms}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>
    </div>
  );
}
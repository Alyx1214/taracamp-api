import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import styles from "./Manage.module.css";
import { updateRooms, getFacilityById } from "../../apis/facilityApi";

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
    // Load facility data and reviews
    const loadFacilityData = async () => {
      try {
        const facilityId = id || facility?.id;
        if (facilityId) {
          const response = await getFacilityById(facilityId);
          if (response?.facility) {
            const facilityData = response.facility;
            // If facility has rooms, load them
            if (facilityData.rooms && Array.isArray(facilityData.rooms) && facilityData.rooms.length > 0) {
              const firstRoom = facilityData.rooms[0];
              const extraRooms = facilityData.rooms.slice(1);
              setFormData({
                capacity: firstRoom.capacity?.toString() || "",
                quantity: firstRoom.quantity?.toString() || "",
                name: firstRoom.name || "",
                status: firstRoom.status || "Available",
                extraRows: extraRooms.map(room => ({
                  capacity: room.capacity?.toString() || "",
                  quantity: room.quantity?.toString() || "",
                  name: room.name || "",
                  status: room.status || "Available",
                })),
              });
            } else if (facility) {
              // Fallback to facility from state if no rooms data
              setFormData({
                capacity: facility.capacity || "",
                quantity: facility.quantity || "",
                name: facility.name || "",
                status: facility.status || "Available",
                extraRows: facility.extraRows || [],
              });
            }
          }
        } else if (facility) {
          setFormData({
            capacity: facility.capacity || "",
            quantity: facility.quantity || "",
            name: facility.name || "",
            status: facility.status || "Available",
            extraRows: facility.extraRows || [],
          });
        }
      } catch (error) {
        console.error("Error loading facility data:", error);
        // Fallback to facility from state on error
        if (facility) {
          setFormData({
            capacity: facility.capacity || "",
            quantity: facility.quantity || "",
            name: facility.name || "",
            status: facility.status || "Available",
            extraRows: facility.extraRows || [],
          });
        }
      }
    };

    loadFacilityData();
  }, [id, facility]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddRow = () => {
    setFormData((prev) => ({
      ...prev,
      extraRows: [...prev.extraRows, { capacity: "", quantity: "", name: "", status: "Available" }],
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
      const facilityId = id || facility?.id;
      if (!facilityId) {
        alert("Facility ID is missing. Please try again.");
        setLoading(false);
        return;
      }

      // Validate that at least one room configuration is provided
      const hasMainRoom = formData.capacity && formData.quantity && formData.name;
      const hasExtraRooms = formData.extraRows.some(
        (row) => row.capacity && row.quantity && row.name
      );

      if (!hasMainRoom && !hasExtraRooms) {
        alert("Please provide at least one room configuration (name, capacity, and quantity).");
        setLoading(false);
        return;
      }

      const response = await updateRooms(facilityId, {
        capacity: formData.capacity,
        quantity: formData.quantity,
        name: formData.name,
        status: formData.status,
        extraRows: formData.extraRows,
      });

      if (response?.error || (response?.status && response.status >= 400)) {
        throw new Error(response?.error || "Failed to save room configuration");
      }

      if (response?.message || response?.data) {
        alert("Room configuration saved successfully!");
      }
    } catch (error) {
      console.error("Error saving rooms:", error);
      alert(
        error?.message || error?.error || "Failed to save room configuration. Please try again."
      );
    } finally {
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

        {/* Main room row: Name | Capacity | Status | Add */}
        <div className={styles.formRow}>
          <label>
            Name:
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter room name"
            />
          </label>

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

          <div className={styles.actionCell}>
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

        {/* Extra room rows */}
        {formData.extraRows.map((row, idx) => (
          <div key={`extra-row-${idx}`}>
            <div className={styles.formRow}>
              <label>
                Name:
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) =>
                    handleExtraRowChange(idx, "name", e.target.value)
                  }
                  placeholder="Enter room name"
                />
              </label>

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
                Status:
                <select
                  value={row.status}
                  onChange={(e) =>
                    handleExtraRowChange(idx, "status", e.target.value)
                  }
                >
                  <option value="Available">Available</option>
                  <option value="Unavailable">Unavailable</option>
                </select>
              </label>

              <div className={styles.actionCell}>
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
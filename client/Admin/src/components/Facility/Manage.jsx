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
    rooms: [],
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
              setFormData({
                rooms: facilityData.rooms.map(room => ({
                  capacity: room.capacity?.toString() || "",
                  name: room.name || "",
                  status: room.status || "Available",
                })),
              });
            } else {
              // Start with empty rooms array if no rooms exist
              setFormData({
                rooms: [],
              });
            }
          }
        }
      } catch (error) {
        console.error("Error loading facility data:", error);
        // Start with empty rooms array on error
        setFormData({
          rooms: [],
        });
      }
    };

    loadFacilityData();
  }, [id, facility]);

  const handleAddRow = () => {
    setFormData((prev) => ({
      ...prev,
      rooms: [...prev.rooms, { capacity: "", name: "", status: "Available" }],
    }));
  };

  const handleRemoveRow = (index) => {
    setFormData((prev) => {
      const rooms = Array.from(prev.rooms);
      rooms.splice(index, 1);
      return { ...prev, rooms };
    });
  };

  const handleRoomChange = (index, field, value) => {
    setFormData((prev) => {
      const rooms = Array.from(prev.rooms);
      rooms[index] = { ...rooms[index], [field]: value };
      return { ...prev, rooms };
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
      const hasValidRooms = formData.rooms.some(
        (room) => room.capacity && room.name
      );

      if (!hasValidRooms) {
        alert("Please provide at least one room configuration (name and capacity).");
        setLoading(false);
        return;
      }

      // Split rooms into first room and extra rows for backend compatibility
      const firstRoom = formData.rooms[0] || {};
      const extraRows = formData.rooms.slice(1);

      const response = await updateRooms(facilityId, {
        capacity: firstRoom.capacity,
        name: firstRoom.name,
        status: firstRoom.status,
        extraRows: extraRows,
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
        <h3 className={styles.sectionTitle}>Manage Rooms</h3>

        {/* All room rows */}
        {formData.rooms.length === 0 && (
          <div style={{ marginBottom: "1rem", color: "#666" }}>
            No rooms configured. Click "Add Room" to add a room.
          </div>
        )}

        {formData.rooms.map((room, idx) => (
          <div key={`room-${idx}`} style={{ marginBottom: "1rem" }}>
            <div className={styles.formRow}>
              <label>
                Name:
                <input
                  type="text"
                  value={room.name || ""}
                  onChange={(e) =>
                    handleRoomChange(idx, "name", e.target.value)
                  }
                  placeholder="Enter room name"
                />
              </label>

              <label>
                Capacity:
                <input
                  type="number"
                  value={room.capacity || ""}
                  onChange={(e) =>
                    handleRoomChange(idx, "capacity", e.target.value)
                  }
                  placeholder="Enter capacity"
                />
              </label>

              <label>
                Status:
                <select
                  value={room.status || "Available"}
                  onChange={(e) =>
                    handleRoomChange(idx, "status", e.target.value)
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

        {/* Add Room button */}
        <div style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={handleAddRow}
            style={{ padding: "0.5rem 1rem" }}
          >
            <span className={styles.btnIcon}>+</span>
            Add Room
          </button>
        </div>

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
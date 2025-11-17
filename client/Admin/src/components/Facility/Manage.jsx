import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import styles from "./Manage.module.css";
import { updateRooms, getFacilityById } from "../../apis/facilityApi";
import { searchReservations } from "../../apis/reservationApi";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

export default function Manage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const { category, facility } = location.state || {};

  const [formData, setFormData] = useState({
    rooms: [],
  });

  const [loading, setLoading] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [facilityData, setFacilityData] = useState(null);
  
  // State for delete confirmation modal
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    roomIndex: null,
    roomName: "",
  });

  useEffect(() => {
    // Load facility data and reviews
    const loadFacilityData = async () => {
      try {
        const facilityId = id || facility?.id;
        if (facilityId) {
          const response = await getFacilityById(facilityId);
          if (response?.facility) {
            const facilityData = response.facility;
            setFacilityData(facilityData);
            // If facility has rooms, load them
            if (facilityData.rooms && Array.isArray(facilityData.rooms) && facilityData.rooms.length > 0) {
              setFormData({
                rooms: facilityData.rooms.map(room => ({
                  capacity: room.capacity?.toString() || "",
                  name: room.name || "",
                  status: room.status || "Available",
                  assignedTo: room.assignedTo ? (room.assignedTo._id ? room.assignedTo._id.toString() : room.assignedTo.toString()) : "",
                  assignedGuests: room.assignedGuests?.toString() || "0",
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

  // Fetch confirmed reservations with service type Lodging or Event and Lodging for this facility
  useEffect(() => {
    const loadReservations = async () => {
      try {
        const facilityId = id || facility?.id;
        if (!facilityId) return;

        setLoadingReservations(true);
        
        // Fetch reservations with status Confirmed, service type Lodging or Event and Lodging, for this facility
        const params = {
          status: 'Confirmed',
          facility: facilityId,
          limit: 100, // Get a reasonable number of reservations
          skip: 0,
        };

        const response = await searchReservations(params);
        const allReservations = response?.reservations || [];
        
        // Filter by status: Confirmed, and service type: Lodging or Event and Lodging
        const filteredReservations = allReservations.filter(reservation => {
          const status = reservation.status || '';
          const serviceType = reservation.serviceType || '';
          return status === 'Confirmed' && 
                 (serviceType === 'Lodging' || serviceType === 'Event and Lodging');
        });

        setReservations(filteredReservations);
      } catch (error) {
        console.error("Error loading reservations:", error);
        setReservations([]);
      } finally {
        setLoadingReservations(false);
      }
    };

    loadReservations();
  }, [id, facility]);

  const handleAddRow = () => {
    setFormData((prev) => ({
      ...prev,
      rooms: [...prev.rooms, { capacity: "", name: "", status: "Available", assignedTo: "", assignedGuests: "0" }],
    }));
  };

  // Open delete confirmation modal
  const handleRemoveRowClick = (index) => {
    const room = formData.rooms[index];
    setDeleteModal({
      isOpen: true,
      roomIndex: index,
      roomName: room.name || `Room ${index + 1}`,
    });
  };

  // Close delete confirmation modal
  const handleCloseDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      roomIndex: null,
      roomName: "",
    });
  };

  // Confirm delete and remove room
  const handleConfirmDelete = () => {
    if (deleteModal.roomIndex !== null) {
      setFormData((prev) => {
        const rooms = Array.from(prev.rooms);
        rooms.splice(deleteModal.roomIndex, 1);
        return { ...prev, rooms };
      });
    }
    handleCloseDeleteModal();
  };

  const handleRoomChange = (index, field, value) => {
    setFormData((prev) => {
      const rooms = Array.from(prev.rooms);
      const updatedRoom = { ...rooms[index], [field]: value };
      
      // If assignedTo is changed, automatically calculate assignedGuests and set status
      if (field === "assignedTo") {
        if (!value) {
          // Clear assignment - set status back to Available
          updatedRoom.assignedGuests = "0";
          updatedRoom.status = "Available";
        } else {
          // Automatically assign guests based on room capacity and remaining unassigned guests
          const reservation = reservations.find(r => r._id === value);
          if (reservation) {
            const totalGuests = reservation.numberOfGuests?.total || 0;
            const roomCapacity = parseInt(updatedRoom.capacity) || 0;
            
            // Calculate already assigned guests to this reservation from other rooms
            const alreadyAssigned = rooms
              .filter((room, idx) => idx !== index && room.assignedTo === value)
              .reduce((sum, room) => sum + (parseInt(room.assignedGuests) || 0), 0);
            
            // Calculate remaining unassigned guests
            const remainingUnassigned = Math.max(0, totalGuests - alreadyAssigned);
            
            // Automatically assign: min(room capacity, remaining unassigned guests)
            const autoAssigned = Math.min(roomCapacity, remainingUnassigned);
            updatedRoom.assignedGuests = autoAssigned.toString();
            
            // Automatically set status to Unavailable when assigned
            updatedRoom.status = "Unavailable";
          }
        }
      }
      
      // If capacity changes and room is assigned, recalculate assigned guests
      if (field === "capacity" && updatedRoom.assignedTo) {
        const reservation = reservations.find(r => r._id === updatedRoom.assignedTo);
        if (reservation) {
          const totalGuests = reservation.numberOfGuests?.total || 0;
          const newRoomCapacity = parseInt(value) || 0;
          
          // Calculate already assigned guests to this reservation from other rooms (excluding current room)
          const alreadyAssignedFromOthers = rooms
            .filter((room, idx) => idx !== index && room.assignedTo === updatedRoom.assignedTo)
            .reduce((sum, room) => sum + (parseInt(room.assignedGuests) || 0), 0);
          
          // Calculate remaining unassigned guests (after removing current room's assignment)
          const remainingUnassigned = Math.max(0, totalGuests - alreadyAssignedFromOthers);
          
          // Automatically assign: min(new room capacity, remaining unassigned guests)
          const autoAssigned = Math.min(newRoomCapacity, remainingUnassigned);
          updatedRoom.assignedGuests = autoAssigned.toString();
        }
      }
      
      rooms[index] = updatedRoom;
      return { ...prev, rooms };
    });
  };

  // Helper function to get reservation by ID
  const getReservationById = (reservationId) => {
    return reservations.find(r => r._id === reservationId);
  };

  // Helper function to calculate remaining unassigned guests for a reservation
  const getRemainingUnassignedGuests = (reservationId) => {
    if (!reservationId) return null;
    const reservation = getReservationById(reservationId);
    if (!reservation) return null;
    
    const totalGuests = reservation.numberOfGuests?.total || 0;
    const assignedGuests = formData.rooms
      .filter(room => room.assignedTo === reservationId)
      .reduce((sum, room) => sum + (parseInt(room.assignedGuests) || 0), 0);
    
    return Math.max(0, totalGuests - assignedGuests);
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

      // Validate assigned guests don't exceed room capacities (shouldn't happen with auto-assignment, but check anyway)
      for (const room of formData.rooms) {
        if (room.assignedTo && room.assignedGuests) {
          const roomCapacity = parseInt(room.capacity) || 0;
          const assignedGuests = parseInt(room.assignedGuests) || 0;
          if (assignedGuests > roomCapacity) {
            alert(`Room "${room.name || 'Unnamed'}" has ${assignedGuests} guests assigned but capacity is only ${roomCapacity}. Please adjust.`);
            setLoading(false);
            return;
          }
        }
      }

      // Split rooms into first room and extra rows for backend compatibility
      const firstRoom = formData.rooms[0] || {};
      const extraRows = formData.rooms.slice(1).map(room => ({
        capacity: room.capacity,
        name: room.name,
        status: room.status,
        assignedTo: room.assignedTo || undefined,
        assignedGuests: room.assignedTo && room.assignedGuests ? parseInt(room.assignedGuests) || 0 : undefined,
      }));

      const response = await updateRooms(facilityId, {
        capacity: firstRoom.capacity,
        name: firstRoom.name,
        status: firstRoom.status,
        assignedTo: firstRoom.assignedTo || undefined,
        assignedGuests: firstRoom.assignedTo && firstRoom.assignedGuests ? parseInt(firstRoom.assignedGuests) || 0 : undefined,
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
          <div key={`room-${idx}`} className={styles.roomCard}>
            <div className={styles.roomCardHeader}>
              <h4 className={styles.roomCardTitle}>
                {room.name || `Room ${idx + 1}`}
              </h4>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => handleRemoveRowClick(idx)}
              >
                <span className={styles.btnIcon}>×</span>
                Remove
              </button>
            </div>
            
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
                  disabled={!!room.assignedTo}
                  title={room.assignedTo ? "Status is automatically set to Unavailable when room is assigned" : ""}
                >
                  <option value="Available">Available</option>
                  <option value="Unavailable">Unavailable</option>
                </select>
              </label>

              <label>
                Assign To:
                <select
                  value={room.assignedTo || ""}
                  onChange={(e) =>
                    handleRoomChange(idx, "assignedTo", e.target.value)
                  }
                  disabled={loadingReservations}
                >
                  <option value="">-- Select Guest --</option>
                  {reservations
                    .filter((reservation) => {
                      // Only show reservations that have remaining unassigned guests
                      const remaining = getRemainingUnassignedGuests(reservation._id);
                      return remaining > 0;
                    })
                    .map((reservation) => {
                      const remaining = getRemainingUnassignedGuests(reservation._id);
                      const totalGuests = reservation.numberOfGuests?.total || 0;
                      return (
                        <option key={reservation._id} value={reservation._id}>
                          {reservation.guestName || "Unknown Guest"}
                          {` - ${totalGuests} guests`}
                          {remaining !== null && remaining < totalGuests ? ` (${remaining} remaining)` : ""}
                        </option>
                      );
                    })}
                </select>
              </label>
            </div>

            {room.assignedTo && (() => {
              const reservation = getReservationById(room.assignedTo);
              const roomCapacity = parseInt(room.capacity) || 0;
              const assignedGuests = parseInt(room.assignedGuests) || 0;
              const remainingCapacity = roomCapacity - assignedGuests;
              const totalGuests = reservation?.numberOfGuests?.total || 0;
              const remainingUnassigned = getRemainingUnassignedGuests(room.assignedTo);
              
              return (
                <div className={styles.assignmentSummary}>
                  <div className={styles.assignmentHeader}>
                    <span className={styles.assignmentTitle}>Assignment Summary</span>
                  </div>
                  <div className={styles.assignmentContent}>
                    <div className={styles.assignmentRow}>
                      <span className={styles.assignmentLabel}>Guests Assigned:</span>
                      <span className={styles.assignmentValue}>
                        <strong>{assignedGuests}</strong> / {roomCapacity} (capacity)
                      </span>
                    </div>
                    <div className={styles.assignmentRow}>
                      <span className={styles.assignmentLabel}>Total guests in reservation:</span>
                      <span className={styles.assignmentValue}><strong>{totalGuests}</strong></span>
                    </div>
                    <div className={styles.assignmentRow}>
                      <span className={styles.assignmentLabel}>Remaining unassigned:</span>
                      <span className={styles.assignmentValue} style={{ color: remainingUnassigned > 0 ? "#d97706" : "#059669" }}>
                        <strong>{remainingUnassigned !== null ? remainingUnassigned : totalGuests}</strong>
                      </span>
                    </div>
                    {remainingCapacity > 0 && remainingUnassigned > 0 && (
                      <div className={styles.assignmentNote}>
                        This room can accommodate {Math.min(remainingCapacity, remainingUnassigned)} more guest(s)
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
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

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        type={`Room "${deleteModal.roomName}"`}
      />
    </div>
  );
}
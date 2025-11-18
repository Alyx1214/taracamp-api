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
                  assignments: room.assignments && Array.isArray(room.assignments) && room.assignments.length > 0
                    ? room.assignments.map(assignment => ({
                        reservationId: assignment.reservationId?._id ? assignment.reservationId._id.toString() : assignment.reservationId?.toString() || "",
                        guestsAssigned: assignment.guestsAssigned?.toString() || "0",
                        startDate: assignment.startDate ? new Date(assignment.startDate).toISOString().split('T')[0] : "",
                        endDate: assignment.endDate ? new Date(assignment.endDate).toISOString().split('T')[0] : "",
                      }))
                    : [{ reservationId: "", guestsAssigned: "0", startDate: "", endDate: "" }],
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

  const handleAddRoom = () => {
    setFormData((prev) => ({
      ...prev,
      rooms: [...prev.rooms, { 
        capacity: "", 
        name: "", 
        status: "Available", 
        assignments: [{ reservationId: "", guestsAssigned: "0", startDate: "", endDate: "" }]
      }],
    }));
  };

  // Open delete confirmation modal
  const handleRemoveRoomClick = (index) => {
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

  const handleRoomChange = (roomIndex, field, value) => {
    setFormData((prev) => {
      const rooms = Array.from(prev.rooms);
      const updatedRoom = { ...rooms[roomIndex], [field]: value };
      
      // Update status based on assignments
      if (field === "capacity" || field === "assignments") {
        const hasActiveAssignments = updatedRoom.assignments.some(a => a.reservationId);
        updatedRoom.status = hasActiveAssignments ? "Unavailable" : "Available";
      }
      
      rooms[roomIndex] = updatedRoom;
      return { ...prev, rooms };
    });
  };

  const handleAssignmentChange = (roomIndex, assignmentIndex, field, value) => {
    setFormData((prev) => {
      const rooms = Array.from(prev.rooms);
      const room = { ...rooms[roomIndex] };
      const assignments = Array.from(room.assignments);
      const assignment = { ...assignments[assignmentIndex], [field]: value };
      
      // If reservationId is changed, auto-calculate guests and dates
      if (field === "reservationId") {
        if (!value) {
          // Clear assignment
          assignment.guestsAssigned = "0";
          assignment.startDate = "";
          assignment.endDate = "";
        } else {
          const reservation = reservations.find(r => r._id === value);
          if (reservation) {
            const totalGuests = reservation.numberOfGuests?.total || 0;
            const roomCapacity = parseInt(room.capacity) || 0;
            
            // Calculate already assigned guests to this reservation from all rooms and assignments
            const alreadyAssigned = rooms.reduce((total, r, rIdx) => {
              return total + r.assignments.reduce((sum, a, aIdx) => {
                if (a.reservationId === value && !(rIdx === roomIndex && aIdx === assignmentIndex)) {
                  return sum + (parseInt(a.guestsAssigned) || 0);
                }
                return sum;
              }, 0);
            }, 0);
            
            const remainingUnassigned = Math.max(0, totalGuests - alreadyAssigned);
            const autoAssigned = Math.min(roomCapacity, remainingUnassigned);
            assignment.guestsAssigned = autoAssigned.toString();
            
            // Auto-fill dates from reservation
            if (reservation.dateOfArrival) {
              assignment.startDate = new Date(reservation.dateOfArrival).toISOString().split('T')[0];
            }
            if (reservation.dateOfDeparture) {
              assignment.endDate = new Date(reservation.dateOfDeparture).toISOString().split('T')[0];
            }
          }
        }
      }
      
      assignments[assignmentIndex] = assignment;
      room.assignments = assignments;
      
      // Update room status
      const hasActiveAssignments = assignments.some(a => a.reservationId);
      room.status = hasActiveAssignments ? "Unavailable" : "Available";
      
      rooms[roomIndex] = room;
      return { ...prev, rooms };
    });
  };

  const handleAddAssignment = (roomIndex) => {
    setFormData((prev) => {
      const rooms = Array.from(prev.rooms);
      const room = { ...rooms[roomIndex] };
      room.assignments = [...room.assignments, { reservationId: "", guestsAssigned: "0", startDate: "", endDate: "" }];
      rooms[roomIndex] = room;
      return { ...prev, rooms };
    });
  };

  const handleRemoveAssignment = (roomIndex, assignmentIndex) => {
    setFormData((prev) => {
      const rooms = Array.from(prev.rooms);
      const room = { ...rooms[roomIndex] };
      room.assignments = room.assignments.filter((_, idx) => idx !== assignmentIndex);
      
      // If no assignments left, add an empty one
      if (room.assignments.length === 0) {
        room.assignments = [{ reservationId: "", guestsAssigned: "0", startDate: "", endDate: "" }];
      }
      
      // Update room status
      const hasActiveAssignments = room.assignments.some(a => a.reservationId);
      room.status = hasActiveAssignments ? "Unavailable" : "Available";
      
      rooms[roomIndex] = room;
      return { ...prev, rooms };
    });
  };

  // Helper function to get reservation by ID
  const getReservationById = (reservationId) => {
    return reservations.find(r => r._id === reservationId);
  };

  // Helper function to calculate remaining unassigned guests for a reservation
  const getRemainingUnassignedGuests = (reservationId, excludeRoomIndex = null, excludeAssignmentIndex = null) => {
    if (!reservationId) return null;
    const reservation = getReservationById(reservationId);
    if (!reservation) return null;
    
    const totalGuests = reservation.numberOfGuests?.total || 0;
    const assignedGuests = formData.rooms.reduce((total, room, roomIdx) => {
      return total + room.assignments.reduce((sum, assignment, assignmentIdx) => {
        if (assignment.reservationId === reservationId) {
          // Exclude specific assignment if specified
          if (excludeRoomIndex === roomIdx && excludeAssignmentIndex === assignmentIdx) {
            return sum;
          }
          return sum + (parseInt(assignment.guestsAssigned) || 0);
        }
        return sum;
      }, 0);
    }, 0);
    
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

      // Validate assignments
      for (const room of formData.rooms) {
        for (const assignment of room.assignments) {
          if (assignment.reservationId) {
            // Validate guests assigned
            const guestsAssigned = parseInt(assignment.guestsAssigned) || 0;
            const roomCapacity = parseInt(room.capacity) || 0;
            if (guestsAssigned > roomCapacity) {
              alert(`Room "${room.name || 'Unnamed'}" has ${guestsAssigned} guests assigned but capacity is only ${roomCapacity}. Please adjust.`);
              setLoading(false);
              return;
            }
            
            // Validate date range
            if (!assignment.startDate || !assignment.endDate) {
              alert(`Please provide both start and end dates for all assignments in room "${room.name || 'Unnamed'}".`);
              setLoading(false);
              return;
            }
            
            if (new Date(assignment.endDate) < new Date(assignment.startDate)) {
              alert(`End date must be after start date for room "${room.name || 'Unnamed'}".`);
              setLoading(false);
              return;
            }
          }
        }
      }

      // Transform rooms data for backend
      const roomsData = formData.rooms.map(room => ({
        capacity: room.capacity,
        name: room.name,
        status: room.status,
        assignments: room.assignments
          .filter(a => a.reservationId) // Only include assignments with a reservation
          .map(a => ({
            reservationId: a.reservationId,
            guestsAssigned: parseInt(a.guestsAssigned) || 0,
            startDate: a.startDate,
            endDate: a.endDate,
          })),
      }));

      const response = await updateRooms(facilityId, { rooms: roomsData });

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

        {formData.rooms.map((room, roomIdx) => (
          <div key={`room-${roomIdx}`} className={styles.roomCard}>
            <div className={styles.roomCardHeader}>
              <h4 className={styles.roomCardTitle}>
                {room.name || `Room ${roomIdx + 1}`}
              </h4>
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => handleRemoveRoomClick(roomIdx)}
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
                    handleRoomChange(roomIdx, "name", e.target.value)
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
                    handleRoomChange(roomIdx, "capacity", e.target.value)
                  }
                  placeholder="Enter capacity"
                />
              </label>

              <label>
                Status:
                <select
                  value={room.status || "Available"}
                  onChange={(e) =>
                    handleRoomChange(roomIdx, "status", e.target.value)
                  }
                  disabled={room.assignments.some(a => a.reservationId)}
                  title={room.assignments.some(a => a.reservationId) ? "Status is automatically set based on assignments" : ""}
                >
                  <option value="Available">Available</option>
                  <option value="Unavailable">Unavailable</option>
                </select>
              </label>
            </div>

            {/* Assignments Section */}
            <div className={styles.assignmentsSection}>
              <h5 className={styles.assignmentsSectionTitle}>Room Assignments</h5>
              
              {room.assignments.map((assignment, assignmentIdx) => (
                <div key={`assignment-${assignmentIdx}`} className={styles.assignmentCard}>
                  <div className={styles.assignmentHeader}>
                    <span className={styles.assignmentNumber}>Assignment {assignmentIdx + 1}</span>
                    {room.assignments.length > 1 && (
                      <button
                        type="button"
                        className={styles.removeAssignmentBtn}
                        onClick={() => handleRemoveAssignment(roomIdx, assignmentIdx)}
                      >
                        <span className={styles.btnIcon}>×</span>
                      </button>
                    )}
                  </div>
                  
                  <div className={styles.assignmentFormRow}>
                    <label>
                      Assign To Guest:
                      <select
                        value={assignment.reservationId || ""}
                        onChange={(e) =>
                          handleAssignmentChange(roomIdx, assignmentIdx, "reservationId", e.target.value)
                        }
                        disabled={loadingReservations}
                      >
                        <option value="">-- Select Guest --</option>
                        {reservations
                          .filter((reservation) => {
                            const remaining = getRemainingUnassignedGuests(reservation._id, roomIdx, assignmentIdx);
                            const isCurrentlyAssigned = assignment.reservationId === reservation._id;
                            return remaining > 0 || isCurrentlyAssigned;
                          })
                          .map((reservation) => {
                            const remaining = getRemainingUnassignedGuests(reservation._id, roomIdx, assignmentIdx);
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

                    <label>
                      Guests Assigned:
                      <input
                        type="number"
                        value={assignment.guestsAssigned || "0"}
                        onChange={(e) =>
                          handleAssignmentChange(roomIdx, assignmentIdx, "guestsAssigned", e.target.value)
                        }
                        placeholder="Number of guests"
                        disabled={!assignment.reservationId}
                        min="0"
                        max={room.capacity}
                      />
                    </label>
                  </div>

                  <div className={styles.assignmentFormRow}>
                    <label>
                      Start Date:
                      <input
                        type="date"
                        value={assignment.startDate || ""}
                        onChange={(e) =>
                          handleAssignmentChange(roomIdx, assignmentIdx, "startDate", e.target.value)
                        }
                        disabled={!assignment.reservationId}
                      />
                    </label>

                    <label>
                      End Date:
                      <input
                        type="date"
                        value={assignment.endDate || ""}
                        onChange={(e) =>
                          handleAssignmentChange(roomIdx, assignmentIdx, "endDate", e.target.value)
                        }
                        disabled={!assignment.reservationId}
                        min={assignment.startDate}
                      />
                    </label>
                  </div>

                  {assignment.reservationId && (() => {
                    const reservation = getReservationById(assignment.reservationId);
                    const roomCapacity = parseInt(room.capacity) || 0;
                    const assignedGuests = parseInt(assignment.guestsAssigned) || 0;
                    const totalGuests = reservation?.numberOfGuests?.total || 0;
                    const remainingUnassigned = getRemainingUnassignedGuests(assignment.reservationId, roomIdx, assignmentIdx);
                    
                    return (
                      <div className={styles.assignmentSummary}>
                        <div className={styles.assignmentRow}>
                          <span className={styles.assignmentLabel}>Guest Name:</span>
                          <span className={styles.assignmentValue}>
                            <strong>{reservation?.guestName || "Unknown Guest"}</strong>
                          </span>
                        </div>
                        <div className={styles.assignmentRow}>
                          <span className={styles.assignmentLabel}>Guests in this assignment:</span>
                          <span className={styles.assignmentValue}>
                            <strong>{assignedGuests}</strong> / {roomCapacity} (room capacity)
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
                      </div>
                    );
                  })()}
                </div>
              ))}

              <button
                type="button"
                className={styles.addAssignmentBtn}
                onClick={() => handleAddAssignment(roomIdx)}
              >
                <span className={styles.btnIcon}>+</span>
                Add Assignment
              </button>
            </div>
          </div>
        ))}

        {/* Add Room button */}
        <div style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={handleAddRoom}
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
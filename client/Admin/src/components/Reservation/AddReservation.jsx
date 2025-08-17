import React, { useState } from "react";
import styles from "./AddReservation.module.css";

const AddReservation = () => {
  const [formData, setFormData] = useState({
    guestName: "",
    checkIn: "",
    checkOut: "",
    roomType: "",
    notes: "",
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Submitting reservation:", formData);
  };

  return (
    <div className={styles.addReservation}>
      <h1 className={styles.addReservationTitle}>Add New Reservation</h1>
      <form className={styles.addReservationForm} onSubmit={handleSubmit}>
        
        <div className={styles.formGroup}>
          <label>Guest Name</label>
          <input
            type="text"
            name="guestName"
            value={formData.guestName}
            onChange={handleChange}
            required
          />
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label>Check-In Date</label>
            <input
              type="date"
              name="checkIn"
              value={formData.checkIn}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label>Check-Out Date</label>
            <input
              type="date"
              name="checkOut"
              value={formData.checkOut}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>Room Type</label>
          <select
            name="roomType"
            value={formData.roomType}
            onChange={handleChange}
            required
          >
            <option value="">Select a Room</option>
            <option value="single">Single Room</option>
            <option value="double">Double Room</option>
            <option value="suite">Suite</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label>Notes</label>
          <textarea
            name="notes"
            rows="3"
            value={formData.notes}
            onChange={handleChange}
          />
        </div>

        <button type="submit" className={styles.addReservationBtn}>
          Save Reservation
        </button>
      </form>
    </div>
  );
};

export default AddReservation;

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./AddUsersForm.module.css";


export default function AddUserForm({ onAddUser }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "Staff",
    password: "",
  });


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };


  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      alert("Please fill out all required fields.");
      return;
    }


    onAddUser?.(formData);
    navigate("/users");
  };


  return (
    <div className={styles["add-user-container"]}>
      <h2 className={styles["add-user-header"]}>Add New User</h2>


      <form onSubmit={handleSubmit} className={styles["add-user-form"]}>
        {/* Name */}
        <div>
          <label className={styles["add-user-label"]}>Full Name *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={styles["add-user-input"]}
            placeholder="Enter full name"
            required
          />
        </div>


        {/* Email */}
        <div>
          <label className={styles["add-user-label"]}>Email *</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={styles["add-user-input"]}
            placeholder="Enter email"
            required
          />
        </div>


        {/* Role */}
        <div>
          <label className={styles["add-user-label"]}>Role</label>
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            className={styles["add-user-select"]}
          >
            <option value="Admin">Admin</option>
            <option value="Front Desk">Front Desk</option>
            <option value="Superintendent">Superintendent</option>
            <option value="Staff">Staff</option>
          </select>
        </div>


        {/* Password */}
        <div>
          <label className={styles["add-user-label"]}>Password *</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className={styles["add-user-input"]}
            placeholder="Enter password"
            required
          />
        </div>


        {/* Buttons */}
        <div className={styles["add-user-row"]}>
          <button
            type="button"
            onClick={() => navigate("/users")}
            className={styles["add-user-submit"]}
            style={{ backgroundColor: "#ccc", color: "#000" }}
          >
            Cancel
          </button>
          <button type="submit" className={styles["add-user-submit"]}>
            Save User
          </button>
        </div>
      </form>
    </div>
  );
}

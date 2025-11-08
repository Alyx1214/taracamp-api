import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { addUser, updateUser } from "../../apis/userApi";
import styles from "./AddUsersForm.module.css";


export default function AddUserForm({ onAddUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEditMode = Boolean(id || location.state?.user);
  const userToEdit = location.state?.user || null;

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "CRMS Team", 
    password: "",
  });

  useEffect(() => {
    if (isEditMode && userToEdit) {
      setFormData({
        name: userToEdit.name || "",
        email: userToEdit.email || "",
        role: userToEdit.role || "CRMS Team",
        password: "",
      });
    }
  }, [isEditMode, userToEdit]);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      alert("Please fill out all required fields.");
      return;
    }

    // Password is required for add mode, optional for edit mode
    if (!isEditMode && !formData.password) {
      alert("Please fill out all required fields.");
      return;
    }

    try {
      if (isEditMode) {
        const userId = id || userToEdit?.id;
        if (!userId) {
          alert("User ID is required for editing.");
          return;
        }
        const updateData = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
        };
        // Only include password if provided
        if (formData.password && formData.password.trim()) {
          updateData.password = formData.password;
        }
        await updateUser(userId, updateData);
        alert("User updated successfully.");
      } else {
        await addUser({
          name: formData.name,
          email: formData.email,
          role: formData.role, 
          password: formData.password,
        });
        alert("User added successfully.");
      }
      navigate("/user");
    } catch (err) {
      const msg = err?.data?.error || err?.message || (isEditMode ? "Failed to update user" : "Failed to add user");
      alert(msg);
    }
  };


  return (
    <div className={styles["add-user-container"]}>
      <div className={styles.header}>
        <span
          className={styles["add-form-back"]}
          onClick={() => navigate('/users')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/users')}
          aria-label="Go back"
        >
          &larr;
        </span>
        <h1 className={styles.title}>{isEditMode ? "Edit User" : "Add New User"}</h1>
      </div>

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
            <option value="Guest">Guest</option>
            <option value="Superintendent">Superintendent</option>
            <option value="Frontdesk">Front Desk</option>
            <option value="CRMS Team">Staff</option>
            <option value="Accounting">Accounting</option>
          </select>
        </div>


        {/* Password */}
        <div>
          <label className={styles["add-user-label"]}>
            Password {isEditMode ? "" : "*"}
          </label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className={styles["add-user-input"]}
            placeholder="Enter password"
            required={!isEditMode}
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
            {isEditMode ? "Update User" : "Save User"}
          </button>
        </div>
      </form>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { addUser, updateUser } from "../../apis/userApi";
import styles from "./AddUsersForm.module.css";

export default function AddUserForm({ onAddUser }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isEditMode = Boolean(id || location.state?.user);
  const userToEdit = location.state?.user || null;

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "CRMS Team",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isEditMode && userToEdit) {
      const nameParts = userToEdit.name ? userToEdit.name.split(" ") : [];
      const firstName = userToEdit.firstName || nameParts[0] || "";
      const lastName = userToEdit.lastName || nameParts.slice(1).join(" ") || "";

      setFormData({
        firstName,
        lastName,
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

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.email) {
      alert("Please fill out all required fields.");
      return;
    }

    // Password is required for add mode, optional for edit mode
    if (!isEditMode && !formData.password) {
      alert("Please fill out all required fields.");
      return;
    }

    try {
      const fullName = `${formData.firstName} ${formData.lastName}`.trim();

      if (isEditMode) {
        const userId = id || userToEdit?.id;
        if (!userId) {
          alert("User ID is required for editing.");
          return;
        }
        const updateData = {
          name: fullName,
          firstName: formData.firstName,
          lastName: formData.lastName,
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
          name: fullName,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          role: formData.role,
          password: formData.password,
        });
        alert("User added successfully.");
      }
      navigate("/user");
    } catch (err) {
      const msg =
        err?.data?.error ||
        err?.message ||
        (isEditMode ? "Failed to update user" : "Failed to add user");
      alert(msg);
    }
  };

  return (
    <div className={styles["add-user-container"]}>
      <div className={styles.header}>
        <span
          className={styles["add-form-back"]}
          onClick={() => navigate("/users")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) =>
            (e.key === "Enter" || e.key === " ") && navigate("/users")
          }
          aria-label="Go back"
        >
          &larr;
        </span>
        <h1 className={styles.title}>
          {isEditMode ? "Edit User" : "Add New User"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className={styles["add-user-form"]}>
        {/* First Name and Last Name Row */}
        <div className={styles["add-user-row"]}>
          <div>
            <label className={styles["add-user-label"]}>First Name *</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              className={styles["add-user-input"]}
              placeholder="Enter first name"
              required
            />
          </div>

          <div>
            <label className={styles["add-user-label"]}>Last Name *</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              className={styles["add-user-input"]}
              placeholder="Enter last name"
              required
            />
          </div>
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
          <div className={styles["password-input-wrapper"]}>
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={styles["add-user-input"]}
              placeholder={isEditMode ? "Leave blank to keep current password" : "Enter password"}
              required={!isEditMode}
            />
            <button
              type="button"
              className={styles["password-toggle-btn"]}
              onClick={togglePasswordVisibility}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
        </div>

        {/* Buttons */}
        <div className={styles.buttonContainer}>
          <button
            type="button"
            onClick={() => navigate("/users")}
            className={styles["add-user-cancel"]}
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
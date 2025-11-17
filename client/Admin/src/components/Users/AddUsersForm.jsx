import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { addUser, updateUser } from "../../apis/userApi";
import ConfirmModal from "../Shared/ConfirmModal";
import SuccessModal from "../Users/UsersModal";
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
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingFormData, setPendingFormData] = useState(null);

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

    // Store form data and show confirmation modal
    setPendingFormData(formData);
    setConfirmModalOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!pendingFormData) return;

    try {
      setSubmitting(true);
      const fullName = `${pendingFormData.firstName} ${pendingFormData.lastName}`.trim();

      if (isEditMode) {
        const userId = id || userToEdit?.id;
        if (!userId) {
          alert("User ID is required for editing.");
          setSubmitting(false);
          setConfirmModalOpen(false);
          return;
        }
        const updateData = {
          name: fullName,
          firstName: pendingFormData.firstName,
          lastName: pendingFormData.lastName,
          email: pendingFormData.email,
          role: pendingFormData.role,
        };
        // Only include password if provided
        if (pendingFormData.password && pendingFormData.password.trim()) {
          updateData.password = pendingFormData.password;
        }
        await updateUser(userId, updateData);
        setSuccessMessage(`User "${fullName}" has been successfully updated.`);
      } else {
        await addUser({
          name: fullName,
          firstName: pendingFormData.firstName,
          lastName: pendingFormData.lastName,
          email: pendingFormData.email,
          role: pendingFormData.role,
          password: pendingFormData.password,
        });
        setSuccessMessage(`User "${fullName}" has been successfully added to the system.`);
      }
      setConfirmModalOpen(false);
      setPendingFormData(null);
      setSuccessModalOpen(true);
    } catch (err) {
      const msg =
        err?.data?.error ||
        err?.message ||
        (isEditMode ? "Failed to update user" : "Failed to add user");
      alert(msg);
      setConfirmModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelModal = () => {
    setConfirmModalOpen(false);
    setPendingFormData(null);
  };

  const handleSuccessModalClose = () => {
    setSuccessModalOpen(false);
    navigate("/users");
  };

  const getConfirmMessage = () => {
    if (!pendingFormData) return "";
    const fullName = `${pendingFormData.firstName} ${pendingFormData.lastName}`.trim();
    if (isEditMode) {
      return `Are you sure you want to update the user "${fullName}"? This will modify their account information.`;
    }
    return `Are you sure you want to add a new user "${fullName}" with the role "${pendingFormData.role}"? They will be able to access the system once created.`;
  };

  return (
    <>
      <div className={styles["add-user-container"]}>
        <div className={styles.header}>
          <span
            className={styles["add-form-back"]}
            onClick={() => navigate("/user")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) =>
              (e.key === "Enter" || e.key === " ") && navigate("/user")
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
              onClick={() => navigate("/user")}
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

      {/* Confirmation Modal */}
      <ConfirmModal
        open={confirmModalOpen}
        title={isEditMode ? "Update User" : "Add New User"}
        message={getConfirmMessage()}
        confirmText={isEditMode ? "Update User" : "Save User"}
        cancelText="Cancel"
        confirming={submitting}
        variant={isEditMode ? "primary" : "success"}
        onCancel={handleCancelModal}
        onConfirm={handleConfirmSubmit}
      />

      {/* Success Modal */}
      <SuccessModal
        open={successModalOpen}
        message={successMessage}
        onClose={handleSuccessModalClose}
        autoClose={false}
      />
    </>
  );
}